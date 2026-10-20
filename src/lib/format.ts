const DE = 'de-DE';

export function fmtDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (!iso) return '—';
  const d = new Date(`${iso.length === 10 ? iso + 'T00:00:00' : iso}`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DE, opts);
}

export function fmtDateLong(iso?: string | null): string {
  return fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
  if (!from || !to) return [];
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return out;
  for (let d = new Date(start), i = 0; d <= end && i < 400; d.setDate(d.getDate() + 1), i++) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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
