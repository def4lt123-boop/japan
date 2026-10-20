import type { Place } from './types';

/**
 * Koordinaten holen – der Browser fragt OpenStreetMap-Nominatim (kein API-Key).
 * Läuft nur clientseitig; bei Rate-Limit kommt null und man kann die
 * Google-Maps-URL manuell einfügen (siehe parseMapsUrl).
 */

export interface GeoHit {
  lat: number;
  lng: number;
  label: string;
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeoHit | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    const first = data[0] as { lat?: string; lon?: string; display_name?: string };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: first.display_name ?? query };
  } catch {
    return null;
  }
}

export function queryFor(place: Pick<Place, 'name' | 'city' | 'district' | 'maps_query'>): string {
  if (place.maps_query?.trim()) return place.maps_query.trim();
  return [place.name, place.district?.includes('(') ? null : place.district, place.city].filter(Boolean).join(', ');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kurzer Google-Maps-Link (maps.app.goo.gl/…) – sein Ziel kennt nur der Server */
export const isShortMapsLink = (input: string) => /(maps\.app\.goo\.gl|goo\.gl|g\.co\/)\S*/i.test(input.trim());

/** Name aus dem Pfad eines Maps-Links: /place/Nara+Park/… · /search/nara+park · ?q=… */
export const mapsUrlName = (input: string): string | null => extractPlaceName(input.trim());

/** Holt die echte Ziel-URL eines Kurzlinks (über /api/maps-resolve, sonst der Text selbst). */
export async function resolveMapsLink(input: string): Promise<string> {
  const text = input.trim();
  if (!isShortMapsLink(text)) return text;
  try {
    const res = await fetch(`/api/maps-resolve?url=${encodeURIComponent(text)}`);
    if (!res.ok) return text;
    const data = (await res.json()) as { url?: string };
    return data.url && /google\.[a-z.]+\/maps/i.test(data.url) ? data.url : text;
  } catch {
    return text;
  }
}

/**
 * Google-Maps-URL → Kartenpunkt (+ Name, falls der Link einen mitbringt). Unterstützt u. a.:
 *  /maps/place/Ramen/@35.6597,139.7007,17z     (auch mit /data=!3m1!4b1)
 *  /maps?api=1&query=35.6597,139.7007          /maps/dir/…/35.6597,139.7007
 *  /maps/search/Nara+Park                      "34.6851, 135.8434" (rohe Koordinaten)
 */
export function parseMapsUrl(input: string): { lat: number; lng: number; query: string | null; zoom: number | null } | null {
  const text = input.trim();
  if (!text) return null;

  const zoom = /@-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,(\d{1,3})z/.exec(text);
  const z = zoom ? Math.max(3, Math.min(20, Number(zoom[1]))) : null;

  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]), query: extractPlaceName(text), zoom: z };

  const q = text.match(/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]), query: extractPlaceName(text), zoom: z };

  const dest = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dest) return { lat: Number(dest[1]), lng: Number(dest[2]), query: extractPlaceName(text), zoom: z };

  const ll = text.match(/!2m1!1e3?[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (ll) return { lat: Number(ll[1]), lng: Number(ll[2]), query: null, zoom: z };

  const bare = text.match(/^(-?\d{1,3}(?:[.,]\d{2,})?)\s*[,;/]\s*(-?\d{1,3}(?:[.,]\d{2,})?)$/);
  if (bare) {
    const lat = Number(bare[1].replace(',', '.'));
    const lng = Number(bare[2].replace(',', '.'));
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, query: null, zoom: null };
  }
  return null;
}

function extractPlaceName(text: string): string | null {
  const m =
    text.match(/\/maps\/(?:place|search)\/([^/?]+)/) ??
    text.match(/[?&](?:q|query)=([^&]+)/i) ??
    text.match(/\/maps\/@[^/]*\/(?:place|data)?\/?([^/?#]+)\//);
  if (!m) return null;
  try {
    let name = decodeURIComponent(m[1]).replace(/\+/g, ' ').trim();
    name = name.replace(/\s*@\d.*$/, '').replace(/\/data.*$/, '').replace(/\s*\/+$/, '').trim();
    if (!name || name === 'data' || /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(name)) return null;
    return name.length > 1 ? name : null;
  } catch {
    return null;
  }
}
