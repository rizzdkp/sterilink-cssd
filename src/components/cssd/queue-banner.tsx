import Image from 'next/image';
import type { QueueSummary } from '@/server/queue/service';

// Kalimat ringkasan dirakit dari hitungan server, tidak pernah dari angka contoh.
function summaryLine(summary: QueueSummary): string {
  const waiting = summary.awaitingEvidence + summary.readyForReview + summary.held;
  if (summary.total === 0) return 'Belum ada batch di antrean fasilitas ini.';
  if (waiting === 0) return 'Tidak ada batch yang menunggu keputusan mutu saat ini.';

  const parts: string[] = [];
  if (summary.readyForReview > 0) parts.push(`${summary.readyForReview} siap ditinjau`);
  if (summary.awaitingEvidence > 0) parts.push(`${summary.awaitingEvidence} menunggu hasil indikator`);
  if (summary.held > 0) parts.push(`${summary.held} ditahan`);
  return `${waiting} batch menunggu keputusan mutu: ${parts.join(', ')}.`;
}

export function CssdQueueBanner({ summary }: { summary: QueueSummary }) {
  return (
    <section className="cssd-queue-banner" aria-labelledby="banner-judul">
      <Image
        className="cssd-queue-banner__art"
        src="/images/cssd/cssd-queue-banner.png"
        alt=""
        width={2172}
        height={724}
        sizes="(max-width: 767px) 1px, (max-width: 1100px) 100vw, 1288px"
        priority
      />
      <div className="cssd-queue-banner__copy">
        <h2 id="banner-judul">Sterilisasi Sentral</h2>
        <p>{summaryLine(summary)}</p>
      </div>
    </section>
  );
}
