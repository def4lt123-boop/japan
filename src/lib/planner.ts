import type { Hotel, Journey, Place } from './types';
import { uid } from './format';

/**
 * Planungs-Helfer: eine Reise (oder deren Pool) in eine neue Reise übernehmen
 * und die Orte automatisch auf die passenden Tage verteilen.
 */

export function dayDiff(from?: string | null, to?: string | null): number {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function shiftDate(iso: string | null | undefined, days: number): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Städte, die in der Reisekette nicht als eigener Halt auftauchen → Gaststadt */
const CITY_ALIASES: Record<string, string> = {
  kamakura: 'tokio',
  nara: 'osaka',
  wakayama: 'osaka',
  tottori: 'kobe',
  awaji: 'kobe',
  miyajima: 'hiroshima',
  otsu: 'shiga',
  hikone: 'shiga',
  uji: 'kyoto',
  ohara: 'kyoto',
};

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Welche Daten gehören zu welcher Stadt? Abgleitet aus dem Reiseverlauf. */
export function cityDates(journeys: Journey[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const j of journeys) {
    if (!j.date) continue;
    for (const city of [j.to_city, j.from_city]) {
      if (!city) continue;
      const key = norm(city);
      const arr = map.get(key) ?? [];
      if (!arr.includes(j.date)) arr.push(j.date);
      map.set(key, arr.sort());
    }
  }
  for (const [key, arr] of map) map.set(key, Array.from(new Set(arr)).sort());
  return map;
}

export interface CloneOptions {
  targetTripId: string;
  shiftDays: number;
  /** Orte ohne Datum aus dem Pool auf die Stadttage verteilen */
  distributePool?: boolean;
  /** Buchungsstatus/Preise für eine neue Reise zurücksetzen */
  resetForNewTrip?: boolean;
  /** Stadt → Reisetage (schon auf die neue Reise verschoben), aus dem Reiseverlauf */
  cityDates?: Map<string, string[]>;
}

export function clonePlaces(places: Place[], opts: CloneOptions): Place[] {
  const { targetTripId, shiftDays, distributePool = true, resetForNewTrip = false, cityDates } = opts;
  const datesByCity = new Map<string, string[]>();
  const addCityDate = (city: string, date: string) => {
    const key = norm(CITY_ALIASES[norm(city)] ?? norm(city));
    const arr = datesByCity.get(key) ?? [];
    if (!arr.includes(date)) arr.push(date);
    datesByCity.set(key, arr.sort());
  };
  if (distributePool && cityDates) {
    for (const [city, arr] of cityDates) for (const d of arr) addCityDate(city, d);
  }

  // Last pro Tag, damit die Tage ähnlich voll werden
  const load = new Map<string, number>();
  const bySort = [...places].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const p of bySort) {
    if (!p.date) continue;
    const shifted = shiftDate(p.date, shiftDays)!;
    load.set(shifted, (load.get(shifted) ?? 0) + 1);
    if (distributePool && p.city) addCityDate(p.city, shifted);
  }
  const empty = !Array.from(datesByCity.values()).some((v) => v.length);
  const activeMap = distributePool && !empty ? datesByCity : null;

  const cityKey = (city: string | null | undefined) => norm(CITY_ALIASES[norm(city)] ?? norm(city));
  const candidatesFor = (city: string | null | undefined): string[] =>
    activeMap?.get(cityKey(city)) ?? (activeMap ? (Array.from(activeMap.values()).flat().sort() as string[]) : []);

  return bySort.map((p) => {
    let date: string | null = p.date ? shiftDate(p.date, shiftDays) : null;
    if (!date && activeMap) {
      const candidates = candidatesFor(p.city).filter(Boolean);
      if (candidates.length) {
        // freier Tag mit der geringsten Auslastung
        date = candidates.reduce((best, d) => ((load.get(d) ?? 0) < (load.get(best) ?? 0) ? d : best), candidates[0]);
        load.set(date, (load.get(date) ?? 0) + 1);
      }
    }
    // „Kann“-Punkte bleiben in der neuen Reise bewusst in der Wünscheliste –
    // so sieht man sofort, was noch Platz hat.
    if (resetForNewTrip && p.priority === 'kann') date = null;
    const clone: Place = {
      ...p,
      id: uid('pl'),
      trip_id: targetTripId,
      date,
      booking_status: resetForNewTrip ? 'offen' : p.booking_status,
      created_at: undefined,
    };
    if (resetForNewTrip && !clone.notes) clone.notes = null;
    return clone;
  });
}

export function cloneHotels(hotels: Hotel[], opts: CloneOptions): Hotel[] {
  const { targetTripId, shiftDays, resetForNewTrip = false } = opts;
  return hotels.map((h) => {
    const clone: Hotel = {
      ...h,
      id: uid('ht'),
      trip_id: targetTripId,
      check_in: shiftDate(h.check_in, shiftDays),
      check_out: shiftDate(h.check_out, shiftDays),
      booking_status: resetForNewTrip ? 'offen' : h.booking_status,
      created_at: undefined,
    };
    if (resetForNewTrip) {
      const nights = h.nights ? ` (${h.nights} Nächte)` : '';
      clone.notes = [
        `Übernommen aus einer früheren Reise${nights}. Preis/Verfügbarkeit neu prüfen.`,
        h.price_total_eur ? `Alter Preis: ${h.price_total_eur} €` : null,
        h.notes ? `Notiz davor: ${h.notes}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    return clone;
  });
}

export function cloneJourneys(journeys: Journey[], opts: CloneOptions): Journey[] {
  const { targetTripId, shiftDays, resetForNewTrip = false } = opts;
  return journeys
    .filter((j) => j.date)
    .map((j) => {
      const clone: Journey = {
        ...j,
        id: uid('jn'),
        trip_id: targetTripId,
        date: shiftDate(j.date, shiftDays),
        booking_status: resetForNewTrip ? 'offen' : j.booking_status,
        notes: resetForNewTrip
          ? [j.notes, j.price_eur ? `Preis davor: ${j.price_eur} €` : null, 'Übernommen aus der alten Reise – Uhrzeiten/Preise aktualisieren.']
              .filter(Boolean)
              .join(' · ')
          : j.notes,
        created_at: undefined,
      };
      return clone;
    })
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
}

/**
 * Restliche Pool-Einträge (date = null) auf die Reisetage verteilen –
 * gleichmäßig, mit Blick auf die schon vorhandene Auslastung.
 */
export function distributePool(places: Place[], startDate: string | null, endDate: string | null): Place[] {
  if (!startDate || !endDate) return places;
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  for (let d = new Date(start), i = 0; d <= end && i < 400; d.setDate(d.getDate() + 1), i++) {
    dates.push(d.toISOString().slice(0, 10));
  }
  if (!dates.length) return places;
  const load = new Map<string, number>();
  for (const p of places) if (p.date) load.set(p.date, (load.get(p.date) ?? 0) + 1);

  const byCity = new Map<string, string[]>();
  for (const p of places) {
    if (!p.date || !p.city) continue;
    const arr = byCity.get(norm(p.city)) ?? [];
    if (!arr.includes(p.date)) arr.push(p.date);
    byCity.set(norm(p.city), arr);
  }

  return places.map((p) => {
    if (p.date) return p;
    const cityDatesArr = (byCity.get(norm(p.city)) ?? []).filter((d) => dates.includes(d));
    const candidates = cityDatesArr.length ? cityDatesArr : dates;
    const date = candidates.reduce((best, d) => ((load.get(d) ?? 0) < (load.get(best) ?? 0) ? d : best), candidates[0]);
    load.set(date, (load.get(date) ?? 0) + 1);
    return { ...p, date };
  });
}
