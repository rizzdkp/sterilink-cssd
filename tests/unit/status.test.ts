import { describe, expect, it } from 'vitest';
import { QUEUE_STATUSES } from '@/server/queue/params';
import { TAB_STATUSES, projectQueueStatus, stageProgress } from '@/server/queue/status';

const pass = (kind: 'PHYSICAL' | 'CHEMICAL' | 'BIOLOGICAL') => ({ kind, outcome: 'PASS' as const });

describe('projectQueueStatus', () => {
  it('menunggu proses sebelum siklus dimulai', () => {
    expect(projectQueueStatus({ processStatus: 'LOADED', qualityStatus: 'PENDING', evidence: [] })).toBe('WAITING_PROCESS');
  });

  it('sterilisasi saat siklus berjalan', () => {
    expect(projectQueueStatus({ processStatus: 'RUNNING', qualityStatus: 'PENDING', evidence: [] })).toBe('RUNNING');
  });

  it('siklus selesai tanpa bukti tetap menunggu hasil, bukan siap ditinjau', () => {
    expect(projectQueueStatus({ processStatus: 'CYCLE_COMPLETED', qualityStatus: 'PENDING', evidence: [] })).toBe('AWAITING_EVIDENCE');
  });

  it('satu bukti wajib tertunda menahan batch di menunggu hasil (T03)', () => {
    const evidence = [pass('PHYSICAL'), pass('CHEMICAL'), { kind: 'BIOLOGICAL' as const, outcome: 'PENDING' as const }];
    expect(projectQueueStatus({ processStatus: 'CYCLE_COMPLETED', qualityStatus: 'PENDING', evidence })).toBe('AWAITING_EVIDENCE');
  });

  it('semua bukti wajib memenuhi berarti siap ditinjau, belum dilepas', () => {
    const evidence = [pass('PHYSICAL'), pass('CHEMICAL'), pass('BIOLOGICAL')];
    expect(projectQueueStatus({ processStatus: 'CYCLE_COMPLETED', qualityStatus: 'PENDING', evidence })).toBe('READY_FOR_REVIEW');
  });

  it('bukti tidak diwajibkan tidak menahan batch', () => {
    const evidence = [pass('PHYSICAL'), pass('CHEMICAL'), { kind: 'BIOLOGICAL' as const, outcome: 'NOT_REQUIRED' as const }];
    expect(projectQueueStatus({ processStatus: 'CYCLE_COMPLETED', qualityStatus: 'PENDING', evidence })).toBe('READY_FOR_REVIEW');
  });

  it('bukti gagal langsung meminta keputusan reviewer', () => {
    const evidence = [pass('PHYSICAL'), { kind: 'CHEMICAL' as const, outcome: 'FAIL' as const }, { kind: 'BIOLOGICAL' as const, outcome: 'PENDING' as const }];
    expect(projectQueueStatus({ processStatus: 'CYCLE_COMPLETED', qualityStatus: 'PENDING', evidence })).toBe('READY_FOR_REVIEW');
  });

  it('keputusan mutu mengalahkan status proses', () => {
    const base = { processStatus: 'CYCLE_COMPLETED' as const, evidence: [] };
    expect(projectQueueStatus({ ...base, qualityStatus: 'RELEASED' })).toBe('RELEASED');
    expect(projectQueueStatus({ ...base, qualityStatus: 'HOLD' })).toBe('HELD');
    expect(projectQueueStatus({ ...base, qualityStatus: 'REJECTED' })).toBe('REJECTED');
  });

  it('muatan batal atau gagal ditutup', () => {
    expect(projectQueueStatus({ processStatus: 'ABORTED', qualityStatus: 'PENDING', evidence: [] })).toBe('CLOSED');
  });
});

describe('definisi tab', () => {
  it('setiap status antrean masuk tepat satu tab', () => {
    const all = Object.values(TAB_STATUSES).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const status of QUEUE_STATUSES) expect(all).toContain(status);
  });
});

describe('stageProgress', () => {
  it('selesai siklus belum menandai verifikasi selesai', () => {
    expect(stageProgress('READY_FOR_REVIEW')).toEqual({ done: 4, current: 4 });
  });

  it('hanya batch dilepas yang menyelesaikan kelima tahap', () => {
    expect(stageProgress('RELEASED')).toEqual({ done: 5, current: null });
  });
});
