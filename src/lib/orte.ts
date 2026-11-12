import { entfernungKm } from './karten';
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
  const roh = (text ?? '').trim();
  const leer = roh.split(/\s+/).filter(Boolean);
  // zwei zahlen, die ein leerzeichen trennt: dann ist das komma der dezimaltrenner („51,5055 -0,0911“)
  const teile = leer.length === 2 && leer.every((t) => /^-?\d+(?:[.,]\d+)?$/.test(t)) ? leer : roh.split(/[,;\s]+/).filter(Boolean);
  const [lat, lng] = teile.map((t) => Number(t.replace(',', '.')));
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return { lat: null, lng: null };
  return { lat, lng };
}

/* ── die zweite quelle ohne schlüssel: Photon, die OpenStreetMap-Suche ────── */

export interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    [key: string]: unknown;
  };
}

/** klein, ohne akzente, ohne zeichen – „Big Ben." und „big  ben" werden gleich */
export function vergleichText(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** was photon zurückgibt: geojon, kein anzeige text – den bauen wir selbst */
export function ausPhoton(roh: { features?: PhotonFeature[] } | null): Ortsvorschlag[] {
  return (roh?.features ?? [])
    .map((f) => {
      const [lng, lat] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      const name = glatt(p.name);
      const stadt = glatt(p.city) || glatt(p.district) || glatt(p.state);
      const strasse = [glatt(p.street), glatt(p.housenumber)].filter(Boolean).join(' ');
      // die adresse fängt an, wo der name aufhört – das blatt zeigt beides untereinander
      const stücke = [strasse, glatt(p.postcode), stadt, glatt(p.state), glatt(p.country)].filter(Boolean).filter((teil) => teil !== name);
      const adresse = [...new Set(stücke)].join(', ');
      return {
        name: name || stadt || glatt(p.street) || '',
        adresse: glatt(adresse) || null,
        lat: Number(lat),
        lng: Number(lng),
        stichwort: glatt(p.type) || null,
        quelle: 'photon' as const,
      };
    })
    .filter((d) => d.name && Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

/**
 * Woher ein treffer kommt, in einem wort unter dem namen. Die beiden offenen
 * quellen sind dieselbe datenbank, also heißt sie hier auch dasselbe.
 */
export function quellenName(quelle: Ortsvorschlag['quelle']): string {
  return quelle === 'google' ? 'Google' : 'OpenStreetMap';
}

/**
 * Zählwerte für einen Treffer: der Name schlägt die Adresse, ein Ort schlägt eine
 * Flächenangabe, und was nahe an der Reise liegt, schlägt dasselbe Ding in einer
 * anderen Stadt. Ein negativer Wert heißt: passt nicht, fällt weg.
 */
const ORT_ART = ['attraction', 'historic', 'tourism', 'viewpoint', 'monument', 'memorial', 'castle', 'palace', 'tower', 'museum', 'theatre', 'stadium', 'place_of_worship', 'archaeological_site', 'botanical_garden', 'zoo', 'theme_park', 'beach', 'natural', 'peak', 'island', 'lake', 'river'];
const GROSSE_FLÄCHE = ['country', 'state', 'region', 'county', 'province', 'continent', 'administrative'];

export function ortPunkte(t: Ortsvorschlag, suchwort: string, nahe?: { lat: number; lng: number } | null): number {
  const frage = vergleichText(suchwort);
  const ziel = vergleichText(t.name);
  if (!frage || !ziel) return -1;
  let punkte = 0;
  if (ziel === frage) punkte += 130;
  else if (ziel.startsWith(frage)) punkte += 75;
  else if (ziel.includes(frage)) punkte += 50;
  else {
    const worte = new Set(ziel.split(' '));
    punkte += frage.split(' ').filter((w) => w.length > 2 && worte.has(w)).length * 14;
  }
  const art = vergleichText(t.stichwort);
  if (ORT_ART.includes(art)) punkte += 22;
  if (GROSSE_FLÄCHE.includes(art)) punkte -= 45;
  if (punkte <= 0) {
    const adresse = vergleichText(t.adresse);
    if (!adresse.includes(frage)) return -1;
    punkte += 18;
  } else if (punkte < 130 && vergleichText(t.adresse).includes(frage)) punkte += 12;
  if (nahe) {
    const km = entfernungKm({ lat: t.lat, lng: t.lng }, nahe);
    if (km !== null) {
      if (km <= 25) punkte += 42;
      else if (km <= 120) punkte += 26;
      else if (km <= 500) punkte += 10;
      else if (km > 3000) punkte -= 24;
    }
  }
  return punkte;
}

/**
 * Mehrere Trefferlisten zusammen mischen: dasselbe Ding von zwei Diensten bleibt
 * ein Vorschlag, der bessere vorn.
 */
export function stelleOrte(listen: Ortsvorschlag[][], opts: { suchwort: string; nahe?: { lat: number; lng: number } | null }): Ortsvorschlag[] {
  const beste = new Map<string, { treffer: Ortsvorschlag; punkte: number }>();
  for (const liste of listen) {
    for (const t of liste) {
      const punkte = ortPunkte(t, opts.suchwort, opts.nahe ?? null);
      if (punkte < 0) continue;
      const kern = `${t.lat.toFixed(3)},${t.lng.toFixed(3)}`;
      const bisher = beste.get(kern);
      if (!bisher || punkte > bisher.punkte) beste.set(kern, { treffer: t, punkte });
    }
  }
  return [...beste.values()]
    .sort((a, b) => b.punkte - a.punkte || a.treffer.name.length - b.treffer.name.length)
    .map((x) => x.treffer);
}

/**
 * Das brauchbarste bild aus den quellen, die gleichzeitig geantwortet haben: die
 * reihenfolge der liste sagt, wem zu trauen ist (google kennt das haus selbst,
 * unsplash und pexels kuratieren, commons hat, was die welt hochlud), und was
 * zuerst zurückkommt, gewinnt nicht automatisch.
 */
export function bestesBild(kandidaten: Array<Bildvorschlag | null>): Bildvorschlag | null {
  for (const bild of kandidaten) {
    if (bild?.url) return bild;
  }
  return null;
}

/**
 * Der kern einer frage. „big ben, Westminster, London, England" ist für eine
 * bildersuche zu viel gemeint: was vor dem ersten komma steht, ist das objekt.
 */
export function bildGrund(frage: string): string {
  const kern = glatt((frage ?? '').replace(/\(.*?\)/g, ' ').split(',')[0] ?? '');
  return kern.length >= 4 ? kern : '';
}

/** ob sich eine frage lohnt: zwei buchstaben, so im blatt wie auf dem server */
export function frageLohnt(text: string): boolean {
  return vergleichText(text).length >= 2;
}
