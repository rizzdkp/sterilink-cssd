import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  ClockCountdownIcon,
  HandPalmIcon,
  HourglassIcon,
  MinusCircleIcon,
  XCircleIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { Icon } from '@phosphor-icons/react';
import type { EvidenceOutcome, QueueStatus } from '@/generated/prisma/enums';
import { OUTCOME_META, STATUS_META, type Tone } from '@/lib/format';

// Status tidak pernah disampaikan lewat warna saja: setiap tag membawa ikon dan
// label tertulis, sehingga tetap terbaca pada layar pudar atau buta warna.
const STATUS_ICON: Record<QueueStatus, Icon> = {
  WAITING_PROCESS: ClockCountdownIcon,
  RUNNING: ArrowsClockwiseIcon,
  AWAITING_EVIDENCE: HourglassIcon,
  READY_FOR_REVIEW: ClipboardTextIcon,
  HELD: HandPalmIcon,
  RELEASED: CheckCircleIcon,
  REJECTED: XCircleIcon,
  CLOSED: MinusCircleIcon,
};

const OUTCOME_ICON: Record<EvidenceOutcome, Icon> = {
  PASS: CheckCircleIcon,
  PENDING: HourglassIcon,
  FAIL: XCircleIcon,
  NOT_REQUIRED: MinusCircleIcon,
};

export function CssdStatusTag({ status }: { status: QueueStatus }) {
  const meta = STATUS_META[status];
  const StatusIcon = STATUS_ICON[status];
  return (
    <span className={`tag tag--${meta.tone}`}>
      <StatusIcon aria-hidden weight="bold" size={14} />
      {meta.label}
    </span>
  );
}

/**
 * Hasil indikator. Hijau hanya bila hasilnya memenuhi DAN waktu hasilnya tercatat:
 * hasil tanpa waktu belum bisa diverifikasi dan tampil netral.
 */
export function OutcomeTag({ outcome, observedAt }: { outcome: EvidenceOutcome; observedAt?: string | null }) {
  const unverified = (outcome === 'PASS' || outcome === 'FAIL') && observedAt === null;
  const meta = unverified ? { label: 'Belum terverifikasi', tone: 'neutral' as const } : OUTCOME_META[outcome];
  const OutcomeIcon = unverified ? OUTCOME_ICON.PENDING : OUTCOME_ICON[outcome];
  return (
    <span className={`tag tag--${meta.tone}`}>
      <OutcomeIcon aria-hidden weight="bold" size={14} />
      {meta.label}
    </span>
  );
}

/** Tag status umum untuk tahap kasus, posisi paket, serah terima dan recall. */
export function Tag({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`tag tag--${tone}`}>{label}</span>;
}
