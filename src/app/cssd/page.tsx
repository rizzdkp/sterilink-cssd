import { redirect } from 'next/navigation';
import { BatchDetailPanel } from '@/components/cssd/batch-detail-panel';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { CssdQueueBanner } from '@/components/cssd/queue-banner';
import { BatchQueueTable } from '@/components/cssd/queue-table';
import { BatchQueueTabs } from '@/components/cssd/queue-tabs';
import { BatchQueueToolbar } from '@/components/cssd/queue-toolbar';
import { ScanDialog } from '@/components/cssd/scan-dialog';
import { queueHref } from '@/lib/queue-url';
import { can, getActor } from '@/server/identity';
import { normalizeScanCode, parseQueueQueryLenient, type RawQuery } from '@/server/queue/params';
import { getFilterOptions, getLoadDetail, getQueue, getQueueSummary } from '@/server/queue/service';

export default async function QueuePage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const actor = await getActor();
  // Petugas unit tidak membaca antrean CSSD; layar kerjanya adalah konfirmasi serah terima.
  if (actor && !can(actor, 'queue:read') && can(actor, 'handover:read')) redirect('/cssd/distributions');
  if (!actor || !can(actor, 'queue:read')) return <NoAccess />;

  const raw = await searchParams;
  const query = parseQueueQueryLenient(raw);
  const requested = typeof raw.batch === 'string' ? raw.batch : null;
  const requestedCode = requested ? normalizeScanCode(requested) : null;

  const [queue, summary, options] = await Promise.all([getQueue(actor, query), getQueueSummary(actor), getFilterOptions(actor)]);

  // Halaman di luar jangkauan (misalnya setelah filter mempersempit hasil) diarahkan ke halaman terakhir.
  const pageCount = Math.max(1, Math.ceil(queue.total / queue.pageSize));
  if (query.page > pageCount) redirect(queueHref(query, { page: pageCount }, requestedCode));

  // Tanpa pilihan eksplisit, baris pertama ditampilkan di panel layar lebar.
  const selectedCode = requested ? requestedCode : (queue.items[0]?.code ?? null);
  const detail = selectedCode ? await getLoadDetail(actor, selectedCode) : null;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Antrean Kerja']}
        title="Antrean Kerja"
        description="Batch sterilisasi di fasilitas Anda, dari muatan sampai keputusan mutu."
        synthetic={summary.synthetic}
        action={<ScanDialog />}
      />

      <CssdQueueBanner summary={summary} />

      <div className="workspace" data-explicit={requested ? 'true' : 'false'}>
        <section className="queue" aria-label="Antrean batch">
          <BatchQueueTabs query={query} counts={queue.tabs} />
          <BatchQueueToolbar query={query} units={options.units} setTypes={options.setTypes} />
          <BatchQueueTable query={query} queue={queue} selectedCode={detail?.code ?? null} timeZone={actor.timeZone} />
        </section>

        <BatchDetailPanel
          detail={detail}
          missingCode={requested && !detail ? requested.trim().slice(0, 32) : null}
          backHref={queueHref(query)}
          timeZone={actor.timeZone}
          canOpenEvidence={can(actor, 'evidence:read')}
        />
      </div>
    </>
  );
}
