/**
 * Der Tag ist eine Liste.
 *
 * Punkte stehen untereinander in der Reihenfolge, in der man sie machen will –
 * 1., 2., 3. Keine Uhrzeiten, keine Dauern, keine Lücken: „zuerst, dann, danach".
 * `sort_order` ist dabei der einzige Anker und wird beim Umhängen neu geschrieben.
 */
import type { Place } from './types';
import { fmtDay } from './format';

export interface DayStore {
  patch: (table: 'places', id: string, patch: Partial<Place>) => Promise<void> | void;
  patchMany?: (table: 'places', changes: { id: string; patch: Partial<Place> }[]) => Promise<void> | void;
  say: (msg: string) => void;
}

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '')
    .trim();

/**
 * Dieselbe Aktivität am selben Tag = Duplikat, nicht zweimal hinlegen.
 * Groß-/Kleinschreibung und Leerzeichen sind egal – „Nara Park “ und „nara park" sind
 * derselbe Punkt, auch wenn er als Kopie angelegt wurde.
 */
export function duplicateOnDay(all: Place[], place: { id: string; name: string }, date: string | null): Place[] {
  if (!date) return [];
  const key = norm(place.name);
  if (!key) return [];
  return all.filter((p) => p.id !== place.id && p.date === date && norm(p.name) === key);
}

export const byOrder = (a: Place, b: Place): number => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'de');

/** die Punkte eines Tages, in der geplanten Reihenfolge */
export function dayPlaces(all: Place[], date: string | null): Place[] {
  if (!date) return [];
  return all.filter((p) => p.date === date).slice().sort(byOrder);
}

/** das Kurzdatum der Listen – ein Name, eine Schreibweise (`fmtDay`) */
export const dayLabel = fmtDay;

/** Reihenfolge eines Tages festschreiben: 0, 1, 2 … (nur was sich ändert) */
function writeOrder(store: DayStore, all: Place[], ordered: Place[]) {
  const changes = ordered.map((p, i) => ({ id: p.id, patch: { sort_order: i } as Partial<Place> })).filter((c) => (all.find((x) => x.id === c.id)?.sort_order ?? 0) !== (c.patch.sort_order as number));
  if (!changes.length) return;
  if (store.patchMany) void store.patchMany('places', changes);
  else for (const c of changes) void store.patch('places', c.id, c.patch);
}

/**
 * Ein Punkt bekommt seinen Tag – ans Ende der Liste, oder vor `before`.
 * Zweimal derselbe Name am selben Tag wird abgewiesen.
 */
export function assign(store: DayStore, all: Place[], place: Place, next: { date?: string | null; before?: string | null }): boolean {
  const date = next.date === undefined ? place.date : next.date;
  const dupes = duplicateOnDay(all, place, date ?? null);
  if (dupes.length) {
    store.say(`„${place.name}“ steht ${date ? `am ${dayLabel(date)}` : 'schon'} als „${dupes[0].name}“ – zweimal am selben Tag ist kein Plan, sondern ein Duplikat. Erst umbenennen oder einen Tag weiter.`);
    return false;
  }

  if (!date) {
    void store.patch('places', place.id, { date: null });
    store.say(`„${place.name}“ zurück in die Liste – kein Tag mehr.`);
    return true;
  }

  const rest = all.filter((p) => p.id !== place.id && p.date === date).slice().sort(byOrder);
  const at = next.before ? Math.max(0, rest.findIndex((p) => p.id === next.before)) : rest.length;
  const movesDay = (place.date ?? null) !== date;
  if (movesDay) void store.patch('places', place.id, { date, sort_order: at });
  writeOrder(store, all, [...rest.slice(0, at), place, ...rest.slice(at)]);

  const insgesamt = rest.length + 1;
  store.say(
    movesDay || !place.date
      ? `„${place.name}“ → ${dayLabel(date)} · Stelle ${at + 1} von ${insgesamt}.`
      : `„${place.name}“ auf Stelle ${at + 1} von ${insgesamt} gerückt.`,
  );
  return true;
}

/** ▲▼ oder Ziehen: ein Punkt rutscht an seinem Tag um `dir` Stellen */
export function shiftWithin(store: DayStore, all: Place[], place: Place, dir: -1 | 1): boolean {
  if (!place.date) return false;
  const list = dayPlaces(all, place.date);
  const from = list.findIndex((p) => p.id === place.id);
  if (from < 0) return false;
  const to = from + dir;
  if (to < 0 || to >= list.length) {
    store.say(from === 0 ? 'Der Punkt ist schon der erste des Tages.' : 'Der Punkt ist schon der letzte des Tages.');
    return false;
  }
  const ordered = list.slice();
  const [item] = ordered.splice(from, 1);
  ordered.splice(to, 0, item);
  writeOrder(store, all, ordered);
  store.say(`„${place.name}“ · Stelle ${to + 1} von ${ordered.length}.`);
  return true;
}

/** ein Punkt bekommt eine neue Position (Zielindex nach dem Loslassen) */
export function moveToIndex(store: DayStore, all: Place[], placeId: string, date: string, index: number): boolean {
  const list = dayPlaces(all, date);
  const from = list.findIndex((p) => p.id === placeId);
  if (from < 0) return false;
  const ordered = list.slice();
  const [item] = ordered.splice(from, 1);
  ordered.splice(Math.max(0, Math.min(ordered.length, index)), 0, item);
  writeOrder(store, all, ordered);
  const name = all.find((p) => p.id === placeId)?.name ?? 'Punkt';
  store.say(`„${name}“ · Stelle ${Math.max(0, Math.min(ordered.length - 1, index)) + 1} von ${ordered.length}.`);
  return true;
}

/** Punkte eines Tages als „1 ·/name" – für Meldungen und die Unterwegs-Seite */
export const numbered = (places: Place[]) => places.map((p, i) => `${i + 1} · ${p.name}`);
