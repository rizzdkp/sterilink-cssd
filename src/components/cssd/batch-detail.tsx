import { CheckIcon } from '@phosphor-icons/react/dist/ssr';
import type { QueueStatus } from '@/generated/prisma/enums';
import { EVIDENCE_LABEL, METHOD_LABEL, STAGE_LABEL, formatClock, formatDate, formatTime } from '@/lib/format';
import type { EvidenceItem, LoadDetail, TimelineStep } from '@/server/queue/service';
import { OutcomeTag } from './status-tag';

function listKinds(items: EvidenceItem[]): string {
  const names = items.map((item) => EVIDENCE_LABEL[item.kind].toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} dan ${names.at(-1)}`;
}

/**
 * Alasan batch berada di status ini, dalam satu kalimat yang menyebut bukti
 * penyebabnya. Disusun dari data bukti, bukan dari teks tetap.
 */
export function statusReason(detail: LoadDetail): string {
  const pending = detail.evidence.filter((item) => item.outcome === 'PENDING');
  const failed = detail.evidence.filter((item) => item.outcome === 'FAIL');
  const reasons: Record<QueueStatus, string> = {
    WAITING_PROCESS: 'Muatan sudah disusun dan menunggu siklus sterilisasi dimulai.',
    RUNNING: 'Siklus sterilisasi sedang berjalan. Bukti dicatat setelah siklus selesai.',
    AWAITING_EVIDENCE:
      pending.length > 0
        ? `Hasil indikator ${listKinds(pending)} yang diwajibkan profil ini belum tercatat.`
        : 'Siklus sudah selesai, tetapi bukti pemantauan belum dicatat.',
    READY_FOR_REVIEW:
      failed.length > 0
        ? `Indikator ${listKinds(failed)} tidak memenuhi. Batch perlu keputusan reviewer.`
        : 'Semua bukti wajib sudah tercatat. Batch siap ditinjau reviewer.',
    HELD: 'Batch ditahan dan tidak tersedia untuk distribusi.',
    RELEASED: 'Batch sudah dilepas setelah telaah mutu.',
    REJECTED: 'Batch ditolak dan perlu diproses ulang.',
    CLOSED: 'Muatan dibatalkan sebelum selesai.',
  };
  return reasons[detail.status];
}

// Label tahapan dengan tanda pemenggalan lunak (U+00AD): hanya dipenggal bila
// kolom panel terlalu sempit, misalnya di layar 1280 px.
const STAGE_LABEL_BREAKABLE: Record<TimelineStep['stage'], string> = {
  RECEIVING: 'Peneri­maan',
  DECONTAMINATION: 'Dekonta­minasi',
  PACKING: 'Penge­masan',
  STERILIZATION: 'Sterili­sasi',
  VERIFICATION: 'Verifi­kasi',
};

function stepCaption(step: TimelineStep, status: QueueStatus, timeZone: string): string {
  if (step.occurredAt) return formatClock(step.occurredAt, timeZone);
  if (step.state === 'upcoming') return 'Belum';
  if (step.state === 'current') {
    if (step.stage === 'STERILIZATION') return status === 'RUNNING' ? 'Berjalan' : 'Menunggu';
    return status === 'HELD' ? 'Ditahan' : 'Menunggu';
  }
  // "Selesai siklus" dan "Dilepas" sengaja berbeda: siklus selesai belum berarti lepas.
  if (step.stage === 'STERILIZATION') return 'Selesai siklus';
  if (step.stage === 'VERIFICATION') return 'Dilepas';
  return 'Selesai';
}

export function ProcessTimeline({ steps, status, timeZone }: { steps: TimelineStep[]; status: QueueStatus; timeZone: string }) {
  return (
    <ol className="timeline">
      {steps.map((step, index) => (
        <li key={step.stage} className={`timeline__step timeline__step--${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}>
          <span className="timeline__marker" aria-hidden>
            {step.state === 'done' ? <CheckIcon size={12} weight="bold" /> : index + 1}
          </span>
          <span className="timeline__label">{STAGE_LABEL_BREAKABLE[step.stage]}</span>
          <span className="timeline__caption num">
            <span className="visually-hidden">
              {step.state === 'done' ? 'selesai, ' : step.state === 'current' ? 'tahap saat ini, ' : ''}
            </span>
            {stepCaption(step, status, timeZone)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) {
    return <p className="muted">Bukti pemantauan dicatat setelah siklus selesai.</p>;
  }
  return (
    <ul className="evidence">
      {evidence.map((item) => (
        <li key={item.kind}>
          <span className="evidence__kind">
            <span className="strong">{EVIDENCE_LABEL[item.kind]}</span>
            <span className="muted">
              {item.source ?? (item.requiredBy ? `Diwajibkan ${item.requiredBy}` : 'Sumber belum ada')}
            </span>
          </span>
          <OutcomeTag outcome={item.outcome} observedAt={item.observedAt} />
        </li>
      ))}
    </ul>
  );
}

export function BatchFacts({ detail, timeZone }: { detail: LoadDetail; timeZone: string }) {
  const facts: [string, React.ReactNode][] = [
    ['Set / Instrumen', detail.setName],
    ['Unit Asal', detail.originLabel],
    ['Jumlah', `${detail.setCount} set`],
    ['Metode', METHOD_LABEL[detail.method]],
    ['Mulai Proses', detail.startedAt ? `${formatDate(detail.startedAt, timeZone)}, ${formatTime(detail.startedAt, timeZone)}` : 'Belum ada'],
    ['Target Selesai', detail.targetAt ? `${formatDate(detail.targetAt, timeZone)}, ${formatTime(detail.targetAt, timeZone)}` : 'Belum ada'],
  ];
  return (
    <dl className="facts">
      {facts.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd className="num">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
