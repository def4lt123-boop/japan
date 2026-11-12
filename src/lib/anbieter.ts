import {
  ausCommons,
  ausGoogle,
  ausOpenStreetMap,
  ausPexels,
  ausPhoton,
  ausUnsplash,
  bestesBild,
  bildGrund,
  stelleOrte,
  vergleichText,
  type CommonsInfo,
  type GoogleRoh,
  type NominatimRoh,
  type PhotonFeature,
  type PexelsRoh,
  type UnsplashRoh,
} from '../lib/orte';
import type { Bildvorschlag, Ortsvorschlag } from '../lib/types';

/**
 * Providerschicht für Suche und Bilder – läuft nur auf dem Server, damit ein
 * Schlüssel nie im Browser landet. Ohne Schlüssel sprechen wir die freien
 * Quellen an; mit Google- oder Unsplash-Schlüssel wird dasselbe Formular besser.
 */

export const SIEHBT_GOOGLE = Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY);
export const SIEHBT_BILDDIENST = Boolean(process.env.UNSPLASH_ACCESS_KEY || process.env.PEXELS_API_KEY);

/**
 * Eine quelle, die 429 (oder 503) sagt, wird nicht weiter gefragt: bis zum ende
 * ihrer frist bleibt sie zu, und die antwort der suche trägt das wort „brems" –
 * gebremst wird dabei immer nur die eine quelle, nie die nachbarn.
 * danach halten die blätter länger inne. Wer eine zuwandte tür weiter anstupst,
 * bekommt länger nichts.
 */
const gebremst_bis = new Map<string, number>();
let brems_gemeldet = false;

const ruhe = (antwort: Response) => {
  const kopf = Number(antwort.headers.get('retry-after') ?? '');
  const sekunden = Number.isFinite(kopf) && kopf > 0 ? kopf : 10;
  return Math.min(90, Math.max(5, sekunden)) * 1000;
};

function gebremst(name: string, jetzt = Date.now()): boolean {
  return (gebremst_bis.get(name) ?? 0) > jetzt;
}

function bremse(name: string, ms: number, jetzt = Date.now()): void {
  gebremst_bis.set(name, jetzt + ms);
  brems_gemeldet = true;
}

/**
 * Wurde die letzte suche gebremst? die tür der app liest das nach dem suchlauf und
 * sagt es dem blatt weiter – das hält dann länger inne, statt eine zuwandte tür
 * weiter anzustupsen. Verbraucht wird die meldung nicht: sie gilt für den lauf.
 */
export function bremsZuletzt(): boolean {
  return brems_gemeldet;
}

async function hole(url: string, init?: RequestInit, frist = 5000, quelle = 'karte'): Promise<Response | null> {
  if (gebremst(quelle)) return null;
  try {
    const antwort = await fetch(url, { ...init, signal: AbortSignal.timeout(frist), cache: 'default' });
    if (antwort.status === 429 || antwort.status === 503) {
      bremse(quelle, ruhe(antwort));
      return null;
    }
    return antwort.ok ? antwort : null;
  } catch {
    return null;
  }
}

/* ── Orte ─────────────────────────────────────────────────────────────── */

async function beiGoogle(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY;
  if (!key) return [];
  const antwort = await hole(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.primaryType',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'de', maxResultCount: 8, ...(nah ? { locationBias: { circle: { center: { latitude: nah.lat, longitude: nah.lng }, radius: 50000 } } } : {}) }),
    },
    undefined,
    'google',
  );
  if (!antwort) return [];
  return ausGoogle((await antwort.json()) as { places?: GoogleRoh[] });
}

/** beide freien Quellen wollen wissen, wer da fragt – ohne das antworten sie nicht */
const FRAGEKOPF = {
  'User-Agent': 'Reiseplan/1.0 (personliche Reiseplanung, urlaubs-plan.vercel.app)',
  Referer: 'https://urlaubs-plan.vercel.app',
  Accept: 'application/json',
} as const;

async function beiOpenStreetMap(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('accept-language', 'de');
  url.searchParams.set('q', q);
  if (nah) {
    url.searchParams.set('viewbox', `${nah.lng - 2} ${nah.lat + 2} ${nah.lng + 2} ${nah.lat - 2}`);
    url.searchParams.set('bounded', '0');
  }
  const antwort = await hole(url.toString(), { headers: FRAGEKOPF }, 5000, 'nominatim');
  if (!antwort) return [];
  return ausOpenStreetMap((await antwort.json()) as NominatimRoh[]);
}

/**
 * Photon ist die Suche von OpenStreetMap: sie denkt bei kurzen, umgangssprachlichen
 * fragen mit („big ben") und verzeiht kleinbuchstaben. Gleiche datenbank, anderer
 * kopf – deshalb laufen beide, und einer von beiden reicht schon.
 */
async function beiPhoton(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('lang', 'de');
  url.searchParams.set('limit', '10');
  if (nah) {
    url.searchParams.set('lat', String(nah.lat));
    url.searchParams.set('lon', String(nah.lng));
  }
  const antwort = await hole(url.toString(), { headers: FRAGEKOPF }, 5000, 'photon');
  if (!antwort) return [];
  return ausPhoton((await antwort.json()) as { features?: PhotonFeature[] });
}

/**
 * Antworten bleiben eine weile hier stehen: dieselbe frage kostet nichts mehr, und
 * die freien quellen werden nicht von jedem einzelnen buchstaben belästigt.
 */
const gemerkte_fragen = new Map<string, { orte: Ortsvorschlag[]; bis: number }>();
const FRIST_TREFFER = 30 * 60 * 1000;
const FRIST_LEER = 3 * 60 * 1000;
const ABSTAND_UNTER_EINANDER = 1100; // gebrauchspolicy von nominatim: höchstens ~1 anfrage pro sekunde
let anfrage_zuletzt = 0;

/**
 * Zwei nähte für den test, damit die staffel prüfbar bleibt, ohne dass sie ihre
 * regeln verliert: die bremse lösen (das gedächtnis bleibt) und das gedächtnis
 * leeren (die bremsen bleiben).
 */
export function bremsenVergessen(): void {
  gebremst_bis.clear();
  anfrage_zuletzt = 0;
  brems_gemeldet = false;
}

export function fragegedaechtnisVergessen(): void {
  gemerkte_fragen.clear();
}

export async function orteSuchen(q: string, nah?: { lat: number; lng: number } | null, frisch = false): Promise<Ortsvorschlag[]> {
  brems_gemeldet = false;
  const suchwort = q.trim();
  const anfrage = vergleichText(suchwort);
  if (anfrage.length < 2) return [];
  const anker = nah ? `@${nah.lat.toFixed(2)},${nah.lng.toFixed(2)}` : '';
  const schlüssel = `${anfrage}${anker}`;
  const gemerkt = frisch ? undefined : gemerkte_fragen.get(schlüssel);
  if (gemerkt && gemerkt.bis > Date.now()) return gemerkt.orte;
  const leistungen: Array<Promise<Ortsvorschlag[]>> = [];
  if (SIEHBT_GOOGLE) leistungen.push(beiGoogle(suchwort, nah));
  leistungen.push(beiPhoton(suchwort, nah));
  // nominatim will höchstens eine anfrage pro sekunde: wer in die frist hineinfragt,
  // der lässt es in dieser runde lieber – eine ausfallende quelle ist eine halbe
  // antwort, ein „zu schnell" ist eine bitte um pause
  const jetzt = Date.now();
  if (jetzt - anfrage_zuletzt >= ABSTAND_UNTER_EINANDER && !gebremst('nominatim', jetzt)) {
    anfrage_zuletzt = jetzt;
    leistungen.push(beiOpenStreetMap(suchwort, nah));
  }
  const ergebnisse = await Promise.allSettled(leistungen);
  const orte = stelleOrte(
    ergebnisse.map((r) => (r.status === 'fulfilled' ? r.value : [])),
    { suchwort, nahe: nah ?? null },
  ).slice(0, 8);
  if (gemerkte_fragen.size > 300) gemerkte_fragen.clear();
  // eine leere hand mitten in einer bremse ist keine antwort: sie wird nicht
  // gemerkt, sonst hinge „kein punkt" eine zeitlang über jedem weiteren versuch
  if (orte.length) gemerkte_fragen.set(schlüssel, { orte, bis: Date.now() + FRIST_TREFFER });
  else if (!brems_gemeldet) gemerkte_fragen.set(schlüssel, { orte, bis: Date.now() + FRIST_LEER });
  return orte;
}

export { frageLohnt } from '../lib/orte';

/* ── Bilder ───────────────────────────────────────────────────────────── */

async function beiUnsplash(q: string): Promise<Bildvorschlag | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const antwort = await hole(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`, { headers: { Authorization: `Client-ID ${key}`, Accept: 'application/json' } }, 5000, 'unsplash');
  if (!antwort) return null;
  return ausUnsplash((await antwort.json()) as UnsplashRoh);
}

async function beiPexels(q: string): Promise<Bildvorschlag | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const antwort = await hole(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`, { headers: { Authorization: key, Accept: 'application/json' } }, 5000, 'pexels');
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
  const antwort = await hole(url.toString(), undefined, 5000, 'commons');
  if (!antwort) return null;
  const roh = (await antwort.json()) as { query?: { pages?: Record<string, { imageinfo?: CommonsInfo[] }> } };
  return ausCommons(roh);
}

/**
 * Das Foto eines Ortes von Google: die places-api kennt es zu beinahe jedem
 * Hotel und jeder Sehenswürdigkeit. Der Schlüssel bleibt im Server – das Bild
 * wird durch unsere eigene tür gereicht (see /api/bild?foto=…), damit er nie
 * im blatt oder im eintrag landet.
 */
async function beiGoogleFoto(q: string): Promise<Bildvorschlag | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY;
  if (!key) return null;
  const antwort = await hole(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.photos',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'de', maxResultCount: 3 }),
    },
    undefined,
    'google',
  );
  if (!antwort) return null;
  const roh = (await antwort.json()) as { places?: { photos?: { name?: string }[] }[] };
  const name = (roh.places ?? []).flatMap((p) => p.photos ?? []).map((f) => f.name).find((n) => typeof n === 'string' && Fotopfad.test(n));
  if (!name) return null;
  return { url: `/api/bild?foto=${encodeURIComponent(name)}`, nachweis: 'Foto: Google Places', quelle: 'Google' };
}

/** nur ein google-fotopfad, nie ein beliebiges ziel – die tür bleibt kein offener verteiler */
export const Fotopfad = /^places\/[\w.\-]{8,180}\/photos\/[\w.\-]{8,180}$/;

export async function googleBild(name: string): Promise<Response | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY;
  if (!key || !Fotopfad.test(name)) return null;
  const antwort = await hole(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&key=${key}`, undefined, 8000, 'google-foto');
  return antwort && antwort.body ? antwort : null;
}

/**
 * Eine frage an alle bildquellen, die etwas zu sagen haben – gleichzeitig, damit eine,
 * die nicht antwortet, die anderen nicht aufhält. Was genommen wird, sagt die rangfolge
 * der liste, nicht welche antwort zuerst eintrifft.
 */
async function beiDenBildquellen(suchwort: string): Promise<Bildvorschlag | null> {
  const kandidaten: Array<Promise<Bildvorschlag | null>> = [];
  if (SIEHBT_GOOGLE) kandidaten.push(beiGoogleFoto(suchwort));
  kandidaten.push(process.env.UNSPLASH_ACCESS_KEY ? beiUnsplash(suchwort) : beiPexels(suchwort));
  kandidaten.push(beiWikimedia(suchwort));
  const ergebnisse = await Promise.allSettled(kandidaten);
  return bestesBild(ergebnisse.map((r) => (r.status === 'fulfilled' ? r.value : null)));
}

/**
 * Das bild zum ort. Findet die ganze frage nichts, wird sie auf ihren kern gekürzt –
 * „big ben, Westminster, London, England" malt nirgends ein haus, „big ben" malt das
 * falsche ufer, aber „big ben" allein steht an jeder quelle für genau diesen turm.
 */
export async function bildFinden(q: string): Promise<Bildvorschlag | null> {
  const suchwort = (q ?? '').replace(/\s+/g, ' ').trim();
  if (suchwort.length < 3) return null;
  const fund = await beiDenBildquellen(suchwort);
  if (fund) return fund;
  const kern = bildGrund(suchwort);
  return kern && kern !== suchwort ? beiDenBildquellen(kern) : null;
}
