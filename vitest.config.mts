import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup-db.ts'],
    // Tes tidak menyalakan backup otomatis; rate limit login dilonggarkan untuk banyak masuk berturut-turut.
    env: { CSSD_DISABLE_AUTO_BACKUP: '1', CSSD_LOGIN_RATE_MAX: '1000', CSSD_SECRET_FILE: 'prisma/test-auth-secret' },
    fileParallelism: false,
  },
});
