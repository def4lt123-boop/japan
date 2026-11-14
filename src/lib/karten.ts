/**
 * Karten-Links und Entfernungen. Google Maps bleibt der Anker für das
 * Auffinden vor Ort: Eintrag antippen → Karte mit genau diesem Punkt.
 */

export interface Punkt {
  lat?: number | null;
  lng?: number | null;
  titel?: string | null;
  ort?: string | null;
  karten_stichwort?: string | null;
  adresse?: string | null;
}

const zentriert = (p: Punkt) => {
  const f = (n: number) => n.toFixed(6).replace(/\.?0+$/, '');
  return `${f(p.lat as number)},${f(p.lng as number)}`;
};

export function punktVorhanden(p: Punkt | null | undefined): p is Punkt & { lat: number; lng: number } {
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Link für „In Google Maps öffnen" – Punkt wenn gesetzt, sonst die Suche */
export function kartenLink(p: Punkt): string {
  if (punktVorhanden(p)) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}&query_place_id=`.replace(/&query_place_id=$/, '');
  const stichwort = p.karten_stichwort || [p.titel, p.adresse, p.ort].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stichwort)}`;
}

const MAPS_MODUS: Record<string, string> = { 'zu fuss': 'walking', rad: 'bicycling', auto: 'driving', bahn: 'transit' };

/**
 * Der Weg in Google Maps: Start, Ziel und was dazwischen liegt, mit der gewählten
 * Fortbewegung – dort gibt es dann Abfahrtszeiten, Gleise und die Navigation. Google
 * nimmt höchstens neun Zwischenhalte. Bahn und Bus kennen keine Zwischenhalte: für
 * mehr als zwei Punkte gibt es dann keinen Link, sondern einen je Schritt.
 */
export function routenLink(stationen: Punkt[], modus: string): string | null {
  const halte = stationen.filter(punktVorhanden).slice(0, 11);
  if (halte.length < 2) return null;
  const art = MAPS_MODUS[modus] ?? 'walking';
  if (art === 'transit' && halte.length > 2) return null;
  const mitte = halte.slice(1, -1).map(zentriert).join(encodeURIComponent('|'));
  return `https://www.google.com/maps/dir/?api=1&travelmode=${art}&origin=${zentriert(halte[0]!)}&destination=${zentriert(halte[halte.length - 1]!)}${mitte ? `&waypoints=${mitte}` : ''}`;
}

/**
 * Die Karte direkt im Formular: ein Rahmen um den Punkt, offen eingebettet,
 * ohne Schlüssel und ohne Wasserzeichen. Der Ausschnitt wächst mit dem Zoom
 * und wird über dem Breiteengrad aufgespannt, damit die Mitte trifft.
 */
export function kartenVorschau(p: Punkt, zoom = 15): string {
  if (!punktVorhanden(p)) return 'https://www.openstreetmap.org/export/embed.html?bbox=-180,-85,180,85&layer=mapnik';
  const halbe = 0.012 * 2 ** (15 - zoom);
  const laenge = halbe / Math.max(0.2, Math.cos(((p.lat as number) * Math.PI) / 180));
  const rand = (n: number) => Number(n.toFixed(5));
  const bbox = [rand((p.lng as number) - laenge), rand((p.lat as number) - halbe), rand((p.lng as number) + laenge), rand((p.lat as number) + halbe)].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${p.lat},${p.lng}`;
}

/**
 * Die modi – und der server, der für diesen modus gebaut ist. Zu fuß und mit dem
 * rad wird über dienste gerechnet, die treppen, fußwege und radwege kennen; der
 * allgemeine kennt nur das auto und bleibt der rückhalt, wenn der erste nicht
 * mitspielt. Die geschwindigkeit ist die untergrenze: eine zeit, die schneller
 * wäre als das, was ein mensch gehen kann, ist keine genauigkeit.
 */
export const MODI = [
  { id: 'zu fuss', label: 'zu Fuß', icon: '🚶', kmh: 4.6, osrm: 'foot', diener: 'https://routing.openstreetmap.de/routed-foot' },
  { id: 'rad', label: 'Rad', icon: '🚲', kmh: 16, osrm: 'bike', diener: 'https://routing.openstreetmap.de/routed-bike' },
  { id: 'auto', label: 'Auto', icon: '🚗', kmh: 42, osrm: 'driving', diener: 'https://router.project-osrm.org' },
  { id: 'bahn', label: 'Bahn', icon: '🚆', kmh: 78, osrm: 'driving', diener: 'https://router.project-osrm.org' },
] as const;

export type Modus = (typeof MODI)[number]['id'];

export function modusInfo(modus: string) {
  return MODI.find((m) => m.id === modus) ?? MODI[0];
}

export function entfernungKm(a: Punkt, b: Punkt): number | null {
  if (!punktVorhanden(a) || !punktVorhanden(b)) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const erde = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * erde * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

/** Luftlinie × 1,4 ≈ der Weg, den man tatsächlich geht – die Schätzung ohne Netz */
export function schaetzungKm(a: Punkt, b: Punkt): number | null {
  const luft = entfernungKm(a, b);
  return luft === null ? null : Math.round(luft * 1.4 * 10) / 10;
}

export function schaetzungMinuten(km: number, modus: string): number {
  const { kmh } = modusInfo(modus);
  return Math.max(1, Math.round((km / kmh) * 60));
}

export function kmText(km: number | null | undefined): string {
  if (km === null || km === undefined) return '';
  return km < 10 ? `${String(km).replace('.', ',')} km` : `${Math.round(km)} km`;
}

/**
 * Die Nadel über einem Punkt: die Zahl im Körper, das Zeichen der Kategorie
 * als Siegel daneben. Ein Bett trägt keine Zahl, sondern sein Zeichen – es
 * steht außer der Reihe.
 */
export function nadelHtml(p: { nr: number | null; farbe: string; zeichen: string }): string {
  const kern = p.nr === null ? `<i class="nadel-zeichen">${p.zeichen}</i>` : `<i>${p.nr}</i><b>${p.zeichen}</b>`;
  return `<span class="nadel-koerper" style="--nadel:${p.farbe}">${kern}</span>`;
}
