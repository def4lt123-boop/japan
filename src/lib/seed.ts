import seedJson from '../../data/seed.json';
import { cloneHotels, cloneJourneys, clonePlaces, dayDiff, distributePool } from './planner';
import type { Snapshot, Trip } from './types';

/**
 * Startdaten: die Referenz-Reise (data/seed.json) + eine neue Reise,
 * deren Inhalte aus dieser Vorlage abgeleitet werden.
 */
/** Einträge mit festem Einlass-/Zeitfenster-System – dort führt der Weg immer online vorbei. */
const TICKET_PFLICHT = [
  'teamLab Planets',
  'teamLab Borderless',
  'Tokyo Skytree',
  'Tokyo Tower',
  'Shibuya Sky',
  'Umeda Sky Building',
  'Kinkaku-ji',
  'Nijigen no Mori',
  'Kobe Tower',
];

export function seedSnapshot(): Snapshot {
  const raw = (seedJson as { default?: unknown })?.default ?? seedJson;
  const base = raw as unknown as Snapshot;
  const snapshot: Snapshot = {
    trips: base.trips.map((t) => ({ ...t, started: Boolean(t.started), started_at: t.started_at ?? null, planned_start: t.planned_start ?? null, planned_end: t.planned_end ?? null })),
    places: base.places.map((p) => {
      const ticketpflicht = TICKET_PFLICHT.some((k) => p.name.includes(k));
      return {
        ...p,
        ticket_status: p.ticket_status ?? (ticketpflicht ? ('noetig' as const) : ('unklar' as const)),
        ticket_note: p.ticket_note ?? (ticketpflicht ? 'Zeitfenster-Ticket vorab buchen' : null),
        end_date: p.end_date ?? null,
      };
    }),
    hotels: base.hotels.map((h) => ({ ...h })),
    journeys: base.journeys.map((j) => ({ ...j, end_date: j.end_date ?? null })),
    expenses: base.expenses.map((e) => ({ ...e })),
  };
  const source = snapshot.trips.find((t) => t.id === 'trip-2025');
  const target = snapshot.trips.find((t) => t.id === 'trip-2027');
  if (!source || !target) return snapshot;
  return cloneInto(snapshot, source.id, target.id, { fillDays: true });
}

/**
 * Alles aus einer Reise in eine neue kopieren: Tage wandern mit, Buchungen zurück.
 * `fillDays` setzt nur die Beispiel-Reise in die Welt – eine Kopie, die du selbst
 * anlegst, bleibt so ungeplant, wie sie in der Quelle dasteht.
 */
export function cloneInto(snapshot: Snapshot, sourceTripId: string, targetTripId: string, opts: { fillDays?: boolean } = {}): Snapshot {
  const src: Trip | undefined = snapshot.trips.find((t) => t.id === sourceTripId);
  const dst: Trip | undefined = snapshot.trips.find((t) => t.id === targetTripId);
  const shift = dayDiff(src?.start_date, dst?.start_date);
  const sourceJourneys = snapshot.journeys.filter((j) => j.trip_id === sourceTripId);

  const cloned = clonePlaces(snapshot.places.filter((p) => p.trip_id === sourceTripId), {
    targetTripId,
    shiftDays: shift,
    resetForNewTrip: true,
  });
  const plan = opts.fillDays
    ? distributePool(
        cloned.filter((x) => x.priority !== 'kann'),
        dst?.start_date ?? null,
        dst?.end_date ?? null,
      ).concat(cloned.filter((x) => x.priority === 'kann'))
    : cloned;

  return {
    trips: snapshot.trips,
    places: [...snapshot.places, ...plan],
    hotels: [...snapshot.hotels, ...cloneHotels(snapshot.hotels.filter((h) => h.trip_id === sourceTripId), { targetTripId, shiftDays: shift, resetForNewTrip: true })],
    journeys: [...snapshot.journeys, ...cloneJourneys(sourceJourneys, { targetTripId, shiftDays: shift, resetForNewTrip: true })],
    expenses: snapshot.expenses,
  };
}

function shiftDate(iso: string, days: number): string {
  const [y, m, dd] = iso.slice(0, 10).split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, dd || 1);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
