import { minutenText } from './format';
import { modusInfo, schaetzungKm, schaetzungMinuten, type Punkt } from './karten';

/**
 * Zu Fuß in Minuten. Die Luftlinie sagt nur, wie weit zwei Punkte auf der karte
 * auseinanderliegen – ob der weg um den block führt, durch eine unterführung oder
 * über eine brücke, das weiß kein gradnetz. Also wird der weg selbst gerechnet,
 * und was dabei herauskommt, ist die zahl, die für einen tag zählt: minuten.
 *
 * Die rechung steht in `routen.ts`. Hier lebt, was man davon sieht: ein text, eine
 * größe, und der filter, der mit derselben zahl mißt wie die zeile daneben.
 */

export const FUSS = 'zu fuss';

export interface Fussweg {
  km: number;
  minuten: number;
  quelle: 'gerechnet' | 'geschätzt';
}

/** der schritt von einem punkt zum andern – ohne netz, aus der luftlinie überschlagen */
export function wegSchaetzen(von: Punkt | null | undefined, nach: Punkt | null | undefined, modus = FUSS): Fussweg | null {
  if (!von || !nach) return null;
  const km = schaetzungKm(von, nach);
  if (km === null) return null;
  return { km, minuten: schaetzungMinuten(km, modus), quelle: 'geschätzt' };
}

/** Minuten aus einer strecke – für alles, was den weg schon in kilometern kennt */
export function minutenAus(km: number | null | undefined, modus = FUSS): number {
  if (km === null || km === undefined || km <= 0) return 0;
  return schaetzungMinuten(km, modus);
}

/**
 * „12 Min.“, mit „≈“, wenn nur überschlagen werden konnte. unter einer minute steht
 * ein strich, denn „0 Min.“ wäre eine behauptung.
 */
export function wegText(weg: Fussweg | null, modus = FUSS): string {
  if (!weg || weg.minuten < 1) return '';
  const zahl = minutenText(weg.minuten);
  const hinweis = weg.quelle === 'geschätzt' ? '≈ ' : '';
  const fußnote = modus === FUSS ? '' : ` ${modusInfo(modus).label}`;
  return `${hinweis}${zahl}${fußnote}.`;
}

/** die länge des weges darunter: 850 m oder 1,4 km */
export function wegLaenge(weg: Fussweg | null | undefined): string {
  if (!weg) return '';
  return weg.km < 1 ? `${Math.round(weg.km * 1000)} m` : `${String(weg.km).replace('.', ',')} km`;
}

/** was in den titel der zeile gehört, damit die kleingedruckte frage schon beantwortet ist */
export function wegTitel(weg: Fussweg | null, modus = FUSS): string {
  if (!weg) return '';
  const ziel = `${wegLaenge(weg)} ${modus === FUSS ? 'Fußweg' : modusInfo(modus).label}`;
  return `${ziel} · ${weg.minuten} Min – ${weg.quelle === 'gerechnet' ? 'gerechnet' : 'überschlagen, der Wegdienst war nicht zu erreichen'}`;
}

/**
 * Der filter: bleibt der schritt unter `maxKm`? Ein punkt ohne Google Maps hat
 * keine entfernung und fällt deshalb nicht raus – er ist der, der überhaupt erst
 * einen punkt braucht, und nicht der, der zu weit weg ist.
 */
export function nahGenug(weg: Fussweg | null, maxKm: number): boolean {
  if (!weg) return true;
  return weg.km <= maxKm;
}
