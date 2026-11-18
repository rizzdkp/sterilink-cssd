import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { username } from 'better-auth/plugins/username';
import { prisma } from './db';

// Jalur runtime, bukan berkas sumber: dikecualikan dari penelusuran bundel.
const SECRET_FILE = resolve(/* turbopackIgnore: true */ process.cwd(), process.env.CSSD_SECRET_FILE ?? 'prisma/.auth-secret');

/**
 * Rahasia penandatangan sesi. Pakai BETTER_AUTH_SECRET bila diisi; bila tidak,
 * dibuat acak sekali saat pertama berjalan dan disimpan di samping database
 * (bukan di repositori), sehingga instalasi rumah sakit tidak memakai nilai bawaan.
 */
function authSecret(): string {
  const fromEnv = process.env.BETTER_AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, 'utf8').trim();
  const secret = randomBytes(48).toString('base64url');
  mkdirSync(dirname(SECRET_FILE), { recursive: true });
  writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

const loginLimit = Number(process.env.CSSD_LOGIN_RATE_MAX ?? 10);

export const auth = betterAuth({
  appName: 'SIMRS CSSD',
  // Alamat publik aplikasi (misalnya https://cssd.rs-contoh.go.id). Bila kosong,
  // diambil dari permintaan, sehingga akses lewat IP atau nama host intranet tetap bekerja.
  ...(process.env.BETTER_AUTH_URL ? { baseURL: process.env.BETTER_AUTH_URL } : {}),
  ...(process.env.CSSD_TRUSTED_ORIGINS ? { trustedOrigins: process.env.CSSD_TRUSTED_ORIGINS.split(',').map((item) => item.trim()) } : {}),
  secret: authSecret(),
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    // Tidak ada pendaftaran mandiri: akun dibuat admin rumah sakit.
    disableSignUp: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    // Satu shift panjang; diperpanjang selama dipakai.
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 30,
    // Tanpa cache cookie: penonaktifan akun berlaku pada permintaan berikutnya.
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 200,
    customRules: {
      '/sign-in/username': { window: 15 * 60, max: loginLimit },
      '/sign-in/email': { window: 15 * 60, max: loginLimit },
      '/change-password': { window: 15 * 60, max: loginLimit },
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', input: false, defaultValue: 'AUDITOR' },
      facilityId: { type: 'string', input: false, required: false },
      unitId: { type: 'string', input: false, required: false },
      active: { type: 'boolean', input: false, defaultValue: true },
      mustChangePassword: { type: 'boolean', input: false, defaultValue: true },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Akun nonaktif tidak bisa membuka sesi baru walau kata sandinya benar.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { active: true } });
          if (!user?.active) {
            throw new APIError('FORBIDDEN', { message: 'Akun ini dinonaktifkan. Hubungi admin CSSD.' });
          }
          return { data: session };
        },
      },
    },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 32 }),
    // Harus terakhir: menyetel cookie sesi dari Server Action.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
