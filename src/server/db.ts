import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
}

// Satu koneksi per proses. Disimpan di globalThis supaya hot reload saat
// pengembangan tidak membuka koneksi baru setiap kali file berubah.
const globalForPrisma = globalThis as unknown as { cssdPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.cssdPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.cssdPrisma = prisma;
}
