import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { NoAccess } from '@/components/cssd/no-access';
import { PackagePicker } from '@/components/cssd/package-picker';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate } from '@/lib/format';
import { POSITION, QUALITY } from '@/lib/labels';
import { moveStockAction, pullExpiredAction } from '@/server/actions';
import { can, getActor } from '@/server/identity';
import { getStockData } from '@/server/pages';

export const metadata: Metadata = { title: 'Stok Steril' };

type Row = Awaited<ReturnType<typeof getStockData>>['available'][number];

const DAY_MS = 24 * 60 * 60 * 1000;

function PackageTable({ rows, id, timeZone, showStatus }: { rows: Row[]; id: string; timeZone: string; showStatus?: boolean }) {
  const now = Date.now();
  return (
    <div className="scroll-x" tabIndex={0} role="region" aria-labelledby={id}>
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Paket</th>
            <th scope="col">Set</th>
            <th scope="col">Batch</th>
            <th scope="col">Lokasi</th>
            <th scope="col">Kedaluwarsa</th>
            {showStatus ? <th scope="col">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const quality = QUALITY[item.qualityStatus];
            const daysLeft = item.expiresAt ? Math.ceil((item.expiresAt.getTime() - now) / DAY_MS) : null;
            return (
              <tr key={item.id}>
                <th scope="row" className="num">
                  <Link href={`/cssd/trace?code=${item.code}`}>{item.code}</Link>
                </th>
                <td>{item.setTemplate?.name ?? '-'}</td>
                <td className="num">{item.load ? <Link href={`/cssd/batches/${item.load.code}`}>{item.load.code}</Link> : '-'}</td>
                <td>
                  {item.location?.name ?? (item.position === 'AVAILABLE' ? 'Belum ditempatkan' : POSITION[item.position])}
                  {item.position === 'DISPATCHED' && item.destinationUnit ? ` ke ${item.destinationUnit.code}` : ''}
                </td>
                <td className="num">
                  {item.expiresAt ? formatDate(item.expiresAt.toISOString(), timeZone) : '-'}
                  {daysLeft !== null && daysLeft <= 7 && daysLeft > 0 ? <> <Tag label={`${daysLeft} hari lagi`} tone="wait" /></> : null}
                  {daysLeft !== null && daysLeft <= 0 ? <> <Tag label="Kedaluwarsa" tone="hold" /></> : null}
                </td>
                {showStatus ? (
                  <td>{item.blocked ? <Tag label="Diblokir recall" tone="hold" /> : <Tag label={quality.label} tone={quality.tone} />}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function StockPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'stock:read')) return <NoAccess />;
  const { available, expired, held, returned, locations } = await getStockData(actor);
  const canManage = can(actor, 'stock:manage');

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Stok Steril']}
        title="Stok Steril"
        description="Paket yang dilepas, belum kedaluwarsa dan tidak diblokir. Paket yang paling cepat kedaluwarsa tampil paling atas."
      />
      <div className="stack">
        {expired.length > 0 ? (
          <section className="card card--alert" aria-labelledby="kedaluwarsa-judul">
            <h2 id="kedaluwarsa-judul">Kedaluwarsa di rak ({expired.length})</h2>
            <p>Paket ini tidak bisa dikirim. Tarik dari rak lalu terima tray-nya sebagai kasus baru untuk diproses ulang.</p>
            <PackageTable rows={expired} id="kedaluwarsa-judul" timeZone={actor.timeZone} />
            {canManage ? (
              <ActionForm action={pullExpiredAction} className="button-row">
                <SubmitButton variant="danger">Tarik {expired.length} paket kedaluwarsa</SubmitButton>
              </ActionForm>
            ) : null}
          </section>
        ) : null}

        <section className="card" aria-labelledby="tersedia-judul">
          <h2 id="tersedia-judul">Tersedia untuk distribusi ({available.length})</h2>
          {available.length === 0 ? (
            <p className="muted">Belum ada paket tersedia. Paket masuk stok setelah batch-nya dilepas di Batch & Mutu.</p>
          ) : (
            <PackageTable rows={available} id="tersedia-judul" timeZone={actor.timeZone} />
          )}
        </section>

        {canManage && available.length > 0 ? (
          <section className="card" aria-labelledby="pindah-judul">
            <h2 id="pindah-judul">Tempatkan atau pindah rak</h2>
            {locations.length === 0 ? (
              <p className="hint-hold">Belum ada rak aktif. Minta admin menambahkan rak di Master.</p>
            ) : (
              <ActionForm action={moveStockAction}>
                <label className="field field--narrow">
                  <span>Rak tujuan</span>
                  <select name="locationId" required defaultValue="">
                    <option value="" disabled>Pilih rak</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>{location.code}, {location.name}</option>
                    ))}
                  </select>
                </label>
                <PackagePicker
                  legend="Paket yang dipindah"
                  columns={['Lokasi sekarang', 'Kedaluwarsa']}
                  rows={available.map((item) => ({
                    code: item.code,
                    setName: item.setTemplate?.name ?? '-',
                    details: [item.location?.name ?? 'Belum ditempatkan', item.expiresAt ? formatDate(item.expiresAt.toISOString(), actor.timeZone) : '-'],
                  }))}
                />
                <div className="form-actions">
                  <SubmitButton>Pindahkan</SubmitButton>
                </div>
              </ActionForm>
            )}
          </section>
        ) : null}

        <section className="card" aria-labelledby="tahan-judul">
          <h2 id="tahan-judul">Ditahan atau diblokir ({held.length})</h2>
          {held.length === 0 ? (
            <p className="muted">Tidak ada paket yang ditahan atau diblokir recall.</p>
          ) : (
            <PackageTable rows={held} id="tahan-judul" timeZone={actor.timeZone} showStatus />
          )}
        </section>

        <section className="card" aria-labelledby="kembali-judul">
          <h2 id="kembali-judul">Kembali ke CSSD ({returned.length})</h2>
          {returned.length === 0 ? (
            <p className="muted">Tidak ada paket yang kembali. Paket retur tidak otomatis tersedia lagi; terima tray-nya sebagai kasus baru.</p>
          ) : (
            <PackageTable rows={returned} id="kembali-judul" timeZone={actor.timeZone} showStatus />
          )}
        </section>
      </div>
    </>
  );
}
