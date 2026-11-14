import assert from 'node:assert/strict';
import { ausCommons, ausGeoNames, ausGoogle, ausOpenStreetMap, ausPexels, ausUnsplash, ausPhoton, bestesBild, bildGrund, frageLohnt, Fotopfad, ortPunkte, punktAusText, quellenName, stelleOrte, stadtAusAdresse, vergleichText } from '../src/lib/orte';
import { kategorieVorschlag } from '../src/lib/kategorien';
import { bestenPunkt, punktFuer, suchkandidaten } from '../src/lib/punktfindung';
import type { Ortsvorschlag } from '../src/lib/types';
import { bildFinden, frageLohnt as frageLohntAnbieter, orteSuchen, SIEHBT_BILDDIENST, SIEHBT_GOOGLE } from '../src/lib/anbieter';
import { kacheln } from '../src/lib/kacheln';
import { bildFragen } from '../src/lib/ortsbild';
import { kartenVorschau } from '../src/lib/karten';

/** Was die Anbieter liefern, muss sauber in Name, Punkt, Adresse und Bildnachweis enden. */

assert.deepEqual(
  ausOpenStreetMap([
    { display_name: 'Alcázar, Sevilla, 41004, Spanien', lat: '37.3833', lon: '-5.9909', type: 'castle' },
    { display_name: '', lat: '1', lon: '2' },
    { display_name: 'ohne Punkt', lat: undefined, lon: undefined },
  ]),
  [{ name: 'Alcázar', adresse: 'Alcázar, Sevilla, 41004, Spanien', lat: 37.3833, lng: -5.9909, stichwort: 'castle', quelle: 'openstreetmap' }],
  'ein Treffer ohne Anzeige oder Punkt fällt weg',
);
assert.deepEqual(
  ausOpenStreetMap([{ display_name: 'Plaza Nueva, 41001, Spanien', lat: '37.3', lon: '-5.9' }]).map((o) => o.name),
  ['Plaza Nueva'],
  'ohne eigenen Namen wird das erste Stück der Adresse genommen',
);

assert.deepEqual(
  ausGoogle({
    places: [
      { displayName: { text: 'Casa Batlló' }, formattedAddress: 'Passeig de Gràcia, 43, Barcelona', location: { latitude: 41.39, longitude: 2.16 }, primaryType: 'tourist_attraction' },
      { displayName: { text: 'ohne Punkt' }, location: {} },
      { displayName: { text: 'nur Name' }, location: { latitude: 0, longitude: 0 } },
    ],
  }).map((o) => `${o.name}|${o.stichwort}`),
  ['Casa Batlló|tourist_attraction', 'nur Name|null'],
  'nur Punkte mit Koordinaten kommen an, die Art wird kurz gemacht',
);

const commons = {
  query: {
    pages: {
      '1': {
        imageinfo: [
          {
            thumburl: 'https://upload.example/mini.jpg',
            url: 'https://upload.example/bild.jpg',
            mime: 'image/jpeg',
            width: 4000,
            height: 1000,
            extmetadata: { Artist: { value: '<span><a href="x">Anna Beispiel</a></span>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
          },
        ],
      },
      '2': { imageinfo: [{ thumburl: 'https://upload.example/breit.jpg', url: 'https://upload.example/breit.png', mime: 'image/png', width: 1600, height: 900 }] },
      '3': { imageinfo: [{ thumburl: 'https://upload.example/karte.svg', url: 'https://upload.example/karte.svg', mime: 'image/svg+xml' }] },
    },
  },
};
assert.deepEqual(ausCommons(commons), { url: 'https://upload.example/breit.jpg', nachweis: 'Wikimedia Commons', quelle: 'Wikimedia Commons' }, 'das Bild mit dem besten Seitenverhältnis gewinnt, Vektoren fallen weg');
assert.equal(ausCommons(commons)?.url.includes('mini'), false);
assert.equal(ausCommons(null as never), null);
assert.equal(ausCommons({ query: { pages: {} } }), null);
assert.equal(
  ausCommons({ query: { pages: { '1': { imageinfo: [{ thumburl: 'https://x/a.jpg', url: 'https://x/a.jpg', mime: 'image/jpeg', width: 800, height: 500, extmetadata: { Artist: { value: '<a href="x">Ben</a>' }, LicenseShortName: { value: 'CC0' } } }] } } } })?.nachweis,
  'Ben · CC0',
  'der Nachweis bleibt lesbar am Bild stehen',
);

assert.deepEqual(ausUnsplash({ results: [{ urls: { regular: 'https://unsplash/a' }, user: { name: 'Cleo' } }] }), { url: 'https://unsplash/a', nachweis: 'Foto: Cleo / Unsplash', quelle: 'Unsplash' });
assert.equal(ausUnsplash({ results: [] }), null);
assert.equal(ausPexels({ photos: [{ src: { large: 'https://pexels/a' } }] })?.nachweis, null);
assert.equal(ausPexels(null), null);

assert.equal(stadtAusAdresse('Kinkaku-ji, 1 Kinkakuichō, Kita Ward, Kyoto, 603-8361, Japan', 'Japan'), 'Kyoto', 'Postleitzahl und das Land darüber werden übersprungen');
assert.equal(stadtAusAdresse('Sevilla, Spanien', null), 'Spanien');
assert.equal(stadtAusAdresse(null, 'Spanien'), null);
assert.deepEqual(punktAusText('35.0116, 135.7681'), { lat: 35.0116, lng: 135.7681 });
assert.deepEqual(punktAusText('35.0116 135.7681'), { lat: 35.0116, lng: 135.7681 }, 'ein Leerzeichen statt Komma ist auch ok');
assert.deepEqual(punktAusText('121, 135'), { lat: null, lng: null }, 'ein Breitenkreis über 90 Grad ist kein Punkt');
assert.deepEqual(punktAusText(''), { lat: null, lng: null });
assert.deepEqual(punktAusText('0, 0'), { lat: null, lng: null }, 'null/null ist kein Ziel');

assert.equal(kategorieVorschlag('Strand von Naha'), 'strand');
assert.equal(kategorieVorschlag('Zug nach Granada'), 'transport');
assert.equal(kategorieVorschlag(''), 'sonstiges');

console.log(`🎉 Suche und Bild passen – Google ${SIEHBT_GOOGLE ? 'mit' : 'ohne'} Schlüssel, Bilddienst ${SIEHBT_BILDDIENST ? 'mit' : 'ohne'} Schlüssel`);

/* ── die Karte: offen, ohne Schlüssel, mit Rückhalt ────────────────────── */

const quellen = kacheln();
assert.ok(quellen.length >= 2, 'fällt eine Quelle aus, hat die Karte die nächste');
assert.equal(quellen[0]!.url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'OpenStreetMap zuerst');
for (const q of quellen) {
  assert.ok(!/key=/.test(q.url), `${q.id}: die Kacheladresse kennt keinen Schlüssel`);
  assert.ok(!/\{r\}/.test(q.url), `${q.id}: kein Retina-Platzhalter, den die Quelle nicht kennt`);
  assert.ok(/\{z\}\/\{x\}\/\{y\}/.test(q.url) || /\{z\}\/\{y\}\/\{x\}/.test(q.url), `${q.id}: ein Kachelmuster, das jede Quelle versteht`);
  assert.ok(/OpenStreetMap/.test(q.nachweis), `${q.id}: der Nachweis nennt OpenStreetMap`);
}

const rand = new URL(kartenVorschau({ lat: 37.3858, lng: -5.9824 }));
assert.equal(rand.hostname, 'www.openstreetmap.org', 'die Vorschau fragt denselben offenen Dienst');
assert.equal(rand.searchParams.get('marker'), '37.3858,-5.9824', 'der Punkt sitzt in der Mitte');
const kanten = (rand.searchParams.get('bbox') ?? '').split(',').map(Number);
assert.equal(kanten.length, 4, 'ein Rahmen, vier Kanten');
assert.ok(kanten[0]! < kanten[2]! && kanten[1]! < kanten[3]!, 'links unter rechts, unten über oben');
assert.ok(Math.abs((kanten[0]! + kanten[2]!) / 2 - -5.9824) < 0.001, 'der Rahmen ist um den Punkt gebaut');
assert.ok(Math.abs((kanten[1]! + kanten[3]!) / 2 - 37.3858) < 0.001, 'und nicht über eine Halbkugel verschoben');

/**
 * Der Punkt, den sich die App selbst holt: ein Eintrag ohne Punkt steht nicht
 * auf der Karte, also wird er gesucht – und nur übernommen, wenn er passt.
 */
const osm = (name: string, adresse: string, lat = 51.87, lng = -0.37): Ortsvorschlag => ({ name, adresse, lat, lng, stichwort: 'lodging', quelle: 'openstreetmap' });

assert.deepEqual(suchkandidaten({ titel: 'Premier Inn London Luton', ort: 'Luton', adresse: null, karten_stichwort: null }), ['Premier Inn London Luton, Luton'], 'gefragt wird, was am meisten hergibt');
assert.deepEqual(suchkandidaten({ titel: 'X', ort: null, adresse: '1 Airport Way, Luton', karten_stichwort: 'hotel in luton' }), ['hotel in luton', '1 Airport Way, Luton'], 'das Stichwort zuerst, zu Kurzes fällt weg');
assert.deepEqual(suchkandidaten({ titel: 'Café', ort: null, adresse: null, karten_stichwort: null }), [], 'was kürzer als fünf Zeichen ist, wird nicht gefragt');

assert.equal(bestenPunkt([osm('Premier Inn Manchester', 'Piccadilly, Manchester'), osm('Premier Inn London Luton Airport', 'Gops Meadow Lane, Luton, England')], 'Premier Inn London Luton, Luton')?.name, 'Premier Inn London Luton Airport', 'die stadt entscheidet, nicht die reihenfolge');
assert.equal(bestenPunkt([osm('Premier Inn Manchester', 'Piccadilly, Manchester')], 'Premier Inn London Luton, Luton'), null, 'lieber kein punkt als ein falscher');
assert.equal(bestenPunkt([osm('BP Tankstelle', 'Luton, England')], 'Premier Inn London Luton, Luton'), null, 'ein treffer ohne gemeinsames wort ist nicht gemeint');
assert.equal(bestenPunkt([], 'Hotel Prado, Sevilla'), null, 'ohne treffer kein punkt');

const gesuchteFragen: string[] = [];
const fund = await punktFuer({ titel: 'Hotel Prado', ort: 'Sevilla', adresse: null, karten_stichwort: null }, 'Spanien', async (text) => {
  gesuchteFragen.push(text);
  return [osm('Falsches Haus', 'Chaussée, Brüssel'), osm('Hotel Prado', 'Paseo de Prado, Sevilla')];
});
assert.equal(fund?.patch.lat, 51.87, 'der punkt kommt aus der offenen suche');
assert.equal(fund?.patch.lng, -0.37);
assert.equal(fund?.patch.karten_stichwort, 'lodging', 'das stichwort für die maps-suche wird gemerkt');
assert.equal(fund?.patch.adresse, 'Paseo de Prado, Sevilla', 'was fehlt, wird mitgenommen');
assert.ok(!('ort' in (fund?.patch ?? {})), 'eine gesetzte stadt bleibt stehen');
assert.equal(fund?.quelle, 'OpenStreetMap', 'der nachweis sagt, woher der punkt kommt');
assert.deepEqual(gesuchteFragen, ['Hotel Prado, Sevilla'], 'gefragt wird einmal, durch dasselbe tor wie im formular');

const leereStadt = await punktFuer({ titel: 'Hotel Prado', ort: null, adresse: null, karten_stichwort: null }, 'Spanien', async () => [osm('Hotel Prado', 'Paseo de Prado, 41004, Sevilla, Spanien')]);
assert.equal(leereStadt?.patch.ort, 'Sevilla', 'die stadt folgt dem treffer, wo sie noch fehlt');
assert.equal(await punktFuer({ titel: 'Zug nach Granada', ort: null, adresse: null, karten_stichwort: 'train station granada' }, null, async () => []), null, 'eine leere hand bleibt eine leere hand');
assert.equal(
  await punktFuer({ titel: 'Fähre am Morgen', ort: 'Calais', adresse: null, karten_stichwort: null }, null, async () => {
    throw new Error('netz weg');
  }),
  null,
  'ein fehler beim suchen wirft niemanden um',
);

console.log('🎉 Karte ohne Schlüssel – ' + quellen.length + ' offene Quellen, Vorschau offen eingebettet');
/* ── das bild des ortes: Fragen in der richtigen reihenfolge ─────────── */

assert.deepEqual(
  bildFragen({ titel: 'London Luton Airport', ort: 'Vereinigtes Königreich', adresse: null }, { stationen: 'London', land: 'Vereinigtes Königreich' }),
  ['London Luton Airport', 'London Luton Airport, London', 'London'],
  'der name zuerst, das land als suchwort nie – die stadt kommt aus der ersten station',
);
assert.deepEqual(
  bildFragen({ titel: 'F4 Glasshouse Studio Flat', ort: null, adresse: '14 High Street, Luton, England' }, { stationen: 'London', land: 'Großbritannien' }),
  ['F4 Glasshouse Studio Flat', 'F4 Glasshouse Studio Flat, England', 'London'],
  'findet der name nichts, bleibt der blick auf die reise – höchstens drei fragen',
);
assert.deepEqual(
  bildFragen({ titel: 'Alcázar', ort: 'Sevilla', adresse: null }, { stationen: 'Sevilla', land: 'Spanien' }),
  ['Alcázar', 'Alcázar, Sevilla', 'Sevilla'],
  'eine echte stadt wird benutzt, ein land nicht',
);
assert.deepEqual(bildFragen({ titel: '', ort: null, adresse: null }, { stationen: null, land: null }), [], 'ohne angabe wird nicht gesucht');

console.log('🎉 Punkte, die sich selbst finden – Stadt muss passen, Nachweis bleibt dran');
console.log('🎉 Bilder folgen der richtigen frage – name zuerst, land nie');

/* ── die ortssuche: eine kurze frage, der richtige ort ────────────────── */

const photonRoh = {
  features: [
    { geometry: { coordinates: [-0.1246, 51.5007] }, properties: { name: 'Big Ben', street: 'Westminster', city: 'London', state: 'England', country: 'Vereinigtes Königreich', countrycode: 'gb', type: 'historic' } },
    { geometry: { coordinates: [6.9603, 50.9375] }, properties: { name: 'Big Ben', street: 'Kölner Straße 1', city: 'Köln', country: 'Deutschland', type: 'restaurant' } },
    { geometry: { coordinates: [-0.1246, 51.5007] }, properties: { name: 'Big Ben', type: 'attraction' } },
    { geometry: { coordinates: [] }, properties: { name: 'ohne Punkt' } },
    { geometry: { coordinates: [1, 2] }, properties: {} },
  ],
};

assert.equal(vergleichText('Big  Ben.'), 'big ben', 'zeichen und leeräume sind für den vergleich egal');
assert.equal(vergleichText('Zürich'), 'zurich', 'ein umlaut ist derselbe buchstabe');

const photonTreffer = ausPhoton(photonRoh);
assert.equal(photonTreffer.length, 3, 'was keinen punkt oder keinen namen hat, fällt weg');
assert.deepEqual(
  { name: photonTreffer[0]!.name, adresse: photonTreffer[0]!.adresse, lat: photonTreffer[0]!.lat, lng: photonTreffer[0]!.lng, quelle: photonTreffer[0]!.quelle },
  { name: 'Big Ben', adresse: 'Westminster, London, England, Vereinigtes Königreich', lat: 51.5007, lng: -0.1246, quelle: 'photon' },
  'die adresszeile baut sich aus den teilen, ohne den namen zu wiederholen',
);

const turm = photonTreffer[0]!;
const wirtshaus = photonTreffer[1]!;
const uhr = photonTreffer[2]!;
const flaeche = { name: 'England', adresse: 'England, Vereinigtes Königreich', lat: 52.8, lng: -1.2, stichwort: 'country', quelle: 'openstreetmap' as const };

assert.deepEqual(stelleOrte([[wirtshaus, turm]], { suchwort: 'big ben' }).map((o) => o.name), ['Big Ben', 'Big Ben'], 'zwei städte, zwei treffernamen – beide bleiben stehen');
assert.equal(stelleOrte([[wirtshaus, turm]], { suchwort: 'big ben' })[0]!.adresse?.includes('London'), true, 'der turm wird zuerst genommen, das wirtshaus in Köln dahinter');
assert.equal(stelleOrte([[wirtshaus, turm]], { suchwort: 'big ben', nahe: { lat: 50.9375, lng: 6.9603 } })[0]!.adresse?.includes('Köln'), true, 'und wer in Köln plant, bekommt das wirtshaus zuerst');
assert.equal(stelleOrte([[turm], [uhr]], { suchwort: 'big ben' }).length, 1, 'derselbe punkt von zwei diensten bleibt ein vorschlag');
assert.equal(stelleOrte([[turm, uhr, wirtshaus]], { suchwort: 'big ben' }).length, 2, 'er wird nicht noch einmal gezeigt');
assert.deepEqual(stelleOrte([[flaeche, turm]], { suchwort: 'big ben' }).map((o) => o.name), ['Big Ben'], 'ein land ist nicht der gesuchte turm');
assert.equal(
  stelleOrte([[{ name: 'Elizabeth Tower', adresse: 'Parliament Square, Big Ben, London', lat: 51.5007, lng: -0.1246, stichwort: 'historic', quelle: 'openstreetmap' }]], { suchwort: 'big ben' }).length,
  1,
  'wo der name nichts hergibt, hilft die adresse',
);
assert.deepEqual(stelleOrte([[]], { suchwort: 'big ben' }), [], 'eine leere hand bleibt leer');
assert.deepEqual(stelleOrte([[turm]], { suchwort: ' ' }), [], 'was nichts fragt, bekommt nichts');

/* ── Google bringt Place-ID und Foto mit, die Suche verzeiht Namen und Füllwörter ── */

const googleTreffer = ausGoogle({
  places: [
    {
      id: 'ChIJ8cM8zdaoAWARPR27azYdlsA',
      displayName: { text: 'Fushimi Inari-Taisha' },
      formattedAddress: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, Japan',
      location: { latitude: 34.9671, longitude: 135.7727 },
      primaryType: 'shinto_shrine',
      photos: [{ name: 'places/ChIJ8cM8zdaoAWARPR27azYdlsA/photos/' + 'A'.repeat(300), authorAttributions: [{ displayName: 'Mika Tanaka' }] }],
    },
  ],
});
assert.equal(googleTreffer[0]!.google_id, 'ChIJ8cM8zdaoAWARPR27azYdlsA', 'die Place-ID geht mit');
assert.match(googleTreffer[0]!.foto!.url, /^\/api\/bild\?foto=places%2FChIJ/, 'das Foto läuft durch unsere Tür – der Schlüssel bleibt im Server');
assert.equal(googleTreffer[0]!.foto!.nachweis, 'Foto: Mika Tanaka / Google Maps', 'der Fotograf wird genannt, wie Google es verlangt');
assert.ok(Fotopfad.test('places/ChIJ8cM8zdaoAWARPR27azYdlsA/photos/' + 'A'.repeat(300)), 'auch lange Foto-Namen kommen durch');
assert.equal(Fotopfad.test('https://evil.example/photos/x'), false, 'die Tür bleibt kein offener Verteiler');
assert.equal(ausGoogle({ places: [{ displayName: { text: 'Ohne Foto' }, location: { latitude: 1, longitude: 2 }, photos: [{ name: '../geheim' }] }] })[0]!.foto, undefined, 'ein fremder Pfad wird nicht als Foto genommen');

const ortO = (name: string, adresse: string, stichwort: string | null, quelle: Ortsvorschlag['quelle'] = 'photon', lat = 35, lng = 135): Ortsvorschlag => ({ name, adresse, lat, lng, stichwort, quelle });
assert.ok(ortPunkte(ortO('Tokyo', 'Japan', 'city'), 'tokio') > 0, '„Tokio“ findet Tokyo');
assert.ok(ortPunkte(ortO('Hotel Granvia Kyoto', 'Karasuma, Kyoto, Japan', 'hotel'), 'hotel in kyoto') > 0, '„hotel in kyoto“ verliert sich nicht an „in“');
assert.ok(ortPunkte(ortO('Santa Maria della Scala', 'Piazza del Duomo, Siena, Italien', 'museum'), 'museum in siena') > 0, 'der Name trägt die Stadt nicht – die Adresse tut es');
assert.ok(ortPunkte(ortO('München', 'Bayern, Deutschland', 'city'), 'muenchen') > 0, 'ein Tippfehler wird verziehen');
assert.ok(ortPunkte(ortO('Venedig', 'Italien', 'city'), 'venice') > 0, 'englisch und deutsch sind ein Ort');
assert.equal(ortPunkte(ortO('BP Tankstelle', 'Luton', 'fuel'), 'big ben'), -1, 'was kein Wort der Frage trägt, bleibt draußen');
assert.equal(stelleOrte([[ortO('東京', '日本', 'locality', 'google')]], { suchwort: 'tokio' }).length, 1, 'Google kennt den Namen unter anderer Schrift – der Treffer bleibt');
assert.equal(
  stelleOrte([[ortO('Fushimi Inari Taisha', 'Kyoto', 'shrine', 'photon', 34.9671, 135.7727)], [ortO('Fushimi Inari-Taisha', 'Kyoto, Japan', 'shinto_shrine', 'google', 34.9671, 135.7727)]], { suchwort: 'fushimi inari' })[0]!.quelle,
  'google',
  'derselbe Ort von Google und OpenStreetMap: Google steht vorn, mit Foto und Place-ID',
);
assert.equal(ausGeoNames({ results: [{ name: 'Tokio', latitude: 35.6895, longitude: 139.69171, country: 'Japan', admin1: 'Tokyo', feature_code: 'PPLC' }, { name: 'ohne Punkt' }] }).length, 1, 'GeoNames: nur Treffer mit Punkt');
assert.equal(ausGeoNames({ results: [{ name: 'Tokio', latitude: 35.6895, longitude: 139.69171, country: 'Japan', admin1: 'Tokyo', feature_code: 'PPLC' }] })[0]!.adresse, 'Tokyo, Japan', 'die Adresse ist Region und Land');
assert.equal(quellenName('geonames'), 'GeoNames', 'auch die Stadtsuche nennt ihre Quelle');
assert.equal(bestenPunkt([{ name: '東京タワー', adresse: 'Minato City, Tokio, Japan', lat: 35.65, lng: 139.74, stichwort: null, quelle: 'google' }], 'Tokyo Tower, Tokio')?.quelle, 'google', 'der erste Google-Treffer zählt auch unter anderem Namen, wenn die Stadt passt');
assert.equal(bestenPunkt([{ name: '東京タワー', adresse: 'Minato City, Osaka, Japan', lat: 35.65, lng: 139.74, stichwort: null, quelle: 'google' }], 'Tokyo Tower, Tokio'), null, 'aber die Stadt entscheidet weiter');
assert.equal(bestenPunkt([osm('Hotel Kioto Plaza', 'Kyoto, Japan')], 'Hotel Kyoto Plaza, Kioto')?.name, 'Hotel Kioto Plaza', 'Kioto und Kyoto sind dasselbe Wort');


const nominatimRoh = [{ display_name: 'Big Ben, Westminster, London, England', name: 'Big Ben', lat: '51.5007', lon: '-0.1246', type: 'clock_tower', addresstype: 'historic' }];
const gefragte: string[] = [];
const koepfe: Array<Record<string, string>> = [];
const kopfVon = (init: unknown) => ((init as { headers?: Record<string, string> } | undefined)?.headers ?? {});
const nominatimFragen = () => gefragte.filter((text) => text.includes('nominatim')).length;
/** beide quellen antworten hier so, wie sie es tun: nur mit dem, was zur frage paßt */
function fundZu(frage: string) {
  const anfrage = vergleichText(frage);
  const treffer = (text: string) => vergleichText(text).includes(anfrage);
  return {
    photon: { features: photonRoh.features.filter((f) => treffer(f.properties?.name ?? '')) },
    nominatim: nominatimRoh.filter((d) => treffer(`${d.name} ${d.display_name}`)),
  };
}
const beideQuellen = () =>
  ((url: string | URL, init?: unknown) => {
    const text = String(url);
    gefragte.push(text);
    koepfe.push(kopfVon(init));
    const antwort = fundZu(new URL(text).searchParams.get('q') ?? '');
    if (text.includes('photon.komoot.io')) return new Response(JSON.stringify(antwort.photon));
    if (text.includes('nominatim.openstreetmap.org')) return new Response(JSON.stringify(antwort.nominatim));
    if (text.includes('geocoding-api.open-meteo.com')) return new Response(JSON.stringify({ results: [] }));
    return new Response('nicht gefunden', { status: 404 });
  }) as typeof fetch;

globalThis.fetch = beideQuellen();

assert.equal(frageLohntAnbieter, frageLohnt, 'blatt und server kennen dieselbe schwelle');
assert.equal(frageLohnt(' b '), false, 'ein buchstabe wird nicht gefragt');
assert.equal(frageLohnt('bi'), true, 'zwei zeichen reichen');

const erste = await orteSuchen('big ben');
assert.equal(gefragte.length, 3, 'alle freien quellen (photon, geonames, nominatim) laufen gleichzeitig, keins wartet auf das andere');
assert.equal(nominatimFragen(), 1, 'nominatim wird einmal gefragt, nicht dreimal');
assert.ok(erste.some((o) => o.adresse?.includes('London')), '„big ben" findet den turm in London');
assert.equal(erste[0]!.adresse?.includes('London'), true, 'und er steht vorn');
assert.ok(gefragte.every((text) => !/key=/.test(text)), 'die freien quellen werden nicht nach einem schlüssel gefragt');
assert.equal(new URL(gefragte[0]!).hostname, 'photon.komoot.io', 'photon ist die erste quelle, nominatim die zweite');
assert.ok(koepfe.every((kopf) => Boolean(kopf['User-Agent'])), 'jede freie quelle weiß, wer fragt – sonst antwortet sie nicht');
assert.ok(koepfe.every((kopf) => Boolean(kopf.Referer)), 'und jede bekommt dazu eine heimat');
assert.ok(new URL(gefragte[0]!).searchParams.get('q') === 'big ben', 'gefragt wird der getippte text');
assert.ok(new URL(gefragte[0]!).searchParams.get('lang') === 'de', 'die namen kommen auf deutsch');

const zweite = await orteSuchen('Big  Ben');
assert.deepEqual(zweite, erste, 'dieselbe frage, dieselben treffer');
assert.equal(gefragte.length, 3, 'zum zweiten mal geht nichts ins netz');

// nominatim spielt jetzt nicht mehr mit – photon allein muss reichen
globalThis.fetch = ((url: string | URL, init?: unknown) => {
  const text = String(url);
  gefragte.push(text);
  koepfe.push(kopfVon(init));
  if (text.includes('photon.komoot.io')) return new Response(JSON.stringify(fundZu(new URL(text).searchParams.get('q') ?? '').photon));
  return new Response('zu viele anfragen', { status: 429 });
}) as typeof fetch;

const vorher = gefragte.length;
const eineHand = await orteSuchen('big ben', null, true);
assert.ok(eineHand.length >= 1, 'eine quelle, die schweigt, wirft niemanden um – die andere reicht');
assert.ok(gefragte.length > vorher, 'und ein „frisch" geht noch einmal ins netz, obwohl die antwort gemerkt ist');
assert.ok(nominatimFragen() <= 2, 'nominatim wird höchstens einmal pro sekunde gefragt');
const nichts = await orteSuchen('qwxvrtzz', null);
assert.deepEqual(nichts, [], 'was niemand kennt, bleibt leer – ein fehler ist das nicht');

console.log('🎉 Ortssuche wie im Kartendienst – kurze frage, beide quellen, der richtige ort vorn');

/* ── das bild zum ort: dieselbe staffel, mehrere quellen, ein kern ─────── */

assert.equal(bildGrund('Big Ben, Westminster, London, England'), 'Big Ben', 'was vor dem ersten komma steht, ist das objekt');
assert.equal(bildGrund('Alcázar (Sevilla), 41004'), 'Alcázar', 'eine klammer gehört nicht zur frage');
assert.equal(bildGrund('Rom'), '', 'zu kurzes wird nicht gefragt – „rom" malt sonst einen strand');
assert.equal(bestesBild([null, { url: 'https://x/frei.jpg', nachweis: null, quelle: 'Wikimedia Commons' }])?.quelle, 'Wikimedia Commons', 'was nichts liefert, zählt nicht');
assert.equal(
  bestesBild([null, { url: 'https://x/curiert.jpg', nachweis: 'Foto: Cleo / Unsplash', quelle: 'Unsplash' }, { url: 'https://x/frei.jpg', nachweis: null, quelle: 'Wikimedia Commons' }])?.quelle,
  'Unsplash',
  'die kuratierte quelle steht über dem zufund',
);
assert.equal(bestesBild([]), null, 'ohne quelle kein bild');
assert.equal(bestesBild([{ url: '', nachweis: null, quelle: 'Wo auch immer' }]), null, 'ein bild ohne adresse ist keins');

const runden: string[] = [];
const commonsFund = JSON.stringify({ query: { pages: { '1': { imageinfo: [{ thumburl: 'https://upload.example/turm.jpg', url: 'https://upload.example/turm.jpg', mime: 'image/jpeg', width: 1600, height: 900 }] } } } });
const leerFund = JSON.stringify({ query: { pages: {} } });

globalThis.fetch = ((url: string | URL) => {
  const text = String(url);
  runden.push(text);
  if (text.includes('commons.wikimedia.org')) {
    // commons findet einen langen adresssatz nicht – und soll ihn auch nicht finden müssen
    const suche = new URL(text).searchParams.get('gsrsearch') ?? '';
    return Promise.resolve(new Response(suche.includes(',') ? leerFund : commonsFund));
  }
  return Promise.resolve(new Response('keins', { status: 404 }));
}) as typeof fetch;

const bildFund = await bildFinden('Big Ben, Westminster, London, England');
assert.equal(bildFund?.url, 'https://upload.example/turm.jpg', 'eine zu genaue frage wird auf ihren kern gekürzt');
assert.equal(runden.length, 2, 'zwei runden: die ganze frage, dann der kern');
assert.ok(runden[1]!.includes('filetype%3Abitmap+Big+Ben') || runden[1]!.includes('filetype:bitmap Big Ben'), 'die zweite frage nennt nur das objekt');

const vorUnsplash = runden.length;
process.env.UNSPLASH_ACCESS_KEY = 'probe';
const kuratiert = JSON.stringify({ results: [{ urls: { regular: 'https://unsplash.example/curiert.jpg' }, user: { name: 'Cleo' } }] });
globalThis.fetch = ((url: string | URL) => {
  const text = String(url);
  runden.push(text);
  if (text.includes('api.unsplash.com')) return Promise.resolve(new Response(kuratiert));
  return Promise.resolve(new Response(commonsFund));
}) as typeof fetch;

const beide = await bildFinden('Big Ben');
assert.equal(runden.length - vorUnsplash, 2, 'bilddienst und commons laufen in derselben runde, nicht nacheinander');
assert.equal(beide?.quelle, 'Unsplash', 'was kuratiert ist, gewinnt gegen den zufund');
delete process.env.UNSPLASH_ACCESS_KEY;

globalThis.fetch = ((url: string | URL) => {
  const text = String(url);
  runden.push(text);
  if (text.includes('commons.wikimedia.org')) return Promise.resolve(new Response(commonsFund));
  return Promise.resolve(new Response('dienst ausgefallen', { status: 500 }));
}) as typeof fetch;
process.env.UNSPLASH_ACCESS_KEY = 'probe';
const bildEineHand = await bildFinden('Elizabeth Tower');
assert.equal(bildEineHand?.quelle, 'Wikimedia Commons', 'eine quelle, die schweigt, ist kein fehlendes bild');
delete process.env.UNSPLASH_ACCESS_KEY;
assert.equal(await bildFinden(' Bi '), null, 'zu kurzes wird gar nicht erst gefragt');

console.log('🎉 Bilder folgen derselben staffel – kurze frage, beide quellen, kern als rückhalt');
