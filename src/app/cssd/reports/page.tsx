import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { can, getActor } from '@/server/identity';
import { getReport, resolvePeriod, type Ratio } from '@/server/reports';
import { DomainError } from '@/server/workflow';

export const metadata: Metadata = { title: 'Laporan' };

function hours(value: number | null): string {
  if (value === null) return 'Belum ada data';
  return value >= 24 ? `${(value / 24).toFixed(1)} hari` : `${value.toFixed(1)} jam`;
}

function RatioRow({ label, ratio }: { label: string; ratio: Ratio }) {
  const percent = ratio.denominator > 0 ? ((ratio.numerator / ratio.denominator) * 100).toFixed(1) : null;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{percent === null ? 'Belum ada data' : `${percent}%`}</td>
      <td className="num">
        {ratio.numerator} dari {ratio.denominator}
      </td>
    </tr>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor, 'report:read')) return <NoAccess />;
  const params = await searchParams;
  let periodError: string | null = null;
  let period;
  try {
    period = resolvePeriod(actor.timeZone, params.from, params.to);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    periodError = error.message;
    period = resolvePeriod(actor.timeZone);
  }
  const report = await getReport(actor, period);
  const query = `from=${period.from}&to=${period.to}`;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Laporan']}
        title="Laporan"
        description="Volume, waktu putar dan ketidaksesuaian per periode, dihitung dari catatan transaksi. Setiap rasio menampilkan pembilang dan penyebutnya."
      />
      <div className="stack">
        <form className="card trace-search" action="/cssd/reports">
          <label className="field">
            <span>Dari tanggal</span>
            <input type="date" name="from" defaultValue={period.from} required />
          </label>
          <label className="field">
            <span>Sampai tanggal</span>
            <input type="date" name="to" defaultValue={period.to} required />
          </label>
          <button type="submit" className="button button--primary">
            Tampilkan
          </button>
          {periodError ? (
            <p className="hint-hold" role="alert">
              {periodError} Menampilkan 30 hari terakhir.
            </p>
          ) : null}
        </form>

        <section className="card" aria-labelledby="volume-judul">
          <h2 id="volume-judul">
            Volume {period.from} sampai {period.to}
          </h2>
          <dl className="facts facts--wide">
            <div>
              <dt>Tray diterima</dt>
              <dd className="num">{report.volume.received}</dd>
            </div>
            <div>
              <dt>Paket dibuat</dt>
              <dd className="num">{report.volume.packed}</dd>
            </div>
            <div>
              <dt>Batch dilepas</dt>
              <dd className="num">{report.volume.released}</dd>
            </div>
            <div>
              <dt>Batch ditolak</dt>
              <dd className="num">{report.volume.rejectedLoads}</dd>
            </div>
            <div>
              <dt>Paket dikirim</dt>
              <dd className="num">{report.volume.dispatched}</dd>
            </div>
            <div>
              <dt>Recall dibuka</dt>
              <dd className="num">{report.volume.recallsOpened}</dd>
            </div>
            <div>
              <dt>Recall ditutup</dt>
              <dd className="num">{report.volume.recallsClosed}</dd>
            </div>
          </dl>
        </section>

        <section className="card" aria-labelledby="putar-judul">
          <h2 id="putar-judul">Waktu putar: tray diterima sampai batch dilepas</h2>
          <p className="muted">Dihitung per paket yang batch-nya dilepas dalam periode ini, n = {report.turnaround.n} paket.</p>
          <dl className="facts facts--wide">
            <div>
              <dt>Median</dt>
              <dd className="num">{hours(report.turnaround.median)}</dd>
            </div>
            <div>
              <dt>Persentil 90</dt>
              <dd className="num">{hours(report.turnaround.p90)}</dd>
            </div>
          </dl>
          <a className="button button--secondary" href={`/api/v1/cssd/exports?kind=turnaround&${query}`}>
            <DownloadSimpleIcon aria-hidden size={16} weight="bold" />
            Unduh rincian per paket (CSV)
          </a>
        </section>

        <section className="card" aria-labelledby="ncr-judul">
          <h2 id="ncr-judul">Ketidaksesuaian</h2>
          <div className="scroll-x" tabIndex={0} role="region" aria-labelledby="ncr-judul">
            <table className="plain-table">
              <thead>
                <tr>
                  <th scope="col">Ukuran</th>
                  <th scope="col">Rasio</th>
                  <th scope="col">Pembilang dan penyebut</th>
                </tr>
              </thead>
              <tbody>
                <RatioRow label="Dekontaminasi gagal per percobaan" ratio={report.cleaningFail} />
                <RatioRow label="Inspeksi tidak lulus per inspeksi" ratio={report.inspectionFail} />
                <RatioRow label="Paket ditolak unit per konfirmasi" ratio={report.unitRejected} />
              </tbody>
            </table>
          </div>
          <a className="button button--secondary" href={`/api/v1/cssd/exports?kind=nonconformity&${query}`}>
            <DownloadSimpleIcon aria-hidden size={16} weight="bold" />
            Unduh rincian ketidaksesuaian (CSV)
          </a>
        </section>

        <section className="card" aria-labelledby="unit-judul">
          <h2 id="unit-judul">Tray diterima per unit asal</h2>
          {report.byUnit.length === 0 ? (
            <p className="muted">Tidak ada tray diterima dalam periode ini.</p>
          ) : (
            <div className="scroll-x" tabIndex={0} role="region" aria-labelledby="unit-judul">
              <table className="plain-table">
                <thead>
                  <tr>
                    <th scope="col">Unit</th>
                    <th scope="col">Tray diterima</th>
                    <th scope="col">Porsi</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byUnit.map((row) => (
                    <tr key={row.unit}>
                      <th scope="row">{row.unit}</th>
                      <td className="num">{row.count}</td>
                      <td className="num">
                        {((row.count / report.volume.received) * 100).toFixed(1)}% dari {report.volume.received}
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
