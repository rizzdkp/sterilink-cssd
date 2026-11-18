import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BatchActions } from '@/components/cssd/batch-actions';
import { BatchFacts, ProcessTimeline, statusReason } from '@/components/cssd/batch-detail';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { AuditTrail } from '@/components/cssd/audit-trail';
import { CssdStatusTag, OutcomeTag } from '@/components/cssd/status-tag';
import { EVIDENCE_LABEL, formatDate, formatTime } from '@/lib/format';
import { can, getActor } from '@/server/identity';
import { getBatchActivity } from '@/server/pages';
import { normalizeScanCode } from '@/server/queue/params';
import { getLoadDetail } from '@/server/queue/service';
import { toFacilityLocal } from '@/server/time';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: `Batch ${decodeURIComponent(code).slice(0, 32)}` };
}

const DECISION_LABEL: Record<string, string> = {
  RELEASE: 'Dilepas',
  HOLD: 'Ditahan',
  REJECT: 'Ditolak',
  RESUME: 'Penahanan dicabut',
};

export default async function BatchPage({ params }: Props) {
  const actor = await getActor();
  if (!actor || !can(actor, 'batch:read')) return <NoAccess />;

  const { code: rawCode } = await params;
  const code = normalizeScanCode(decodeURIComponent(rawCode));
  const [detail, activity] = code ? await Promise.all([getLoadDetail(actor, code), getBatchActivity(actor, code)]) : [null, null];
  // Batch di luar cakupan dijawab sama dengan batch yang tidak ada.
  if (!detail || !activity) notFound();
  const { load, audit } = activity;
  const openRecall = load.recalls.find((recall) => recall.status === 'OPEN');
  const fmt = (date: Date) => `${formatDate(date.toISOString(), actor.timeZone)}, ${formatTime(date.toISOString(), actor.timeZone)}`;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Batch & Mutu', detail.code]}
        title={`Batch ${detail.code}`}
        description={`${detail.setName}, ${detail.setCount} set dari ${detail.originLabel}${load.device ? `, mesin ${load.device.code}` : ''}.`}
        synthetic={detail.synthetic}
        action={
          <Link className="button button--secondary button--large" href={`/cssd?batch=${encodeURIComponent(detail.code)}`}>
            <ArrowLeftIcon aria-hidden size={18} weight="bold" />
            Kembali ke antrean
          </Link>
        }
      />

      <div className="batch-page">
        <section className="card card--status" aria-labelledby="status-judul">
          <div className="card__title-row">
            <h2 id="status-judul">Status saat ini</h2>
            <CssdStatusTag status={detail.status} />
          </div>
          <p>{statusReason(detail)}</p>
          {openRecall ? (
            <p className="hint-hold">
              Recall <Link href={`/cssd/recalls/${openRecall.code}`}>{openRecall.code}</Link> terbuka: {openRecall.reason}
            </p>
          ) : null}
          <BatchActions
            nowLocal={toFacilityLocal(new Date(), actor.timeZone)}
            actor={actor}
            detail={detail}
            facts={{
              code: load.code,
              version: load.version,
              processStatus: load.processStatus,
              qualityStatus: load.qualityStatus,
              startedBy: load.startedBy,
              hasOpenRecall: Boolean(openRecall),
            }}
          />
        </section>

        <section className="card" aria-labelledby="ringkasan-judul">
          <h2 id="ringkasan-judul">Ringkasan muatan</h2>
          <BatchFacts detail={detail} timeZone={actor.timeZone} />
        </section>

        <section className="card" aria-labelledby="tahapan-judul">
          <h2 id="tahapan-judul">Tahapan batch</h2>
          <ProcessTimeline steps={detail.timeline} status={detail.status} timeZone={actor.timeZone} />
        </section>

        {can(actor, 'evidence:read') ? (
          <section className="card card--wide" aria-labelledby="bukti-judul">
            <h2 id="bukti-judul">Bukti pemantauan</h2>
            {detail.evidence.length === 0 ? (
              <p className="muted">Bukti pemantauan dicatat setelah siklus selesai.</p>
            ) : (
              <div className="scroll-x" tabIndex={0} role="region" aria-labelledby="bukti-judul">
                <table className="plain-table">
                  <thead>
                    <tr>
                      <th scope="col">Pemeriksaan</th>
                      <th scope="col">Hasil</th>
                      <th scope="col">Sumber</th>
                      <th scope="col">Diwajibkan oleh</th>
                      <th scope="col">Waktu hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.evidence.map((item) => (
                      <tr key={item.kind}>
                        <th scope="row">{EVIDENCE_LABEL[item.kind]}</th>
                        <td><OutcomeTag outcome={item.outcome} observedAt={item.observedAt} /></td>
                        <td>{item.source ?? <span className="muted">Belum ada</span>}</td>
                        <td>{item.requiredBy ?? <span className="muted">Tidak tercatat</span>}</td>
                        <td className="num">
                          {item.observedAt ? (
                            `${formatDate(item.observedAt, actor.timeZone)}, ${formatTime(item.observedAt, actor.timeZone)}`
                          ) : (
                            <span className="muted">Belum tercatat</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        <section className="card" aria-labelledby="paket-judul">
          <h2 id="paket-judul">Paket dalam muatan</h2>
          {detail.packageCodes.length === 0 ? (
            <p className="muted">Tidak ada paket di muatan ini.</p>
          ) : (
            <ul className="chips">
              {detail.packageCodes.map((packageCode) => (
                <li key={packageCode} className="num">
                  <Link href={`/cssd/trace?code=${packageCode}`}>{packageCode}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="keputusan-judul">
          <h2 id="keputusan-judul">Riwayat keputusan mutu</h2>
          {load.decisions.length === 0 ? (
            <p className="muted">Belum ada keputusan mutu.</p>
          ) : (
            <ul className="history">
              {load.decisions.map((decision) => (
                <li key={decision.id}>
                  <span className="strong">{DECISION_LABEL[decision.decision] ?? decision.decision}</span>
                  <span className="muted num">{fmt(decision.decidedAt)}, {decision.actorRole}</span>
                  {decision.reason ? <span>{decision.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {detail.note ? (
          <section className="card" aria-labelledby="catatan-judul">
            <h2 id="catatan-judul">Catatan</h2>
            <p>{detail.note}</p>
          </section>
        ) : null}

        <section className="card card--wide" aria-labelledby="audit-judul">
          <h2 id="audit-judul">Jejak audit</h2>
          <AuditTrail events={audit} timeZone={actor.timeZone} labelledBy="audit-judul" />
        </section>
      </div>
    </>
  );
}
