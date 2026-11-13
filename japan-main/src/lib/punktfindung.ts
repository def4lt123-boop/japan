import { frageWorte, quellenName, stadtAusAdresse, wortKommtVor } from './orte';
import { bremsMelden } from './suchtakt';
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
 * Namen muss im Namen des Treffers stehen (auch unter anderem Namen oder mit
 * Tippfehler), und nennt die Suche eine Stadt, muss die in Name oder Adresse
 * vorkommen. Ein Treffer, der nur über die Stadt gefunden wäre, ist eine
 * Vermutung – und die wird nicht auf die Karte gemalt. Eine Ausnahme: der erste
 * Treffer von Google, das den Namen auch unter anderer Schreibweise kennt.
 */
export function bestenPunkt(orte: Ortsvorschlag[], text: string): Ortsvorschlag | null {
  const brocken = text.split(',').map((t) => t.trim()).filter(Boolean);
  const gesuchte = frageWorte(brocken[0] ?? '').filter((w) => w.length > 2);
  if (!gesuchte.length) return null;
  const stadt = brocken.length > 1 ? woerter(brocken[brocken.length - 1]) : [];
  for (const [rang, treffer] of orte.slice(0, 5).entries()) {
    const name = woerter(treffer.name);
    const vertraut = treffer.quelle === 'google' && rang === 0;
    if (!vertraut && !gesuchte.some((w) => wortKommtVor(w, name))) continue;
    if (stadt.length) {
      const ziel = [...name, ...woerter(treffer.adresse)];
      if (!stadt.some((w) => wortKommtVor(w, ziel))) continue;
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
  /** das Foto des Ortes, wenn die Suche eins mitgebracht hat (Google) */
  bild?: { url: string; nachweis: string | null } | null;
}

/**
 * Die suche, durch dasselbe tor wie das formular, damit eine masse auf einmal
 * nicht an einer zweiten tür klopft. `frisch` geht am zwischenspeicher vorbei –
 * für den zweiten durchgang nach einer bremse. Die meldung „gebremst" wird
 * weitergegeben, nicht verschluckt: von da an halten alle aufrufer inne.
 */
export function sucheDurchsuchen(frisch = false): (text: string) => Promise<Ortsvorschlag[]> {
  return async (text: string) => {
    try {
      const antwort = await fetch(`/api/orte?q=${encodeURIComponent(text)}${frisch ? '&neu=1' : ''}`);
      if (!antwort.ok) return [];
      const daten = (await antwort.json()) as { orte?: Ortsvorschlag[]; brems?: boolean };
      bremsMelden(daten.brems ?? false);
      return daten.orte ?? [];
    } catch {
      return [];
    }
  };
}

const orteHol = sucheDurchsuchen();

/**
 * Punkt für einen Eintrag suchen. `holen` steht für den Test, im Ernstfall
 * spricht dasselbe `/api/orte` aus dem Formular.
 */
export async function punktFuer(
  e: Punktquelle,
  land?: string | null,
  holen: (text: string) => Promise<Ortsvorschlag[]> = orteHol,
  opts: { höchstens?: number } = {}
): Promise<Punktuebernahme | null> {
  // in einer bremse genügt die eine frage – die nächsten kandidatinnen sind für
  // denselben lauf doch nur weitere anfragen an dieselbe zugemachte tür
  const kandidaten = suchkandidaten(e).slice(0, Math.max(1, opts.höchstens ?? 3));
  for (const text of kandidaten) {
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
      bild: treffer.foto ?? null,
    };
  }
  return null;
}
