import seedJson from '../../data/seed.json';
import { cityDates, cloneHotels, cloneJourneys, clonePlaces, dayDiff } from './planner';
import type { Snapshot, Trip } from './types';

/**
 * Startdaten: die Referenz-Reise (data/seed.json) + eine neue Reise,
 * deren Inhalte aus dieser Vorlage abgeleitet werden.
 */
export function seedSnapshot(): Snapshot {
  const raw = (seedJson as { default?: unknown })?.default ?? seedJson;
  const base = raw as unknown as Snapshot;
  const snapshot: Snapshot = {
    trips: base.trips.map((t) => ({ ...t })),
    places: base.places.map((p) => ({ ...p })),
    hotels: base.hotels.map((h) => ({ ...h })),
    journeys: base.journeys.map((j) => ({ ...j })),
    expenses: base.expenses.map((e) => ({ ...e })),
  };
  const source = snapshot.trips.find((t) => t.id === 'trip-2025');
  const target = snapshot.trips.find((t) => t.id === 'trip-2027');
  if (!source || !target) return snapshot;
  return cloneInto(snapshot, source.id, target.id);
}

/** Alles aus einer Reise in eine neue kopieren (Tage verschoben, Status zurückgesetzt) */
export function cloneInto(snapshot: Snapshot, sourceTripId: string, targetTripId: string): Snapshot {
  const src: Trip | undefined = snapshot.trips.find((t) => t.id === sourceTripId);
  const dst: Trip | undefined = snapshot.trips.find((t) => t.id === targetTripId);
  const shift = dayDiff(src?.start_date, dst?.start_date);
  const sourceJourneys = snapshot.journeys.filter((j) => j.trip_id === sourceTripId);
  const shiftedDates = new Map<string, string[]>();
  for (const [city, dates] of cityDates(sourceJourneys)) shiftedDates.set(city, dates.map((d) => shiftDate(d, shift)));

  return {
    trips: snapshot.trips,
    places: [
      ...snapshot.places,
      ...clonePlaces(snapshot.places.filter((p) => p.trip_id === sourceTripId), {
        targetTripId,
        shiftDays: shift,
        resetForNewTrip: true,
        cityDates: shiftedDates,
      }),
    ],
    hotels: [...snapshot.hotels, ...cloneHotels(snapshot.hotels.filter((h) => h.trip_id === sourceTripId), { targetTripId, shiftDays: shift, resetForNewTrip: true })],
    journeys: [...snapshot.journeys, ...cloneJourneys(sourceJourneys, { targetTripId, shiftDays: shift, resetForNewTrip: true })],
    expenses: snapshot.expenses,
  };
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
