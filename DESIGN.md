---
name: SIMRS CSSD
description: Meja kerja sterilisasi sentral, biru dan silver di atas kanvas terang, satu tabel dan satu tindakan berikutnya.
colors:
  primary: "#0075de"
  primary-strong: "#005bab"
  primary-pressed: "#004a8c"
  tint: "#e6f3fe"
  canvas: "#f9f9f8"
  surface: "#ffffff"
  silver: "#f3f6f9"
  stroke: "#dce4ec"
  stroke-strong: "#b9c6d3"
  ink: "#142136"
  ink-secondary: "#455267"
  wait-bg: "#fff1cd"
  wait-fg: "#784600"
  progress-bg: "#e6f3fe"
  progress-fg: "#005bab"
  pass-bg: "#e2f4e8"
  pass-fg: "#17603a"
  hold-bg: "#fce8ec"
  hold-fg: "#8b2938"
typography:
  display:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: "2.75rem"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2.125rem"
    letterSpacing: "-0.015em"
  title-panel:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: "1.75rem"
    fontFeature: "tnum"
  title:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: "1.5rem"
  title-sub:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: "1.375rem"
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-table:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.125rem"
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  panel: "18px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.primary-pressed}"
  button-primary-large:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "48px"
    width: "194px"
  button-secondary:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "38px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "38px"
  button-ghost-hover:
    backgroundColor: "{colors.silver}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.hold-fg}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "38px"
  button-danger-hover:
    backgroundColor: "{colors.hold-bg}"
  tag-wait:
    backgroundColor: "{colors.wait-bg}"
    textColor: "{colors.wait-fg}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-progress:
    backgroundColor: "{colors.progress-bg}"
    textColor: "{colors.progress-fg}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-pass:
    backgroundColor: "{colors.pass-bg}"
    textColor: "{colors.pass-fg}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-hold:
    backgroundColor: "{colors.hold-bg}"
    textColor: "{colors.hold-fg}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  tag-neutral:
    backgroundColor: "{colors.silver}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "40px"
  input-toolbar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "42px"
  nav-item:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "18px"
  table-head:
    backgroundColor: "{colors.silver}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.body-table}"
    height: "38px"
---

# Design System: SIMRS CSSD

## Overview

**Creative North Star: "Meja Steril"**

Antarmuka ini adalah meja kerja di ruang sterilisasi sentral yang terang, bukan dasbor. Setiap layar menyajikan pekerjaan yang menunggu untuk peran saat ini dan satu tindakan yang menggerakkannya maju, diletakkan sebaris dengan barangnya. Warnanya berasal dari foto tray baja dan kemasan biru: kanvas putih hangat, permukaan putih, silver untuk kepala tabel dan inset, biru tegas untuk tindakan. Dunia visual dipatok oleh brief pemilik (`CSSD-Master/DESIGN.md`) dan mockup Antrean Kerja 1586 x 992 yang disetujui; build mengikuti token dan geometrinya.

Kepadatan tinggi tetapi tenang: tabel 13/18 dengan baris sekitar 43 px, kartu bergaris tipis tanpa bayangan, satu panel detail yang mengambang tipis di samping antrean. Status selalu berupa teks berlabel dengan ikon Phosphor, tidak pernah warna saja. Hanya tema terang: stasiun CSSD berada di ruang kerja terang, dan brief pemilik hanya mendefinisikan tema ini.

Penolakan yang dikonfirmasi brief: baris kartu statistik, grafik, umpan aktivitas, formulir modal untuk alur kerja, dan statistik rekaan.

**Key Characteristics:**

- Kanvas terang, permukaan putih bergaris 1 px, silver sebagai lapisan kedua.
- Satu biru tindakan (primary-strong) untuk CTA, tautan, fokus dan pilihan.
- Empat nada status (wait, progress, pass, hold) selalu dengan label dan ikon.
- Inter dengan angka tabular untuk kode, jumlah dan waktu.
- Radius tiga langkah: 4 token kecil, 8 kontrol, 12 wadah.
- Datar secara bawaan; bayangan hanya untuk permukaan yang mengambang.

## Colors

Palet biru-silver turunan Notion yang dipilih pemilik: satu keluarga biru untuk tindakan dan pilihan, netral dingin untuk struktur, dan empat pasangan nada status.

### Primary

- **Biru Tindakan** (primary-strong): CTA bertulisan putih, tautan, cincin fokus 2 px, garis tab aktif, penanda tahapan yang selesai, accent-color checkbox. Kontrasnya cukup untuk teks putih di atasnya.
- **Biru Terang Notion** (primary): hanya untuk garis kiri 3 px menu sidebar aktif. Tidak dipakai untuk teks atau latar tombol.
- **Biru Tekan** (primary-pressed): hover tombol utama.
- **Tint Tray** (tint): latar menu aktif, tombol sekunder, baris tabel terpilih, halaman pagination aktif, avatar akun, banner permintaan.

### Neutral

- **Kanvas** (canvas): latar halaman.
- **Permukaan** (surface): sidebar, kartu, panel, dialog, isian.
- **Silver Tray** (silver): kepala tabel, inset, chip, hover tombol ghost, hitungan tab.
- **Garis** (stroke): pembatas kartu, baris tabel, sidebar.
- **Garis Tegas** (stroke-strong): tepi isian, garis putus-putus label cetak dan pencatatan mundur, marker tahapan yang belum dimulai.
- **Tinta** (ink): teks kerja dan judul.
- **Tinta Sekunder** (ink-secondary): metadata, label isian, kepala tabel, breadcrumb.

### Status

- **Menunggu** (wait-bg / wait-fg): menunggu proses atau hasil; juga indikator pekerjaan menunggu yang aktif.
- **Diproses** (progress-bg / progress-fg): sedang berjalan, sterilisasi.
- **Memenuhi** (pass-bg / pass-fg): bukti terpenuhi, dilepas, pengumuman sukses.
- **Ditahan** (hold-bg / hold-fg): ditahan, gagal, ditolak, galat isian, tombol destruktif.

### Named Rules

**The Four Tones Rule.** Hanya empat nada status ditambah netral silver. Setiap tag membawa label tertulis dan ikon Phosphor tebal 14 px; nada tidak pernah berdiri sendiri.

**The Green Is Earned Rule.** Nada pass hanya muncul bila bukti pada cakupan terkait terpenuhi dan waktunya tercatat; hasil tanpa waktu tampil netral "Belum terverifikasi".

**The One Blue Voice Rule.** Tindakan, tautan, fokus dan pilihan memakai biru yang sama (primary-strong). Biru terang (primary) dicadangkan untuk penanda menu aktif.

## Typography

**Display Font:** Inter (pengganti berlisensi untuk NotionInter yang disebut brief; cadangan Segoe UI, system-ui)
**Body Font:** Inter
**Label/Mono Font:** Inter dengan `font-variant-numeric: tabular-nums` untuk kode batch, jumlah, waktu dan pagination.

**Character:** Satu keluarga sans yang netral dan rapat; hierarki dibangun dari ukuran dan bobot 700, bukan dari pasangan huruf.

### Hierarchy

- **Display** (700, 36/44, -0.02em): judul halaman. Turun ke 32/40 di bawah 1500 px dan 24/32 di ponsel.
- **Headline** (700, 28/34, -0.015em): judul banner Sterilisasi Sentral; 20/28 di ponsel. Deskripsi banner 16/24.
- **Title Panel** (700, 22/28, tabular): kode batch di panel detail. Dialog memakai 20/28.
- **Title** (700, 16/24): judul kartu di layar kerja.
- **Title Sub** (700, 15/22): sub-bagian tindakan di dalam kartu (bukti, keputusan, recall).
- **Body** (400, 14/20): teks dasar, tab, toolbar, tombol (600). Deskripsi dibatasi 65ch.
- **Body Table** (400, 13/18): isi dan kepala tabel (kepala 600, tinta sekunder), label bagian panel.
- **Label** (500, 12/16): label isian, breadcrumb, label fakta, tag status (600, 12/18). Timeline 11/14.

### Named Rules

**The Tabular Code Rule.** Setiap kode, jumlah, waktu dan nomor halaman memakai angka tabular supaya kolom tidak bergeser.

**The Sentence Case Rule.** Label, judul dan tombol memakai huruf kalimat. Huruf kapital hanya untuk nilai kode yang dipindai.

## Layout

Kerangka dua kolom: sidebar tetap 262 px (sticky, setinggi layar) dan konten `minmax(0, 1fr)` dengan padding 15/15/24/21 px, sehingga konten 1288 px pada acuan 1586. Kepala halaman 108 px (breadcrumb, judul, deskripsi di kiri; akun, indikator pekerjaan menunggu dan CTA di kanan), jarak 20 px ke isi.

Antrean: banner 143 px, lalu grid `minmax(0, 1fr)` dan panel `clamp(320px, 24.5vw, 389px)` dengan gap 16 px. Layar kerja lain memakai tumpukan kartu selebar penuh dengan gap 16 px; formulir grid tiga kolom (gap 12/16), dua kolom di bawah 1100 px, satu kolom di ponsel.

Ritme jarak: 4, 8, 12, 16, 18 (padding panel dan kartu), 24. Kolom tabel antrean dikunci lebarnya; container query melepas kolom sekunder di 820 px dan 620 px.

Responsif: di bawah 1100 px sidebar menjadi bilah atas dengan menu ringkas berlabel, panel detail menggantikan antrean saat batch dipilih eksplisit. Di bawah 767 px tabel antrean menjadi daftar kartu ringkas, banner tanpa foto, tombol besar selebar penuh. Pada `pointer: coarse` semua sasaran sentuh minimal 44 px. Tidak ada scroll horizontal halaman pada 390 px.

## Elevation & Depth

Datar secara bawaan. Kedalaman dibangun dari lapisan nada (kanvas, permukaan putih, silver) dan garis 1 px. Bayangan hanya untuk permukaan yang mengambang di atas pekerjaan, semuanya berbasis tinta `rgb(20 33 54 / a)`.

### Shadow Vocabulary

- **Panel Mengambang** (`box-shadow: 0 1px 2px rgb(20 33 54 / 0.04), 0 6px 20px rgb(20 33 54 / 0.05)`): panel detail batch di samping antrean. Dilepas di bawah 1100 px.
- **Pengumuman** (`box-shadow: 0 8px 24px rgb(20 33 54 / 0.14)`): pesan hasil yang melayang di pojok kanan bawah.
- **Panel Masuk** (`box-shadow: 0 12px 40px rgb(20 33 54 / 0.12)`): satu-satunya panel di halaman login dan setup.
- **Dialog** (`box-shadow: 0 16px 48px rgb(20 33 54 / 0.2)`): dialog pindai kode, dengan backdrop tinta 40%.

### Named Rules

**The Floating-Only Shadow Rule.** Kartu dan tabel tidak berbayang. Bayangan hanya untuk panel detail, pengumuman, panel masuk dan dialog.

## Shapes

Tiga radius: 4 px untuk token kecil (tag, hitungan tab, chip, kode inline, fokus), 8 px untuk kontrol (tombol, isian, menu, kotak inset, fieldset), 12 px untuk wadah (kartu, tabel, panel, banner, dialog). Tombol ikon kecil di dalam isian dan pagination memakai 6 px. Avatar dan marker tahapan bulat penuh. Garis 1 px solid untuk struktur; garis putus-putus hanya untuk area pratinjau cetak dan pencatatan mundur yang terbuka.

## Components

### Buttons

Tegas dan padat, tanpa hiasan.

- **Shape:** sudut lembut (8 px), tinggi 38 px, padding horizontal 16 px, teks 600, ikon 8 px dari label.
- **Primary:** biru tindakan dengan teks putih; varian besar 48 x 194 px untuk CTA kepala halaman (Pindai kode), selebar penuh di ponsel.
- **Hover / Focus:** primary menggelap ke biru tekan; transisi latar 150 ms ease-out; turun 1 px saat ditekan; fokus memakai cincin global 2 px biru tindakan dengan offset 2 px.
- **Secondary:** latar tint, teks biru tindakan (contoh: Buka bukti batch).
- **Ghost:** transparan, teks tinta, hover silver.
- **Danger:** permukaan putih, tepi bernada hold, teks hold-fg; hover hold-bg. Dipakai untuk gagal, tolak, recall.
- **Disabled / proses:** latar garis, teks sekunder, kursor progress.

### Status Tags

- **Style:** latar nada, teks nada, radius 4 px, padding 2/8, teks 12/18 600, ikon Phosphor bold 14 px di depan label.
- **State:** wait, progress, pass, hold, neutral. Tidak ada varian lain.

### Cards / Containers

- **Corner Style:** 12 px.
- **Background:** permukaan putih; inset kebijakan dan alasan memakai silver atau biru sangat muda.
- **Shadow Strategy:** datar (lihat Elevation & Depth).
- **Border:** 1 px garis.
- **Internal Padding:** 18 px. Judul kartu 16/24 bold.

### Inputs / Fields

- **Style:** putih, tepi 1 px garis tegas, radius 8 px, tinggi 40 px (isian formulir) atau 42 px (toolbar), 48 px untuk input pindai. Label 12/16 sekunder di atas isian. Dropdown memakai panah Phosphor CaretDown.
- **Focus:** hover menggelapkan tepi ke tinta sekunder; fokus memakai cincin global.
- **Error / Disabled:** tepi hold-fg, pesan galat hold-fg dengan ikon di samping isian yang menyebabkannya; isian operator dipertahankan.

### Navigation

- **Sidebar:** grup merek di atas (SIMRS 18/28 bold, modul CSSD biru 14/600), menu 40 px dengan ikon Phosphor dan teks 500 sekunder, slot fasilitas menempel di bawah.
- **Aktif:** latar tint, teks biru tindakan 600, dan garis kiri biru terang 3 px (sisi kanan membulat 3 px, inset 8 px atas-bawah) sebagai penanda pilihan yang disetujui pemilik.
- **Tab:** tinggi 40 px, garis bawah 2 px biru tindakan saat aktif, hitungan tabular dalam kotak silver (tint saat aktif).
- **Mobile:** menu ringkas `details` berlabel di bilah atas, sasaran 44 px.

### Queue Table (Signature)

Kepala silver 38 px dengan teks 13/18 600 sekunder, baris 43 px bergaris atas, kode batch sebagai tautan tabular 600 yang memilih baris dan memperbarui panel dan URL bersamaan. Baris terpilih berlatar tint. Footer 55 px dengan jumlah hasil dan pagination 32 px.

### Process Timeline (Signature)

Lima langkah mendatar (Penerimaan, Dekontaminasi, Pengemasan, Sterilisasi, Verifikasi) dengan marker bulat 22 px dan garis 2 px. Selesai: marker biru penuh dengan tanda centang dan garis biru; saat ini: tepi biru; belum: tepi garis tegas. Label 11/14 600, keterangan waktu 11/14 sekunder.

### Announcer

Satu wilayah status per halaman di kanan bawah: latar pass, teks pass-fg 600, radius 8 px, bayangan pengumuman, muncul 200 ms dari 8 px di bawah, dapat ditutup.

## Do's and Don'ts

### Do:

- **Do** pasangkan setiap nada status dengan label tertulis dan ikon Phosphor.
- **Do** pakai angka tabular untuk kode, jumlah, waktu dan pagination.
- **Do** letakkan tindakan berikutnya sebaris dengan barangnya, satu tindakan utama per item.
- **Do** pakai kepala tabel silver 38 px dan baris bergaris untuk setiap daftar item (paket, bukti, audit).
- **Do** naikkan sasaran sentuh ke 44 px pada `pointer: coarse` dan di ponsel.
- **Do** hormati `prefers-reduced-motion`; gerak terbatas pada 150 ms ease-out (cubic-bezier(0.16, 1, 0.3, 1)).

### Don't:

- **Don't** tambahkan tema gelap; produk ini hanya tema terang.
- **Don't** pakai pustaka ikon selain Phosphor atau karakter glyph sebagai ikon.
- **Don't** sampaikan status hanya lewat warna, atau tampilkan hijau sebelum bukti terpenuhi.
- **Don't** pakai garis kiri berwarna sebagai aksen kartu, peringatan atau baris; garis 3 px itu milik menu sidebar aktif saja.
- **Don't** tambahkan baris kartu statistik, grafik, umpan aktivitas atau angka rekaan.
- **Don't** beri bayangan pada kartu atau tabel; bayangan hanya untuk permukaan mengambang.
- **Don't** pakai formulir modal untuk langkah alur kerja; dialog hanya untuk pindai kode.
