import { defineConfig, devices } from '@playwright/test';

const PORT = 3300;
const BASE_URL = `http://localhost:${PORT}`;
// Kata sandi akun latihan di database E2E yang dibuang setelah tes.
export const E2E_PASSWORD = 'LatihanE2E2026';

// E2E memakai build produksi dan database SQLite sendiri (prisma/e2e.db) yang
// dibangun ulang dari migrasi dan data latihan setiap kali tes dijalankan.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1586, height: 992 } } }],
  webServer: {
    command: [
      `node -e "for (const f of ['prisma/e2e.db','prisma/e2e.db-wal','prisma/e2e.db-shm']) require('fs').rmSync(f,{force:true})"`,
      'pnpm exec prisma migrate deploy',
      'pnpm exec tsx prisma/seed-training.ts',
      `pnpm exec next start -p ${PORT}`,
    ].join(' && '),
    url: `${BASE_URL}/api/auth/ok`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: 'file:./prisma/e2e.db',
      BETTER_AUTH_URL: BASE_URL,
      CSSD_TRAINING_PASSWORD: E2E_PASSWORD,
      CSSD_SECRET_FILE: 'prisma/e2e-auth-secret',
      CSSD_BACKUP_DIR: 'test-results/backups',
      CSSD_LOGIN_RATE_MAX: '1000',
    },
  },
});
