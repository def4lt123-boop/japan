'use client';

import { stadtAusAdresse } from './orte';

/**
 * Das Bild zum Ort. Geholt wird über den Bilddienst der App, höchstens zwei
 * Anfragen auf einmal – ein Tag mit acht Punkten soll nicht acht Suchen
 * gleichzeitig lostreten. Gefunden heißt nicht gespeichert: wer das Bild
 * behalten will, übernimmt es an der Reihe.
 *
 * Bild und Nachweis werden mitgenommen; der Nachweis steht am Eintrag und ist
 * im Formular zu sehn, die Reihen selbst bleiben frei davon.
 */

export type Ortsbild = { url: string; nachweis: string | null; gefunden: boolean };

const vorrat = new Map<string, Promise<Ortsbild | null>>();

const HÖCHSTENS = 2;
let laufend = 0;
let wartend: (() => void)[] = [];

function öffnen() {
  laufend += 1;
  return () => {
    laufend -= 1;
    wartend.shift()?.();
  };
}

function schlitz(): Promise<() => void> {
  if (laufend < HÖCHSTENS) return Promise.resolve(öffnen());
  return new Promise((weiter) => {
    wartend.push(() => weiter(öffnen()));
  });
}

async function holen(frage: string, frisch = false): Promise<Ortsbild | null> {
  const zumachen = await schlitz();
  try {
    // ein „nochmal" darf nicht im netzvorrat der seite hängen bleiben
    const antwort = await fetch(`/api/bild?q=${encodeURIComponent(frage)}`, frisch ? { cache: 'no-store' } : undefined);
    if (!antwort.ok) return null;
    const daten = (await antwort.json()) as { url?: string | null; nachweis?: string | null };
    if (!daten.url) return null;
    return { url: daten.url, nachweis: daten.nachweis ?? null, gefunden: true };
  } catch {
    return null;
  } finally {
    zumachen();
  }
}

/**
 * Die Fragen, die nacheinander gestellt werden – höchstens drei, und die erste
 * ist immer das, was den Ort wirklich meint. Ein Land ist keine Bildersuche:
 * „Vereinigtes Königreich, Flughafen" findet nichts, „London Luton Airport"
 * findet genau den. Findet der Name nichts, bleibt der Ortsblick als Grund.
 */
export function bildFragen(
  e: { titel?: string | null; ort?: string | null; adresse?: string | null },
  reise: { stationen?: string | null; land?: string | null }
): string[] {
  const glatt = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();
  const land = glatt(reise.land).toLowerCase();
  const titel = glatt(e.titel);
  const ortsangabe = glatt(e.ort);
  const stationen = glatt(reise.stationen)
    .split(/[·,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const ausAdresse = glatt(stadtAusAdresse(e.adresse ?? null, reise.land));
  // ein land ist keine bildersuche: „vereinigtes königreich" als ortsangabe zählt nicht
  const stadt = ortsangabe && ortsangabe.toLowerCase() !== land ? ortsangabe : ausAdresse || stationen[0] || '';
  // und wenn auch das nichts findet, die reise selbst: ein land aus der adresse
  // („England") malt eine strandkulisse, „London" immerhin den richtigen ort
  const blick = stationen[0] || stadt;
  const fragen: string[] = [];
  const nimm = (f: string) => {
    const frage = f.replace(/\s+/g, ' ').trim();
    if (frage.length >= 4 && !fragen.includes(frage)) fragen.push(frage);
  };
  nimm(titel);
  if (stadt) nimm(`${titel}, ${stadt}`);
  nimm(blick);
  if (stadt && blick !== stadt) nimm(stadt);
  return fragen.slice(0, 3);
}

/**
 * Beim zweiten Mal dieselbe Antwort – aus dem Vorrat, ohne neue Suche. Ein fund ist
 * gemerkt, eine leere hand nicht: die nächste frage darf es noch einmal versuchen,
 * sonst hinge ein einzelner ausfall für den ganzen seitenbesuch fest.
 */
export function ortsBild(frage: string, frisch = false): Promise<Ortsbild | null> {
  const sauber = frage.replace(/\s+/g, ' ').trim();
  if (sauber.length < 3) return Promise.resolve(null);
  const vorhanden = frisch ? undefined : vorrat.get(sauber);
  if (vorhanden) return vorhanden;
  const lauf = holen(sauber, frisch).then((bild) => {
    if (!bild && vorrat.get(sauber) === lauf) vorrat.delete(sauber);
    return bild;
  });
  vorrat.set(sauber, lauf);
  return lauf;
}

/**
 * Die staffel durchfragen, bis eine ein bild bringt – dieselbe folge wie an der reihe,
 * damit „big ben" auch im formular reicht und nicht die halbe adresse mitgeht.
 */
export async function bildFuer(
  e: { titel?: string | null; ort?: string | null; adresse?: string | null },
  reise: { stationen?: string | null; land?: string | null },
  opts: { frisch?: boolean; abgebrochen?: () => boolean } = {}
): Promise<Ortsbild | null> {
  for (const frage of bildFragen(e, reise)) {
    const bild = await ortsBild(frage, opts.frisch ?? false);
    if (opts.abgebrochen?.()) return null;
    if (bild) return bild;
  }
  return null;
}
