import {
  ausCommons,
  ausGeoNames,
  ausGoogle,
  fotoAusGoogle,
  Fotopfad,
  type GeoNamesRoh,
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
import { linieAusText } from './linie';
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
    // 403 heißt bei den offenen Diensten „diese Adresse ist gesperrt“, bei Google „Schlüssel
    // oder freigeschaltete API stimmt nicht“ – in beiden Fällen hilft Nachfragen im Sekundentakt nicht
    if (antwort.status === 403 || antwort.status === 401) {
      bremse(quelle, 60_000);
      if (quelle.startsWith('google')) console.error(`[${quelle}] ${antwort.status}`, (await antwort.text().catch(() => '')).slice(0, 300));
      return null;
    }
    if (!antwort.ok && quelle.startsWith('google')) console.error(`[${quelle}] ${antwort.status}`, (await antwort.text().catch(() => '')).slice(0, 300));
    return antwort.ok ? antwort : null;
  } catch {
    return null;
  }
}

/* ── Orte ─────────────────────────────────────────────────────────────── */

const googleKey = () => process.env.GOOGLE_MAPS_API_KEY || process.env.PLACES_API_KEY;

/**
 * Google Places (neu), Textsuche: dieselbe Suche wie im Suchfeld von Google Maps –
 * versteht „big ben“, „hotel in kyoto“, deutsche Namen und Tippfehler, und liefert
 * in einer Antwort Name, Adresse, Punkt, Place-ID und Foto. `null` heißt: nicht erreichbar.
 */
async function beiGoogle(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[] | null> {
  const key = googleKey();
  if (!key) return null;
  const antwort = await hole(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.photos',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'de', maxResultCount: 8, ...(nah ? { locationBias: { circle: { center: { latitude: nah.lat, longitude: nah.lng }, radius: 50000 } } } : {}) }),
    },
    6000,
    'google',
  );
  if (!antwort) return null;
  return ausGoogle((await antwort.json().catch(() => ({}))) as { places?: GoogleRoh[] });
}

/** beide freien Quellen wollen wissen, wer da fragt – ohne das antworten sie nicht */
const FRAGEKOPF = {
  'User-Agent': 'Reiseplan/1.0 (personliche Reiseplanung, urlaubs-plan.vercel.app)',
  Referer: 'https://urlaubs-plan.vercel.app',
  Accept: 'application/json',
} as const;

async function beiOpenStreetMap(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[] | null> {
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
  if (!antwort) return null;
  return ausOpenStreetMap((await antwort.json().catch(() => [])) as NominatimRoh[]);
}

/**
 * Photon ist die Suche von OpenStreetMap: sie denkt bei kurzen, umgangssprachlichen
 * fragen mit („big ben\") und verzeiht kleinbuchstaben. Gleiche datenbank, anderer
 * kopf – deshalb laufen beide, und einer von beiden reicht schon.
 */
async function beiPhoton(q: string, nah?: { lat: number; lng: number } | null): Promise<Ortsvorschlag[] | null> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('lang', 'de');
  url.searchParams.set('limit', '10');
  if (nah) {
    url.searchParams.set('lat', String(nah.lat));
    url.searchParams.set('lon', String(nah.lng));
  }
  const antwort = await hole(url.toString(), { headers: FRAGEKOPF }, 5000, 'photon');
  if (!antwort) return null;
  return ausPhoton((await antwort.json().catch(() => ({}))) as { features?: PhotonFeature[] });
}

/**
 * Städte und Regionen unter ihrem deutschen Namen („Tokio“, „Kioto“): GeoNames über
 * den offenen Geocoder von open-meteo – ohne Schlüssel, ohne Sekundentakt. Nur für
 * Fragen, die wie ein Ortsname aussehen, nicht für „hotel in kyoto“.
 */
async function beiGeoNames(q: string): Promise<Ortsvorschlag[] | null> {
  if (q.trim().split(/\s+/).length > 3) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'de');
  url.searchParams.set('format', 'json');
  const antwort = await hole(url.toString(), { headers: FRAGEKOPF }, 4000, 'geonames');
  if (!antwort) return null;
  return ausGeoNames((await antwort.json().catch(() => ({}))) as { results?: GeoNamesRoh[] });
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
  // `null` heißt „diese Quelle hat nicht geantwortet“, `[]` heißt „hat geantwortet: nichts“ –
  // nur das zweite darf als Antwort gelten und gemerkt werden
  const leistungen: Array<Promise<Ortsvorschlag[] | null>> = [];
  // google zuerst: nur wer einen schlüssel hat; erst ab drei zeichen, jede Frage kostet dort
  if (SIEHBT_GOOGLE && anfrage.length >= 3) leistungen.push(beiGoogle(suchwort, nah));
  leistungen.push(beiPhoton(suchwort, nah));
  leistungen.push(beiGeoNames(suchwort));
  // nominatim will höchstens eine anfrage pro sekunde: wer in die frist hineinfragt,
  // der lässt es in dieser runde lieber – das ist keine ausfallende quelle
  const jetzt = Date.now();
  if (jetzt - anfrage_zuletzt >= ABSTAND_UNTER_EINANDER && !gebremst('nominatim', jetzt)) {
    anfrage_zuletzt = jetzt;
    leistungen.push(beiOpenStreetMap(suchwort, nah));
  }
  const ergebnisse = await Promise.allSettled(leistungen);
  const antworten = ergebnisse.map((r) => (r.status === 'fulfilled' ? r.value : null));
  const orte = stelleOrte(
    antworten.map((a) => a ?? []),
    { suchwort, nahe: nah ?? null },
  ).slice(0, 8);
  const alleAusgefallen = antworten.every((a) => a === null);
  // wenn nichts geantwortet hat, ist die tür zu – nicht „kein ort gefunden“
  if (alleAusgefallen) brems_gemeldet = true;
  if (gemerkte_fragen.size > 300) gemerkte_fragen.clear();
  // eine leere hand ist nur dann eine antwort, wenn alle gefragten quellen geantwortet haben
  if (orte.length) gemerkte_fragen.set(schlüssel, { orte, bis: Date.now() + FRIST_TREFFER });
  else if (!brems_gemeldet && antworten.every((a) => a !== null)) gemerkte_fragen.set(schlüssel, { orte, bis: Date.now() + FRIST_LEER });
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
  const key = googleKey();
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
    6000,
    'google',
  );
  if (!antwort) return null;
  const roh = (await antwort.json().catch(() => ({}))) as { places?: GoogleRoh[] };
  // der erste Ort mit Foto – in der Reihenfolge, die Google für die Frage für richtig hält
  for (const ort of roh.places ?? []) {
    const foto = fotoAusGoogle(ort.photos);
    if (foto) return { url: foto.url, nachweis: foto.nachweis, quelle: 'Google' };
  }
  return null;
}

export async function googleBild(name: string): Promise<Response | null> {
  const key = googleKey();
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

/* ── Wege: Google Routes (wie in Google Maps), wenn ein Schlüssel da ist ──── */

type GoogleModus = 'WALK' | 'BICYCLE' | 'DRIVE' | 'TRANSIT';
const GOOGLE_MODI: Record<string, GoogleModus> = { 'zu fuss': 'WALK', rad: 'BICYCLE', auto: 'DRIVE', bahn: 'TRANSIT' };

export interface GoogleWeg {
  km: number;
  minuten: number;
  strecke?: [number, number][];
}

export interface GoogleTabelle {
  minuten: number[][];
  km: number[][];
}

const wegpunkt = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const sekundenAus = (text: string | undefined) => Number.parseInt(text ?? '', 10);

/**
 * Bahn und Bus haben Fahrpläne: ohne Zeitangabe rechnet Google mit „jetzt“, und wo
 * gerade Nacht ist, fährt nichts. Gerechnet wird mit dem nächsten Morgen um
 * zehn Uhr Ortszeit (der Ort steckt im Längengrad).
 */
export function naechsterMorgen(lng: number, jetzt = new Date()): string {
  const versatz = Math.round(lng / 15) * 3_600_000;
  const lokal = new Date(jetzt.getTime() + versatz);
  const ziel = new Date(Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth(), lokal.getUTCDate(), 10));
  if (lokal.getUTCHours() >= 9) ziel.setUTCDate(ziel.getUTCDate() + 1);
  return new Date(ziel.getTime() - versatz).toISOString();
}

const gemerkte_wege = new Map<string, { weg: GoogleWeg | null; bis: number }>();
const FRIST_WEG = 24 * 60 * 60 * 1000;

export function wegegedaechtnisVergessen(): void {
  gemerkte_wege.clear();
}

/** Ein Weg von A nach B so, wie ihn Google Maps rechnet – zu Fuß, mit Rad, Auto oder mit Bahn und Bus. */
export async function googleWeg(
  von: { lat: number; lng: number },
  nach: { lat: number; lng: number },
  modus: string,
  mitStrecke = false,
): Promise<GoogleWeg | null> {
  const key = googleKey();
  if (!key) return null;
  const art = GOOGLE_MODI[modus] ?? 'WALK';
  const schluessel = `${art}|${von.lat.toFixed(4)},${von.lng.toFixed(4)}|${nach.lat.toFixed(4)},${nach.lng.toFixed(4)}`;
  const gemerkt = gemerkte_wege.get(schluessel);
  // ein Fund mit Strecke genügt auch der Frage ohne – umgekehrt nicht
  if (gemerkt && gemerkt.bis > Date.now() && gemerkt.weg && (!mitStrecke || gemerkt.weg.strecke)) return gemerkt.weg;
  const antwort = await hole(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': ['routes.duration', 'routes.distanceMeters', ...(mitStrecke ? ['routes.polyline.encodedPolyline'] : [])].join(','),
      },
      body: JSON.stringify({
        origin: wegpunkt(von),
        destination: wegpunkt(nach),
        travelMode: art,
        languageCode: 'de',
        units: 'METRIC',
        ...(art === 'TRANSIT' ? { departureTime: naechsterMorgen(von.lng) } : {}),
      }),
    },
    8000,
    'google-route',
  );
  if (!antwort) return null;
  const roh = (await antwort.json().catch(() => ({}))) as { routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };
  const route = roh.routes?.[0];
  const sekunden = sekundenAus(route?.duration);
  // keine Strecke (derselbe Ort, oder Google kennt dort keinen Weg) ist keine Antwort
  if (!route || !Number.isFinite(sekunden) || !route.distanceMeters || route.distanceMeters < 1) return null;
  const fund: GoogleWeg = {
    km: Math.round((route.distanceMeters / 1000) * 10) / 10,
    minuten: Math.max(1, Math.round(sekunden / 60)),
    ...(mitStrecke && route.polyline?.encodedPolyline ? { strecke: linieAusText(route.polyline.encodedPolyline) } : {}),
  };
  if (gemerkte_wege.size > 500) gemerkte_wege.clear();
  gemerkte_wege.set(schluessel, { weg: fund, bis: Date.now() + FRIST_WEG });
  return fund;
}

/**
 * Die Wege durch eine Gruppe in einer Frage: Google rechnet jede Richtung gegen
 * jede. Fahrplanwege dürfen höchstens hundert Felder haben, also zehn Halte.
 */
export async function googleTabelle(punkte: { lat: number; lng: number }[], modus: string): Promise<GoogleTabelle | null> {
  const key = googleKey();
  const n = punkte.length;
  const art = GOOGLE_MODI[modus] ?? 'WALK';
  if (!key || n < 2 || n > 12 || (art === 'TRANSIT' && n * n > 100)) return null;
  const antwort = await hole(
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
      },
      body: JSON.stringify({
        origins: punkte.map((p) => ({ waypoint: wegpunkt(p) })),
        destinations: punkte.map((p) => ({ waypoint: wegpunkt(p) })),
        travelMode: art,
        ...(art === 'TRANSIT' ? { departureTime: naechsterMorgen(punkte[0]!.lng) } : {}),
      }),
    },
    10000,
    'google-matrix',
  );
  if (!antwort) return null;
  const roh = (await antwort.json().catch(() => null)) as { originIndex?: number; destinationIndex?: number; duration?: string; distanceMeters?: number; condition?: string }[] | null;
  if (!Array.isArray(roh) || !roh.length) return null;
  const minuten = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => (a === b ? 0 : Number.POSITIVE_INFINITY)));
  const km = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  let gefunden = 0;
  for (const feld of roh) {
    const a = feld.originIndex ?? -1;
    const b = feld.destinationIndex ?? -1;
    if (a < 0 || b < 0 || a >= n || b >= n || a === b) continue;
    const sekunden = sekundenAus(feld.duration);
    if (feld.condition !== 'ROUTE_EXISTS' || !Number.isFinite(sekunden)) continue;
    minuten[a]![b] = Math.max(1, Math.round(sekunden / 60));
    km[a]![b] = Math.round(((feld.distanceMeters ?? 0) / 1000) * 10) / 10;
    gefunden += 1;
  }
  // eine Tabelle ohne einen einzigen Weg hilft keiner Gruppe
  return gefunden ? { minuten, km } : null;
}
