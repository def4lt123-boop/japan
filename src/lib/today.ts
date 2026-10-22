/**
 * „Was ist heute dran?" – der Tageslauf einer Reise.
 *
 * Alles hier rechnet mit echten Kalenderdaten: Der heutige Tag ist der Tag, den
 * die Uhr anzeigt. Liegt der außerhalb des Reisezeitraums, sagt der Status bescheid
 * und bietet an, die Reise auf heute zu schieben (`startToday`).
 */
import type { Expense, Hotel, Journey, Place, Trip } from './types';
import type { StoreValue } from './store';
import { DAY_END, DAY_START, DEFAULT_DURATION, SLOT_START, timeToMin } from './dayplan';
import { addDays, daysBetween, fmtDate, plural, today } from './format';
import { dayDiff, shiftDate } from './planner';

export type DaySlotKey = 'Ganzer Tag' | 'Vormittag' | 'Mittag' | 'Nachmittag' | 'Abend' | 'Nacht';

/** Reihenfolge im Tag – so werden die Abschnitte auch angezeigt */
export const DAY_SLOTS: DaySlotKey[] = ['Ganzer Tag', 'Vormittag', 'Mittag', 'Nachmittag', 'Abend', 'Nacht'];

/** Grenzen der Abschnitte in Minuten ab Mitternacht */
const BOUNDS: { key: DaySlotKey; from: number; to: number }[] = [
  { key: 'Vormittag', from: DAY_START, to: 12 * 60 },
  { key: 'Mittag', from: 12 * 60, to: 15 * 60 },
  { key: 'Nachmittag', from: 15 * 60, to: 18 * 60 },
  { key: 'Abend', from: 18 * 60, to: 21 * 60 },
  { key: 'Nacht', from: 21 * 60, to: DAY_END + 6 * 60 },
];

const startOf = (p: Place): number => {
  const explicit = timeToMin(p.start_time);
  if (explicit !== null) return explicit;
  return (p.time_slot && SLOT_START[p.time_slot]) || 9 * 60;
};

const isFullDay = (p: Place): boolean =>
  p.time_slot === 'Ganzer Tag' || Boolean(p.end_date && p.date && p.end_date > p.date);

/** Zu welchem Abschnitt des Tages gehört ein Punkt */
export function slotOf(place: Place): DaySlotKey {
  if (isFullDay(place)) return 'Ganzer Tag';
  const at = startOf(place);
  const hit = BOUNDS.find((b) => at >= b.from && at < b.to);
  return hit ? hit.key : 'Nacht';
}

/** Punkte eines Tages, nach Abschnitt sortiert – innerhalb eines Abschnitts der Reihe nach */
export function dayBuckets(places: Place[]): Record<DaySlotKey, Place[]> {
  const out = Object.fromEntries(DAY_SLOTS.map((k) => [k, [] as Place[]])) as Record<DaySlotKey, Place[]>;
  for (const p of places) out[slotOf(p)].push(p);
  for (const key of DAY_SLOTS) {
    out[key].sort((a, b) => (isFullDay(a) ? 0 : startOf(a) - startOf(b)) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'de'));
  }
  return out;
}

export const slotLabel: Record<DaySlotKey, string> = {
  'Ganzer Tag': 'Den ganzen Tag',
  Vormittag: 'Vormittag',
  Mittag: 'Mittag',
  Nachmittag: 'Nachmittag',
  Abend: 'Abend',
  Nacht: 'Abends & nachts',
};

export const slotIcon: Record<DaySlotKey, string> = {
  'Ganzer Tag': '🌞',
  Vormittag: '🌅',
  Mittag: '🍚',
  Nachmittag: '🚶',
  Abend: '🌆',
  Nacht: '🌙',
};

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

/** ▶️ „Heute starten": Tag 1 ist ab heute */
export function startToday(store: ShiftStore, input: { trip?: Trip; places: Place[]; hotels: Hotel[]; journeys: Journey[]; expenses?: Expense[] }): number {
  return shiftTrip(store, { ...input, start: today() });
}

/** Der Plan eines Abschnitts in einem Satz – für Kacheln und Toasts */
export function summarize(places: Place[]): string {
  if (!places.length) return 'nichts geplant';
  const names = places.slice(0, 2).map((p) => p.name);
  return names.join(', ') + (places.length > names.length ? ` +${places.length - names.length}` : '');
}

export { DAY_START, DAY_END, DEFAULT_DURATION };
