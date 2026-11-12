import { modusInfo, punktVorhanden, schaetzungKm, schaetzungMinuten, type Punkt } from './karten';
import { bremsMelden, gebremst } from './suchtakt';

/**
 * Wegzeit zwischen zwei punkten – und die wege durch eine gruppe in einer runde.
 *
 * Gerechnet wird über die offenen OSRM-dienste: für fuß und rad über die servers,
 * die zu fuß und mit dem rad rechnen (nur die kennen treppen, fußwege und
 * einbahnregeln für menschen ohne auto), für alles andere über den allgemeinen.
 * Antwortet keiner, bleibt die schätzung aus der luftlinie – die anzeige sagt dann
 * deutlich, dass sie gerechnet ist.
 *
 * Eine zahl, die zu schnell wirkt, ist keine genauigkeit: der allgemeine dienst
 * rechnet auf dem autograf, und der sagt für eine halbe stadt auch schon mal zwei
 * minuten. Darum gilt überall die untergrenze des modus – zu fuß wird nie schneller
 * als 4,6 km/h gerechnet, auch wenn der dienst eine kürzere zeit nennt.
 *
 * Auch diese dienste weisen ab, wenn zu viele fragen in einer minute kommen. Dann
 * meldet die rechnung die bremse, und die nächsten paare werden überschlagen statt
 * erneut gefragt – eine staffel, die sich selbst bremst.
 */

export interface RoutenInfo {
  km: number;
  minuten: number;
  quelle: 'gerechnet' | 'geschätzt';
  /** [lat, lng] für die Linie auf der Karte */
  strecke?: [number, number][];
}

/** die matrix aus einer gruppe: minuten und kilometer zwischen je zwei punkten */
export interface Wegmatrix {
  minuten: number[][];
  km: number[][];
}

/** der allgemeine dienst – kennt nur das auto, aber der ist immer erreichbar */
const ALLGEMEIN = 'https://router.project-osrm.org';
/** so viele halte auf einmal fragt die tabelle, nicht mehr */
export const TABELLE_MAX = 12;

/**
 * die quellen für einen modus, die erste zuerst: der server, der für diesen modus
 * gebaut ist, und dahinter der allgemeine – eine quelle, die gerade nicht
 * mitspielt, darf nicht das ganze blatt stillstellen.
 */
export function wegQuellen(modus: string): { name: string; grund: string; diener: string; osrm: string }[] {
  const { osrm, diener } = modusInfo(modus);
  const liste = [{ name: `osrm-${osrm}`, grund: `${diener}/route/v1/${osrm}`, diener, osrm }];
  // dahinter der allgemeine dienst: der kennt nur das auto, aber er ist immer zu
  // erreichen, und seine strecke ist die echte straße – die zeit hebt der modus
  if (diener !== ALLGEMEIN)
    liste.push({ name: 'osrm', grund: `${ALLGEMEIN}/route/v1/driving`, diener: ALLGEMEIN, osrm: 'driving' });
  return liste;
}

/** was die geschwindigkeit des modus hergibt – die untergrenze für jede rechnung */
export function untergrenze(km: number, modus: string): number {
  return Math.max(1, Math.round((km / modusInfo(modus).kmh) * 60));
}

const speicher = new Map<string, RoutenInfo>();
const speicherTabellen = new Map<string, Wegmatrix>();

const schluessel = (a: Punkt, b: Punkt, modus: string) => `${modus}|${a.lat?.toFixed(4)},${a.lng?.toFixed(4)}|${b.lat?.toFixed(4)},${b.lng?.toFixed(4)}`;

/** die überschlagene rechnung: luftlinie × 1,4, geteilt durch die geschwindigkeit */
export function geschaetzteRoute(von: Punkt, nach: Punkt, modus: string): RoutenInfo | null {
  const km = schaetzungKm(von, nach);
  if (km === null) return null;
  return { km, minuten: schaetzungMinuten(km, modus), quelle: 'geschätzt' };
}

/** was schon gerechnet im kopf liegt – für blätter, die nicht zweimal fragen sollen */
export function routeBekannt(von: Punkt, nach: Punkt, modus: string): RoutenInfo | null {
  if (!punktVorhanden(von) || !punktVorhanden(nach)) return null;
  return speicher.get(schluessel(von, nach, modus)) ?? null;
}

/** eine strecke, wie sie im_json der antwort steht – auf die untergrenze gehoben */
function ausweg(route: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }, modus: string): RoutenInfo | null {
  if (!route.distance || route.distance < 1) return null;
  const km = Math.round((route.distance / 1000) * 10) / 10;
  const zeit = route.duration && route.duration > 0 ? Math.round(route.duration / 60) : 0;
  return {
    km,
    minuten: Math.max(1, zeit, untergrenze(km, modus)),
    quelle: 'gerechnet',
    strecke: route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]),
  };
}

async function frage(url: string, frist: number): Promise<unknown | null> {
  try {
    const antwort = await fetch(url, { signal: AbortSignal.timeout(frist), cache: 'default' });
    if (antwort.status === 429 || antwort.status >= 500) {
      // die abweisung wird gemeldet, aber der nächste server in der kette darf es
      // noch versuchen – eine zuwandte tür ist kein grund für die ganze rechnung
      bremsMelden(true);
      return null;
    }
    if (!antwort.ok) return null;
    return await antwort.json();
  } catch {
    bremsMelden(true);
    return null;
  }
}

/**
 * Fahrtzeit zwischen zwei punkten. Die kette von quellen wird der reihe nach
 * gefragt; was zuerst antwortet, das trägt den abstand – nie schneller, als der
 * modus laufen kann.
 */
export async function routeZwischen(von: Punkt, nach: Punkt, modus: string, streckenbild = false): Promise<RoutenInfo | null> {
  if (!punktVorhanden(von) || !punktVorhanden(nach)) return null;
  const schlussel = schluessel(von, nach, modus);
  const bekannt = speicher.get(schlussel);
  if (bekannt) return bekannt;
  // wer gerade abgewiesen wurde, fragt nicht noch einmal – überschlagen reicht
  if (gebremst()) return geschaetzteRoute(von, nach, modus);
  const paare = `${von.lng},${von.lat};${nach.lng},${nach.lat}`;
  for (const quelle of wegQuellen(modus)) {
    const daten = (await frage(`${quelle.grund}/${paare}?overview=${streckenbild ? 'full' : 'false'}&geometries=geojson&alternatives=false&steps=false`, 4500)) as
      | { code?: string; routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[] }
      | null;
    const route = daten?.code === 'Ok' ? daten.routes?.[0] : undefined;
    const fund = route ? ausweg(route, modus) : null;
    if (!fund) continue;
    speicher.set(schlussel, fund);
    return fund;
  }
  return geschaetzteRoute(von, nach, modus);
}

/**
 * Die wege durch eine gruppe in einer anfrage: die tabelle gibt minuten und
 * kilometer zwischen je zwei halten. Eine gruppe von neun punkten ist damit eine
 * frage statt acht – und die reihenfolge kann den echten wegen folgen.
 */
export async function wegTabelle(punkte: Punkt[], modus = 'zu fuss'): Promise<Wegmatrix | null> {
  const halte = punkte.filter((p) => punktVorhanden(p));
  if (halte.length < 2 || halte.length > TABELLE_MAX) return null;
  const schlussel = `${modus}|${halte
    .map((p) => `${p.lat!.toFixed(4)},${p.lng!.toFixed(4)}`)
    .sort()
    .join('|')}`;
  const bekannt = speicherTabellen.get(schlussel);
  if (bekannt) return bekannt;
  if (gebremst()) return null;
  const orte = halte.map((p) => `${p.lng},${p.lat}`).join(';');
  for (const quelle of wegQuellen(modus)) {
    const daten = (await frage(`${quelle.diener}/table/v1/${quelle.osrm}/${orte}?annotations=duration,distance`, 6500)) as
      | { code?: string; durations?: number[][]; distances?: number[][] }
      | null;
    if (daten?.code !== 'Ok' || !daten.durations?.length) continue;
    const n = halte.length;
    const minuten: number[][] = [];
    const km: number[][] = [];
    for (let a = 0; a < n; a += 1) {
      minuten.push([]);
      km.push([]);
      for (let b = 0; b < n; b += 1) {
        if (a === b) {
          // sich selbst ist kein schritt
          minuten[a]!.push(0);
          km[a]!.push(0);
          continue;
        }
        const zeit = daten.durations[a]?.[b];
        const weg = daten.distances?.[a]?.[b];
        const strecke = Number.isFinite(weg) ? Math.round((weg as number) / 100) / 10 : schaetzungKm(halte[a]!, halte[b]!) ?? 0;
        // auch hier die untergrenze: nennt der dienst minuten, die schneller sind,
        // als der modus laufen kann, war es kein weg zu fuß
        minuten[a]!.push(Number.isFinite(zeit) ? Math.max(1, Math.round((zeit as number) / 60), untergrenze(strecke, modus)) : Number.POSITIVE_INFINITY);
        km[a]!.push(strecke);
      }
    }
    const fund = { minuten, km };
    if (speicherTabellen.size > 120) speicherTabellen.clear();
    speicherTabellen.set(schlussel, fund);
    return fund;
  }
  return null;
}

export async function kettenRouten(punkte: Punkt[], modus: string): Promise<(RoutenInfo | null)[]> {
  const texte: (RoutenInfo | null)[] = [];
  for (let i = 0; i + 1 < punkte.length; i += 1) texte.push(await routeZwischen(punkte[i]!, punkte[i + 1]!, modus));
  return texte;
}
