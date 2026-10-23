/**
 * Ortswechsel – gelesen, nicht eingetragen.
 *
 * Wo du bist, entscheidet das Bett: die Stadt der Nacht ist die Stadt der Unterkunft.
 * Wechselt sie zwischen zwei Nächten, ist das der Umzug – er steht schon in der Reise,
 * sobald die Unterkünfte richtig dastehen. Deshalb gibt es hier kein Formular und keine
 * Liste zum Abhaken, nur die Rechnung: `stayOn`, `cityOfDay`, `locusChanges`.
 */
import type { Hotel, Journey } from './types';

/** Eine Nacht gehört zu der Unterkunft, deren Zeitraum sie trifft – sonst zur letzten davor */
export function stayOn(hotels: Hotel[], date: string | null): Hotel | null {
  if (!date) return null;
  const within = hotels.find((h) => h.check_in && h.check_out && h.check_in <= date && date < h.check_out);
  if (within) return within;
  const before = hotels
    .filter((h) => h.check_in && h.check_in <= date)
    .sort((a, b) => (a.check_in! < b.check_in! ? 1 : -1));
  return before[0] ?? null;
}

/** Stadt dieses Tages: die Unterkunft, in der geschlafen wird – sonst nichts */
export function cityOfDay(hotels: Hotel[], date: string | null): string | null {
  return stayOn(hotels, date)?.city ?? null;
}

export interface PlaceChange {
  date: string;
  from: string;
  to: string;
  fromHotel: string | null;
  toHotel: string | null;
  /** die Fahrt, die an diesem Tag schon eingetragen ist */
  journey: Journey | null;
  /** Nächte, die in der alten Stadt bleiben, bevor es weitergeht */
  nightsInOld: number;
}

/** Alle Wechsel der Reise, in chronologischer Reihenfolge – ausschließlich aus den Betten */
export function locusChanges(hotels: Hotel[], days: string[], journeys: Journey[] = []): PlaceChange[] {
  const out: PlaceChange[] = [];
  let prevCity: string | null = null;
  let prevDate: string | null = null;
  let run = 0;
  for (const date of days) {
    const city = cityOfDay(hotels, date);
    if (!city) continue;
    run += 1;
    if (prevCity && city !== prevCity) {
      out.push({
        date,
        from: prevCity,
        to: city,
        fromHotel: prevDate ? stayOn(hotels, prevDate)?.name ?? null : null,
        toHotel: stayOn(hotels, date)?.name ?? null,
        journey: journeys.find((j) => j.date === date && same(j.to_city, city)) ?? null,
        nightsInOld: Math.max(0, run - 1),
      });
      run = 1;
    }
    prevCity = city;
    prevDate = date;
  }
  return out;
}

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Ein Bett in einer anderen Stadt beendet das alte: die vorherige Unterkunft endet an diesem
 * Check-in, der Umzug ist damit eingetragen, ohne dass irgendwo ein Formular wartet.
 * Passiert nur, wenn die Stadt wirklich eine andere ist – zwei Betten in derselben Stadt
 * (Osaka plus USJ-Nacht) bleiben beide stehen.
 */
export function trimPreviousStay(hotels: Hotel[], next: Hotel): { id: string; patch: Partial<Hotel> } | null {
  if (!next.check_in || !(next.city ?? '').trim()) return null;
  const overlapping = hotels
    .filter((h) => h.id !== next.id && h.check_in && h.check_out && h.check_in <= next.check_in! && next.check_in! < h.check_out! && !same(h.city, next.city))
    .sort((a, b) => (a.check_out! < b.check_out! ? 1 : -1));
  const prev = overlapping[0];
  if (!prev) return null;
  const nights = Math.max(0, Math.round((Date.parse(`${next.check_in}T00:00:00`) - Date.parse(`${prev.check_in}T00:00:00`)) / 86_400_000));
  return { id: prev.id, patch: { check_out: next.check_in, nights: nights || prev.nights } };
}

