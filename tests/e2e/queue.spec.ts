import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, loginAs } from './helpers';

test.beforeEach(async ({ context }) => {
  await loginAs(context, 'REVIEWER');
});

test('antrean sesuai fixture: 10 baris, tab terhitung, BT-0021 terpilih', async ({ page }) => {
  await page.goto('/cssd');
  await expect(page.getByRole('heading', { level: 1, name: 'Antrean Kerja' })).toBeVisible();
  const rows = page.locator('.queue-table tbody tr');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('BT-0021');
  await expect(rows.last()).toContainText('BT-0012');

  const tabs = page.getByRole('navigation', { name: 'Tahap antrean' });
  await expect(tabs.getByRole('link', { name: /Semua\s*12/ })).toBeVisible();
  await expect(tabs.getByRole('link', { name: /Menunggu Verifikasi\s*3/ })).toBeVisible();

  const panel = page.getByRole('complementary', { name: /BT-0021/ });
  await expect(panel.getByText('Hasil indikator biologis yang diwajibkan profil ini belum tercatat.')).toBeVisible();
  await expect(page.getByText('Data latihan').first()).toBeVisible();
  await expect(page.getByText('3 batch menunggu keputusan mutu')).toBeVisible();
});

test('memilih batch memperbarui panel dan URL; tab dan halaman bekerja', async ({ page }) => {
  await page.goto('/cssd');
  await page.getByRole('link', { name: /Batch BT-0018/ }).click();
  await expect(page).toHaveURL(/batch=BT-0018/);
  await expect(page.getByRole('complementary', { name: /BT-0018/ })).toContainText('Siklus sterilisasi sedang berjalan');

  await page
    .getByRole('navigation', { name: 'Tahap antrean' })
    .getByRole('link', { name: /Selesai/ })
    .click();
  await expect(page).toHaveURL(/tab=DONE/);
  await expect(page.locator('.queue-table tbody tr')).toHaveCount(3);

  await page.goto('/cssd');
  await page.getByRole('link', { name: 'Halaman 2' }).click();
  await expect(page.locator('.queue-table tbody tr')).toHaveCount(2);
});

test('pencarian tanpa hasil menampilkan keadaan kosong dengan Hapus filter', async ({ page }) => {
  await page.goto('/cssd');
  await page.getByRole('searchbox', { name: 'Cari batch, set, atau unit' }).fill('tidak-ada-yang-cocok');
  await page.getByRole('button', { name: 'Terapkan pencarian dan filter' }).click();
  await expect(page.getByRole('heading', { name: 'Tidak ada batch untuk filter ini' })).toBeVisible();
  await page.getByRole('link', { name: 'Hapus filter' }).first().click();
  await expect(page.locator('.queue-table tbody tr')).toHaveCount(10);
});

test('pindai kode: kode tak dikenal memberi pesan, kode paket membuka batch-nya', async ({ page }) => {
  await page.goto('/cssd');
  await page.getByRole('button', { name: 'Pindai kode' }).click();
  const input = page.getByLabel('Kode batch atau paket');
  await expect(input).toBeFocused();
  await input.fill('BT-9999');
  await input.press('Enter');
  await expect(page.getByRole('dialog')).toContainText('Kode BT-9999 tidak ditemukan di fasilitas ini');

  await input.fill('pk-0047');
  await input.press('Enter');
  await expect(page).toHaveURL(/batch=BT-0021/);
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Pindai kode' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('antrean muat dalam satu layar acuan 1586 x 992', async ({ page }) => {
  await page.goto('/cssd?batch=BT-0021');
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThanOrEqual(992);
  await expect(page).toHaveScreenshot('antrean-1586.png', { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test('aksesibilitas antrean dan detail batch', async ({ page }) => {
  await page.goto('/cssd');
  await expectAccessible(page);
  await page.goto('/cssd/batches/BT-0021');
  await expectAccessible(page);
});

for (const width of [1440, 1280, 1024, 390]) {
  test(`reflow ${width} px tanpa gulir mendatar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/cssd');
    await expectNoHorizontalScroll(page);
    if (width === 390) {
      await page.getByRole('link', { name: /Batch BT-0021/ }).click();
      await expect(page.getByRole('link', { name: 'Kembali ke antrean' })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });
}

test('peran unit tidak bisa membuka antrean CSSD dan diarahkan ke distribusi', async ({ page, context }) => {
  await loginAs(context, 'UNIT');
  await page.goto('/cssd');
  await expect(page).toHaveURL(/\/cssd\/distributions$/);
  await page.goto('/cssd/batches/BT-0021');
  await expect(page.getByRole('heading', { name: 'Halaman ini bukan untuk peran Anda' })).toBeVisible();
});
