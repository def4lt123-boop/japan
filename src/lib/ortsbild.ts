'use client';

/**
 * Das Bild zum Ort. Geholt wird über den Bilddienst der App, höchstens zwei
 * Anfragen auf einmal – ein Tag mit acht Punkten soll nicht acht Suchen
 * gleichzeitig lostreten. Gefunden heißt nicht gespeichert: wer das Bild
 * behalten will, übernimmt es an der Reihe.
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

async function holen(frage: string): Promise<Ortsbild | null> {
  const zumachen = await schlitz();
  try {
    const antwort = await fetch(`/api/bild?q=${encodeURIComponent(frage)}`);
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

/** Zwei bis drei Stücke genügen einer Bildersuche; mehr macht sie ungenau. */
export function ortsfrage(...teile: (string | null | undefined)[]): string {
  const stücke: string[] = [];
  for (const teil of teile) {
    const wort = (teil ?? '').trim();
    if (wort && !stücke.includes(wort)) stücke.push(wort);
    if (stücke.length >= 2) break;
  }
  return stücke.join(', ');
}

/** Beim zweiten Mal dieselbe Antwort – aus dem Vorrat, ohne neue Suche. */
export function ortsBild(frage: string): Promise<Ortsbild | null> {
  const sauber = frage.replace(/\s+/g, ' ').trim();
  if (sauber.length < 3) return Promise.resolve(null);
  const vorhanden = vorrat.get(sauber);
  if (vorhanden) return vorhanden;
  const lauf = holen(sauber);
  vorrat.set(sauber, lauf);
  return lauf;
}
