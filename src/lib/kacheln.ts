/**
 * Die Kacheln unter der Karte. Offen und ohne Schlüssel, damit die Karte genau
 * dann funktioniert, wenn niemand einen Dienst freigeschaltet hat:
 * OpenStreetMap zuerst – es ist der Grund, auf dem alles steht –, dahinter Esri,
 * das ebenfalls keine Anmeldung kennt und aushält, wenn ein Dienst überlastet
 * ist. CARTO wäre hübscher, verlangt seit 2026 einen Schlüssel und legt sonst
 * ein Wasserzeichen über die Stadt; deshalb ist es hier nicht im Spiel.
 *
 * Wer eigene Kacheln hat (eigener Dienst, MapTiler, Stadia), setzt
 * NEXT_PUBLIC_KARTE_KACHELN auf die Adresse mit {z}/{x}/{y} – sie steht dann vorn.
 */

export interface Kachelquelle {
  id: string;
  url: string;
  nachweis: string;
  maxZoom: number;
}

const OFFENE: Kachelquelle[] = [
  {
    id: 'openstreetmap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    nachweis: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
    maxZoom: 19,
  },
  {
    id: 'esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    nachweis: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende · Kacheln: Esri',
    maxZoom: 19,
  },
];

export function kacheln(): Kachelquelle[] {
  const eigene = (process.env.NEXT_PUBLIC_KARTE_KACHELN ?? '').trim();
  if (!eigene.includes('{z}') || !eigene.includes('{x}')) return OFFENE;
  return [{ id: 'eigene', url: eigene, nachweis: OFFENE[0]!.nachweis, maxZoom: 19 }, ...OFFENE];
}
