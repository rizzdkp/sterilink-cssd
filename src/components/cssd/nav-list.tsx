'use client';

import {
  ArrowUUpLeftIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  ScrollIcon,
  GearSixIcon,
  ListChecksIcon,
  PackageIcon,
  PathIcon,
  SealCheckIcon,
  TrayIcon,
  TruckIcon,
  type Icon,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavKey =
  'queue' | 'requests' | 'receiving' | 'batches' | 'stock' | 'distributions' | 'trace' | 'recalls' | 'reports' | 'audit' | 'admin';

const ITEMS: Record<NavKey, { label: string; href: string; icon: Icon; match: (path: string) => boolean }> = {
  queue: { label: 'Antrean Kerja', href: '/cssd', icon: ListChecksIcon, match: (path) => path === '/cssd' },
  requests: { label: 'Permintaan', href: '/cssd/requests', icon: ClipboardTextIcon, match: (path) => path.startsWith('/cssd/requests') },
  receiving: {
    label: 'Penerimaan',
    href: '/cssd/receiving',
    icon: TrayIcon,
    match: (path) => path.startsWith('/cssd/receiving') || path.startsWith('/cssd/packages'),
  },
  batches: { label: 'Batch & Mutu', href: '/cssd/batches', icon: SealCheckIcon, match: (path) => path.startsWith('/cssd/batches') },
  stock: { label: 'Stok Steril', href: '/cssd/stock', icon: PackageIcon, match: (path) => path.startsWith('/cssd/stock') },
  distributions: {
    label: 'Distribusi',
    href: '/cssd/distributions',
    icon: TruckIcon,
    match: (path) => path.startsWith('/cssd/distributions'),
  },
  trace: { label: 'Pelacakan', href: '/cssd/trace', icon: PathIcon, match: (path) => path.startsWith('/cssd/trace') },
  recalls: { label: 'Recall', href: '/cssd/recalls', icon: ArrowUUpLeftIcon, match: (path) => path.startsWith('/cssd/recalls') },
  reports: { label: 'Laporan', href: '/cssd/reports', icon: ChartBarIcon, match: (path) => path.startsWith('/cssd/reports') },
  audit: { label: 'Audit', href: '/cssd/audit', icon: ScrollIcon, match: (path) => path.startsWith('/cssd/audit') },
  admin: { label: 'Master', href: '/cssd/admin', icon: GearSixIcon, match: (path) => path.startsWith('/cssd/admin') },
};

/** Menu hanya memuat layar yang boleh dibuka peran saat ini. */
export function NavList({ keys }: { keys: NavKey[] }) {
  const pathname = usePathname();
  return (
    <ul className="nav__list">
      {keys.map((key) => {
        const item = ITEMS[key];
        const active = item.match(pathname);
        const ItemIcon = item.icon;
        return (
          <li key={key}>
            <Link
              href={item.href}
              className={active ? 'nav__item nav__item--active' : 'nav__item'}
              aria-current={active ? 'page' : undefined}
            >
              <ItemIcon aria-hidden size={20} weight={active ? 'fill' : 'regular'} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
