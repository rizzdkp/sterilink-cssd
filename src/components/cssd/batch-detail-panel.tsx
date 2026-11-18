import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import type { LoadDetail } from '@/server/queue/service';
import { BatchFacts, EvidenceList, ProcessTimeline, statusReason } from './batch-detail';
import { CssdStatusTag } from './status-tag';

const EVIDENCE_STATUSES = new Set(['AWAITING_EVIDENCE', 'READY_FOR_REVIEW', 'HELD', 'RELEASED', 'REJECTED']);

export function BatchDetailPanel({
  detail,
  missingCode,
  backHref,
  timeZone,
  canOpenEvidence,
}: {
  detail: LoadDetail | null;
  missingCode: string | null;
  backHref: string;
  timeZone: string;
  canOpenEvidence: boolean;
}) {
  const back = (
    <Link className="panel__back" href={backHref}>
      <ArrowLeftIcon aria-hidden size={16} weight="bold" />
      Kembali ke antrean
    </Link>
  );

  if (!detail) {
    return (
      <aside className="panel" aria-label="Detail batch">
        {back}
        {missingCode ? (
          <div className="panel__empty" role="status">
            <h2>Batch {missingCode} tidak ditemukan</h2>
            <p>Kode ini tidak ada di fasilitas Anda. Periksa label lalu pindai ulang, atau pilih batch dari antrean.</p>
          </div>
        ) : (
          <div className="panel__empty">
            <h2>Belum ada batch dipilih</h2>
            <p>Pilih nomor batch di antrean untuk melihat tahapan dan bukti pemantauannya.</p>
          </div>
        )}
      </aside>
    );
  }

  const evidenceStage = EVIDENCE_STATUSES.has(detail.status);

  return (
    <aside className="panel" aria-labelledby="panel-judul">
      {back}
      <header className="panel__header">
        <h2 id="panel-judul">
          <span className="visually-hidden">Batch </span>
          {detail.code}
        </h2>
        <CssdStatusTag status={detail.status} />
      </header>

      <div className="panel__reason">
        <p>{statusReason(detail)}</p>
        {canOpenEvidence ? (
          <Link className="button button--primary" href={`/cssd/batches/${encodeURIComponent(detail.code)}`}>
            {evidenceStage ? 'Buka bukti batch' : 'Buka detail batch'}
            <ArrowRightIcon aria-hidden size={16} weight="bold" />
          </Link>
        ) : null}
      </div>

      <BatchFacts detail={detail} timeZone={timeZone} />

      <section aria-labelledby="panel-tahapan">
        <h3 id="panel-tahapan">Tahapan batch</h3>
        <ProcessTimeline steps={detail.timeline} status={detail.status} timeZone={timeZone} />
      </section>

      <section aria-labelledby="panel-indikator">
        <h3 id="panel-indikator">Indikator</h3>
        <EvidenceList evidence={detail.evidence} />
      </section>

      {detail.note ? (
        <section aria-labelledby="panel-catatan">
          <h3 id="panel-catatan">Catatan</h3>
          <p>{detail.note}</p>
        </section>
      ) : null}
    </aside>
  );
}
