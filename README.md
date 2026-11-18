# SIMRS CSSD

Modul Instalasi Sterilisasi Sentral untuk SIMRS: permintaan unit, penerimaan tray, dekontaminasi, inspeksi per komponen, pengemasan dan label, siklus mesin, keputusan mutu, stok steril dengan kedaluwarsa, distribusi, penggunaan, recall dan CAPA, laporan, audit, dan backup.

Lingkup, status per requirement dan rencana lanjutan: [CSSD-Master/PRD-MASTER.md](CSSD-Master/PRD-MASTER.md) (versi 2.0). Cara kerja tim: [CONTRIBUTING.md](CONTRIBUTING.md).

## Pemasangan di rumah sakit

Satu server (Windows atau Linux) dengan Node.js 20.9 atau lebih baru dan pnpm 9. Tidak perlu server database terpisah: data tersimpan di satu berkas SQLite.

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm db:setup
```

```bash
pnpm build
```

```bash
pnpm start
```

Buka alamat server di peramban. Database baru kosong, jadi aplikasi membuka **wizard pemasangan**: isi nama dan kode rumah sakit, zona waktu (WIB/WITA/WIT), dan akun admin pertama. Wizard tertutup permanen setelah itu.

Setelah masuk sebagai admin, halaman **Master** menampilkan daftar kesiapan operasional. Isi berurutan:

1. **Unit, rak, mesin**: unit pengguna (OK, VK, poli), rak penyimpanan steril, mesin sterilisasi beserta metodenya.
2. **Fasilitas dan kebijakan**: indikator wajib (fisik, kimia, biologis) per metode, dengan rujukan SOP/IFU rumah sakit. Tanpa kebijakan, siklus metode itu tidak bisa diselesaikan.
3. **Set dan tray**: setiap set dengan daftar komponen dan jumlahnya, masa simpan steril (hari), lalu tray fisik sesuai label yang terpasang.
4. **Pengguna**: satu akun per petugas dengan perannya. Kata sandi awal diberikan langsung dan wajib diganti saat masuk pertama.

Daftar kesiapan berubah menjadi "Siap dipakai operasional" bila semuanya terisi.

## Peran

| Peran               | Pekerjaan                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Petugas Unit        | Meminta set untuk unitnya, menerima atau menolak paket, mencatat penggunaan                  |
| Operator Penerimaan | Menerima tray kotor, mencatat dekontaminasi                                                  |
| Operator Pengemasan | Inspeksi per komponen, membuat paket, mencetak label Code 128                                |
| Operator Mesin      | Menyusun muatan, menjalankan siklus, mencatat bukti                                          |
| Reviewer Mutu       | Mencatat bukti, melepas, menahan, menolak (tidak untuk batch yang ia jalankan sendiri)       |
| Petugas Distribusi  | Memenuhi permintaan, mengirim paket, menempatkan dan memindah rak, menarik paket kedaluwarsa |
| Supervisor CSSD     | Recall dan CAPA, laporan, audit                                                              |
| Auditor             | Membaca semua, laporan, audit, ekspor                                                        |
| Admin CSSD          | Master, kebijakan, akun, backup. Tidak memproses atau melepas paket.                         |

## Konfigurasi

Semua opsional. Isi lewat variabel lingkungan layanan.

| Variabel                     | Bawaan                 | Keterangan                                                                                                 |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               | `file:./prisma/dev.db` | Lokasi berkas database. Letakkan di disk yang dicadangkan.                                                 |
| `BETTER_AUTH_URL`            | dari permintaan        | Alamat publik aplikasi, misalnya `https://cssd.rs.go.id`. Isi bila memakai HTTPS di balik proxy.           |
| `BETTER_AUTH_SECRET`         | dibuat otomatis        | Rahasia sesi (minimal 32 karakter). Bila kosong, dibuat acak sekali dan disimpan di `prisma/.auth-secret`. |
| `CSSD_TRUSTED_ORIGINS`       | kosong                 | Alamat tambahan yang boleh mengirim formulir login, dipisah koma.                                          |
| `CSSD_BACKUP_DIR`            | `backups`              | Folder backup otomatis.                                                                                    |
| `CSSD_BACKUP_RETENTION_DAYS` | `14`                   | Lama backup disimpan.                                                                                      |
| `CSSD_LOGIN_RATE_MAX`        | `10`                   | Percobaan masuk per 15 menit per alamat.                                                                   |

## Backup dan pemulihan

- Backup harian dibuat otomatis oleh aplikasi (`VACUUM INTO`, aman saat aplikasi berjalan) dan disimpan 14 hari.
- Admin bisa membuat dan mengunduh backup kapan saja dari **Master, Backup**. Setiap unduhan tercatat di audit.
- Untuk jadwal dari luar aplikasi (Task Scheduler atau cron): `pnpm backup`.
- Langkah pemulihan tertulis di halaman Backup. Uji pemulihan ke server terpisah sebelum go-live.

## Keamanan

- Kata sandi di-hash (scrypt) oleh Better Auth; sesi 12 jam di database, cookie httpOnly dan sameSite.
- Masuk dibatasi 10 percobaan per 15 menit; pesan salah sandi tidak membedakan username yang ada.
- Akun nonaktif tidak bisa masuk; perubahan peran atau penonaktifan mencabut sesi seketika.
- Setiap aksi diperiksa kapabilitas peran dan lingkup fasilitas/unit di server, dalam transaksi, dan tercatat di audit atas nama orangnya.
- Ekspor CSV dinetralkan dari formula injection dan tercatat di audit.
- `pnpm audit --prod`: tidak ada kerentanan yang diketahui pada dependensi produksi saat rilis ini.

## Pencatatan saat sistem mati

Penerimaan tray dan hasil indikator bisa dicatat dengan waktu kejadian sebenarnya (paling jauh 72 jam ke belakang) beserta alasannya. Waktu pencatatan server tetap tersimpan terpisah.

## Data latihan

Untuk pelatihan petugas atau server staging, muat data latihan ke database **kosong**:

```bash
CSSD_TRAINING_PASSWORD="<sandi latihan pilihan Anda>" pnpm db:seed:training
```

Isinya 12 batch contoh, set, mesin, rak, tray, dan satu akun per peran (`latihan.admin`, `latihan.penerimaan`, `latihan.unit.ok`, dan seterusnya) dengan kata sandi dari variabel tersebut. Semua batch latihan berlabel "Data latihan". Perintah ini menolak berjalan di production atau pada database yang sudah dipasang.

## Pengembangan dan pengujian

| Perintah                          | Fungsi                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                        | Server pengembangan                                                                                                                                                         |
| `pnpm check`                      | Format, lint, typecheck dan tes sekaligus (sama dengan CI)                                                                                                                  |
| `pnpm typecheck`                  | Pemeriksaan tipe                                                                                                                                                            |
| `pnpm test`                       | 75 tes unit dan integrasi pada SQLite nyata                                                                                                                                 |
| `pnpm build` lalu `pnpm test:e2e` | 29 tes Playwright terhadap build produksi: alur lengkap lintas peran, login, akun, master, laporan, audit, backup, aksesibilitas axe WCAG 2.2 AA, reflow 1440/1280/1024/390 |

## Batas yang tetap membutuhkan rumah sakit

Aplikasi bisa dipakai penuh tanpa hal berikut; data dicatat petugas secara manual. Integrasi ini butuh kontrak dengan pihak luar sehingga tidak dibuat tiruan:

- Login lewat SSO/IdP rumah sakit (saat ini akun lokal per petugas).
- Integrasi SIMRS/RME untuk referensi tindakan pasien, CMMS, impor otomatis dari mesin, SATUSEHAT.

Sebelum go-live, pemilik layanan tetap menandatangani: SOP/IFU yang dimasukkan ke kebijakan, UAT per peran, uji pemulihan backup, dan pelatihan petugas (PRD-MASTER bagian 8).
