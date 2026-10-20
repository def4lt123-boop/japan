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
  const { error } = await sb.from(table).upsert(toRow(table, value as unknown as Record<string, unknown>));
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function supaPatch(table: TableName, id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const row = toRow(table, { ...patch, id });
  delete row.created_at;
  delete row.id;
  const { error } = await sb.from(table).update(row).eq('id', id);
  if (error) throw new Error(`${table}: ${error.message}`);
}

export async function supaDelete(table: TableName, id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(`${table}: ${error.message}`);
}
