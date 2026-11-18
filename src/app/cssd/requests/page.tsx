import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate, formatTime } from '@/lib/format';
import { REQUEST_STATUS } from '@/lib/labels';
import { cancelRequestAction, createRequestAction } from '@/server/actions';
import { can, getActor } from '@/server/identity';
import { getRequestsData } from '@/server/pages';
import { toFacilityLocal } from '@/server/time';

export const metadata: Metadata = { title: 'Permintaan' };

export default async function RequestsPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'request:read')) return <NoAccess />;
  const { requests, sets } = await getRequestsData(actor);
  const canCreate = can(actor, 'request:create');
  const canFulfil = can(actor, 'handover:create');
  const canCancel = canCreate || canFulfil;
  const now = new Date();
  const fmt = (date: Date) => `${formatDate(date.toISOString(), actor.timeZone)}, ${formatTime(date.toISOString(), actor.timeZone)}`;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Permintaan']}
        title="Permintaan set"
        description={
          canCreate
            ? `Minta set steril untuk unit ${actor.unitCode}. CSSD memenuhi dari stok dan Anda mengonfirmasi tiap paket di Distribusi.`
            : 'Permintaan dari unit pengguna, diurutkan dari yang mendesak dan paling cepat dibutuhkan.'
        }
      />
      <div className="stack">
        {canCreate ? (
          <section className="card" aria-labelledby="minta-judul">
            <h2 id="minta-judul">Buat permintaan</h2>
            {sets.length === 0 ? (
              <p className="hint-hold">Belum ada jenis set aktif. Hubungi admin CSSD.</p>
            ) : (
              <ActionForm action={createRequestAction} className="grid-form">
                <label className="field">
                  <span>Jenis set</span>
                  <select name="setTemplateId" required defaultValue="">
                    <option value="" disabled>Pilih set</option>
                    {sets.map((set) => (
                      <option key={set.id} value={set.id}>{set.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Jumlah set</span>
                  <input name="quantity" type="number" inputMode="numeric" min={1} max={50} defaultValue={1} required />
                </label>
                <label className="field">
                  <span>Prioritas</span>
                  <select name="priority" defaultValue="ROUTINE">
                    <option value="ROUTINE">Rutin</option>
                    <option value="URGENT">Mendesak</option>
                  </select>
                </label>
                <label className="field">
                  <span>Dibutuhkan pada</span>
                  <input name="neededBy" type="datetime-local" required min={toFacilityLocal(now, actor.timeZone)} defaultValue={toFacilityLocal(new Date(now.getTime() + 2 * 3_600_000), actor.timeZone)} />
                </label>
                <label className="field field--wide">
                  <span>Catatan untuk CSSD (opsional, tanpa identitas pasien)</span>
                  <input name="note" maxLength={300} />
                </label>
                <div className="grid-form__submit">
                  <SubmitButton>Kirim permintaan</SubmitButton>
                </div>
              </ActionForm>
            )}
          </section>
        ) : null}

        <section className="card" aria-labelledby="daftar-judul">
          <h2 id="daftar-judul">Permintaan ({requests.length})</h2>
          {requests.length === 0 ? (
            <p className="muted">{canCreate ? 'Unit Anda belum membuat permintaan.' : 'Belum ada permintaan dari unit.'}</p>
          ) : (
            <ul className="admin-list">
              {requests.map((request) => {
                const status = REQUEST_STATUS[request.status];
                const late = (request.status === 'OPEN' || request.status === 'PARTIAL') && request.neededBy < now;
                const open = request.status === 'OPEN' || request.status === 'PARTIAL';
                return (
                  <li key={request.id} className="admin-row">
                    <div className="admin-row__head">
                      <span className="strong num">{request.code}</span>
                      <span className="strong">{request.setTemplate.name}, {request.fulfilled} dari {request.quantity} set</span>
                      <span className="muted">
                        Unit {request.unit.code}, dibutuhkan {fmt(request.neededBy)}
                        {request.note ? `. ${request.note}` : ''}
                      </span>
                      <span className="admin-row__tags">
                        {request.priority === 'URGENT' ? <Tag label="Mendesak" tone="hold" /> : null}
                        {late ? <Tag label="Lewat waktu" tone="wait" /> : null}
                        <Tag label={status.label} tone={status.tone} />
                      </span>
                    </div>
                    {open ? (
                      <div className="button-row">
                        {canFulfil ? (
                          <Link className="button button--primary" href={`/cssd/distributions?request=${request.code}`}>
                            Penuhi dari stok
                          </Link>
                        ) : null}
                        {canCancel ? (
                          <details className="admin-row__edit">
                            <summary>Batalkan</summary>
                            <ActionForm action={cancelRequestAction} className="inline-form">
                              <input type="hidden" name="requestCode" value={request.code} />
                              <input type="hidden" name="version" value={request.version} />
                              <label className="field field--grow">
                                <span>Alasan pembatalan</span>
                                <input name="reason" required minLength={3} maxLength={200} />
                              </label>
                              <div className="inline-form__buttons">
                                <SubmitButton variant="danger">Batalkan permintaan</SubmitButton>
                              </div>
                            </ActionForm>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
