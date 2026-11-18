// Berjalan sekali saat server Node.js mulai.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { prisma } = await import('./server/db');
  // WAL: pembaca tidak menunggu penulis, penting untuk banyak stasiun sekaligus.
  // busy_timeout: penulisan bersamaan menunggu sebentar alih-alih langsung gagal.
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON');

  if (process.env.CSSD_DISABLE_AUTO_BACKUP === '1') return;
  const { ensureDailyBackup } = await import('./server/backup');
  const run = () =>
    ensureDailyBackup().catch((error: Error) => console.error(JSON.stringify({ level: 'error', task: 'daily-backup', message: error.message })));
  void run();
  // Diperiksa tiap jam; backup hanya dibuat sekali per hari.
  setInterval(run, 60 * 60 * 1000).unref();
}
