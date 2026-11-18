// Master data dan kebijakan yang diisi admin rumah sakit (PRD-PRODUCTION P-04, P-05).
// Item yang pernah dipakai tidak dihapus, hanya dinonaktifkan, agar riwayat tetap utuh.
import type { SterilizationMethod } from '@/generated/prisma/enums';
import { FACILITY_TIME_ZONES } from './accounts';
import { prisma } from './db';
import type { Actor } from './identity';
import { DomainError, audit, requireCapability } from './workflow';

const CODE = /^[A-Z0-9][A-Z0-9-]{0,19}$/;

function code(value: string, label: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CODE.test(normalized)) throw new DomainError('CSSD_VALIDATION', `Kode ${label} 1 sampai 20 karakter: huruf, angka dan tanda hubung.`);
  return normalized;
}

function text(value: string, min: number, max: number, message: string): string {
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new DomainError('CSSD_VALIDATION', message);
  return trimmed;
}

function method(value: string): SterilizationMethod {
  if (value !== 'STEAM' && value !== 'LOW_TEMP') throw new DomainError('CSSD_VALIDATION', 'Pilih metode sterilisasi.');
  return value;
}

export async function saveFacility(actor: Actor, input: { name: string; timeZone: string }) {
  requireCapability(actor, 'master:manage');
  const name = text(input.name, 3, 120, 'Nama fasilitas 3 sampai 120 karakter.');
  if (!(FACILITY_TIME_ZONES as readonly string[]).includes(input.timeZone)) throw new DomainError('CSSD_VALIDATION', 'Pilih zona waktu.');
  await prisma.$transaction(async (tx) => {
    const facility = await tx.facility.update({ where: { id: actor.facilityId }, data: { name, timeZone: input.timeZone } });
    await audit(tx, actor, 'Fasilitas diubah', 'FACILITY', facility.code, [], `${name}, zona ${input.timeZone}.`);
  });
}

type Saveable = { id?: string; code: string; name: string; active: boolean };

export async function saveUnit(actor: Actor, input: Saveable) {
  requireCapability(actor, 'master:manage');
  const unitCode = code(input.code, 'unit');
  const name = text(input.name, 2, 80, 'Nama unit 2 sampai 80 karakter.');
  await prisma.$transaction(async (tx) => {
    const clash = await tx.unit.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code: unitCode } } });
    if (clash && clash.id !== input.id) throw new DomainError('CSSD_INVALID_STATE', `Kode unit ${unitCode} sudah dipakai.`);
    if (input.id) {
      const found = await tx.unit.findFirst({ where: { id: input.id, facilityId: actor.facilityId } });
      if (!found) throw new DomainError('CSSD_NOT_FOUND', 'Unit tidak ditemukan.');
      if (!input.active && (await tx.user.count({ where: { unitId: found.id, active: true } })) > 0) {
        throw new DomainError('CSSD_INVALID_STATE', `Unit ${found.code} masih dipakai akun petugas aktif. Pindahkan akunnya lebih dulu.`);
      }
      await tx.unit.update({ where: { id: found.id }, data: { code: unitCode, name, active: input.active } });
      await audit(tx, actor, 'Unit diubah', 'UNIT', unitCode, [], `${name}${input.active ? '' : ', dinonaktifkan'}.`);
    } else {
      await tx.unit.create({ data: { facilityId: actor.facilityId, code: unitCode, name } });
      await audit(tx, actor, 'Unit ditambahkan', 'UNIT', unitCode, [], name);
    }
  });
  return unitCode;
}

export async function saveLocation(actor: Actor, input: Saveable) {
  requireCapability(actor, 'master:manage');
  const locationCode = code(input.code, 'rak');
  const name = text(input.name, 2, 80, 'Nama rak 2 sampai 80 karakter.');
  await prisma.$transaction(async (tx) => {
    const clash = await tx.location.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code: locationCode } } });
    if (clash && clash.id !== input.id) throw new DomainError('CSSD_INVALID_STATE', `Kode rak ${locationCode} sudah dipakai.`);
    if (input.id) {
      const found = await tx.location.findFirst({ where: { id: input.id, facilityId: actor.facilityId } });
      if (!found) throw new DomainError('CSSD_NOT_FOUND', 'Rak tidak ditemukan.');
      if (!input.active && (await tx.package.count({ where: { locationId: found.id, position: 'AVAILABLE' } })) > 0) {
        throw new DomainError('CSSD_INVALID_STATE', `Rak ${found.code} masih berisi paket. Pindahkan paketnya lebih dulu.`);
      }
      await tx.location.update({ where: { id: found.id }, data: { code: locationCode, name, active: input.active } });
      await audit(tx, actor, 'Rak diubah', 'LOCATION', locationCode, [], `${name}${input.active ? '' : ', dinonaktifkan'}.`);
    } else {
      await tx.location.create({ data: { facilityId: actor.facilityId, code: locationCode, name } });
      await audit(tx, actor, 'Rak ditambahkan', 'LOCATION', locationCode, [], name);
    }
  });
  return locationCode;
}

export async function saveDevice(actor: Actor, input: Saveable & { method: string }) {
  requireCapability(actor, 'master:manage');
  const deviceCode = code(input.code, 'mesin');
  const name = text(input.name, 2, 80, 'Nama mesin 2 sampai 80 karakter.');
  const deviceMethod = method(input.method);
  await prisma.$transaction(async (tx) => {
    const clash = await tx.device.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code: deviceCode } } });
    if (clash && clash.id !== input.id) throw new DomainError('CSSD_INVALID_STATE', `Kode mesin ${deviceCode} sudah dipakai.`);
    if (input.id) {
      const found = await tx.device.findFirst({ where: { id: input.id, facilityId: actor.facilityId } });
      if (!found) throw new DomainError('CSSD_NOT_FOUND', 'Mesin tidak ditemukan.');
      const busy = await tx.load.count({ where: { deviceId: found.id, processStatus: { in: ['LOADED', 'RUNNING'] } } });
      if (busy > 0 && (found.method !== deviceMethod || !input.active)) {
        throw new DomainError('CSSD_INVALID_STATE', `Mesin ${found.code} sedang dipakai muatan. Selesaikan muatannya lebih dulu.`);
      }
      await tx.device.update({ where: { id: found.id }, data: { code: deviceCode, name, method: deviceMethod, active: input.active } });
      await audit(tx, actor, 'Mesin diubah', 'DEVICE', deviceCode, [], `${name}${input.active ? '' : ', dinonaktifkan'}.`);
    } else {
      await tx.device.create({ data: { facilityId: actor.facilityId, code: deviceCode, name, method: deviceMethod } });
      await audit(tx, actor, 'Mesin ditambahkan', 'DEVICE', deviceCode, [], name);
    }
  });
  return deviceCode;
}

export interface ComponentInput {
  name: string;
  quantity: number;
}

/** Simpan set dan isi komponennya. Riwayat inspeksi menyimpan salinan nama dan jumlah, jadi revisi aman. */
export async function saveSetTemplate(
  actor: Actor,
  input: { id?: string; code: string; name: string; description: string; shelfLifeDays: number; active: boolean; components: ComponentInput[] },
) {
  requireCapability(actor, 'master:manage');
  const setCode = code(input.code, 'set');
  const name = text(input.name, 2, 80, 'Nama set 2 sampai 80 karakter.');
  const description = input.description.trim().slice(0, 160);
  if (!Number.isInteger(input.shelfLifeDays) || input.shelfLifeDays < 1 || input.shelfLifeDays > 3650) {
    throw new DomainError('CSSD_VALIDATION', 'Masa simpan 1 sampai 3650 hari, sesuai SOP kemasan.');
  }
  const components = input.components
    .map((item) => ({ name: item.name.trim(), quantity: item.quantity }))
    .filter((item) => item.name.length > 0);
  if (components.length === 0) throw new DomainError('CSSD_VALIDATION', 'Isi minimal satu komponen set.');
  if (components.length > 120) throw new DomainError('CSSD_VALIDATION', 'Maksimal 120 komponen per set.');
  for (const item of components) {
    if (item.name.length > 80) throw new DomainError('CSSD_VALIDATION', `Nama komponen terlalu panjang: ${item.name.slice(0, 30)}...`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new DomainError('CSSD_VALIDATION', `Jumlah ${item.name} harus 1 sampai 99.`);
    }
  }
  const names = new Set(components.map((item) => item.name.toLowerCase()));
  if (names.size !== components.length) throw new DomainError('CSSD_VALIDATION', 'Nama komponen tidak boleh dobel dalam satu set.');

  await prisma.$transaction(async (tx) => {
    const clash = await tx.setTemplate.findUnique({ where: { facilityId_code: { facilityId: actor.facilityId, code: setCode } } });
    if (clash && clash.id !== input.id) throw new DomainError('CSSD_INVALID_STATE', `Kode set ${setCode} sudah dipakai.`);
    const total = components.reduce((sum, item) => sum + item.quantity, 0);
    if (input.id) {
      const found = await tx.setTemplate.findFirst({ where: { id: input.id, facilityId: actor.facilityId } });
      if (!found) throw new DomainError('CSSD_NOT_FOUND', 'Set tidak ditemukan.');
      // Kasus yang sedang diinspeksi memakai isi lama; revisi isi menunggu kasusnya selesai.
      const inFlight = await tx.reprocessingCase.count({ where: { tray: { setTemplateId: found.id }, status: { in: ['RECEIVED', 'INSPECTION'] } } });
      const old = await tx.setComponent.findMany({ where: { setTemplateId: found.id } });
      const changed = old.length !== components.length || old.some((item) => {
        const match = components.find((next) => next.name === item.name);
        return !match || match.quantity !== item.quantity;
      });
      if (changed && inFlight > 0) {
        throw new DomainError('CSSD_INVALID_STATE', `Ada ${inFlight} tray set ini yang sedang diterima atau diinspeksi. Ubah isi set setelah kasusnya dikemas.`);
      }
      await tx.setTemplate.update({ where: { id: found.id }, data: { code: setCode, name, description, shelfLifeDays: input.shelfLifeDays, active: input.active } });
      if (changed) {
        await tx.inspectionLine.updateMany({ where: { componentId: { in: old.map((item) => item.id) } }, data: { componentId: null } });
        await tx.setComponent.deleteMany({ where: { setTemplateId: found.id } });
        await tx.setComponent.createMany({ data: components.map((item, index) => ({ setTemplateId: found.id, name: item.name, quantity: item.quantity, sortOrder: index })) });
      }
      await audit(tx, actor, 'Set diubah', 'SET', setCode, [],
        `${name}: ${components.length} jenis komponen, ${total} buah, masa simpan ${input.shelfLifeDays} hari${changed ? ', isi direvisi' : ''}${input.active ? '' : ', dinonaktifkan'}.`);
    } else {
      await tx.setTemplate.create({
        data: {
          facilityId: actor.facilityId,
          code: setCode,
          name,
          description,
          shelfLifeDays: input.shelfLifeDays,
          components: { create: components.map((item, index) => ({ name: item.name, quantity: item.quantity, sortOrder: index })) },
        },
      });
      await audit(tx, actor, 'Set ditambahkan', 'SET', setCode, [], `${name}: ${components.length} jenis komponen, ${total} buah, masa simpan ${input.shelfLifeDays} hari.`);
    }
  });
  return setCode;
}

export async function savePolicy(
  actor: Actor,
  input: { method: string; requirePhysical: boolean; requireChemical: boolean; requireBiological: boolean; reference: string },
) {
  requireCapability(actor, 'master:manage');
  const policyMethod = method(input.method);
  const reference = text(input.reference, 3, 80, 'Tulis rujukan SOP/IFU kebijakan ini, misalnya "SOP-CSSD-07 rev 3".');
  if (!input.requirePhysical && !input.requireChemical && !input.requireBiological) {
    throw new DomainError('CSSD_VALIDATION', 'Pilih minimal satu indikator wajib.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.monitoringPolicy.upsert({
      where: { facilityId_method: { facilityId: actor.facilityId, method: policyMethod } },
      create: { facilityId: actor.facilityId, method: policyMethod, requirePhysical: input.requirePhysical, requireChemical: input.requireChemical, requireBiological: input.requireBiological, reference },
      update: { requirePhysical: input.requirePhysical, requireChemical: input.requireChemical, requireBiological: input.requireBiological, reference },
    });
    const kinds = [input.requirePhysical && 'fisik', input.requireChemical && 'kimia', input.requireBiological && 'biologis'].filter(Boolean).join(', ');
    // Batch yang siklusnya sudah selesai tetap memakai kebijakan saat itu (tercatat di policyRef).
    await audit(tx, actor, 'Kebijakan bukti diubah', 'POLICY', policyMethod, [], `Metode ${policyMethod === 'STEAM' ? 'uap' : 'suhu rendah'}: wajib ${kinds}. Rujukan ${reference}. Berlaku untuk siklus berikutnya.`);
  });
}

export async function updateTray(actor: Actor, input: { trayId: string; homeUnitId: string; active: boolean }) {
  requireCapability(actor, 'master:manage');
  await prisma.$transaction(async (tx) => {
    const tray = await tx.tray.findFirst({ where: { id: input.trayId, facilityId: actor.facilityId } });
    if (!tray) throw new DomainError('CSSD_NOT_FOUND', 'Tray tidak ditemukan.');
    const unit = await tx.unit.findFirst({ where: { id: input.homeUnitId, facilityId: actor.facilityId, active: true } });
    if (!unit) throw new DomainError('CSSD_VALIDATION', 'Pilih unit pemilik yang aktif.');
    if (!input.active && (await tx.reprocessingCase.count({ where: { trayId: tray.id, status: { not: 'PACKAGED' } } })) > 0) {
      throw new DomainError('CSSD_INVALID_STATE', `Tray ${tray.code} sedang diproses. Nonaktifkan setelah kasusnya selesai.`);
    }
    await tx.tray.update({ where: { id: tray.id }, data: { homeUnitId: unit.id, active: input.active } });
    await audit(tx, actor, 'Tray diubah', 'TRAY', tray.code, [], `Unit ${unit.code}${input.active ? '' : ', dinonaktifkan'}.`);
  });
}

/** Ringkasan kesiapan konfigurasi: apa yang masih harus diisi admin sebelum operasional. */
export async function setupChecklist(facilityId: string) {
  const [units, locations, devices, sets, emptySets, trays, policies, users] = await Promise.all([
    prisma.unit.count({ where: { facilityId, active: true } }),
    prisma.location.count({ where: { facilityId, active: true } }),
    prisma.device.findMany({ where: { facilityId, active: true }, select: { method: true } }),
    prisma.setTemplate.count({ where: { facilityId, active: true } }),
    prisma.setTemplate.count({ where: { facilityId, active: true, components: { none: {} } } }),
    prisma.tray.count({ where: { facilityId, active: true } }),
    prisma.monitoringPolicy.findMany({ where: { facilityId }, select: { method: true } }),
    prisma.user.count({ where: { facilityId, active: true, role: { not: 'ADMIN' } } }),
  ]);
  const methods = [...new Set(devices.map((item) => item.method))];
  const missingPolicies = methods.filter((item) => !policies.some((policy) => policy.method === item));
  return [
    { key: 'units', done: units > 0, label: 'Unit pengguna', href: '/cssd/admin/locations' },
    { key: 'locations', done: locations > 0, label: 'Rak penyimpanan steril', href: '/cssd/admin/locations' },
    { key: 'devices', done: devices.length > 0, label: 'Mesin sterilisasi', href: '/cssd/admin/locations' },
    { key: 'policies', done: devices.length > 0 && missingPolicies.length === 0, label: 'Kebijakan bukti untuk setiap metode mesin', href: '/cssd/admin' },
    { key: 'sets', done: sets > 0 && emptySets === 0, label: 'Set beserta isi komponen dan masa simpan', href: '/cssd/admin/sets' },
    { key: 'trays', done: trays > 0, label: 'Tray terdaftar', href: '/cssd/admin/sets' },
    { key: 'users', done: users > 0, label: 'Akun petugas', href: '/cssd/admin/users' },
  ];
}
