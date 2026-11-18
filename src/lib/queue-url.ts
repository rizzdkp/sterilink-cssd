import { DEFAULT_PAGE_SIZE, type QueueQuery } from '@/server/queue/params';

type Overrides = Partial<QueueQuery> & { batch?: string | null };

/**
 * Tautan ke antrean dengan filter saat ini. Nilai bawaan tidak ditulis ke URL,
 * supaya alamat tetap pendek dan bisa dibagikan.
 */
export function queueHref(query: QueueQuery, overrides: Overrides = {}, batch: string | null = null): string {
  const next = { ...query, ...overrides };
  const selected = 'batch' in overrides ? overrides.batch : batch;
  const params = new URLSearchParams();
  if (next.tab !== 'ALL') params.set('tab', next.tab);
  if (next.q) params.set('q', next.q);
  if (next.unitId) params.set('unitId', next.unitId);
  if (next.setTypeId) params.set('setTypeId', next.setTypeId);
  if (next.method) params.set('method', next.method);
  if (next.status) params.set('status', next.status);
  if (next.sort !== 'code:desc') params.set('sort', next.sort);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(next.pageSize));
  if (next.page > 1) params.set('page', String(next.page));
  if (selected) params.set('batch', selected);
  const search = params.toString();
  return search ? `/cssd?${search}` : '/cssd';
}

export function hasActiveFilters(query: QueueQuery): boolean {
  return Boolean(query.q || query.unitId || query.setTypeId || query.method || query.status);
}
