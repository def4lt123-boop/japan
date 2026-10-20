/**
 * Google-Maps-Helfer – alles ohne API-Key und ohne Abrechnung:
 *   mapsLink()      offizielle Such-URL (zeigt Marker + Straßenkartenansicht)
 *   mapsEmbedUrl()  Einbettung in einer eigenen Karte (iframe)
 *   routeUrl()      Route mit bis zu 9 Zwischenstopps
 *   routeEmbedUrl() dieselbe Route als eingebettete Karte
 *   placesToKml()   alle Punkte als Datei für Google My Maps
 */
import type { Hotel, Place } from './types';

export type MapsPoint = Pick<Place, 'lat' | 'lng'> & { name?: string | null; city?: string | null; district?: string | null; maps_query?: string | null };
export type TravelMode = 'transit' | 'walking' | 'driving' | 'bicycling';

const enc = encodeURIComponent;
const at = (lat: number, lng: number) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
const isPoint = (v: unknown): v is { lat: number; lng: number } =>
  Boolean(v) && typeof (v as { lat?: unknown }).lat === 'number' && typeof (v as { lng?: unknown }).lng === 'number';

const hasCoords = (p: MapsPoint) => isPoint(p);

/** Wonach Google suchen soll: eigener Suchbegriff, sonst Name + Viertel + Stadt */
export function mapQuery(p: MapsPoint & { name?: string | null }): string {
  const own = p.maps_query?.trim();
  if (own) return own;
  return [p.name, p.district, p.city].filter(Boolean).join(' ').trim();
}

/** Koordinaten wenn vorhanden, sonst der Suchtext – Google kommt mit beidem klar */
function target(p: MapsPoint & { name?: string | null }): string {
  return hasCoords(p) ? at(p.lat as number, p.lng as number) : mapQuery(p);
}

/** Suche bei Google Maps – ein Marker, Straßenebene, mit Navi-Button */
export function mapsLink(p: MapsPoint & { name?: string | null }): string {
  return hasCoords(p)
    ? `https://www.google.com/maps/search/?api=1&query=${enc(at(p.lat as number, p.lng as number))}`
    : `https://www.google.com/maps/search/?api=1&query=${enc(mapQuery(p))}`;
}

/** Dieselbe Ansicht zum Einbauen */
export function mapsEmbedUrl(p: MapsPoint & { name?: string | null }, zoom = 16): string {
  return `https://maps.google.com/maps?q=${enc(target(p))}&z=${zoom}&hl=de&output=embed`;
}

/** freie Textsuche als Karte (für Formulare, Stadtansichten) */
export function queryEmbedUrl(query: string, zoom = 12): string {
  return `https://maps.google.com/maps?q=${enc(query)}&z=${zoom}&hl=de&output=embed`;
}

/** Route: Start, Zwischenstopps in Reihenfolge, Ziel – Google akzeptiert max. 9 Zwischenziele */
export function routeUrl(opts: {
  origin: MapsPoint & { name?: string | null };
  destination: MapsPoint & { name?: string | null };
  stops?: (MapsPoint & { name?: string | null })[];
  mode?: TravelMode;
}): string {
  const waypoints = (opts.stops ?? []).slice(0, 9).map((s) => target(s)).join('|');
  const params = new URLSearchParams({
    api: '1',
    origin: target(opts.origin),
    destination: target(opts.destination),
    travelmode: opts.mode ?? 'transit',
  });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
}

/** Route als eingebettete Karte (Endpunkte, Zwischenstopps zeigt Google hier in der Liste) */
export function routeEmbedUrl(opts: {
  origin: MapsPoint & { name?: string | null };
  destination: MapsPoint & { name?: string | null };
  mode?: TravelMode;
}): string {
  const dirflg = opts.mode === 'walking' ? 'w' : opts.mode === 'driving' ? 'd' : opts.mode === 'bicycling' ? 'b' : 't';
  return `https://maps.google.com/maps?saddr=${enc(target(opts.origin))}&daddr=${enc(target(opts.destination))}&dirflg=${dirflg}&hl=de&output=embed`;
}

const SLOT_START: Record<string, number> = { Morgen: 6 * 60, Vormittag: 9 * 60, Mittag: 12 * 60, Nachmittag: 15 * 60, Abend: 18 * 60, 'Ganzer Tag': 8 * 60 };

const timeKey = (p: Place) => {
  const h = p.start_time?.split(':');
  if (h && h.length >= 2) return Number(h[0]) * 60 + Number(h[1]);
  return p.time_slot ? SLOT_START[p.time_slot] ?? 9 * 60 : 9 * 60 + Math.min(60, p.sort_order);
};

/** Die Punkte eines Tages in Besuchsreihenfolge – nur die mit Kartenpunkt sind Zwischenstopps */
export function dayStops(places: Place[], withCoordsOnly = true): Place[] {
  const list = places
    .filter((p) => (withCoordsOnly ? hasCoords(p) : true))
    .slice()
    .sort((a, b) => timeKey(a) - timeKey(b) || a.sort_order - b.sort_order);
  return list;
}

/** Die Unterkunft, in der man an diesem Tag schläft (erst Datum, dann Stadt) */
export function hotelForDay(hotels: Hotel[], date: string | null, city?: string | null): Hotel | undefined {
  const hit = date ? hotels.find((h) => (h.check_in ?? '') <= date && date < (h.check_out ?? '9999-12-31')) : undefined;
  if (hit) return hit;
  const key = (city ?? '').trim().toLowerCase();
  return key ? hotels.find((h) => (h.city ?? '').trim().toLowerCase() === key) : hotels[0];
}

/** KML für Google My Maps – damit liegen alle Punkte auf einmal auf der eigenen Google-Karte */
export function placesToKml(places: Place[], title: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const marks = places
    .filter((p) => hasCoords(p))
    .map((p) => {
      const bits = [
        p.date ? `Tag: ${p.date}${p.end_date && p.end_date !== p.date ? `–${p.end_date}` : ''}` : 'noch ohne Tag',
        p.start_time ? `Uhrzeit: ${p.start_time}` : '',
        p.category ? `Art: ${p.category}` : '',
        p.city ? `Stadt: ${p.city}${p.district ? ` (${p.district})` : ''}` : '',
        p.travel_time ? `Vom Hotel: ${p.travel_time}` : '',
        p.price_eur ? `Preis: ${p.price_eur} €` : p.price_note ? `Preis: ${p.price_note}` : '',
        p.ticket_status && p.ticket_status !== 'unklar' ? `Ticket: ${p.ticket_status}${p.ticket_note ? ` – ${p.ticket_note}` : ''}` : '',
        p.notes ? `Hinweise: ${p.notes}` : '',
      ]
        .filter(Boolean)
        .join('<br />');
      return `    <Placemark>
      <name>${esc(p.name)}</name>
      <description>${esc(bits)}</description>
      <Point><coordinates>${(p.lng as number).toFixed(6)},${(p.lat as number).toFixed(6)},0</coordinates></Point>
    </Placemark>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(title)}</name>
${marks}
  </Document>
</kml>
`;
}
