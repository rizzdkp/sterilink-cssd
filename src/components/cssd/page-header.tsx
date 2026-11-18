import { BellIcon, FlaskIcon, SignOutIcon, UserCircleIcon } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { logoutAction } from '@/server/actions';
import type { Actor } from '@/server/identity';
import { getAttention } from '@/server/pages';

function initials(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export async function PageHeader({
  actor,
  crumbs,
  title,
  description,
  synthetic = false,
  action,
}: {
  actor: Actor;
  crumbs: string[];
  title: string;
  description: string;
  // Hanya untuk data latihan (pnpm db:seed:training); data produksi tidak pernah berlabel ini.
  synthetic?: boolean;
  action?: React.ReactNode;
}) {
  // Penanda pekerjaan: jumlah yang menunggu peran ini, dari database.
  const attention = await getAttention(actor);
  return (
    <header className="page-header">
      <div className="page-header__lead">
        <nav aria-label="Lokasi halaman">
          <ol className="crumbs">
            {crumbs.map((crumb, index) => (
              <li key={`${crumb}-${index}`} aria-current={index === crumbs.length - 1 ? 'page' : undefined}>
                {crumb}
              </li>
            ))}
          </ol>
        </nav>
        <h1>{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      <div className="page-header__side">
        <div className="account">
          <Link
            className={attention.count > 0 ? 'attention attention--active' : 'attention'}
            href={attention.href}
            aria-label={`${attention.count} ${attention.label}`}
            title={`${attention.count} ${attention.label}`}
          >
            <BellIcon aria-hidden size={18} weight={attention.count > 0 ? 'fill' : 'regular'} />
            <span className="attention__count num" aria-hidden>
              {attention.count}
            </span>
          </Link>
          {synthetic ? (
            <span className="tag tag--neutral" title="Batch ini berasal dari data latihan, bukan kejadian nyata.">
              <FlaskIcon aria-hidden weight="bold" size={14} />
              Data latihan
            </span>
          ) : null}
          <span className="account__avatar" aria-hidden>
            {initials(actor.name)}
          </span>
          <span className="account__text">
            <span className="account__role">{actor.name}</span>
            <span className="account__station">
              {actor.roleLabel}, {actor.stationLabel}
            </span>
          </span>
          <Link className="icon-button" href="/account" aria-label="Akun dan kata sandi" title="Akun dan kata sandi">
            <UserCircleIcon aria-hidden size={20} />
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="icon-button" aria-label="Keluar" title="Keluar">
              <SignOutIcon aria-hidden size={20} />
            </button>
          </form>
        </div>
        {action}
      </div>
    </header>
  );
}
