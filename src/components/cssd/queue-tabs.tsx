import Link from 'next/link';
import { queueHref } from '@/lib/queue-url';
import type { QueueQuery } from '@/server/queue/params';
import { QUEUE_TABS, type QueueTab } from '@/server/queue/status';

const TAB_LABEL: Record<QueueTab, string> = {
  ALL: 'Semua',
  WAITING_PROCESS: 'Menunggu Proses',
  STERILIZATION: 'Sterilisasi',
  VERIFICATION: 'Menunggu Verifikasi',
  DONE: 'Selesai',
};

export function BatchQueueTabs({ query, counts }: { query: QueueQuery; counts: Record<QueueTab, number> }) {
  return (
    <nav className="tabs" aria-label="Tahap antrean">
      <ul>
        {QUEUE_TABS.map((tab) => {
          const active = tab === query.tab;
          return (
            <li key={tab}>
              <Link
                // Pindah tab mengembalikan ke halaman 1 dan melepas pilihan batch.
                href={queueHref(query, { tab, page: 1, status: undefined })}
                className={active ? 'tabs__link tabs__link--active' : 'tabs__link'}
                aria-current={active ? 'page' : undefined}
              >
                {TAB_LABEL[tab]}
                <span className="tabs__count">
                  {counts[tab]}
                  <span className="visually-hidden"> batch</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
