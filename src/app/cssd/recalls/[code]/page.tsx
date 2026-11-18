import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate, formatTime } from '@/lib/format';
import { POSITION, RECALL_ITEM } from '@/lib/labels';
import { closeRecallAction, recallItemAction } from '@/server/actions';
import { can, getActor } from '@/server/identity';
import { getRecall } from '@/server/pages';
import { normalizeScanCode } from '@/server/queue/params';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Recall ${decodeURIComponent((await params).code).slice(0, 32)}` };
}

export default async function RecallPage({ params }: Props) {
  const actor = await getActor();
  if (!actor || !can(actor, 'trace:read')) return <NoAccess />;
  const code = normalizeScanCode(decodeURIComponent((await params).code));
  const recall = code ? await getRecall(actor, code) : null;
  if (!recall) notFound();
  const canManage = can(actor, 'recall:manage') && recall.status === 'OPEN';
  const open = recall.items.filter((item) => item.status === 'IDENTIFIED').length;
  const fmt = (date: Date) => `${formatDate(date.toISOString(), actor.timeZone)}, ${formatTime(date.toISOString(), actor.timeZone)}`;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Recall', recall.code]}
        title={`Recall ${recall.code}`}
        description={`Batch ${recall.load.code}: ${recall.reason}`}
      />
      <div className="stack">
        <section className="card" aria-labelledby="status-judul">
          <div className="card__title-row">
            <h2 id="status-judul">Status</h2>
            {recall.status === 'OPEN' ? <Tag label="Terbuka" tone="hold" /> : <Tag label="Ditutup" tone="pass" />}
          </div>
          <p>
            Dibuka {fmt(recall.openedAt)}. {recall.items.length - open} dari {recall.items.length} paket sudah ditindaklanjuti.{' '}
            <Link href={`/cssd/batches/${recall.load.code}`}>Buka batch {recall.load.code}</Link>
          </p>
          {recall.status === 'CLOSED' ? (
            <p>
              Ditutup {recall.closedAt ? fmt(recall.closedAt) : ''}. CAPA: {recall.capa}
            </p>
          ) : null}
        </section>

        <section className="card" aria-labelledby="paket-judul">
          <h2 id="paket-judul">Tindak lanjut per paket</h2>
          <ul className="handover__lines">
            {recall.items.map((item) => {
              const meta = RECALL_ITEM[item.status];
              return (
                <li key={item.id} className="handover__line">
                  <span className="handover__package">
                    <span className="strong num">
                      <Link href={`/cssd/trace?code=${item.package.code}`}>{item.package.code}</Link>
                    </span>
                    <span className="muted">
                      Saat recall: {POSITION[item.positionAtOpen].toLowerCase()}
                      {item.package.destinationUnit ? `, unit ${item.package.destinationUnit.code}` : ''}
                    </span>
                    {item.note ? <span className="muted">Catatan: {item.note}</span> : null}
                  </span>
                  <Tag label={meta.label} tone={meta.tone} />
                  {canManage && item.status === 'IDENTIFIED' ? (
                    <ActionForm action={recallItemAction} className="inline-form">
                      <input type="hidden" name="recallCode" value={recall.code} />
                      <input type="hidden" name="packageCode" value={item.package.code} />
                      <label className="field field--grow">
                        <span>Catatan (wajib selain ditarik)</span>
                        <input name="note" maxLength={200} />
                      </label>
                      <div className="inline-form__buttons">
                        <SubmitButton name="status" value="RECOVERED">
                          Ditarik
                        </SubmitButton>
                        <SubmitButton name="status" value="USED" variant="secondary">
                          Sudah digunakan
                        </SubmitButton>
                        <SubmitButton name="status" value="NOT_FOUND" variant="danger">
                          Belum ditemukan
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        {canManage ? (
          <section className="card" aria-labelledby="tutup-judul">
            <h2 id="tutup-judul">Tutup recall</h2>
            {open > 0 ? (
              <p className="hint-hold">Masih ada {open} paket tanpa tindak lanjut. Recall bisa ditutup setelah semuanya tercatat.</p>
            ) : (
              <ActionForm action={closeRecallAction} className="inline-form">
                <input type="hidden" name="recallCode" value={recall.code} />
                <label className="field field--grow">
                  <span>Tindakan korektif dan pencegahan (CAPA)</span>
                  <input name="capa" required minLength={3} maxLength={500} />
                </label>
                <div className="inline-form__buttons">
                  <SubmitButton>Tutup recall</SubmitButton>
                </div>
              </ActionForm>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
