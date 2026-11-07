import { modusInfo, punktVorhanden, schaetzungKm, schaetzungMinuten, type Punkt } from './karten';

/**
 * Fahrtzeit zwischen zwei Punkten. Gerechnet wird über den offenen
 * OSRM-Dienst; ist er nicht zu erreichen, bleibt die Schätzung aus der
 * Luftlinie – die Anzeige sagt dann deutlich, dass sie gerechnet ist.
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

export async function routeZwischen(von: Punkt, nach: Punkt, modus: string, streckenbild = false): Promise<RoutenInfo | null> {
  if (!punktVorhanden(von) || !punktVorhanden(nach)) return null;
  const schlussel = schluessel(von, nach, modus);
  const bekannt = speicher.get(schlussel);
  if (bekannt) return bekannt;
  const { osrm } = modusInfo(modus);
  const url = `https://router.project-osrm.org/route/v1/${osrm}/${von.lng},${von.lat};${nach.lng},${nach.lat}?overview=${streckenbild ? 'full' : 'false'}&geometries=geojson&alternatives=false&steps=false`;
  try {
    const antwort = await fetch(url, { signal: AbortSignal.timeout(4500), cache: 'default' });
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
  }
  const km = schaetzungKm(von, nach);
  if (km === null) return null;
  const info: RoutenInfo = { km, minuten: schaetzungMinuten(km, modus), quelle: 'geschätzt' };
  return info;
}

export async function kettenRouten(punkte: Punkt[], modus: string): Promise<(RoutenInfo | null)[]> {
  const texte: (RoutenInfo | null)[] = [];
  for (let i = 0; i + 1 < punkte.length; i += 1) texte.push(await routeZwischen(punkte[i]!, punkte[i + 1]!, modus));
  return texte;
}
