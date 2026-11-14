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
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  photos?: { name?: string; authorAttributions?: { displayName?: string }[] }[];
}

/** nur ein google-fotopfad, nie ein beliebiges ziel – die tür bleibt kein offener verteiler */
export const Fotopfad = /^places\/[\w.\-]{8,200}\/photos\/[\w.\-]{8,800}$/;

/** das erste Foto mit gültigem Pfad: Adresse zu unserer Tür, Nachweis mit dem Namen des Fotografen */
export function fotoAusGoogle(fotos: GoogleRoh['photos']): { url: string; nachweis: string | null } | null {
  const foto = (fotos ?? []).find((f) => typeof f.name === 'string' && Fotopfad.test(f.name));
  if (!foto?.name) return null;
  const autor = glatt(foto.authorAttributions?.[0]?.displayName);
  return { url: `/api/bild?foto=${encodeURIComponent(foto.name)}`, nachweis: autor ? `Foto: ${autor} / Google Maps` : 'Foto: Google Maps' };
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
      ...(p.id ? { google_id: p.id } : {}),
      ...(fotoAusGoogle(p.photos) ? { foto: fotoAusGoogle(p.photos) } : {}),
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

/* ── Städte und Regionen ohne Schlüssel: GeoNames über open-meteo ─────────── */

export interface GeoNamesRoh {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  feature_code?: string;
}

/** Orte, die in OpenStreetMap unter einem anderen Namen stehen („Tokio\") – die Suche kennt deutsche Namen */
export function ausGeoNames(roh: { results?: GeoNamesRoh[] } | null): Ortsvorschlag[] {
  return (roh?.results ?? [])
    .filter((d) => glatt(d.name) && Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
    .map((d) => ({
      name: glatt(d.name),
      adresse: [glatt(d.admin1), glatt(d.country)].filter(Boolean).join(', ') || null,
      lat: d.latitude as number,
      lng: d.longitude as number,
      stichwort: /^PPL|^ADM|^PRK|^ISL|^MT|^LK/.test(d.feature_code ?? '') ? 'city' : glatt(d.feature_code).toLowerCase() || null,
      quelle: 'geonames' as const,
    }));
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
  if (quelle === 'google') return 'Google';
  return quelle === 'geonames' ? 'GeoNames' : 'OpenStreetMap';
}

/**
 * Wörter, die eine Frage nur umgangssprachlich machen („hotel in kyoto“) – sie
 * entscheiden nichts, und kein Ort heißt so.
 */
const FUELLWORTE = new Set(['in', 'im', 'am', 'an', 'bei', 'der', 'die', 'das', 'dem', 'den', 'von', 'zu', 'zum', 'zur', 'und', 'the', 'of', 'at', 'near', 'and', 'de', 'la', 'le', 'el', 'di']);

/** deutsche Namen und Schreibweisen, unter denen OpenStreetMap den Ort nicht führt */
const ALIAS: Record<string, string> = {
  tokio: 'tokyo',
  kioto: 'kyoto',
  hirosima: 'hiroshima',
  wien: 'vienna',
  venedig: 'venezia',
  venice: 'venezia',
  florenz: 'firenze',
  florence: 'firenze',
  rom: 'roma',
  rome: 'roma',
  neapel: 'napoli',
  naples: 'napoli',
  mailand: 'milano',
  milan: 'milano',
  turin: 'torino',
  prag: 'praha',
  prague: 'praha',
  lissabon: 'lisboa',
  lisbon: 'lisboa',
  peking: 'beijing',
  kopenhagen: 'kobenhavn',
  copenhagen: 'kobenhavn',
  athen: 'athina',
  athens: 'athina',
};

const kernWort = (w: string) => ALIAS[w] ?? w;

/** die Wörter einer Frage, ohne Füllwörter – wenn nur Füllwörter da sind, bleiben sie */
export function frageWorte(text: string): string[] {
  const worte = vergleichText(text).split(' ').filter(Boolean);
  const kern = worte.filter((w) => !FUELLWORTE.has(w));
  return (kern.length ? kern : worte).map(kernWort);
}

/** ein Buchstabe Unterschied, ein Dreher, ein Ausfall – für „muenchen“ und „kyto“ */
function einFehler(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

/**
 * Steht das Wort der Frage in diesem Text? Genau, als Wortanfang („senso“ für
 * „sensoji“), unter einem anderen Namen oder mit einem Tippfehler.
 */
export function wortKommtVor(wort: string, ziel: string[]): boolean {
  // beide Seiten laufen durch dieselbe Tafel: „Venedig“ findet „Venice“ und umgekehrt
  const kern = kernWort(wort);
  return ziel.some((z) => {
    if (z === wort || kernWort(z) === kern) return true;
    if (wort.length >= 3 && z.startsWith(wort)) return true;
    return wort.length >= 5 && z.length >= 4 && einFehler(wort, z);
  });
}

/**
 * Zählwerte für einen Treffer: der Name schlägt die Adresse, ein Ort schlägt eine
 * Flächenangabe, und was nahe an der Reise liegt, schlägt dasselbe Ding in einer
 * anderen Stadt. Ein negativer Wert heißt: passt nicht, fällt weg. Gestrichen wird
 * nur, was gar kein Wort der Frage trägt – Name oder Adresse, auch unter anderem
 * Namen oder mit Tippfehler.
 */
const ORT_ART = ['attraction', 'historic', 'tourism', 'viewpoint', 'monument', 'memorial', 'castle', 'palace', 'tower', 'museum', 'theatre', 'stadium', 'place_of_worship', 'archaeological_site', 'botanical_garden', 'zoo', 'theme_park', 'beach', 'natural', 'peak', 'island', 'lake', 'river', 'city', 'temple', 'shrine'];
const GROSSE_FLÄCHE = ['country', 'state', 'region', 'county', 'province', 'continent', 'administrative'];

export function ortPunkte(t: Ortsvorschlag, suchwort: string, nahe?: { lat: number; lng: number } | null): number {
  const frage = vergleichText(suchwort);
  const ziel = vergleichText(t.name);
  if (!frage || !ziel) return -1;
  const worte = frageWorte(suchwort);
  const nameWorte = ziel.split(' ');
  const adressWorte = vergleichText(t.adresse).split(' ').filter(Boolean);
  const imNamen = worte.filter((w) => w.length > 1 && wortKommtVor(w, nameWorte)).length;
  const inAdresse = worte.filter((w) => w.length > 1 && wortKommtVor(w, adressWorte)).length;
  let punkte = 0;
  if (ziel === frage) punkte += 130;
  else if (ziel.startsWith(frage)) punkte += 75;
  else if (ziel.includes(frage)) punkte += 50;
  else if (imNamen) punkte += imNamen * 14 + (imNamen === worte.length ? 30 : 0);
  const art = vergleichText(t.stichwort);
  if (ORT_ART.includes(art)) punkte += 22;
  if (GROSSE_FLÄCHE.includes(art)) punkte -= 45;
  if (punkte <= 0) {
    // der Name sagt nichts – bleibt, wenn die Adresse die ganze Frage trägt
    if (!worte.length || inAdresse < worte.length) return -1;
    punkte += 18;
  } else if (punkte < 130) {
    // Wörter, die der Name nicht trägt („kyoto“ in „hotel in kyoto“), die Adresse aber
    punkte += Math.min(inAdresse, worte.length) * 8;
  }
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
 * ein Vorschlag, der bessere vorn. Google ordnet selbst nach Bedeutung und kennt
 * Namen, die kein Wort der Frage tragen („Tokio“ → „東京“): ein Google-Treffer
 * fällt nie weg, und seine Reihenfolge zählt.
 */
export function stelleOrte(listen: Ortsvorschlag[][], opts: { suchwort: string; nahe?: { lat: number; lng: number } | null }): Ortsvorschlag[] {
  const beste = new Map<string, { treffer: Ortsvorschlag; punkte: number }>();
  for (const liste of listen) {
    liste.forEach((t, rang) => {
      let punkte = ortPunkte(t, opts.suchwort, opts.nahe ?? null);
      if (t.quelle === 'google') punkte = Math.max(punkte, 0) + 70 - Math.min(rang, 20) * 3;
      if (punkte < 0) return;
      const kern = `${t.lat.toFixed(3)},${t.lng.toFixed(3)}`;
      const bisher = beste.get(kern);
      if (!bisher || punkte > bisher.punkte) beste.set(kern, { treffer: t, punkte });
    });
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
