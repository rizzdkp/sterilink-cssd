import type { EvidenceKind, EvidenceOutcome, QueueStatus, Stage, SterilizationMethod } from '@/generated/prisma/enums';

export type Tone = 'neutral' | 'wait' | 'progress' | 'pass' | 'hold';

export const STATUS_META: Record<QueueStatus, { label: string; tone: Tone }> = {
  WAITING_PROCESS: { label: 'Menunggu proses', tone: 'neutral' },
  RUNNING: { label: 'Sterilisasi', tone: 'progress' },
  AWAITING_EVIDENCE: { label: 'Menunggu hasil', tone: 'wait' },
  READY_FOR_REVIEW: { label: 'Menunggu verifikasi', tone: 'wait' },
  HELD: { label: 'Ditahan', tone: 'hold' },
  RELEASED: { label: 'Dilepas', tone: 'pass' },
  REJECTED: { label: 'Ditolak', tone: 'hold' },
  CLOSED: { label: 'Dibatalkan', tone: 'neutral' },
};

export const METHOD_LABEL: Record<SterilizationMethod, string> = {
  STEAM: 'Uap',
  LOW_TEMP: 'Suhu rendah',
};

export const STAGE_LABEL: Record<Stage, string> = {
  RECEIVING: 'Penerimaan',
  DECONTAMINATION: 'Dekontaminasi',
  PACKING: 'Pengemasan',
  STERILIZATION: 'Sterilisasi',
  VERIFICATION: 'Verifikasi',
};

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  PHYSICAL: 'Fisik',
  CHEMICAL: 'Kimia',
  BIOLOGICAL: 'Biologis',
};

export const OUTCOME_META: Record<EvidenceOutcome, { label: string; tone: Tone }> = {
  PASS: { label: 'Memenuhi', tone: 'pass' },
  PENDING: { label: 'Menunggu', tone: 'wait' },
  FAIL: { label: 'Tidak memenuhi', tone: 'hold' },
  NOT_REQUIRED: { label: 'Tidak diwajibkan', tone: 'neutral' },
};

// Semua waktu ditampilkan dalam zona fasilitas, bukan zona peramban, sehingga
// dua stasiun di kota berbeda membaca jam yang sama.
export function formatDate(iso: string | null, timeZone: string): string {
  if (!iso) return 'Belum ada';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export function formatClock(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
