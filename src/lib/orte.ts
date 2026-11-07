import type { Bildvorschlag, Ortsvorschlag } from './types';

/**
 * Formen, was die Anbieter liefern, in unsere zwei Typen. Steht absichtlich
 * getrennt vom Netzwerkteil, damit es allein prüfbar ist.
 */

const glatt = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
const ohne_html = (text: string | null | undefined) => glatt((text ?? '').replace(/<[^>]*>/g, ''));

export interface NominatimRoh {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  addresstype?: string;
}

export function ausOpenStreetMap(roh: NominatimRoh[]): Ortsvorschlag[] {
  return roh
    .filter((d) => d.display_name && d.lat && d.lon)
    .map((d) => {
      const teile = (d.display_name ?? '').split(',').map((t) => t.trim()).filter(Boolean);
      return {
        name: glatt(d.name) || teile[0] || '',
        adresse: glatt(d.display_name) || null,
        lat: Number(d.lat),
        lng: Number(d.lon),
        stichwort: glatt(d.addresstype) || glatt(d.type) || null,
        quelle: 'openstreetmap' as const,
      };
    })
    .filter((d) => d.name && Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

export interface GoogleRoh {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
}

export function ausGoogle(roh: { places?: GoogleRoh[] } | null): Ortsvorschlag[] {
  return (roh?.places ?? [])
    .filter((p) => Number.isFinite(p.location?.latitude) && Number.isFinite(p.location?.longitude) && glatt(p.displayName?.text))
    .map((p) => ({
      name: glatt(p.displayName?.text),
      adresse: glatt(p.formattedAddress) || null,
      lat: p.location!.latitude as number,
      lng: p.location!.longitude as number,
      stichwort: glatt(p.primaryType)?.split('.').pop() || null,
      quelle: 'google' as const,
    }));
}

export interface CommonsInfo {
  thumburl?: string;
  url?: string;
  mime?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<string, { value?: string }>;
}

/** Freie Bilder von Wikimedia Commons – mit dem Nachweis, den die Lizenz verlangt. */
export function ausCommons(roh: { query?: { pages?: Record<string, { imageinfo?: CommonsInfo[] }> } } | null, breite = 1.6): Bildvorschlag | null {
  const treffer = Object.values(roh?.query?.pages ?? {})
    .map((s) => s.imageinfo?.[0])
    .filter((i): i is CommonsInfo & { thumburl: string } => Boolean(i?.thumburl) && Boolean(i?.mime?.startsWith('image/')) && !/\.(svg|gif)$/i.test(i?.url ?? ''));
  const beste = treffer
    .map((bild) => ({ bild, abweichung: Math.abs((bild.width ?? 0) / Math.max(1, bild.height ?? 1) - breite) }))
    .sort((a, b) => a.abweichung - b.abweichung)[0]?.bild;
  if (!beste) return null;
  const kuenstler = ohne_html(beste.extmetadata?.Artist?.value);
  const lizenz = ohne_html(beste.extmetadata?.LicenseShortName?.value);
  return {
    url: beste.thumburl,
    nachweis: [kuenstler, lizenz].filter(Boolean).join(' · ') || 'Wikimedia Commons',
    quelle: 'Wikimedia Commons',
  };
}

export interface UnsplashRoh {
  results?: { urls?: { regular?: string }; user?: { name?: string }; alt_description?: string }[];
}

export function ausUnsplash(roh: UnsplashRoh | null): Bildvorschlag | null {
  const bild = roh?.results?.[0];
  if (!bild?.urls?.regular) return null;
  return { url: bild.urls.regular, nachweis: bild.user?.name ? `Foto: ${glatt(bild.user.name)} / Unsplash` : null, quelle: 'Unsplash' };
}

export interface PexelsRoh {
  photos?: { src?: { large?: string }; user?: { name?: string } }[];
}

export function ausPexels(roh: PexelsRoh | null): Bildvorschlag | null {
  const bild = roh?.photos?.[0];
  if (!bild?.src?.large) return null;
  return { url: bild.src.large, nachweis: bild.user?.name ? `Foto: ${glatt(bild.user.name)} / Pexels` : null, quelle: 'Pexels' };
}

/**
 * Die Stadt aus einer Adresse: von hinten nach vorn, ohne Postleitzahl und ohne
 * das Land, das schon über der Reise steht.
 */
export function stadtAusAdresse(adresse: string | null, land?: string | null): string | null {
  const teile = (adresse ?? '').split(',').map((t) => glatt(t)).filter(Boolean);
  for (let i = teile.length - 1; i >= 0; i -= 1) {
    const t = teile[i]!;
    if (/^[\d\s-]+$/.test(t)) continue;
    if (land && t.toLowerCase() === glatt(land).toLowerCase()) continue;
    if (t.split(/\s+/).length > 4) continue;
    return t;
  }
  return null;
}

/** „35.0116, 135.7681" → Punkt; Unsinniges → kein Punkt */
export function punktAusText(text: string): { lat: number | null; lng: number | null } {
  const [lat, lng] = (text ?? '').split(/[,;\s]+/).filter(Boolean).map(Number);
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return { lat: null, lng: null };
  return { lat, lng };
}
