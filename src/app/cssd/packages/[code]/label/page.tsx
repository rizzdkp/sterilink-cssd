import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoAccess } from '@/components/cssd/no-access';
import { PrintLabelButton } from '@/components/cssd/print-label-button';
import { code128Widths } from '@/lib/code128';
import { formatDate } from '@/lib/format';
import { prisma } from '@/server/db';
import { can, getActor } from '@/server/identity';
import { normalizeScanCode } from '@/server/queue/params';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Label ${decodeURIComponent((await params).code).slice(0, 32)}` };
}

function Barcode({ value }: { value: string }) {
  const widths = code128Widths(value);
  const quiet = 10;
  const total = widths.reduce((sum, width) => sum + width, 0) + quiet * 2;
  let x = quiet;
  const bars: { x: number; w: number }[] = [];
  widths.forEach((width, index) => {
    if (index % 2 === 0) bars.push({ x, w: width });
    x += width;
  });
  return (
    <svg className="label__barcode" viewBox={`0 0 ${total} 60`} preserveAspectRatio="none" role="img" aria-label={`Barcode ${value}`}>
      <rect width={total} height={60} fill="#fff" />
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={60} fill="#000" />
      ))}
    </svg>
  );
}

export default async function LabelPage({ params }: Props) {
  const actor = await getActor();
  if (!actor || !can(actor, 'stock:read')) return <NoAccess />;
  const code = normalizeScanCode(decodeURIComponent((await params).code));
  const pack = code
    ? await prisma.package.findUnique({
        where: { facilityId_code: { facilityId: actor.facilityId, code } },
        include: { setTemplate: true, tray: true, load: true, case: { include: { originUnit: true } } },
      })
    : null;
  if (!pack) notFound();

  return (
    <div className="label-page">
      <div className="label-page__intro no-print">
        <h1>Label paket {pack.code}</h1>
        <p className="muted">
          Cetak ulang memakai kode paket yang sama dan tercatat di jejak audit. Label tidak memuat identitas pasien.
        </p>
        {can(actor, 'package:create') ? (
          <PrintLabelButton packageCode={pack.code} printed={pack.printCount} />
        ) : (
          <p className="muted">Peran Anda dapat melihat label, tetapi pencetakan dilakukan operator zona bersih.</p>
        )}
      </div>

      <article className="label" aria-label={`Pratinjau label ${pack.code}`}>
        <p className="label__code num">{pack.code}</p>
        <Barcode value={pack.code} />
        <dl className="label__facts">
          <div><dt>Set</dt><dd>{pack.setTemplate?.name ?? '-'}</dd></div>
          <div><dt>Tray</dt><dd className="num">{pack.tray?.code ?? '-'}</dd></div>
          <div><dt>Unit asal</dt><dd>{pack.case?.originUnit.code ?? '-'}</dd></div>
          <div><dt>Lot kemasan</dt><dd className="num">{pack.materialLot ?? '-'}</dd></div>
          <div><dt>Dikemas</dt><dd className="num">{formatDate(pack.createdAt.toISOString(), actor.timeZone)}</dd></div>
          <div><dt>Kedaluwarsa</dt><dd className="num">{pack.expiresAt ? formatDate(pack.expiresAt.toISOString(), actor.timeZone) : 'Setelah dilepas'}</dd></div>
          <div><dt>Fasilitas</dt><dd>{actor.facilityName}</dd></div>
        </dl>
        {pack.load?.synthetic ? <p className="label__demo">Data latihan, bukan label produksi</p> : null}
      </article>
    </div>
  );
}
