import type { Expense, Hotel, Journey, Place, Snapshot, Trip } from './types';
import { properName } from './format';

/**
 * PostgREST liefert `numeric`-Spalten je nach Version als String und `time`
 * als "13:00:00". Hier wird alles auf die Form gebracht, die die UI erwartet
 * (Zahlen als number, time als HH:MM, leere Strings als null).
 */
const NUMERIC_FIELDS: Record<string, string[]> = {
  trips: ['travelers', 'budget_eur', 'jpy_rate'],
  places: ['duration_min', 'price_eur', 'lat', 'lng', 'sort_order'],
  hotels: ['nights', 'price_total_eur', 'price_per_night_eur', 'lat', 'lng'],
  journeys: ['duration_min', 'price_eur', 'nights'],
  expenses: ['amount_eur'],
};

const TIME_FIELDS = ['start_time', 'departure_time'];

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function normalizeRow<T extends Record<string, any>>(table: keyof typeof NUMERIC_FIELDS, row: T): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };
  for (const field of NUMERIC_FIELDS[table]) out[field] = toNumber(out[field]);
  for (const field of TIME_FIELDS) {
    if (typeof out[field] === 'string') {
      const m = (out[field] as string).match(/^(\d{1,2}):(\d{2})/);
      out[field] = m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
    } else if (out[field] === undefined) out[field] = null;
  }
  for (const key of Object.keys(out)) if (out[key] === undefined) out[key] = null;
  return out as T;
}

/** Unterwegs-Modus – alte Datensätze und die Vorlage kennen die Felder noch nicht */
export function normalizeTrip(r: Trip): Trip {
  const row = normalizeRow<Trip>('trips', r);
  return {
    ...row,
    started: row.started === true,
    started_at: row.started_at ?? null,
    planned_start: row.planned_start ?? null,
    planned_end: row.planned_end ?? null,
  };
}
export const normalizePlace = (r: Place) => normalizeRow<Place>('places', r);
export const normalizeHotel = (r: Hotel) => normalizeRow<Hotel>('hotels', r);
export const normalizeJourney = (r: Journey) => normalizeRow<Journey>('journeys', r);
export const normalizeExpense = (r: Expense) => normalizeRow<Expense>('expenses', r);

/** Spalten, die in der DB NOT NULL sind – leere Texte hier behalten */
const KEEP_EMPTY = new Set(['id', 'trip_id', 'name', 'city', 'category', 'booking_status', 'priority', 'date']);

/** Spalten mit NOT NULL + CHECK – leere Eingabe fällt auf den Anfangswert zurück */
const ENUM_DEFAULT: Record<string, string> = { booking_status: 'offen', priority: 'soll', ticket_status: 'unklar' };

/**
 * Städte- und Unterkunftsnamen gehören in Reinschrift: getrimmt, ein Leerzeichen innen,
 * großer Wortanfang. Sonst stehen im Plan „osaka“, „hotel osaka“ und „Hotel Osaka“
 * nebeneinander, als wären es drei Orte. Gilt fürs Schreiben und fürs Zeigen.
 */
const NAMEN: Record<string, string[]> = {
  places: ['city'],
  hotels: ['city', 'name'],
  journeys: ['from_city', 'to_city', 'hotel_name'],
};

export function reinschrift<T extends Record<string, any>>(table: string, row: T): T {
  const felder = NAMEN[table];
  if (!row || !felder) return row;
  const out: Record<string, unknown> = { ...row };
  for (const feld of felder) {
    if (typeof out[feld] === 'string') out[feld] = properName(out[feld] as string);
  }
  return out as T;
}

/** derselbe Schritt für einen ganzen Schnappschuss – die Anzeige liest immer daraus */
export function reinschriftImSnapshot(s: Snapshot): Snapshot {
  return {
    ...s,
    places: (s.places ?? []).map((r) => reinschrift('places', r)),
    hotels: (s.hotels ?? []).map((r) => reinschrift('hotels', r)),
    journeys: (s.journeys ?? []).map((r) => reinschrift('journeys', r)),
  };
}

/** Für den Insert/Update-Pfad: leere Texte → null, Zahlen sauber */
export function cleanForSave<T extends Record<string, any>>(table: keyof typeof NUMERIC_FIELDS, row: T): T {
  const out: Record<string, unknown> = { ...reinschrift(table, row) };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (typeof v === 'string' && v.trim() === '') out[key] = ENUM_DEFAULT[key] ?? (KEEP_EMPTY.has(key) ? '' : null);
    else if (NUMERIC_FIELDS[table].includes(key)) out[key] = toNumber(v);
  }
  return out as T;
}
