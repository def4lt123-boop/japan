/**
 * Rechnen mit Datumsangaben als Text („2027-10-24"). Ein echtes Date-Objekt
 * würde je nach Zeitzone einen Tag verrutschen – hier wird gerechnet, was da
 * steht, und der Wochentag aus UTC gezogen. dadurch zeigt der Kalender überall
 * denselben Tag, egal wo das Gerät steht.
 */

const WOCHEN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WOCHEN_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const TAGE_IM_MONAT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const zweistellig = (n: number) => String(n).padStart(2, '0');

export function gilt(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  let max = TAGE_IM_MONAT[m - 1];
  if (m === 2 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) max = 28;
  return d >= 1 && d <= max;
}

function teile(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function bauen(y: number, m: number, d: number): string {
  const max = m === 2 ? 29 : TAGE_IM_MONAT[m - 1];
  return `${String(y).padStart(4, '0')}-${zweistellig(m)}-${zweistellig(Math.min(Math.max(1, d), max))}`;
}

export function addTage(iso: string, n: number): string {
  if (!gilt(iso)) return iso;
  const { y, m, d } = teile(iso);
  const zeit = Date.UTC(y, m - 1, d) + n * 86_400_000;
  const neu = new Date(zeit);
  return bauen(neu.getUTCFullYear(), neu.getUTCMonth() + 1, neu.getUTCDate());
}

/** Tage von „bis" – 14.06. bis 17.06. sind drei Nächte */
export function abstandTage(von: string, bis: string): number {
  if (!gilt(von) || !gilt(bis)) return 0;
  const a = teile(von);
  const b = teile(bis);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Anzahl Reisetage inklusive ambos Enden */
export function zahlReisetage(von: string, bis: string): number {
  const d = abstandTage(von, bis);
  return d > 0 ? d + 1 : gilt(von) ? 1 : 0;
}

export function tageListe(von: string | null, bis: string | null): string[] {
  if (!gilt(von)) return [];
  const end = gilt(bis) && abstandTage(von, bis) > 0 ? bis : von;
  const n = Math.min(abstandTage(von, end), 400);
  return Array.from({ length: n + 1 }, (_, i) => addTage(von, i));
}

export function wochentag(iso: string): number {
  const { y, m, d } = teile(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const wochentagKurz = (iso: string) => (gilt(iso) ? WOCHEN_KURZ[wochentag(iso)] : '');
export const wochentagLang = (iso: string) => (gilt(iso) ? WOCHEN[wochentag(iso)] : '');

/** „Sa 24.10." – die Kurzform für Listen, Chips und Knöpfe */
export function tagKurz(iso: string | null): string {
  if (!gilt(iso)) return 'ohne Tag';
  const { m, d } = teile(iso);
  return `${WOCHEN_KURZ[wochentag(iso)]} ${zweistellig(d)}.${zweistellig(m)}.`;
}

/** „Samstag, 24. Oktober" – nur für Überschriften */
export function tagLang(iso: string | null): string {
  if (!gilt(iso)) return 'ohne Tag';
  const { m, d } = teile(iso);
  return `${WOCHEN[wochentag(iso)]}, ${d}. ${MONATE[m - 1]}`;
}

/** „24.10." – wenn der Wochentag schon danebensteht */
export function tagNackt(iso: string): string {
  const { m, d } = teile(iso);
  return `${zweistellig(d)}.${zweistellig(m)}.`;
}

export function monatLang(jahr: number, monat: number): string {
  return `${MONATE[Math.min(11, Math.max(0, monat - 1))]} ${jahr}`;
}

/** „Sa 24.10. – Di 27.10." bzw. ein einzelner Tag */
export function zeitraum(von: string | null, bis: string | null): string {
  if (!gilt(von)) return 'ohne Termine';
  if (!gilt(bis) || von === bis) return tagKurz(von);
  const a = teile(von);
  const b = teile(bis);
  if (a.m === b.m) return `${zweistellig(a.d)}.–${zweistellig(b.d)}. ${MONATE_KURZ[b.m - 1]} ${b.y}`;
  return `${tagNackt(von)} ${a.y} – ${tagNackt(bis)} ${b.y}`;
}

export function heuteIso(): string {
  const jetzt = new Date();
  return bauen(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate());
}

/** Wochen beginnen montags; Lücken vor dem ersten und nach dem letzten Tag sind null */
export function monatsRaster(jahr: number, monat: number): (string | null)[][] {
  const erster = bauen(jahr, monat, 1);
  const versatz = (wochentag(erster) + 6) % 7;
  const laenge = TAGE_IM_MONAT[monat - 1] - (monat === 2 && !(jahr % 4 === 0 && (jahr % 100 !== 0 || jahr % 400 === 0)) ? 1 : 0);
  const zellen: (string | null)[] = Array.from({ length: versatz }, () => null);
  for (let d = 1; d <= laenge; d += 1) zellen.push(bauen(jahr, monat, d));
  while (zellen.length % 7 !== 0) zellen.push(null);
  const wochen: (string | null)[][] = [];
  for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7));
  return wochen;
}

/** Woche, in der der Tag liegt – Montag bis Sonntag */
export function wochenTage(iso: string): string[] {
  const offset = (wochentag(iso) + 6) % 7;
  const montags = addTage(iso, -offset);
  return Array.from({ length: 7 }, (_, i) => addTage(montags, i));
}

export function begriessung(stunde = new Date().getHours()): string {
  if (stunde < 5) return 'Gute Nacht';
  if (stunde < 11) return 'Guten Morgen';
  if (stunde < 19) return 'Guten Tag';
  return 'Guten Abend';
}

export const WOCHEN_ANFANG = WOCHEN_KURZ.slice(1).concat('So');
export { MONATE_KURZ };
