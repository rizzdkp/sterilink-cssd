import { copyFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Setiap file tes memakai salinan database sendiri, sehingga tes yang mengubah
// data tidak memengaruhi hitungan fixture di file lain. Berjalan sebelum modul
// aplikasi diimpor, jadi src/server/db.ts membaca URL ini.
const file = `prisma/test-${randomUUID()}.db`;
copyFileSync('prisma/test-template.db', file);
process.env.DATABASE_URL = `file:./${file}`;
