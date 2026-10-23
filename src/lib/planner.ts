import type { Hotel, Journey, Place } from './types';
import { dayStart, isoOf, uid } from './format';

/**
 * Planungs-Helfer: eine Reise in eine neue übernehmen.
 * Tage wandern mit, Status wird zurückgesetzt – verteilt wird hier nichts.
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
  const d = dayStart(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

export interface CloneOptions {
  targetTripId: string;
  shiftDays: number;
  /** Buchungsstatus/Preise für eine neue Reise zurücksetzen */
  resetForNewTrip?: boolean;
}

export function clonePlaces(places: Place[], opts: CloneOptions): Place[] {
  const { targetTripId, shiftDays, resetForNewTrip = false } = opts;
  const bySort = [...places].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return bySort.map((p) => {
    let date: string | null = p.date ? shiftDate(p.date, shiftDays) : null;
    // „Kann“-Punkte kommen ohne Tag in die neue Reise – so sieht man sofort, was noch Platz hat.
    if (resetForNewTrip && p.priority === 'kann') date = null;
    const clone: Place = {
      ...p,
      id: uid('pl'),
      trip_id: targetTripId,
      date,
      booking_status: resetForNewTrip ? 'offen' : p.booking_status,
      // ein Ticket vom Vorjahr gilt nicht für die neue Reise
      ticket_status: resetForNewTrip ? 'unklar' : (p.ticket_status ?? 'unklar'),
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

/** nur für die Vorlage: Stadt-Tage erkennen, damit die Beispielreise nicht leer aussieht */
const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/**
 * Punkte ohne Tag auf die Reisetage setzen – gleichmäßig, mit Blick auf die
 * Auslaufung und gleiche Stadt zuerst. Läuft einmal beim Anlegen der Beispiel-Reise,
 * nie beim Duplizieren und nie in der Oberfläche: geplant wird hier nichts.
 */
export function distributePool(places: Place[], startDate: string | null, endDate: string | null): Place[] {
  if (!startDate || !endDate) return places;
  const dates: string[] = [];
  const start = dayStart(startDate);
  const end = dayStart(endDate);
  if (!start || !end) return places;
  for (let d = new Date(start), i = 0; d <= end && i < 400; d.setDate(d.getDate() + 1), i++) {
    dates.push(isoOf(d));
  }
  if (!dates.length) return places;
  const load = new Map<string, number>();
  for (const q of places) if (q.date) load.set(q.date, (load.get(q.date) ?? 0) + 1);

  const byCity = new Map<string, string[]>();
  for (const q of places) {
    if (!q.date || !q.city) continue;
    const arr = byCity.get(norm(q.city)) ?? [];
    if (!arr.includes(q.date)) arr.push(q.date);
    byCity.set(norm(q.city), arr);
  }

  return places.map((q) => {
    if (q.date) return q;
    const cityDays = (byCity.get(norm(q.city)) ?? []).filter((d) => dates.includes(d));
    const candidates = cityDays.length ? cityDays : dates;
    const date = candidates.reduce((best, d) => ((load.get(d) ?? 0) < (load.get(best) ?? 0) ? d : best), candidates[0]);
    load.set(date, (load.get(date) ?? 0) + 1);
    return { ...q, date };
  });
}
