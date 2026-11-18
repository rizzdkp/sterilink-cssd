## Apa yang berubah

<!-- Satu atau dua kalimat. Sebut issue: Closes #... -->

## Requirement PRD

<!-- ID dari CSSD-Master/PRD-MASTER.md, misalnya P-11. Tulis "tidak ada" untuk perubahan non-fungsional. -->

## Cara menguji

<!-- Peran yang dipakai dan langkah singkat di layar, atau nama tes yang membuktikan. -->

## Daftar periksa

- [ ] `pnpm check` lulus di komputer saya
- [ ] Perubahan layar atau alur: `pnpm build` dan `pnpm test:e2e` lulus
- [ ] Aturan baru punya tes integrasi atau E2E
- [ ] Mutasi baru memeriksa kapabilitas, berjalan dalam transaksi, dan menulis audit
- [ ] Tidak ada nilai klinis, data contoh, rahasia, atau berkas database yang ikut ter-commit
- [ ] Dokumen diperbarui bila perilaku berubah (README, PRD-MASTER status)
