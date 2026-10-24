import type { Trip, TripBundle } from './types';

/** alle Helfer kommen auch mit einer noch unbekannten Reise zurecht */
export type BundleLike = Omit<TripBundle, 'trip'> & { trip?: Trip };
import { daysBetween, eachDate, knownCity } from './format';
import { byOrder } from './dayplan';

export interface CostSummary {
  accommodation: number;
  transport: number;
  entries: number;
  expenses: number;
  total: number;
  booked: number;
  open: number;
  perPerson: number;
  byCategory: { label: string; value: number; count: number }[];
  byCity: { city: string; places: number; cost: number }[];
}

const sum = (nums: (number | null | undefined)[]) => nums.reduce<number>((acc, n) => acc + (typeof n === 'number' && Number.isFinite(n) ? n : 0), 0);

export function costsOf(bundle: BundleLike): CostSummary {
  const accommodation = sum(bundle.hotels.map((h) => h.price_total_eur));
  const transport = sum(bundle.journeys.map((j) => j.price_eur));
  const entries = sum(bundle.places.map((p) => p.price_eur));
  const expenses = sum(bundle.expenses.map((e) => e.amount_eur));
  const total = accommodation + transport + entries + expenses;

  const bookedRows = [...bundle.places.map((p) => ({ s: p.booking_status, v: p.price_eur ?? 0 })), ...bundle.hotels.map((h) => ({ s: h.booking_status, v: h.price_total_eur ?? 0 })), ...bundle.journeys.map((j) => ({ s: j.booking_status, v: j.price_eur ?? 0 }))];
  const booked = sum(bookedRows.filter((r) => r.s === 'gebucht' || r.s === 'erledigt').map((r) => r.v));

  const catMap = new Map<string, number>();
  for (const e of bundle.expenses) catMap.set(e.category, (catMap.get(e.category) ?? 0) + (e.amount_eur || 0));
  const byCategory = [
    { label: 'Unterkunft', value: accommodation, count: bundle.hotels.length },
    { label: 'Flüge & Fahrten', value: transport, count: bundle.journeys.length },
    { label: 'Aktivitäten, Tickets, Essen', value: entries, count: bundle.places.filter((p) => p.price_eur).length },
    ...Array.from(catMap.entries()).map(([label, value]) => ({ label, value, count: bundle.expenses.filter((e) => e.category === label).length })),
  ]
    .filter((c) => c.value > 0 || c.count > 0)
    .sort((a, b) => b.value - a.value);

  const cityMap = new Map<string, { places: number; cost: number }>();
  for (const p of bundle.places) {
    const key = p.city || '—';
    const cur = cityMap.get(key) ?? { places: 0, cost: 0 };
    cityMap.set(key, { places: cur.places + 1, cost: cur.cost + (p.price_eur ?? 0) });
  }

  return {
    accommodation,
    transport,
    entries,
    expenses,
    total,
    booked,
    open: Math.max(0, total - booked),
    perPerson: bundle.trip && bundle.trip.travelers > 0 ? total / bundle.trip.travelers : total,
    byCategory,
    byCity: Array.from(cityMap.entries())
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.places - a.places),
  };
}

export function nightsBooked(bundle: BundleLike): number {
  return sum(bundle.hotels.map((h) => h.nights));
}

/** Welche Nacht ist durch keine Unterkunft abgedeckt? (Loch im Plan) */
/**
 * Jede Nacht der Reise – mit Bett oder ohne. Der Zeitraum ist die Reise, reichen
 * die Betten darüber hinaus auch die Nächte danach: kein Loch bleibt unsichtbar.
 * Die Nacht am Abreisetag ist keine Nacht mehr, die wird nicht gezählt.
 */
export function nightCoverage(bundle: BundleLike): { date: string; covered: boolean; hotel: string | null; hotelId: string | null; stays: number }[] {
  const inDates = bundle.hotels.map((h) => h.check_in).filter(Boolean) as string[];
  const outDates = bundle.hotels.map((h) => h.check_out).filter(Boolean) as string[];
  const start = [bundle.trip?.start_date, ...inDates].filter(Boolean).sort()[0] ?? null;
  const end = [bundle.trip?.end_date, ...outDates].filter(Boolean).sort().slice(-1)[0] ?? null;
  if (!start || !end || end <= start) return [];
  const nights = eachDate(start, end).slice(0, -1);
  const stayCount = new Map<string, number>();
  for (const h of bundle.hotels) {
    if (!h.check_in || !h.check_out) continue;
    const n = Math.max(1, eachDate(h.check_in, h.check_out).length - 1);
    stayCount.set(h.id, n);
  }
  return nights.map((date) => {
    const hits = bundle.hotels.filter((h) => h.check_in && h.check_out && date >= h.check_in && date < h.check_out);
    // mehrere Betten für eine Nacht → das engere gewinnt: wer eine Durchgangs-Unterkunft
    // mit einer Nacht außer Haus kombiniert, hat die kurze ja wirklich gebucht
    const hit = hits.sort(
      (a, b) =>
        (stayCount.get(a.id) ?? 0) - (stayCount.get(b.id) ?? 0) ||
        (a.check_in! === b.check_in! ? 0 : a.check_in! < b.check_in! ? 1 : -1),
    )[0];
    return { date, covered: Boolean(hit), hotel: hit?.name ?? null, hotelId: hit?.id ?? null, stays: hit ? (stayCount.get(hit.id) ?? 0) : 0 };
  });
}

/** Tage, an denen nichts geplant ist (Reisetage ausgenommen) */
export function emptyDays(bundle: BundleLike): string[] {
  const dates = eachDate(bundle.trip?.start_date, bundle.trip?.end_date);
  const withPlan = new Set(bundle.places.map((p) => p.date).filter(Boolean) as string[]);
  const travelDays = new Set(bundle.journeys.filter((j) => /flug|ankunft|abreise|rückflug|fahrt|transfer|→/i.test(`${j.title} ${j.mode ?? ''}`)).map((j) => j.date as string));
  return dates.filter((d) => !withPlan.has(d) && !travelDays.has(d));
}

export function tripLengthLabel(trip: Trip | undefined): string {
  const days = daysBetween(trip?.start_date, trip?.end_date);
  return days ? `${days} Tage` : 'ohne Datum';
}

export function dayPlan(bundle: BundleLike) {
  const dates = eachDate(bundle.trip?.start_date, bundle.trip?.end_date);
  const placeDates = Array.from(new Set(bundle.places.map((p) => p.date).filter((d): d is string => Boolean(d))));
  const extra = placeDates.filter((d) => !dates.includes(d)).sort();
  const all = [...dates, ...extra].sort();
  const journeysByDate = new Map<string, typeof bundle.journeys>();
  for (const j of bundle.journeys) {
    if (!j.date) continue;
    journeysByDate.set(j.date, [...(journeysByDate.get(j.date) ?? []), j]);
  }
  const hotelsByCity = new Map<string, string>();
  for (const h of bundle.hotels) if (h.city && h.name) hotelsByCity.set(h.city.toLowerCase(), h.name);

  return all.map((date) => {
    const places = bundle.places.filter((p) => p.date === date).sort(byOrder);
    const cityList = Array.from(new Set(places.map((p) => knownCity(p.city)).filter((c): c is string => Boolean(c))));
    const journeys = journeysByDate.get(date) ?? [];
    const hotel = hotelsByCity.get((journeys[0]?.to_city ?? cityList[0] ?? '').toLowerCase()) ?? null;
    return { date, places, count: places.length, cities: cityList, journeys, hotel };
  });
}
