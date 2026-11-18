import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuditTrail } from '@/components/cssd/audit-trail';
import { NoAccess } from '@/components/cssd/no-access';
import { PageHeader } from '@/components/cssd/page-header';
import { CssdStatusTag, Tag } from '@/components/cssd/status-tag';
import { CASE_STATUS, POSITION, QUALITY } from '@/lib/labels';
import { can, getActor } from '@/server/identity';
import { getTrace } from '@/server/pages';
import { normalizeScanCode } from '@/server/queue/params';

export const metadata: Metadata = { title: 'Pelacakan' };

export default async function TracePage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const actor = await getActor();
  if (!actor || !can(actor, 'trace:read')) return <NoAccess />;
  const raw = (await searchParams).code;
  const input = typeof raw === 'string' ? raw : '';
  const code = input ? normalizeScanCode(input) : null;
  const trace = code ? await getTrace(actor, code) : null;
  const found = trace && (trace.pack || trace.load || trace.tray || trace.found);

  return (
    <>
      <PageHeader
        actor={actor}
        crumbs={['SIMRS', 'CSSD', 'Pelacakan']}
        title="Pelacakan"
        description="Cari kode paket, tray, batch atau kasus untuk melihat posisi terakhir dan seluruh riwayatnya."
      />
      <div className="stack">
        <form className="card trace-search" action="/cssd/trace" role="search">
          <label className="field field--grow">
            <span>Kode paket, tray, batch atau kasus</span>
            <input
              name="code"
              defaultValue={input}
              required
              maxLength={32}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Contoh: PK-0047, TR-0001, BT-0021"
            />
          </label>
          <button type="submit" className="button button--primary">
            <MagnifyingGlassIcon aria-hidden size={16} weight="bold" />
            Telusuri
          </button>
        </form>

        {input && !code ? (
          <p className="hint-hold" role="alert">
            Format kode tidak dikenali. Gunakan huruf, angka dan tanda hubung.
          </p>
        ) : null}
        {code && !found ? (
          <p className="hint-hold" role="status">
            Kode {code} tidak ditemukan di fasilitas ini. Periksa label lalu coba lagi.
          </p>
        ) : null}

        {trace?.pack ? (
          <section className="card" aria-labelledby="paket-judul">
            <h2 id="paket-judul">Paket {trace.pack.code}</h2>
            <dl className="facts facts--wide">
              <div>
                <dt>Set</dt>
                <dd>{trace.pack.setTemplate?.name ?? '-'}</dd>
              </div>
              <div>
                <dt>Tray</dt>
                <dd className="num">
                  {trace.pack.tray ? <Link href={`/cssd/trace?code=${trace.pack.tray.code}`}>{trace.pack.tray.code}</Link> : '-'}
                </dd>
              </div>
              <div>
                <dt>Batch</dt>
                <dd className="num">
                  {trace.pack.load ? <Link href={`/cssd/batches/${trace.pack.load.code}`}>{trace.pack.load.code}</Link> : 'Belum dimuat'}
                </dd>
              </div>
              <div>
                <dt>Posisi</dt>
                <dd>
                  {POSITION[trace.pack.position]}
                  {trace.pack.destinationUnit ? ` (${trace.pack.destinationUnit.code})` : ''}
                  {trace.pack.location ? `, ${trace.pack.location.name}` : ''}
                </dd>
              </div>
              <div>
                <dt>Mutu</dt>
                <dd>
                  <Tag {...QUALITY[trace.pack.qualityStatus]} />
                </dd>
              </div>
              <div>
                <dt>Blok recall</dt>
                <dd>{trace.pack.blocked ? <Tag label="Diblokir" tone="hold" /> : 'Tidak ada'}</dd>
              </div>
              <div>
                <dt>Lot kemasan</dt>
                <dd className="num">{trace.pack.materialLot ?? '-'}</dd>
              </div>
              <div>
                <dt>Label dicetak</dt>
                <dd className="num">{trace.pack.printCount} kali</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {trace?.load ? (
          <section className="card" aria-labelledby="batch-judul">
            <div className="card__title-row">
              <h2 id="batch-judul">Batch {trace.load.code}</h2>
              <CssdStatusTag status={trace.load.queueStatus} />
            </div>
            <p>
              {trace.load.setTemplate.name}, {trace.load.packages.length} paket.{' '}
              <Link href={`/cssd/batches/${trace.load.code}`}>Buka detail batch</Link>
            </p>
          </section>
        ) : null}

        {trace?.tray ? (
          <section className="card" aria-labelledby="tray-judul">
            <h2 id="tray-judul">Tray {trace.tray.code}</h2>
            <p>
              {trace.tray.setTemplate.name}, milik unit {trace.tray.homeUnit.code}.
            </p>
            <h3 className="subhead">Paket dari tray ini</h3>
            {trace.tray.packages.length === 0 ? (
              <p className="muted">Belum pernah dikemas.</p>
            ) : (
              <ul className="chips">
                {trace.tray.packages.map((item) => (
                  <li key={item.id} className="num">
                    <Link href={`/cssd/trace?code=${item.code}`}>{item.code}</Link>, {POSITION[item.position].toLowerCase()}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="subhead">Kasus pemrosesan</h3>
            {trace.tray.cases.length === 0 ? (
              <p className="muted">Belum pernah diterima CSSD.</p>
            ) : (
              <ul className="chips">
                {trace.tray.cases.map((item) => (
                  <li key={item.id} className="num">
                    {item.code}, {CASE_STATUS[item.status].label.toLowerCase()}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {trace?.found ? (
          <section className="card" aria-labelledby="kasus-judul">
            <h2 id="kasus-judul">Kasus {trace.found.code}</h2>
            <p>
              Tray {trace.found.tray.code}, {CASE_STATUS[trace.found.status].label.toLowerCase()}.{' '}
              {trace.found.status !== 'PACKAGED' ? <Link href="/cssd/receiving">Buka di Penerimaan</Link> : null}
            </p>
          </section>
        ) : null}

        {found ? (
          <section className="card" aria-labelledby="riwayat-judul">
            <h2 id="riwayat-judul">Riwayat {code}</h2>
            <AuditTrail events={trace.audit} timeZone={actor.timeZone} labelledBy="riwayat-judul" />
          </section>
        ) : null}
      </div>
    </>
  );
}
