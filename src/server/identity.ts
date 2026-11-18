import { prisma } from './db';

export type Capability =
  | 'queue:read'
  | 'batch:read'
  | 'evidence:read'
  | 'trace:read'
  | 'stock:read'
  | 'stock:manage'
  | 'handover:read'
  | 'request:read'
  | 'request:create'
  | 'case:receive'
  | 'case:clean'
  | 'case:inspect'
  | 'package:create'
  | 'load:manage'
  | 'evidence:record'
  | 'quality:decide'
  | 'handover:create'
  | 'handover:ack'
  | 'recall:manage'
  | 'report:read'
  | 'audit:read'
  | 'master:manage'
  | 'user:manage'
  | 'backup:manage';

export const ROLE_KEYS = ['RECEIVING', 'PACKING', 'MACHINE', 'REVIEWER', 'WAREHOUSE', 'UNIT', 'SUPERVISOR', 'AUDITOR', 'ADMIN'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const STAFF_READ: Capability[] = ['queue:read', 'batch:read', 'evidence:read', 'trace:read', 'stock:read', 'handover:read', 'request:read'];
const OVERSIGHT: Capability[] = [...STAFF_READ, 'report:read', 'audit:read'];

// Kapabilitas eksplisit per peran (PRD-MASTER bagian 4). Admin mengelola
// master dan akun, tetapi tidak memproses atau melepas paket.
export const ROLES: Record<RoleKey, { label: string; station: string; capabilities: Capability[] }> = {
  RECEIVING: { label: 'Operator Penerimaan', station: 'Zona Kotor', capabilities: [...STAFF_READ, 'case:receive', 'case:clean'] },
  PACKING: { label: 'Operator Pengemasan', station: 'Zona Bersih', capabilities: [...STAFF_READ, 'case:inspect', 'package:create'] },
  MACHINE: { label: 'Operator Mesin', station: 'Ruang Sterilisasi', capabilities: [...STAFF_READ, 'load:manage', 'evidence:record'] },
  REVIEWER: { label: 'Reviewer Mutu', station: 'Stasiun Verifikasi', capabilities: [...STAFF_READ, 'evidence:record', 'quality:decide'] },
  WAREHOUSE: { label: 'Petugas Distribusi', station: 'Gudang Steril', capabilities: [...STAFF_READ, 'handover:create', 'stock:manage'] },
  UNIT: {
    label: 'Petugas Unit',
    station: 'Unit pengguna',
    capabilities: ['handover:read', 'handover:ack', 'request:read', 'request:create'],
  },
  SUPERVISOR: { label: 'Supervisor CSSD', station: 'Supervisi dan PPI', capabilities: [...OVERSIGHT, 'recall:manage'] },
  AUDITOR: { label: 'Auditor', station: 'Audit mutu', capabilities: OVERSIGHT },
  ADMIN: { label: 'Admin CSSD', station: 'Administrasi', capabilities: [...OVERSIGHT, 'master:manage', 'user:manage', 'backup:manage'] },
};

export interface Actor {
  id: string;
  name: string;
  username: string;
  role: RoleKey;
  roleLabel: string;
  stationLabel: string;
  facilityId: string;
  facilityName: string;
  timeZone: string;
  // Terisi untuk petugas unit: permintaan dan serah terima hanya untuk unit ini.
  unitId: string | null;
  unitCode: string | null;
  capabilities: readonly Capability[];
  mustChangePassword: boolean;
}

export function isRoleKey(value: unknown): value is RoleKey {
  return typeof value === 'string' && (ROLE_KEYS as readonly string[]).includes(value);
}

/** Bangun pelaku dari baris akun. Null bila akun tidak lengkap atau nonaktif. */
export async function actorFromUserId(userId: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { facility: true, unit: true },
  });
  if (!user || !user.active || !user.facility || !isRoleKey(user.role)) return null;
  // Petugas unit tanpa unit tidak punya lingkup kerja yang sah.
  if (user.role === 'UNIT' && !user.unit) return null;
  const definition = ROLES[user.role];
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? user.email,
    role: user.role,
    roleLabel: definition.label,
    stationLabel: user.unit ? `${definition.station} ${user.unit.code}`.replace('Unit pengguna ', 'Unit ') : definition.station,
    facilityId: user.facility.id,
    facilityName: user.facility.name,
    timeZone: user.facility.timeZone,
    unitId: user.unit?.id ?? null,
    unitCode: user.unit?.code ?? null,
    capabilities: definition.capabilities,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Pelaku permintaan saat ini dari sesi Better Auth, atau null bila belum masuk. */
export async function getActor(): Promise<Actor | null> {
  const [{ headers }, { auth }] = await Promise.all([import('next/headers'), import('./auth')]);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return actorFromUserId(session.user.id);
}

export function can(actor: Actor, capability: Capability): boolean {
  return actor.capabilities.includes(capability);
}

/** Sudah ada fasilitas dan admin? Bila belum, aplikasi membuka wizard pemasangan. */
export async function isInstalled(): Promise<boolean> {
  return (await prisma.facility.count()) > 0;
}
