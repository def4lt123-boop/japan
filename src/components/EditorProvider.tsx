'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Expense, Hotel, Journey, Place, Trip } from '../lib/types';
import { useStore } from '../lib/store';
import { ExpenseForm, HotelForm, JourneyForm, PlaceForm, TripForm } from './forms';
import { OrtswechselDialog } from './Ortswechsel';
import { geocode, queryFor, sleep } from '../lib/geocode';
import { fmtDate } from '../lib/format';

type Request =
  | { kind: 'place'; id?: string; defaults?: Partial<Place> }
  | { kind: 'hotel'; id?: string; defaults?: Partial<Hotel> }
  | { kind: 'journey'; id?: string; defaults?: Partial<Journey> }
  | { kind: 'expense'; id?: string; defaults?: Partial<Expense> }
  /** Ortswechsel: Stadt, Betten und Fahrt an einem Tag umtragen */
  | { kind: 'move'; date?: string | null }
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
          tripId={tripId}
          cities={cities}
          jpyRate={trip?.jpy_rate ?? 175}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          value={{ ...(activePlace ?? {}), ...(request.defaults ?? {}) } as Partial<Place>}
          onCancel={close}
          onSubmit={async (place) => {
            await store.upsert('places', place);
            close();
            store.say(
              activePlace
                ? `„${place.name}“ aktualisiert${place.date ? ` – Tag ${place.date.split('-').reverse().join('.')}` : ''}`
                : place.date
                  ? `„${place.name}“ fest für ${fmtDate(place.date, { weekday: 'short', day: '2-digit', month: '2-digit' })} eingeplant.`
                  : `„${place.name}“ angelegt – ohne Tag, er steht in der Liste unter Aktivitäten. Zieh ihn auf der Tages-Seite auf einen Tag.`,
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
          tripId={tripId}
          cities={cities}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          value={{ ...(activeHotel ?? {}), ...(request.defaults ?? {}) } as Partial<Hotel>}
          onCancel={close}
          onSubmit={async (hotel) => {
            await store.upsert('hotels', hotel);
            close();
            store.say(`Unterkunft „${hotel.name}“ gespeichert.`);
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
          tripId={tripId}
          tripStart={trip?.start_date}
          tripEnd={trip?.end_date}
          jpyRate={trip?.jpy_rate ?? 175}
          value={{ ...(activeExpense ?? {}), ...(request.defaults ?? {}) } as Partial<Expense>}
          onCancel={close}
          onSubmit={async (e) => {
            await store.upsert('expenses', e);
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
      {request?.kind === 'move' ? (
        <OrtswechselDialog
          trip={trip}
          places={store.places.filter((p) => p.trip_id === tripId)}
          hotels={store.hotels.filter((h) => h.trip_id === tripId)}
          journeys={store.journeys.filter((j) => j.trip_id === tripId)}
          initialDate={request.date ?? trip?.start_date ?? null}
          onClose={close}
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
