import type { Hotel, Journey, Place } from './types';
import { categoryMeta } from './categories';

/** CSV-Export – Semikolon + de-DE, damit sich die Pläne überall sauber importieren lassen */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n');
}

export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PLACE_HEADERS = [
  'Datum',
  'Wochentag',
  'Uhrzeit',
  'Tageszeit',
  'Standort',
  'Kategorie',
  'Stadt',
  'Stadtteil',
  'Fahrzeit vom Hotel',
  'Dauer (min)',
  'Hinweise',
  'Preis EUR',
  'Preis-Hinweis',
  'Status',
  'Prio',
  'Google Maps',
  'Breitengrad',
  'Längengrad',
];

export function placeCsv(places: Place[], hotels: Hotel[]): string {
  const hotelById = new Map(hotels.map((h) => [h.id, h]));
  void hotelById;
  const rows = places
    .slice()
    .sort((a, b) => `${a.date ?? '9999'}${a.start_time ?? ''}${a.sort_order}`.localeCompare(`${b.date ?? '9999'}${b.start_time ?? ''}${b.sort_order}`))
    .map((p) => [
      p.date,
      p.date ? new Date(`${p.date}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long' }) : '',
      p.start_time,
      p.time_slot,
      p.name,
      p.category,
      p.city,
      p.district,
      p.travel_time,
      p.duration_min,
      (p.notes ?? '').replace(/\s+/g, ' '),
      p.price_eur,
      p.price_note,
      p.booking_status,
      p.priority,
      mapsLink(p),
      p.lat,
      p.lng,
    ]);
  return toCsv(PLACE_HEADERS, rows);
}

function mapsLink(p: Place): string {
  if (typeof p.lat === 'number' && typeof p.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.city}`)}`;
}

export function hotelCsv(hotels: Hotel[]): string {
  const rows = hotels.map((h) => [
    h.check_in,
    h.check_out,
    h.nights,
    h.name,
    h.city,
    h.price_total_eur,
    h.price_per_night_eur,
    h.booking_status,
    h.address,
    h.booking_url,
    (h.notes ?? '').replace(/\s+/g, ' '),
    h.lat,
    h.lng,
  ]);
  return toCsv(['Check-in', 'Check-out', 'Nächte', 'Unterkunft', 'Stadt', 'Preis EUR', 'EUR/Nacht', 'Status', 'Adresse', 'Link', 'Hinweise', 'lat', 'lng'], rows);
}

export function journeyCsv(journeys: Journey[]): string {
  const rows = journeys.map((j) => [j.date, j.title, j.from_city, j.to_city, j.mode, j.departure_time, j.duration_min, j.price_eur, j.hotel_name, j.nights, j.booking_status, (j.notes ?? '').replace(/\s+/g, ' ')]);
  return toCsv(['Datum', 'Etappe', 'Von', 'Nach', 'Art', 'Abflug', 'Dauer (min)', 'Preis EUR', 'Hotel', 'Nächte', 'Status', 'Hinweise'], rows);
}

export function jsonExport(payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

export function printPage() {
  window.print();
}

/** Kleine Icons für exportierte Texte */
export function iconFor(p: Pick<Place, 'category'>) {
  return categoryMeta(p.category).icon;
}
