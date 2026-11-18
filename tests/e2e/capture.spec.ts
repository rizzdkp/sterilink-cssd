// Tangkapan layar untuk tinjauan desain (.impeccable/review). Hanya berjalan bila
// CAPTURE=1, supaya tidak memperlambat rangkaian tes biasa.
import { test, type Page } from '@playwright/test';
import { loginAs } from './helpers';

test.skip(!process.env.CAPTURE, 'Setel CAPTURE=1 untuk mengambil tangkapan layar tinjauan.');

const DIR = '.impeccable/review';

// Tunggu konten nyata (bukan kerangka muat) sebelum memotret.
async function shot(page: Page, path: string) {
  await page.locator('h1').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DIR}/${path}`, fullPage: true });
}

test('tangkapan layar tinjauan', async ({ page, context }) => {
  await page.goto('/login');
  await shot(page, 'login.png');

  await loginAs(context, 'REVIEWER');
  await page.goto('/cssd?batch=BT-0021');
  await shot(page, 'desktop.png');
  await page.goto('/cssd/batches/BT-0021');
  await shot(page, 'batch-desktop.png');

  await loginAs(context, 'ADMIN');
  for (const [path, name] of [
    ['/cssd/admin', 'admin-desktop.png'],
    ['/cssd/admin/users', 'admin-users-desktop.png'],
    ['/cssd/admin/sets', 'admin-sets-desktop.png'],
    ['/cssd/admin/locations', 'admin-places-desktop.png'],
    ['/cssd/admin/backup', 'admin-backup-desktop.png'],
  ] as const) {
    await page.goto(path);
    await shot(page, name);
  }

  await loginAs(context, 'UNIT');
  await page.goto('/cssd/requests');
  await shot(page, 'requests-desktop.png');

  await loginAs(context, 'WAREHOUSE');
  await page.goto('/cssd/stock');
  await shot(page, 'stock-desktop.png');

  await loginAs(context, 'SUPERVISOR');
  await page.goto('/cssd/reports');
  await shot(page, 'reports-desktop.png');

  await loginAs(context, 'RECEIVING');
  await page.goto('/cssd/receiving');
  await shot(page, 'receiving-desktop.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(context, 'REVIEWER');
  await page.goto('/cssd');
  await shot(page, 'mobile.png');
  await page.goto('/cssd?batch=BT-0021');
  await shot(page, 'mobile-detail.png');
  await loginAs(context, 'ADMIN');
  await page.goto('/cssd/admin/users');
  await shot(page, 'mobile-admin-users.png');
});
