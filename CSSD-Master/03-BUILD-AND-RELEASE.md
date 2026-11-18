# Rencana build, deployment dan go-live

## Baseline dan setup dari nol

1. Baca AGENTS.md yang berlaku dan audit repo. Catat branch, perubahan pengguna, versi, script, schema, route, auth, audit, komponen UI dan pengujian. Ruang lingkup CSSD produksi adalah program tambahan dari PRD rawat jalan. Jangan menggunakan langkah reset DB pada lingkungan dengan data. Simpan baseline perintah dan kegagalan sebelum membuka perubahan.
2. Jika repo tersedia, pertahankan monorepo dan lockfile. Jika repo kosong, siapkan pnpm workspace dengan `apps/web` Next.js App Router, `apps/api` NestJS, `apps/worker`, `packages/contracts`, `prisma`, `tests/e2e` dan `infra`. Pin versi Node dan pnpm yang didukung oleh dependensi. Baseline repo saat ini deklarasi Node ≥20 dan pnpm 9.15.4. Audit dukungan versi sebelum produksi.
3. Dev lokal menyediakan PostgreSQL khusus, instance storage lokal/test dan adapter identitas sintetis. Siapkan env template tanpa rahasia. Jalankan `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate:deploy`, seed sintetis dengan database terisolasi, lalu `pnpm dev`. Sesuaikan nama script bila bootstrap dari nol, catat di README. CI memiliki DB terpisah. Never run seed fixtures di production.
4. Lokasi implementasi: modul API `apps/api/src/modules/cssd`, route `apps/web/src/app/cssd`, kontrak `packages/contracts`, migration `prisma/migrations`, aset `apps/web/public/images/cssd`, E2E `tests/e2e`, skrip deployment `infra`. Audit Prisma yang ada menerima transaksi. Perluas akses dan nav secara aditif.

## Milestone dan bukti

| Milestone | Pekerjaan | Bukti selesai |
| --- | --- | --- |
| M0 Baseline dan keputusan | Audit, ADR, peta scope, plant data sintetis, fixture visual, daftar integrasi dan keputusan lapangan | Baseline build/lint, skema dan risiko terdokumentasi. |
| M1 Fondasi | Migration aditif, auth scope, permissions, katalog, versioning, audit, outbox, API contracts, readiness | Fresh migration dan upgrade data lama, test lintas unit, schema OpenAPI valid. |
| M2 Intake hingga paket | Permintaan/manifest, penerimaan, dekontaminasi, inspeksi, label dan rework | E2E alur unit → paket, selisih/reprocess, bukti reprint. |
| M3 Batch dan UX | Mesin, siklus, indikator, keputusan, antrean dan panel sesuai acuan | Screenshot dan review 1586×992 serta breakpoint; bukti tertunda/gagal memblokir. |
| M4 Stok/logistik | Ledger, scan, dispatch, unit acknowledge, penggunaan/retur | Uji transaksi bersamaan dan paket diterima unit yang benar. |
| M5 Insiden/integrasi | Recall/CAPA, pelaporan, perawatan, adapter dan rekonsiliasi | Drill recall lintas lokasi, outage perangkat, audit ekspor dan replay. |
| M6 Peluncuran | Hardening, backup/restore, load, UAT, training, migrasi data dan cutover | Bukti lulus dan persetujuan per pemilik. Tidak lanjut bila gerbang kritis gagal. |

## Test matrix

| ID | Jenis dan kondisi | Assert |
| --- | --- | --- |
| T01 | Integration, semua perubahan status melalui API | Transisi sah, FK dan constraint konsisten, audit ikut commit. |
| T02 | E2E, tray masuk hingga unit menerima | Jejak tray/paket/load/handover utuh, timestamp dan aktor terlihat. |
| T03 | Integration, bukti wajib absent/pending/fail dan scope salah | API menolak release, status dan stok konsisten. |
| T04 | Concurrency, release vs hold dan dispatch ganda | Hasil atomik, respons konflik, hanya satu event efektif. |
| T05 | E2E, inspeksi kurang/rusak dan proses ulang | Catatan lama utuh, label baru hanya jika paket baru, reprint ID sama. |
| T06 | Authorization, lintas unit dan role | Endpoint UI, file dan ekspor menjaga scope, detail sensitif tidak terlihat. |
| T07 | E2E, batch sudah lepas lalu koreksi dan recall | Paket tersimpan tertahan, paket dikirim ditelusuri, paket sudah digunakan dieskalasi. |
| T08 | Integration, retry worker, input ganda, timeout | Idempotent, DLQ terlihat, rekonsiliasi tanpa transaksi ganda. |
| T09 | QA perangkat | Scanner asli/manual, printer gagal/reprint, label terbaca, shortcut dan keyboard aman. |
| T10 | Visual dan accessibility | Fixture snapshot, review screenshot, reflow, keyboard, zoom, audit WCAG. |
| T11 | Operasional | Downtime, backfill, PITR, bukti objek, audit dan cek SLO terukur. |
| T12 | Regresi SIMRS | Login, rawat jalan, audit, worker dan area terdampak lulus tes yang ada. |

## Pipeline, risiko dan operasi

- CI: install terkunci → lint/typecheck → unit/integration dengan DB → migration test fresh dan upgrade → build → dependency dan image scan serta SBOM → E2E dan visual. Promosi artefak yang sama antar-environment, simpan hash, laporan dan migration version.
- Deploy: environment dev/staging/prod terpisah; backup sebelum migration, edition/config RS tervalidasi, changeset expand/contract, readiness dan smoke, feature flag per fasilitas. IDP, privilege dan secrets dikelola terpusat. TLS dan enkripsi storage/backup. Gunakan role DB terpisah untuk runtime dan migrasi. Prod memakai diagnostic redaction dan pencadangan otomatis.
- Keamanan: cek otorisasi resource dan lampiran, session hardening, MFA sesuai kebijakan, rate limit, validasi scanner dan upload, scanning bukti, XSS/CSRF sesuai model sesi, audit update akses, ekspor dan perubahan konfigurasi. Threat review defensif untuk tukar label, penyalahgunaan role, manipulasi evidence, kebocoran ekspor dan replay. Uji dan catat kontrol.
- Observabilitas: metrik latency, errors, saturation, queue age, hasil tertahan, DLQ, recall belum dikonfirmasi, readiness dan korelasi request dengan outbox. Log tidak memuat secret, payload sensitif, atau identitas pasien. Alarm memiliki pemilik dan runbook.
- Restore: backup database serta bukti, WAL/PITR, uji restore ke lingkungan terisolasi. Rekonsiliasi checksum, event terakhir, paket/posisi, audit, dan pergerakan fisik setelah downtime. Rollback aplikasi kompatibel dengan schema. Restore DB membutuhkan langkah rekonsiliasi agar catatan fisik dan digital selaras.
- Peluncuran: baseline saldo/master, migrasi uji, shadow workflow bila RS menyetujui, cutover per fasilitas dan shift, training, sign-off dan masa dukungan. Tetapkan titik rollback aplikasi serta prosedur downtime sebelum activation.
- Checklist go-live: Kepala CSSD/PPI menyetujui SOP/IFU dan device profile; TI menyetujui role, infra, pemulihan, load dan keamanan; RME/privasi menyetujui retensi dan data klinis; pemilik layanan menyetujui UAT, training dan support. Gerbang evidence status PASS/FAIL/BLOCKED, dengan ID tes, run link, tanggal dan nama reviewer. Aturan ini tidak dapat diasumsikan lulus dari fixture.
