/**
 * „Sortieren": ein Tag der Reihe nach.
 *
 * Die Punkte bleiben in ihrer Reihenfolge, rutschen aber ohne Lücken und ohne
 * Überschneidung hintereinander. Eine fest eingetragene Uhrzeit, die später liegt,
 * ist ein Anker – davor wird aufgefüllt, der Punkt selbst bleibt, wo er ist.
 * Mehrtages- und Ganztages-Punkte werden nicht angefasst (die füllen den Tag sowieso).
 */
import type { Place } from './types';
import type { StoreValue } from './store';
import { DAY_END, DAY_START, DEFAULT_DURATION, minToTime, timeToMin } from './dayplan';

export type SortStore = Pick<StoreValue, 'patchMany' | 'say'>;

const fullDay = (p: Place) => p.time_slot === 'Ganzer Tag' || Boolean(p.end_date && p.date && p.end_date > p.date);
const durationOf = (p: Place) => p.duration_min ?? DEFAULT_DURATION;
const anchorOf = (p: Place) => {
  const at = timeToMin(p.start_time);
  if (at !== null) return { at, fixed: true };
  const slot = p.time_slot ? (SLOT_ANCHOR[p.time_slot] ?? null) : null;
  return { at: slot ?? 9 * 60, fixed: false };
};
const SLOT_ANCHOR: Record<string, number> = { Vormittag: 9 * 60, Mittag: 12 * 60, Nachmittag: 15 * 60, Abend: 18 * 60 + 30, Nachts: 21 * 60 + 30 };

export interface DaySortResult {
  moved: number;
  kept: number;
  /** Punkte, für die nach 23 Uhr kein Platz mehr war */
  overflow: Place[];
}

/** Ein Tag bekommt eine saubere Reihenfolge – gibt zurück, was sich geändert hat */
export function sortDay(places: Place[]): { patches: { id: string; patch: Partial<Place> }[]; result: DaySortResult } {
  const list = places.filter((p) => !fullDay(p));
  const skipped = places.filter(fullDay);
  const ordered = list
    .map((p) => ({ p, ...anchorOf(p) }))
    .sort((a, b) => a.at - b.at || (a.p.sort_order ?? 0) - (b.p.sort_order ?? 0) || a.p.name.localeCompare(b.p.name, 'de'));

  const busy = skipped.length ? [{ start: DAY_START, end: DAY_END }] : [];
  // Der Tag fängt an, wo der erste Punkt es sagt – ohne Angabe eben vormittags um 9
  const first = ordered[0];
  let cursor = first ? (first.fixed ? first.at : 9 * 60) : DAY_START;
  cursor = Math.max(DAY_START, Math.min(cursor, DAY_END - 15));
  const patches: { id: string; patch: Partial<Place> }[] = [];
  const overflow: Place[] = [];
  let moved = 0;
  let kept = 0;

  ordered.forEach((item, i) => {
    const len = durationOf(item.p);
    // fester Termin: der Sprung dorthin ist gewollt, die Zeit vorher bleibt freie Luft
    const from = item.fixed && item.at > cursor ? item.at : cursor;
    const start = Math.max(DAY_START, from);
    const blocksFullDay = busy.some((b) => start < b.end && start + len > b.start);
    if (blocksFullDay || start + len > DAY_END) {
      overflow.push(item.p);
      return;
    }
    const patch: Partial<Place> = {};
    const time = minToTime(start);
    if ((item.p.start_time ?? '') !== time) {
      patch.start_time = time;
      patch.time_slot = null;
      patch.duration_min = len;
      moved += 1;
    } else {
      kept += 1;
    }
    if ((item.p.sort_order ?? 0) !== i) patch.sort_order = i;
    if (Object.keys(patch).length) patches.push({ id: item.p.id, patch });
    cursor = start + len;
  });

  return { patches, result: { moved, kept, overflow } };
}

/** Alle Tage der Reise auf einmal – Tage ohne Plan werden übersprungen */
export function sortDays(store: SortStore, days: { date: string; places: Place[] }[]): { days: number; moved: number; overflow: number } {
  let touched = 0;
  let moved = 0;
  let overflow = 0;
  for (const day of days) {
    if (day.places.length < 2) continue;
    const { patches, result } = sortDay(day.places);
    if (!patches.length) continue;
    void store.patchMany('places', patches);
    touched += 1;
    moved += result.moved;
    overflow += result.overflow.length;
  }
  if (!touched) store.say('Jeder Tag steht schon der Reihe nach – nichts zu sortieren.');
  else
    store.say(
      `${touched} ${touched === 1 ? 'Tag' : 'Tage'} sortiert · ${moved} ${moved === 1 ? 'Aktivität' : 'Aktivitäten'} neu gesetzt${overflow ? ` · ${overflow} passen nach 23 Uhr nicht mehr dazu` : ''}.`,
    );
  return { days: touched, moved, overflow };
}
