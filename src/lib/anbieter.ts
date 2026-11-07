import { ausGoogle, ausOpenStreetMap, ausCommons, ausPexels, ausUnsplash, type CommonsInfo, type GoogleRoh, type NominatimRoh, type PexelsRoh, type UnsplashRoh } from '../lib/orte';
import type { Bildvorschlag, Ortsvorschlag } from '../lib/types';

/**
 * Providerschicht für Suche und Bilder – läuft nur auf dem Server, damit ein
 * Schlüssel nie im Browser landet. Ohne Schlüssel sprechen wir die freien
 * Quellen an; mit Google- oder Unsplash-Schlüssel wird dasselbe Formular besser.
 */

export const SIEHBT_GOOGLE = Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY);
export const SIEHBT_BILDDIENST = Boolean(process.env.UNSPLASH_ACCESS_KEY || process.env.PEXELS_API_KEY);

async function hole(url: string, init?: RequestInit, frist = 5000): Promise<Response | null> {
  try {
    const antwort = await fetch(url, { ...init, signal: AbortSignal.timeout(frist), cache: 'default' });
    return antwort.ok ? antwort : null;
  } catch {
    return null;
  }
}

/* ── Orte ─────────────────────────────────────────────────────────────── */

async function beiGoogle(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY;
  if (!key) return [];
  const antwort = await hole('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.primaryType',
    },
    body: JSON.stringify({ textQuery: q, languageCode: 'de', maxResultCount: 8, ...(nah ? { locationBias: { circle: { center: { latitude: nah.lat, longitude: nah.lng }, radius: 50000 } } } : {}) }),
  });
  if (!antwort) return [];
  return ausGoogle((await antwort.json()) as { places?: GoogleRoh[] });
}

async function beiOpenStreetMap(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('accept-language', 'de');
  url.searchParams.set('q', q);
  if (nah) {
    url.searchParams.set('viewbox', `${nah.lng - 0.4} ${nah.lat + 0.4} ${nah.lng + 0.4} ${nah.lat - 0.4}`);
    url.searchParams.set('bounded', '0');
  }
  const antwort = await hole(url.toString(), { headers: { 'User-Agent': 'Reiseplan (personliche Reiseplanung)', Accept: 'application/json' } });
  if (!antwort) return [];
  return ausOpenStreetMap((await antwort.json()) as NominatimRoh[]);
}

export async function orteSuchen(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[]> {
  const suchwort = q.trim();
  if (suchwort.length < 2) return [];
  const treffer = SIEHBT_GOOGLE ? await beiGoogle(suchwort, nah) : [];
  if (treffer.length) return treffer;
  return beiOpenStreetMap(suchwort, nah);
}

/* ── Bilder ───────────────────────────────────────────────────────────── */

async function beiUnsplash(q: string): Promise<Bildvorschlag | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const antwort = await hole(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`, { headers: { Authorization: `Client-ID ${key}`, Accept: 'application/json' } });
  if (!antwort) return null;
  return ausUnsplash((await antwort.json()) as UnsplashRoh);
}

async function beiPexels(q: string): Promise<Bildvorschlag | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const antwort = await hole(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`, { headers: { Authorization: key, Accept: 'application/json' } });
  if (!antwort) return null;
  return ausPexels((await antwort.json()) as PexelsRoh);
}

async function beiWikimedia(q: string): Promise<Bildvorschlag | null> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `filetype:bitmap ${q}`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '10');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|mime|size');
  url.searchParams.set('iiurlwidth', '900');
  const antwort = await hole(url.toString());
  if (!antwort) return null;
  const roh = (await antwort.json()) as { query?: { pages?: Record<string, { imageinfo?: CommonsInfo[] }> } };
  return ausCommons(roh);
}

/** Erst die Dienste mit Schlüssel, dann das freie Commons-Bild. */
export async function bildFinden(q: string): Promise<Bildvorschlag | null> {
  const suchwort = q.trim();
  if (suchwort.length < 3) return null;
  const bezahlt = process.env.UNSPLASH_ACCESS_KEY ? await beiUnsplash(suchwort) : await beiPexels(suchwort);
  if (bezahlt) return bezahlt;
  return beiWikimedia(suchwort);
}
