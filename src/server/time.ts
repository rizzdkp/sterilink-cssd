// Zona waktu fasilitas di Indonesia tidak memakai musim panas, jadi selisihnya tetap.
const OFFSET_HOURS: Record<string, number> = {
  'Asia/Jakarta': 7,
  'Asia/Makassar': 8,
  'Asia/Jayapura': 9,
};

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Ubah nilai input datetime-local ("2026-11-17T08:30") di zona fasilitas menjadi waktu UTC. */
export function fromFacilityLocal(value: string, timeZone: string): Date {
  const match = LOCAL.exec(value.trim());
  const offset = OFFSET_HOURS[timeZone];
  if (!match || offset === undefined) return new Date(Number.NaN);
  const [, year, month, day, hour, minute] = match.map(Number) as number[];
  return new Date(Date.UTC(year!, month! - 1, day!, hour! - offset, minute!));
}

/** Nilai datetime-local di zona fasilitas, untuk mengisi bawaan input waktu. */
export function toFacilityLocal(date: Date, timeZone: string): string {
  const offset = OFFSET_HOURS[timeZone] ?? 0;
  return new Date(date.getTime() + offset * 3_600_000).toISOString().slice(0, 16);
}

/** Awal hari (00.00) di zona fasilitas, dalam UTC. Dipakai filter periode laporan. */
export function facilityDayStart(isoDate: string, timeZone: string): Date {
  return fromFacilityLocal(`${isoDate}T00:00`, timeZone);
}
