/** Kleine Helfer für alles, was auf dem Bildschirm steht. */

export function uid(prefix = 'e'): string {
  const zufall = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36).slice(-5)}${zufall}`;
}

/**
 * Eine gradzahl zum Lesen: fünf stellen, komma statt punkt, nullen am ende weg.
 * Das feld „Punkt“ zeigt damit, was es verstanden hat – mehr braucht niemand.
 */
export function gradText(wert: number | null | undefined): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '';
  return wert.toFixed(5).replace('.', ',').replace(/,?0+$/, '');
}

const WORT = /^[^\d\W]/;
/** Bindewörter, die in Namen klein bleiben – und Kürzel, die niemand groß schreibt */
const KLEIN = new Set(['of', 'the', 'and', 'de', 'del', 'di', 'du', 'la', 'le', 'el', 'y', 'e', 'i', 'und', 'von', 'der', 'den', 'im', 'am', 'auf', 'en', 'da', 'das', 'nan', 'mont']);

/**
 * Namen in Reinschrift: „  kyoto station " → „Kyoto Station". BindeWörter und
 * Kürzel wie „db" bleiben, wie sie gemeint sind – die Regel soll lesen helfen,
 * nicht umbenennen.
 */
export function sauber(text: string | null | undefined): string {
  const glatt = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!glatt) return '';
  const woerter = glatt.split(' ');
  return woerter
    .map((wort, i) => {
      if (!WORT.test(wort)) return wort;
      const klein = wort.toLowerCase();
      if (wort.length <= 2) return wort;
      if (i > 0 && KLEIN.has(klein)) return klein;
      if (wort !== klein && wort[0] === wort[0].toUpperCase()) return wort;
      return wort[0].toUpperCase() + wort.slice(1);
    })
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1');
}

export function kurz(text: string | null | undefined, max = 46): string {
  const t = (text ?? '').trim();
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export const WAEHRUNGEN = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD', 'TRY', 'THB', 'AED', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'MXN', 'ARS', 'ZAR', 'SGD', 'HKD', 'KRW', 'INR', 'IDR', 'MYR', 'BRL', 'CLP', 'EGP', 'MAR'];

const ZEICHEN: Record<string, string> = { EUR: '€', USD: '$', JPY: '¥', GBP: '£', CHF: 'CHF', AUD: 'A$', CAD: 'C$', TRY: '₺', AED: 'د.إ ', THB: '฿' };

export function zeichen(waehrung: string | null | undefined): string {
  return ZEICHEN[(waehrung ?? 'EUR').toUpperCase()] ?? `${(waehrung ?? 'EUR').toUpperCase()} `;
}

/** „1.240 €" – ohne Dezimalstellen bei runden Beträgen, sonst zwei */
export function geld(wert: number | null | undefined, waehrung = 'EUR'): string {
  if (wert === null || wert === undefined || !Number.isFinite(wert)) return '—';
  const glatt = Math.abs(wert % 1) < 0.005;
  const zahl = new Intl.NumberFormat('de-DE', { minimumFractionDigits: glatt ? 0 : 2, maximumFractionDigits: glatt ? 0 : 2 }).format(wert);
  return `${zahl} ${zeichen(waehrung)}`.trim();
}

export function minutenText(min: number | null | undefined): string {
  if (!min || min < 1) return '';
  if (min < 60) return `${Math.round(min)} Min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} Min` : `${h} h`;
}

export function uhrzeitText(zeit: string | null | undefined): string {
  if (!zeit) return '';
  const [h, m] = zeit.split(':');
  return m === '00' || !m ? `${h} Uhr` : `${h}:${m}`;
}

export function stundenAus(zeit: string | null | undefined): number | null {
  if (!zeit || !/^\d{1,2}:\d{2}$/.test(zeit)) return null;
  const [h, m] = zeit.split(':').map(Number);
  return h + m / 60;
}

/** „2 Aktivitäten · 3 Unterkünfte" – nur was da ist */
export function zaehlen(zahlen: [number, string, string][]): string {
  return zahlen
    .filter(([n]) => n > 0)
    .map(([n, eins, viele]) => `${n} ${n === 1 ? eins : viele}`)
    .join(' · ');
}

export function plural(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

export function initialen(name: string | null | undefined, fallback = 'Du'): string {
  const teile = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return fallback;
  return teile
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Gleicher Inhalt, gleicher Zeiger. Ein Zustand, der beim selben Stand einen
 * neuen Zeiger bekommt, wirft einen Render nach dem nächsten: Render → Effekt
 * → Render. Deshalb hier entlang, wenn ein Effekt etwas vergleicht.
 */
export function wieVorher<T>(vorher: T, neu: T): T {
  return vorher === neu || JSON.stringify(vorher) === JSON.stringify(neu) ? vorher : neu;
}
