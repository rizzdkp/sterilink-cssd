import { DownloadSimpleIcon } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuditTrail } from '@/components/cssd/audit-trail';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { can, getActor } from '@/server/identity';
import { normalizeScanCode } from '@/server/queue/params';
import { getAuditPage, resolvePeriod } from '@/server/reports';
import { DomainError } from '@/server/workflow';

export const metadata: Metadata = { title: 'Audit' };

type Search = { from?: string; to?: string; code?: string; actor?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await getActor();
  if (!actor || !can(actor, 'audit:read')) return <NoAccess />;
  const params = await searchParams;
  let period;
  let periodError: string | null = null;
  try {
    period = resolvePeriod(actor.timeZone, params.from, params.to);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    periodError = error.message;
    period = resolvePeriod(actor.timeZone);
  }
  const code = params.code ? normalizeScanCode(params.code) : null;
  const actorName = (params.actor ?? '').trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const { events, total, pageSize } = await getAuditPage(actor, period, { code: code ?? undefined, actor: actorName || undefined, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const base = new URLSearchParams({
    from: period.from,
    to: period.to,
    ...(code ? { code } : {}),
    ...(actorName ? { actor: actorName } : {}),
  });
  const pageHref = (target: number) => `/cssd/audit?${new URLSearchParams({ ...Object.fromEntries(base), page: String(target) })}`;

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Audit']}
        title="Audit"
        description="Seluruh kejadian yang tercatat aplikasi, tidak pernah diubah atau dihapus. Waktu dalam zona fasilitas."
      />
      <div className="stack">
        <form className="card trace-search" action="/cssd/audit">
          <label className="field">
            <span>Dari tanggal</span>
            <input type="date" name="from" defaultValue={period.from} />
          </label>
          <label className="field">
            <span>Sampai tanggal</span>
            <input type="date" name="to" defaultValue={period.to} />
          </label>
          <label className="field">
            <span>Kode (paket, tray, batch, akun)</span>
            <input name="code" defaultValue={code ?? ''} maxLength={32} autoCapitalize="characters" spellCheck={false} />
          </label>
          <label className="field">
            <span>Nama pelaku</span>
            <input name="actor" defaultValue={actorName} maxLength={80} />
          </label>
          <button type="submit" className="button button--primary">
            Saring
          </button>
          {periodError ? (
            <p className="hint-hold" role="alert">
              {periodError}
            </p>
          ) : null}
        </form>

        <section className="card" aria-labelledby="audit-judul">
          <div className="card__title-row">
            <h2 id="audit-judul">{total} kejadian</h2>
            <a className="button button--secondary" href={`/api/v1/cssd/exports?kind=audit&${base}`}>
              <DownloadSimpleIcon aria-hidden size={16} weight="bold" />
              Unduh CSV
            </a>
          </div>
          <AuditTrail events={events} timeZone={actor.timeZone} labelledBy="audit-judul" showActor />
          {pages > 1 ? (
            <nav className="pagination" aria-label="Halaman audit">
              {page > 1 ? (
                <Link className="pagination__step" href={pageHref(page - 1)}>
                  Sebelumnya
                </Link>
              ) : null}
              <span className="muted num">
                Halaman {page} dari {pages}
              </span>
              {page < pages ? (
                <Link className="pagination__step" href={pageHref(page + 1)}>
                  Berikutnya
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </>
  );
}
