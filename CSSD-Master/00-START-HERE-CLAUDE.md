# Claude · mulai di sini

> **Catatan v2.0 (18 Nov 2026):** stack yang dibangun adalah satu aplikasi Next.js + Prisma/SQLite + Better Auth, bukan monorepo NestJS/PostgreSQL. Lihat PRD-MASTER bagian 3 (ADR 01–06). Bagian di bawah yang menyebut stack lama tetap berlaku sebagai prinsip, bukan struktur folder.

Baca `PRD-MASTER.md`, `DESIGN.md`, `01-WORKFLOWS.md`, `02-DATA-API.md`, `03-BUILD-AND-RELEASE.md`, dan `04-ASSETS.md` sebelum coding. Buka [gambar Antrean Kerja yang disetujui](https://chatgpt.com/api/library/files/libfile_0e1240b0fcac8191bbef4ef326212fe9/download). Jika sesi Claude tidak bisa membuka tautan, lampirkan PNG pilihan dari chat bersama ZIP. Gambar acuan menetapkan layout desktop. DESIGN.md menetapkan token dan perilaku. PRD dan kontrak menetapkan aturan bisnis. Referensi kutipan lama di folder reference membantu riset, dengan urutan prioritas ini untuk implementasi.

Instruksi untuk Claude:

> Bangun SIMRS CSSD sesuai PRD-MASTER dan dokumen pendamping. Mulai dengan baseline repo dan pemeriksaan target. Gunakan mockup pilihan sebagai acuan utama 1586 × 992 dan gunakan file aset lokal sesuai manifest. Pertahankan stack dan pola SIMRS yang tersedia. Jika konteks benar-benar kosong, bootstrap monorepo sesuai 03-BUILD-AND-RELEASE. Kerjakan milestone berurutan, selalu buktikan dengan tes. Tampilkan progres melalui daftar requirement, commit/patch, perintah dan hasil tes. Pertahankan pekerjaan pengguna. Jangan menyimpulkan siap produksi hanya dari build atau screenshot. Gunakan fixture sintetis sampai SOP/IFU, perangkat dan operasi disetujui. Buat status BLOCKED dengan alasan yang spesifik untuk gerbang yang membutuhkan pihak rumah sakit. Lanjutkan bagian yang dapat dikerjakan tanpa input tersebut.

## Urutan bukti yang harus dikirim

1. Daftar baseline dan gap yang direproduksi, termasuk dev/staging terisolasi.
2. Skema dan OpenAPI yang benar-benar dihasilkan dari implementasi, kontrak dan tes migrasi.
3. Antrean dengan fixture yang sesuai gambar, screenshot desktop, reflow tablet/ponsel, dan rekaman skenario per peran.
4. Skenario normal, bukti tertunda, paket ditahan, distribusi dan penarikan, konflik, downtime, regresi SIMRS.
5. Hasil UAT, keamanan, beban, backup/restore, cutover, dan keputusan go-live dengan pemilik bukti.

Jalankan dengan data sintetis dalam lingkungan lokal atau staging hingga gerbang proyek disetujui. Simpan keputusan yang berubah dalam ADR dengan alasan dan dampak. Simpan keluaran pengujian yang gagal beserta pemilik dan rencana perbaikan.
