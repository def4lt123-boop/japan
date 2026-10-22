/**
 * Ortswechsel – der Tag, an dem die Reise die Stadt (und damit die Unterkunft) tauscht.
 *
 * Gezählt wird über die Nächte: schläfst du am 12.03. noch in Osaka und ab dem 13.03.
 * in Tokio, ist der 13.03. der Wechsel. Der Assistent schreibt das dann in die
 * Unterkünfte, die Aktivitäten und (auf Wunsch) ins Fahrten-Log.
 */
import type { Hotel, Journey, Place, Trip } from './types';
import type { StoreValue } from './store';
import { addDays, fmtDate, uid } from './format';
import { dayDiff } from './planner';

export type MoveStore = Pick<StoreValue, 'patchMany' | 'upsert' | 'say'>;

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

/** Stadt dieses Tages: erst die Unterkunft, sonst das, was an diesem Tag geplant ist */
export function cityOfDay(places: Place[], hotels: Hotel[], date: string): string | null {
  const sleep = stayOn(hotels, date)?.city;
  if (sleep) return sleep;
  const day = places.filter((p) => p.date === date);
  if (!day.length) return null;
  const count = new Map<string, number>();
  for (const p of day) if (p.city) count.set(p.city, (count.get(p.city) ?? 0) + 1);
  return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export interface PlaceChange {
  date: string;
  from: string | null;
  to: string;
  fromHotel: string | null;
  toHotel: string | null;
  /** die Fahrt, die an diesem Tag schon eingetragen ist */
  journey: Journey | null;
  /** Tage, die in der alten Stadt bleiben, bevor es weitergeht */
  daysInOld: number;
}

/** Alle Wechsel der Reise, in chronologischer Reihenfolge */
export function locusChanges(places: Place[], hotels: Hotel[], days: string[], journeys: Journey[] = []): PlaceChange[] {
  const out: PlaceChange[] = [];
  let prevCity: string | null = null;
  let prevDate: string | null = null;
  let run = 0;
  for (const date of days) {
    const city = cityOfDay(places, hotels, date);
    if (!city) continue;
    run = run + 1;
    if (prevCity && city !== prevCity) {
      out.push({
        date,
        from: prevCity,
        to: city,
        fromHotel: prevDate ? stayOn(hotels, prevDate)?.name ?? null : null,
        toHotel: stayOn(hotels, date)?.name ?? null,
        journey: journeys.find((j) => j.date === date && same(j.to_city, city)) ?? null,
        daysInOld: run - 1,
      });
      run = 1;
    }
    prevCity = city;
    prevDate = date;
  }
  return out;
}

const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export interface MoveInput {
  /** ab diesem Tag gilt der neue Ort */
  date: string;
  toCity: string;
  hotelId?: string | null;
  /** 'day' = nur diesen Tag umhängen, 'onwards' = diesen und alle Tage danach */
  scope: 'day' | 'onwards';
  movePlaces: boolean;
  updateHotels: boolean;
  addJourney: boolean;
  mode?: string | null;
}

export interface MoveResult {
  places: number;
  hotels: number;
  journey: boolean;
  text: string;
}

/**
 * Der Eingriff selbst. Alles ist optional – wer nur die Unterkünfte nachziehen will,
 * lässt `movePlaces` aus. Gibt zurück, was passiert ist (für den Toast).
 */
export function applyMove(store: MoveStore, input: { trip?: Trip; places: Place[]; hotels: Hotel[]; journeys: Journey[] }, move: MoveInput): MoveResult {
  const { places, hotels } = input;
  const fromCity = cityOfDay(places, hotels, move.date) ?? null;
  let placeCount = 0;
  let hotelCount = 0;
  let journey = false;

  if (move.movePlaces && move.toCity) {
    const affected = places.filter(
      (p) => p.date && (move.scope === 'day' ? p.date === move.date : p.date >= move.date) && (p.city ?? '') !== move.toCity,
    );
    placeCount = affected.length;
    if (affected.length) void store.patchMany('places', affected.map((p) => ({ id: p.id, patch: { city: move.toCity } })));
  }

  if (move.updateHotels) {
    const next = move.hotelId ? hotels.find((h) => h.id === move.hotelId) : hotels.find((h) => (h.city ?? '') === move.toCity && (h.check_in ?? '9999') >= move.date) ?? hotels.find((h) => (h.city ?? '') === move.toCity);
    const current = stayOn(hotels, move.date);
    const changes: { id: string; patch: Partial<Hotel> }[] = [];
    if (current && next && current.id !== next.id) {
      const nights = Math.max(0, dayDiff(current.check_in, move.date));
      changes.push({ id: current.id, patch: { check_out: move.date, nights: nights || current.nights } });
    }
    if (next) {
      const openEnd = !next.check_out || next.check_out <= (next.check_in ?? '');
      const nights = openEnd ? Math.max(1, next.nights ?? 1) : Math.max(1, dayDiff(move.date, next.check_out));
      changes.push({ id: next.id, patch: { check_in: move.date, check_out: addDays(move.date, nights), nights } });
    }
    if (changes.length) {
      void store.patchMany('hotels', changes);
      hotelCount = changes.length;
    }
  }

  if (move.addJourney && fromCity && fromCity !== move.toCity) {
    const row: Journey = {
      id: uid('jn'),
      trip_id: input.trip?.id ?? '',
      date: move.date,
      end_date: null,
      title: `Ortswechsel ${fromCity} → ${move.toCity}`,
      from_city: fromCity,
      to_city: move.toCity,
      mode: move.mode ?? 'Zug',
      departure_time: null,
      duration_min: null,
      price_eur: null,
      hotel_name: null,
      nights: null,
      booking_status: 'offen',
      notes: null,
    };
    void store.upsert('journeys', row);
    journey = true;
  }

  const parts = [
    placeCount ? `${placeCount} ${placeCount === 1 ? 'Aktivität' : 'Aktivitäten'} in ${move.toCity}` : null,
    hotelCount ? `${hotelCount} ${hotelCount === 1 ? 'Unterkunft' : 'Unterkünfte'} neu eingeteilt` : null,
    journey ? 'Fahrt eingetragen' : null,
  ].filter(Boolean);
  const text = parts.length
    ? `Ortswechsel am ${fmtDate(move.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${parts.join(' · ')}.`
    : 'Es gab nichts zu ändern.';
  store.say(text);
  return { places: placeCount, hotels: hotelCount, journey, text };
}
