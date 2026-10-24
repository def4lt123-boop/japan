/**
 * Die zwei Zustände einer Reise.
 *
 *   🗓️ Planen  – alles darf umgebaut werden: Tage füllen, sortieren, Kategorien, Orte.
 *   ▶️ Unterwegs – der Tag läuft: Standort, Route, Hinweise, abhaken.
 *
 * Gestartet wird mit dem echten Datum: liegt der geplante Zeitraum in der Zukunft,
 * rutscht beim Starten alles mit (Reihenfolge und Abstände bleiben). Der alte
 * Zeitraum wird gemerkt, „Start zurücknehmen" stellt ihn wieder her.
 */
import type { Expense, Hotel, Journey, Place, Trip } from './types';
import type { StoreValue } from './store';
import { addDays, daysBetween, fmtDate, plural, today } from './format';
import { dayDiff } from './planner';
import { shiftTrip } from './today';
import { byOrder, dayPlaces } from './dayplan';

export type TripMode = 'plan' | 'live';
export type ModeStore = Pick<StoreValue, 'patchMany' | 'say'>;

export interface ModeInput {
  trip?: Trip;
  places: Place[];
  hotels: Hotel[];
  journeys: Journey[];
  expenses?: Expense[];
}

export const tripMode = (trip?: Trip): TripMode => (trip?.started ? 'live' : 'plan');

/** der laufende Tag, gezählt ab start_date – nie unter 1 */
export function liveDays(trip?: Trip, iso: string = today()): number {
  if (!trip?.started || !trip.start_date) return 0;
  return Math.max(1, dayDiff(trip.start_date, iso) + 1);
}

/**
 * Was passiert beim Starten mit dem Kalender? Für die Beschriftung des Knopfes –
 * und damit klar ist, ob etwas verrutscht.
 */
export function startHint(input: ModeInput): string {
  const trip = input.trip;
  if (!trip) return '';
  if (!trip.start_date || !trip.end_date) {
    const tage = new Set(input.places.map((p) => p.date).filter(Boolean) as string[]);
    return tage.size ? `Tag 1 ist heute · ${plural(tage.size, 'Tag', 'Tage')} übernommen` : 'Tag 1 ist heute · eine Woche Zeit';
  }
  const vorlauf = dayDiff(today(), trip.start_date);
  if (vorlauf > 0) return `der Plan rückt ${plural(vorlauf, 'Tag', 'Tage')} nach vorn – Tag ${vorlauf + 1} wird heute`;
  const hinten = dayDiff(trip.end_date, today());
  if (hinten > 0) return `die Reisetage liegen vorbei – der Plan rückt ${plural(hinten, 'Tag', 'Tage')} nach vorn`;
  return 'die Reise läuft genau heute – der heutige Tag ist dran';
}

/** der Start-Knopf darf sich nur zeigen, wenn es wirklich bald losgeht */
export const START_NAHE = 14;

/**
 * Steht der Reisebeginn vor der Tür? ▶️ als eigener Knopf nur dann – ein Start in
 * vier Monaten ist keine Aktion, sondern eine Ansage. Im ⋯-Menü steht er immer.
 * Liegen die Daten schon zurück, zählt das ebenfalls als „gleich geht's los".
 */
export function startIsNear(trip?: Trip, iso: string = today()): boolean {
  if (!trip || trip.started || trip.archived || !trip.start_date) return false;
  return dayDiff(iso, trip.start_date) < START_NAHE;
}

/** ▶️ Reise starten */
export function startTrip(store: ModeStore, input: ModeInput): boolean {
  const trip = input.trip;
  if (!trip) return false;
  if (trip.started) {
    store.say('Diese Reise läuft schon – beendet sie unten, um wieder zu planen.');
    return false;
  }
  const iso = today();
  const alt = { start: trip.start_date, end: trip.end_date };
  // Tag 1 soll heute sein: zu weit weg (Zukunft oder schon vorbei) rutscht der Plan, mitten drin nicht
  const tag = alt.start ? dayDiff(alt.start, iso) : -1;
  const total = alt.start && alt.end ? dayDiff(alt.start, alt.end) : 0;
  const veraltet = tag > total;

  if (tag !== 0 && (tag < 0 || veraltet)) {
    shiftTrip(store, { trip, places: input.places, hotels: input.hotels, journeys: input.journeys, expenses: input.expenses, start: iso });
  }
  // gemerkt wird der alte Zeitraum nur, wenn der Kalender wirklich verrutscht ist
  const verrutscht = tag !== 0 && (tag < 0 || veraltet);
  const patch: Partial<Trip> = { started: true, started_at: iso };
  if (verrutscht) {
    patch.planned_start = alt.start;
    patch.planned_end = alt.end;
  }
  if (!trip.start_date || !trip.end_date) {
    const tage = Array.from(new Set(input.places.map((p) => p.date).filter(Boolean) as string[])).sort();
    patch.start_date = iso;
    patch.end_date = addDays(iso, Math.max(0, (tage.length || 7) - 1));
  }
  void store.patchMany('trips', [{ id: trip.id, patch }]);

  const neu = { start: patch.start_date ?? (verrutscht ? iso : trip.start_date), end: patch.end_date ?? trip.end_date };
  const show = verrutscht ? 1 : Math.max(1, Math.min(tag + 1, total || tag + 1));
  // nach dem Verrutschen ist der alte Anfangstag der neue Tag 1 – den zählt die Meldung
  const tagIso = (verrutscht ? trip.start_date : iso) ?? iso;
  const heute = dayPlaces(input.places, tagIso);
  const ort = heute[0]?.city ?? input.hotels.find((h) => (h.check_in ?? '') <= tagIso && tagIso < (h.check_out ?? '9999-12-31'))?.city ?? null;
  store.say(
    `Unterwegs · Tag ${show}${neu.end ? ` von ${daysBetween(neu.start, neu.end) || '?'}` : ''}${ort ? ` in ${ort}` : ''} – ${heute.length ? `${plural(heute.length, 'Punkt', 'Punkte')} heute` : 'heute noch nichts geplant'}. Abhaken, Route folgen, Ort ansehen: das ist jetzt die Hauptseite.`,
  );
  return true;
}

/** ✕ Reise beenden – `restore` stellt den Planungszeitraum wieder her */
export function endTrip(store: ModeStore, input: ModeInput, restore = false): boolean {
  const trip = input.trip;
  if (!trip?.started) {
    store.say('Es läuft gerade keine Reise.');
    return false;
  }
  const erledigt = input.places.filter((p) => p.booking_status === 'erledigt').length;
  if (restore && trip.planned_start) {
    shiftTrip(store, { trip, places: input.places, hotels: input.hotels, journeys: input.journeys, expenses: input.expenses, start: trip.planned_start });
  }
  void store.patchMany('trips', [
    { id: trip.id, patch: restore && trip.planned_start ? { started: false, started_at: null, planned_start: null, planned_end: null } : { started: false, started_at: null } },
  ]);
  const zeitraum = trip.start_date ? ` · Zeitraum ${fmtDate(trip.start_date, { day: '2-digit', month: '2-digit' })}–${fmtDate(trip.end_date, { day: '2-digit', month: '2-digit' })}` : '';
  store.say(
    restore && trip.planned_start
      ? `Reise beendet – der Plan steht wieder wie vorher (${fmtDate(trip.planned_start, { day: '2-digit', month: '2-digit' })}–${fmtDate(trip.planned_end, { day: '2-digit', month: '2-digit' })}) · ${plural(erledigt, 'Punkt', 'Punkte')} bleiben abgehakt`
      : `Zurück in der Planung · ${plural(erledigt, 'Punkt', 'Punkte')} abgehakt${zeitraum}`,
  );
  return true;
}

export interface LiveDay {
  /** der Tag, der gezeigt wird – heute, oder der nächste/davorliegende wenn außerhalb */
  iso: string;
  klemmt: 'vorher' | 'nachher' | null;
  tagIndex: number;
  total: number;
}

/** Welcher Tag gehört auf die Unterwegs-Seite? Klemmt nie. */
export function liveDay(trip: Trip | undefined, iso: string = today()): LiveDay | null {
  if (!trip?.start_date) return null;
  const total = daysBetween(trip.start_date, trip.end_date);
  const offset = dayDiff(trip.start_date, iso);
  if (offset < 0) return { iso: trip.start_date, klemmt: 'vorher', tagIndex: 1, total };
  if (total && offset >= total) return { iso: addDays(trip.start_date, total - 1), klemmt: 'nachher', tagIndex: total, total };
  return { iso, klemmt: null, tagIndex: offset + 1, total };
}

export interface NextUp {
  place: Place;
  /** Stelle im Tag (1 = erster Punkt) */
  nr: number;
  total: number;
  offen: number;
}

/** Der nächste Halt = der erste Punkt des Tages, der noch nicht abgehakt ist */
export function nextUp(places: Place[]): NextUp | null {
  const list = places.slice().sort(byOrder);
  const offen = list.filter((p) => p.booking_status !== 'erledigt');
  if (!offen.length) return null;
  return { place: offen[0], nr: list.indexOf(offen[0]) + 1, total: list.length, offen: offen.length };
}
