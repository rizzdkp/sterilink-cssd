import type { CaseStatus, LineOutcome, PackagePosition, QualityStatus, RecallItemStatus } from '@/generated/prisma/enums';
import type { Tone } from './format';

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone }> = {
  RECEIVED: { label: 'Menunggu dekontaminasi', tone: 'neutral' },
  INSPECTION: { label: 'Menunggu inspeksi', tone: 'progress' },
  PACKING: { label: 'Siap dikemas', tone: 'wait' },
  PACKAGED: { label: 'Dikemas', tone: 'pass' },
};

export const POSITION: Record<PackagePosition, string> = {
  CSSD: 'Di CSSD',
  AVAILABLE: 'Tersedia di rak',
  DISPATCHED: 'Dalam pengiriman',
  RECEIVED: 'Diterima unit',
  USED: 'Sudah digunakan',
  RETURNED: 'Kembali ke CSSD',
};

export const QUALITY: Record<QualityStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Belum dilepas', tone: 'neutral' },
  RELEASED: { label: 'Dilepas', tone: 'pass' },
  HOLD: { label: 'Ditahan', tone: 'hold' },
  REJECTED: { label: 'Ditolak', tone: 'hold' },
};

export const LINE_OUTCOME: Record<LineOutcome, { label: string; tone: Tone }> = {
  PENDING: { label: 'Menunggu konfirmasi', tone: 'wait' },
  RECEIVED: { label: 'Diterima', tone: 'pass' },
  REJECTED: { label: 'Ditolak unit', tone: 'hold' },
};

export const RECALL_ITEM: Record<RecallItemStatus, { label: string; tone: Tone }> = {
  IDENTIFIED: { label: 'Belum ditindaklanjuti', tone: 'wait' },
  RECOVERED: { label: 'Berhasil ditarik', tone: 'pass' },
  USED: { label: 'Sudah digunakan', tone: 'hold' },
  NOT_FOUND: { label: 'Belum ditemukan', tone: 'hold' },
};

export const REQUEST_STATUS: Record<'OPEN' | 'PARTIAL' | 'FULFILLED' | 'CANCELLED', { label: string; tone: Tone }> = {
  OPEN: { label: 'Menunggu dipenuhi', tone: 'wait' },
  PARTIAL: { label: 'Sebagian terkirim', tone: 'progress' },
  FULFILLED: { label: 'Terpenuhi', tone: 'pass' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
};
