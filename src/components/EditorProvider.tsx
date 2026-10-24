'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Expense, Hotel, Journey, Place, Trip } from '../lib/types';
import { useStore } from '../lib/store';
import { ExpenseForm, HotelForm, JourneyForm, PlaceForm, TripForm } from './forms';
import { geocode, queryFor, sleep } from '../lib/geocode';
import { fmtDate } from '../lib/format';
import { cityOfDay, trimPreviousStay } from '../lib/locus';

type Request =
  | { kind: 'place'; id?: string; defaults?: Partial<Place> }
  | { kind: 'hotel'; id?: string; defaults?: Partial<Hotel> }
  | { kind: 'journey'; id?: string; defaults?: Partial<Journey> }
  | { kind: 'expense'; id?: string; defaults?: Partial<Expense> }
  | { kind: 'trip'; id?: string };

interface EditorApi {
  open: (req: Request) => void;
  close: () => void;
  request: Request | null;
}

const Ctx = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditor braucht <EditorProvider>');
  return ctx;
}

/**
 * Ein Modal-Host für alle Formulare. Seiten öffnen Editoren per
 * `open({ kind: 'place', id })` bzw. `open({ kind: 'place', defaults: { date } })`.
 */
export function EditorProvider({ tripId, children }: { tripId: string; children: React.ReactNode }) {
  const store = useStore();
  const [request, setRequest] = useState<Request | null>(null);
  /** „✓ speichern & weiter“ baut das Formular neu – dieser Zähler ist der Schlüssel dazu */
  const [stamp, setStamp] = useState(0);
  const trip = store.trips.find((t) => t.id === tripId);

  const open = useCallback((req: Request) => setRequest(req), []);
  const close = useCallback(() => setRequest(null), []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of store.places) if (p.trip_id === tripId && p.city) set.add(p.city);
    for (const h of store.hotels) if (h.trip_id === tripId && h.city) set.add(h.city);
    for (const p of store.places) if (p.city) set.add(p.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [store.places, store.hotels, tripId]);

  const api = useMemo<EditorApi>(() => ({ open, close, request }), [open, close, request]);

  const activePlace = request?.kind === 'place' ? store.places.find((p) => p.id === request.id) : undefined;
  const activeHotel = request?.kind === 'hotel' ? store.hotels.find((h) => h.id === request.id) : undefined;
  const activeJourney = request?.kind === 'journey' ? store.journeys.find((j) => j.id === request.id) : undefined;
  const activeExpense = request?.kind === 'expense' ? store.expenses.find((e) => e.id === request.id) : undefined;
  const activeTrip = request?.kind === 'trip' ? store.trips.find((t) => t.id === request.id) : undefined;

  return (
    <Ctx.Provider value={api}>
      {children}
      {request?.kind === 'place' ? (
        <PlaceForm
          key={`place-${stamp}`}
          tripId={tripId}
          cities={cities}
          jpyRate={trip?.jpy_rate ?? 175}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          value={(() => {
            const v = { ...(activePlace ?? {}), ...(request.defaults ?? {}) } as Partial<Place>;
            /** die Stadt des Tages steht schon im Bett – nicht noch einmal tippen */
            if (!v.city && v.date) v.city = cityOfDay(store.hotels.filter((h) => h.trip_id === tripId), v.date) ?? undefined;
            return v;
          })()}
          onCancel={close}
          onSubmit={async (place, again) => {
            let row = place;
            if (!activePlace && row.date) {
              /** neu auf einem Tag: immer hintendran, so bleibt die Tipp-Reihenfolge die Reihenfolge */
              const taken = store.places.filter((p) => p.trip_id === tripId && p.date === row.date && p.id !== row.id).length;
              row = { ...row, sort_order: taken };
            }
            await store.upsert('places', row);
            if (again) {
              setRequest({
                kind: 'place',
                defaults: {
                  date: row.date ?? null,
                  city: row.city ?? null,
                  category: row.category,
                  booking_status: row.booking_status,
                  ticket_status: row.ticket_status,
                  priority: row.priority,
                  sort_order: (row.sort_order ?? 0) + 1,
                },
              });
              setStamp((s) => s + 1);
              store.say(`„${row.name}“ gespeichert – weiter geht’s am selben Tag.`);
              return;
            }
            close();
            store.say(
              activePlace
                ? `„${row.name}“ aktualisiert${row.date ? ` – Tag ${row.date.split('-').reverse().join('.')}` : ''}`
                : row.date
                  ? `„${row.name}“ fest für ${fmtDate(row.date, { weekday: 'short', day: '2-digit', month: '2-digit' })} eingeplant.`
                  : `„${row.name}“ angelegt – ohne Tag, er steht in der Liste unter Aktivitäten. Zieh ihn auf der Tages-Seite auf einen Tag.`,
            );
          }}
          onDelete={
            activePlace
              ? async () => {
                  await store.remove('places', activePlace.id);
                  close();
                  store.say('Aktivität gelöscht.');
                }
              : undefined
          }
        />
      ) : null}

      {request?.kind === 'hotel' ? (
        <HotelForm
          key={`hotel-${stamp}`}
          tripId={tripId}
          cities={cities}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          value={{ ...(activeHotel ?? {}), ...(request.defaults ?? {}) } as Partial<Hotel>}
          onCancel={close}
          onSubmit={async (hotel, again) => {
            await store.upsert('hotels', hotel);
            /** der Umzug steht in den Betten: die vorherige Unterkunft endet an diesem Check-in */
            const trim = trimPreviousStay(store.hotels.filter((h) => h.trip_id === tripId), hotel);
            if (trim) await store.patch('hotels', trim.id, trim.patch);
            const short = trim
              ? ` 🔀 Die vorherige Unterkunft endet ab jetzt am ${fmtDate(hotel.check_in ?? '', { day: '2-digit', month: '2-digit' })}.`
              : '';
            if (again && hotel.check_out) {
              setRequest({ kind: 'hotel', defaults: { city: hotel.city ?? null, check_in: hotel.check_out, booking_status: hotel.booking_status } });
              setStamp((s) => s + 1);
              store.say(`Unterkunft gespeichert – das nächste Bett fängt am ${fmtDate(hotel.check_out, { day: '2-digit', month: '2-digit' })} an.`);
              return;
            }
            close();
            store.say(`Unterkunft „${hotel.name}“ gespeichert.${short}`);
          }}
          onDelete={
            activeHotel
              ? async () => {
                  await store.remove('hotels', activeHotel.id);
                  close();
                }
              : undefined
          }
        />
      ) : null}

      {request?.kind === 'journey' ? (
        <JourneyForm
          tripId={tripId}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          value={{ ...(activeJourney ?? {}), ...(request.defaults ?? {}) } as Partial<Journey>}
          onCancel={close}
          onSubmit={async (j) => {
            await store.upsert('journeys', j);
            close();
            store.say(`Fahrt „${j.title}“ gespeichert.`);
          }}
          onDelete={
            activeJourney
              ? async () => {
                  await store.remove('journeys', activeJourney.id);
                  close();
                }
              : undefined
          }
        />
      ) : null}

      {request?.kind === 'expense' ? (
        <ExpenseForm
          key={`expense-${stamp}`}
          tripId={tripId}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          jpyRate={trip?.jpy_rate ?? 175}
          value={{ ...(activeExpense ?? {}), ...(request.defaults ?? {}) } as Partial<Expense>}
          onCancel={close}
          onSubmit={async (e, again) => {
            await store.upsert('expenses', e);
            if (again) {
              setRequest({ kind: 'expense', defaults: { date: e.date, category: e.category, payer: e.payer ?? null } });
              setStamp((s) => s + 1);
              store.say('Ausgabe gespeichert – nächster Bon.');
              return;
            }
            close();
            store.say('Ausgabe gespeichert.');
          }}
          onDelete={
            activeExpense
              ? async () => {
                  await store.remove('expenses', activeExpense.id);
                  close();
                }
              : undefined
          }
        />
      ) : null}

      {request?.kind === 'trip' ? (
        <TripForm
          value={activeTrip}
          onCancel={close}
          onSubmit={async (t: Trip) => {
            await store.upsert('trips', t);
            close();
            store.say('Reise gespeichert.');
          }}
          onDelete={
            activeTrip
              ? async () => {
                  await store.deleteTrip(activeTrip.id);
                  close();
                }
              : undefined
          }
        />
      ) : null}

    </Ctx.Provider>
  );
}

/** Orte ohne Koordinaten per OpenStreetMap finden (Rate-Limit: 1,1 s Abstand) */
export function useBatchGeocode(tripId: string) {
  const store = useStore();
  return useCallback(
    async (onlyMissing = true) => {
      const targets = store.places.filter((p) => p.trip_id === tripId && (!onlyMissing || p.lat === null || p.lng === null));
      if (!targets.length) {
        store.say('Alle Einträge haben schon einen Punkt 👍');
        return;
      }
      let done = 0;
      let found = 0;
      for (const place of targets) {
        const hit = await geocode(queryFor(place));
        if (hit) {
          await store.patch('places', place.id, { lat: Math.round(hit.lat * 1e6) / 1e6, lng: Math.round(hit.lng * 1e6) / 1e6 });
          found += 1;
        }
        done += 1;
        store.say(`Punkte gesucht… ${done}/${targets.length} (${found} gefunden)`);
        await sleep(1100);
      }
      store.say(`Fertig: ${found} von ${targets.length} Einträgen haben jetzt einen Punkt.`);
    },
    [store, tripId],
  );
}
