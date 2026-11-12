/**
 * Der manuelle weg zum punkt, wenn die suche nichts findet: der link aus Google
 * Maps wird reingesetzt, der punkt kommt daraus. Gelesen wird, was in einer karte
 * steht – das @ in der mitte, die zahlen in den datenklammern, die suche, der
 * geo-verweis, auch die karten von openstreetmap.
 *
 * Ein kurzer link aus dem teilen-knopf (maps.app.goo.gl) trägt den punkt nicht
 * selbst, ein verweis führt erst hin. Der wird über den dienst der app nachgezogen
 * – einem fremden verweis hinterherzulaufen ist nichts für den brinator. Und wenn
 * nichts zählbares dasteht, wird nichts geschrieben: lieber kein punkt als ein
 * falscher.
 */

export interface Kartenpunkt {
  lat: number;
  lng: number;
  /** der name, der im link mitgeht – kann da sein, muss nicht */
  name: string | null;
  /** who hat den punkt hergegeben: Google Maps, OpenStreetMap, oder die zahl selbst */
  quelle: string;
}

/** warum es keinen punkt gibt – das feld sagt genau das, was zu tun ist */
export type KartenGrund = 'zu kurz' | 'kein punkt' | 'nichts';

const ZAHL = String.raw`-?\d{1,3}(?:\.\d+|,\d{1,8})`;
/** eine gradzahl in einer karte: ziffern, dann das dezimal – das komma gehört zwei zahlen */
const KOORD = String.raw`-?\d{1,3}(?:[.,]\d+)`;
const paarweise = (a: string, trenner: string, b: string, flaggen = 'u') => new RegExp(`${a}(${KOORD})${trenner}(${KOORD})${b}`, flaggen);
const KLAMMER = paarweise(String.raw`!3d`, '!4d', '');
const MITTE = paarweise('@', ',', '');
const KARTE = paarweise(String.raw`#map=\d+(?:\.\d+)?/`, '/', '');
const GERAHMT = paarweise('(?:marker|center)=', '[,/]', '');
const GEO = /^geo:(-?[\d.,/-]+)/iu;
const PAAR = new RegExp(String.raw`^\s*(${ZAHL})\s*[,;\s]\s*(${ZAHL})\s*$`, 'u');
const KURZ = /(?:^|\/\/)(?:goo\.gl|maps\.app\.goo\.gl)\//iu;

const grad = (wert: string | null | undefined, höchstens: number): number | null => {
  const text = (wert ?? '').trim();
  if (!text) return null;
  const zahl = Number(text.replace(',', '.'));
  if (!Number.isFinite(zahl) || Math.abs(zahl) > höchstens) return null;
  // kaufmännisch auf sechs stellen – vorzeichen hin oder her
  return (Math.sign(zahl) * Math.round(Math.abs(zahl) * 1e6)) / 1e6;
};

function paar(a: string | null | undefined, b: string | null | undefined): { lat: number; lng: number } | null {
  const lat = grad(a, 90);
  const lng = grad(b, 180);
  if (lat === null || lng === null) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** zwei zahlen, komma- oder leer-getrennt, mit punkt oder komma hinter dem dezimal */
function paarAusText(text: string): { lat: number; lng: number } | null {
  const treffer = PAAR.exec(text ?? '');
  if (treffer) return paar(treffer[1], treffer[2]);
  const teile = (text ?? '').split(/[,;\s]+/).filter(Boolean);
  return teile.length === 2 ? paar(teile[0], teile[1]) : null;
}

function entziffern(teil: string | null | undefined): string | null {
  const roh = (teil ?? '').trim();
  if (!roh) return null;
  const offen = (wert: string) => wert.replace(/\+/g, ' ').replace(/%20/gi, ' ').replace(/%2C/gi, ',').replace(/\s+/g, ' ').trim();
  try {
    return offen(decodeURIComponent(roh)) || null;
  } catch {
    return offen(roh) || null;
  }
}

/** ein name aus dem pfad: „Sky+Garden“ ja, „51.5155“ und „data=…“ nein */
function pfadName(teil: string | null | undefined): string | null {
  const kern = (entziffern(teil) ?? '').split(/[,/]/)[0]!.trim();
  if (kern.length < 3 || kern.length > 90) return null;
  // eine kartenmitte (@48,208…), eine klammer (!3d…) oder eine zahl ist kein name
  if (/^[@!=\d.,\s°'-]/.test(kern)) return null;
  if (!/[a-zäöüß]/iu.test(kern)) return null;
  if (/^(place|search|dir|view|maps|data|ll|geo)$/i.test(kern)) return null;
  return kern;
}

function zerlegt(text: string): { parameter: URLSearchParams; pfad: string[] } {
  const roh = text.trim();
  let parameter: URLSearchParams | null = null;
  let pfad: string[] | null = null;
  try {
    const url = new URL(/^https?:\/\//iu.test(roh) ? roh : roh.startsWith('geo:') ? roh : `https://${roh.replace(/^\/+/, '')}`);
    parameter = url.searchParams;
    pfad = decodeURIComponent(url.pathname).split('/').filter(Boolean);
  } catch {
    parameter = null;
    pfad = null;
  }
  const query = (roh.split('?')[1] ?? '').split('#')[0] ?? '';
  return { parameter: parameter ?? new URLSearchParams(query), pfad: pfad ?? (roh.split('?')[0] ?? '').split('/').filter(Boolean) };
}

/**
 * Der punkt aus dem, was reinkopiert wurde. null heißt: hier steht nichts
 * zählbares – das feld schreibt dann nichts und erklärt, was fehlt.
 */
export function punktAusKartenLink(text: string): Kartenpunkt | null {
  const roh = (text ?? '').trim();
  if (roh.length < 5) return null;
  const { parameter, pfad } = zerlegt(roh);
  // die teile, die eine karte bauen, sind kein name: /maps/place/<name>/@…
  const schritte = pfad.filter((teil) => !/^(maps|dir|place|search|view|preview|data)$/iu.test(teil));
  const name = pfadName(schritte[0]);
  const notiere = (lat: number, lng: number, quelle: string): Kartenpunkt => ({ lat, lng, name, quelle });
  const finfo = (treffer: { lat: number; lng: number } | null, quelle: string) => (treffer ? notiere(treffer.lat, treffer.lng, quelle) : null);

  // zwei zahlen für sich – das feld versteht sie auch ohne link
  if (!/:\/\//u.test(roh) && !/^geo:/iu.test(roh)) {
    const zahlen = paarAusText(roh);
    if (zahlen) return notiere(zahlen.lat, zahlen.lng, 'eingegeben');
  }

  // !3d=breite!4d=länge – die klammern hinter dem platz, dort steht der punkt sicher
  const klammer = KLAMMER.exec(roh);
  if (klammer) {
    const treffer = finfo(paar(klammer[1], klammer[2]), 'Google Maps');
    if (treffer) return treffer;
  }

  // @breite,länge,z – die mitte des kartenteils
  const mitte = MITTE.exec(roh);
  if (mitte) {
    const treffer = finfo(paar(mitte[1], mitte[2]), 'Google Maps');
    if (treffer) return treffer;
  }

  // suche und ziel: q=, query=, destination=, to=, viewpoint=
  for (const feld of ['q', 'query', 'destination', 'to', 'viewpoint']) {
    const wert = entziffern(parameter.get(feld));
    if (!wert) continue;
    const treffer = finfo(paarAusText(wert), 'Google Maps');
    if (treffer) return treffer;
  }

  // die alten paramenter, openstreetmap und die eingebettete karte
  const einzeln = parameter.get('ll') ? paarAusText(parameter.get('ll')!) : paar(parameter.get('lat'), parameter.get('lon') ?? parameter.get('lng'));
  const alt = finfo(einzeln, 'Google Maps');
  if (alt) return alt;
  const merker = finfo(paar(parameter.get('mlat'), parameter.get('mlon')), 'OpenStreetMap');
  if (merker) return merker;
  const kartenMitte = KARTE.exec(roh);
  if (kartenMitte) {
    const treffer = finfo(paar(kartenMitte[1], kartenMitte[2]), 'OpenStreetMap');
    if (treffer) return treffer;
  }
  const gerahmt = GERAHMT.exec(roh);
  const ausRahmen = gerahmt ? finfo(paar(gerahmt[1], gerahmt[2]), 'OpenStreetMap') : null;
  if (ausRahmen) return ausRahmen;

  // geo:breite,länge?q=… – der verweis von der tastatur aus
  const geo = GEO.exec(roh);
  if (geo) {
    const teile = geo[1]!.split(/[,/]/).filter(Boolean);
    const treffer = finfo(paar(teile[0], teile[1]), 'Kartenverweis');
    if (treffer) return { ...treffer, name: pfadName(parameter.get('q')) ?? treffer.name };
  }

  return null;
}

/** der teile-link aus dem teilen-knopf: kurz, der punkt steht erst am ziel */
export function istKurzLink(text: string): boolean {
  return KURZ.test((text ?? '').trim());
}

/** sieht nach einem verweis aus? – zahlen sind kein link, die schreibt das feld selbst */
export function istKartenText(text: string): boolean {
  const roh = (text ?? '').trim();
  if (!roh) return false;
  return /:\/\//u.test(roh) || /^geo:/iu.test(roh) || istKurzLink(roh);
}

export type Kurzantwort = { ziel?: string | null };

/** der kurze link geht an den dienst der app – die antwort ist die echte adresse */
async function nachlesen(link: string): Promise<Kurzantwort | null> {
  try {
    const antwort = await fetch(`/api/karte?u=${encodeURIComponent(link)}`, { cache: 'no-store' });
    if (!antwort.ok) return null;
    return (await antwort.json()) as Kurzantwort;
  } catch {
    return null;
  }
}

/**
 * Der punkt aus dem feld – ein kurzer link wird vorher aufgelöst, alles andere
 * bleibt unter sich. ein treffer ist ein treffer, eine leere hand sagt, warum.
 */
export async function punktAusLink(
  text: string,
  opts: { holen?: (link: string) => Promise<Kurzantwort | null>; abgebrochen?: () => boolean } = {}
): Promise<{ punkt: Kartenpunkt | null; grund: KartenGrund }> {
  const roh = (text ?? '').trim();
  if (!roh) return { punkt: null, grund: 'nichts' };
  const direkt = punktAusKartenLink(roh);
  if (direkt) return { punkt: direkt, grund: 'nichts' };
  if (!istKurzLink(roh)) return { punkt: null, grund: 'kein punkt' };
  const antwort = await (opts.holen ?? nachlesen)(roh);
  if (opts.abgebrochen?.()) return { punkt: null, grund: 'nichts' };
  const ziel = (antwort?.ziel ?? '').trim();
  if (!ziel) return { punkt: null, grund: 'zu kurz' };
  const fund = punktAusKartenLink(ziel);
  return fund ? { punkt: fund, grund: 'nichts' } : { punkt: null, grund: 'kein punkt' };
}
