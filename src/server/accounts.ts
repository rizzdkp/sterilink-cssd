// Akun pengguna dan pemasangan pertama. Kata sandi di-hash oleh Better Auth
// (scrypt); aplikasi tidak pernah menyimpan atau mencatat kata sandi asli.
import { randomUUID } from 'node:crypto';
import { auth } from './auth';
import { prisma } from './db';
import { ROLES, can, isRoleKey, type Actor, type RoleKey } from './identity';
import { DomainError } from './workflow';

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const TIME_ZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const;
export type FacilityTimeZone = (typeof TIME_ZONES)[number];
export const FACILITY_TIME_ZONES = TIME_ZONES;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** Kebijakan kata sandi: 10 sampai 128 karakter, ada huruf dan angka, bukan username. */
export function passwordProblem(password: string, username: string): string | null {
  if (password.length < 10) return 'Kata sandi minimal 10 karakter.';
  if (password.length > 128) return 'Kata sandi maksimal 128 karakter.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Kata sandi harus memuat huruf dan angka.';
  if (password.toLowerCase().includes(username.toLowerCase())) return 'Kata sandi tidak boleh memuat username.';
  return null;
}

function requireText(value: string, min: number, max: number, message: string): string {
  const text = value.trim();
  if (text.length < min || text.length > max) throw new DomainError('CSSD_VALIDATION', message);
  return text;
}

async function hashPassword(password: string): Promise<string> {
  const context = await auth.$context;
  return context.password.hash(password);
}

interface NewAccount {
  name: string;
  username: string;
  password: string;
  role: RoleKey;
  unitId: string | null;
}

async function validateAccount(facilityId: string, input: NewAccount) {
  const name = requireText(input.name, 3, 80, 'Nama lengkap 3 sampai 80 karakter.');
  const username = normalizeUsername(input.username);
  if (!USERNAME.test(username)) {
    throw new DomainError('CSSD_VALIDATION', 'Username 3 sampai 32 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung.');
  }
  const problem = passwordProblem(input.password, username);
  if (problem) throw new DomainError('CSSD_VALIDATION', problem);
  if (input.role === 'UNIT' && !input.unitId) throw new DomainError('CSSD_VALIDATION', 'Petugas unit harus diikat ke satu unit.');
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, facilityId, active: true } });
    if (!unit) throw new DomainError('CSSD_VALIDATION', 'Pilih unit yang aktif.');
  }
  if (await prisma.user.findUnique({ where: { username } })) {
    throw new DomainError('CSSD_INVALID_STATE', `Username ${username} sudah dipakai.`);
  }
  return { name, username };
}

/** Pemasangan pertama: fasilitas dan admin pertama. Hanya bisa sekali. */
export async function installFacility(input: {
  facilityCode: string;
  facilityName: string;
  timeZone: string;
  adminName: string;
  adminUsername: string;
  adminPassword: string;
}) {
  const code = input.facilityCode.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(code)) throw new DomainError('CSSD_VALIDATION', 'Kode fasilitas 2 sampai 20 karakter: huruf, angka dan tanda hubung.');
  const facilityName = requireText(input.facilityName, 3, 120, 'Nama fasilitas 3 sampai 120 karakter.');
  if (!(TIME_ZONES as readonly string[]).includes(input.timeZone)) throw new DomainError('CSSD_VALIDATION', 'Pilih zona waktu fasilitas.');
  const account: NewAccount = { name: input.adminName, username: input.adminUsername, password: input.adminPassword, role: 'ADMIN', unitId: null };
  const { name, username } = await validateAccount('', account);
  const passwordHash = await hashPassword(input.adminPassword);

  return prisma.$transaction(async (tx) => {
    // Diperiksa di dalam transaksi: dua permintaan pemasangan bersamaan, hanya satu menang.
    if ((await tx.facility.count()) > 0) throw new DomainError('CSSD_INVALID_STATE', 'Aplikasi sudah dipasang. Masuk dengan akun yang ada.');
    const facility = await tx.facility.create({ data: { code, name: facilityName, timeZone: input.timeZone } });
    const userId = randomUUID();
    await tx.user.create({
      data: {
        id: userId,
        name,
        username,
        displayUsername: username,
        email: `${username}@${code.toLowerCase()}.cssd.invalid`,
        emailVerified: true,
        role: 'ADMIN',
        facilityId: facility.id,
        // Admin pertama memilih sandinya sendiri di wizard, jadi tidak perlu diganti lagi.
        mustChangePassword: false,
      },
    });
    await tx.account.create({ data: { id: randomUUID(), userId, accountId: userId, providerId: 'credential', password: passwordHash } });
    await tx.auditEvent.create({
      data: {
        facilityId: facility.id,
        actorId: userId,
        actorName: name,
        actorRole: ROLES.ADMIN.label,
        action: 'Aplikasi dipasang',
        entityType: 'FACILITY',
        entityCode: code,
        related: ` ${code} ${username} `,
        detail: `${facilityName}, zona ${input.timeZone}. Admin pertama: ${username}.`,
      },
    });
    return facility;
  });
}

function requireUserManager(actor: Actor) {
  if (!can(actor, 'user:manage')) throw new DomainError('CSSD_FORBIDDEN', 'Hanya admin yang dapat mengelola akun.');
}

async function auditAccount(actor: Actor, action: string, username: string, detail?: string) {
  await prisma.auditEvent.create({
    data: {
      facilityId: actor.facilityId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.roleLabel,
      action,
      entityType: 'USER',
      entityCode: username,
      related: ` ${username} `,
      detail,
    },
  });
}

export async function createAccount(actor: Actor, input: { name: string; username: string; password: string; role: string; unitId: string }) {
  requireUserManager(actor);
  if (!isRoleKey(input.role)) throw new DomainError('CSSD_VALIDATION', 'Pilih peran.');
  const unitId = input.role === 'UNIT' ? input.unitId || null : null;
  const account: NewAccount = { name: input.name, username: input.username, password: input.password, role: input.role, unitId };
  const { name, username } = await validateAccount(actor.facilityId, account);
  const passwordHash = await hashPassword(input.password);
  const userId = randomUUID();
  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        name,
        username,
        displayUsername: username,
        email: `${username}@${actor.facilityId.slice(0, 8)}.cssd.invalid`,
        emailVerified: true,
        role: input.role,
        facilityId: actor.facilityId,
        unitId,
        mustChangePassword: true,
      },
    }),
    prisma.account.create({ data: { id: randomUUID(), userId, accountId: userId, providerId: 'credential', password: passwordHash } }),
    prisma.auditEvent.create({
      data: {
        facilityId: actor.facilityId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.roleLabel,
        action: 'Akun dibuat',
        entityType: 'USER',
        entityCode: username,
        related: ` ${username} `,
        detail: `${name}, peran ${ROLES[input.role].label}. Wajib ganti kata sandi saat masuk pertama.`,
      },
    }),
  ]);
  return username;
}

async function findManagedUser(actor: Actor, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, facilityId: actor.facilityId } });
  if (!user) throw new DomainError('CSSD_NOT_FOUND', 'Akun tidak ditemukan.');
  return user;
}

async function activeAdminCount(facilityId: string) {
  return prisma.user.count({ where: { facilityId, role: 'ADMIN', active: true } });
}

export async function updateAccount(actor: Actor, input: { userId: string; role: string; unitId: string; active: boolean }) {
  requireUserManager(actor);
  const user = await findManagedUser(actor, input.userId);
  if (!isRoleKey(input.role)) throw new DomainError('CSSD_VALIDATION', 'Pilih peran.');
  const unitId = input.role === 'UNIT' ? input.unitId || null : null;
  if (input.role === 'UNIT' && !unitId) throw new DomainError('CSSD_VALIDATION', 'Petugas unit harus diikat ke satu unit.');
  if (unitId && !(await prisma.unit.findFirst({ where: { id: unitId, facilityId: actor.facilityId } }))) {
    throw new DomainError('CSSD_VALIDATION', 'Pilih unit yang valid.');
  }
  const losesAdmin = user.role === 'ADMIN' && user.active && (input.role !== 'ADMIN' || !input.active);
  if (losesAdmin && (await activeAdminCount(actor.facilityId)) <= 1) {
    throw new DomainError('CSSD_INVALID_STATE', 'Harus ada minimal satu admin aktif. Jadikan akun lain admin lebih dulu.');
  }
  if (user.id === actor.id && !input.active) throw new DomainError('CSSD_INVALID_STATE', 'Anda tidak dapat menonaktifkan akun sendiri.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: input.role, unitId, active: input.active } });
    // Perubahan peran atau penonaktifan berlaku seketika: sesi lama dicabut.
    if (user.role !== input.role || user.unitId !== unitId || !input.active) {
      await tx.session.deleteMany({ where: { userId: user.id } });
    }
  });
  const changes = [
    user.role !== input.role ? `peran ${ROLES[user.role as RoleKey]?.label ?? user.role} menjadi ${ROLES[input.role].label}` : null,
    user.active !== input.active ? (input.active ? 'diaktifkan' : 'dinonaktifkan') : null,
    user.unitId !== unitId ? 'unit diubah' : null,
  ].filter(Boolean);
  await auditAccount(actor, 'Akun diubah', user.username ?? user.email, changes.join(', ') || 'Tanpa perubahan');
}

export async function resetPassword(actor: Actor, input: { userId: string; password: string }) {
  requireUserManager(actor);
  const user = await findManagedUser(actor, input.userId);
  const problem = passwordProblem(input.password, user.username ?? '');
  if (problem) throw new DomainError('CSSD_VALIDATION', problem);
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.account.updateMany({ where: { userId: user.id, providerId: 'credential' }, data: { password: passwordHash } }),
    prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await auditAccount(actor, 'Kata sandi diatur ulang', user.username ?? user.email, 'Pengguna wajib menggantinya saat masuk berikutnya.');
}

/** Tandai kata sandi sudah diganti pemiliknya (dipanggil setelah Better Auth mengganti sandi). */
export async function markPasswordChanged(actor: Actor) {
  await prisma.user.update({ where: { id: actor.id }, data: { mustChangePassword: false } });
  await auditAccount(actor, 'Kata sandi diganti pemilik', actor.username);
}

export async function recordLogin(userId: string, outcome: 'Masuk' | 'Keluar') {
  const actor = await import('./identity').then((module) => module.actorFromUserId(userId));
  if (actor) await auditAccount(actor, outcome, actor.username);
}
