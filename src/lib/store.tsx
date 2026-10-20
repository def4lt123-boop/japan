'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cloneInto, seedSnapshot } from './seed';
import type { Expense, Hotel, Journey, Place, Snapshot, Trip } from './types';
import { hasSupabase, supaDelete, supaPatch, supaSelect, supaUpsert, type TableName } from './supabase';
import { uid } from './format';
import { normalizeExpense, normalizeHotel, normalizeJourney, normalizePlace, normalizeTrip } from './normalize';

export type RowKey = 'trips' | 'places' | 'hotels' | 'journeys' | 'expenses';
export type RowOf<K extends RowKey> = K extends 'trips'
  ? Trip
  : K extends 'places'
    ? Place
    : K extends 'hotels'
      ? Hotel
      : K extends 'journeys'
        ? Journey
        : Expense;

const LS_KEY = 'urlaubsplaner.v2';
const EMPTY: Snapshot = { trips: [], places: [], hotels: [], journeys: [], expenses: [] };

function readLocal(): Snapshot | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    return parsed?.trips?.length ? parsed : null;
  } catch {
    return null;
  }
}

interface StoreValue extends Snapshot {
  ready: boolean;
  mode: 'supabase' | 'local';
  error: string | null;
  note: string | null;
  say: (msg: string) => void;
  refresh: () => Promise<void>;
  resetLocalData: () => Promise<void>;
  upsert: <K extends RowKey>(table: K, value: RowOf<K>) => Promise<void>;
  patch: <K extends RowKey>(table: K, id: string, patch: Partial<RowOf<K>>) => Promise<void>;
  remove: (table: RowKey, id: string) => Promise<void>;
  bulkCreate: <K extends RowKey>(table: K, values: RowOf<K>[]) => Promise<void>;
  createTrip: (value: Partial<Trip>) => Promise<Trip>;
  deleteTrip: (id: string) => Promise<void>;
  duplicateTrip: (sourceTripId: string, name: string, overrides?: Partial<Trip>) => Promise<string | null>;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore muss innerhalb von <StoreProvider> benutzt werden');
  return ctx;
}

export function useTrip(tripId: string | undefined) {
  const s = useStore();
  return useMemo(() => {
    const trip = s.trips.find((t) => t.id === tripId);
    const inTrip = <T extends { trip_id: string }>(rows: T[]) => rows.filter((r) => r.trip_id === tripId);
    return {
      trip,
      places: inTrip(s.places),
      hotels: inTrip(s.hotels),
      journeys: inTrip(s.journeys),
      expenses: inTrip(s.expenses),
    };
  }, [s, tripId]);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | null>(null);
  const mode: 'supabase' | 'local' = hasSupabase ? 'supabase' : 'local';

  const say = useCallback((msg: string) => {
    setNote(msg);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 3200);
  }, []);

  const persist = useCallback(
    (next: Snapshot) => {
      setData(next);
      if (!hasSupabase) {
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {
          /* Speicher voll – kein Problem, Daten bleiben in der Sitzung */
        }
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      if (hasSupabase) {
        const [trips, places, hotels, journeys, expenses] = await Promise.all([
          supaSelect<Trip>('trips'),
          supaSelect<Place>('places'),
          supaSelect<Hotel>('hotels'),
          supaSelect<Journey>('journeys'),
          supaSelect<Expense>('expenses'),
        ]);
        if (!trips.length) {
          // Leere Datenbank → Vorlage aus der Tabelle laden
          const snapshot = seedSnapshot();
          await Promise.all([
            ...snapshot.trips.map((t) => supaUpsert('trips', t)),
            ...snapshot.places.map((p) => supaUpsert('places', p)),
            ...snapshot.hotels.map((h) => supaUpsert('hotels', h)),
            ...snapshot.journeys.map((j) => supaUpsert('journeys', j)),
            ...snapshot.expenses.map((e) => supaUpsert('expenses', e)),
          ]);
          setData(snapshot);
          say('Leere Datenbank erkannt – Vorlage „Japan 2025/2026“ wurde geladen.');
          return;
        }
        setData({
          trips: trips.map(normalizeTrip),
          places: places.map(normalizePlace),
          hotels: hotels.map(normalizeHotel),
          journeys: journeys.map(normalizeJourney),
          expenses: expenses.map(normalizeExpense),
        });
      } else {
        const stored = readLocal();
        if (stored) setData(stored);
        else {
          const snapshot = seedSnapshot();
          window.localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
          setData(snapshot);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
      setData(hasSupabase ? EMPTY : readLocal() ?? seedSnapshot());
    } finally {
      setReady(true);
    }
  }, [say]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsert = useCallback(
    async <K extends RowKey>(table: K, value: RowOf<K>) => {
      const next = { ...data } as Snapshot;
      const list = [...(next[table] as RowOf<K>[])];
      const idx = list.findIndex((r) => r.id === value.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...value };
      else list.push(value);
      (next[table] as RowOf<K>[]) = list;
      persist(next);
      try {
        if (hasSupabase) await supaUpsert(table as TableName, value as never);
      } catch (e) {
        say(`Konnte nicht speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
      }
    },
    [data, persist, say],
  );

  const patch = useCallback(
    async <K extends RowKey>(table: K, id: string, value: Partial<RowOf<K>>) => {
      const next = { ...data } as Snapshot;
      const list = [...(next[table] as RowOf<K>[])];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return;
      list[idx] = { ...list[idx], ...value };
      (next[table] as RowOf<K>[]) = list;
      persist(next);
      try {
        if (hasSupabase) await supaPatch(table as TableName, id, value as Record<string, unknown>);
      } catch (e) {
        say(`Konnte nicht speichern: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
      }
    },
    [data, persist, say],
  );

  const remove = useCallback(
    async (table: RowKey, id: string) => {
      const next = { ...data } as Snapshot;
      (next[table] as { id: string }[]) = (next[table] as { id: string }[]).filter((r) => r.id !== id);
      persist(next);
      try {
        if (hasSupabase) await supaDelete(table as TableName, id);
      } catch (e) {
        say(`Konnte nicht löschen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
      }
    },
    [data, persist, say],
  );

  const bulkCreate = useCallback(
    async <K extends RowKey>(table: K, values: RowOf<K>[]) => {
      const next = { ...data } as Snapshot;
      (next[table] as RowOf<K>[]) = [...(next[table] as RowOf<K>[]), ...values];
      persist(next);
      try {
        if (hasSupabase) for (const v of values) await supaUpsert(table as TableName, v as never);
      } catch (e) {
        say(`Einträge angelegt, aber DB-Fehler: ${e instanceof Error ? e.message : 'unbekannt'}`);
      }
    },
    [data, persist, say],
  );

  const createTrip = useCallback(
    async (value: Partial<Trip>) => {
      const trip: Trip = {
        id: uid('trip'),
        name: value.name?.trim() || 'Neue Reise',
        destination: value.destination?.trim() || '',
        start_date: value.start_date ?? null,
        end_date: value.end_date ?? null,
        travelers: value.travelers ?? 2,
        budget_eur: value.budget_eur ?? null,
        jpy_rate: value.jpy_rate ?? null,
        notes: value.notes ?? null,
        archived: false,
      };
      await upsert('trips', trip);
      say(`Reise „${trip.name}“ angelegt.`);
      return trip;
    },
    [persist, say, upsert],
  );

  const deleteTrip = useCallback(
    async (id: string) => {
      const next: Snapshot = {
        trips: data.trips.filter((t) => t.id !== id),
        places: data.places.filter((p) => p.trip_id !== id),
        hotels: data.hotels.filter((h) => h.trip_id !== id),
        journeys: data.journeys.filter((j) => j.trip_id !== id),
        expenses: data.expenses.filter((e) => e.trip_id !== id),
      };
      persist(next);
      try {
        if (hasSupabase) {
          for (const table of ['places', 'hotels', 'journeys', 'expenses'] as const) {
            const rows = data[table] as unknown as { trip_id: string; id: string }[];
            for (const row of rows.filter((r) => r.trip_id === id)) await supaDelete(table, row.id);
          }
          await supaDelete('trips', id);
        }
      } catch {
        say('Reise lokal gelöscht – in Supabase bitte manuell nachschauen.');
      }
      say('Reise gelöscht.');
    },
    [data, persist, say],
  );

  const duplicateTrip = useCallback(
    async (sourceTripId: string, name: string, overrides?: Partial<Trip>) => {
      const source = data.trips.find((t) => t.id === sourceTripId);
      if (!source) return null;
      const target: Trip = {
        ...source,
        ...overrides,
        id: uid('trip'),
        name: (name.trim() || `${source.name.replace(/\d{4}/, '')} (Kopie)`).trim(),
        archived: false,
        notes: overrides?.notes ?? `Kopie von „${source.name}“ – Inhalte verschoben, Buchungen zurückgesetzt.`,
      };
      const withTrip: Snapshot = { ...data, trips: [...data.trips, target] };
      const cloned = cloneInto(withTrip, sourceTripId, target.id);
      const rowsToSave: { table: TableName; row: never }[] = [];
      const newPlaces = cloned.places.filter((p) => p.trip_id === target.id);
      const newHotels = cloned.hotels.filter((h) => h.trip_id === target.id);
      const newJourneys = cloned.journeys.filter((j) => j.trip_id === target.id);
      persist({
        ...withTrip,
        places: cloned.places,
        hotels: cloned.hotels,
        journeys: cloned.journeys,
      });
      try {
        if (hasSupabase) {
          rowsToSave.push({ table: 'trips', row: target as never });
          for (const p of newPlaces) rowsToSave.push({ table: 'places', row: p as never });
          for (const h of newHotels) rowsToSave.push({ table: 'hotels', row: h as never });
          for (const j of newJourneys) rowsToSave.push({ table: 'journeys', row: j as never });
          for (const r of rowsToSave) await supaUpsert(r.table, r.row as never);
        }
      } catch (e) {
        say(`Kopie angelegt, DB-Fehler: ${e instanceof Error ? e.message : 'unbekannt'}`);
        return target.id;
      }
      say(`„${source.name}“ → „${target.name}“: ${newPlaces.length} Orte, ${newHotels.length} Hotels, ${newJourneys.length} Etappen kopiert.`);
      return target.id;
    },
    [data, persist, say],
  );

  const resetLocalData = useCallback(async () => {
    if (hasSupabase) {
      say('Im Supabase-Modus werden die Daten in der Datenbank geändert – kein lokaler Reset.');
      return;
    }
    window.localStorage.removeItem(LS_KEY);
    const snapshot = seedSnapshot();
    persist(snapshot);
    say('Demo-Daten auf den Stand der Tabelle zurückgesetzt.');
  }, [persist, say]);

  const value = useMemo<StoreValue>(
    () => ({
      ...data,
      ready,
      mode,
      error,
      note,
      say,
      refresh,
      resetLocalData,
      upsert,
      patch,
      remove,
      bulkCreate,
      createTrip,
      deleteTrip,
      duplicateTrip,
    }),
    [data, ready, mode, error, note, say, refresh, resetLocalData, upsert, patch, remove, bulkCreate, createTrip, deleteTrip, duplicateTrip],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
