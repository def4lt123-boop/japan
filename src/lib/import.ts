/**
 * Import – der Weg zurück in die App. Was als CSV-Export rausgeht, kann wieder rein:
 * Semikolon oder Komma, Tabeller-Trennung, deutsche Zahlen, Spalten in jeder Reihenfolge.
 * Auch eine Zeile pro Punkt (aus Notizen oder dem Messenger) reicht – und der eigenen
 * JSON-Sicherung. Angelegt wird erst nach dem Klick auf „einfügen", Duplikate bleiben draußen.
 */
import { CATEGORY_LABELS, guessCategory } from './categories';
import { parseDuration, uid } from './format';
import type { BookingStatus, Hotel, Journey, Place, Priority, TicketStatus, Trip } from './types';

export type ImportTarget = 'places' | 'hotels' | 'journeys';

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  separated: ';' | ',' | '\t' | 'zeile';
  json: boolean;
}

export interface ImportRow {
  index: number;
  label: string;
  sub: string;
  status: 'neu' | 'duplikat' | 'ohne namen';
  note: string | null;
  value: Place | Hotel | Journey;
}

export interface ImportPlan {
  target: ImportTarget;
  rows: ImportRow[];
  fresh: (Place | Hotel | Journey)[];
  problems: string[];
  columns: string[];
  total: number;
}

export const EXPORT_HINT: Record<ImportTarget, string> = {
  places: 'Aktivität · Stadt · Hinweise · Preis EUR …',
  hotels: 'Unterkunft · Check-in · Check-out · Preis EUR …',
  journeys: 'Fahrt · Von · Nach · Abflug · Preis EUR …',
};

/* ── Spaltennamen ─────────────────────────────────────────────────────────── */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

/** Alias-Listen je Zieltabelle – erste Treffer zählt */
const FIELDS: Record<ImportTarget, Record<string, string[]>> = {
  places: {
    name: ['aktivität', 'aktivitat', 'name', 'punkt', 'standort', 'titel'],
    date: ['datum', 'date', 'tag'],
    city: ['stadt', 'ort', 'city'],
    category: ['kategorie', 'category', 'art', 'typ'],
    notes: ['hinweise', 'hinweis', 'notizen', 'notiz', 'nachrichten', 'kommentar', 'bemerkungen', 'notes'],
    price_eur: ['preisureur', 'preis', 'kosten', 'priceeur', 'price'],
    price_note: ['preishinweis', 'preisnotiz', 'pricenote'],
    booking_status: ['status', 'buchungsstatus', 'bookingstatus'],
    booking_url: ['link', 'buchung', 'buchungslink'],
    priority: ['prio', 'priorität', 'prioritat', 'priority'],
    ticket_status: ['ticket', 'ticketstatus'],
    ticket_note: ['ticketnotiz', 'ticketnote'],
    sort_order: ['reihe', 'reiheetag', 'reiheamtag', 'sortorder', 'nr', 'nummer'],
    maps_query: ['googlemaps', 'maps', 'mapslink', 'suchbegriff', 'searchquery'],
    end_date: ['bis', 'enddatum', 'enddate', 'bisdatum'],
    start_time: ['uhrzeit', 'zeit', 'starttime'],
    duration_min: ['dauer', 'minuten', 'durationmin'],
    time_slot: ['tageszeit', 'zeitfenster', 'timeslot'],
    travel_time: ['fahrzeit', 'fahrtzeit', 'traveltime'],
    district: ['viertel', 'stadtteil', 'district'],
    image_url: ['bild', 'foto', 'image', 'imageurl'],
    lat: ['lat', 'breite', 'latitude'],
    lng: ['lng', 'laenge', 'longitude', 'länge'],
  },
  hotels: {
    name: ['unterkunft', 'hotel', 'name'],
    city: ['stadt', 'ort', 'city'],
    check_in: ['checkin', 'anreise', 'von', 'start'],
    check_out: ['checkout', 'abreise', 'bis', 'ende'],
    nights: ['nachte', 'nächte', 'nights'],
    price_total_eur: ['preisureur', 'preis', 'gesamt', 'totaleur'],
    price_per_night_eur: ['eurnacht', 'pronacht', 'preispro nacht'],
    booking_status: ['status', 'buchungsstatus'],
    booking_url: ['link', 'buchung', 'buchungslink'],
    address: ['adresse', 'address', 'anschrift'],
    lat: ['lat', 'breite', 'latitude'],
    lng: ['lng', 'laenge', 'longitude', 'länge'],
    notes: ['hinweise', 'notizen', 'notiz', 'comments'],
  },
  journeys: {
    title: ['fahrt', 'titel', 'name', 'strecke'],
    date: ['datum', 'date', 'tag'],
    from_city: ['von', 'ab', 'abfahrtsort', 'from'],
    to_city: ['nach', 'ankunftsort', 'zu', 'to'],
    mode: ['art', 'verkehrsmittel', 'modus', 'mode'],
    departure_time: ['abflug', 'zeit', 'abfahrtszeit', 'uhrzeit', 'departure'],
    duration_min: ['dauer', 'fahrdauer', 'duration'],
    price_eur: ['preisureur', 'preis', 'kosten', 'jrpass'],
    hotel_name: ['hotel', 'unterkunft'],
    nights: ['nachte', 'nächte'],
    booking_status: ['status', 'buchungsstatus'],
    notes: ['hinweise', 'notizen', 'kommentar', 'reservierung'],
  },
};

/* ── Text → Tabelle ───────────────────────────────────────────────────────── */

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** JSON von uns (Sicherung) → dieselbe Tabellenform wie CSV */
function fromJson(text: string, target: ImportTarget): ParsedTable | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const list = (Array.isArray(data) ? data : (data?.[target] as unknown[])) ?? null;
    if (!Array.isArray(list) || !list.length) return null;
    const keys: string[] = [];
    for (const row of list.slice(0, 40)) {
      if (row && typeof row === 'object') for (const k of Object.keys(row as object)) if (!keys.includes(k)) keys.push(k);
    }
    const rows = list.map((row) =>
      keys.map((k) => {
        const v = (row as Record<string, unknown>)?.[k];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
      }),
    );
    return { headers: keys, rows, separated: ',', json: true };
  } catch {
    return null;
  }
}

export function parseTable(text: string, target: ImportTarget = 'places'): ParsedTable {
  const raw = text.replace(/\r\n?/g, '\n').trim();
  if (raw.startsWith('{') || raw.startsWith('[')) {
    const via = fromJson(raw, target);
    if (via) return via;
  }
  const lines = raw.split('\n').filter((l) => l.trim().length);
  const head = lines[0] ?? '';
  const counts: [string, number][] = [';', ',', '\t'].map((sep) => [sep, (head.match(new RegExp(sep === '\t' ? '\\t' : sep === ';' ? ';' : ',', 'g')) ?? []).length]);
  const best = counts.sort((a, b) => b[1] - a[1])[0];
  if (!lines.length) return { headers: [], rows: [], separated: 'zeile', json: false };
  // Kopfzeile erkannt? sonst ist jede Zeile ein Eintrag
  const headerish = best[1] > 0 && lines.length > 1 && fieldsOf(head.split(best[0]), target).some(Boolean);
  if (!headerish && best[1] === 0) return { headers: ['_zeile_'], rows: lines.map((l) => [l.trim()]), separated: 'zeile', json: false };
  const headers = lines[0].split(best[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map((l) => splitLine(l, best[0]));
  return { headers, rows, separated: best[0] as ParsedTable['separated'], json: false };
}

/** which column (if any) maps to which field – Aliasliste wird genauso genormt wie die Kopfzeile */
function fieldsOf(headers: string[], target: ImportTarget): (string | null)[] {
  const alias = Object.entries(FIELDS[target]).map(([field, names]) => [field, names.map(norm)] as const);
  return headers.map((h) => {
    const key = norm(h);
    if (!key) return null;
    for (const [field, names] of alias) if (names.includes(key)) return field;
    for (const [field, names] of alias) if (names.some((n) => n.length > 3 && (key.startsWith(n) || key.endsWith(n)))) return field;
    return null;
  });
}

/* ── Werte ────────────────────────────────────────────────────────────────── */

const STATUSES: BookingStatus[] = ['offen', 'reserviert', 'gebucht', 'erledigt'];
const PRIOS: Priority[] = ['muss', 'soll', 'kann'];
const TICKETS: TicketStatus[] = ['unklar', 'noetig', 'gekauft', 'keins'];

const pick = <T extends string>(value: string, allowed: T[], fallback: T): T => {
  const key = norm(value);
  if (!key) return fallback;
  return allowed.find((a) => norm(a) === key) ?? allowed.find((a) => key.includes(norm(a)) || norm(a).includes(key)) ?? fallback;
};

function money(value: string): number | null {
  const s = value.replace(/[^\d,.-]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const comma = s.includes(',') && (!s.includes('.') || s.lastIndexOf(',') > s.lastIndexOf('.'));
  const n = Number(comma ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, s.split('.').length > 2 ? '' : '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** TT.MM. / TT.MM.JJJJ / JJJJ-MM-TT / 2027-04-12 → ISO; ohne Jahr das Reisejahr */
function isoDate(value: string, trip?: Trip): { date: string | null; note: string | null } {
  const s = (value ?? '').trim();
  if (!s) return { date: null, note: null };
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return { date: s.slice(0, 10), note: null };
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/);
  if (!m) return { date: null, note: `„${s}“ ist kein Datum – Tag bleibt leer` };
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(trip?.start_date?.slice(0, 4) ?? new Date().getFullYear());
  if (month < 1 || month > 12 || day < 1 || day > 31) return { date: null, note: `„${s}“ ist kein Datum – Tag bleibt leer` };
  const iso = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!m[3]) {
    // „12.04." bei einer Reise ab 24.10. – genommen wird das Jahr, das dem Zeitraum
    // am nächsten liegt (im Zweifel das darauffolgende), damit ein Tag nicht springt
    const from = trip?.start_date ?? iso(year);
    const to = trip?.end_date ?? from;
    const distance = (d: string) => Math.abs(new Date(`${d}T00:00:00`).getTime() - new Date(`${d < from ? from : d > to ? to : d}T00:00:00`).getTime());
    const options = [year - 1, year, year + 1].filter((y) => y > 1990 && y < 2100);
    const best = options.map((y) => ({ y, d: distance(iso(y)) })).sort((a, b) => a.d - b.d || Math.abs(a.y - year) - Math.abs(b.y - year))[0];
    year = best.y;
  }
  return { date: iso(year), note: null };
}

const time = (value: string): string | null => {
  const m = (value ?? '').match(/(\d{1,2})[:.h](\d{2})/) ?? (value ?? '').match(/^(\d{1,2})\s?(?:uhr|clock)?$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/** „2 h 15" / „95 min" / „1:35" → Minuten */
const minutes = (value: string): number | null => {
  const s = (value ?? '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  return parseDuration(s);
};

/** Maps-Link → der Suchbegriff dahinter (unsere Spalte heißt so) */
function queryFromLink(value: string): string | null {
  const s = (value ?? '').trim();
  if (!s) return null;
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`);
    const q = url.searchParams.get('query') ?? url.searchParams.get('q') ?? url.searchParams.get('destination');
    if (q) return decodeURIComponent(q.replace(/\+/g, ' '));
  } catch {
    /* keine URL – dann ist der Text selbst der Suchbegriff */
  }
  return s.startsWith('http') ? null : s;
}

/** Spalten, die sich aus anderem ergeben – weglassen, ohne zu meckern */
const IGNORED = new Set(['wochentag', 'tagderwoche', 'id', 'tripid', 'createdat', 'updatedat', 'slug', 'status2']);

/** Nachkommakomma oder Punkt – ein Kartenpunkt ist eine Zahl zwischen -90/180 und 90/180 */
function coord(value: string, axis: 'lat' | 'lng'): number | null {
  const n = Number((value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const lim = axis === 'lat' ? 90 : 180;
  return Math.abs(n) <= lim ? Math.round(n * 1e6) / 1e6 : null;
}

const outOfRange = (iso: string | null, trip?: Trip): string | null => {
  if (!iso || !trip?.start_date || !trip?.end_date) return null;
  if (iso > trip.end_date) return `${iso.slice(8, 10)}.${iso.slice(5, 7)}. liegt nach dem Reiseende`;
  if (iso < trip.start_date) return `${iso.slice(8, 10)}.${iso.slice(5, 7)}. liegt vor dem Reisebeginn`;
  return null;
};

const knownCategory = (value: string): string | null => {
  const key = norm(value);
  if (!key) return null;
  return CATEGORY_LABELS.find((c) => norm(c) === key) ?? CATEGORY_LABELS.find((c) => key.includes(norm(c))) ?? null;
};

/* ── der Plan ─────────────────────────────────────────────────────────────── */

export interface ImportContext {
  tripId: string;
  trip?: Trip;
  places: Place[];
  hotels: Hotel[];
  journeys: Journey[];
}

const blankPlace = (tripId: string): Place => ({
  id: '',
  trip_id: tripId,
  name: '',
  city: '',
  district: null,
  category: null,
  date: null,
  end_date: null,
  time_slot: null,
  start_time: null,
  duration_min: null,
  travel_time: null,
  notes: null,
  price_eur: null,
  price_note: null,
  booking_status: 'offen',
  booking_url: null,
  ticket_status: 'unklar',
  ticket_note: null,
  priority: 'soll',
  maps_query: null,
  lat: null,
  lng: null,
  image_url: null,
  sort_order: 0,
});

const blankHotel = (tripId: string): Hotel => ({
  id: '',
  trip_id: tripId,
  name: '',
  city: '',
  check_in: null,
  check_out: null,
  nights: null,
  price_total_eur: null,
  price_per_night_eur: null,
  address: null,
  lat: null,
  lng: null,
  booking_url: null,
  booking_status: 'offen',
  notes: null,
});

const blankJourney = (tripId: string): Journey => ({
  id: '',
  trip_id: tripId,
  date: null,
  end_date: null,
  title: '',
  from_city: null,
  to_city: null,
  mode: null,
  departure_time: null,
  duration_min: null,
  price_eur: null,
  hotel_name: null,
  nights: null,
  booking_status: 'offen',
  notes: null,
});

/** der Eintrag, wie er schon da ist – für „ist bereits drin" */
function alreadyThere(target: ImportTarget, ctx: ImportContext, name: string, date: string | null, city: string) {
  const key = norm(name);
  if (!key) return false;
  if (target === 'places') return ctx.places.some((p) => norm(p.name) === key && (p.date ?? null) === date && (!p.city || !city || norm(p.city) === norm(city)));
  if (target === 'hotels') return ctx.hotels.some((h) => norm(h.name) === key && (h.check_in ?? null) === date);
  return ctx.journeys.some((j) => norm(j.title) === key && (j.date ?? null) === date);
}

export function planImport(text: string, target: ImportTarget, ctx: ImportContext): ImportPlan {
  const problems: string[] = [];
  const table = parseTable(text, target);
  if (!table.rows.length) {
    return { target, rows: [], fresh: [], problems: ['Es ist nichts zu lesen – eine Zeile mit Spaltennamen und darunter die Einträge, oder einfach ein Name pro Zeile.'], columns: [], total: 0 };
  }
  const fields = table.headers.includes('_zeile_') ? ['_zeile_'] : fieldsOf(table.headers, target);
  const named = fields.filter((f) => f && f !== '_zeile_').length;
  if (fields.some((f) => f === null)) {
    const unknown = table.headers.filter((h, i) => fields[i] === null && h.trim() && !IGNORED.has(norm(h)));
    if (unknown.length) problems.push(`Spalten ohne Zuordnung (bleiben ungenutzt): ${unknown.join(', ')}`);
  }
  if (target === 'places' && !named) problems.push('Keine Spalte erkannt – jede Zeile wird als ein Punkt genommen.');

  const nextOrder = new Map<string, number>();
  for (const p of ctx.places) {
    if (!p.date) continue;
    const seen = nextOrder.get(p.date) ?? 0;
    nextOrder.set(p.date, Math.max(seen, (p.sort_order ?? 0) + 1));
  }

  const rows: ImportRow[] = table.rows.map((cells, i) => {
    const get = (field: string) => {
      const idx = fields.indexOf(field);
      return idx >= 0 ? (cells[idx] ?? '').trim() : '';
    };
    const raw = table.headers.includes('_zeile_') ? (cells[0] ?? '') : null;
    let note: string | null = null;

    if (target === 'places') {
      const value = blankPlace(ctx.tripId);
      let line = raw;
      let dateRaw = get('date');
      let nameRaw = get('name');
      if (line !== null) {
        const m = line.match(/^(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)[.]?\s*[-–:]?\s*(.+)$/);
        if (m) {
          dateRaw = m[1];
          nameRaw = m[2];
        } else nameRaw = line;
        const rest = nameRaw.split(/\s{2,}|;|\t|\s+[–—-]\s+/);
        if (rest.length > 1) {
          nameRaw = rest[0];
          const tail = rest.slice(1).join(' · ');
          if (tail && !value.notes) value.notes = tail;
        }
      }
      value.name = nameRaw;
      value.city = get('city');
      const d = isoDate(dateRaw, ctx.trip);
      value.date = d.date;
      note = d.note;
      const range = outOfRange(value.date, ctx.trip);
      if (range) note = note ? `${note} – ${range}` : range;
      value.end_date = isoDate(get('end_date'), ctx.trip).date;
      value.notes = (value.notes as string | null) || get('notes') || null;
      const cat = knownCategory(get('category'));
      value.category = cat ?? guessCategory({ name: value.name, notes: value.notes, city: value.city });
      value.price_eur = money(get('price_eur'));
      value.price_note = get('price_note') || null;
      value.booking_status = pick(get('booking_status'), STATUSES, 'offen');
      value.priority = pick(get('priority'), PRIOS, 'soll');
      value.ticket_status = pick(get('ticket_status'), TICKETS, 'unklar');
      value.ticket_note = get('ticket_note') || null;
      value.start_time = time(get('start_time'));
      value.duration_min = minutes(get('duration_min'));
      value.time_slot = get('time_slot') || null;
      value.travel_time = get('travel_time') || null;
      value.district = get('district') || null;
      value.image_url = get('image_url') || null;
      value.lat = coord(get('lat'), 'lat');
      value.lng = coord(get('lng'), 'lng');
      value.maps_query = queryFromLink(get('maps_query')) || (value.name && value.city ? `${value.name} ${value.city}` : value.name || null);
      value.booking_url = get('booking_url') || (/^https?:/.test(get('maps_query')) ? get('maps_query') : null);
      const orderRaw = Number(get('sort_order'));
      const day = value.date ?? '_pool_';
      if (Number.isFinite(orderRaw) && orderRaw > 0) {
        value.sort_order = orderRaw - 1;
        nextOrder.set(day, Math.max(nextOrder.get(day) ?? 0, orderRaw));
      } else {
        value.sort_order = nextOrder.get(day) ?? 0;
        nextOrder.set(day, (nextOrder.get(day) ?? 0) + 1);
      }
      const duplikat = alreadyThere('places', ctx, value.name, value.date, value.city);
      return {
        index: i,
        label: value.name || '—',
        sub: [value.date ? value.date.slice(8, 10) + '.' + value.date.slice(5, 7) + '.' : 'ohne Tag', value.city, cat ? 'Kategorie ' + cat : null].filter(Boolean).join(' · '),
        status: !value.name ? 'ohne namen' : duplikat ? 'duplikat' : 'neu',
        note,
        value,
      };
    }

    if (target === 'hotels') {
      const value = blankHotel(ctx.tripId);
      value.name = raw ?? get('name');
      value.city = get('city');
      value.check_in = isoDate(get('check_in'), ctx.trip).date;
      value.check_out = isoDate(get('check_out'), ctx.trip).date;
      const n = Number(get('nights'));
      value.nights = Number.isFinite(n) && n > 0 ? n : null;
      value.price_total_eur = money(get('price_total_eur'));
      value.price_per_night_eur = money(get('price_per_night_eur'));
      value.booking_status = pick(get('booking_status'), STATUSES, 'offen');
      value.booking_url = get('booking_url') || null;
      value.address = get('address') || null;
      value.lat = coord(get('lat'), 'lat');
      value.lng = coord(get('lng'), 'lng');
      value.notes = get('notes') || null;
      if (!value.nights && value.check_in && value.check_out) {
        const between = Math.round((new Date(`${value.check_out}T00:00:00`).getTime() - new Date(`${value.check_in}T00:00:00`).getTime()) / 86400000);
        if (between > 0) value.nights = between;
      }
      const duplikat = alreadyThere('hotels', ctx, value.name, value.check_in, value.city);
      const span = value.check_in && value.check_out ? `${value.check_in.slice(8, 10)}.${value.check_in.slice(5, 7)}. – ${value.check_out.slice(8, 10)}.${value.check_out.slice(5, 7)}.` : value.check_in ? 'nur Anreise' : 'ohne Nächte';
      return { index: i, label: value.name || '—', sub: [value.city, span, value.nights ? `${value.nights} Nächte` : null].filter(Boolean).join(' · '), status: !value.name ? 'ohne namen' : duplikat ? 'duplikat' : 'neu', note: outOfRange(value.check_in, ctx.trip), value };
    }

    const value = blankJourney(ctx.tripId);
    value.title = raw ?? get('title');
    value.date = isoDate(get('date'), ctx.trip).date;
    value.from_city = get('from_city') || null;
    value.to_city = get('to_city') || null;
    value.mode = get('mode') || null;
    value.departure_time = time(get('departure_time'));
    value.duration_min = minutes(get('duration_min'));
    value.price_eur = money(get('price_eur'));
    value.hotel_name = get('hotel_name') || null;
    const n = Number(get('nights'));
    value.nights = Number.isFinite(n) && n > 0 ? n : null;
    value.booking_status = pick(get('booking_status'), STATUSES, 'offen');
    value.notes = get('notes') || null;
    if (!value.title && value.from_city) value.title = `${value.from_city} → ${value.to_city ?? ''}`.trim();
    const duplikat = alreadyThere('journeys', ctx, value.title, value.date, '');
    return {
      index: i,
      label: value.title || '—',
      sub: [value.date ? `${value.date.slice(8, 10)}.${value.date.slice(5, 7)}.` : 'ohne Datum', [value.from_city, value.to_city].filter(Boolean).join(' → '), value.departure_time, value.mode].filter(Boolean).join(' · '),
      status: !value.title ? 'ohne namen' : duplikat ? 'duplikat' : 'neu',
      note: outOfRange(value.date, ctx.trip),
      value,
    };
  });

  const fresh = rows.filter((r) => r.status === 'neu').map((r) => r.value);
  if (!fresh.length && rows.length) {
    if (rows.some((r) => r.status === 'ohne namen')) problems.push('Ohne Namen ist nichts anzufangen – die Spalte „Aktivität“ (bzw. „Unterkunft“ / „Fahrt“) wurde nicht gefunden.');
    else if (rows.some((r) => r.status === 'duplikat')) problems.push('Alles davon steht schon in der Reise – Duplikate werden übersprungen.');
  }
  return {
    target,
    rows,
    fresh: fresh.map((v) => ({ ...v, id: uid(target.slice(0, 2)) } as Place | Hotel | Journey)),
    problems,
    columns: table.headers.filter((h) => h && h !== '_zeile_'),
    total: rows.length,
  };
}

