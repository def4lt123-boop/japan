'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanForSave } from './normalize';

/**
 * Supabase-Anbindung. Ohne gesetzte ENV-Variablen läuft die App im
 * Demo-Modus (localStorage) – dadurch funktioniert die Vercel-Preview sofort,
 * ohne dass man erst eine Datenbank anlegen muss.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return client;
}

export type TableName = 'trips' | 'places' | 'hotels' | 'journeys' | 'expenses';

/** Erlaubte Spalten pro Tabelle – schützt vor Tippfehlern beim Insert/Update */
export const COLUMNS: Record<TableName, string[]> = {
  trips: [
    'id',
    'name',
    'destination',
    'start_date',
    'end_date',
    'travelers',
    'budget_eur',
    'jpy_rate',
    'notes',
    'archived',
    'started',
    'started_at',
    'planned_start',
    'planned_end',
    'created_at',
  ],
  places: [
    'id',
    'trip_id',
    'name',
    'city',
    'district',
    'category',
    'date',
    'end_date',
    'time_slot',
    'start_time',
    'duration_min',
    'travel_time',
    'notes',
    'price_eur',
    'price_note',
    'booking_status',
    'booking_url',
    'priority',
    'maps_query',
    'lat',
    'lng',
    'image_url',
    'sort_order',
    'ticket_status',
    'ticket_note',
    'created_at',
  ],
  hotels: [
    'id',
    'trip_id',
    'name',
    'city',
    'check_in',
    'check_out',
    'nights',
    'price_total_eur',
    'price_per_night_eur',
    'address',
    'lat',
    'lng',
    'booking_url',
    'booking_status',
    'notes',
    'created_at',
  ],
  journeys: [
    'id',
    'trip_id',
    'date',
    'end_date',
    'title',
    'from_city',
    'to_city',
    'mode',
    'departure_time',
    'duration_min',
    'price_eur',
    'hotel_name',
    'nights',
    'booking_status',
    'notes',
    'created_at',
  ],
  expenses: ['id', 'trip_id', 'date', 'category', 'description', 'amount_eur', 'payer', 'created_at'],
};

export function toRow<K extends TableName>(table: K, value: Record<string, unknown>): Record<string, unknown> {
  const clean = cleanForSave(table, value);
  const row: Record<string, unknown> = {};
  for (const col of COLUMNS[table]) {
    if (clean[col] !== undefined) row[col] = clean[col];
  }
  if (row.created_at === undefined) row.created_at = new Date().toISOString();
  return row;
}

/**
 * Spalten, die die Datenbank (noch) nicht kennt, werden gemerkt und beim nächsten
 * Schreiben weggelassen – so läuft die App auch, bevor ein Update eingespielt wurde.
 */
const unbekannteSpalten = new Set<string>();
const vergesseneSpalten = (meldung: string, table: TableName) =>
  Array.from(meldung.matchAll(/'([a-z_]+)'/gi))
    .map((m) => m[1])
    .filter((name) => /^[a-z_]+$/.test(name) && name !== table && name !== 'public');

function ohneUnbekanntes(table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) if (!unbekannteSpalten.has(`${table}.${key}`)) out[key] = value;
  return out;
}

async function schreibe<T extends { error: { message: string } | null }>(
  table: TableName,
  row: Record<string, unknown>,
  run: (payload: Record<string, unknown>) => PromiseLike<T>,
): Promise<{ error: { message: string } | null }> {
  const erster = await run(ohneUnbekanntes(table, row));
  if (!erster.error) return erster;
  if (!/column|schema cache/i.test(erster.error.message)) return erster;
  const neue = vergesseneSpalten(erster.error.message, table)
    .map((name) => `${table}.${name}`)
    .filter((key) => !unbekannteSpalten.has(key) && Object.keys(row).includes(key.split('.')[1]));
  if (!neue.length) return erster;
  for (const key of neue) unbekannteSpalten.add(key);
  console.warn(`${table}: ohne ${neue.map((k) => k.split('.')[1]).join(', ')} geschrieben – bitte die passende Migration einspielen (supabase/migrations/)`);
  return run(ohneUnbekanntes(table, row));
}

export async function supaSelect<T>(table: TableName, tripId?: string): Promise<T[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from(table).select('*');
  if (tripId) q = q.eq('trip_id', tripId);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function supaUpsert<T extends { id: string }>(table: TableName, value: T): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await schreibe(table, toRow(table, value as unknown as Record<string, unknown>), (payload) => sb.from(table).upsert(payload));
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function supaPatch(table: TableName, id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const row = toRow(table, { ...patch, id });
  delete row.created_at;
  delete row.id;
  const { error } = await schreibe(table, row, (payload) => sb.from(table).update(payload).eq('id', id));
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function supaDelete(table: TableName, id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(`${table}: ${error.message}`);
}
