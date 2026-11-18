import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';

export const TEMPLATE_DB = 'prisma/test-template.db';
// Hanya untuk database tes yang dibuang setelah tes selesai.
export const TEST_PASSWORD = 'LatihanTes2026';

function removeTestDatabases() {
  for (const name of readdirSync('prisma')) {
    if (name.startsWith('test-')) rmSync(`prisma/${name}`, { force: true });
  }
}

// Bangun satu database templat dari migrasi yang sama dengan production, lalu
// isi data latihan. Setiap file tes menyalinnya (tests/integration/setup-db.ts).
export default function setup() {
  removeTestDatabases();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: `file:./${TEMPLATE_DB}`,
    NODE_ENV: 'test',
    CSSD_TRAINING_PASSWORD: TEST_PASSWORD,
  };
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const options = { env, stdio: 'pipe' as const, shell: process.platform === 'win32' };
  execFileSync(pnpm, ['exec', 'prisma', 'migrate', 'deploy'], options);
  execFileSync(pnpm, ['exec', 'tsx', 'prisma/seed-training.ts'], options);
  return removeTestDatabases;
}
