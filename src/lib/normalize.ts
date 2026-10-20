import type { Expense, Hotel, Journey, Place, Trip } from './types';

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

export const normalizeTrip = (r: Trip) => normalizeRow<Trip>('trips', r);
export const normalizePlace = (r: Place) => normalizeRow<Place>('places', r);
export const normalizeHotel = (r: Hotel) => normalizeRow<Hotel>('hotels', r);
export const normalizeJourney = (r: Journey) => normalizeRow<Journey>('journeys', r);
export const normalizeExpense = (r: Expense) => normalizeRow<Expense>('expenses', r);

/** Spalten, die in der DB NOT NULL sind – leere Texte hier behalten */
const KEEP_EMPTY = new Set(['id', 'trip_id', 'name', 'city', 'category', 'booking_status', 'priority', 'date']);

/** Spalten mit NOT NULL + CHECK – leere Eingabe fällt auf den Anfangswert zurück */
const ENUM_DEFAULT: Record<string, string> = { booking_status: 'offen', priority: 'soll', ticket_status: 'unklar' };

/** Für den Insert/Update-Pfad: leere Texte → null, Zahlen sauber */
export function cleanForSave<T extends Record<string, any>>(table: keyof typeof NUMERIC_FIELDS, row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (typeof v === 'string' && v.trim() === '') out[key] = ENUM_DEFAULT[key] ?? (KEEP_EMPTY.has(key) ? '' : null);
    else if (NUMERIC_FIELDS[table].includes(key)) out[key] = toNumber(v);
  }
  return out as T;
}
