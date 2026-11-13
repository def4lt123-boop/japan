/**
 * Der suchtakt – wie lange zwischen zwei punktesuchen innegehalten wird.
 *
 * Die offenen kartendienste mögen keine staffel: wer fünfzig mal in einer minute
 * fragt, wird eine zeitlang nicht mehr durchgelassen (429). Genau das geschah,
 * wenn viele auf einmal angelegt wurden – nach etwa zehn punkten kam für den rest
 * nur noch „kein punkt gefunden\". Deshalb meldet die suche mit, wenn sie gebremst
 * wurde, und von da an halten alle aufrufer länger inne: eine staffel, die sich
 * selbst bremst, kommt durch.
 */

const BREMS_DAUER = 25_000;
const TAKT_RUHIG = 240;
const TAKT_GEBREMST = 1400;

let gebremst_bis = 0;

/** die antwort der suche sagt, ob eine quelle gebremst hat – hier wird es gemerkt */
export function bremsMelden(gemeldet: boolean | null | undefined, jetzt = Date.now()): void {
  if (!gemeldet) return;
  gebremst_bis = jetzt + BREMS_DAUER;
}

export function gebremst(jetzt = Date.now()): boolean {
  return gebremst_bis > jetzt;
}

/** die pause zwischen zwei anfragen – im normallauf kurz, nach einer bremse lang */
export function takt(jetzt = Date.now()): number {
  return gebremst(jetzt) ? TAKT_GEBREMST : TAKT_RUHIG;
}

/** für tests und für ein blatt, das gerade nichts mehr zu tun hat */
export function taktVergessen(): void {
  gebremst_bis = 0;
}

export const TAKT_WERTE = { ruhig: TAKT_RUHIG, gebremst: TAKT_GEBREMST, dauer: BREMS_DAUER };
