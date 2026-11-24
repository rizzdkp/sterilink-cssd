# Cara kerja tim

Proyek ini dikerjakan lima orang. Aturan di sini menjaga dua hal: kode tetap konsisten walau ditulis banyak tangan, dan setiap perubahan tercatat atas username GitHub orang yang mengerjakannya.

Lingkup produk dan status requirement ada di [CSSD-Master/PRD-MASTER.md](CSSD-Master/PRD-MASTER.md). Bila ragu apakah sebuah perubahan termasuk lingkup, cek di sana dulu.

## Persiapan sekali per anggota

1. Pasang Node.js 22 (lihat `.nvmrc`), pnpm 9, Git, dan [GitHub CLI](https://cli.github.com/).
2. Masuk ke GitHub dari terminal, lalu clone:

   ```bash
   gh auth login
   ```

   ```bash
   gh repo clone <pemilik>/sterilink-cssd
   ```

3. **Atur identitas commit agar cocok dengan akun GitHub Anda.** Ini yang membuat log tercatat atas username Anda. Ambil email noreply dari GitHub, Settings, Emails (bentuknya `12345678+username@users.noreply.github.com`):

   ```bash
   git config user.name "username-github-anda"
   ```

   ```bash
   git config user.email "12345678+username@users.noreply.github.com"
   ```

   Commit dengan email yang tidak terhubung ke akun GitHub akan **ditolak CI**, karena GitHub tidak bisa mengaitkannya ke username siapa pun.

4. Pasang dependensi dan siapkan database lokal:

   ```bash
   pnpm install
   ```

   ```bash
   pnpm db:setup
   ```

   `pnpm install` juga mengaktifkan hook git di `.githooks`: format dan lint diperiksa sebelum commit, pesan commit diperiksa saat commit.

5. Muat data latihan bila butuh akun per peran untuk mencoba layar (lihat README bagian Data latihan), lalu `pnpm dev`.

## Alur kerja

```
issue  ->  branch dari main  ->  commit kecil  ->  pull request  ->  CI hijau + 1 review  ->  merge
```

1. Ambil atau buat issue. Satu issue, satu tujuan.
2. Buat branch dari `main` terbaru dengan nama `<tipe>/<ringkas>`, misalnya `feat/reservasi-paket` atau `fix/label-cetak-ulang`.
3. Commit kecil dan sering, masing-masing dengan pesan yang menjelaskan satu perubahan.
4. Sebelum membuka PR, jalankan `pnpm check`. Bila mengubah layar atau alur, jalankan juga `pnpm build` lalu `pnpm test:e2e`.
5. Buka PR ke `main`, isi template, minta review dari pemilik area (tabel di bawah).
6. Setelah CI hijau dan disetujui, merge dengan **Rebase and merge** agar setiap commit tetap tercatat atas penulisnya.

Larangan:

- Push langsung ke `main` (branch dilindungi).
- `git push --force` ke branch milik orang lain, atau menulis ulang commit orang lain.
- Commit atas nama orang lain, atau menggabungkan pekerjaan beberapa orang dalam satu commit tanpa `Co-authored-by`.

Bila mengerjakan bersama dalam satu commit, tambahkan baris di akhir pesan agar kedua orang tercatat:

```
Co-authored-by: Nama Rekan <12345678+username@users.noreply.github.com>
```

## Pesan commit

Format [Conventional Commits](https://www.conventionalcommits.org/), diperiksa hook lokal dan CI:

```
<tipe>(<area opsional>): <ringkasan dalam bahasa Indonesia, maks 100 karakter>
```

| Tipe                   | Dipakai untuk                          |
| ---------------------- | -------------------------------------- |
| `feat`                 | Fungsi baru untuk pengguna             |
| `fix`                  | Perbaikan bug                          |
| `test`                 | Menambah atau memperbaiki tes          |
| `docs`                 | Dokumen saja                           |
| `refactor`             | Merapikan kode tanpa mengubah perilaku |
| `style`                | Tampilan atau format, tanpa logika     |
| `perf`                 | Kinerja                                |
| `build`, `ci`, `chore` | Dependensi, pipeline, pemeliharaan     |

Contoh: `feat(stok): tarik paket kedaluwarsa dari rak`, `fix(label): cetak ulang tidak menambah paket`.

## Pembagian area

Setiap area punya satu pemilik yang menjadi reviewer utama. Semua anggota boleh mengubah area mana pun, tetapi PR yang menyentuh suatu area perlu disetujui pemiliknya.

| Area                     | Lingkup kode                                                                                | Pemilik                           |
| ------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------- |
| A. Platform dan keamanan | `src/server/auth.ts`, `identity.ts`, `accounts.ts`, `backup.ts`, `src/proxy.ts`, `.github/` | @rizzdkp                          |
| B. Data dan alur domain  | `prisma/`, `src/server/workflow.ts`, `master.ts`, `src/server/queue/`                       | @palapip16 (Nouval)               |
| C. Layar operasional     | `src/app/cssd/` antrean, penerimaan, batch, stok, distribusi, permintaan                    | @androoo30 (Leandro)              |
| D. Supervisi dan admin   | `src/app/cssd/admin`, `reports`, `audit`, `trace`, `recalls`, `src/server/reports.ts`       | @ShareMen216 (Faiz)               |
| E. Mutu, tes dan dokumen | `tests/`, `CSSD-Master/`, `README.md`, `DESIGN.md`                                          | anggota ke-5 (sementara @rizzdkp) |

Pemilik dicerminkan di `.github/CODEOWNERS`, sehingga GitHub otomatis meminta review pemilik area yang tersentuh PR. Pembagian bisa diubah lewat PR yang memperbarui tabel ini dan CODEOWNERS sekaligus.

## Aturan kode

Supaya hasilnya terasa ditulis satu orang:

- **Format dan lint tidak diperdebatkan.** Prettier dan ESLint yang memutuskan. Jalankan `pnpm format` dan `pnpm lint:fix`; jangan menonaktifkan aturan tanpa alasan tertulis di PR.
- **Aturan bisnis hanya di `src/server`.** Halaman dan komponen memanggil Server Action atau fungsi query; mereka tidak menulis ke database langsung.
- **Setiap mutasi:** periksa kapabilitas dengan `requireCapability`, jalankan di dalam `prisma.$transaction`, tulis `audit()` di transaksi yang sama, dan pakai `expectedVersion` untuk entitas yang bisa diubah bersamaan.
- **Tidak ada nilai klinis di kode.** Masa simpan, indikator wajib, isi set, unit dan mesin datang dari Master. Bila belum dikonfigurasi, tolak dengan pesan yang menyebut apa yang harus diisi.
- **Tidak ada data contoh di jalur produksi.** Data latihan hanya lewat `pnpm db:seed:training`.
- **Setiap perubahan perilaku disertai tes.** Aturan domain di `tests/integration`, alur layar di `tests/e2e`. Bug diperbaiki dengan tes yang gagal dulu.
- **Tampilan mengikuti [DESIGN.md](DESIGN.md):** token warna dan jarak yang ada, ikon Phosphor, label status berupa teks (bukan warna saja), target sentuh 44 px.
- **Bahasa:** teks antarmuka, pesan galat, komentar dan pesan commit dalam bahasa Indonesia. Nama variabel dan fungsi dalam bahasa Inggris.
- **Jangan commit** database (`*.db`), rahasia (`.env*`, `prisma/.auth-secret`), kredensial latihan, atau folder `backups/`. Semuanya sudah ada di `.gitignore`.

## Perintah

| Perintah                                     | Fungsi                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                                   | Server pengembangan                                              |
| `pnpm check`                                 | Format, lint, typecheck, tes unit dan integrasi (sama dengan CI) |
| `pnpm format` / `pnpm lint:fix`              | Merapikan otomatis                                               |
| `pnpm build` lalu `pnpm test:e2e`            | Build produksi dan tes Playwright                                |
| `pnpm exec prisma migrate dev --name <nama>` | Membuat migrasi setelah mengubah `prisma/schema.prisma`          |

## Melihat kontribusi

Riwayat per orang bisa dilihat di GitHub, Insights, Contributors, atau dari terminal:

```bash
git shortlog -sne main
```
