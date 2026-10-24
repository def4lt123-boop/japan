const DE = 'de-DE';

/**
 * Ein Tag, geschrieben wie er gemeint ist – ohne Zeitzonen-Sprung.
 * `toISOString()` schiebt Mitternacht in UTC und verliert damit in Europa jeden Tag
 * einen Tag; alle Rechenwege hier arbeiten deshalb lokal.
 */
export function isoOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** JJJJ-MM-TT (oder ein Datumsstempel davor) als lokaler Mitternachtsmoment */
export function dayStart(iso?: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (!iso) return '—';
  const d = new Date(`${iso.length === 10 ? iso + 'T00:00:00' : iso}`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DE, opts);
}

/**
 * Das Datum, wie es in Listen steht: `Sa 24.10.` – kurz, gleiche Breite, kein JJJJ.
 * Ausgeschrieben (`Samstag, 24. Oktober`) nur wo ein Satz oder eine Überschrift steht.
 */
export function fmtDay(iso?: string | null): string {
  if (!iso) return '—';
  // Intl hängt an das abgekürzte Wochentagwort Punkt und Komma („Sa., 06.03.“) –
  // in einer Liste soll `Sa 06.03.` stehen, also wird es aus den Stücken gesetzt.
  return `${weekdayShort(iso)} ${fmtDate(iso, { day: '2-digit', month: '2-digit' })}`;
}

/** wie fmtDay, aber ausgeschrieben – für Überschriften und den Satz davor */
export function fmtDayLong(iso?: string | null): string {
  if (!iso) return '—';
  return fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(DE, { weekday: 'short' });
}

export function fmtRange(from?: string | null, to?: string | null): string {
  if (!from && !to) return 'ohne Termine';
  return `${fmtDate(from, { day: '2-digit', month: '2-digit', year: 'numeric' })} – ${fmtDate(to, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

export function daysBetween(from?: string | null, to?: string | null): number {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export function eachDate(from?: string | null, to?: string | null): string[] {
  const start = dayStart(from);
  const end = dayStart(to);
  if (!start || !end || !from || !to || end < start) return [];
  const out: string[] = [];
  for (let d = new Date(start), i = 0; d <= end && i < 400; d.setDate(d.getDate() + 1), i++) {
    out.push(isoOf(d));
  }
  return out;
}

export function today(): string {
  return isoOf(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = dayStart(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

export function fmtMoney(value?: number | null, currency: 'EUR' | 'JPY' = 'EUR'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(DE, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'EUR' ? 2 : 0,
    minimumFractionDigits: currency === 'EUR' ? 2 : 0,
  }).format(value);
}

export function fmtDuration(min?: number | null): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—';
  if (min < 60) return `${Math.round(min)} Min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} Min` : `${h} h`;
}

export function parseDuration(input?: string | null): number | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  // Unterstützt "2h", "1:30h", "90 min", "1,5 std", "2 h 15", "3h15"
  const colon = s.match(/^(\d{1,2})[:.,](\d{1,2})\s*(h|std)?/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const hours = s.match(/(\d+(?:[.,]\d+)?)\s*(h|std|stunden|hour)/);
  const mins = s.match(/(\d+)\s*(min|m\b|minute)/);
  if (hours && mins) return Math.round(Number(hours[1].replace(',', '.')) * 60) + Number(mins[1]);
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60);
  if (mins) return Number(mins[1]);
  const plain = Number(s.replace(',', '.'));
  return Number.isFinite(plain) && plain > 0 ? Math.round(plain * 60) : null; // ohne Einheit = Stunden
}

export function num(v: string): number | null {
  const t = v.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Eine Stadt, die man nicht kennt, soll nicht als „Unbekannt“ im Weg stehen –
 * leer heißt hier: noch nicht eingetragen, also nichts anzeigen (oder den Hinweis).
 */
export function knownCity(city?: string | null): string | null {
  const c = properName(city);
  return !c || c.toLowerCase() === 'unbekannt' ? null : c;
}

/**
 * Städte- und Unterkunftsnamen in Reinschrift: außen Leerzeichen weg, innen eines,
 * jeder Wortanfang groß. Alles, was schon groß oder in Großbuchstaben dasteht
 * (JR, TDR, Osaka-jo), bleibt wie es ist – normalisieren soll nicht verschlimmern.
 */
export function properName(raw?: string | null): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const klein = new Set(['am', 'an', 'auf', 'aus', 'bei', 'im', 'in', 'mit', 'nach', 'sur', 'und', 'van', 'von', 'der', 'den', 'die', 'de', 'du', 'la', 'le']);
  return t
    .split(' ')
    .map((wort, i) => {
      const buch = /[A-Za-zÀ-ÖØ-Þß-ÿ]/.test(wort);
      if (!buch) return wort;
      if (wort === wort.toUpperCase() && wort.replace(/[^A-Za-z]/g, '').length <= 4) return wort; // Abkürzungen
      if (wort !== wort.toLowerCase() && /[A-Z]/.test(wort.slice(1))) return wort; // schreibt selbst gemischt
      if (i > 0 && klein.has(wort.toLowerCase())) return wort.toLowerCase();
      return wort[0].toUpperCase() + wort.slice(1);
    })
    .join(' ');
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function uid(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${rnd}`;
}
