# Manifest dan posisi aset CSSD

| File paket | Tujuan deploy | Penempatan |
| --- | --- | --- |
| assets/cssd-queue-banner.png | apps/web/public/images/cssd/cssd-queue-banner.png | Ringkasan Antrean Kerja x283 y143 w1288 h143 pada 1586×992. Perbandingan kanvas aset 3:1. Panjang penuh card, cover, posisi 50% horizontal / 58% vertikal. Foto berada di kanan dan copy HTML di kiri dengan padding sekitar 28–46 px. Pada layar sempit pangkas foto atau sembunyikan. |
| assets/cssd-empty-tray.png | apps/web/public/images/cssd/cssd-empty-tray.png | Di bawah toolbar, dalam area kosong tabel, sekitar 96×96 px. Tampilkan jika antrean memang kosong. Hasil filter kosong cukup memakai teks dan tindakan hapus filter. |
| reference/approved-queue.png, jika tersedia | Hanya referensi, tidak di public assets | PNG pilihan merupakan acuan komposisi 1586×992. [Unduh gambar persis yang disetujui](https://chatgpt.com/api/library/files/libfile_0e1240b0fcac8191bbef4ef326212fe9/download). |

Aset foto dibuat khusus untuk paket handoff tanpa teks UI. Tidak memakai foto hasil generasi untuk checklist identifikasi komponen. Foto instrumen pada Pengemasan harus berasal dari katalog yang diverifikasi. Logo fasilitas memakai konfigurasi/asset RS. Ikon memakai Phosphor yang ada di repositori. Gunakan alt kosong pada foto dekoratif, intrinsic dimensions, format terkompresi bila build memerlukannya, dan fallback warna #E6F3FE. Preload banner hanya bila benar-benar menjadi aset atas halaman. Gunakan lazy loading untuk empty tray jika muncul di bawah fold.

```css
.cssd-queue-banner {
  min-height: 143px;
  border-radius: 12px;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #e6f3fe;
}
.cssd-queue-banner__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 58%;
  z-index: -1;
}
.cssd-queue-banner__copy {
  width: min(46%, 31rem);
  padding: 32px 28px 24px 46px;
}
@media (max-width: 767px) {
  .cssd-queue-banner { min-height: auto; }
  .cssd-queue-banner__art { display: none; }
  .cssd-queue-banner__copy { width: auto; padding: 16px; }
}
```

Kode di atas adalah CSS acuan untuk Claude. Konfirmasi crop pada 1586×992 sebelum mengunci screenshot baseline. Gunakan teks hidup dan hitungan yang dihitung backend. Mockup acuan memiliki pemilihan row dan checkbox. Jika tidak ada aksi multipilih, gunakan seleksi lewat kode dan pertahankan kepadatan layout tanpa checkbox.
