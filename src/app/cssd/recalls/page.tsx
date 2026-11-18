import type { Metadata } from 'next';
import Link from 'next/link';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { Tag } from '@/components/cssd/status-tag';
import { formatDate } from '@/lib/format';
import { can, getActor } from '@/server/identity';
import { getRecalls } from '@/server/pages';

export const metadata: Metadata = { title: 'Recall' };

export default async function RecallsPage() {
  const actor = await getActor();
  if (!actor || !can(actor, 'trace:read')) return <NoAccess />;
  const recalls = await getRecalls(actor);

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Recall']}
        title="Recall"
        description="Penarikan paket per batch, tindak lanjut per paket, dan penutupan dengan CAPA."
      />
      <section className="card" aria-labelledby="recall-judul">
        <h2 id="recall-judul">Daftar recall ({recalls.length})</h2>
        {recalls.length === 0 ? (
          <p className="muted">Belum ada recall. Supervisor membuka recall dari halaman detail batch yang siklusnya sudah selesai.</p>
        ) : (
          <div className="scroll-x" tabIndex={0} role="region" aria-labelledby="recall-judul">
            <table className="plain-table">
              <thead>
                <tr>
                  <th scope="col">Recall</th>
                  <th scope="col">Batch</th>
                  <th scope="col">Sebab</th>
                  <th scope="col">Tindak lanjut</th>
                  <th scope="col">Dibuka</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {recalls.map((recall) => {
                  const done = recall.items.filter((item) => item.status !== 'IDENTIFIED').length;
                  return (
                    <tr key={recall.id}>
                      <th scope="row" className="num">
                        <Link href={`/cssd/recalls/${recall.code}`}>{recall.code}</Link>
                      </th>
                      <td className="num">
                        <Link href={`/cssd/batches/${recall.load.code}`}>{recall.load.code}</Link>
                      </td>
                      <td>{recall.reason}</td>
                      <td className="num">
                        {done} dari {recall.items.length} paket
                      </td>
                      <td className="num">{formatDate(recall.openedAt.toISOString(), actor.timeZone)}</td>
                      <td>{recall.status === 'OPEN' ? <Tag label="Terbuka" tone="hold" /> : <Tag label="Ditutup" tone="pass" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
