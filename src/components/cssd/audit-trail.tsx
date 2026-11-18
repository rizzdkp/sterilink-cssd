import { formatDate, formatTime } from '@/lib/format';

interface AuditRow {
  id: string;
  occurredAt: Date;
  actorName: string;
  actorRole: string;
  action: string;
  entityCode: string;
  detail: string | null;
}

/** Jejak audit sebagai tabel, sehingga terbaca keyboard dan pembaca layar. */
export function AuditTrail({ events, timeZone, labelledBy, showActor = true }: { events: AuditRow[]; timeZone: string; labelledBy: string; showActor?: boolean }) {
  if (events.length === 0) return <p className="muted">Belum ada kejadian tercatat untuk pilihan ini.</p>;
  return (
    <div className="scroll-x" tabIndex={0} role="region" aria-labelledby={labelledBy}>
      <table className="plain-table">
        <thead>
          <tr>
            <th scope="col">Waktu</th>
            <th scope="col">Kejadian</th>
            <th scope="col">Kode</th>
            {showActor ? <th scope="col">Pelaku</th> : null}
            <th scope="col">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td className="num nowrap">
                {formatDate(event.occurredAt.toISOString(), timeZone)}, {formatTime(event.occurredAt.toISOString(), timeZone)}
              </td>
              <th scope="row">{event.action}</th>
              <td className="num">{event.entityCode}</td>
              {showActor ? (
                <td>
                  {event.actorName ? <span className="strong">{event.actorName}</span> : null}
                  <span className="muted"> {event.actorRole}</span>
                </td>
              ) : null}
              <td>{event.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
