import { mkdirSync, readdirSync, realpathSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { prisma } from './db';
import type { Actor } from './identity';
import { DomainError, requireCapability } from './workflow';

// Folder backup di server. Arahkan ke disk lain atau folder yang ikut dicadangkan TI rumah sakit.
export const BACKUP_DIR = resolve(/* turbopackIgnore: true */ process.cwd(), process.env.CSSD_BACKUP_DIR ?? 'backups');
const RETENTION_DAYS = Number(process.env.CSSD_BACKUP_RETENTION_DAYS ?? 14);
export const BACKUP_NAME = /^cssd-\d{8}-\d{6}(-manual)?\.db$/;

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: Date;
}

export function listBackups(): BackupFile[] {
  mkdirSync(BACKUP_DIR, { recursive: true });
  return readdirSync(BACKUP_DIR)
    .filter((name) => BACKUP_NAME.test(name))
    .map((name) => {
      const info = statSync(join(BACKUP_DIR, name));
      return { name, size: info.size, createdAt: info.mtime };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Salinan database yang konsisten (VACUUM INTO) tanpa menghentikan aplikasi.
 * Nama berkas dibuat aplikasi, bukan dari masukan pengguna.
 */
export async function createBackup(kind: 'daily' | 'manual'): Promise<BackupFile> {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const name = `cssd-${stamp(new Date())}${kind === 'manual' ? '-manual' : ''}.db`;
  const target = join(BACKUP_DIR, name);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  pruneBackups();
  const info = statSync(target);
  return { name, size: info.size, createdAt: info.mtime };
}

/** Hapus backup lebih tua dari masa retensi. Hanya berkas berpola backup di dalam folder backup. */
function pruneBackups() {
  const root = realpathSync(BACKUP_DIR);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of listBackups()) {
    const path = realpathSync(join(root, file.name));
    // Target harus berada langsung di folder backup dan bernama sesuai pola aplikasi.
    if (!path.startsWith(root) || !BACKUP_NAME.test(file.name)) continue;
    if (file.createdAt.getTime() < cutoff) unlinkSync(path);
  }
}

/** Backup harian: dibuat bila belum ada backup otomatis untuk tanggal hari ini (UTC). */
export async function ensureDailyBackup(): Promise<BackupFile | null> {
  const today = stamp(new Date()).slice(0, 8);
  if (listBackups().some((file) => file.name.startsWith(`cssd-${today}`) && !file.name.includes('manual'))) return null;
  if ((await prisma.facility.count()) === 0) return null;
  return createBackup('daily');
}

export async function manualBackup(actor: Actor): Promise<BackupFile> {
  requireCapability(actor, 'backup:manage');
  const file = await createBackup('manual');
  await prisma.auditEvent.create({
    data: {
      facilityId: actor.facilityId,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.roleLabel,
      action: 'Backup dibuat',
      entityType: 'BACKUP',
      entityCode: file.name,
      related: ` ${file.name} `,
      detail: `${Math.round(file.size / 1024)} KB.`,
    },
  });
  return file;
}

/** Jalur berkas backup yang aman untuk diunduh, atau galat bila nama tidak sah. */
export function backupPath(name: string): string {
  if (!BACKUP_NAME.test(name)) throw new DomainError('CSSD_NOT_FOUND', 'Berkas backup tidak ditemukan.');
  const path = join(BACKUP_DIR, name);
  try {
    statSync(path);
  } catch {
    throw new DomainError('CSSD_NOT_FOUND', 'Berkas backup tidak ditemukan.');
  }
  return path;
}
