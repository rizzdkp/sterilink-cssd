import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { NoAccess } from '@/components/cssd/no-access';
import { PackagePicker } from '@/components/cssd/package-picker';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate, formatTime } from '@/lib/format';
import { LINE_OUTCOME, POSITION } from '@/lib/labels';
import { acknowledgeAction, dispatchAction, usageAction } from '@/server/actions';
import { can, getActor } from '@/server/identity';
import { getDistributionData } from '@/server/pages';

export const metadata: Metadata = { title: 'Distribusi' };

export default async function DistributionsPage({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor, 'handover:read')) return <NoAccess />;
  const { units, available, handovers, requests } = await getDistributionData(actor);
  // Dibuka dari halaman Permintaan: unit tujuan dan paket disaring sesuai permintaan itu.
  const requestCode = (await searchParams).request;
  const selectedRequest = requests.find((item) => item.code === requestCode) ?? null;
  const pickable = selectedRequest ? available.filter((item) => item.setTemplateId === selectedRequest.setTemplateId) : available;
  const canDispatch = can(actor, 'handover:create');
  const canAck = can(actor, 'handover:ack');
  const fmt = (date: Date) => `${formatDate(date.toISOString(), actor.timeZone)}, ${formatTime(date.toISOString(), actor.timeZone)}`;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Distribusi']}
        title="Distribusi"
        description={
          canAck
            ? 'Konfirmasi setiap paket yang tiba di unit Anda, lalu catat penggunaannya.'
            : 'Kirim paket steril ke unit dan pantau konfirmasi penerimaan per paket.'
        }
      />
      <div className="stack">
        {canDispatch ? (
          <section className="card" aria-labelledby="kirim-judul">
            <h2 id="kirim-judul">Kirim paket ke unit</h2>
            {available.length === 0 ? (
              <p className="muted">Tidak ada paket tersedia. Paket bisa dikirim setelah batch-nya dilepas.</p>
            ) : (
              <ActionForm action={dispatchAction} key={selectedRequest?.code ?? 'bebas'}>
                {selectedRequest ? (
                  <p className="request-banner">
                    Memenuhi <span className="strong num">{selectedRequest.code}</span>: {selectedRequest.setTemplate.name}, sisa{' '}
                    {selectedRequest.quantity - selectedRequest.fulfilled} set untuk unit {selectedRequest.unit.code}.{' '}
                    <Link href="/cssd/distributions">Kirim tanpa permintaan</Link>
                  </p>
                ) : null}
                <input type="hidden" name="requestCode" value={selectedRequest?.code ?? ''} />
                <label className="field field--narrow">
                  <span>Unit tujuan</span>
                  <select name="destinationUnitId" required defaultValue={selectedRequest?.unitId ?? ''}>
                    <option value="" disabled>
                      Pilih unit
                    </option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code}
                        {unit.name !== unit.code ? ` (${unit.name})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <PackagePicker
                  legend={selectedRequest ? `Paket ${selectedRequest.setTemplate.name} tersedia` : 'Paket tersedia'}
                  columns={['Rak', 'Batch']}
                  rows={pickable.map((item) => ({
                    code: item.code,
                    setName: item.setTemplate?.name ?? '-',
                    details: [item.location?.name ?? 'Belum ditempatkan', item.load?.code ?? '-'],
                  }))}
                />
                <div className="form-actions">
                  <SubmitButton>Catat pengiriman</SubmitButton>
                </div>
              </ActionForm>
            )}
          </section>
        ) : null}

        <section className="card" aria-labelledby="serah-judul">
          <h2 id="serah-judul">
            Serah terima {canAck ? 'untuk unit Anda' : 'terbaru'} ({handovers.length})
          </h2>
          {handovers.length === 0 ? (
            <p className="muted">Belum ada serah terima{canAck ? ' untuk unit Anda' : ''}.</p>
          ) : (
            <ul className="handover-list">
              {handovers.map((handover) => (
                <li key={handover.id} className="handover">
                  <div className="handover__head">
                    <span className="strong num">{handover.code}</span>
                    <span className="muted">
                      Ke {handover.destinationUnit.code}, dikirim {fmt(handover.dispatchedAt)}
                    </span>
                    <Tag
                      label={handover.completedAt ? 'Selesai dikonfirmasi' : 'Menunggu konfirmasi'}
                      tone={handover.completedAt ? 'pass' : 'wait'}
                    />
                  </div>
                  <ul className="handover__lines">
                    {handover.lines.map((line) => {
                      const outcome = LINE_OUTCOME[line.outcome];
                      return (
                        <li key={line.id} className="handover__line">
                          <span className="handover__package">
                            <span className="strong num">{line.package.code}</span>
                            <span className="muted">
                              {line.package.setTemplate?.name ?? '-'}, {POSITION[line.package.position].toLowerCase()}
                            </span>
                            {line.note ? <span className="muted">Catatan: {line.note}</span> : null}
                          </span>
                          <Tag label={outcome.label} tone={outcome.tone} />
                          {canAck && line.outcome === 'PENDING' ? (
                            <ActionForm action={acknowledgeAction} className="inline-form">
                              <input type="hidden" name="handoverCode" value={handover.code} />
                              <input type="hidden" name="packageCode" value={line.package.code} />
                              <label className="field field--grow">
                                <span>Catatan (wajib bila ditolak)</span>
                                <input name="note" maxLength={200} />
                              </label>
                              <div className="inline-form__buttons">
                                <SubmitButton name="outcome" value="RECEIVED">
                                  Terima
                                </SubmitButton>
                                <SubmitButton name="outcome" value="REJECTED" variant="danger">
                                  Tolak
                                </SubmitButton>
                              </div>
                            </ActionForm>
                          ) : null}
                          {canAck && line.outcome === 'RECEIVED' && line.package.position === 'RECEIVED' ? (
                            <ActionForm action={usageAction} className="button-row">
                              <input type="hidden" name="handoverCode" value={handover.code} />
                              <input type="hidden" name="packageCode" value={line.package.code} />
                              <SubmitButton variant="secondary">Catat digunakan</SubmitButton>
                            </ActionForm>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
