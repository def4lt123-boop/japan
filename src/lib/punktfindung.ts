import { quellenName, stadtAusAdresse } from './orte';
import type { Eintrag, Ortsvorschlag } from './types';

/**
 * Ein Eintrag ohne Punkt steht nicht auf der Karte. Statt fünf Suchergebnisse
 * durchklicken zu lassen, holt sich die App den Punkt selbst – durch dieselbe
 * offene Suche, die auch im Formular steht – und übernimmt ihn nur, wenn der
 * Treffer zum Gesuchten passt. Lieber kein Punkt als ein falscher.
 */

export interface Punktquelle {
  titel?: string | null;
  ort?: string | null;
  adresse?: string | null;
  karten_stichwort?: string | null;
}

/** Zu suchen ist in der Reihenfolge der Hoffnung: Stichwort, Adresse, dann Titel und Ort */
export function suchkandidaten(e: Punktquelle): string[] {
  const glatt = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();
  const gesehen = new Set<string>();
  const liste: string[] = [];
  for (const brocken of [e.karten_stichwort, e.adresse, [e.titel, e.ort].filter(Boolean).join(', ')]) {
    const text = glatt(brocken);
    if (text.length < 5 || gesehen.has(text.toLowerCase())) continue;
    gesehen.add(text.toLowerCase());
    liste.push(text);
  }
  return liste;
}

const woerter = (text: string | null | undefined) =>
  (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2);

/**
 * Der erste Treffer, der sich für das Gesuchte hält: einer der Wörter aus dem
 * Namen muss im Namen des Treffers stehen, und nennt die Suche eine Stadt, muss
 * die in Name oder Adresse vorkommen. Ein Treffer, der nur über die Stadt
 * gefunden wäre, ist eine Vermutung – und die wird nicht auf die Karte gemalt.
 */
export function bestenPunkt(orte: Ortsvorschlag[], text: string): Ortsvorschlag | null {
  const brocken = text.split(',').map((t) => t.trim()).filter(Boolean);
  const gesuchte = woerter(brocken[0]);
  if (!gesuchte.length) return null;
  const stadt = brocken.length > 1 ? woerter(brocken[brocken.length - 1]) : [];
  for (const treffer of orte.slice(0, 5)) {
    const name = new Set(woerter(treffer.name));
    if (!gesuchte.some((w) => name.has(w))) continue;
    if (stadt.length) {
      const ziel = new Set([...woerter(treffer.name), ...woerter(treffer.adresse)]);
      if (!stadt.some((w) => ziel.has(w))) continue;
    }
    return treffer;
  }
  return null;
}

/** Was in den Eintrag gehört: der Punkt, dazu, was sonst noch fehlte */
export interface Punktuebernahme {
  patch: Partial<Pick<Eintrag, 'lat' | 'lng' | 'ort' | 'adresse' | 'karten_stichwort'>>;
  name: string;
  quelle: string;
}

/** Was der Suchdienst zurückgibt – im Test eingesetzt, damit er nicht ins Netz muss */
async function orteHol(text: string): Promise<Ortsvorschlag[]> {
  try {
    const antwort = await fetch(`/api/orte?q=${encodeURIComponent(text)}`);
    if (!antwort.ok) return [];
    const daten = (await antwort.json()) as { orte?: Ortsvorschlag[] };
    return daten.orte ?? [];
  } catch {
    return [];
  }
}

/**
 * Punkt für einen Eintrag suchen. `holen` steht für den Test, im Ernstfall
 * spricht dasselbe `/api/orte` aus dem Formular.
 */
export async function punktFuer(e: Punktquelle, land?: string | null, holen: (text: string) => Promise<Ortsvorschlag[]> = orteHol): Promise<Punktuebernahme | null> {
  for (const text of suchkandidaten(e)) {
    const orte = await holen(text).catch(() => [] as Ortsvorschlag[]);
    const treffer = bestenPunkt(orte, text);
    if (!treffer) continue;
    const stadt = e.ort?.trim() ? null : stadtAusAdresse(treffer.adresse, land);
    return {
      patch: {
        lat: treffer.lat,
        lng: treffer.lng,
        karten_stichwort: treffer.stichwort,
        ...(stadt ? { ort: stadt } : {}),
        ...(!e.adresse?.trim() && treffer.adresse ? { adresse: treffer.adresse } : {}),
      },
      name: treffer.name,
      quelle: quellenName(treffer.quelle),
    };
  }
  return null;
}
