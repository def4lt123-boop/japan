import { modusInfo, punktVorhanden, schaetzungKm, schaetzungMinuten, type Punkt } from './karten';
import { bremsMelden, gebremst } from './suchtakt';

/**
 * Fahrtzeit zwischen zwei Punkten. Gerechnet wird über den offenen
 * OSRM-Dienst; ist er nicht zu erreichen, bleibt die Schätzung aus der
 * Luftlinie – die Anzeige sagt dann deutlich, dass sie gerechnet ist.
 *
 * Auch dieser Dienst wird abgewiesen, wenn zu viele fragen in einer minute
 * kommen. Dann meldet die rechnung die bremse und die nächsten paare werden
 * überschlagen statt erneut gefragt – eine staffel, die sich selbst bremst.
 */

export interface RoutenInfo {
  km: number;
  minuten: number;
  quelle: 'gerechnet' | 'geschätzt';
  /** [lat, lng] für die Linie auf der Karte */
  strecke?: [number, number][];
}

const speicher = new Map<string, RoutenInfo>();

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

export async function routeZwischen(von: Punkt, nach: Punkt, modus: string, streckenbild = false): Promise<RoutenInfo | null> {
  if (!punktVorhanden(von) || !punktVorhanden(nach)) return null;
  const schlussel = schluessel(von, nach, modus);
  const bekannt = speicher.get(schlussel);
  if (bekannt) return bekannt;
  // wer gerade abgewiesen wurde, fragt nicht noch einmal – überschlagen reicht
  if (gebremst()) return geschaetzteRoute(von, nach, modus);
  const { osrm } = modusInfo(modus);
  const url = `https://router.project-osrm.org/route/v1/${osrm}/${von.lng},${von.lat};${nach.lng},${nach.lat}?overview=${streckenbild ? 'full' : 'false'}&geometries=geojson&alternatives=false&steps=false`;
  try {
    const antwort = await fetch(url, { signal: AbortSignal.timeout(4500), cache: 'default' });
    if (antwort.status === 429 || antwort.status >= 500) {
      bremsMelden(true);
      return geschaetzteRoute(von, nach, modus);
    }
    const daten = antwort.ok ? ((await antwort.json()) as { code?: string; routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[] }) : null;
    const route = daten?.code === 'Ok' ? daten.routes?.[0] : undefined;
    if (route?.distance && route.duration) {
      const info: RoutenInfo = {
        km: Math.round((route.distance / 1000) * 10) / 10,
        minuten: Math.max(1, Math.round(route.duration / 60)),
        quelle: 'gerechnet',
        strecke: route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]),
      };
      speicher.set(schlussel, info);
      return info;
    }
  } catch {
    /* Netz weg – die Schätzung unten reicht für die Planung */
    bremsMelden(true);
    return geschaetzteRoute(von, nach, modus);
  }
  return geschaetzteRoute(von, nach, modus);
}

export async function kettenRouten(punkte: Punkt[], modus: string): Promise<(RoutenInfo | null)[]> {
  const texte: (RoutenInfo | null)[] = [];
  for (let i = 0; i + 1 < punkte.length; i += 1) texte.push(await routeZwischen(punkte[i]!, punkte[i + 1]!, modus));
  return texte;
}
