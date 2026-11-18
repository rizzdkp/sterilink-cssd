# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Ditetapkan oleh `CSSD-Master/PRD-MASTER.md` ADR 01 dan `CSSD-Master/03-BUILD-AND-RELEASE.md`: monorepo pnpm 9.15.4, Node 22, `apps/web` Next.js App Router, `apps/api` NestJS, Prisma + PostgreSQL, `packages/contracts`, `tests/e2e` Playwright. Belum ada repo SIMRS induk di workspace ini, jadi modul di-bootstrap dari nol dan nanti diintegrasikan secara aditif.

## Users

Petugas Instalasi Sterilisasi Sentral (CSSD) rumah sakit di Indonesia yang bekerja per stasiun dan per shift:

- Operator penerimaan/dekontaminasi (zona kotor): terima tray, hitung, catat selisih.
- Operator zona bersih: inspeksi, kemas, cetak label.
- Operator mesin: susun muatan, catat siklus.
- Reviewer mutu: telaah bukti fisik/kimia/biologis, tahan/tolak/lepas.
- Gudang/distribusi, petugas unit (OK, VK, poli), supervisor/PPI, teknisi, admin/auditor.

Situasi kerja: stasiun bersama di ruang terang, sering memakai sarung tangan dan scanner barcode, berpindah antar layar desktop 1280 sampai 1586 px, tablet, dan ponsel. Pekerjaan utama di layar Antrean Kerja: menemukan batch yang menahan alur, lalu membuka tindakan berikutnya yang diizinkan.

## Product Purpose

Menelusuri instrumen dan paket dari unit asal sampai penggunaan, retur, dan penarikan. Sukses berarti setiap paket yang dilepas bisa dibuktikan memenuhi syarat profilnya, setiap recall menemukan setiap paket terdampak, dan operator tidak mencari formulir di menu tambahan.

## Positioning

Aplikasi mendokumentasikan keputusan petugas, bukan menggantikannya. Gerbang pelepasan ditegakkan di server: bukti wajib yang tertunda atau gagal memblokir pelepasan di API, bukan hanya di UI. Status proses, status mutu, dan posisi fisik dipisah sehingga "Selesai siklus" tidak pernah terbaca sebagai "Dilepas". Dibangun untuk regulasi Indonesia (Permenkes 6/2026, 27/2017, 24/2022, UU PDP 27/2022) dan bahasa Indonesia.

## Operating Context

- Alur: permintaan unit, penerimaan, dekontaminasi, inspeksi, pengemasan, siklus mesin, verifikasi mutu, stok, distribusi, penggunaan/retur, recall (`CSSD-Master/01-WORKFLOWS.md`).
- Identitas fisik: tray (bertahan), paket (kode baru tiap proses ulang), batch (satu siklus). Label memuat kode terbaca manusia dan barcode, tanpa identitas pasien.
- Scanner bertindak sebagai input keyboard dengan fallback manual. Printer melalui adapter vendor.
- Riset lapangan (HSPA 2026, studi kasus vendor): "scan fatigue" membuat staf menimpa peringatan yang terlalu sering; pencatatan manual pascasiklus adalah sumber error; hasil indikator biologis paling aman ditampilkan sebagai status tegas berlabel.

## Capabilities and Constraints

- Requirement CSSD-01 sampai CSSD-13 di `CSSD-Master/PRD-MASTER.md`; kontrak data dan API di `CSSD-Master/02-DATA-API.md`.
- Otorisasi server per resource dan scope fasilitas/unit; entitas di luar scope menjawab 404.
- Mutasi membawa `Idempotency-Key` dan `expectedVersion`; satu pemenang untuk aksi yang saling meniadakan.
- Waktu disimpan UTC, ditampilkan dalam zona RS (fixture: Asia/Jakarta).
- **Terbuka (gerbang G1 sampai G5, pemilik RS):** nama RS dan fasilitas, peta stasiun dan role, SOP/IFU, profil mesin dan indikator, perangkat scanner/printer, IdP, kontrak RME, retensi, SLO. Sampai disetujui, semua konfigurasi berjalan sebagai profil demo dengan data sintetis.

## Brand Commitments

- Dunia visual dipatok oleh `CSSD-Master/DESIGN.md` (token biru-silver turunan Notion, dipilih pemilik proyek) dan mockup Antrean Kerja 1586 x 992 yang sudah disetujui.
- Ikon Phosphor. Foto tray dan kemasan biru dari `CSSD-Master/assets/` sesuai manifest `04-ASSETS.md`.
- Menu sidebar aktif memakai garis kiri biru sebagai penanda pilihan fungsional (dikonfirmasi pemilik, override antislop yang disengaja).
- Bahasa antarmuka: Indonesia, kalimat fungsional, tanpa em dash.

## Evidence on Hand

- Fixture visual sintetis `CSSD-Master/fixtures/queue.visual.json` (12 batch, tanggal 16 Januari 2025). Hanya untuk dev/staging, selalu diberi label sintetis yang terlihat.
- Dua aset foto: `cssd-queue-banner.png`, `cssd-empty-tray.png`.
- **Tidak ada:** logo RS, nama personel, statistik operasional nyata, testimoni, sertifikasi. Jangan dibuat-buat; pakai teks nama produk dan label peran/stasiun.

## Product Principles

1. Bukti dulu, hijau kemudian: tanda lulus hanya muncul bila bukti pada cakupan terkait terpenuhi.
2. Satu langkah paling relevan: setiap detail menampilkan alasan status dan satu tindakan berizin, bukan deretan tombol.
3. Peringatan langka dan spesifik: setiap peringatan menyebut penyebab dan pemulihannya, supaya tidak dilatih untuk diabaikan.
4. Riwayat tidak pernah ditimpa: koreksi, proses ulang, dan cetak ulang menautkan ke catatan lama.
5. Sintetis harus terlihat sintetis: data demo tidak boleh terbaca sebagai data produksi.

## Accessibility & Inclusion

WCAG 2.2 AA: keyboard penuh, fokus terlihat, status tidak hanya lewat warna, zoom 200%, reflow 390 px tanpa scroll horizontal halaman, target sentuh 44 px di layar sentuh, pesan status diumumkan ke pembaca layar, `prefers-reduced-motion` dihormati.
