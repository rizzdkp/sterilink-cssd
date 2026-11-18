import { z } from 'zod';
import { QUEUE_TABS } from './status';

export const QUEUE_SORTS = ['code:desc', 'code:asc', 'startedAt:desc', 'startedAt:asc', 'targetAt:desc', 'targetAt:asc'] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

export const QUEUE_STATUSES = [
  'WAITING_PROCESS',
  'RUNNING',
  'AWAITING_EVIDENCE',
  'READY_FOR_REVIEW',
  'HELD',
  'RELEASED',
  'REJECTED',
] as const;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

const queueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().min(1).max(80).optional(),
  unitId: z.string().trim().min(1).max(64).optional(),
  setTypeId: z.string().trim().min(1).max(64).optional(),
  method: z.enum(['STEAM', 'LOW_TEMP']).optional(),
  status: z.enum(QUEUE_STATUSES).optional(),
  tab: z.enum(QUEUE_TABS).default('ALL'),
  sort: z.enum(QUEUE_SORTS).default('code:desc'),
});

export type QueueQuery = z.infer<typeof queueQuerySchema>;

export type RawQuery = Record<string, string | string[] | undefined>;

export type ParseResult = { ok: true; query: QueueQuery } | { ok: false; fieldErrors: Record<string, string[]> };

// Form GET mengirim string kosong untuk filter yang tidak dipilih.
function withoutBlanks(raw: RawQuery): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first.trim() !== '') cleaned[key] = first;
  }
  return cleaned;
}

/** Validasi ketat untuk API: nilai salah menghasilkan 400 dengan fieldErrors. */
export function parseQueueQuery(raw: RawQuery): ParseResult {
  const result = queueQuerySchema.safeParse(withoutBlanks(raw));
  if (result.success) return { ok: true, query: result.data };
  return { ok: false, fieldErrors: z.flattenError(result.error).fieldErrors };
}

/**
 * Validasi longgar untuk halaman: parameter URL yang salah dibuang dan diganti
 * nilai bawaan, supaya tautan lama atau salah ketik tetap membuka antrean.
 */
export function parseQueueQueryLenient(raw: RawQuery): QueueQuery {
  const cleaned = withoutBlanks(raw);
  const first = queueQuerySchema.safeParse(cleaned);
  if (first.success) return first.data;
  for (const issue of first.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string') delete cleaned[key];
  }
  return queueQuerySchema.parse(cleaned);
}

const SCAN_CODE = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

/** Kode hasil pindai: buang spasi, seragamkan huruf besar, batasi karakter. */
export function normalizeScanCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return SCAN_CODE.test(code) ? code : null;
}
