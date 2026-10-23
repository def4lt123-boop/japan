/**
 * Der Kalender einer Reise: welcher Tag ist heute, was kommt danach, und wie rutscht
 * ein ganzer Plan auf ein neues Startdatum.
 *
 * Alles hier rechnet mit echten Kalenderdaten – der heutige Tag ist der Tag, den die
 * Uhr anzeigt. Die zwei Zustände einer Reise (🗓️ Planung ↔ 🚶 unterwegs, ▶️ starten /
 * ✕ beenden) sitzen in src/lib/mode.ts, die Reihenfolge der Punkte eines Tages in
 * src/lib/dayplan.ts. Uhrzeiten gibt es nicht mehr.
 */
import type { Expense, Hotel, Journey, Place, Trip } from './types';
import type { StoreValue } from './store';
import { addDays, daysBetween, fmtDate, plural, today } from './format';
import { dayDiff, shiftDate } from './planner';

export type TodayState = 'vorher' | 'live' | 'nachher';

export interface DayContext {
  /** der Betrachter-Tag (normalerweise heute) */
  iso: string;
  state: TodayState;
  /** 1 = erster Reisetag */
  dayIndex: number | null;
  totalDays: number;
  /** Tage bis zum Start (negativ = Reise läuft schon / ist vorbei) */
  daysToStart: number | null;
}

/** Wo im Reisezeitraum steht der Tag? Auch ohne Datum brauchbar (dann `state: 'vorher'`). */
export function dayContext(trip: Trip | undefined, iso: string = today()): DayContext | null {
  if (!trip) return null;
  const totalDays = daysBetween(trip.start_date, trip.end_date);
  if (!trip.start_date) return { iso, state: 'vorher', dayIndex: null, totalDays: 0, daysToStart: null };
  const before = dayDiff(trip.start_date, iso);
  const state: TodayState = before < 0 ? 'vorher' : totalDays && before >= totalDays ? 'nachher' : 'live';
  return {
    iso,
    state,
    dayIndex: state === 'live' ? before + 1 : null,
    totalDays,
    daysToStart: before < 0 ? -before : null,
  };
}

/** Die nächsten Tage mit Plan – für „und was ist an den Tagen danach?" */
export function upcoming<T extends { date: string }>(days: T[], fromIso: string, count = 6): T[] {
  return days.filter((d) => d.date > fromIso).slice(0, count);
}

export type ShiftStore = Pick<StoreValue, 'patchMany' | 'say'>;

/**
 * Die Reise auf einen anderen Starttag schieben: jeder Punkt, jede Nacht und jede
 * Fahrt wandert um denselben Abstand mit – Reihenfolge und Abstände bleiben gleich.
 */
export function shiftTrip(store: ShiftStore, input: { trip?: Trip; places: Place[]; hotels: Hotel[]; journeys: Journey[]; expenses?: Expense[]; start: string }): number {
  const { trip, places, hotels, journeys, start } = input;
  const expenses = input.expenses ?? [];
  if (!trip) {
    store.say('Ohne Reise ist nichts zu verschieben.');
    return 0;
  }
  const offset = dayDiff(trip.start_date ?? start, start);
  if (!offset) {
    store.say('Die Reise beginnt schon an diesem Tag.');
    return 0;
  }
  const len = daysBetween(trip.start_date, trip.end_date);
  void store.patchMany('trips', [{ id: trip.id, patch: { start_date: start, end_date: addDays(start, Math.max(0, len - 1)) } }]);
  void store.patchMany(
    'places',
    places.filter((p) => p.date).map((p) => ({ id: p.id, patch: { date: shiftDate(p.date, offset), end_date: p.end_date ? shiftDate(p.end_date, offset) : null } })),
  );
  void store.patchMany(
    'hotels',
    hotels
      .filter((h) => h.check_in || h.check_out)
      .map((h) => ({ id: h.id, patch: { check_in: shiftDate(h.check_in, offset), check_out: shiftDate(h.check_out, offset) } })),
  );
  void store.patchMany(
    'journeys',
    journeys.filter((j) => j.date).map((j) => ({ id: j.id, patch: { date: shiftDate(j.date, offset), end_date: j.end_date ? shiftDate(j.end_date, offset) : null } })),
  );
  if (expenses.length) void store.patchMany('expenses', expenses.filter((e) => e.date).map((e) => ({ id: e.id, patch: { date: shiftDate(e.date, offset) } })));
  const bits = [
    plural(places.filter((x) => x.date).length, 'Aktivität', 'Aktivitäten'),
    plural(hotels.filter((x) => x.check_in).length, 'Unterkunft', 'Unterkünfte'),
    plural(journeys.filter((x) => x.date).length, 'Fahrt', 'Fahrten'),
    plural(expenses.filter((x) => x.date).length, 'Ausgabe', 'Ausgaben'),
  ].filter((b) => !b.startsWith('0 '));
  const summe = bits.reduce((n, b) => n + Number(b.split(' ')[0]), 0);
  store.say(
    `Reise startet ab jetzt am ${fmtDate(start, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} – ${bits.slice(0, -1).join(', ')}${bits.length > 1 ? ' und ' : ''}${bits[bits.length - 1] ?? 'nichts'} ${summe === 1 ? 'ist' : 'sind'} mitgerutscht.`,
  );
  return offset;
}

