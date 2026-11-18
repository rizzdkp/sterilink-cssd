'use server';

import { APIError } from 'better-auth/api';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { EvidenceKind } from '@/generated/prisma/enums';
import { createAccount, installFacility, markPasswordChanged, passwordProblem, recordLogin, resetPassword, updateAccount } from './accounts';
import { auth } from './auth';
import { prisma } from './db';
import { getActor, type Actor } from './identity';
import { saveDevice, saveFacility, saveLocation, savePolicy, saveSetTemplate, saveUnit, updateTray } from './master';
import { normalizeScanCode } from './queue/params';
import { fromFacilityLocal } from './time';
import {
  DomainError,
  acknowledgePackage,
  cancelLoad,
  cancelRequest,
  closeRecall,
  completeCycle,
  createLoad,
  createPackage,
  createRequest,
  createTray,
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
  setDeviceStatus,
  startCycle,
  updateRecallItem,
  type Decision,
  type InspectionLineInput,
} from './workflow';

export interface ActionResult {
  status: 'idle' | 'ok' | 'error';
  message: string;
  // Berubah tiap pengiriman, supaya pesan yang sama tetap diumumkan ulang.
  at: number;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const int = (form: FormData, key: string) => {
  const raw = text(form, key);
  return /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
};
const flag = (form: FormData, key: string) => form.get(key) === 'on' || form.get(key) === 'true';
const codes = (form: FormData, key: string) =>
  form.getAll(key).map((value) => normalizeScanCode(String(value))).filter((code): code is string => Boolean(code));

function oneOf<T extends string>(value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new DomainError('CSSD_VALIDATION', 'Pilihan tidak valid. Muat ulang halaman.');
  return value as T;
}

/** Waktu kejadian dari isian datetime-local (zona fasilitas). Kosong berarti sekarang. */
function occurredAt(form: FormData, actor: Actor): Date | null {
  const raw = text(form, 'occurredAt');
  return raw ? fromFacilityLocal(raw, actor.timeZone) : null;
}

/**
 * Bungkus setiap aksi: pastikan sesi, jalankan aturan domain, terjemahkan
 * penolakan menjadi pesan yang bisa dibaca, lalu segarkan halaman CSSD.
 */
async function run(work: (actor: Actor) => Promise<string>): Promise<ActionResult> {
  const at = Date.now();
  const actor = await getActor();
  if (!actor) return { status: 'error', message: 'Sesi Anda berakhir. Muat ulang halaman lalu masuk lagi.', at };
  if (actor.mustChangePassword) return { status: 'error', message: 'Ganti kata sandi awal Anda lebih dulu.', at };
  try {
    const message = await work(actor);
    revalidatePath('/cssd', 'layout');
    return { status: 'ok', message, at };
  } catch (error) {
    if (error instanceof DomainError) {
      // Konflik versi berarti layar sudah usang: segarkan supaya pengguna melihat keadaan terbaru.
      if (error.code === 'CSSD_VERSION_CONFLICT') revalidatePath('/cssd', 'layout');
      return { status: 'error', message: error.message, at };
    }
    console.error(JSON.stringify({ level: 'error', action: 'server-action', message: (error as Error).message }));
    return { status: 'error', message: 'Penyimpanan gagal karena gangguan server. Periksa daftar sebelum mencoba lagi.', at };
  }
}

type Action = (previous: ActionResult, form: FormData) => Promise<ActionResult>;

// ---------- Akun dan sesi ----------

function safeNext(value: string): string {
  // Hanya jalur internal: mencegah pengalihan ke situs luar setelah login.
  return value.startsWith('/') && !value.startsWith('//') ? value : '/cssd';
}

function authMessage(error: unknown): string {
  if (error instanceof APIError) {
    if (error.status === 'TOO_MANY_REQUESTS' || error.statusCode === 429) return 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.';
    if (error.status === 'FORBIDDEN') return error.message || 'Akun ini dinonaktifkan. Hubungi admin CSSD.';
  }
  // Pesan sama untuk username salah dan sandi salah: tidak membocorkan akun mana yang ada.
  return 'Username atau kata sandi salah.';
}

export const loginAction: Action = async (_previous, form) => {
  const at = Date.now();
  const username = text(form, 'username').toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!username || !password) return { status: 'error', message: 'Isi username dan kata sandi.', at };
  let userId: string;
  try {
    const result = await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
    if (!result?.user) return { status: 'error', message: 'Username atau kata sandi salah.', at };
    userId = result.user.id;
  } catch (error) {
    return { status: 'error', message: authMessage(error), at };
  }
  await recordLogin(userId, 'Masuk');
  redirect(safeNext(text(form, 'next')));
};

export async function logoutAction(): Promise<void> {
  const actor = await getActor();
  try {
    await auth.api.signOut({ headers: await headers() });
  } finally {
    if (actor) await recordLogin(actor.id, 'Keluar');
  }
  redirect('/login');
}

export const setupAction: Action = async (_previous, form) => {
  const at = Date.now();
  const password = String(form.get('adminPassword') ?? '');
  if (password !== String(form.get('adminPasswordConfirm') ?? '')) {
    return { status: 'error', message: 'Konfirmasi kata sandi tidak sama.', at };
  }
  try {
    await installFacility({
      facilityCode: text(form, 'facilityCode'),
      facilityName: text(form, 'facilityName'),
      timeZone: text(form, 'timeZone'),
      adminName: text(form, 'adminName'),
      adminUsername: text(form, 'adminUsername'),
      adminPassword: password,
    });
  } catch (error) {
    if (error instanceof DomainError) return { status: 'error', message: error.message, at };
    console.error(JSON.stringify({ level: 'error', action: 'setup', message: (error as Error).message }));
    return { status: 'error', message: 'Pemasangan gagal karena gangguan server.', at };
  }
  // Langsung masuk sebagai admin pertama, lalu lanjut ke pengaturan master.
  await auth.api.signInUsername({ body: { username: text(form, 'adminUsername').toLowerCase(), password }, headers: await headers() });
  redirect('/cssd/admin');
};

export const changePasswordAction: Action = async (_previous, form) => {
  const at = Date.now();
  const actor = await getActor();
  if (!actor) return { status: 'error', message: 'Sesi Anda berakhir. Masuk lagi.', at };
  const currentPassword = String(form.get('currentPassword') ?? '');
  const newPassword = String(form.get('newPassword') ?? '');
  if (newPassword !== String(form.get('confirmPassword') ?? '')) return { status: 'error', message: 'Konfirmasi kata sandi baru tidak sama.', at };
  if (newPassword === currentPassword) return { status: 'error', message: 'Kata sandi baru harus berbeda dari yang lama.', at };
  const problem = passwordProblem(newPassword, actor.username);
  if (problem) return { status: 'error', message: problem, at };
  try {
    await auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError && (error.statusCode === 429 || error.status === 'TOO_MANY_REQUESTS')) {
      return { status: 'error', message: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.', at };
    }
    return { status: 'error', message: 'Kata sandi saat ini salah.', at };
  }
  await markPasswordChanged(actor);
  redirect('/cssd');
};

export const createUserAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const username = await createAccount(actor, {
      name: text(form, 'name'),
      username: text(form, 'username'),
      password: String(form.get('password') ?? ''),
      role: text(form, 'role'),
      unitId: text(form, 'unitId'),
    });
    return `Akun ${username} dibuat. Berikan kata sandi awal secara langsung; pengguna wajib menggantinya saat masuk.`;
  });

export const updateUserAction: Action = async (_previous, form) =>
  run(async (actor) => {
    await updateAccount(actor, { userId: text(form, 'userId'), role: text(form, 'role'), unitId: text(form, 'unitId'), active: flag(form, 'active') });
    return 'Akun diperbarui. Sesi lama pengguna dicabut bila peran atau statusnya berubah.';
  });

export const resetPasswordAction: Action = async (_previous, form) =>
  run(async (actor) => {
    await resetPassword(actor, { userId: text(form, 'userId'), password: String(form.get('password') ?? '') });
    return 'Kata sandi diatur ulang. Pengguna wajib menggantinya saat masuk berikutnya.';
  });

// ---------- Master ----------

export const saveFacilityAction: Action = async (_previous, form) =>
  run(async (actor) => {
    await saveFacility(actor, { name: text(form, 'name'), timeZone: text(form, 'timeZone') });
    return 'Data fasilitas disimpan.';
  });

const saveable = (form: FormData) => ({
  id: text(form, 'id') || undefined,
  code: text(form, 'code'),
  name: text(form, 'name'),
  active: form.has('id') ? flag(form, 'active') : true,
});

export const saveUnitAction: Action = async (_previous, form) =>
  run(async (actor) => `Unit ${await saveUnit(actor, saveable(form))} disimpan.`);

export const saveLocationAction: Action = async (_previous, form) =>
  run(async (actor) => `Rak ${await saveLocation(actor, saveable(form))} disimpan.`);

export const saveDeviceAction: Action = async (_previous, form) =>
  run(async (actor) => `Mesin ${await saveDevice(actor, { ...saveable(form), method: text(form, 'method') })} disimpan.`);

export const saveSetAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const names = form.getAll('componentName').map(String);
    const quantities = form.getAll('componentQty').map((value) => (/^\d+$/.test(String(value).trim()) ? Number(value) : Number.NaN));
    const setCode = await saveSetTemplate(actor, {
      ...saveable(form),
      description: text(form, 'description'),
      shelfLifeDays: int(form, 'shelfLifeDays'),
      components: names.map((name, index) => ({ name, quantity: quantities[index] ?? Number.NaN })),
    });
    return `Set ${setCode} disimpan.`;
  });

export const savePolicyAction: Action = async (_previous, form) =>
  run(async (actor) => {
    await savePolicy(actor, {
      method: text(form, 'method'),
      requirePhysical: flag(form, 'requirePhysical'),
      requireChemical: flag(form, 'requireChemical'),
      requireBiological: flag(form, 'requireBiological'),
      reference: text(form, 'reference'),
    });
    return 'Kebijakan bukti disimpan. Berlaku untuk siklus yang selesai setelah ini.';
  });

export const deviceStatusAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const status = oneOf(text(form, 'status'), ['ACTIVE', 'OUT_OF_SERVICE'] as const);
    await setDeviceStatus(actor, { deviceId: text(form, 'deviceId'), status, reason: text(form, 'reason') });
    return status === 'ACTIVE' ? 'Mesin ditandai layak pakai.' : 'Mesin ditandai tidak layak pakai.';
  });

export const createTrayAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const created = await createTray(actor, { code: text(form, 'code'), setTemplateId: text(form, 'setTemplateId'), homeUnitId: text(form, 'homeUnitId') });
    return `Tray ${created.code} didaftarkan.`;
  });

export const updateTrayAction: Action = async (_previous, form) =>
  run(async (actor) => {
    await updateTray(actor, { trayId: text(form, 'trayId'), homeUnitId: text(form, 'homeUnitId'), active: flag(form, 'active') });
    return 'Tray diperbarui.';
  });

// ---------- Penerimaan sampai paket ----------

export const receiveTrayAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const trayCode = normalizeScanCode(text(form, 'trayCode'));
    if (!trayCode) throw new DomainError('CSSD_VALIDATION', 'Pindai atau ketik kode tray.');
    const created = await receiveTray(actor, {
      trayCode,
      originUnitId: text(form, 'originUnitId'),
      actualCount: int(form, 'actualCount'),
      conditionNote: text(form, 'conditionNote'),
      occurredAt: occurredAt(form, actor),
      backdateReason: text(form, 'backdateReason'),
    });
    return `Tray ${trayCode} diterima sebagai kasus ${created.code}.`;
  });

export const cleaningAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const outcome = oneOf(text(form, 'outcome'), ['PASS', 'FAIL'] as const);
    const caseCode = text(form, 'caseCode');
    await recordCleaning(actor, { caseCode, outcome, note: text(form, 'note'), expectedVersion: int(form, 'version') });
    return outcome === 'PASS' ? `Dekontaminasi ${caseCode} lulus. Kasus lanjut ke inspeksi.` : `Dekontaminasi ${caseCode} gagal dan dicatat. Ulangi proses.`;
  });

export const inspectionAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const caseCode = text(form, 'caseCode');
    const lines: InspectionLineInput[] = form.getAll('componentId').map((value) => {
      const id = String(value);
      return {
        componentId: id,
        actual: int(form, `actual-${id}`),
        condition: oneOf(text(form, `condition-${id}`), ['OK', 'DAMAGED', 'MISSING'] as const),
        note: text(form, `note-${id}`),
      };
    });
    const { passed } = await recordInspection(actor, { caseCode, lines, note: text(form, 'note'), expectedVersion: int(form, 'version') });
    return passed ? `Inspeksi ${caseCode} lulus. Kasus siap dikemas.` : `Inspeksi ${caseCode} tidak lulus. Tray kembali ke dekontaminasi.`;
  });

export const packAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const created = await createPackage(actor, { caseCode: text(form, 'caseCode'), materialLot: text(form, 'materialLot'), expectedVersion: int(form, 'version') });
    return `Paket ${created.code} dibuat. Cetak labelnya sebelum dimuat.`;
  });

export async function recordLabelPrintAction(packageCode: string): Promise<ActionResult> {
  return run(async (actor) => {
    await recordLabelPrint(actor, packageCode);
    return `Cetak label ${packageCode} tercatat.`;
  });
}

// ---------- Muatan, bukti, keputusan ----------

export const createLoadAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const created = await createLoad(actor, { deviceId: text(form, 'deviceId'), packageCodes: codes(form, 'packageCodes') });
    return `Muatan ${created.code} disusun. Mulai siklus dari halaman batch.`;
  });

export const loadTransitionAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const step = oneOf(text(form, 'step'), ['START', 'COMPLETE', 'CANCEL'] as const);
    const input = { loadCode: text(form, 'loadCode'), expectedVersion: int(form, 'version') };
    if (step === 'START') await startCycle(actor, input);
    else if (step === 'COMPLETE') await completeCycle(actor, input);
    else await cancelLoad(actor, input);
    const done = { START: 'Siklus dimulai.', COMPLETE: 'Siklus selesai. Catat bukti pemantauan.', CANCEL: 'Muatan dibatalkan. Paket kembali siap muat.' };
    return done[step];
  });

export const evidenceAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const kind = oneOf(text(form, 'kind'), ['PHYSICAL', 'CHEMICAL', 'BIOLOGICAL'] as const) as EvidenceKind;
    const outcome = oneOf(text(form, 'outcome'), ['PASS', 'FAIL'] as const);
    await recordEvidence(actor, {
      loadCode: text(form, 'loadCode'),
      kind,
      outcome,
      source: text(form, 'source'),
      occurredAt: occurredAt(form, actor),
      backdateReason: text(form, 'backdateReason'),
    });
    return outcome === 'PASS' ? 'Hasil memenuhi dicatat.' : 'Hasil tidak memenuhi dicatat.';
  });

export const decisionAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const decision = oneOf(text(form, 'decision'), ['RELEASE', 'HOLD', 'REJECT', 'RESUME'] as const) as Decision;
    const loadCode = text(form, 'loadCode');
    await decideQuality(actor, { loadCode, decision, reason: text(form, 'reason'), expectedVersion: int(form, 'version') });
    const done: Record<Decision, string> = {
      RELEASE: `Batch ${loadCode} dilepas. Paket masuk stok steril.`,
      HOLD: `Batch ${loadCode} ditahan. Paket keluar dari stok tersedia.`,
      REJECT: `Batch ${loadCode} ditolak. Paket harus diproses ulang.`,
      RESUME: `Penahanan batch ${loadCode} dicabut. Batch kembali menunggu keputusan.`,
    };
    return done[decision];
  });

// ---------- Permintaan, stok, distribusi ----------

export const createRequestAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const neededBy = text(form, 'neededBy');
    const created = await createRequest(actor, {
      setTemplateId: text(form, 'setTemplateId'),
      quantity: int(form, 'quantity'),
      priority: oneOf(text(form, 'priority'), ['ROUTINE', 'URGENT'] as const),
      neededBy: neededBy ? fromFacilityLocal(neededBy, actor.timeZone) : new Date(Number.NaN),
      note: text(form, 'note'),
    });
    return `Permintaan ${created.code} dikirim ke CSSD.`;
  });

export const cancelRequestAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const requestCode = text(form, 'requestCode');
    await cancelRequest(actor, { requestCode, reason: text(form, 'reason'), expectedVersion: int(form, 'version') });
    return `Permintaan ${requestCode} dibatalkan.`;
  });

export const moveStockAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const packageCodes = codes(form, 'packageCodes');
    await movePackages(actor, { locationId: text(form, 'locationId'), packageCodes });
    return `${packageCodes.length} paket dipindah rak.`;
  });

export const pullExpiredAction: Action = async () =>
  run(async (actor) => `${await pullExpired(actor)} paket kedaluwarsa ditarik untuk diproses ulang.`);

export const dispatchAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const created = await dispatchPackages(actor, {
      destinationUnitId: text(form, 'destinationUnitId'),
      packageCodes: codes(form, 'packageCodes'),
      requestCode: text(form, 'requestCode') || null,
    });
    return `Serah terima ${created.code} dibuat. Unit tujuan mengonfirmasi tiap paket.`;
  });

export const acknowledgeAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const outcome = oneOf(text(form, 'outcome'), ['RECEIVED', 'REJECTED'] as const);
    const packageCode = text(form, 'packageCode');
    await acknowledgePackage(actor, { handoverCode: text(form, 'handoverCode'), packageCode, outcome, note: text(form, 'note') });
    return outcome === 'RECEIVED' ? `Paket ${packageCode} diterima.` : `Paket ${packageCode} ditolak dan kembali ke CSSD.`;
  });

export const usageAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const packageCode = text(form, 'packageCode');
    await recordUsage(actor, { handoverCode: text(form, 'handoverCode'), packageCode });
    return `Paket ${packageCode} dicatat digunakan.`;
  });

// ---------- Recall ----------

export const openRecallAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const created = await openRecall(actor, { loadCode: text(form, 'loadCode'), reason: text(form, 'reason') });
    return `Recall ${created.code} dibuka. Semua paket batch ini diblokir.`;
  });

export const recallItemAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const status = oneOf(text(form, 'status'), ['RECOVERED', 'USED', 'NOT_FOUND'] as const);
    const packageCode = text(form, 'packageCode');
    await updateRecallItem(actor, { recallCode: text(form, 'recallCode'), packageCode, status, note: text(form, 'note') });
    return `Tindak lanjut paket ${packageCode} disimpan.`;
  });

export const closeRecallAction: Action = async (_previous, form) =>
  run(async (actor) => {
    const recallCode = text(form, 'recallCode');
    await closeRecall(actor, { recallCode, capa: text(form, 'capa') });
    return `Recall ${recallCode} ditutup dengan CAPA tercatat.`;
  });

// Dipakai halaman master untuk memastikan pilihan unit valid tanpa query ulang di komponen klien.
export async function activeUnits(facilityId: string) {
  return prisma.unit.findMany({ where: { facilityId, active: true }, orderBy: { code: 'asc' } });
}
