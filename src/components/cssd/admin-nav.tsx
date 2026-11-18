import Link from 'next/link';

const TABS = [
  { key: 'overview', label: 'Fasilitas dan kebijakan', href: '/cssd/admin' },
  { key: 'users', label: 'Pengguna', href: '/cssd/admin/users' },
  { key: 'sets', label: 'Set dan tray', href: '/cssd/admin/sets' },
  { key: 'places', label: 'Unit, rak, mesin', href: '/cssd/admin/locations' },
  { key: 'backup', label: 'Backup', href: '/cssd/admin/backup' },
] as const;

export type AdminTab = (typeof TABS)[number]['key'];

/** Sub-navigasi area Master, dengan grammar tab yang sama seperti antrean. */
export function AdminNav({ active }: { active: AdminTab }) {
  return (
    <nav className="tabs admin-tabs" aria-label="Bagian Master">
      <ul>
        {TABS.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              className={tab.key === active ? 'tabs__link tabs__link--active' : 'tabs__link'}
              aria-current={tab.key === active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
