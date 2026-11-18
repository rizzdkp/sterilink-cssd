// Aturan alur kerja CSSD. Setiap fungsi di sini:
//  1. memeriksa kapabilitas pelaku,
//  2. berjalan dalam satu transaksi,
//  3. memeriksa ulang status di dalam transaksi (bukan percaya pada layar),
//  4. menulis jejak audit bersama perubahannya.
import type { Prisma } from '@/generated/prisma/client';
import type { EvidenceKind, LineOutcome, RecallItemStatus, StepOutcome } from '@/generated/prisma/enums';
import { prisma } from './db';
import { can, type Actor, type Capability } from './identity';
import { projectQueueStatus } from './queue/status';

type Tx = Prisma.TransactionClient;

export type DomainCode =
  | 'CSSD_FORBIDDEN'
  | 'CSSD_NOT_FOUND'
  | 'CSSD_VALIDATION'
  | 'CSSD_VERSION_CONFLICT'
  | 'CSSD_INVALID_STATE'
  | 'CSSD_TRAY_BUSY'
  | 'CSSD_DEVICE_UNAVAILABLE'
  | 'CSSD_EVIDENCE_PENDING'
  | 'CSSD_EVIDENCE_FAILED'
  | 'CSSD_PACKAGE_HELD'
  | 'CSSD_PACKAGE_UNAVAILABLE'
  | 'CSSD_SEPARATION_OF_DUTIES'
  | 'CSSD_RECALL_OPEN_ITEMS'
  | 'CSSD_POLICY_MISSING';

const HTTP_STATUS: Record<DomainCode, number> = {
  CSSD_FORBIDDEN: 403,
  CSSD_NOT_FOUND: 404,
  CSSD_VALIDATION: 400,
  CSSD_VERSION_CONFLICT: 409,
  CSSD_INVALID_STATE: 409,
  CSSD_TRAY_BUSY: 409,
  CSSD_DEVICE_UNAVAILABLE: 422,
  CSSD_EVIDENCE_PENDING: 422,
  CSSD_EVIDENCE_FAILED: 422,
  CSSD_PACKAGE_HELD: 422,
  CSSD_PACKAGE_UNAVAILABLE: 409,
  CSSD_SEPARATION_OF_DUTIES: 403,
  CSSD_RECALL_OPEN_ITEMS: 422,
  CSSD_POLICY_MISSING: 422,
};

/** Penolakan aturan bisnis. Pesannya aman ditampilkan ke pengguna. */
export class DomainError extends Error {
  readonly status: number;
  constructor(
    readonly code: DomainCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
    this.status = HTTP_STATUS[code];
  }
}

const EVIDENCE_KINDS: EvidenceKind[] = ['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL'];
const EVIDENCE_NAME: Record<EvidenceKind, string> = { PHYSICAL: 'fisik', CHEMICAL: 'kimia', BIOLOGICAL: 'biologis' };

export function requireCapability(actor: Actor, capability: Capability) {
  if (!can(actor, capability)) {
    throw new DomainError('CSSD_FORBIDDEN', `Peran ${actor.roleLabel} tidak memiliki izin untuk tindakan ini.`);
  }
}

function requireText(value: string | undefined | null, message: string): string {
  const text = (value ?? '').trim();
  if (text.length < 3) throw new DomainError('CSSD_VALIDATION', message);
  return text.slice(0, 500);
}

async function nextCode(tx: Tx, facilityId: string, kind: string): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { facilityId_kind: { facilityId, kind } },
    create: { facilityId, kind, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${kind}-${String(counter.value).padStart(4, '0')}`;
}

export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  entityType: string,
  entityCode: string,
  related: (string | null | undefined)[],
  detail?: string,
) {
  const codes = [...new Set([entityCode, ...related.filter((code): code is string => Boolean(code))])];
  await tx.auditEvent.create({
    data: {
      facilityId: actor.facilityId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.roleLabel,
      action,
      entityType,
      entityCode,
      related: ` ${codes.join(' ')} `,
      detail: detail?.slice(0, 500),
    },
  });
}

const CONFLICT_MESSAGE = 'Data sudah diubah pengguna lain. Muat ulang halaman untuk melihat keadaan terbaru.';

// Pencatatan mundur saat downtime (PRD-MASTER P-18): paling jauh 72 jam, wajib alasan.
const MAX_BACKDATE_MS = 72 * 60 * 60 * 1000;

/** Waktu kejadian: sekarang, atau waktu lampau yang sah beserta alasannya. */
export function resolveOccurredAt(occurredAt: Date | null | undefined, reason: string | undefined | null) {
  const now = new Date();
  if (!occurredAt) return { at: now, reason: null as string | null };
  if (Number.isNaN(occurredAt.getTime())) throw new DomainError('CSSD_VALIDATION', 'Waktu kejadian tidak valid.');
  if (occurredAt.getTime() > now.getTime() + 60_000) throw new DomainError('CSSD_VALIDATION', 'Waktu kejadian tidak boleh di masa depan.');
  if (now.getTime() - occurredAt.getTime() > MAX_BACKDATE_MS) {
    throw new DomainError(
      'CSSD_VALIDATION',
      'Pencatatan mundur paling jauh 72 jam. Untuk yang lebih lama, catat lewat prosedur koreksi supervisor.',
    );
  }
  // Selisih di bawah 5 menit dianggap waktu sekarang, tanpa alasan.
  if (now.getTime() - occurredAt.getTime() < 5 * 60_000) return { at: occurredAt, reason: null };
  const text = (reason ?? '').trim();
  if (text.length < 3)
    throw new DomainError(
      'CSSD_VALIDATION',
      'Pencatatan dengan waktu lampau wajib disertai alasan, misalnya "sistem mati 08.00 sampai 10.00".',
    );
  return { at: occurredAt, reason: text.slice(0, 300) };
}

export function expectedComponents(components: { quantity: number }[]) {
  return components.reduce((sum, item) => sum + item.quantity, 0);
}

// ---------- Penerimaan sampai paket ----------

export async function receiveTray(
  actor: Actor,
  input: {
    trayCode: string;
    originUnitId: string;
    actualCount: number;
    conditionNote?: string;
    occurredAt?: Date | null;
    backdateReason?: string;
  },
) {
  requireCapability(actor, 'case:receive');
  const when = resolveOccurredAt(input.occurredAt, input.backdateReason);
  return prisma.$transaction(async (tx) => {
    const tray = await tx.tray.findUnique({
      where: { facilityId_code: { facilityId: actor.facilityId, code: input.trayCode } },
      include: { setTemplate: { include: { components: true } } },
    });
    // Tray fasilitas lain dijawab sama dengan tray yang tidak ada.
    if (!tray || !tray.active) throw new DomainError('CSSD_NOT_FOUND', `Tray ${input.trayCode} tidak dikenal di fasilitas ini.`);

    const unit = await tx.unit.findFirst({ where: { id: input.originUnitId, facilityId: actor.facilityId, active: true } });
    if (!unit) throw new DomainError('CSSD_VALIDATION', 'Pilih unit asal yang aktif.');
    if (tray.setTemplate.components.length === 0) {
      throw new DomainError(
        'CSSD_POLICY_MISSING',
        `Isi set ${tray.setTemplate.name} belum diatur. Minta admin mengisi daftar komponennya.`,
      );
    }
    if (!Number.isInteger(input.actualCount) || input.actualCount < 0 || input.actualCount > 999) {
      throw new DomainError('CSSD_VALIDATION', 'Jumlah aktual harus angka antara 0 dan 999.');
    }

    // Hanya satu proses aktif per tray fisik.
    const activeCase = await tx.reprocessingCase.findFirst({ where: { trayId: tray.id, status: { not: 'PACKAGED' } } });
    if (activeCase) {
      throw new DomainError('CSSD_TRAY_BUSY', `Tray ${tray.code} masih diproses pada kasus ${activeCase.code}.`);
    }
    // Paket steril dari tray ini yang masih di CSSD, di stok atau dalam pengiriman
    // berarti tray belum mungkin kembali kotor.
    const livePackage = await tx.package.findFirst({
      where: { trayId: tray.id, qualityStatus: { not: 'REJECTED' }, position: { in: ['CSSD', 'AVAILABLE', 'DISPATCHED'] } },
    });
    if (livePackage) {
      throw new DomainError('CSSD_TRAY_BUSY', `Tray ${tray.code} tercatat sebagai paket ${livePackage.code} yang belum diterima unit.`);
    }

    const expected = expectedComponents(tray.setTemplate.components);
    const note = input.conditionNote?.trim() || null;
    if (input.actualCount !== expected && !note) {
      throw new DomainError('CSSD_VALIDATION', `Jumlah aktual ${input.actualCount} berbeda dari harapan ${expected}. Isi catatan selisih.`);
    }

    // Paket lama yang sudah diterima atau dipakai unit ditandai kembali.
    const returned = await tx.package.findMany({ where: { trayId: tray.id, position: { in: ['RECEIVED', 'USED'] } } });
    await tx.package.updateMany({
      where: { id: { in: returned.map((item) => item.id) } },
      data: { position: 'RETURNED', version: { increment: 1 } },
    });

    const code = await nextCode(tx, actor.facilityId, 'KS');
    const created = await tx.reprocessingCase.create({
      data: {
        facilityId: actor.facilityId,
        code,
        trayId: tray.id,
        originUnitId: unit.id,
        expectedCount: expected,
        actualCount: input.actualCount,
        conditionNote: note,
        receivedBy: actor.id,
        receivedAt: when.at,
        backdateReason: when.reason,
      },
    });
    await audit(
      tx,
      actor,
      'Tray diterima',
      'CASE',
      code,
      [tray.code, ...returned.map((item) => item.code)],
      `Dari ${unit.code}. Harapan ${expected}, aktual ${input.actualCount}.${note ? ` ${note}` : ''}${when.reason ? ` Dicatat mundur: ${when.reason}.` : ''}`,
    );
    return created;
  });
}

async function loadCase(tx: Tx, actor: Actor, code: string, expectedVersion: number) {
  const found = await tx.reprocessingCase.findUnique({
    where: { facilityId_code: { facilityId: actor.facilityId, code } },
    include: { tray: { include: { setTemplate: { include: { components: { orderBy: { sortOrder: 'asc' } } } } } } },
  });
  if (!found) throw new DomainError('CSSD_NOT_FOUND', `Kasus ${code} tidak ditemukan.`);
  if (found.version !== expectedVersion) throw new DomainError('CSSD_VERSION_CONFLICT', CONFLICT_MESSAGE);
  return found;
}

export async function recordCleaning(
  actor: Actor,
  input: { caseCode: string; outcome: StepOutcome; note?: string; expectedVersion: number },
) {
  requireCapability(actor, 'case:clean');
  return prisma.$transaction(async (tx) => {
    const found = await loadCase(tx, actor, input.caseCode, input.expectedVersion);
    if (found.status !== 'RECEIVED') throw new DomainError('CSSD_INVALID_STATE', 'Kasus ini tidak sedang menunggu dekontaminasi.');
    const note = input.outcome === 'FAIL' ? requireText(input.note, 'Hasil gagal wajib disertai alasan.') : input.note?.trim() || null;
    const attempt = (await tx.cleaningRun.count({ where: { caseId: found.id } })) + 1;
    await tx.cleaningRun.create({ data: { caseId: found.id, attempt, outcome: input.outcome, note, actorId: actor.id } });
    await tx.reprocessingCase.update({
      where: { id: found.id },
      // Gagal: kasus tetap menunggu dekontaminasi, percobaan berikutnya tertaut.
      data: { status: input.outcome === 'PASS' ? 'INSPECTION' : 'RECEIVED', version: { increment: 1 } },
    });
    await audit(
      tx,
      actor,
      input.outcome === 'PASS' ? 'Dekontaminasi lulus' : 'Dekontaminasi gagal',
      'CASE',
      found.code,
      [found.tray.code],
      `Percobaan ${attempt}.${note ? ` ${note}` : ''}`,
    );
  });
}

export interface InspectionLineInput {
  componentId: string;
  actual: number;
  condition: 'OK' | 'DAMAGED' | 'MISSING';
  note?: string;
}

const CONDITION_NAME = { OK: 'baik', DAMAGED: 'rusak', MISSING: 'hilang' } as const;

/**
 * Inspeksi satu baris per komponen set (PRD P-08). Lulus hanya bila setiap
 * komponen lengkap dan kondisinya baik; selain itu tray kembali ke proses ulang.
 */
export async function recordInspection(
  actor: Actor,
  input: { caseCode: string; lines: InspectionLineInput[]; note?: string; expectedVersion: number },
) {
  requireCapability(actor, 'case:inspect');
  return prisma.$transaction(async (tx) => {
    const found = await loadCase(tx, actor, input.caseCode, input.expectedVersion);
    if (found.status !== 'INSPECTION') throw new DomainError('CSSD_INVALID_STATE', 'Kasus ini tidak sedang menunggu inspeksi.');
    const components = found.tray.setTemplate.components;
    if (components.length === 0) throw new DomainError('CSSD_POLICY_MISSING', 'Isi set belum diatur admin.');

    const lines = components.map((component) => {
      const line = input.lines.find((item) => item.componentId === component.id);
      if (!line) throw new DomainError('CSSD_VALIDATION', `Hasil komponen ${component.name} belum diisi.`);
      if (!Number.isInteger(line.actual) || line.actual < 0 || line.actual > 999) {
        throw new DomainError('CSSD_VALIDATION', `Jumlah aktual ${component.name} harus angka 0 sampai 999.`);
      }
      if (!(line.condition in CONDITION_NAME)) throw new DomainError('CSSD_VALIDATION', 'Kondisi komponen tidak valid.');
      const problem = line.condition !== 'OK' || line.actual !== component.quantity;
      const note = line.note?.trim() || null;
      if (problem && (!note || note.length < 3)) {
        throw new DomainError(
          'CSSD_VALIDATION',
          `${component.name}: ${line.actual} dari ${component.quantity}, kondisi ${CONDITION_NAME[line.condition]}. Isi catatan untuk komponen ini.`,
        );
      }
      return { component, line, problem, note };
    });

    const passed = lines.every((item) => !item.problem);
    const actualCount = lines.reduce((sum, item) => sum + item.line.actual, 0);
    const note = input.note?.trim() || null;
    await tx.inspection.create({
      data: {
        caseId: found.id,
        outcome: passed ? 'PASS' : 'FAIL',
        actualCount,
        note,
        actorId: actor.id,
        lines: {
          create: lines.map((item) => ({
            componentId: item.component.id,
            name: item.component.name,
            expected: item.component.quantity,
            actual: item.line.actual,
            condition: item.line.condition,
            note: item.note,
          })),
        },
      },
    });
    await tx.reprocessingCase.update({
      where: { id: found.id },
      // Gagal inspeksi mengembalikan tray ke dekontaminasi (proses ulang).
      data: { status: passed ? 'PACKING' : 'RECEIVED', actualCount, version: { increment: 1 } },
    });
    const problems = lines.filter((item) => item.problem).map((item) => `${item.component.name}: ${item.note}`);
    await audit(
      tx,
      actor,
      passed ? 'Inspeksi lulus' : 'Inspeksi gagal, proses ulang',
      'CASE',
      found.code,
      [found.tray.code],
      `Komponen ${actualCount} dari ${found.expectedCount}.${problems.length ? ` ${problems.join('; ')}.` : ''}${note ? ` ${note}` : ''}`,
    );
    return { passed };
  });
}

export async function createPackage(actor: Actor, input: { caseCode: string; materialLot: string; expectedVersion: number }) {
  requireCapability(actor, 'package:create');
  return prisma.$transaction(async (tx) => {
    const found = await loadCase(tx, actor, input.caseCode, input.expectedVersion);
    if (found.status !== 'PACKING') throw new DomainError('CSSD_INVALID_STATE', 'Kasus ini belum lulus inspeksi atau sudah dikemas.');
    const lot = requireText(input.materialLot, 'Isi nomor lot kemasan (minimal 3 karakter).').slice(0, 40);
    const code = await nextCode(tx, actor.facilityId, 'PK');
    const created = await tx.package.create({
      data: {
        facilityId: actor.facilityId,
        code,
        caseId: found.id,
        trayId: found.trayId,
        setTemplateId: found.tray.setTemplateId,
        originUnitId: found.originUnitId,
        materialLot: lot,
      },
    });
    await tx.reprocessingCase.update({ where: { id: found.id }, data: { status: 'PACKAGED', version: { increment: 1 } } });
    await audit(tx, actor, 'Paket dibuat', 'PACKAGE', code, [found.code, found.tray.code], `Lot kemasan ${lot}.`);
    return created;
  });
}

/** Catat cetak label. Cetak ulang memakai kode paket yang sama dan tetap tercatat. */
export async function recordLabelPrint(actor: Actor, packageCode: string) {
  requireCapability(actor, 'package:create');
  return prisma.$transaction(async (tx) => {
    const found = await tx.package.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code: packageCode } } });
    if (!found) throw new DomainError('CSSD_NOT_FOUND', `Paket ${packageCode} tidak ditemukan.`);
    await tx.package.update({ where: { id: found.id }, data: { printCount: { increment: 1 } } });
    await audit(
      tx,
      actor,
      found.printCount === 0 ? 'Label dicetak' : 'Label dicetak ulang',
      'PACKAGE',
      found.code,
      [],
      `Cetakan ke-${found.printCount + 1}.`,
    );
  });
}

// ---------- Muatan, siklus, bukti ----------

async function loadLoad(tx: Tx, actor: Actor, code: string, expectedVersion?: number) {
  const found = await tx.load.findUnique({
    where: { facilityId_code: { facilityId: actor.facilityId, code } },
    include: { monitoringResults: true, packages: true, device: true },
  });
  if (!found) throw new DomainError('CSSD_NOT_FOUND', `Batch ${code} tidak ditemukan.`);
  if (expectedVersion !== undefined && found.version !== expectedVersion) {
    throw new DomainError('CSSD_VERSION_CONFLICT', CONFLICT_MESSAGE);
  }
  return found;
}

type LoadedLoad = Awaited<ReturnType<typeof loadLoad>>;

/** Tulis status baru muatan dan hitung ulang proyeksi antreannya. */
async function saveLoad(tx: Tx, load: LoadedLoad, data: Prisma.LoadUncheckedUpdateInput) {
  const processStatus = (data.processStatus as LoadedLoad['processStatus'] | undefined) ?? load.processStatus;
  const qualityStatus = (data.qualityStatus as LoadedLoad['qualityStatus'] | undefined) ?? load.qualityStatus;
  const evidence = await tx.monitoringResult.findMany({ where: { loadId: load.id } });
  return tx.load.update({
    where: { id: load.id },
    data: { ...data, queueStatus: projectQueueStatus({ processStatus, qualityStatus, evidence }), version: { increment: 1 } },
  });
}

export async function createLoad(actor: Actor, input: { deviceId: string; packageCodes: string[] }) {
  requireCapability(actor, 'load:manage');
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.findFirst({ where: { id: input.deviceId, facilityId: actor.facilityId } });
    if (!device) throw new DomainError('CSSD_VALIDATION', 'Pilih mesin sterilisasi.');
    if (device.status !== 'ACTIVE') {
      throw new DomainError('CSSD_DEVICE_UNAVAILABLE', `Mesin ${device.code} sedang tidak layak pakai dan tidak bisa dipilih.`);
    }
    const codes = [...new Set(input.packageCodes)];
    if (codes.length === 0) throw new DomainError('CSSD_VALIDATION', 'Pilih minimal satu paket untuk dimuat.');
    const packages = await tx.package.findMany({ where: { facilityId: actor.facilityId, code: { in: codes } }, orderBy: { code: 'asc' } });
    if (packages.length !== codes.length) throw new DomainError('CSSD_NOT_FOUND', 'Sebagian paket tidak ditemukan.');

    const first = packages[0]!;
    if (!first.setTemplateId || !first.originUnitId) throw new DomainError('CSSD_INVALID_STATE', `Paket ${first.code} belum lengkap.`);
    const code = await nextCode(tx, actor.facilityId, 'BT');
    const created = await tx.load.create({
      data: {
        facilityId: actor.facilityId,
        code,
        setTemplateId: first.setTemplateId,
        originUnitId: first.originUnitId,
        setCount: packages.length,
        method: device.method,
        deviceId: device.id,
        processStatus: 'LOADED',
        queueStatus: 'WAITING_PROCESS',
      },
    });
    // Syarat diperiksa di dalam UPDATE: paket yang baru saja masuk muatan lain tidak ikut.
    const claimed = await tx.package.updateMany({
      where: { id: { in: packages.map((item) => item.id) }, loadId: null, position: 'CSSD', qualityStatus: 'PENDING', blocked: false },
      data: { loadId: created.id, version: { increment: 1 } },
    });
    if (claimed.count !== packages.length) {
      throw new DomainError(
        'CSSD_PACKAGE_UNAVAILABLE',
        'Sebagian paket sudah dimuat ke batch lain atau tidak lagi siap. Muat ulang daftar paket.',
      );
    }
    await audit(
      tx,
      actor,
      'Muatan disusun',
      'LOAD',
      code,
      packages.map((item) => item.code),
      `Mesin ${device.code}, ${packages.length} paket.`,
    );
    return created;
  });
}

export async function cancelLoad(actor: Actor, input: { loadCode: string; expectedVersion: number }) {
  requireCapability(actor, 'load:manage');
  return prisma.$transaction(async (tx) => {
    const load = await loadLoad(tx, actor, input.loadCode, input.expectedVersion);
    if (load.processStatus !== 'LOADED')
      throw new DomainError('CSSD_INVALID_STATE', 'Hanya muatan yang belum memulai siklus yang bisa dibatalkan.');
    await tx.package.updateMany({ where: { loadId: load.id }, data: { loadId: null, version: { increment: 1 } } });
    await saveLoad(tx, load, { processStatus: 'CANCELLED', setCount: 0 });
    await audit(
      tx,
      actor,
      'Muatan dibatalkan',
      'LOAD',
      load.code,
      load.packages.map((item) => item.code),
      'Paket kembali ke daftar siap muat.',
    );
  });
}

export async function startCycle(actor: Actor, input: { loadCode: string; expectedVersion: number }) {
  requireCapability(actor, 'load:manage');
  return prisma.$transaction(async (tx) => {
    const load = await loadLoad(tx, actor, input.loadCode, input.expectedVersion);
    if (load.processStatus !== 'LOADED')
      throw new DomainError('CSSD_INVALID_STATE', 'Siklus hanya bisa dimulai dari muatan yang sudah disusun.');
    if (load.device && load.device.status !== 'ACTIVE') {
      throw new DomainError('CSSD_DEVICE_UNAVAILABLE', `Mesin ${load.device.code} sedang tidak layak pakai. Hubungi supervisor.`);
    }
    const now = new Date();
    await tx.stageEvent.upsert({
      where: { loadId_stage: { loadId: load.id, stage: 'STERILIZATION' } },
      create: { loadId: load.id, stage: 'STERILIZATION', occurredAt: now },
      update: { occurredAt: now },
    });
    await saveLoad(tx, load, { processStatus: 'RUNNING', startedAt: now, startedBy: actor.id });
    await audit(
      tx,
      actor,
      'Siklus dimulai',
      'LOAD',
      load.code,
      load.packages.map((item) => item.code),
    );
  });
}

const METHOD_NAME: Record<string, string> = { STEAM: 'uap', LOW_TEMP: 'suhu rendah' };

/** Indikator wajib menurut kebijakan metode yang diatur admin (PRD P-05). */
async function requiredEvidence(tx: Tx, facilityId: string, method: 'STEAM' | 'LOW_TEMP') {
  const policy = await tx.monitoringPolicy.findUnique({ where: { facilityId_method: { facilityId, method } } });
  if (!policy) {
    throw new DomainError(
      'CSSD_POLICY_MISSING',
      `Kebijakan bukti untuk metode ${METHOD_NAME[method]} belum diatur. Minta admin mengisinya di Master, Kebijakan.`,
    );
  }
  const kinds: EvidenceKind[] = [];
  if (policy.requirePhysical) kinds.push('PHYSICAL');
  if (policy.requireChemical) kinds.push('CHEMICAL');
  if (policy.requireBiological) kinds.push('BIOLOGICAL');
  return { policy, kinds };
}

export async function completeCycle(actor: Actor, input: { loadCode: string; expectedVersion: number }) {
  requireCapability(actor, 'load:manage');
  return prisma.$transaction(async (tx) => {
    const load = await loadLoad(tx, actor, input.loadCode, input.expectedVersion);
    if (load.processStatus !== 'RUNNING') throw new DomainError('CSSD_INVALID_STATE', 'Batch ini tidak sedang menjalankan siklus.');
    const { policy, kinds } = await requiredEvidence(tx, actor.facilityId, load.method);
    // Yang wajib dibuat "menunggu"; yang tidak wajib dicatat eksplisit "tidak diwajibkan",
    // sehingga bukti yang belum ada tidak tertukar dengan bukti yang memang tidak diminta.
    for (const kind of EVIDENCE_KINDS) {
      const required = kinds.includes(kind);
      await tx.monitoringResult.upsert({
        where: { loadId_kind: { loadId: load.id, kind } },
        create: { loadId: load.id, kind, outcome: required ? 'PENDING' : 'NOT_REQUIRED', requiredBy: required ? policy.reference : null },
        update: {},
      });
    }
    await saveLoad(tx, load, { processStatus: 'CYCLE_COMPLETED', completedAt: new Date(), policyRef: policy.reference });
    await audit(
      tx,
      actor,
      'Siklus selesai',
      'LOAD',
      load.code,
      load.packages.map((item) => item.code),
      `Kebijakan ${policy.reference}: wajib ${kinds.map((kind) => EVIDENCE_NAME[kind]).join(', ') || 'tidak ada indikator'}.`,
    );
  });
}

export async function recordEvidence(
  actor: Actor,
  input: {
    loadCode: string;
    kind: EvidenceKind;
    outcome: 'PASS' | 'FAIL';
    source: string;
    occurredAt?: Date | null;
    backdateReason?: string;
  },
) {
  requireCapability(actor, 'evidence:record');
  const when = resolveOccurredAt(input.occurredAt, input.backdateReason);
  return prisma.$transaction(async (tx) => {
    const load = await loadLoad(tx, actor, input.loadCode);
    if (load.processStatus !== 'CYCLE_COMPLETED') throw new DomainError('CSSD_INVALID_STATE', 'Bukti dicatat setelah siklus selesai.');
    if (load.qualityStatus === 'REJECTED')
      throw new DomainError('CSSD_INVALID_STATE', 'Batch sudah ditolak. Bukti tidak bisa diubah lagi.');
    if (load.completedAt && when.at < load.completedAt && !when.reason) {
      throw new DomainError('CSSD_VALIDATION', 'Waktu hasil lebih awal dari selesainya siklus.');
    }
    const source = requireText(input.source, 'Isi sumber hasil, misalnya "Catatan mesin" atau "Pembacaan operator".').slice(0, 80);
    const previous = load.monitoringResults.find((item) => item.kind === input.kind);
    await tx.monitoringResult.upsert({
      where: { loadId_kind: { loadId: load.id, kind: input.kind } },
      create: {
        loadId: load.id,
        kind: input.kind,
        outcome: input.outcome,
        source,
        requiredBy: load.policyRef,
        observedAt: when.at,
        recordedBy: actor.id,
        backdateReason: when.reason,
      },
      update: {
        outcome: input.outcome,
        source,
        observedAt: when.at,
        recordedBy: actor.id,
        recordedAt: new Date(),
        backdateReason: when.reason,
      },
    });

    // Hasil gagal yang datang setelah pelepasan menahan batch dan seluruh paketnya.
    const lateFailure = input.outcome === 'FAIL' && load.qualityStatus === 'RELEASED';
    if (lateFailure) {
      await tx.package.updateMany({ where: { loadId: load.id }, data: { qualityStatus: 'HOLD', version: { increment: 1 } } });
      await tx.qualityDecision.create({
        data: {
          loadId: load.id,
          decision: 'HOLD',
          reason: `Indikator ${EVIDENCE_NAME[input.kind]} tidak memenuhi setelah pelepasan.`,
          actorId: actor.id,
          actorRole: actor.roleLabel,
        },
      });
    }
    await saveLoad(tx, load, lateFailure ? { qualityStatus: 'HOLD' } : {});
    // Nilai lama ikut dicatat supaya koreksi bisa ditelusuri.
    await audit(
      tx,
      actor,
      `Bukti ${EVIDENCE_NAME[input.kind]} dicatat`,
      'LOAD',
      load.code,
      load.packages.map((item) => item.code),
      `${previous?.outcome ?? 'PENDING'} menjadi ${input.outcome}. Sumber: ${source}.${when.reason ? ` Dicatat mundur: ${when.reason}.` : ''}${lateFailure ? ' Batch ditahan otomatis.' : ''}`,
    );
  });
}

// ---------- Keputusan mutu ----------

export type Decision = 'RELEASE' | 'HOLD' | 'REJECT' | 'RESUME';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function decideQuality(
  actor: Actor,
  input: { loadCode: string; decision: Decision; reason?: string; expectedVersion: number },
) {
  requireCapability(actor, 'quality:decide');
  return prisma.$transaction(async (tx) => {
    const load = await loadLoad(tx, actor, input.loadCode, input.expectedVersion);
    if (load.processStatus !== 'CYCLE_COMPLETED')
      throw new DomainError('CSSD_INVALID_STATE', 'Keputusan mutu hanya untuk batch yang siklusnya selesai.');
    // Pemisahan tugas: yang menjalankan siklus tidak memutuskan mutunya sendiri.
    if (load.startedBy && load.startedBy === actor.id) {
      throw new DomainError(
        'CSSD_SEPARATION_OF_DUTIES',
        'Anda menjalankan siklus batch ini, sehingga keputusan mutu harus oleh petugas lain.',
      );
    }
    const openRecall = await tx.recall.findFirst({ where: { loadId: load.id, status: 'OPEN' } });
    const packageCodes = load.packages.map((item) => item.code);
    let reason: string | null = input.reason?.trim() || null;
    const now = new Date();

    if (input.decision === 'RELEASE') {
      if (load.qualityStatus !== 'PENDING') throw new DomainError('CSSD_INVALID_STATE', 'Batch ini tidak sedang menunggu keputusan.');
      if (openRecall || load.packages.some((item) => item.blocked)) {
        throw new DomainError('CSSD_PACKAGE_HELD', 'Ada recall aktif pada batch ini. Paket tidak bisa dilepas.');
      }
      // Gerbang pelepasan dihitung dari bukti di database saat ini, bukan dari status antrean.
      const failed = load.monitoringResults.filter((item) => item.outcome === 'FAIL');
      if (failed.length > 0) {
        throw new DomainError(
          'CSSD_EVIDENCE_FAILED',
          `Indikator ${failed.map((item) => EVIDENCE_NAME[item.kind]).join(', ')} tidak memenuhi. Batch tidak bisa dilepas.`,
        );
      }
      const missing = EVIDENCE_KINDS.filter((kind) => {
        const result = load.monitoringResults.find((item) => item.kind === kind);
        return !result || result.outcome === 'PENDING';
      });
      if (missing.length > 0) {
        throw new DomainError(
          'CSSD_EVIDENCE_PENDING',
          `Hasil indikator ${missing.map((kind) => EVIDENCE_NAME[kind]).join(', ')} belum tercatat. Batch tidak bisa dilepas.`,
        );
      }
      // Kedaluwarsa per paket dari masa simpan set masing-masing (PRD P-09).
      const packages = await tx.package.findMany({ where: { loadId: load.id }, include: { setTemplate: true } });
      for (const item of packages) {
        const days = item.setTemplate?.shelfLifeDays;
        if (!days) throw new DomainError('CSSD_POLICY_MISSING', `Masa simpan set paket ${item.code} belum diatur.`);
        await tx.package.update({
          where: { id: item.id },
          data: {
            qualityStatus: 'RELEASED',
            position: 'AVAILABLE',
            expiresAt: new Date(now.getTime() + days * DAY_MS),
            version: { increment: 1 },
          },
        });
      }
      await tx.stageEvent.upsert({
        where: { loadId_stage: { loadId: load.id, stage: 'VERIFICATION' } },
        create: { loadId: load.id, stage: 'VERIFICATION', occurredAt: now },
        update: { occurredAt: now },
      });
      await saveLoad(tx, load, { qualityStatus: 'RELEASED', releasedAt: now });
    } else if (input.decision === 'HOLD') {
      if (load.qualityStatus !== 'PENDING' && load.qualityStatus !== 'RELEASED')
        throw new DomainError('CSSD_INVALID_STATE', 'Batch ini sudah ditahan atau ditolak.');
      reason = requireText(input.reason, 'Penahanan wajib disertai alasan.');
      // Paket yang tertahan hilang dari stok tersedia di posisi mana pun.
      await tx.package.updateMany({ where: { loadId: load.id }, data: { qualityStatus: 'HOLD', version: { increment: 1 } } });
      await saveLoad(tx, load, { qualityStatus: 'HOLD' });
    } else if (input.decision === 'RESUME') {
      if (load.qualityStatus !== 'HOLD') throw new DomainError('CSSD_INVALID_STATE', 'Batch ini tidak sedang ditahan.');
      if (openRecall) throw new DomainError('CSSD_PACKAGE_HELD', 'Recall pada batch ini masih terbuka. Tutup recall lebih dulu.');
      reason = requireText(input.reason, 'Tulis dasar pencabutan penahanan.');
      // Kembali menunggu keputusan; paket yang sempat tersedia keluar dari rak sampai dilepas lagi.
      await tx.package.updateMany({
        where: { loadId: load.id, position: 'AVAILABLE' },
        data: { position: 'CSSD', locationId: null, expiresAt: null },
      });
      await tx.package.updateMany({ where: { loadId: load.id }, data: { qualityStatus: 'PENDING', version: { increment: 1 } } });
      await saveLoad(tx, load, { qualityStatus: 'PENDING', releasedAt: null });
    } else {
      if (load.qualityStatus !== 'PENDING' && load.qualityStatus !== 'HOLD')
        throw new DomainError('CSSD_INVALID_STATE', 'Batch ini tidak bisa ditolak dari statusnya sekarang.');
      reason = requireText(input.reason, 'Penolakan wajib disertai alasan.');
      // Ditolak: paket kembali ke CSSD untuk diproses ulang lewat penerimaan tray.
      await tx.package.updateMany({
        where: { loadId: load.id, position: { in: ['CSSD', 'AVAILABLE'] } },
        data: { position: 'RETURNED', locationId: null },
      });
      await tx.package.updateMany({ where: { loadId: load.id }, data: { qualityStatus: 'REJECTED', version: { increment: 1 } } });
      await saveLoad(tx, load, { qualityStatus: 'REJECTED' });
    }

    await tx.qualityDecision.create({
      data: { loadId: load.id, decision: input.decision, reason, actorId: actor.id, actorRole: actor.roleLabel },
    });
    const actionName: Record<Decision, string> = {
      RELEASE: 'Batch dilepas',
      HOLD: 'Batch ditahan',
      REJECT: 'Batch ditolak',
      RESUME: 'Penahanan dicabut',
    };
    await audit(tx, actor, actionName[input.decision], 'LOAD', load.code, packageCodes, reason ?? undefined);
  });
}

// ---------- Permintaan unit ----------

export async function createRequest(
  actor: Actor,
  input: { setTemplateId: string; quantity: number; priority: 'ROUTINE' | 'URGENT'; neededBy: Date; note?: string },
) {
  requireCapability(actor, 'request:create');
  if (!actor.unitId) throw new DomainError('CSSD_FORBIDDEN', 'Akun Anda belum diikat ke unit.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) {
    throw new DomainError('CSSD_VALIDATION', 'Jumlah set 1 sampai 50.');
  }
  if (!['ROUTINE', 'URGENT'].includes(input.priority)) throw new DomainError('CSSD_VALIDATION', 'Pilih prioritas.');
  if (Number.isNaN(input.neededBy.getTime())) throw new DomainError('CSSD_VALIDATION', 'Isi waktu dibutuhkan.');
  if (input.neededBy.getTime() < Date.now() - 60 * 60 * 1000)
    throw new DomainError('CSSD_VALIDATION', 'Waktu dibutuhkan tidak boleh lewat lebih dari 1 jam.');
  const unitId = actor.unitId;
  return prisma.$transaction(async (tx) => {
    const set = await tx.setTemplate.findFirst({ where: { id: input.setTemplateId, facilityId: actor.facilityId, active: true } });
    if (!set) throw new DomainError('CSSD_VALIDATION', 'Pilih jenis set yang aktif.');
    const code = await nextCode(tx, actor.facilityId, 'RQ');
    const note = input.note?.trim().slice(0, 300) || null;
    const created = await tx.unitRequest.create({
      data: {
        facilityId: actor.facilityId,
        code,
        unitId,
        setTemplateId: set.id,
        quantity: input.quantity,
        priority: input.priority,
        neededBy: input.neededBy,
        note,
        requestedBy: actor.id,
      },
    });
    await audit(
      tx,
      actor,
      'Permintaan dibuat',
      'REQUEST',
      code,
      [],
      `${input.quantity} ${set.name}, ${input.priority === 'URGENT' ? 'mendesak' : 'rutin'}.${note ? ` ${note}` : ''}`,
    );
    return created;
  });
}

export async function cancelRequest(actor: Actor, input: { requestCode: string; reason: string; expectedVersion: number }) {
  if (!can(actor, 'request:create') && !can(actor, 'handover:create')) {
    throw new DomainError('CSSD_FORBIDDEN', 'Peran Anda tidak dapat membatalkan permintaan.');
  }
  return prisma.$transaction(async (tx) => {
    const found = await tx.unitRequest.findUnique({
      where: { facilityId_code: { facilityId: actor.facilityId, code: input.requestCode } },
    });
    // Petugas unit hanya melihat permintaan unitnya; selain itu dijawab tidak ada.
    if (!found || (actor.unitId && found.unitId !== actor.unitId)) throw new DomainError('CSSD_NOT_FOUND', 'Permintaan tidak ditemukan.');
    if (found.version !== input.expectedVersion) throw new DomainError('CSSD_VERSION_CONFLICT', CONFLICT_MESSAGE);
    if (found.status !== 'OPEN' && found.status !== 'PARTIAL')
      throw new DomainError('CSSD_INVALID_STATE', 'Permintaan ini sudah selesai atau dibatalkan.');
    const reason = requireText(input.reason, 'Tulis alasan pembatalan.');
    await tx.unitRequest.update({ where: { id: found.id }, data: { status: 'CANCELLED', version: { increment: 1 } } });
    await audit(
      tx,
      actor,
      'Permintaan dibatalkan',
      'REQUEST',
      found.code,
      [],
      `${reason}. Sudah terkirim ${found.fulfilled} dari ${found.quantity}.`,
    );
  });
}

// ---------- Stok ----------

/** Paket tersedia: dilepas, tidak diblokir, belum kedaluwarsa. */
export function availableWhere(facilityId: string, now = new Date()): Prisma.PackageWhereInput {
  return {
    facilityId,
    position: 'AVAILABLE',
    qualityStatus: 'RELEASED',
    blocked: false,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export async function movePackages(actor: Actor, input: { locationId: string; packageCodes: string[] }) {
  requireCapability(actor, 'stock:manage');
  return prisma.$transaction(async (tx) => {
    const location = await tx.location.findFirst({ where: { id: input.locationId, facilityId: actor.facilityId, active: true } });
    if (!location) throw new DomainError('CSSD_VALIDATION', 'Pilih rak tujuan yang aktif.');
    const codes = [...new Set(input.packageCodes)];
    if (codes.length === 0) throw new DomainError('CSSD_VALIDATION', 'Pilih minimal satu paket.');
    const moved = await tx.package.updateMany({
      where: { facilityId: actor.facilityId, code: { in: codes }, position: 'AVAILABLE' },
      data: { locationId: location.id, version: { increment: 1 } },
    });
    if (moved.count !== codes.length) {
      throw new DomainError('CSSD_PACKAGE_UNAVAILABLE', 'Sebagian paket tidak lagi berada di rak steril. Muat ulang stok.');
    }
    await audit(tx, actor, 'Paket dipindah rak', 'LOCATION', location.code, codes, `${codes.length} paket ke ${location.name}.`);
  });
}

/** Tarik paket kedaluwarsa dari rak; tray-nya diterima ulang sebagai kasus baru. */
export async function pullExpired(actor: Actor) {
  requireCapability(actor, 'stock:manage');
  return prisma.$transaction(async (tx) => {
    const expired = await tx.package.findMany({
      where: { facilityId: actor.facilityId, position: 'AVAILABLE', expiresAt: { lte: new Date() } },
    });
    if (expired.length === 0) throw new DomainError('CSSD_INVALID_STATE', 'Tidak ada paket kedaluwarsa di rak.');
    await tx.package.updateMany({
      where: { id: { in: expired.map((item) => item.id) } },
      data: { position: 'RETURNED', qualityStatus: 'REJECTED', locationId: null, version: { increment: 1 } },
    });
    await audit(
      tx,
      actor,
      'Paket kedaluwarsa ditarik',
      'PACKAGE',
      expired[0]!.code,
      expired.map((item) => item.code),
      `${expired.length} paket ditarik untuk diproses ulang.`,
    );
    return expired.length;
  });
}

// ---------- Distribusi ----------

export async function dispatchPackages(
  actor: Actor,
  input: { destinationUnitId: string; packageCodes: string[]; requestCode?: string | null },
) {
  requireCapability(actor, 'handover:create');
  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findFirst({ where: { id: input.destinationUnitId, facilityId: actor.facilityId, active: true } });
    if (!unit) throw new DomainError('CSSD_VALIDATION', 'Pilih unit tujuan yang aktif.');
    const codes = [...new Set(input.packageCodes)];
    if (codes.length === 0) throw new DomainError('CSSD_VALIDATION', 'Pilih minimal satu paket untuk dikirim.');
    const packages = await tx.package.findMany({ where: { facilityId: actor.facilityId, code: { in: codes } } });
    if (packages.length !== codes.length) throw new DomainError('CSSD_NOT_FOUND', 'Sebagian paket tidak ditemukan.');

    const request = input.requestCode
      ? await tx.unitRequest.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code: input.requestCode } } })
      : null;
    if (input.requestCode) {
      if (!request) throw new DomainError('CSSD_NOT_FOUND', `Permintaan ${input.requestCode} tidak ditemukan.`);
      if (request.unitId !== unit.id) throw new DomainError('CSSD_VALIDATION', `Permintaan ${request.code} milik unit lain.`);
      if (request.status !== 'OPEN' && request.status !== 'PARTIAL')
        throw new DomainError('CSSD_INVALID_STATE', `Permintaan ${request.code} sudah selesai atau dibatalkan.`);
      const wrongSet = packages.filter((item) => item.setTemplateId !== request.setTemplateId);
      if (wrongSet.length > 0)
        throw new DomainError('CSSD_VALIDATION', `Paket ${wrongSet.map((item) => item.code).join(', ')} bukan jenis set yang diminta.`);
      if (request.fulfilled + packages.length > request.quantity) {
        throw new DomainError('CSSD_VALIDATION', `Permintaan ${request.code} tinggal ${request.quantity - request.fulfilled} set.`);
      }
    }

    // Satu pemenang: dua petugas yang mengirim paket sama, hanya UPDATE pertama yang cocok.
    // Syarat tersedia (dilepas, tidak diblokir, belum kedaluwarsa) diperiksa di dalam UPDATE.
    const claimed = await tx.package.updateMany({
      where: { ...availableWhere(actor.facilityId), id: { in: packages.map((item) => item.id) } },
      data: { position: 'DISPATCHED', destinationUnitId: unit.id, locationId: null, version: { increment: 1 } },
    });
    if (claimed.count !== packages.length) {
      throw new DomainError(
        'CSSD_PACKAGE_UNAVAILABLE',
        'Sebagian paket sudah dikirim, ditahan, kedaluwarsa, atau tidak lagi tersedia. Muat ulang stok.',
      );
    }
    if (request) {
      const fulfilled = request.fulfilled + packages.length;
      await tx.unitRequest.update({
        where: { id: request.id },
        data: { fulfilled, status: fulfilled >= request.quantity ? 'FULFILLED' : 'PARTIAL', version: { increment: 1 } },
      });
    }
    const code = await nextCode(tx, actor.facilityId, 'ST');
    const created = await tx.handover.create({
      data: {
        facilityId: actor.facilityId,
        code,
        destinationUnitId: unit.id,
        requestId: request?.id ?? null,
        dispatchedBy: actor.id,
        lines: { create: packages.map((item) => ({ packageId: item.id })) },
      },
    });
    await audit(
      tx,
      actor,
      'Paket dikirim',
      'HANDOVER',
      code,
      [...packages.map((item) => item.code), request?.code],
      `Tujuan ${unit.code}, ${packages.length} paket.${request ? ` Memenuhi ${request.code}.` : ''}`,
    );
    return created;
  });
}

async function loadHandoverLine(tx: Tx, actor: Actor, handoverCode: string, packageCode: string) {
  const handover = await tx.handover.findUnique({
    where: { facilityId_code: { facilityId: actor.facilityId, code: handoverCode } },
    include: { lines: { include: { package: true } } },
  });
  // Petugas unit lain mendapat jawaban yang sama dengan serah terima yang tidak ada.
  if (!handover || (actor.unitId && handover.destinationUnitId !== actor.unitId)) {
    throw new DomainError('CSSD_NOT_FOUND', `Serah terima ${handoverCode} tidak ditemukan.`);
  }
  const line = handover.lines.find((item) => item.package.code === packageCode);
  if (!line) throw new DomainError('CSSD_NOT_FOUND', `Paket ${packageCode} tidak ada di serah terima ini.`);
  return { handover, line };
}

export async function acknowledgePackage(
  actor: Actor,
  input: { handoverCode: string; packageCode: string; outcome: Exclude<LineOutcome, 'PENDING'>; note?: string },
) {
  requireCapability(actor, 'handover:ack');
  return prisma.$transaction(async (tx) => {
    const { handover, line } = await loadHandoverLine(tx, actor, input.handoverCode, input.packageCode);
    if (line.outcome !== 'PENDING') throw new DomainError('CSSD_INVALID_STATE', `Paket ${input.packageCode} sudah dikonfirmasi.`);
    const note =
      input.outcome === 'REJECTED' ? requireText(input.note, 'Penolakan paket wajib disertai alasan.') : input.note?.trim() || null;
    await tx.handoverLine.update({ where: { id: line.id }, data: { outcome: input.outcome, note, ackBy: actor.id, ackAt: new Date() } });
    await tx.package.update({
      where: { id: line.packageId },
      // Paket yang ditolak kembali ke CSSD dan tidak otomatis tersedia lagi.
      data: { position: input.outcome === 'RECEIVED' ? 'RECEIVED' : 'RETURNED', version: { increment: 1 } },
    });
    const pending = handover.lines.filter((item) => item.id !== line.id && item.outcome === 'PENDING').length;
    if (pending === 0) await tx.handover.update({ where: { id: handover.id }, data: { completedAt: new Date() } });
    await audit(
      tx,
      actor,
      input.outcome === 'RECEIVED' ? 'Paket diterima unit' : 'Paket ditolak unit',
      'PACKAGE',
      input.packageCode,
      [handover.code],
      note ?? undefined,
    );
  });
}

export async function recordUsage(actor: Actor, input: { handoverCode: string; packageCode: string }) {
  requireCapability(actor, 'handover:ack');
  return prisma.$transaction(async (tx) => {
    const { handover, line } = await loadHandoverLine(tx, actor, input.handoverCode, input.packageCode);
    const updated = await tx.package.updateMany({
      where: { id: line.packageId, position: 'RECEIVED' },
      data: { position: 'USED', version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new DomainError('CSSD_INVALID_STATE', 'Hanya paket yang sudah diterima unit yang bisa dicatat digunakan.');
    // Tanpa identitas pasien: rujukan klinis menunggu kontrak RME (gerbang G4).
    await audit(tx, actor, 'Paket digunakan', 'PACKAGE', input.packageCode, [handover.code]);
  });
}

// ---------- Recall ----------

export async function openRecall(actor: Actor, input: { loadCode: string; reason: string }) {
  requireCapability(actor, 'recall:manage');
  return prisma.$transaction(async (tx) => {
    const load = await loadLoad(tx, actor, input.loadCode);
    const reason = requireText(input.reason, 'Tulis sebab recall (minimal 3 karakter).');
    if (load.packages.length === 0) throw new DomainError('CSSD_INVALID_STATE', 'Batch ini tidak memiliki paket untuk ditarik.');
    if (await tx.recall.findFirst({ where: { loadId: load.id, status: 'OPEN' } })) {
      throw new DomainError('CSSD_INVALID_STATE', 'Batch ini sudah memiliki recall yang masih terbuka.');
    }
    const code = await nextCode(tx, actor.facilityId, 'RC');
    const created = await tx.recall.create({
      data: {
        facilityId: actor.facilityId,
        code,
        loadId: load.id,
        reason,
        openedBy: actor.id,
        items: { create: load.packages.map((item) => ({ packageId: item.id, positionAtOpen: item.position })) },
      },
    });
    // Blok dan penahanan terjadi bersama pembuatan recall: tidak ada celah untuk mengirim paket terdampak.
    await tx.package.updateMany({ where: { loadId: load.id }, data: { blocked: true, version: { increment: 1 } } });
    if (load.processStatus === 'CYCLE_COMPLETED' && (load.qualityStatus === 'PENDING' || load.qualityStatus === 'RELEASED')) {
      await tx.package.updateMany({ where: { loadId: load.id }, data: { qualityStatus: 'HOLD' } });
      await saveLoad(tx, load, { qualityStatus: 'HOLD' });
    }
    await audit(tx, actor, 'Recall dibuka', 'RECALL', code, [load.code, ...load.packages.map((item) => item.code)], reason);
    return created;
  });
}

export async function updateRecallItem(
  actor: Actor,
  input: { recallCode: string; packageCode: string; status: Exclude<RecallItemStatus, 'IDENTIFIED'>; note?: string },
) {
  requireCapability(actor, 'recall:manage');
  return prisma.$transaction(async (tx) => {
    const recall = await tx.recall.findUnique({
      where: { facilityId_code: { facilityId: actor.facilityId, code: input.recallCode } },
      include: { items: { include: { package: true } } },
    });
    if (!recall) throw new DomainError('CSSD_NOT_FOUND', `Recall ${input.recallCode} tidak ditemukan.`);
    if (recall.status !== 'OPEN') throw new DomainError('CSSD_INVALID_STATE', 'Recall ini sudah ditutup.');
    const item = recall.items.find((entry) => entry.package.code === input.packageCode);
    if (!item) throw new DomainError('CSSD_NOT_FOUND', `Paket ${input.packageCode} tidak termasuk recall ini.`);
    const note =
      input.status === 'RECOVERED'
        ? input.note?.trim() || null
        : requireText(input.note, 'Tulis tindak lanjut atau eskalasi untuk paket ini.');
    await tx.recallItem.update({
      where: { id: item.id },
      data: { status: input.status, note, updatedBy: actor.id, updatedAt: new Date() },
    });
    const label: Record<typeof input.status, string> = {
      RECOVERED: 'berhasil ditarik',
      USED: 'sudah digunakan',
      NOT_FOUND: 'belum ditemukan',
    };
    await audit(tx, actor, `Recall: paket ${label[input.status]}`, 'PACKAGE', input.packageCode, [recall.code], note ?? undefined);
  });
}

export async function closeRecall(actor: Actor, input: { recallCode: string; capa: string }) {
  requireCapability(actor, 'recall:manage');
  return prisma.$transaction(async (tx) => {
    const recall = await tx.recall.findUnique({
      where: { facilityId_code: { facilityId: actor.facilityId, code: input.recallCode } },
      include: { items: { include: { package: true } }, load: { include: { monitoringResults: true, packages: true, device: true } } },
    });
    if (!recall) throw new DomainError('CSSD_NOT_FOUND', `Recall ${input.recallCode} tidak ditemukan.`);
    if (recall.status !== 'OPEN') throw new DomainError('CSSD_INVALID_STATE', 'Recall ini sudah ditutup.');
    // Konfirmasi satu paket tidak menutup insiden: semua paket harus punya tindak lanjut.
    const open = recall.items.filter((item) => item.status === 'IDENTIFIED');
    if (open.length > 0) {
      throw new DomainError(
        'CSSD_RECALL_OPEN_ITEMS',
        `${open.length} paket belum punya tindak lanjut: ${open.map((item) => item.package.code).join(', ')}.`,
      );
    }
    const capa = requireText(input.capa, 'Tulis tindakan korektif dan pencegahan (CAPA).');
    await tx.recall.update({ where: { id: recall.id }, data: { status: 'CLOSED', capa, closedBy: actor.id, closedAt: new Date() } });
    // Paket terdampak tidak kembali tersedia: ditolak dan harus diproses ulang.
    await tx.package.updateMany({
      where: { loadId: recall.loadId },
      data: { blocked: false, qualityStatus: 'REJECTED', version: { increment: 1 } },
    });
    if (recall.load.processStatus === 'CYCLE_COMPLETED') await saveLoad(tx, recall.load, { qualityStatus: 'REJECTED' });
    await audit(
      tx,
      actor,
      'Recall ditutup',
      'RECALL',
      recall.code,
      [recall.load.code, ...recall.items.map((item) => item.package.code)],
      capa,
    );
  });
}

// ---------- Master ----------

export async function setDeviceStatus(actor: Actor, input: { deviceId: string; status: 'ACTIVE' | 'OUT_OF_SERVICE'; reason: string }) {
  requireCapability(actor, 'master:manage');
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.findFirst({ where: { id: input.deviceId, facilityId: actor.facilityId } });
    if (!device) throw new DomainError('CSSD_NOT_FOUND', 'Mesin tidak ditemukan.');
    const reason = requireText(input.reason, 'Tulis alasan perubahan status mesin.');
    await tx.device.update({ where: { id: device.id }, data: { status: input.status } });
    await audit(tx, actor, input.status === 'ACTIVE' ? 'Mesin layak pakai' : 'Mesin tidak layak pakai', 'DEVICE', device.code, [], reason);
  });
}

export async function createTray(actor: Actor, input: { code: string; setTemplateId: string; homeUnitId: string }) {
  requireCapability(actor, 'master:manage');
  return prisma.$transaction(async (tx) => {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(code))
      throw new DomainError('CSSD_VALIDATION', 'Kode tray 3 sampai 20 karakter: huruf, angka dan tanda hubung.');
    const [set, unit, existing] = await Promise.all([
      tx.setTemplate.findFirst({ where: { id: input.setTemplateId, facilityId: actor.facilityId } }),
      tx.unit.findFirst({ where: { id: input.homeUnitId, facilityId: actor.facilityId } }),
      tx.tray.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code } } }),
    ]);
    if (!set || !unit) throw new DomainError('CSSD_VALIDATION', 'Pilih jenis set dan unit pemilik.');
    if (existing) throw new DomainError('CSSD_INVALID_STATE', `Kode tray ${code} sudah dipakai.`);
    const created = await tx.tray.create({ data: { facilityId: actor.facilityId, code, setTemplateId: set.id, homeUnitId: unit.id } });
    await audit(tx, actor, 'Tray didaftarkan', 'TRAY', code, [], `${set.name}, unit ${unit.code}.`);
    return created;
  });
}
