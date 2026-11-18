// Skenario dari CSSD-Master/03-BUILD-AND-RELEASE.md (T02 sampai T07) dan
// PRD-PRODUCTION (P-05 sampai P-18), dijalankan terhadap SQLite nyata lewat
// fungsi alur kerja yang sama dengan antarmuka.
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/server/db';
import type { Actor } from '@/server/identity';
import {
  DomainError,
  acknowledgePackage,
  cancelRequest,
  closeRecall,
  completeCycle,
  createLoad,
  createPackage,
  createRequest,
  decideQuality,
  dispatchPackages,
  movePackages,
  openRecall,
  pullExpired,
  receiveTray,
  recordCleaning,
  recordEvidence,
  recordInspection,
  recordLabelPrint,
  recordUsage,
  resolveOccurredAt,
  setDeviceStatus,
  startCycle,
  updateRecallItem,
} from '@/server/workflow';
import { actorByUsername, allGood, expectedOf } from './helpers';

let receiving: Actor;
let packing: Actor;
let machine: Actor;
let reviewer: Actor;
let warehouse: Actor;
let unitOk: Actor;
let unitVk: Actor;
let supervisor: Actor;
let admin: Actor;

beforeAll(async () => {
  receiving = await actorByUsername('latihan.penerimaan');
  packing = await actorByUsername('latihan.pengemasan');
  machine = await actorByUsername('latihan.mesin');
  reviewer = await actorByUsername('latihan.reviewer');
  warehouse = await actorByUsername('latihan.distribusi');
  unitOk = await actorByUsername('latihan.unit.ok');
  unitVk = await actorByUsername('latihan.unit.vk');
  supervisor = await actorByUsername('latihan.supervisor');
  admin = await actorByUsername('latihan.admin');
});

async function expectDomainError(promise: Promise<unknown>, code: DomainError['code']) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
}

async function unitId(code: string) {
  return (await prisma.unit.findFirstOrThrow({ where: { facilityId: receiving.facilityId, code } })).id;
}

async function caseVersion(code: string) {
  return (await prisma.reprocessingCase.findFirstOrThrow({ where: { code } })).version;
}

async function loadVersion(code: string) {
  return (await prisma.load.findFirstOrThrow({ where: { code } })).version;
}

async function deviceId(code = 'UAP-01') {
  return (await prisma.device.findFirstOrThrow({ where: { facilityId: admin.facilityId, code } })).id;
}

let trayCounter = 900;
async function newTray(unitCode = 'OK') {
  const set = await prisma.setTemplate.findFirstOrThrow({ where: { facilityId: admin.facilityId, code: 'SET-BEDAH-MAYOR' } });
  return prisma.tray.create({
    data: { facilityId: admin.facilityId, code: `TR-T${++trayCounter}`, setTemplateId: set.id, homeUnitId: await unitId(unitCode) },
  });
}

/** Tray baru sampai menjadi paket siap muat. */
async function packageFromNewTray(unitCode = 'OK'): Promise<string> {
  const tray = await newTray(unitCode);
  const created = await receiveTray(receiving, { trayCode: tray.code, originUnitId: tray.homeUnitId, actualCount: await expectedOf(tray.setTemplateId) });
  await recordCleaning(receiving, { caseCode: created.code, outcome: 'PASS', expectedVersion: 1 });
  await recordInspection(packing, { caseCode: created.code, lines: await allGood(created.code), expectedVersion: 2 });
  const pack = await createPackage(packing, { caseCode: created.code, materialLot: 'LOT-UJI-01', expectedVersion: 3 });
  return pack.code;
}

async function completedLoad(count = 1) {
  const packageCodes: string[] = [];
  for (let index = 0; index < count; index++) packageCodes.push(await packageFromNewTray());
  const load = await createLoad(machine, { deviceId: await deviceId(), packageCodes });
  await startCycle(machine, { loadCode: load.code, expectedVersion: 1 });
  await completeCycle(machine, { loadCode: load.code, expectedVersion: 2 });
  return { loadCode: load.code, packageCodes };
}

async function releasedPackages(count: number) {
  const { loadCode, packageCodes } = await completedLoad(count);
  for (const kind of ['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL'] as const) {
    await recordEvidence(machine, { loadCode, kind, outcome: 'PASS', source: 'Catatan mesin' });
  }
  await decideQuality(reviewer, { loadCode, decision: 'RELEASE', expectedVersion: await loadVersion(loadCode) });
  return { loadCode, packageCodes };
}

describe('T02: tray masuk sampai unit menerima', () => {
  it('jejak lengkap dengan nama pelaku, dan retur membuka kasus baru', async () => {
    const { packageCodes } = await releasedPackages(1);
    const packageCode = packageCodes[0]!;
    const handover = await dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes: [packageCode] });
    await acknowledgePackage(unitOk, { handoverCode: handover.code, packageCode, outcome: 'RECEIVED' });
    await recordUsage(unitOk, { handoverCode: handover.code, packageCode });

    const trail = await prisma.auditEvent.findMany({ where: { related: { contains: ` ${packageCode} ` } }, orderBy: { occurredAt: 'asc' } });
    expect(trail.map((event) => event.action)).toEqual([
      'Paket dibuat',
      'Muatan disusun',
      'Siklus dimulai',
      'Siklus selesai',
      'Bukti fisik dicatat',
      'Bukti kimia dicatat',
      'Bukti biologis dicatat',
      'Batch dilepas',
      'Paket dikirim',
      'Paket diterima unit',
      'Paket digunakan',
    ]);
    expect(trail.every((event) => event.actorName.length > 0)).toBe(true);

    const pack = await prisma.package.findFirstOrThrow({ where: { code: packageCode }, include: { tray: true } });
    expect(pack.position).toBe('USED');
    const again = await receiveTray(receiving, { trayCode: pack.tray!.code, originUnitId: await unitId('OK'), actualCount: await expectedOf(pack.tray!.setTemplateId) });
    expect(again.code).toMatch(/^KS-/);
    expect((await prisma.package.findFirstOrThrow({ where: { code: packageCode } })).position).toBe('RETURNED');
  });
});

describe('T03 dan P-05: gerbang pelepasan memakai kebijakan', () => {
  it('menolak pelepasan selama indikator biologis tertunda (BT-0021)', async () => {
    await expectDomainError(
      decideQuality(reviewer, { loadCode: 'BT-0021', decision: 'RELEASE', expectedVersion: await loadVersion('BT-0021') }),
      'CSSD_EVIDENCE_PENDING',
    );
  });

  it('menolak pelepasan bila ada indikator gagal', async () => {
    const { loadCode } = await completedLoad();
    await recordEvidence(machine, { loadCode, kind: 'PHYSICAL', outcome: 'PASS', source: 'Catatan mesin' });
    await recordEvidence(machine, { loadCode, kind: 'CHEMICAL', outcome: 'FAIL', source: 'Pembacaan operator' });
    await recordEvidence(machine, { loadCode, kind: 'BIOLOGICAL', outcome: 'PASS', source: 'Inkubator' });
    await expectDomainError(decideQuality(reviewer, { loadCode, decision: 'RELEASE', expectedVersion: await loadVersion(loadCode) }), 'CSSD_EVIDENCE_FAILED');
  });

  it('indikator yang tidak diwajibkan kebijakan tidak menahan pelepasan', async () => {
    await prisma.monitoringPolicy.update({
      where: { facilityId_method: { facilityId: admin.facilityId, method: 'STEAM' } },
      data: { requireBiological: false, reference: 'SOP uji tanpa BI' },
    });
    try {
      const { loadCode } = await completedLoad();
      const results = await prisma.monitoringResult.findMany({ where: { load: { code: loadCode } } });
      expect(results.find((item) => item.kind === 'BIOLOGICAL')?.outcome).toBe('NOT_REQUIRED');
      for (const kind of ['PHYSICAL', 'CHEMICAL'] as const) await recordEvidence(machine, { loadCode, kind, outcome: 'PASS', source: 'Catatan mesin' });
      await decideQuality(reviewer, { loadCode, decision: 'RELEASE', expectedVersion: await loadVersion(loadCode) });
      expect((await prisma.load.findFirstOrThrow({ where: { code: loadCode } })).policyRef).toBe('SOP uji tanpa BI');
    } finally {
      await prisma.monitoringPolicy.update({
        where: { facilityId_method: { facilityId: admin.facilityId, method: 'STEAM' } },
        data: { requireBiological: true, reference: 'Kebijakan latihan' },
      });
    }
  });

  it('tanpa kebijakan metode, siklus tidak bisa diselesaikan', async () => {
    const policy = await prisma.monitoringPolicy.findUniqueOrThrow({ where: { facilityId_method: { facilityId: admin.facilityId, method: 'STEAM' } } });
    await prisma.monitoringPolicy.delete({ where: { id: policy.id } });
    try {
      const pack = await packageFromNewTray();
      const load = await createLoad(machine, { deviceId: await deviceId(), packageCodes: [pack] });
      await startCycle(machine, { loadCode: load.code, expectedVersion: 1 });
      await expectDomainError(completeCycle(machine, { loadCode: load.code, expectedVersion: 2 }), 'CSSD_POLICY_MISSING');
    } finally {
      const { id: _id, updatedAt: _updated, ...data } = policy;
      await prisma.monitoringPolicy.create({ data });
    }
  });

  it('peran tanpa hak eksplisit tidak bisa melepas, termasuk admin', async () => {
    await expectDomainError(decideQuality(admin, { loadCode: 'BT-0016', decision: 'RELEASE', expectedVersion: 1 }), 'CSSD_FORBIDDEN');
    await expectDomainError(decideQuality(machine, { loadCode: 'BT-0016', decision: 'RELEASE', expectedVersion: 1 }), 'CSSD_FORBIDDEN');
  });

  it('versi usang ditolak sebagai konflik', async () => {
    const stale = (await loadVersion('BT-0016')) - 1;
    await expectDomainError(decideQuality(reviewer, { loadCode: 'BT-0016', decision: 'RELEASE', expectedVersion: stale }), 'CSSD_VERSION_CONFLICT');
  });

  it('hasil gagal setelah pelepasan menahan batch dan paketnya', async () => {
    const { loadCode, packageCodes } = await releasedPackages(1);
    await recordEvidence(reviewer, { loadCode, kind: 'BIOLOGICAL', outcome: 'FAIL', source: 'Pembacaan inkubator ulang' });
    expect((await prisma.package.findFirstOrThrow({ where: { code: packageCodes[0] } })).qualityStatus).toBe('HOLD');
    await expectDomainError(dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes }), 'CSSD_PACKAGE_UNAVAILABLE');
  });
});

describe('T04: aksi bersamaan, satu pemenang', () => {
  it('dua petugas mengirim paket yang sama: hanya satu berhasil', async () => {
    const { packageCodes } = await releasedPackages(1);
    const destination = await unitId('OK');
    const results = await Promise.allSettled([
      dispatchPackages(warehouse, { destinationUnitId: destination, packageCodes }),
      dispatchPackages(warehouse, { destinationUnitId: destination, packageCodes }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('pelepasan dan penahanan bersamaan: hanya satu keputusan efektif', async () => {
    const { loadCode } = await completedLoad();
    for (const kind of ['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL'] as const) await recordEvidence(machine, { loadCode, kind, outcome: 'PASS', source: 'Catatan mesin' });
    const version = await loadVersion(loadCode);
    const results = await Promise.allSettled([
      decideQuality(reviewer, { loadCode, decision: 'RELEASE', expectedVersion: version }),
      decideQuality(reviewer, { loadCode, decision: 'HOLD', reason: 'Kemasan basah', expectedVersion: version }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('paket yang sudah dimuat tidak bisa masuk muatan lain', async () => {
    const pack = await packageFromNewTray();
    await createLoad(machine, { deviceId: await deviceId(), packageCodes: [pack] });
    await expectDomainError(createLoad(machine, { deviceId: await deviceId(), packageCodes: [pack] }), 'CSSD_PACKAGE_UNAVAILABLE');
  });
});

describe('T05 dan P-08: inspeksi per komponen dan proses ulang', () => {
  it('komponen hilang wajib catatan, menggagalkan inspeksi, dan riwayatnya tersimpan', async () => {
    const tray = await newTray('VK');
    const expected = await expectedOf(tray.setTemplateId);
    await expectDomainError(receiveTray(receiving, { trayCode: tray.code, originUnitId: tray.homeUnitId, actualCount: expected - 1 }), 'CSSD_VALIDATION');
    const created = await receiveTray(receiving, { trayCode: tray.code, originUnitId: tray.homeUnitId, actualCount: expected - 1, conditionNote: 'Satu klem tidak ada' });
    await expectDomainError(receiveTray(receiving, { trayCode: tray.code, originUnitId: tray.homeUnitId, actualCount: expected }), 'CSSD_TRAY_BUSY');

    await recordCleaning(receiving, { caseCode: created.code, outcome: 'FAIL', note: 'Sisa darah pada engsel', expectedVersion: 1 });
    await recordCleaning(receiving, { caseCode: created.code, outcome: 'PASS', expectedVersion: 2 });

    const lines = await allGood(created.code);
    lines[0] = { ...lines[0]!, actual: 0, condition: 'MISSING' };
    await expectDomainError(recordInspection(packing, { caseCode: created.code, lines, expectedVersion: 3 }), 'CSSD_VALIDATION');
    lines[0] = { ...lines[0]!, note: 'Gagang pisau tidak ada di tray' };
    const failed = await recordInspection(packing, { caseCode: created.code, lines, expectedVersion: 3 });
    expect(failed.passed).toBe(false);
    expect((await prisma.reprocessingCase.findFirstOrThrow({ where: { code: created.code } })).status).toBe('RECEIVED');

    await recordCleaning(receiving, { caseCode: created.code, outcome: 'PASS', expectedVersion: await caseVersion(created.code) });
    const passed = await recordInspection(packing, { caseCode: created.code, lines: await allGood(created.code), expectedVersion: await caseVersion(created.code) });
    expect(passed.passed).toBe(true);
    const pack = await createPackage(packing, { caseCode: created.code, materialLot: 'LOT-UJI-02', expectedVersion: await caseVersion(created.code) });

    const inspections = await prisma.inspection.findMany({ where: { caseId: created.id }, include: { lines: true }, orderBy: { occurredAt: 'asc' } });
    expect(inspections.map((item) => item.outcome)).toEqual(['FAIL', 'PASS']);
    expect(inspections[0]!.lines.find((line) => line.condition === 'MISSING')?.note).toBe('Gagang pisau tidak ada di tray');

    await recordLabelPrint(packing, pack.code);
    await recordLabelPrint(packing, pack.code);
    expect((await prisma.package.findFirstOrThrow({ where: { code: pack.code } })).printCount).toBe(2);
  });

  it('set tanpa isi komponen tidak bisa diterima', async () => {
    const set = await prisma.setTemplate.create({ data: { facilityId: admin.facilityId, code: 'SET-KOSONG', name: 'Set kosong', description: '', shelfLifeDays: 30 } });
    const tray = await prisma.tray.create({ data: { facilityId: admin.facilityId, code: 'TR-KOSONG', setTemplateId: set.id, homeUnitId: await unitId('OK') } });
    await expectDomainError(receiveTray(receiving, { trayCode: tray.code, originUnitId: tray.homeUnitId, actualCount: 0 }), 'CSSD_POLICY_MISSING');
  });
});

describe('T06: lingkup unit dan peran', () => {
  it('petugas unit OK tidak bisa mengonfirmasi serah terima unit VK', async () => {
    const { packageCodes } = await releasedPackages(1);
    const handover = await dispatchPackages(warehouse, { destinationUnitId: await unitId('VK'), packageCodes });
    await expectDomainError(acknowledgePackage(unitOk, { handoverCode: handover.code, packageCode: packageCodes[0]!, outcome: 'RECEIVED' }), 'CSSD_NOT_FOUND');
    await acknowledgePackage(unitVk, { handoverCode: handover.code, packageCode: packageCodes[0]!, outcome: 'RECEIVED' });
  });

  it('operator penerimaan tidak bisa membuat paket atau mengirim', async () => {
    await expectDomainError(createPackage(receiving, { caseCode: 'KS-0001', materialLot: 'LOT', expectedVersion: 1 }), 'CSSD_FORBIDDEN');
    await expectDomainError(dispatchPackages(receiving, { destinationUnitId: 'x', packageCodes: ['PK-0047'] }), 'CSSD_FORBIDDEN');
  });

  it('mesin tidak layak pakai tidak bisa dipilih untuk muatan', async () => {
    const id = await deviceId('UAP-02');
    await setDeviceStatus(admin, { deviceId: id, status: 'OUT_OF_SERVICE', reason: 'Kalibrasi tertunda' });
    const pack = await packageFromNewTray();
    await expectDomainError(createLoad(machine, { deviceId: id, packageCodes: [pack] }), 'CSSD_DEVICE_UNAVAILABLE');
    await setDeviceStatus(admin, { deviceId: id, status: 'ACTIVE', reason: 'Kalibrasi selesai' });
  });
});

describe('T07: recall setelah pelepasan', () => {
  it('paket di rak diblokir, paket terkirim dan terpakai punya tindak lanjut sendiri', async () => {
    const { loadCode, packageCodes } = await releasedPackages(3);
    const [onShelf, shipped, used] = packageCodes as [string, string, string];
    const handover = await dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes: [shipped, used] });
    await acknowledgePackage(unitOk, { handoverCode: handover.code, packageCode: used, outcome: 'RECEIVED' });
    await recordUsage(unitOk, { handoverCode: handover.code, packageCode: used });

    const recall = await openRecall(supervisor, { loadCode, reason: 'Hasil BI terlambat dari inkubator' });
    await expectDomainError(dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes: [onShelf] }), 'CSSD_PACKAGE_UNAVAILABLE');
    await updateRecallItem(supervisor, { recallCode: recall.code, packageCode: onShelf, status: 'RECOVERED' });
    await expectDomainError(closeRecall(supervisor, { recallCode: recall.code, capa: 'Validasi ulang inkubator' }), 'CSSD_RECALL_OPEN_ITEMS');
    await updateRecallItem(supervisor, { recallCode: recall.code, packageCode: used, status: 'USED', note: 'Eskalasi ke PPI' });
    await updateRecallItem(supervisor, { recallCode: recall.code, packageCode: shipped, status: 'RECOVERED', note: 'Ditarik dari OK 2' });
    await closeRecall(supervisor, { recallCode: recall.code, capa: 'Validasi ulang inkubator dan pelatihan ulang' });
    const after = await prisma.package.findMany({ where: { code: { in: packageCodes } } });
    expect(after.every((item) => item.qualityStatus === 'REJECTED' && !item.blocked)).toBe(true);
  });
});

describe('P-09 dan P-11: kedaluwarsa dan rak', () => {
  it('pelepasan menghitung kedaluwarsa dari masa simpan set', async () => {
    const before = Date.now();
    const { packageCodes } = await releasedPackages(1);
    const pack = await prisma.package.findFirstOrThrow({ where: { code: packageCodes[0] }, include: { setTemplate: true } });
    const days = (pack.expiresAt!.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(pack.setTemplate!.shelfLifeDays - 0.01);
    expect(days).toBeLessThan(pack.setTemplate!.shelfLifeDays + 0.01);
  });

  it('paket kedaluwarsa tidak bisa dikirim dan bisa ditarik untuk proses ulang', async () => {
    const { packageCodes } = await releasedPackages(1);
    await prisma.package.update({ where: { facilityId_code: { facilityId: admin.facilityId, code: packageCodes[0]! } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectDomainError(dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes }), 'CSSD_PACKAGE_UNAVAILABLE');
    expect(await pullExpired(warehouse)).toBeGreaterThanOrEqual(1);
    const pulled = await prisma.package.findFirstOrThrow({ where: { code: packageCodes[0] } });
    expect([pulled.position, pulled.qualityStatus]).toEqual(['RETURNED', 'REJECTED']);
  });

  it('paket tersedia bisa dipindah rak; paket lain ditolak', async () => {
    const { packageCodes } = await releasedPackages(1);
    const rack = await prisma.location.findFirstOrThrow({ where: { facilityId: admin.facilityId, code: 'RAK-B' } });
    await movePackages(warehouse, { locationId: rack.id, packageCodes });
    expect((await prisma.package.findFirstOrThrow({ where: { code: packageCodes[0] } })).locationId).toBe(rack.id);
    await expectDomainError(movePackages(warehouse, { locationId: rack.id, packageCodes: ['PK-0047'] }), 'CSSD_PACKAGE_UNAVAILABLE');
  });
});

describe('P-06: permintaan unit', () => {
  it('unit meminta, distribusi memenuhi sebagian lalu penuh', async () => {
    const set = await prisma.setTemplate.findFirstOrThrow({ where: { facilityId: admin.facilityId, code: 'SET-BEDAH-MAYOR' } });
    const request = await createRequest(unitOk, { setTemplateId: set.id, quantity: 2, priority: 'URGENT', neededBy: new Date(Date.now() + 3_600_000) });
    const first = await releasedPackages(1);
    await dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes: first.packageCodes, requestCode: request.code });
    expect((await prisma.unitRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('PARTIAL');
    const second = await releasedPackages(1);
    await dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes: second.packageCodes, requestCode: request.code });
    const done = await prisma.unitRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect([done.status, done.fulfilled]).toEqual(['FULFILLED', 2]);
    const extra = await releasedPackages(1);
    await expectDomainError(dispatchPackages(warehouse, { destinationUnitId: await unitId('OK'), packageCodes: extra.packageCodes, requestCode: request.code }), 'CSSD_INVALID_STATE');
  });

  it('permintaan tidak bisa dipenuhi ke unit lain dan bisa dibatalkan pemiliknya', async () => {
    const set = await prisma.setTemplate.findFirstOrThrow({ where: { facilityId: admin.facilityId, code: 'SET-BEDAH-MAYOR' } });
    const request = await createRequest(unitOk, { setTemplateId: set.id, quantity: 1, priority: 'ROUTINE', neededBy: new Date(Date.now() + 3_600_000) });
    const { packageCodes } = await releasedPackages(1);
    await expectDomainError(dispatchPackages(warehouse, { destinationUnitId: await unitId('VK'), packageCodes, requestCode: request.code }), 'CSSD_VALIDATION');
    await expectDomainError(cancelRequest(unitVk, { requestCode: request.code, reason: 'Bukan milik VK', expectedVersion: 1 }), 'CSSD_NOT_FOUND');
    await cancelRequest(unitOk, { requestCode: request.code, reason: 'Operasi ditunda', expectedVersion: 1 });
    expect((await prisma.unitRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('CANCELLED');
  });
});

describe('P-18: pencatatan mundur', () => {
  it('waktu lampau wajib alasan, maksimal 72 jam, tidak boleh di masa depan', () => {
    const hourAgo = new Date(Date.now() - 3_600_000);
    expect(() => resolveOccurredAt(hourAgo, '')).toThrow(DomainError);
    expect(resolveOccurredAt(hourAgo, 'Jaringan putus').reason).toBe('Jaringan putus');
    expect(() => resolveOccurredAt(new Date(Date.now() - 73 * 3_600_000), 'Lama')).toThrow(DomainError);
    expect(() => resolveOccurredAt(new Date(Date.now() + 3_600_000), 'Masa depan')).toThrow(DomainError);
    expect(resolveOccurredAt(null, null).reason).toBeNull();
  });

  it('penerimaan mundur menyimpan waktu kejadian dan alasannya', async () => {
    const tray = await newTray();
    const occurredAt = new Date(Date.now() - 2 * 3_600_000);
    const created = await receiveTray(receiving, {
      trayCode: tray.code,
      originUnitId: tray.homeUnitId,
      actualCount: await expectedOf(tray.setTemplateId),
      occurredAt,
      backdateReason: 'Server mati 06.00 sampai 08.00',
    });
    expect(created.receivedAt.getTime()).toBe(occurredAt.getTime());
    expect(created.recordedAt.getTime()).toBeGreaterThan(occurredAt.getTime());
    expect(created.backdateReason).toBe('Server mati 06.00 sampai 08.00');
  });
});
