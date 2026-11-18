# DESIGN.md · Notion untuk SIMRS CSSD

**Sumber visual tunggal design system** [Notion DESIGN](reference/notion-source.DESIGN.md). **Acuan komposisi** [Antrean Kerja pilihan pengguna](https://chatgpt.com/api/library/files/libfile_0e1240b0fcac8191bbef4ef326212fe9/download), kanvas 1586 × 992. Gunakan komponen dan ikon SIMRS bila sesuai. Gambar acuan sebagai referensi visual, seluruh teks dan kontrol dibangun sebagai HTML. Silver berasal dari tray dan garis permukaan, biru terang dari identitas Notion.

## Token

| Token | Nilai awal | Penggunaan |
| --- | --- | --- |
| primary | #0075DE | ikon aktif, tautan, pilihan |
| primary-strong | #005BAB | CTA dengan teks putih, focus ring |
| tint | #E6F3FE | baris atau tombol sekunder |
| canvas | #F9F9F8 | latar netral Notion |
| surface | #FFFFFF | navigasi dan kartu |
| silver | #F3F6F9 | kepala tabel dan inset |
| stroke | #DCE4EC | pembatas dan outline |
| ink / secondary | #142136 / #455267 | teks kerja, metadata |
| wait | #FFF1CD / #784600 | menunggu hasil |
| progress | #E6F3FE / #005BAB | sedang diproses |
| pass | #E2F4E8 / #17603A | indikator memenuhi |
| hold | #FCE8EC / #8B2938 | ditahan atau gagal dengan label eksplisit |

NotionInter jika aset sah tersedia. Jika tidak tersedia, gunakan Inter yang berlisensi atau sistem Segoe UI. Judul 36/44 bobot 700 pada 1586, 32/40 pada desktop lebih kecil, 24/32 pada ponsel. Judul banner 28/34, deskripsi 16/24, tab dan toolbar 14/20, kepala dan isi tabel 13/18. Kode memakai angka tabular. Gunakan radius 4 px token dasar, 8 px kontrol, 12 px panel/banner sesuai acuan. Shadow panel detail sangat tipis. Hindari skeleton yang menggeser lebar kolom.

## Geometri acuan desktop

Koordinat dalam px terhadap gambar 1586 × 992, dengan toleransi maks 8 px pada region utama setelah font dan aset dimuat. Bidang dan teks dilihat pada acuan, bukan sekadar skor pixel. Ukuran kecil menggunakan layout responsif.

| Region | x · y · w · h | Catatan |
| --- | --- | --- |
| Sidebar | 0 · 0 · 262 · 992 | Grup merek di atas, tujuh/lebih menu sesuai izin, slot fasilitas menempel bawah. Border 1 px di kanan. Baris aktif punya tint dan garis kiri biru yang menandai pilihan. |
| Header tiap halaman | 283 · 15 · 1288 · 108 | Breadcrumb di atas judul. Akun dan notifikasi rata kanan. Judul Antrean Kerja dan deskripsi. CTA **Pindai kode** di kanan x1377, y73, w194, h48. |
| Banner | 283 · 143 · 1288 · 143 | Radius 12. Copy x330 dan posisi atas sekitar y180. Artwork di belakang, sisi kiri tenang. Bagian kanan punya tray dan kemasan. |
| Kolom antrean | 279 · 291 · 890 · 644 | Tab, toolbar, tabel, footer. Pada desktop gunakan grid minmax(0, 1fr) dan panel kanan clamp(320px, 24.5vw, 389px), gap 16. |
| Panel batch | 1185 · 309 · 389 · 647 | Panel putih/biru sangat muda, border tipis, padding 18. Judul, status, metadata dua kolom, tahapan, indikator, catatan. |
| Tab | 280 · 292 · 886 · 41 | Semua, Menunggu Proses, Sterilisasi, Menunggu Verifikasi, Selesai. Hitungan dari query sesuai definisi tahap. |
| Toolbar | 280 · 351 · 885 · 42 | Cari batch/set/unit, Unit Asal, Jenis Set, Metode Sterilisasi, Status, dan pengaturan kolom bila diimplementasi. |
| Tabel | 279 · 407 · 891 · 472 | Kepala 38 px, baris sekitar 42–44 px, dua baris teks pada nama/tanggal. Footer jumlah hasil dan pagination. |

Di 1280–1440 pertahankan konteks kanan jika tabel masih terbaca. Bila perlu, prioritaskan kode, nama set, unit dan status, dengan kolom tambahan dalam ekspansi atau daftar kolom. Di ≤1100 detail dibuka sebagai panel terpisah. Di ≤767 gunakan daftar rangkum dan detail rute, breadcrumb ringkas, menu berlabel, area sentuh 44 px, dan tanpa scroll horizontal halaman. Berikan ruang untuk keyboard pada scanner manual.

## Aturan Antrean Kerja dan detail

- Breadcrumb **SIMRS / CSSD / Antrean Kerja**. Nama stasiun/role di header. Menu layar desktop mengikuti acuan **Antrean Kerja**, **Penerimaan**, **Batch & Mutu**, **Stok Steril**, **Distribusi**, **Pelacakan**. Dekontaminasi dan Pengemasan ditemukan melalui antrean stasiun atau navigasi per role.
- Banner **Sterilisasi Sentral** dan ringkasan batch menunggu verifikasi yang dihitung server. Angka ringkasan menggunakan cakupan yang ditampilkan. Tidak memuat statistik rekaan.
- Mau melihat detail: klik tombol kode di baris. Baris terpilih tint biru. Checkbox hanya dirender bila ada aksi multipilih yang sah, dengan toolbar yang menjelaskan aksi. Gunakan terpilih tanpa checkbox untuk alur biasa. Menu titik tiga hanya berisi aksi yang berlaku.
- Tabel desktop: **No. Batch**, **Set / Instrumen**, **Unit Asal**, **Jumlah**, **Metode**, **Mulai Proses**, **Target Selesai**, **Status**. Muatan campuran menampilkan ringkasan dan buka isi. Waktu ditampilkan dalam zona RS. Target, jika tersedia, terpisah dari waktu selesai aktual dan tidak bersifat janji klinis.
- Panel kanan: kode batch dan status di atas; set/unit, jumlah, metode, mulai, target; timeline horizontal 5 langkah **Penerimaan, Dekontaminasi, Pengemasan, Sterilisasi, Verifikasi**; hasil fisik/kimia/biologis dan catatan. Timeline batch dengan paket yang berbeda tahap harus ditandai sebagai ringkasan dan dapat ditelusuri per paket. Tanda hijau hanya jika bukti pada cakupan terkait terpenuhi. **Selesai siklus** dan **Dilepas** berlabel berbeda.
- Apabila bukti wajib menunggu, panel menunjukkan alasan tepat dan CTA berizin seperti **Buka bukti batch**. Pembatasan di UI didukung validasi server. Jam hasil biologis hanya muncul dari kebijakan atau data aktual.
- Query filter, sort, page, dan selected code dapat disimpan pada URL. Pada perubahan filter, reset page dan validasi seleksi. Setelah kembali dari detail, pulihkan query dan posisi scroll. Shift/akses mengubah cakupan secara eksplisit.
- Loading, empty, no access, filter kosong, error jaringan, data kedaluwarsa, scan tidak ditemukan dan konflik versi memiliki copy tersendiri. Setiap state punya tujuan pemulihan bila bisa. Keyboard fokus terlihat dan reader mendapat status.

## Komponen dan pengujian

Gunakan `CssdWorkspaceShell`, `CssdQueueBanner`, `BatchQueueTabs`, `BatchQueueToolbar`, `BatchQueueTable`, `BatchDetailPanel`, `ProcessTimeline`, `EvidenceList`, `ScanDialog`, dan `CssdStatusTag` sebagai batas tanggung jawab. Reuse komponen repo yang sepadan. Pakai Phosphor yang tersedia. Aset, crop dan fallback ada di `04-ASSETS.md`.

Buat screenshot Playwright fixture di 1586×992 setelah fonts siap, lalu 1440, 1280, 1024 dan 390. Review visual bagian sidebar, header, banner, filter, tingkat kepadatan, panel dan warna status. Tinjau screenshot bersama pemilik proyek. Gambar produksi tervalidasi setelah font, browser, serta aset aktual diterapkan. Uji keyboard, zoom 200%, reader, scanner dan printer. Densitas tidak mengurangi aksesibilitas target sentuh. CSSD tidak memasukkan nama pasien di label atau screenshot.
