# Kontrak data, status dan API CSSD

> **Catatan v2.0 (18 Nov 2026):** stack yang dibangun adalah satu aplikasi Next.js + Prisma/SQLite + Better Auth, bukan monorepo NestJS/PostgreSQL. Lihat PRD-MASTER bagian 3 (ADR 01–06). Bagian di bawah yang menyebut stack lama tetap berlaku sebagai prinsip, bukan struktur folder.

## Model relasional

UUID internal, kode dibaca manusia unik per organisasi sesuai jenis, FK scoped dan indeks pencarian gabungan. Simpan waktu UTC dan representasi zona RS. Gunakan `occurredAt` dan `recordedAt` untuk entri retrospektif. Kolom audit menyimpan actor, facility, source, requestId dan alasan. Rekaman historis menggunakan inaktivasi atau koreksi yang tertaut.

| Agregat | Entitas dan data minimum | Invariant |
| --- | --- | --- |
| Referensi | Facility, Unit, Workstation, Zone, Location, InstrumentType, Alias, Tray, SetTemplateVersion, Component, Vendor, MaterialLot | Referensi lintas scope ditolak. Versi template melekat pada Package dan checklist. |
| Kebijakan | Device, MaintenanceRecord, ProgramVersion, PolicyVersion, Requirement, Competency | Profil aktif berdasarkan mesin, metode, jenis muatan dan waktu. Konfigurasi yang belum disahkan hanya tersedia pada mode demo. |
| Permintaan dan masuk | Request, RequestLine, DirtyManifest, ManifestLine, Receipt, ReceiptLine, ReprocessingCase | Kuantitas valid dan kumulatif. Hanya satu proses aktif per tray fisik pada model awal, dengan penguncian saat buka kasus. Kasus proses ulang menunjuk asal. |
| Proses | CleaningRun, Inspection, InspectionLine, Package, PackageItemSnapshot, LabelPrintEvent | Hasil didokumentasikan per percobaan. Paket punya ID baru setelah repack, sedangkan cetak ulang mempertahankan ID. |
| Siklus dan bukti | Load, LoadPackage, MonitoringResult, Attachment, QualityDecision, Hold | Hanya satu muatan aktif per paket. Profil efektif dan identitas mesin disimpan. Hasil scope mesin/muatan/paket; koreksi menunjuk hasil lama. Pelepasan mencatat revisi bukti dan aktor. |
| Inventori | StockMovement, PackagePosition, Reservation, Handover, HandoverLine, UsageReference | Pergerakan ledger dan snapshot posisi atomik. Hanya satu reservasi aktif, satu perpindahan efektif, dan satu posisi terakhir per paket. |
| Insiden | Incident, Recall, RecallItem, Notice, Acknowledgement, CorrectiveAction, Disposition | Scope disimpan dengan alasan, kriteria dan paket yang ditetapkan. Satu paket bisa punya beberapa blok aktif. Penyelesaian satu blok mempertahankan blok lain. |
| Sistem | AuditEvent, Outbox, Inbox, IdempotencyRecord, ImportJob, ReconciliationItem | Audit dan outbox ditulis bersama perubahan domain. Dedupe integrasi dengan ID stabil. Payload audit diminimalkan. |

Dokumentasikan FK, jenis, nullability dan indeks dalam Prisma. Gunakan migration SQL ketika constraint parsial atau trigger diperlukan. Indeks awal: `facilityId, status, occurredAt DESC`, kode unik yang ternormalisasi, `deviceId, startedAt`, FK package/load, `destinationUnitId, status`, `recallId, status`. Uji constraint dengan database nyata (SQLite salinan per file tes) dalam CI.

## Status dan transisi

| Agregat | Transisi reguler | Jalur pengecualian |
| --- | --- | --- |
| Kasus | RECEIVED → CLEANING → INSPECTION → PACKAGED → CLOSED | Pengecualian membuka nonconformity dengan alasan dan keputusan; percobaan baru terdokumentasi. |
| Muatan | DRAFT → LOADED → RUNNING → CYCLE_COMPLETED | CANCELLED atau ABORTED menyimpan histori dan keputusan paket. Muatan selesai melalui aksi rekam siklus. |
| Mutu | PENDING → RELEASED setelah gate | HOLD / REJECTED / UNDER_REVIEW. Evaluasi ulang mereferensi keputusan sebelumnya. HOLD dapat kembali PENDING sesuai SOP. |
| Bukti | PENDING, PASS, FAIL, NOT_REQUIRED | Catat hasil pengganti dengan relasi supersedes dan audit. Bedakan bukti belum tersedia dan tidak diwajibkan. |
| Posisi | CSSD → AVAILABLE → RESERVED → DISPATCHED → RECEIVED → USED atau RETURNED | DISPOSED, Release kembali untuk paket retur hanya jika ada kebijakan dan bukti yang sesuai. Blok aktif mengeluarkan paket dari ketersediaan di mana pun. |
| Recall item | IDENTIFIED → NOTIFIED/BLOCKED → ACKNOWLEDGED → DISPOSITIONED | RECOVERED, USED, NOT_FOUND dan keputusan konflik disimpan sebelum penutupan. |

Gate pelepasan meminta reviewer berizin, versi entitas terbaru, siklus tercatat, bukti wajib valid di scope yang tepat, mesin dan muatan mengikuti profil, integritas paket, serta tidak ada blok pencegah pelepasan. Pekerjaan yang hanya menunggu bukti dapat dievaluasi lagi ketika hasil dicatat. Hitung ulang ketika mengirim. Untuk release, dispatch, hold dan recall bersamaan, evaluasi di dalam transaksi, kunci record dalam urutan deterministik, dan perbarui hanya versi yang cocok. Satu pemenang untuk aksi yang saling meniadakan. Proyeksi antrean tidak menjadi sumber kelayakan.

## API HTTP

Prefix `/api/v1/cssd`. Mutasi lewat Server Actions dengan validasi zod; API baca di route handler Next.js. JSON camelCase; timestamp ISO 8601. Auth dari kontrak SIMRS/IdP, scope dari penugasan server. Respons daftar `{items, page, pageSize, total}` dengan sort stabil, default pageSize 10, batas 100. Gunakan indeks dan daftar filter/sort yang diizinkan. Mutasi membawa `expectedVersion` bila target sudah ada; pembaruan bersyarat di dalam transaksi menjamin satu pemenang dan yang kalah mendapat konflik (PRD-MASTER ADR 04).

| Endpoint relatif | Payload inti / hasil |
| --- | --- |
| GET /queue | page, pageSize, q, unitId, setTypeId, method, status, tab, sort → ringkasan baris dan hitungan tab cakupan. |
| GET /scan/{code}, GET /trace?code= | Identitas dan tipe entitas; status, lokasi/riwayat dan nextActions yang diizinkan. Hasil ambigu ditangani eksplisit. |
| GET /master/{kind}, POST /master/{kind}, PATCH /master/{kind}/{id} | Kind allowlist. Idifikasi, versi, atribut, efek waktu, alasan; gunakan DTO spesifik tiap kind. |
| POST /requests, POST /requests/{id}/cancel | destinationUnitId, priority, requestedByAt dan lines; alasan pembatalan. |
| POST /manifests, POST /receipts | originUnitId, tray/lines, kondisi, counts; receipt merujuk manifest, flag selisih, observedAt. |
| GET /cases/{id}, POST /cases/{id}/cleaning-runs | processProfileId, startedAt, completedAt, outcome, note dan evidenceIds jika relevan. |
| POST /cases/{id}/inspections, POST /cases/{id}/packages | checklistVersionId, actualCount, condition, componentId, disposition; pack materialLotId, inspectionId dan packageType. |
| POST /packages/{id}/label-events | action PRINT/REPRINT/VOID, printerId, reason bila dibutuhkan, referensi job. |
| GET /loads/{id}, POST /loads | deviceId, programVersionId, packageIds, expectedVersions; detail memuat summary, packages, evidence, currentDecision, nextActions. |
| POST /loads/{id}/transitions | action START / COMPLETE / ABORT, occurredAt, externalRunId jika ada, evidence references. |
| POST /loads/{id}/monitor-results | requirementId, scope, packageId jika berlaku, observedAt, outcome, source, rawValue/unit jika diperlukan, attachmentId, supersedesId. |
| POST /loads/{id}/release-decisions | decision RELEASE/HOLD/REJECT, packageIds, evidenceVersion, reason bila diwajibkan, expectedVersion. |
| POST /packages/{id}/holds, POST /holds/{id}/resolve | source, reason, kaitan insiden jika berlaku, alasan/tindakan penyelesaian. |
| GET /stock, POST /stock/movements, POST /reservations | location dan status. Mutasi dengan packageIds, lokasi asal/tujuan, tindakan dan expectedVersions. |
| POST /handovers, POST /handovers/{id}/acknowledgements | destinationUnitId, requestId bila relevan, packageIds/versions; hasil per item, waktu dan catatan selisih. |
| POST /packages/{id}/usage, POST /packages/{id}/returns | Referensi klinis yang diotorisasi, unit, waktu dan kondisi; kasus baru jika retur alat terpakai. |
| POST /incidents, POST /incidents/{id}/recall-preview, POST /incidents/{id}/recalls | Sebab, scope proposal, kriteria dan paket yang direview. Kirim konfirmasi dengan versi preview. Blokir secara atomik. |
| PATCH /recalls/{id}/items/{itemId}, POST /recalls/{id}/close | outcome, waktu, penanggung jawab/evidence, CAPA, penutupan berizin sesuai SOP. |
| POST /attachments, POST /attachments/{id}/complete | Metadata file, checksum, tipe/ukuran dan konteks; upload privat, validasi dan scanning sebelum dapat dipakai sebagai bukti. |
| GET /reports/{kind}, POST /exports, GET /audit | Daftar jenis baku, filter, scope, periode, zona, status export job dan tautan berumur pendek. |

POST sukses mengembalikan resource/command ID dan status baru. 400 validasi format, 401 sesi, 403 untuk kapabilitas yang kurang bila aman, 404 untuk entitas di luar scope, 409 konflik, 422 aturan domain, 429 rate limit. Envelope `{error:{code,message,requestId,fieldErrors?}}`. Contoh kode `CSSD_EVIDENCE_PENDING`, `CSSD_PACKAGE_HELD`, `CSSD_VERSION_CONFLICT`, `CSSD_SCAN_UNKNOWN`. Jangan mengungkap SQL, stack trace atau data pihak lain.

## Integrasi

Outbox entity/event type, schemaVersion, id, occurredAt, resourceId dan correlationId. Worker retry dengan backoff dan dead letter. Rekonsiliasi menghubungkan ID asal dan status; replay berizin dan dapat diaudit. Pengiriman memiliki dedupe. Timeouts tidak mengubah keputusan mutu. Enforce kontrak dan tes stub untuk IdP, RME, CMMS, printer dan mesin. Daftar bukti konfigurasi nyata diperlukan sebelum mengaktifkan jalur vendor.
