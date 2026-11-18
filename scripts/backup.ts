// Backup terjadwal dari luar aplikasi (Task Scheduler Windows atau cron), sebagai
// pelengkap backup harian otomatis di dalam aplikasi.
//   pnpm backup
import { createBackup } from '../src/server/backup';
import { prisma } from '../src/server/db';

createBackup('daily')
  .then((file) => console.log(`Backup dibuat: ${file.name} (${Math.round(file.size / 1024)} KB)`))
  .catch((error: Error) => {
    console.error(`Backup gagal: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
