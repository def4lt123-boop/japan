/**
 * Zeitplanung pro Tag.
 *
 * Eine Aktivität belegt ein Zeitfenster: start_time + duration_min. Fehlende
 * Angaben werden aus der Tageszeit (Morgen/Mittag/…) geschätzt, damit der Tag
 * trotzdem ein Bild hat. Alles hier rechnet mit Minuten seit Mitternacht.
 */
import type { Place } from './types';
import { fmtDate, parseDuration } from './format';

export const DAY_START = 7 * 60;
export const DAY_END = 23 * 60;
export const DAY_SPAN = DAY_END - DAY_START;

/** Standardlänge, wenn ein Punkt keine Dauer hat – 1,5 h, damit der Tag nicht leer wirkt */
export const DEFAULT_DURATION = 90;

/** Wo eine Tageszeit ohne genaue Uhrzeit im Tag anfängt – dieselbe Tabelle wie die Übersicht */
export const SLOT_START: Record<string, number> = {
  Morgen: 7 * 60,
  Vormittag: 9 * 60,
  Mittag: 12 * 60,
  Nachmittag: 15 * 60,
  Abend: 18 * 60 + 30,
  Nachts: 21 * 60 + 30,
  'Ganzer Tag': DAY_START,
};

export const timeToMin = (t?: string | null): number | null => {
  if (!t) return null;
  const m = /^(\d{1,2})[:.](\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

export const minToTime = (m: number): string => {
  const total = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export interface Window {
  start: number;
  end: number;
  /** feste Uhrzeit aus dem Eintrag (sonst aus Tageszeit/Dauer geschätzt) */
  explicit: boolean;
  /**占tatt einer Angabe – Länge aus der Tageszeit bzw. Standard */
  assumedDuration: boolean;
  fullDay: boolean;
}

/** Das Zeitfenster, das ein Punkt im Tag blockiert */
export function windowOf(place: Place): Window | null {
  if (!place.date) return null;
  const fullDay = place.time_slot === 'Ganzer Tag' || Boolean(place.end_date && place.date && place.end_date > place.date);
  if (fullDay) return { start: DAY_START, end: DAY_END, explicit: true, assumedDuration: false, fullDay: true };
  const at = timeToMin(place.start_time);
  const slot = place.time_slot ? SLOT_START[place.time_slot] ?? null : null;
  const start = at ?? slot ?? 9 * 60;
  const assumedDuration = at === null && !place.duration_min ? true : !place.duration_min;
  const duration = place.duration_min ?? DEFAULT_DURATION;
  return { start, end: Math.min(DAY_END, start + duration), explicit: at !== null, assumedDuration, fullDay: false };
}

export const windowsOf = (places: Place[]): { place: Place; win: Window }[] =>
  places
    .map((place) => ({ place, win: windowOf(place) }))
    .filter((x): x is { place: Place; win: Window } => Boolean(x.win))
    .sort((a, b) => a.win.start - b.win.start || a.place.sort_order - b.place.sort_order);

/** Belegte Abschnitte, überlappungsfrei zusammengefasst */
export function busyWindows(places: Place[]): [number, number][] {
  const merged: [number, number][] = [];
  for (const { win } of windowsOf(places)) {
    const last = merged[merged.length - 1];
    if (last && win.start <= last[1]) last[1] = Math.max(last[1], win.end);
    else merged.push([win.start, win.end]);
  }
  return merged;
}

/** Freie Lücken des Tages – das ist „der Rest, der noch nicht verplant ist" */
export function freeWindows(places: Place[]): [number, number][] {
  const busy = busyWindows(places);
  const free: [number, number][] = [];
  let cursor = DAY_START;
  for (const [start, end] of busy) {
    if (start > cursor) free.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < DAY_END) free.push([cursor, DAY_END]);
  return free.filter(([a, b]) => b - a >= 20);
}

export const fmtWindow = (start: number, end: number): string => `${minToTime(start)}–${minToTime(end)} Uhr`;

export const fmtWindows = (list: [number, number][]): string => list.map(([a, b]) => `${minToTime(a)}–${minToTime(b)}`).join(', ');

/** Summe der geplanten Zeit in Minuten (Überschneidungen nur einmal) */
export function plannedMinutes(places: Place[]): number {
  return busyWindows(places).reduce((sum, [a, b]) => sum + (b - a), 0);
}

/**
 * Vorschlag für die Startzeit: die gewünschte Zeit, sonst die erste Lücke,
 * die lang genug ist. `moved` = die gewünschte Zeit war belegt.
 */
export function suggestStart(siblings: Place[], duration: number, desired?: number | null): { start: number; moved: boolean } {
  const len = Math.max(15, duration);
  const busy = busyWindows(siblings);
  const fits = (start: number) => start + len <= DAY_END && !busy.some(([a, b]) => start < b && start + len > a);
  if (desired === null || desired === undefined) {
    const first = freeWindows(siblings)[0];
    const from = first ? first[0] : DAY_END - len;
    for (let t = Math.max(DAY_START, from); t + len <= DAY_END; t += 15) if (fits(t)) return { start: t, moved: false };
    return { start: Math.max(DAY_START, from), moved: false };
  }
  for (let t = Math.max(DAY_START, desired); t + len <= DAY_END; t += 15) if (fits(t)) return { start: t, moved: t !== desired };
  for (let t = DAY_START; t + len <= DAY_END; t += 15) if (fits(t)) return { start: t, moved: true };
  return { start: desired, moved: false };
}

/** Punkte, die dem Wunschzeitfenster in die Quere kommen */
export function collide(siblings: Place[], start: number, duration: number, ignoreId?: string): Place[] {
  const len = Math.max(15, duration);
  return windowsOf(siblings)
    .filter(({ place, win }) => place.id !== ignoreId && !win.fullDay && start < win.end && start + len > win.start)
    .map(({ place }) => place);
}

/** „Mo 08.03.“ – für Meldungen, damit ein Tag wiedererkennbar ist */
const pretty = (iso: string) => fmtDate(iso, { weekday: 'short', day: '2-digit', month: '2-digit' });

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '')
    .trim();

/**
 * Dieselbe Aktivität an demselben Tag = Doppelplanung. Groß-/Kleinschreibung,
 * Leerzeichen und Anführungszeichen sind dabei egal – „Nara Park “ und
 * „nara park“ sind derselbe Punkt, auch wenn er als Kopie angelegt wurde.
 */
export function duplicateOnDay(all: Place[], place: { id: string; name: string }, date: string | null): Place[] {
  if (!date) return [];
  const key = norm(place.name);
  if (!key) return [];
  return all.filter((p) => p.id !== place.id && p.date === date && norm(p.name) === key);
}

export interface AssignStore {
  patch: (table: 'places', id: string, patch: Partial<Place>) => Promise<void> | void;
  say: (msg: string) => void;
}

/**
 * Ein Punkt bekommt seinen Tag (und optional eine Uhrzeit). Doppelplanung wird
 * abgewiesen, belegte Zeiten automatisch in die nächste Lücke geschoben.
 */
export function assign(
  store: AssignStore,
  all: Place[],
  place: Place,
  next: { date?: string | null; start_time?: string | null; duration_min?: number | null },
): boolean {
  const date = next.date === undefined ? place.date : next.date;
  const dupes = duplicateOnDay(all, place, date ?? null);
  if (dupes.length) {
    const day = date ? pretty(date) : 'diesem Tag';
    store.say(`„${place.name}“ steht am ${day} schon (Eintrag „${dupes[0].name}“). Einen Tag weiter oder erst umbenennen – zweimal am selben Tag ist keine doppelte Zeit, sondern ein Duplikat.`);
    return false;
  }

  const patch: Partial<Place> = {};
  if (next.date !== undefined && next.date !== place.date) patch.date = next.date;
  const siblings = all.filter((p) => p.id !== place.id && p.date === (date ?? null));
  const duration = next.duration_min ?? place.duration_min ?? DEFAULT_DURATION;

  if (next.start_time !== undefined) {
    patch.start_time = next.start_time;
  }
  if (next.duration_min !== undefined) patch.duration_min = next.duration_min;

  const wanted = timeToMin(next.start_time ?? place.start_time);
  const movedDay = next.date !== undefined && (next.date ?? '') !== (place.date ?? '');
  let note: string | null = null;

  if (date && wanted !== null) {
    const { start, moved } = suggestStart(siblings, duration, wanted);
    if (moved) {
      patch.start_time = minToTime(start);
      note = `${fmtWindow(wanted, wanted + duration)} ist belegt – „${place.name}“ rutscht auf ${minToTime(start)}.`;
    } else if (movedDay) {
      note = `„${place.name}“ → ${pretty(date)} · ${fmtWindow(start, start + duration)}.`;
    } else if (next.start_time !== undefined) {
      note = `„${place.name}“ ${fmtWindow(start, start + duration)} am ${pretty(date)}.`;
    }
  } else if (date && wanted === null) {
    const { start } = suggestStart(siblings, duration, null);
    const whole = place.time_slot === 'Ganzer Tag' || Boolean(place.end_date && place.date && place.end_date > place.date);
    if (!whole) patch.start_time = minToTime(start);
    if (movedDay || next.start_time !== undefined) {
      note = `„${place.name}“ → ${pretty(date)} · ${whole ? 'ganzer Tag' : `${fmtWindow(start, start + duration)} (erste Lücke)`}.`;
    }
  } else if (movedDay && !date) {
    note = `„${place.name}“ zurück in die Liste – kein Tag mehr.`;
  }

  void store.patch('places', place.id, patch);
  if (note) store.say(note);
  return true;
}

/** Dauer-Eingabe akzeptiert „2", „2 h", „90", „1:30" */
export const parseLen = (input: string): number | null => parseDuration(input);
