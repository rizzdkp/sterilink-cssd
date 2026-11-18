import { defineConfig } from 'prisma/config';

// Satu file SQLite, tanpa server database. DATABASE_URL hanya perlu diisi
// bila lokasi file ingin dipindah (misalnya saat pengujian).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
});
