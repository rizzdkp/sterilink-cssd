# PRD Produksi · SIMRS CSSD

**Versi 2.0 · 17 November 2026 · Penyempurnaan dari PRD-MASTER v1.0 untuk aplikasi yang langsung dipakai rumah sakit**

PRD-MASTER v1.0 tetap berlaku sebagai dasar regulasi, alur dan desain. Dokumen ini menetapkan apa yang wajib ada agar aplikasi bisa dipasang di satu rumah sakit dan dipakai dari hari pertama **tanpa data contoh, tanpa peran demo, dan tanpa nilai yang ditanam di kode**. Setiap nilai khusus rumah sakit diisi oleh admin rumah sakit lewat aplikasi.

## 1. Prinsip produksi

1. **Tidak ada data contoh di instalasi produksi.** Database baru kosong. Pemasangan pertama membuka wizard yang membuat fasilitas dan akun admin pertama. Data latihan hanya bisa dimuat dengan perintah terpisah (`pnpm db:seed:training`) dan selalu berlabel "Data latihan".
2. **Tidak ada peran demo.** Semua akses melalui akun personal dengan kata sandi, sesi berbatas waktu, dan peran yang diberikan admin. Setiap tindakan tercatat atas nama orangnya.
3. **Semua kebijakan klinis bisa dikonfigurasi.** Indikator wajib per metode sterilisasi, masa simpan, isi set per komponen, mesin dan rak ditetapkan admin sesuai SOP/IFU rumah sakit. Aplikasi menolak operasi bila konfigurasi wajib belum ada, dengan pesan yang menyebut apa yang harus diisi.
4. **Aturan ditegakkan di server**, di dalam transaksi, dengan jejak audit pada transaksi yang sama.
5. **Bisa dipulihkan.** Backup harian otomatis dan backup sesuai permintaan; prosedur restore teruji.

## 2. Arsitektur terpasang

| Bagian | Keputusan | Alasan |
| --- | --- | --- |
| Aplikasi | Satu aplikasi Next.js 16 (App Router, Server Actions) | Satu proses untuk dipasang dan dirawat TI rumah sakit |
| Database | SQLite (WAL) lewat Prisma 7 | Tanpa server database terpisah; cukup untuk satu fasilitas CSSD dengan puluhan stasiun. Migrasi ke PostgreSQL tercatat di README bila volume menuntut |
| Autentikasi | Better Auth: username + kata sandi, sesi di database, rate limit login | Pustaka teruji; kata sandi di-hash, cookie httpOnly |
| Backup | `VACUUM INTO` harian ke folder backup + unduhan oleh admin | Salinan konsisten tanpa menghentikan layanan |

## 3. Peran dan kewenangan

Admin menetapkan satu peran per akun. Petugas unit juga diikat ke satu unit.

| Peran | Kapabilitas |
| --- | --- |
| Admin | Pengaturan fasilitas, master data, kebijakan, akun pengguna, backup, audit. **Tidak** bisa memproses atau melepas paket. |
| Operator Penerimaan | Terima tray, catat dekontaminasi |
| Operator Pengemasan | Inspeksi per komponen, buat paket, cetak label |
| Operator Mesin | Susun muatan, jalankan siklus, catat bukti |
| Reviewer Mutu | Catat bukti, lepas/tahan/tolak (bukan pada batch yang ia jalankan sendiri) |
| Petugas Distribusi | Lihat permintaan, kirim paket, pindah rak, tarik paket kedaluwarsa |
| Petugas Unit | Buat permintaan untuk unitnya, terima/tolak paket, catat penggunaan |
| Supervisor | Recall dan CAPA, laporan, audit, semua baca |
| Auditor | Baca semua, laporan, audit, ekspor. Tanpa tindakan. |

## 4. Requirement fungsional

| ID | Fungsi | Uji penerimaan |
| --- | --- | --- |
| P-01 | Wizard pemasangan pertama | Database kosong mengarahkan ke wizard; setelah fasilitas dan admin dibuat, wizard tertutup permanen |
| P-02 | Login, logout, ganti kata sandi, sesi 12 jam | Salah sandi berulang dibatasi; akun nonaktif tidak bisa masuk; sesi dicabut saat akun dinonaktifkan |
| P-03 | Kelola pengguna | Admin membuat akun dengan kata sandi awal; pengguna wajib menggantinya saat masuk pertama; admin bisa menonaktifkan dan mengatur ulang sandi |
| P-04 | Master: unit, rak, mesin, set dan komponennya, tray | Kode unik per fasilitas; perubahan tercatat di audit; item yang sudah dipakai dinonaktifkan, bukan dihapus |
| P-05 | Kebijakan bukti per metode dan masa simpan | Indikator wajib per metode (fisik/kimia/biologis); masa simpan hari per set; tanpa kebijakan, siklus tidak bisa diselesaikan |
| P-06 | Permintaan unit | Unit membuat permintaan (set, jumlah, prioritas, dibutuhkan pada); distribusi memenuhi sebagian atau penuh; status terbuka/sebagian/terpenuhi/batal |
| P-07 | Penerimaan dan dekontaminasi | Seperti v1.0 (CSSD-02, CSSD-03): satu proses aktif per tray, selisih wajib catatan, percobaan gagal tetap tercatat |
| P-08 | Inspeksi per komponen | Satu baris per komponen set: harapan, aktual, kondisi. Komponen kurang/rusak wajib catatan dan mengembalikan tray ke proses ulang bila gagal |
| P-09 | Paket, label, kedaluwarsa | Label berkode batang Code 128; cetak ulang tercatat; tanggal kedaluwarsa dihitung saat dilepas dari masa simpan set |
| P-10 | Muatan, siklus, bukti, keputusan mutu | Gerbang pelepasan memakai kebijakan metode muatan; pemisahan tugas; hasil gagal setelah lepas menahan batch |
| P-11 | Stok steril | Paket per rak; pindah rak; paket kedaluwarsa keluar dari ketersediaan dan bisa ditarik untuk proses ulang |
| P-12 | Distribusi dan penggunaan | Kirim dengan atau tanpa permintaan; unit konfirmasi per paket; paket kedaluwarsa, tertahan atau diblokir tidak bisa dikirim |
| P-13 | Recall dan CAPA | Seperti v1.0 (CSSD-09) |
| P-14 | Pelacakan | Cari kode paket/tray/batch/kasus/permintaan; riwayat lengkap |
| P-15 | Laporan | Periode dan zona fasilitas; volume, waktu putar median dan p90 (terima ke lepas), rasio gagal dekontaminasi dan inspeksi dengan pembilang/penyebut, recall; ekspor CSV tercatat di audit |
| P-16 | Audit | Daftar kejadian dengan filter kode, pelaku, periode; ekspor CSV |
| P-17 | Backup dan pemulihan | Backup harian otomatis (simpan 14 hari) dan unduhan admin; restore terdokumentasi dan teruji |
| P-18 | Pencatatan waktu kejadian mundur | Saat downtime, penerimaan dan bukti bisa dicatat dengan waktu kejadian lampau (maksimal 72 jam) dan alasan; waktu pencatatan tetap waktu server |

## 5. Di luar cakupan versi ini

Hal berikut membutuhkan kontrak dengan pihak luar dan **tidak dipalsukan**: integrasi SIMRS/RME (referensi pasien), CMMS, impor otomatis dari mesin, SSO/IdP rumah sakit, SATUSEHAT. Aplikasi bekerja penuh tanpanya; data dicatat manual oleh petugas.

## 6. NFR

| Area | Target |
| --- | --- |
| Keamanan | OWASP ASVS dasar: hash kata sandi, cookie httpOnly/sameSite, rate limit login, otorisasi per aksi di server, header keamanan, galat generik ke pengguna |
| Aksesibilitas | WCAG 2.2 AA, keyboard, reflow 390 px, target 44 px pada layar sentuh |
| Kinerja | Halaman kerja < 1 detik pada data 2 tahun satu fasilitas (indeks per status/waktu) |
| Data | Waktu UTC, tampil zona fasilitas; jejak audit tidak pernah diubah aplikasi |

## 7. Bukti selesai

Uji otomatis untuk setiap P-xx (unit/integrasi dan E2E melalui antarmuka), audit aksesibilitas axe, tinjauan desain impeccable, Delivery Gate antislop, dan uji backup-restore.
