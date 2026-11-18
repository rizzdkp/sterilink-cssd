// Fungsi produksi: login, akun, master, laporan, audit, backup. Berjalan terakhir
// (nama berawalan zz) karena mengubah data latihan.
import { expect, test } from '@playwright/test';
import { codeFrom, expectAccessible, expectSaved, loginAs, rejection } from './helpers';

test.describe.configure({ mode: 'serial' });

test('tanpa sesi semua halaman CSSD diarahkan ke login, lalu kembali ke tujuan', async ({ page }) => {
  await page.goto('/cssd/stock');
  await expect(page).toHaveURL(/\/login\?next=%2Fcssd%2Fstock/);
  await expectAccessible(page);
  await page.getByLabel('Username').fill('latihan.distribusi');
  await page.getByLabel('Kata sandi').fill('sandi-salah-2026');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(rejection(page)).toHaveText('Username atau kata sandi salah.');
  await page.getByLabel('Kata sandi').fill('LatihanE2E2026');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/cssd\/stock$/);
  await expect(page.getByText('Petugas Distribusi Latihan')).toBeVisible();

  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/cssd');
  await expect(page).toHaveURL(/\/login/);
});

test('wizard pemasangan tertutup setelah aplikasi dipasang', async ({ page }) => {
  await page.goto('/setup');
  await expect(page).toHaveURL(/\/login/);
});

test('admin membuat akun; pengguna baru wajib mengganti kata sandi saat masuk', async ({ page, context }) => {
  await loginAs(context, 'ADMIN');
  await page.goto('/cssd/admin/users');
  await expectAccessible(page);
  const create = page.locator('form').filter({ has: page.getByRole('button', { name: 'Buat akun' }) });
  await create.getByLabel('Nama lengkap').fill('Rina Kusuma');
  await create.getByLabel('Username').fill('rina.kusuma');
  await create.getByLabel('Kata sandi awal (minimal 10, huruf dan angka)').fill('AwalRina2026');
  await create.getByLabel('Peran').selectOption({ label: 'Operator Penerimaan' });
  await create.getByRole('button', { name: 'Buat akun' }).click();
  await expectSaved(page, 'Akun rina.kusuma dibuat');

  await context.clearCookies();
  await page.goto('/login');
  await page.getByLabel('Username').fill('rina.kusuma');
  await page.getByLabel('Kata sandi').fill('AwalRina2026');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('heading', { name: 'Ganti kata sandi awal' })).toBeVisible();
  await page.goto('/cssd/receiving');
  await expect(page).toHaveURL(/\/account\?wajib=1/);

  await page.getByLabel('Kata sandi saat ini').fill('AwalRina2026');
  await page.getByLabel('Kata sandi baru (minimal 10 karakter, huruf dan angka)').fill('RinaPribadi2026');
  await page.getByLabel('Ulangi kata sandi baru').fill('RinaPribadi2026');
  await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();
  await expect(page).toHaveURL(/\/cssd$/);
  await expect(page.getByText('Rina Kusuma')).toBeVisible();
});

test('admin menambah set dengan komponen, mendaftarkan tray, dan mengatur kebijakan', async ({ page, context }) => {
  await loginAs(context, 'ADMIN');
  await page.goto('/cssd/admin/sets');
  await expectAccessible(page);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Tambah set' }) });
  await form.getByLabel('Kode set').fill('SET-HECTING');
  await form.getByLabel('Nama set').fill('Set Hecting');
  await form.getByLabel('Masa simpan steril (hari)').fill('14');
  await form.getByLabel('Nama komponen 1').fill('Needle holder');
  await form.getByRole('button', { name: 'Tambah komponen' }).click();
  await form.getByLabel('Nama komponen 2').fill('Gunting benang');
  await form.getByLabel('Jumlah Gunting benang').fill('2');
  await form.getByRole('button', { name: 'Tambah set' }).click();
  await expectSaved(page, 'Set SET-HECTING disimpan.');
  await expect(page.locator('.admin-row').filter({ hasText: 'SET-HECTING' })).toContainText('2 jenis, 3 buah, masa simpan 14 hari');

  const trayForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Daftarkan tray' }) });
  await trayForm.getByLabel('Kode tray (sesuai label fisik)').fill('TR-HCT-01');
  await trayForm.getByLabel('Jenis set').selectOption({ label: 'Set Hecting' });
  await trayForm.getByLabel('Unit pemilik').selectOption({ label: 'OK' });
  await trayForm.getByRole('button', { name: 'Daftarkan tray' }).click();
  await expectSaved(page, 'Tray TR-HCT-01 didaftarkan.');

  await page.goto('/cssd/admin');
  await expect(page.getByRole('heading', { name: 'Siap dipakai operasional' })).toBeVisible();
  const policy = page.locator('form').filter({ has: page.getByRole('button', { name: 'Simpan kebijakan suhu rendah' }) });
  await policy.getByLabel('Rujukan SOP atau IFU').fill('SOP-CSSD-09 rev 2');
  await policy.getByRole('button', { name: 'Simpan kebijakan suhu rendah' }).click();
  await expectSaved(page, 'Kebijakan bukti disimpan.');
});

test('admin tidak bisa melepas batch; mesin bisa ditandai tidak layak lalu layak', async ({ page, context }) => {
  await loginAs(context, 'ADMIN');
  await page.goto('/cssd/batches/BT-0016');
  await expect(page.getByRole('button', { name: 'Setujui pelepasan' })).toHaveCount(0);
  await page.goto('/cssd/admin/locations');
  await expectAccessible(page);
  const row = page.locator('.handover__line').filter({ hasText: 'UAP-02' });
  await row.getByLabel('Alasan').fill('Kalibrasi tertunda');
  await row.getByRole('button', { name: 'Tandai tidak layak' }).click();
  await expectSaved(page, 'Mesin ditandai tidak layak pakai.');
  await expect(page.getByRole('link', { name: '1 mesin tidak layak pakai' })).toBeVisible();
  const again = page.locator('.handover__line').filter({ hasText: 'UAP-02' });
  await again.getByLabel('Alasan').fill('Kalibrasi selesai');
  await again.getByRole('button', { name: 'Tandai layak pakai' }).click();
  await expectSaved(page, 'Mesin ditandai layak pakai.');
});

test('reviewer menahan batch dengan alasan lalu mencabut penahanan', async ({ page, context }) => {
  await loginAs(context, 'REVIEWER');
  await page.goto('/cssd/batches/BT-0016');
  const holdForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Tahan' }) });
  await holdForm.getByLabel('Alasan tahan atau tolak').fill('Kemasan basah saat diperiksa');
  await holdForm.getByRole('button', { name: 'Tahan' }).click();
  await expectSaved(page, 'Batch BT-0016 ditahan.');
  await page.getByLabel('Dasar keputusan').fill('Dikemas ulang, kemasan kering');
  await page.getByRole('button', { name: 'Cabut penahanan' }).click();
  await expectSaved(page, 'Penahanan batch BT-0016 dicabut.');
});

test('laporan menampilkan rasio dengan penyebut dan ekspor CSV tercatat di audit', async ({ page, context }) => {
  await loginAs(context, 'SUPERVISOR');
  await page.goto('/cssd/reports');
  await expectAccessible(page);
  await expect(page.getByRole('region', { name: 'Ketidaksesuaian' }).last()).toContainText(/\d+ dari \d+/);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Unduh rincian per paket (CSV)' }).click();
  expect((await download).suggestedFilename()).toMatch(/^cssd-turnaround-.*\.csv$/);

  await page.goto('/cssd/audit?code=turnaround');
  await expectAccessible(page);
  await expect(page.getByRole('region', { name: /kejadian/ }).last()).toContainText('Data diekspor');
});

test('auditor membaca audit tetapi tidak bisa membuka Master', async ({ page, context }) => {
  await loginAs(context, 'AUDITOR');
  await page.goto('/cssd/audit');
  await expect(page.getByRole('heading', { level: 1, name: 'Audit' })).toBeVisible();
  await page.goto('/cssd/admin');
  await expect(page.getByRole('heading', { name: 'Halaman ini bukan untuk peran Anda' })).toBeVisible();
});

test('admin membuat backup dan bisa mengunduhnya', async ({ page, context }) => {
  await loginAs(context, 'ADMIN');
  await page.goto('/cssd/admin/backup');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Buat backup' }).click();
  const name = await codeFrom(page, /Backup (cssd-\d{8}-\d{6}-manual\.db) dibuat/);
  const download = page.waitForEvent('download');
  await page.locator('tr').filter({ hasText: name }).getByRole('link', { name: 'Unduh' }).click();
  expect((await download).suggestedFilename()).toBe(name);
});

test('peran tanpa hak tidak bisa mengunduh backup lewat URL', async ({ context }) => {
  await loginAs(context, 'REVIEWER');
  const response = await context.request.get('/api/v1/cssd/backup/cssd-20260101-000000-manual.db');
  expect(response.status()).toBe(403);
});
