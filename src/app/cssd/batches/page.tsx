import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/cssd/action-form';
import { NoAccess } from '@/components/cssd/no-access';
import { PackagePicker } from '@/components/cssd/package-picker';
import { PageHeader } from '@/components/cssd/page-header';
import { CssdStatusTag } from '@/components/cssd/status-tag';
import { METHOD_LABEL } from '@/lib/format';
import { createLoadAction } from '@/server/actions';
import { can, getActor } from '@/server/identity';
import { getBatchesData } from '@/server/pages';

export const metadata: Metadata = { title: 'Batch & Mutu' };

export default async function BatchesPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'batch:read')) return <NoAccess />;
  const { devices, readyPackages, activeLoads } = await getBatchesData(actor);
  const canLoad = can(actor, 'load:manage');
  const usable = devices.filter((device) => device.status === 'ACTIVE');

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Batch & Mutu']}
        title="Batch & Mutu"
        description="Susun muatan mesin, jalankan siklus, catat bukti pemantauan, lalu putuskan pelepasan."
      />

      <div className="stack">
        {canLoad ? (
          <section className="card" aria-labelledby="muat-judul">
            <h2 id="muat-judul">Susun muatan</h2>
            {readyPackages.length === 0 ? (
              <p className="muted">Belum ada paket siap muat. Paket muncul di sini setelah dikemas di Penerimaan.</p>
            ) : usable.length === 0 ? (
              <p className="hint-hold">Semua mesin sedang tidak layak pakai. Hubungi teknisi atau supervisor.</p>
            ) : (
              <ActionForm action={createLoadAction}>
                <label className="field field--narrow">
                  <span>Mesin</span>
                  <select name="deviceId" required defaultValue="">
                    <option value="" disabled>
                      Pilih mesin
                    </option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id} disabled={device.status !== 'ACTIVE'}>
                        {device.code} ({METHOD_LABEL[device.method]}){device.status !== 'ACTIVE' ? ', tidak layak pakai' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <PackagePicker
                  legend="Paket yang dimuat"
                  columns={['Tray', 'Lot kemasan']}
                  rows={readyPackages.map((item) => ({
                    code: item.code,
                    setName: item.setTemplate?.name ?? '-',
                    details: [item.tray?.code ?? '-', item.materialLot ?? '-'],
                  }))}
                />
                <div className="form-actions">
                  <SubmitButton>Susun muatan</SubmitButton>
                </div>
              </ActionForm>
            )}
          </section>
        ) : null}

        <section className="card" aria-labelledby="aktif-judul">
          <h2 id="aktif-judul">Batch berjalan dan menunggu keputusan ({activeLoads.length})</h2>
          {activeLoads.length === 0 ? (
            <p className="muted">Tidak ada batch yang sedang berjalan atau menunggu keputusan mutu.</p>
          ) : (
            <div className="scroll-x" tabIndex={0} role="region" aria-labelledby="aktif-judul">
              <table className="plain-table">
                <thead>
                  <tr>
                    <th scope="col">Batch</th>
                    <th scope="col">Set utama</th>
                    <th scope="col">Paket</th>
                    <th scope="col">Mesin</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoads.map((load) => (
                    <tr key={load.id}>
                      <th scope="row">
                        <Link className="strong num" href={`/cssd/batches/${load.code}`}>
                          {load.code}
                        </Link>
                      </th>
                      <td>{load.setTemplate.name}</td>
                      <td className="num">{load.setCount}</td>
                      <td className="num">{load.device?.code ?? '-'}</td>
                      <td>
                        <CssdStatusTag status={load.queueStatus} />
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
