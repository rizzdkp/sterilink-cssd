import { ArrowDownIcon, ArrowUpIcon, ArrowsDownUpIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react/dist/ssr';
import Image from 'next/image';
import Link from 'next/link';
import { METHOD_LABEL, formatDate, formatTime } from '@/lib/format';
import { hasActiveFilters, queueHref } from '@/lib/queue-url';
import type { QueueQuery } from '@/server/queue/params';
import type { QueueItem, QueueResponse } from '@/server/queue/service';
import { CssdStatusTag } from './status-tag';

type SortField = 'code' | 'startedAt' | 'targetAt';

function SortHeader({ query, field, label, className }: { query: QueueQuery; field: SortField; label: string; className?: string }) {
  const [activeField, direction] = query.sort.split(':');
  const active = activeField === field;
  const next = active && direction === 'desc' ? 'asc' : 'desc';
  const SortIcon = !active ? ArrowsDownUpIcon : direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <th scope="col" className={className} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link className="sort" href={queueHref(query, { sort: `${field}:${next}` as QueueQuery['sort'], page: 1 })}>
        {label}
        <SortIcon aria-hidden size={12} weight="bold" />
        <span className="visually-hidden">
          {active ? `, diurutkan ${direction === 'asc' ? 'naik' : 'turun'}. ` : '. '}
          Urutkan {next === 'asc' ? 'naik' : 'turun'}
        </span>
      </Link>
    </th>
  );
}

function DateCell({ iso, timeZone }: { iso: string | null; timeZone: string }) {
  if (!iso) return <span className="muted">Belum ada</span>;
  return (
    <time dateTime={iso} className="two-line">
      <span>{formatDate(iso, timeZone)}</span>
      <span className="muted">{formatTime(iso, timeZone)}</span>
    </time>
  );
}

function EmptyQueue({ query }: { query: QueueQuery }) {
  // Dua keadaan kosong yang berbeda: antrean memang kosong, atau filter tidak cocok.
  if (hasActiveFilters(query) || query.tab !== 'ALL') {
    return (
      <div className="empty" role="status">
        <h3>Tidak ada batch untuk filter ini</h3>
        <p>Ubah kata kunci atau filter, atau tampilkan kembali seluruh antrean.</p>
        <Link className="button button--secondary" href="/cssd">
          Hapus filter
        </Link>
      </div>
    );
  }
  return (
    <div className="empty" role="status">
      <Image src="/images/cssd/cssd-empty-tray.png" alt="" width={96} height={96} className="empty__art" loading="lazy" />
      <h3>Belum ada batch di antrean</h3>
      <p>Batch muncul di sini setelah paket dimuat ke mesin. Pindai kode tray atau paket untuk memulai dari stasiun.</p>
    </div>
  );
}

function Pagination({ query, queue, selectedCode }: { query: QueueQuery; queue: QueueResponse; selectedCode: string | null }) {
  const pageCount = Math.max(1, Math.ceil(queue.total / queue.pageSize));
  const first = (queue.page - 1) * queue.pageSize + 1;
  const last = first + queue.items.length - 1;
  return (
    <div className="table-footer">
      <p aria-live="polite">
        Menampilkan {first} sampai {last} dari {queue.total} batch
      </p>
      {pageCount > 1 ? (
        <nav className="pagination" aria-label="Halaman antrean">
          {queue.page > 1 ? (
            <Link className="pagination__step" href={queueHref(query, { page: queue.page - 1 })} aria-label="Halaman sebelumnya">
              <CaretLeftIcon aria-hidden size={14} weight="bold" />
            </Link>
          ) : (
            <span className="pagination__step" aria-disabled="true">
              <CaretLeftIcon aria-hidden size={14} weight="bold" />
              <span className="visually-hidden">Halaman sebelumnya tidak tersedia</span>
            </span>
          )}
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              className={page === queue.page ? 'pagination__page pagination__page--active' : 'pagination__page'}
              href={queueHref(query, { page }, page === queue.page ? selectedCode : null)}
              aria-current={page === queue.page ? 'page' : undefined}
              aria-label={`Halaman ${page}`}
            >
              {page}
            </Link>
          ))}
          {queue.page < pageCount ? (
            <Link className="pagination__step" href={queueHref(query, { page: queue.page + 1 })} aria-label="Halaman berikutnya">
              <CaretRightIcon aria-hidden size={14} weight="bold" />
            </Link>
          ) : (
            <span className="pagination__step" aria-disabled="true">
              <CaretRightIcon aria-hidden size={14} weight="bold" />
              <span className="visually-hidden">Halaman berikutnya tidak tersedia</span>
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function batchLabel(item: QueueItem, selected: boolean) {
  return `Batch ${item.code}, ${item.setName}${selected ? ', sedang dipilih' : ''}`;
}

export function BatchQueueTable({
  query,
  queue,
  selectedCode,
  timeZone,
}: {
  query: QueueQuery;
  queue: QueueResponse;
  selectedCode: string | null;
  timeZone: string;
}) {
  if (queue.items.length === 0) {
    return (
      <div className="table-card">
        <EmptyQueue query={query} />
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(queue.total / queue.pageSize));

  return (
    <div className="table-card">
      <table className="queue-table">
        <caption className="visually-hidden">
          Antrean batch, halaman {queue.page} dari {pageCount}. Pilih nomor batch untuk melihat detailnya.
        </caption>
        <thead>
          <tr>
            <SortHeader query={query} field="code" label="No. Batch" className="col-code" />
            <th scope="col">Set / Instrumen</th>
            <th scope="col" className="col-unit">Unit Asal</th>
            <th scope="col" className="col-qty">Jumlah</th>
            <th scope="col" className="col-method">Metode</th>
            <SortHeader query={query} field="startedAt" label="Mulai Proses" className="col-start" />
            <SortHeader query={query} field="targetAt" label="Target Selesai" className="col-target" />
            <th scope="col" className="col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {queue.items.map((item) => {
            const selected = item.code === selectedCode;
            return (
              <tr key={item.code} className={selected ? 'is-selected' : undefined}>
                <th scope="row" className="col-code">
                  <Link
                    className="code-link"
                    href={queueHref(query, {}, item.code)}
                    scroll={false}
                    aria-current={selected ? 'true' : undefined}
                    aria-label={batchLabel(item, selected)}
                  >
                    {item.code}
                  </Link>
                </th>
                <td>
                  <span className="two-line">
                    <span className="strong">{item.setName}</span>
                    <span className="muted">{item.setDescription}</span>
                  </span>
                </td>
                <td className="col-unit">{item.unitLabel}</td>
                <td className="col-qty num">{item.setCount} set</td>
                <td className="col-method">{METHOD_LABEL[item.method]}</td>
                <td className="col-start num"><DateCell iso={item.startedAt} timeZone={timeZone} /></td>
                <td className="col-target num"><DateCell iso={item.targetAt} timeZone={timeZone} /></td>
                <td className="col-status"><CssdStatusTag status={item.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Daftar rangkum untuk ponsel: isi sama, tanpa gulir mendatar. */}
      <ul className="queue-list">
        {queue.items.map((item) => {
          const selected = item.code === selectedCode;
          return (
            <li key={item.code}>
              <Link className="queue-card" href={queueHref(query, {}, item.code)} aria-label={batchLabel(item, selected)}>
                <span className="queue-card__top">
                  <span className="queue-card__code">{item.code}</span>
                  <CssdStatusTag status={item.status} />
                </span>
                <span className="strong">{item.setName}</span>
                <span className="muted">
                  {item.unitLabel}, {item.setCount} set, {METHOD_LABEL[item.method]}
                </span>
                {item.targetAt ? (
                  <span className="muted num">
                    Target {formatDate(item.targetAt, timeZone)} {formatTime(item.targetAt, timeZone)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <Pagination query={query} queue={queue} selectedCode={selectedCode} />
    </div>
  );
}
