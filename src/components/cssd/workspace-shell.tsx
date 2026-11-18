import { BuildingsIcon, ListIcon } from '@phosphor-icons/react/dist/ssr';
import { can, type Actor } from '@/server/identity';
import { Announcer } from './announcer';
import { NavList, type NavKey } from './nav-list';

function navFor(actor: Actor | null): NavKey[] {
  if (!actor) return [];
  const keys: NavKey[] = [];
  if (can(actor, 'queue:read')) keys.push('queue');
  if (can(actor, 'request:read')) keys.push('requests');
  if (can(actor, 'case:receive') || can(actor, 'case:inspect') || can(actor, 'stock:read')) keys.push('receiving');
  if (can(actor, 'batch:read')) keys.push('batches');
  if (can(actor, 'stock:read')) keys.push('stock');
  if (can(actor, 'handover:read')) keys.push('distributions');
  if (can(actor, 'trace:read')) keys.push('trace', 'recalls');
  if (can(actor, 'report:read')) keys.push('reports');
  if (can(actor, 'audit:read')) keys.push('audit');
  if (can(actor, 'master:manage')) keys.push('admin');
  return keys;
}

export function CssdWorkspaceShell({ actor, children }: { actor: Actor | null; children: React.ReactNode }) {
  const keys = navFor(actor);
  return (
    <div className="shell">
      <a className="skip-link" href="#konten">
        Lewati ke konten
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__name">SIMRS</span>
          <span className="brand__module">CSSD</span>
        </div>

        {keys.length > 0 ? (
          <>
            <nav className="nav nav--desktop" aria-label="Menu CSSD">
              <NavList keys={keys} />
            </nav>
            <details className="nav nav--compact">
              <summary>
                <ListIcon aria-hidden size={20} />
                Menu
              </summary>
              <nav aria-label="Menu CSSD">
                <NavList keys={keys} />
              </nav>
            </details>
          </>
        ) : null}

        {actor ? (
          <div className="facility">
            <BuildingsIcon aria-hidden size={20} />
            <div>
              <span className="facility__label">Fasilitas</span>
              <span className="facility__name">{actor.facilityName}</span>
            </div>
          </div>
        ) : null}
      </aside>
      <main className="main" id="konten">
        {children}
      </main>
      <Announcer />
    </div>
  );
}
