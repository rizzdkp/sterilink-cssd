// Alur lengkap lewat antarmuka dengan akun sungguhan, satu peran per langkah:
// permintaan unit, terima tray, dekontaminasi, inspeksi per komponen, kemas, label,
// muat, siklus, bukti, lepas, kirim memenuhi permintaan, unit menerima, digunakan,
// lalu recall dan CAPA.
import { expect, test } from '@playwright/test';
import { codeFrom, expectAccessible, expectSaved, loginAs, rejection } from './helpers';

test.describe.configure({ mode: 'serial' });

let requestCode = '';
let packageCode = '';
let batchCode = '';
let recallCode = '';

test('petugas unit OK meminta set', async ({ page, context }) => {
  await loginAs(context, 'UNIT');
  await page.goto('/cssd/requests');
  await expectAccessible(page);
  await page.getByLabel('Jenis set').selectOption({ label: 'Set Bedah Mayor' });
  await page.getByLabel('Jumlah set').fill('1');
  await page.getByLabel('Prioritas').selectOption({ label: 'Mendesak' });
  await page.getByRole('button', { name: 'Kirim permintaan' }).click();
  requestCode = await codeFrom(page, /Permintaan (RQ-\d+) dikirim/);
});

test('operator penerimaan menerima tray dan mencatat dekontaminasi', async ({ page, context }) => {
  await loginAs(context, 'RECEIVING');
  await page.goto('/cssd/receiving');
  await expectAccessible(page);

  // Jumlah berbeda tanpa catatan ditolak, dan isian tetap ada untuk dikoreksi.
  await page.getByLabel('Kode tray').fill('TR-0060');
  await page.getByLabel('Unit asal').selectOption({ label: 'OK (Instalasi Bedah Sentral)' });
  await page.getByLabel('Jumlah komponen aktual').fill('14');
  await page.getByRole('button', { name: 'Catat penerimaan' }).click();
  await expect(rejection(page)).toContainText('berbeda dari harapan 15');
  await expect(page.getByLabel('Kode tray')).toHaveValue('TR-0060');

  await page.getByLabel('Jumlah komponen aktual').fill('15');
  await page.getByRole('button', { name: 'Catat penerimaan' }).click();
  expect(await codeFrom(page, /kasus (KS-\d+)/)).toBe('KS-0001');

  await page.getByRole('button', { name: 'Dekontaminasi lulus' }).click();
  await expectSaved(page, 'lanjut ke inspeksi');
});

test('operator pengemasan menginspeksi per komponen, mengemas, dan mencetak label', async ({ page, context }) => {
  await loginAs(context, 'PACKING');
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.goto('/cssd/receiving');

  // Komponen rusak tanpa catatan ditolak dengan nama komponennya.
  await page.getByLabel('Kondisi Needle holder').selectOption({ label: 'Rusak' });
  await page.getByRole('button', { name: 'Simpan hasil inspeksi' }).click();
  await expect(rejection(page)).toContainText('Needle holder');
  await page.getByLabel('Kondisi Needle holder').selectOption({ label: 'Baik' });
  await page.getByRole('button', { name: 'Simpan hasil inspeksi' }).click();
  await expectSaved(page, 'siap dikemas');

  await page.getByLabel('Lot kemasan').fill('LOT-E2E-01');
  await page.getByRole('button', { name: 'Buat paket' }).click();
  packageCode = await codeFrom(page, /Paket (PK-\d+) dibuat/);

  await page.getByRole('link', { name: 'Cetak label' }).click();
  await expect(page.getByRole('img', { name: `Barcode ${packageCode}` })).toBeVisible();
  await page.getByRole('button', { name: 'Cetak label' }).click();
  await expect(page.getByText('Sudah dicetak 1 kali.')).toBeVisible();
});

test('operator mesin menyusun muatan, menjalankan siklus, dan mencatat bukti', async ({ page, context }) => {
  await loginAs(context, 'MACHINE');
  await page.goto('/cssd/batches');
  await page.getByLabel('Mesin').selectOption({ label: 'UAP-01 (Uap)' });
  await page.getByRole('checkbox', { name: new RegExp(packageCode) }).check();
  await page.getByRole('button', { name: 'Susun muatan' }).click();
  batchCode = await codeFrom(page, /Muatan (BT-\d+) disusun/);

  await page.getByRole('link', { name: batchCode }).click();
  await page.getByRole('button', { name: 'Mulai siklus' }).click();
  await expectSaved(page, 'Siklus dimulai.');
  await page.getByRole('button', { name: 'Catat siklus selesai' }).click();
  await expectSaved(page, 'Siklus selesai.');

  const forms = page.locator('.evidence-forms form');
  await expect(forms).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    const form = forms.nth(index);
    await form.getByLabel('Sumber hasil').fill('Catatan mesin');
    await form.getByRole('button', { name: 'Memenuhi', exact: true }).click();
    await expect(form.locator('.tag')).toHaveText('Memenuhi');
  }
  await expect(page.getByRole('button', { name: 'Setujui pelepasan' })).toHaveCount(0);
});

test('reviewer tidak bisa melepas BT-0021 lalu melepas batch baru', async ({ page, context }) => {
  await loginAs(context, 'REVIEWER');
  await page.goto('/cssd/batches/BT-0021');
  await expect(page.getByRole('note')).toContainText('Belum bisa dilepas: Hasil indikator biologis belum tercatat.');
  await page.goto(`/cssd/batches/${batchCode}`);
  await page.getByRole('button', { name: 'Setujui pelepasan' }).click();
  await expectSaved(page, `Batch ${batchCode} dilepas`);
});

test('petugas distribusi memenuhi permintaan unit dari stok', async ({ page, context }) => {
  await loginAs(context, 'WAREHOUSE');
  await page.goto('/cssd/requests');
  await page.locator('.admin-row').filter({ hasText: requestCode }).getByRole('link', { name: 'Penuhi dari stok' }).click();
  await expect(page.getByText(`Memenuhi ${requestCode}`)).toBeVisible();
  await page.getByRole('checkbox', { name: new RegExp(packageCode) }).check();
  await page.getByRole('button', { name: 'Catat pengiriman' }).click();
  await expectSaved(page, /Serah terima ST-\d+ dibuat/);
  await page.goto('/cssd/requests');
  await expect(page.locator('.admin-row').filter({ hasText: requestCode })).toContainText('Terpenuhi');
  await expectAccessible(page);
});

test('petugas unit menerima paket dan mencatat penggunaan', async ({ page, context }) => {
  await loginAs(context, 'UNIT');
  await page.goto('/cssd/distributions');
  await page.locator('.handover__line').filter({ hasText: packageCode }).getByRole('button', { name: 'Terima' }).click();
  await expectSaved(page, `Paket ${packageCode} diterima.`);
  await page.locator('.handover__line').filter({ hasText: packageCode }).getByRole('button', { name: 'Catat digunakan' }).click();
  await expectSaved(page, `Paket ${packageCode} dicatat digunakan.`);
});

test('supervisor menelusuri, membuka recall, menindaklanjuti dan menutupnya', async ({ page, context }) => {
  await loginAs(context, 'SUPERVISOR');
  await page.goto(`/cssd/trace?code=${packageCode}`);
  const trail = page.getByRole('region', { name: `Riwayat ${packageCode}` }).last();
  for (const action of ['Paket dibuat', 'Label dicetak', 'Batch dilepas', 'Paket diterima unit', 'Paket digunakan']) {
    await expect(trail.getByRole('rowheader', { name: action })).toBeVisible();
  }
  await expect(trail).toContainText('Petugas Unit OK Latihan');

  await page.goto(`/cssd/batches/${batchCode}`);
  await page.getByLabel('Sebab recall').fill('Hasil BI terlambat tidak memenuhi');
  await page.getByRole('button', { name: 'Buka recall dan blokir paket' }).click();
  recallCode = await codeFrom(page, /Recall (RC-\d+) dibuka/);

  await page.goto(`/cssd/recalls/${recallCode}`);
  await page.getByRole('button', { name: 'Sudah digunakan' }).click();
  await expect(rejection(page)).toContainText('Tulis tindak lanjut');
  await page.getByLabel('Catatan (wajib selain ditarik)').fill('Eskalasi ke PPI untuk penilaian pasien');
  await page.getByRole('button', { name: 'Sudah digunakan' }).click();
  await expectSaved(page, `Tindak lanjut paket ${packageCode} disimpan.`);
  await page.getByLabel('Tindakan korektif dan pencegahan (CAPA)').fill('Validasi ulang inkubator BI');
  await page.getByRole('button', { name: 'Tutup recall' }).click();
  await expectSaved(page, `Recall ${recallCode} ditutup`);
  await expectAccessible(page);
});
