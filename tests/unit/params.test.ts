import { describe, expect, it } from 'vitest';
import { queueHref } from '@/lib/queue-url';
import { normalizeScanCode, parseQueueQuery, parseQueueQueryLenient } from '@/server/queue/params';

describe('parseQueueQuery (API, ketat)', () => {
  it('memakai nilai bawaan kontrak: halaman 1, 10 baris, tab Semua', () => {
    const result = parseQueueQuery({});
    expect(result).toEqual({ ok: true, query: { page: 1, pageSize: 10, tab: 'ALL', sort: 'code:desc' } });
  });

  it('mengabaikan string kosong dari form GET', () => {
    const result = parseQueueQuery({ q: '  ', unitId: '', method: '' });
    expect(result.ok).toBe(true);
  });

  it('menolak pageSize di atas 100 dengan fieldErrors', () => {
    const result = parseQueueQuery({ pageSize: '500' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toHaveProperty('pageSize');
  });

  it('menolak status dan urutan di luar daftar yang diizinkan', () => {
    const result = parseQueueQuery({ status: 'DROP TABLE', sort: 'password:asc' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(['sort', 'status']);
  });
});

describe('parseQueueQueryLenient (halaman)', () => {
  it('membuang hanya parameter yang salah dan mempertahankan sisanya', () => {
    const query = parseQueueQueryLenient({ page: 'abc', tab: 'DONE', status: 'TIDAK-ADA', q: 'katarak' });
    expect(query).toMatchObject({ page: 1, tab: 'DONE', q: 'katarak' });
    expect(query.status).toBeUndefined();
  });
});

describe('normalizeScanCode', () => {
  it('merapikan spasi dan huruf kecil dari scanner atau ketikan', () => {
    expect(normalizeScanCode('  bt-0021 ')).toBe('BT-0021');
  });

  it('menolak karakter yang bukan huruf, angka atau tanda hubung', () => {
    expect(normalizeScanCode('BT-0021; --')).toBeNull();
    expect(normalizeScanCode('../etc')).toBeNull();
    expect(normalizeScanCode('')).toBeNull();
  });
});

describe('queueHref', () => {
  const base = parseQueueQueryLenient({});

  it('tidak menulis nilai bawaan ke URL', () => {
    expect(queueHref(base)).toBe('/cssd');
  });

  it('menyimpan filter, halaman dan batch terpilih', () => {
    expect(queueHref({ ...base, tab: 'DONE', page: 2 }, {}, 'BT-0012')).toBe('/cssd?tab=DONE&page=2&batch=BT-0012');
  });

  it('melepas batch terpilih saat pindah halaman', () => {
    expect(queueHref(base, { page: 2 })).toBe('/cssd?page=2');
  });
});
