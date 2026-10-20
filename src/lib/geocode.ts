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

/**
 * Google-Maps-URL → Koordinaten. Unterstützt u. a.:
 *  /maps/place/Ramen/@35.6597,139.7007,17z
 *  /maps/place/.../@35.65,139.70,17z/data=!3m1!4b1
 *  /maps?api=1&query=35.6597,139.7007
 *  /maps/dir/.../35.6597,139.7007
 *  /maps/search/Name+Name
 *  "35.6597, 139.7007" (rohe Koordinaten)
 */
export function parseMapsUrl(input: string): { lat: number; lng: number; query: string | null } | null {
  const text = input.trim();
  if (!text) return null;

  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]), query: extractPlaceName(text) };

  const q = text.match(/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]), query: extractPlaceName(text) };

  const dest = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dest) return { lat: Number(dest[1]), lng: Number(dest[2]), query: extractPlaceName(text) };

  const ll = text.match(/!2m1!1e3?[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (ll) return { lat: Number(ll[1]), lng: Number(ll[2]), query: null };

  const bare = text.match(/^(-?\d{1,3}(?:[.,]\d{2,})?)\s*[,;/]\s*(-?\d{1,3}(?:[.,]\d{2,})?)$/);
  if (bare) {
    const lat = Number(bare[1].replace(',', '.'));
    const lng = Number(bare[2].replace(',', '.'));
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng, query: null };
  }
  return null;
}

function extractPlaceName(text: string): string | null {
  const m = text.match(/\/maps\/(?:place|search)\/([^/?]+)/);
  if (!m) return null;
  try {
    const name = decodeURIComponent(m[1]).replace(/\+/g, ' ').trim();
    return name && name !== 'data' ? name : null;
  } catch {
    return null;
  }
}
