import AxeBuilder from '@axe-core/playwright';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { E2E_PASSWORD } from '../../playwright.config';

export type Role = 'RECEIVING' | 'PACKING' | 'MACHINE' | 'REVIEWER' | 'WAREHOUSE' | 'UNIT' | 'UNIT_VK' | 'SUPERVISOR' | 'AUDITOR' | 'ADMIN';

export const USERNAMES: Record<Role, string> = {
  RECEIVING: 'latihan.penerimaan',
  PACKING: 'latihan.pengemasan',
  MACHINE: 'latihan.mesin',
  REVIEWER: 'latihan.reviewer',
  WAREHOUSE: 'latihan.distribusi',
  UNIT: 'latihan.unit.ok',
  UNIT_VK: 'latihan.unit.vk',
  SUPERVISOR: 'latihan.supervisor',
  AUDITOR: 'latihan.auditor',
  ADMIN: 'latihan.admin',
};

/** Masuk lewat endpoint Better Auth yang sama dengan formulir login; cookie sesi tersimpan di konteks. */
export async function loginAs(context: BrowserContext, role: Role, password = E2E_PASSWORD) {
  await context.clearCookies();
  const response = await context.request.post('/api/auth/sign-in/username', {
    data: { username: USERNAMES[role], password },
    headers: { origin: 'http://localhost:3300' },
  });
  expect(response.ok(), `login ${role}: ${response.status()}`).toBe(true);
}

/** Tidak ada pelanggaran aksesibilitas tingkat serius atau kritis (WCAG 2.2 AA). */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Halaman tidak boleh menggulir mendatar (reflow 390 px). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Pesan sukses (wilayah status halaman). */
export async function expectSaved(page: Page, text: string | RegExp) {
  await expect(page.getByRole('status').filter({ hasText: text })).toBeVisible();
}

/** Pesan penolakan formulir aksi (bukan pengumum rute Next.js yang juga ber-role alert). */
export function rejection(page: Page) {
  return page.locator('.feedback--error');
}

/** Ambil kode yang disebut pesan sukses, misalnya "Paket PK-0106 dibuat". */
export async function codeFrom(page: Page, pattern: RegExp): Promise<string> {
  const message = page.getByRole('status').filter({ hasText: pattern });
  await expect(message).toBeVisible();
  const match = (await message.innerText()).match(pattern);
  if (!match?.[1]) throw new Error(`Pesan tidak memuat kode: ${pattern}`);
  return match[1];
}
