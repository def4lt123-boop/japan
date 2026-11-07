'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Datenbank-Anbindung. Steht die Umgebung, liegt alles online und jede Person
 * kann sehen und ändern, was die andere geschrieben hat – ohne Konto. Ohne die
 * Umgebung liegt es auf diesem Gerät, die App läuft dann genauso.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const online = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let klient: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!online) return null;
  if (!klient) klient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return klient;
}

export type TabellenName = 'reisen' | 'eintraege';

/** Erlaubte Spalten – schützt vor Tippfehlern und schreibt nie Unbekanntes */
export const SPALTEN: Record<TabellenName, string[]> = {
  reisen: ['id', 'name', 'land', 'stationen', 'start_date', 'end_date', 'cover_url', 'cover_credit', 'beschreibung', 'budget', 'waehrung', 'personen', 'archived', 'erstellt_am'],
  eintraege: [
    'id',
    'reise_id',
    'art',
    'kategorie',
    'titel',
    'date',
    'zeit',
    'bis_zeit',
    'dauer_min',
    'bis_date',
    'ort',
    'adresse',
    'lat',
    'lng',
    'karten_stichwort',
    'notiz',
    'preis',
    'buchung_nr',
    'buchung_url',
    'foto_url',
    'foto_nachweis',
    'sortierung',
    'erstellt_am',
  ],
};

function zeile<T extends Record<string, unknown>>(tabelle: TabellenName, wert: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const spalte of SPALTEN[tabelle]) if (wert[spalte] !== undefined) out[spalte] = wert[spalte];
  if (out.erstellt_am === undefined) out.erstellt_am = new Date().toISOString();
  return out;
}

/** Spalten, die die Datenbank noch nicht kennt, werden gemerkt – die App bleibt schreibfähig */
const unbekannteSpalten = new Set<string>();

function ohneUnbekanntes(tabelle: TabellenName, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, wert] of Object.entries(row)) if (!unbekannteSpalten.has(`${tabelle}.${key}`)) out[key] = wert;
  return out;
}

async function schreibe(tabelle: TabellenName, row: Record<string, unknown>, ausfuehren: (payload: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null } | null | undefined> & { then: unknown }) {
  const erste = (await ausfuehren(ohneUnbekanntes(tabelle, row))) as { error?: { message: string } | null } | null;
  const fehler = erste?.error ?? null;
  if (!fehler || !/column|schema cache/i.test(fehler.message)) return fehler;
  const neue = Array.from(fehler.message.matchAll(/'([a-z_]+)'/gi))
    .map((m) => m[1])
    .filter((name) => /^[a-z_]+$/.test(name) && name !== tabelle && name !== 'public' && Object.prototype.hasOwnProperty.call(row, name));
  if (!neue.length) return fehler;
  for (const name of neue) unbekannteSpalten.add(`${tabelle}.${name}`);
  const zweiter = (await ausfuehren(ohneUnbekanntes(tabelle, row))) as { error?: { message: string } | null } | null;
  return zweiter?.error ?? null;
}

export async function laden<T>(tabelle: TabellenName, reiseId?: string): Promise<T[]> {
  const db = supabase();
  if (!db) return [];
  let anfrage = db.from(tabelle).select('*');
  if (reiseId) anfrage = anfrage.eq('reise_id', reiseId);
  const { data, error } = await anfrage;
  if (error) throw new Error(`${tabelle}: ${error.message}`);
  return (data ?? []) as T[];
}

export async function speichern<T extends { id: string }>(tabelle: TabellenName, wert: T): Promise<void> {
  const db = supabase();
  if (!db) return;
  const fehler = await schreibe(tabelle, zeile(tabelle, wert as unknown as Record<string, unknown>), (payload) => db.from(tabelle).upsert(payload));
  if (fehler) throw new Error(`${tabelle}: ${fehler.message}`);
}

export async function aendern(tabelle: TabellenName, id: string, patch: Record<string, unknown>): Promise<void> {
  const db = supabase();
  if (!db) return;
  const row = zeile(tabelle, { ...patch, id });
  delete row.id;
  delete row.erstellt_am;
  const fehler = await schreibe(tabelle, row, (payload) => db.from(tabelle).update(payload).eq('id', id));
  if (fehler) throw new Error(`${tabelle}: ${fehler.message}`);
}

export async function loeschen(tabelle: TabellenName, id: string): Promise<void> {
  const db = supabase();
  if (!db) return;
  const { error } = await db.from(tabelle).delete().eq('id', id);
  if (error) throw new Error(`${tabelle}: ${error.message}`);
}
