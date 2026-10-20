/**
 * Rechengrundlage für die grafische Reise-Übersicht:
 * Tagesraster mit Zeitblöcken, Hotel-Bänder, offene Baustellen und freie Kapazität.
 * Bewusst rein funktional – die Komponenten rendern nur.
 */
import { categoryMeta } from './categories';
import { addDays, eachDate, weekdayShort } from './format';
import { SLOT_START } from './dayplan';
import { type BundleLike, emptyDays, nightCoverage } from './stats';
import type { Hotel, Journey, Place } from './types';

/** Achse der Tagesleiste: 07:00 – 23:00 */
export const AXIS_START = 7 * 60;
export const AXIS_END = 23 * 60;
export const AXIS_SPAN = AXIS_END - AXIS_START;
/** ab so vielen Programm-Minuten gilt ein Tag als voll */
export const FULL_DAY_MIN = 8 * 60;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function timeToMin(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export const minToTime = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

export interface Block {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Minuten seit Mitternacht */
  start: number;
  end: number;
  /** false = ohne Uhrzeit eingeplant, Position nur geschätzt */
  timed: boolean;
  fullDay: boolean;
  /** >1 = Eintrag über mehrere Tage */
  span: number;
  duration: number;
  price_eur: number | null;
  booking_status: string;
  priority: string;
  city: string | null;
  date: string;
  travel_time: string | null;
  place: Place;
}

export interface DayCell {
  date: string;
  index: number;
  weekday: string;
  weekend: boolean;
  blocks: Block[];
  /** geplant ohne Uhrzeit → taucht nur als Punkt auf, nicht als Balken */
  plannedMin: number;
  freeMin: number;
  /** 0..1+, >1 = überfüllt */
  load: number;
  city: string | null;
  cities: string[];
  hotel: Hotel | null;
  /** Nacht ist durch keine Unterkunft abgedeckt */
  nightGap: boolean;
  checkIn: boolean;
  checkOut: boolean;
  journeys: Journey[];
  travelOnly: boolean;
  empty: boolean;
  /** Baustellen dieses Tages */
  issues: string[];
}

const TRAVEL_RE = /flug|ankunft|abreise|rückflug|heimflug|transfer|fahrt|→|shinkansen/i;

const isTravel = (j: Journey) => TRAVEL_RE.test(`${j.title ?? ''} ${j.mode ?? ''}`);

/** Alle Tage der Reise als Raster inklusive Zeitblöcken */
export function dayCells(bundle: BundleLike): DayCell[] {
  const dates = eachDate(bundle.trip?.start_date, bundle.trip?.end_date);
  const plannedDates = Array.from(new Set(bundle.places.map((p) => p.date).filter((d): d is string => Boolean(d))));
  const extra = plannedDates.filter((d) => !dates.includes(d)).sort();
  const all = [...dates, ...extra].sort();
  if (!all.length) return [];

  const travelDays = new Set(bundle.journeys.filter(isTravel).map((j) => j.date).filter(Boolean) as string[]);
  const quiet = new Set(emptyDays(bundle));

  return all.map((date, index) => {
    const places = bundle.places.filter((p) => p.date === date);
    const journeys = bundle.journeys.filter((j) => j.date === date);
    const hotel = bundle.hotels.find((h) => h.check_in && h.check_out && date >= h.check_in && date < h.check_out) ?? null;
    const nights = nightCoverage(bundle);
    const night = nights.find((n) => n.date === date);

    const blocks = layoutDay(places, date);
    const plannedMin = blocks.reduce((a, b) => a + (b.fullDay ? 0 : b.duration), 0);
    const cities = Array.from(new Set(places.map((p) => p.city).filter(Boolean) as string[]));
    const cityFromJourney = journeys.map((j) => j.to_city).filter(Boolean)[0] ?? null;

    const issues: string[] = [];
    if (!places.length && !journeys.length) issues.push('kein Programm');
    if (quiet.has(date)) issues.push('freier Tag');
    if (!night?.covered && index < all.length - 1) issues.push('Nacht ohne Hotel');
    const noTime = places.filter((p) => !p.start_time && !p.time_slot).length;
    if (noTime) issues.push(`${noTime}× ohne Uhrzeit`);
    const noPrice = places.filter((p) => p.priority !== 'kann' && p.price_eur === null && !p.price_note).length;
    if (noPrice) issues.push(`${noPrice}× ohne Preis`);
    const open = places.filter((p) => p.booking_status === 'offen' && p.priority === 'muss').length;
    if (open) issues.push(`${open} Muss offen`);
    const tickets = places.filter((p) => p.ticket_status === 'noetig').length;
    if (tickets) issues.push(`${tickets} ${tickets === 1 ? 'Ticket' : 'Tickets'} offen`);
    const multi = places.filter((p) => p.end_date && p.date && p.end_date > p.date).length;
    if (multi) issues.push(`${multi}× mehrtägig`);

    return {
      date,
      index,
      weekday: weekdayShort(date),
      weekend: [0, 6].includes(new Date(`${date}T00:00:00`).getDay()),
      blocks,
      plannedMin,
      freeMin: Math.max(0, FULL_DAY_MIN - plannedMin),
      load: plannedMin / FULL_DAY_MIN,
      city: cities[0] ?? (hotel?.city ?? cityFromJourney),
      cities: Array.from(new Set([...cities, ...(hotel?.city ? [hotel.city] : []), ...(cityFromJourney ? [cityFromJourney] : [])])),
      hotel,
      nightGap: Boolean(night) && !night!.covered && index < all.length - 1,
      checkIn: bundle.hotels.some((h) => h.check_in === date),
      checkOut: bundle.hotels.some((h) => h.check_out === date),
      journeys,
      travelOnly: !places.length && journeys.some(isTravel),
      empty: !places.length,
      issues,
    };
  });
}

/**
 * Setzt die Orte eines Tages auf die 07–23-Achse: feste Uhrzeiten zuerst,
 * der Rest wird danach hintereinander gepackt (20 Min Wegezeit dazwischen).
 */
const daySpan = (from?: string | null, to?: string | null) =>
  from && to ? Math.max(1, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1) : 1;

export function layoutDay(places: Place[], date: string): Block[] {
  const withMin = places.map((p) => ({ p, at: timeToMin(p.start_time), slot: p.time_slot ? SLOT_START[p.time_slot] ?? null : null }));
  withMin.sort((a, b) => {
    const ka = a.at ?? a.slot ?? 9 * 60 + a.p.sort_order;
    const kb = b.at ?? b.slot ?? 9 * 60 + b.p.sort_order;
    return ka - kb || a.p.sort_order - b.p.sort_order;
  });

  let cursor = AXIS_START;
  const blocks: Block[] = [];
  for (const { p, at, slot } of withMin) {
    const spansDays = Boolean(p.end_date && p.date && p.end_date > p.date);
    const fullDay = p.time_slot === 'Ganzer Tag' || spansDays;
    const duration = fullDay ? AXIS_SPAN : p.duration_min ?? 60;
    let start: number;
    if (at !== null) start = at;
    else if (slot !== null) start = Math.max(slot, cursor);
    else start = Math.max(cursor, 9 * 60);
    start = clamp(start, AXIS_START, AXIS_END - 15);
    const end = fullDay ? AXIS_END : clamp(start + duration, start + 15, AXIS_END);
    const span = daySpan(p.date, p.end_date);
    const meta = categoryMeta(p.category);
    blocks.push({
      id: p.id,
      name: p.name,
      icon: meta.icon,
      color: meta.color,
      start,
      end,
      timed: at !== null,
      fullDay,
      span,
      duration: fullDay ? end - start : duration,
      price_eur: p.price_eur,
      booking_status: p.booking_status,
      priority: p.priority,
      city: p.city,
      date,
      travel_time: p.travel_time,
      place: p,
    });
    cursor = end + 20;
  }
  return blocks;
}

/* ------------------------------------------------------------------ Unterkünfte */

export interface Stay {
  city: string;
  hotel: string | null;
  from: string;
  to: string;
  nights: number;
  price_eur: number | null;
  perNight: number | null;
  booking_status: string;
  hotelId: string | null;
  /** wie viele dieser Nächte im Reisefenster liegen */
  inTrip: number;
}

/** Bett pro Abschnitt – aus den Unterkünften, notfalls aus dem Reiseverlauf abgeleitet */
export function staysOf(bundle: BundleLike): Stay[] {
  const withDates = bundle.hotels.filter((h) => h.check_in).sort((a, b) => (a.check_in! < b.check_in! ? -1 : 1));
  if (withDates.length) {
    return withDates.map((h) => {
      const to = h.check_out ?? addDays(h.check_in!, Math.max(1, h.nights ?? 1));
      const nights = Math.max(0, eachDate(h.check_in, to).length - 1) || h.nights || 0;
      return {
        city: h.city || '—',
        hotel: h.name,
        from: h.check_in!,
        to,
        nights,
        price_eur: h.price_total_eur,
        perNight: h.price_per_night_eur ?? (h.price_total_eur && nights ? Math.round((h.price_total_eur / nights) * 100) / 100 : null),
        booking_status: h.booking_status,
        hotelId: h.id,
        inTrip: nights,
      };
    });
  }
  // ohne Unterkünfte: aus den Etappen (Nächte + Hotelname) ableiten
  return bundle.journeys
    .filter((j) => j.date && (j.nights ?? 0) > 0)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .map((j) => ({
      city: j.to_city || '—',
      hotel: j.hotel_name,
      from: j.date!,
      to: addDays(j.date!, j.nights ?? 1),
      nights: j.nights ?? 0,
      price_eur: null,
      perNight: null,
      booking_status: 'offen',
      hotelId: null,
      inTrip: j.nights ?? 0,
    }));
}

/* ------------------------------------------------------------------ Baustellen */

export type Severity = 'ok' | 'warn' | 'bad';

export interface GapItem {
  key: string;
  icon: string;
  label: string;
  done: number;
  total: number;
  severity: Severity;
  href: string;
  hint: string;
  /** konkrete Beispiele zum Draufklicken – öffnen direkt das Formular */
  samples: Sample[];
}

export type Sample =
  | { kind: 'place'; label: string; id?: string; defaults?: Partial<Place> }
  | { kind: 'hotel'; label: string; id?: string; defaults?: Partial<Hotel> }
  | { kind: 'journey'; label: string; id: string };

const ratio = (done: number, total: number): Severity => (total === 0 ? 'ok' : done >= total ? 'ok' : done / total >= 0.6 ? 'warn' : 'bad');

/** Was vor der Reise noch fehlen würde – sortiert nach Dringlichkeit */
export function gapList(bundle: BundleLike): GapItem[] {
  const cells = dayCells(bundle);
  const dated = bundle.places.filter((p) => p.date);
  const pool = bundle.places.filter((p) => !p.date);
  const musts = bundle.places.filter((p) => p.priority === 'muss');
  const gaps = nightCoverage(bundle).filter((n) => !n.covered);
  const travelDays = new Set(cells.filter((c) => c.journeys.some(isTravel)).map((c) => c.date));
  const idleDays = cells.filter((c) => c.empty && !travelDays.has(c.date));
  const budget = bundle.trip?.budget_eur ?? null;

  const items: GapItem[] = [
    {
      key: 'nights',
      icon: '🏨',
      label: 'Nächte mit Unterkunft',
      done: Math.max(0, gaps.length ? nightCoverage(bundle).length - gaps.length : cells.length),
      total: gaps.length ? nightCoverage(bundle).length : Math.max(1, cells.length - 1),
      severity: gaps.length ? 'bad' : 'ok',
      href: '/unterkuenfte',
      hint: gaps.length ? `${gaps.length} Nächte noch ohne Bett` : 'Jede Nacht hat ein Quartier',
      samples: gaps.slice(0, 4).map((g) => ({
        kind: 'hotel' as const,
        label: `${weekdayShort(g.date)} ${g.date.slice(8)}.${g.date.slice(5, 7)}.`,
        defaults: { check_in: g.date },
      })),
    },
    {
      key: 'dates',
      icon: '🗓️',
      label: 'Wunsch-Punkte mit Tag',
      done: dated.length,
      total: bundle.places.length,
      severity: ratio(dated.length, bundle.places.length),
      href: '/aktivitaeten',
      hint: pool.length ? `${pool.length} stehen noch ohne Tag da` : 'Alles verplant',
      samples: pool.filter((p) => p.priority !== 'kann').slice(0, 4).map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'musts',
      icon: '★',
      label: 'Muss-Punkte mit Termin',
      done: musts.filter((p) => p.date).length,
      total: musts.length,
      severity: ratio(musts.filter((p) => p.date).length, musts.length),
      href: '/aktivitaeten',
      hint: musts.length ? `${musts.filter((p) => !p.date).length} Muss-Punkte ohne Tag` : 'Keine Muss-Punkte markiert',
      samples: musts.filter((p) => !p.date).slice(0, 4).map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'ticket',
      icon: '🎟️',
      label: 'Tickets besorgt',
      done: bundle.places.filter((p) => p.ticket_status === 'gekauft' || p.ticket_status === 'keins').length,
      total: bundle.places.length,
      severity: ratio(bundle.places.filter((p) => p.ticket_status === 'gekauft' || p.ticket_status === 'keins').length, bundle.places.length),
      href: '/tabelle',
      hint: `${bundle.places.filter((p) => p.ticket_status === 'noetig').length} noch zu kaufen · ${bundle.places.filter((p) => !p.ticket_status || p.ticket_status === 'unklar').length} ungeklärt`,
      samples: bundle.places.filter((p) => p.ticket_status === 'noetig').slice(0, 5).map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'booking',
      icon: '🎟️',
      label: 'Tickets & Slots gebucht',
      done: bundle.places.filter((p) => p.booking_status === 'gebucht' || p.booking_status === 'erledigt').length,
      total: bundle.places.length,
      severity: ratio(
        bundle.places.filter((p) => p.booking_status === 'gebucht' || p.booking_status === 'erledigt').length,
        bundle.places.length,
      ),
      href: '/tabelle',
      hint: `${bundle.places.filter((p) => p.booking_status === 'offen').length} offen, ${bundle.places.filter((p) => p.booking_status === 'reserviert').length} reserviert`,
      samples: musts
        .filter((p) => p.booking_status === 'offen')
        .slice(0, 4)
        .map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'time',
      icon: '⏱️',
      label: 'Uhrzeit & Dauer geplant',
      done: dated.filter((p) => p.start_time || p.time_slot).length,
      total: dated.length,
      severity: ratio(dated.filter((p) => p.start_time || p.time_slot).length, dated.length),
      href: '/tage',
      hint: `${dated.filter((p) => !p.start_time && !p.time_slot).length} Einträge ohne Zeitangabe`,
      samples: dated
        .filter((p) => !p.start_time && !p.time_slot)
        .slice(0, 4)
        .map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'price',
      icon: '💶',
      label: 'Preise geklärt',
      done: dated.filter((p) => p.price_eur !== null || p.price_note).length + bundle.hotels.filter((h) => h.price_total_eur !== null).length,
      total: dated.length + bundle.hotels.length,
      severity: ratio(
        dated.filter((p) => p.price_eur !== null || p.price_note).length + bundle.hotels.filter((h) => h.price_total_eur !== null).length,
        dated.length + bundle.hotels.length,
      ),
      href: '/kosten',
      hint: `${dated.filter((p) => p.price_eur === null && !p.price_note).length} Aktivitäten und ${bundle.hotels.filter((h) => h.price_total_eur === null).length} Unterkünfte ohne Betrag`,
      samples: dated
        .filter((p) => p.price_eur === null && !p.price_note && p.priority !== 'kann')
        .slice(0, 4)
        .map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'travel',
      icon: '🚶',
      label: 'Fahrzeit vom Hotel',
      done: dated.filter((p) => p.travel_time).length,
      total: dated.length,
      severity: ratio(dated.filter((p) => p.travel_time).length, dated.length),
      href: '/tabelle',
      hint: `${dated.filter((p) => !p.travel_time).length} Einträge ohne Angaben zur Anfahrt`,
      samples: dated
        .filter((p) => !p.travel_time)
        .slice(0, 4)
        .map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'geo',
      icon: '📍',
      label: 'Auf der Karte verortet',
      done: bundle.places.filter((p) => p.lat !== null && p.lng !== null).length,
      total: bundle.places.length,
      severity: ratio(bundle.places.filter((p) => p.lat !== null && p.lng !== null).length, bundle.places.length),
      href: '/karte',
      hint: `${bundle.places.filter((p) => p.lat === null || p.lng === null).length} ohne Koordinaten`,
      samples: bundle.places
        .filter((p) => p.lat === null || p.lng === null)
        .slice(0, 4)
        .map((p) => ({ kind: 'place' as const, id: p.id, label: p.name })),
    },
    {
      key: 'journeys',
      icon: '🚄',
      label: 'Fahrten mit Uhrzeit',
      done: bundle.journeys.filter((j) => j.departure_time).length,
      total: bundle.journeys.length,
      severity: ratio(bundle.journeys.filter((j) => j.departure_time).length, bundle.journeys.length),
      href: '/verlauf',
      hint: `${bundle.journeys.filter((j) => !j.departure_time).length} Fahrten ohne Abfahrtszeit`,
      samples: bundle.journeys
        .filter((j) => !j.departure_time)
        .slice(0, 4)
        .map((j) => ({ kind: 'journey' as const, id: j.id, label: j.title })),
    },
    {
      key: 'idle',
      icon: '🫥',
      label: 'Tage mit Programm',
      done: cells.length - idleDays.length,
      total: cells.length,
      severity: idleDays.length > 2 ? 'warn' : idleDays.length ? 'ok' : 'ok',
      href: '/tage',
      hint: idleDays.length ? `${idleDays.length} Tage komplett leer` : 'Kein leerer Tag',
      samples: idleDays.slice(0, 4).map((c) => ({ kind: 'place' as const, label: `${weekdayShort(c.date)} ${c.date.slice(8)}.${c.date.slice(5, 7)}.`, defaults: { date: c.date } })),
    },
  ];

  if (budget !== null) {
    const total = bundle.hotels.reduce((a, h) => a + (h.price_total_eur ?? 0), 0) + bundle.journeys.reduce((a, j) => a + (j.price_eur ?? 0), 0) + bundle.places.reduce((a, p) => a + (p.price_eur ?? 0), 0) + bundle.expenses.reduce((a, e) => a + (e.amount_eur ?? 0), 0);
    items.push({
      key: 'budget',
      icon: '💸',
      label: 'Im Budget',
      done: total <= budget ? 1 : 0,
      total: 1,
      severity: total <= budget ? 'ok' : 'bad',
      href: '/kosten',
      hint: total <= budget ? `${Math.round((1 - total / budget) * 100)} % Budget frei` : `${Math.round(total - budget)} € über Budget`,
      samples: [],
    });
  }

  return items.filter((i) => i.total > 0).sort((a, b) => rank(a.severity) - rank(b.severity) || b.total - b.done - (a.total - a.done));
}

const rank = (s: Severity) => (s === 'bad' ? 0 : s === 'warn' ? 1 : 2);

/* ------------------------------------------------------------------ Kapazität */

export interface Capacity {
  /** Tage, an denen noch ein halber Tag frei wäre */
  openDays: { date: string; freeMin: number; city: string | null }[];
  totalFreeMin: number;
  /** Ø Programmzeit pro Tag */
  avgDayMin: number;
  fullestDay: DayCell | null;
  emptiestDay: DayCell | null;
}

export function capacity(cells: DayCell[]): Capacity {
  const usable = cells.filter((c) => !c.checkIn && !c.travelOnly);
  const openDays = usable
    .filter((c) => c.load < 0.75)
    .map((c) => ({ date: c.date, freeMin: c.freeMin, city: c.city }))
    .sort((a, b) => b.freeMin - a.freeMin);
  const totalFreeMin = usable.reduce((a, c) => a + c.freeMin, 0);
  const withPlan = usable.filter((c) => c.plannedMin > 0);
  return {
    openDays,
    totalFreeMin,
    avgDayMin: withPlan.length ? Math.round(withPlan.reduce((a, c) => a + c.plannedMin, 0) / withPlan.length) : 0,
    fullestDay: usable.slice().sort((a, b) => b.plannedMin - a.plannedMin)[0] ?? null,
    emptiestDay: usable.slice().sort((a, b) => a.plannedMin - b.plannedMin)[0] ?? null,
  };
}

/** Vorschlag: welcher Tag passt zu einem Pool-Eintrag? (gleiche Stadt, meiste freie Zeit) */
export function bestDaysFor(pool: Place, cells: DayCell[], limit = 3): { date: string; freeMin: number; city: string | null }[] {
  const key = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const cityKey = key(pool.city);
  const sameCity = cells.filter((c) => c.city && key(c.city) === cityKey);
  const base = (sameCity.length ? sameCity : cells).filter((c) => !c.checkIn && !c.checkOut);
  const scored = base.map((c) => ({ date: c.date, freeMin: c.freeMin, city: c.city, bonus: c.empty ? 20 : 0, load: c.load }));
  return scored
    .sort((a, b) => b.freeMin + b.bonus - (a.freeMin + a.bonus))
    .slice(0, limit)
    .map(({ date, freeMin, city }) => ({ date, freeMin, city }));
}

/** pro Stadt: Tage & Nächte vs. geplante Punkte → wo ist noch Luft */
export interface CityLoad {
  city: string;
  /** Nächte laut Unterkunft (0 = Stadt hat kein Bett) */
  nights: number;
  /** Tage, an denen dort etwas geplant ist */
  days: number;
  places: number;
  pool: number;
  perDay: number;
  cost: number;
  hotel: string | null;
  noHotel: boolean;
  /** < 1,6 Punkte pro Tag = noch Luft · > 3,5 = Hetz-Programm */
  fit: 'loose' | 'ok' | 'tight';
}

export function cityLoad(bundle: BundleLike): CityLoad[] {
  const stays = staysOf(bundle);
  const key = (s: string | null | undefined) => (s ?? '').trim() || '—';
  const byCity = new Map<string, CityLoad>();
  const touch = (city: string | null | undefined): CityLoad => {
    const k = key(city);
    const cur =
      byCity.get(k) ??
      { city: k, nights: 0, days: 0, places: 0, pool: 0, perDay: 0, cost: 0, hotel: null, noHotel: false, fit: 'ok' as const };
    if (!byCity.has(k)) byCity.set(k, cur);
    return cur;
  };

  for (const s of stays) {
    const cur = touch(s.city);
    cur.nights += s.nights;
    cur.cost += s.price_eur ?? 0;
    cur.hotel = cur.hotel ?? s.hotel;
  }
  const daysByCity = new Map<string, Set<string>>();
  for (const p of bundle.places) {
    const cur = touch(p.city);
    cur.places += 1;
    if (!p.date) {
      cur.pool += 1;
      continue;
    }
    const set = daysByCity.get(cur.city) ?? new Set<string>();
    set.add(p.date);
    daysByCity.set(cur.city, set);
  }

  return Array.from(byCity.values())
    .map((c) => {
      const days = Math.max(1, daysByCity.get(c.city)?.size ?? 0, c.nights);
      const perDay = Math.round((c.places / days) * 10) / 10;
      return {
        ...c,
        days,
        perDay,
        noHotel: c.nights === 0,
        fit: perDay < 1.6 ? ('loose' as const) : perDay > 3.5 ? ('tight' as const) : ('ok' as const),
      };
    })
    .sort((a, b) => b.places - a.places);
}

export function loadTone(load: number): string {
  if (load > 1.05) return 'bg-shu-500';
  if (load > 0.85) return 'bg-amber-400/80';
  if (load > 0.35) return 'bg-matcha-500/80';
  if (load > 0) return 'bg-sky-400/70';
  return 'bg-white/10';
}
