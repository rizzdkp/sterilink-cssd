import type {
  EvidenceKind,
  EvidenceOutcome,
  ProcessStatus,
  QualityStatus,
  QueueStatus,
} from '@/generated/prisma/enums';

export interface EvidenceState {
  kind: EvidenceKind;
  outcome: EvidenceOutcome;
}

export interface LoadState {
  processStatus: ProcessStatus;
  qualityStatus: QualityStatus;
  evidence: readonly EvidenceState[];
}

/**
 * Proyeksi status antrean dari status proses, status mutu dan bukti.
 * Hanya untuk tampilan dan filter. Kelayakan lepas tetap dihitung ulang di
 * transaksi pelepasan, bukan dibaca dari nilai ini.
 */
export function projectQueueStatus(load: LoadState): QueueStatus {
  if (load.processStatus === 'CANCELLED' || load.processStatus === 'ABORTED') return 'CLOSED';
  if (load.qualityStatus === 'RELEASED') return 'RELEASED';
  if (load.qualityStatus === 'REJECTED') return 'REJECTED';
  if (load.qualityStatus === 'HOLD') return 'HELD';
  if (load.processStatus === 'DRAFT' || load.processStatus === 'LOADED') return 'WAITING_PROCESS';
  if (load.processStatus === 'RUNNING') return 'RUNNING';

  const required = load.evidence.filter((item) => item.outcome !== 'NOT_REQUIRED');
  // Bukti gagal perlu keputusan reviewer sekarang, jadi tidak menunggu hasil lain.
  if (required.some((item) => item.outcome === 'FAIL')) return 'READY_FOR_REVIEW';
  if (required.length === 0 || required.some((item) => item.outcome === 'PENDING')) {
    return 'AWAITING_EVIDENCE';
  }
  return 'READY_FOR_REVIEW';
}

export const QUEUE_TABS = ['ALL', 'WAITING_PROCESS', 'STERILIZATION', 'VERIFICATION', 'DONE'] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

/**
 * Definisi tahap tiap tab. Kelompoknya saling lepas, sehingga jumlah empat tab
 * selalu sama dengan "Semua". "Menunggu hasil" dan "Menunggu verifikasi" berada
 * di tab yang sama dan dibedakan lewat label status.
 */
export const TAB_STATUSES: Record<Exclude<QueueTab, 'ALL'>, readonly QueueStatus[]> = {
  WAITING_PROCESS: ['WAITING_PROCESS'],
  STERILIZATION: ['RUNNING'],
  VERIFICATION: ['AWAITING_EVIDENCE', 'READY_FOR_REVIEW', 'HELD'],
  DONE: ['RELEASED', 'REJECTED', 'CLOSED'],
};

export type StepState = 'done' | 'current' | 'upcoming';

export const STAGES = ['RECEIVING', 'DECONTAMINATION', 'PACKING', 'STERILIZATION', 'VERIFICATION'] as const;

/** Berapa tahap yang sudah selesai dan tahap mana yang sedang berjalan. */
export function stageProgress(status: QueueStatus): { done: number; current: number | null } {
  switch (status) {
    case 'WAITING_PROCESS':
    case 'RUNNING':
      return { done: 3, current: 3 };
    case 'AWAITING_EVIDENCE':
    case 'READY_FOR_REVIEW':
    case 'HELD':
      return { done: 4, current: 4 };
    case 'RELEASED':
      return { done: 5, current: null };
    case 'REJECTED':
      return { done: 4, current: null };
    case 'CLOSED':
      return { done: 0, current: null };
  }
}
