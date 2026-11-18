import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { BackdateFields } from '@/components/cssd/backdate-fields';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate, formatTime } from '@/lib/format';
import { CASE_STATUS } from '@/lib/labels';
import { cleaningAction, inspectionAction, packAction, receiveTrayAction } from '@/server/actions';
import { can, getActor } from '@/server/identity';
import { getReceivingData } from '@/server/pages';
import { toFacilityLocal } from '@/server/time';

export const metadata: Metadata = { title: 'Penerimaan' };

type CaseRow = Awaited<ReturnType<typeof getReceivingData>>['cases'][number];

function CaseActions({ row, canClean, canInspect, canPack }: { row: CaseRow; canClean: boolean; canInspect: boolean; canPack: boolean }) {
  const hidden = (
    <>
      <input type="hidden" name="caseCode" value={row.code} />
      <input type="hidden" name="version" value={row.version} />
    </>
  );

  if (row.status === 'RECEIVED') {
    if (!canClean) return <p className="muted">Menunggu operator zona kotor.</p>;
    return (
      <ActionForm action={cleaningAction} className="inline-form">
        {hidden}
        <label className="field field--grow">
          <span>Catatan (wajib bila gagal)</span>
          <input name="note" maxLength={200} autoComplete="off" />
        </label>
        <div className="inline-form__buttons">
          <SubmitButton name="outcome" value="PASS">
            Dekontaminasi lulus
          </SubmitButton>
          <SubmitButton name="outcome" value="FAIL" variant="danger">
            Gagal
          </SubmitButton>
        </div>
      </ActionForm>
    );
  }

  if (row.status === 'INSPECTION') {
    if (!canInspect) return <p className="muted">Menunggu operator zona bersih.</p>;
    return (
      // Satu baris per komponen (PRD P-08): lulus hanya bila semua lengkap dan baik.
      <ActionForm action={inspectionAction} className="inspection">
        {hidden}
        <div className="picker__scroll" tabIndex={0} role="region" aria-label={`Checklist komponen ${row.code}`}>
          <table className="picker__table inspection__table">
            <thead>
              <tr>
                <th scope="col">Komponen</th>
                <th scope="col" className="num">
                  Harapan
                </th>
                <th scope="col">Aktual</th>
                <th scope="col">Kondisi</th>
                <th scope="col">Catatan (wajib bila kurang atau tidak baik)</th>
              </tr>
            </thead>
            <tbody>
              {row.tray.setTemplate.components.map((component) => (
                <tr key={component.id}>
                  <th scope="row">
                    <input type="hidden" name="componentId" value={component.id} />
                    {component.name}
                  </th>
                  <td className="num">{component.quantity}</td>
                  <td>
                    <input
                      name={`actual-${component.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999}
                      required
                      defaultValue={component.quantity}
                      aria-label={`Jumlah aktual ${component.name}`}
                    />
                  </td>
                  <td>
                    <select name={`condition-${component.id}`} defaultValue="OK" aria-label={`Kondisi ${component.name}`}>
                      <option value="OK">Baik</option>
                      <option value="DAMAGED">Rusak</option>
                      <option value="MISSING">Hilang</option>
                    </select>
                  </td>
                  <td>
                    <input name={`note-${component.id}`} maxLength={200} autoComplete="off" aria-label={`Catatan ${component.name}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inline-form">
          <label className="field field--grow">
            <span>Catatan umum (opsional)</span>
            <input name="note" maxLength={200} autoComplete="off" />
          </label>
          <div className="inline-form__buttons">
            <SubmitButton>Simpan hasil inspeksi</SubmitButton>
          </div>
        </div>
      </ActionForm>
    );
  }

  if (!canPack) return <p className="muted">Menunggu operator zona bersih.</p>;
  return (
    <ActionForm action={packAction} className="inline-form">
      {hidden}
      <label className="field field--grow">
        <span>Lot kemasan</span>
        <input name="materialLot" required minLength={3} maxLength={40} autoComplete="off" placeholder="Contoh: LOT-2501-A" />
      </label>
      <div className="inline-form__buttons">
        <SubmitButton>Buat paket</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function ReceivingPage() {
  const actor = await getActor();
  const canReceive = actor ? can(actor, 'case:receive') : false;
  const canClean = actor ? can(actor, 'case:clean') : false;
  const canInspect = actor ? can(actor, 'case:inspect') : false;
  const canPack = actor ? can(actor, 'package:create') : false;
  if (!actor || !(canReceive || canInspect || can(actor, 'stock:read'))) return <NoAccess />;

  const { units, cases, recentPackages } = await getReceivingData(actor);

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Penerimaan']}
        title="Penerimaan"
        description="Terima tray kotor dari unit, catat dekontaminasi dan inspeksi, lalu kemas menjadi paket berlabel."
      />

      <div className="stack">
        {canReceive ? (
          <section className="card" aria-labelledby="terima-judul">
            <h2 id="terima-judul">Catat penerimaan tray</h2>
            <ActionForm action={receiveTrayAction} className="grid-form">
              <label className="field">
                <span>Kode tray</span>
                <input
                  name="trayCode"
                  required
                  maxLength={32}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Pindai atau ketik, misalnya TR-0060"
                />
              </label>
              <label className="field">
                <span>Unit asal</span>
                <select name="originUnitId" required defaultValue="">
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
              <label className="field">
                <span>Jumlah komponen aktual</span>
                <input name="actualCount" type="number" inputMode="numeric" min={0} max={999} required />
              </label>
              <label className="field field--wide">
                <span>Kondisi dan selisih (wajib bila jumlah berbeda dari isi set)</span>
                <input name="conditionNote" maxLength={200} autoComplete="off" />
              </label>
              <div className="field--wide">
                <BackdateFields max={toFacilityLocal(new Date(), actor.timeZone)} />
              </div>
              <div className="grid-form__submit">
                <SubmitButton>Catat penerimaan</SubmitButton>
              </div>
            </ActionForm>
          </section>
        ) : null}

        <section className="card" aria-labelledby="kasus-judul">
          <h2 id="kasus-judul">Kasus dalam proses ({cases.length})</h2>
          {cases.length === 0 ? (
            <p className="muted">Tidak ada tray dalam proses. Tray yang diterima muncul di sini sampai dikemas.</p>
          ) : (
            <ul className="case-list">
              {cases.map((row) => {
                const meta = CASE_STATUS[row.status];
                const failedRuns = row.cleaningRuns.filter((run) => run.outcome === 'FAIL').length;
                const lastInspection = row.inspections[0];
                return (
                  <li key={row.id} className="case-row">
                    <div className="case-row__head">
                      <div className="case-row__id">
                        <span className="strong num">{row.code}</span>
                        <span className="muted num">Tray {row.tray.code}</span>
                      </div>
                      <div className="case-row__meta">
                        <span className="strong">{row.tray.setTemplate.name}</span>
                        <span className="muted">
                          Dari {row.originUnit.code}, komponen {row.actualCount} dari {row.expectedCount}
                          {row.conditionNote ? `. ${row.conditionNote}` : ''}
                        </span>
                        {failedRuns > 0 || lastInspection?.outcome === 'FAIL' ? (
                          <span className="hint-hold">
                            {failedRuns > 0 ? `${failedRuns} percobaan dekontaminasi gagal. ` : ''}
                            {lastInspection?.outcome === 'FAIL'
                              ? `Inspeksi terakhir gagal: ${lastInspection.note ?? 'tanpa catatan'}.`
                              : ''}
                          </span>
                        ) : null}
                      </div>
                      <div className="case-row__status">
                        <Tag label={meta.label} tone={meta.tone} />
                        <span className="muted num">
                          {formatDate(row.receivedAt.toISOString(), actor.timeZone)},{' '}
                          {formatTime(row.receivedAt.toISOString(), actor.timeZone)}
                        </span>
                      </div>
                    </div>
                    <CaseActions row={row} canClean={canClean} canInspect={canInspect} canPack={canPack} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="paket-judul">
          <h2 id="paket-judul">Paket siap dimuat ({recentPackages.length})</h2>
          {recentPackages.length === 0 ? (
            <p className="muted">Paket baru muncul di sini setelah kasus dikemas, sampai dimuat ke mesin.</p>
          ) : (
            <div className="scroll-x" tabIndex={0} role="region" aria-labelledby="paket-judul">
              <table className="plain-table">
                <thead>
                  <tr>
                    <th scope="col">Paket</th>
                    <th scope="col">Set</th>
                    <th scope="col">Tray</th>
                    <th scope="col">Lot kemasan</th>
                    <th scope="col">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPackages.map((item) => (
                    <tr key={item.id}>
                      <th scope="row" className="num">
                        {item.code}
                      </th>
                      <td>{item.setTemplate?.name ?? '-'}</td>
                      <td className="num">{item.tray?.code ?? '-'}</td>
                      <td className="num">{item.materialLot ?? '-'}</td>
                      <td>
                        <Link href={`/cssd/packages/${item.code}/label`}>
                          {item.printCount === 0 ? 'Cetak label' : `Cetak ulang (${item.printCount}x)`}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
