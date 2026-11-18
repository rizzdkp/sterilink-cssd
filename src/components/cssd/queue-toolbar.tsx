import { CaretDownIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { METHOD_LABEL, STATUS_META } from '@/lib/format';
import { hasActiveFilters, queueHref } from '@/lib/queue-url';
import { QUEUE_STATUSES, type QueueQuery } from '@/server/queue/params';
import type { FilterOption } from '@/server/queue/service';
import { AutoSubmitForm } from './auto-submit-form';

function FilterSelect({
  name,
  label,
  allLabel,
  value,
  options,
}: {
  name: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  options: { value: string; label: string }[];
}) {
  return (
    <span className="select">
      <select name={name} aria-label={label} defaultValue={value ?? ''} key={value ?? ''}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDownIcon aria-hidden size={14} weight="bold" />
    </span>
  );
}

export function BatchQueueToolbar({
  query,
  units,
  setTypes,
}: {
  query: QueueQuery;
  units: FilterOption[];
  setTypes: FilterOption[];
}) {
  return (
    // Form GET biasa: filter tetap bekerja tanpa JavaScript dan tersimpan di URL.
    // Halaman dan pilihan batch sengaja tidak ikut dikirim, sehingga kembali ke awal.
    <AutoSubmitForm className="toolbar" action="/cssd" role="search" aria-label="Cari dan saring antrean">
      {query.tab !== 'ALL' ? <input type="hidden" name="tab" value={query.tab} /> : null}
      {query.sort !== 'code:desc' ? <input type="hidden" name="sort" value={query.sort} /> : null}

      <span className="search">
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ''}
          key={query.q ?? ''}
          placeholder="Cari batch, set, atau unit"
          aria-label="Cari batch, set, atau unit"
          maxLength={80}
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="search__submit" aria-label="Terapkan pencarian dan filter">
          <MagnifyingGlassIcon aria-hidden size={16} weight="bold" />
        </button>
      </span>

      <FilterSelect
        name="unitId"
        label="Unit Asal"
        allLabel="Semua unit"
        value={query.unitId}
        options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
      />
      <FilterSelect
        name="setTypeId"
        label="Jenis Set"
        allLabel="Semua set"
        value={query.setTypeId}
        options={setTypes.map((set) => ({ value: set.id, label: set.label }))}
      />
      <FilterSelect
        name="method"
        label="Metode Sterilisasi"
        allLabel="Semua metode"
        value={query.method}
        options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
      />
      <FilterSelect
        name="status"
        label="Status"
        allLabel="Semua status"
        value={query.status}
        options={QUEUE_STATUSES.map((status) => ({ value: status, label: STATUS_META[status].label }))}
      />

      {hasActiveFilters(query) ? (
        <Link
          className="toolbar__clear"
          href={queueHref(query, { q: undefined, unitId: undefined, setTypeId: undefined, method: undefined, status: undefined, page: 1 })}
        >
          <XIcon aria-hidden size={14} weight="bold" />
          Hapus filter
        </Link>
      ) : null}
    </AutoSubmitForm>
  );
}
