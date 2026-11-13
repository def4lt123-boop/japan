import assert from 'node:assert/strict';

/**
 * Google Places und Google Routes – mit Schlüssel, aber ohne Netz: die Antworten werden so
 * gestellt, wie Google sie schickt. Der Schlüssel steht vor dem Laden der Module in der
 * Umgebung, weil die Anbieterschicht ihn beim Start liest.
 *
 *   npx tsx scripts/google-test.mts
 */

process.env.GOOGLE_MAPS_API_KEY = 'test-schluessel-nicht-echt';
const { orteSuchen, googleWeg, googleTabelle, bremsenVergessen, fragegedaechtnisVergessen, wegegedaechtnisVergessen, bildFinden, SIEHBT_GOOGLE } = await import('../src/lib/anbieter');

assert.equal(SIEHBT_GOOGLE, true, 'mit Schlüssel läuft Google mit');

type Anfrage = { url: string; methode: string; kopf: Record<string, string>; koerper: Record<string, unknown> | null };
const anfragen: Anfrage[] = [];
let antworten: (a: Anfrage) => Response = () => new Response('nicht gestellt', { status: 404 });
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  const a: Anfrage = { url: String(url), methode: init?.method ?? 'GET', kopf: (init?.headers ?? {}) as Record<string, string>, koerper: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
  anfragen.push(a);
  return antworten(a);
}) as typeof fetch;

const foto = 'places/ChIJ8cM8zdaoAWARPR27azYdlsA/photos/' + 'B'.repeat(220);
const platz = {
  id: 'ChIJ8cM8zdaoAWARPR27azYdlsA',
  displayName: { text: 'Fushimi Inari-Taisha' },
  formattedAddress: '68 Fukakusa Yabunouchicho, Kyoto, Japan',
  location: { latitude: 34.9671, longitude: 135.7727 },
  primaryType: 'shinto_shrine',
  photos: [{ name: foto, authorAttributions: [{ displayName: 'Mika Tanaka' }] }],
};

/* ── Ortssuche: Google zuerst, Foto und Place-ID dabei, Schlüssel nur im Kopf ── */

antworten = (a) => {
  if (a.url.includes('places.googleapis.com/v1/places:searchText')) return new Response(JSON.stringify({ places: [platz] }));
  if (a.url.includes('photon.komoot.io')) return new Response(JSON.stringify({ features: [] }));
  if (a.url.includes('geocoding-api.open-meteo.com')) return new Response(JSON.stringify({ results: [] }));
  if (a.url.includes('nominatim')) return new Response('[]');
  return new Response('?', { status: 404 });
};
const orte = await orteSuchen('fushimi inari', { lat: 35.0, lng: 135.76 });
assert.equal(orte[0]?.quelle, 'google', 'Google steht vorn');
assert.equal(orte[0]?.google_id, platz.id, 'mit Place-ID');
assert.match(orte[0]?.foto?.url ?? '', /^\/api\/bild\?foto=/, 'und mit Foto aus unserer Tür');
assert.equal(orte[0]?.foto?.nachweis, 'Foto: Mika Tanaka / Google Maps', 'samt Nachweis');
const google = anfragen.find((a) => a.url.includes('places:searchText'))!;
assert.equal(google.kopf['X-Goog-Api-Key'], 'test-schluessel-nicht-echt', 'der Schlüssel geht im Kopf mit');
assert.ok(!google.url.includes('test-schluessel'), 'und nie in der Adresse');
assert.match(google.kopf['X-Goog-FieldMask']!, /places\.photos/, 'das Foto wird gleich mitgefragt');
assert.deepEqual((google.koerper as { locationBias: { circle: { center: unknown } } }).locationBias.circle.center, { latitude: 35.0, longitude: 135.76 }, 'gesucht wird dort, wo geplant wird');
assert.ok(!JSON.stringify(orte).includes('test-schluessel'), 'die Antwort an die Seite trägt keinen Schlüssel');

/* ── eine Quelle fällt aus: kein „nichts gefunden“ im Gedächtnis ── */

fragegedaechtnisVergessen();
bremsenVergessen();
anfragen.length = 0;
antworten = (a) => (a.url.includes('places.googleapis.com') ? new Response(JSON.stringify({ error: { message: 'API not enabled' } }), { status: 403 }) : new Response('kaputt', { status: 500 }));
const nichts = await orteSuchen('hotel in kyoto');
assert.deepEqual(nichts, [], 'wenn alles ausfällt, kommt nichts – aber …');
antworten = (a) => (a.url.includes('places.googleapis.com') ? new Response(JSON.stringify({ places: [platz] })) : new Response('kaputt', { status: 500 }));
const spaeter = await orteSuchen('hotel in kyoto', null, false);
assert.ok(anfragen.length > 0);
// der Ausfall wurde nicht als Antwort gemerkt: die nächste Frage geht wieder ins Netz (Google selbst ist 60 s zu, die Freien antworten nicht)
assert.ok(anfragen.filter((a) => a.url.includes('photon')).length >= 2, '„nichts“ nach einem Ausfall wird nicht gemerkt – die nächste Frage versucht es noch einmal');
void spaeter;

/* ── Wege: Modus, Fahrplanzeit, Antwort lesen ── */

bremsenVergessen();
wegegedaechtnisVergessen();
anfragen.length = 0;
antworten = (a) => {
  if (a.url.includes('computeRoutes')) return new Response(JSON.stringify({ routes: [{ duration: '1380s', distanceMeters: 6412, polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC' } }] }));
  return new Response('?', { status: 404 });
};
const bahn = await googleWeg({ lat: 35.0116, lng: 135.7681 }, { lat: 35.0394, lng: 135.7292 }, 'bahn', true);
assert.deepEqual(bahn && { km: bahn.km, minuten: bahn.minuten }, { km: 6.4, minuten: 23 }, '1380 Sekunden sind 23 Minuten, 6412 m sind 6,4 km');
assert.deepEqual(bahn?.strecke, [[38.5, -120.2], [40.7, -120.95]], 'die Strecke ist für die Karte entschlüsselt');
const r = anfragen[0]!;
assert.equal(r.koerper?.travelMode, 'TRANSIT', 'Bahn heißt bei Google TRANSIT');
assert.match(String(r.koerper?.departureTime), /T01:00:00\.000Z$/, 'Fahrplanwege rechnen mit dem Morgen vor Ort (10 Uhr in Japan)');
assert.equal(r.koerper?.routingPreference, undefined, 'TRANSIT verträgt keine Verkehrslage');
assert.match(r.kopf['X-Goog-FieldMask']!, /polyline/, 'die Strecke wird nur gefragt, wenn die Karte sie braucht');
const zuFuss = await googleWeg({ lat: 35.0116, lng: 135.7681 }, { lat: 35.0394, lng: 135.7292 }, 'zu fuss');
assert.equal(anfragen.at(-1)!.koerper?.travelMode, 'WALK', 'zu Fuß heißt WALK');
assert.equal(anfragen.at(-1)!.koerper?.departureTime, undefined, 'zu Fuß hat keinen Fahrplan');
assert.ok(zuFuss, 'und gibt einen Weg');
const gleiche = anfragen.length;
await googleWeg({ lat: 35.0116, lng: 135.7681 }, { lat: 35.0394, lng: 135.7292 }, 'zu fuss');
assert.equal(anfragen.length, gleiche, 'derselbe Weg wird einen Tag lang gemerkt – Google rechnet nach Anfrage');

antworten = () => new Response(JSON.stringify({}));
assert.equal(await googleWeg({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, 'auto'), null, 'kein Weg bei Google ist keine Antwort');

/* ── Tabelle für eine Gruppe ── */

bremsenVergessen();
antworten = () =>
  new Response(
    JSON.stringify([
      { originIndex: 0, destinationIndex: 1, duration: '420s', distanceMeters: 520, condition: 'ROUTE_EXISTS' },
      { originIndex: 1, destinationIndex: 0, duration: '430s', distanceMeters: 530, condition: 'ROUTE_EXISTS' },
      { originIndex: 0, destinationIndex: 2, condition: 'ROUTE_NOT_FOUND' },
      { originIndex: 2, destinationIndex: 0, condition: 'ROUTE_NOT_FOUND' },
      { originIndex: 1, destinationIndex: 2, duration: '540s', distanceMeters: 700, condition: 'ROUTE_EXISTS' },
      { originIndex: 2, destinationIndex: 1, duration: '560s', distanceMeters: 710, condition: 'ROUTE_EXISTS' },
    ]),
  );
const punkte = [{ lat: 35.01, lng: 135.76 }, { lat: 35.02, lng: 135.77 }, { lat: 35.03, lng: 135.78 }];
const matrix = await googleTabelle(punkte, 'zu fuss');
assert.equal(matrix?.minuten[0]![1], 7, '420 Sekunden sind sieben Minuten');
assert.equal(matrix?.km[1]![2], 0.7);
assert.equal(matrix?.minuten[0]![2], Number.POSITIVE_INFINITY, 'ein Weg, den es nicht gibt, ist unerreichbar');
assert.equal(matrix?.minuten[1]![1], 0, 'der Schritt zu sich selbst kostet nichts');
assert.equal(await googleTabelle(punkte.concat(punkte, punkte, punkte, punkte), 'zu fuss'), null, 'mehr als zwölf Halte fragt die App nicht');
const elf = Array.from({ length: 11 }, (_, i) => ({ lat: 35 + i / 100, lng: 135 }));
assert.equal(await googleTabelle(elf, 'bahn'), null, 'Fahrplanwege: höchstens hundert Felder, also zehn Halte');

/* ── Bilder: der erste Ort mit Foto, mit Nachweis ── */

bremsenVergessen();
antworten = (a) => (a.url.includes('places.googleapis.com') ? new Response(JSON.stringify({ places: [{ displayName: { text: 'Ohne Foto' } }, platz] })) : new Response('{}', { status: 404 }));
const bild = await bildFinden('Fushimi Inari, Kyoto');
assert.equal(bild?.quelle, 'Google', 'das Foto kommt von Google');
assert.equal(bild?.nachweis, 'Foto: Mika Tanaka / Google Maps', 'mit dem Namen des Fotografen');
assert.match(bild?.url ?? '', /^\/api\/bild\?foto=/, 'durch unsere Tür');

console.log('🎉 Google Maps mit Schlüssel – Ortssuche mit Foto und Place-ID, Wege mit Fahrplan, Tabelle, Bild mit Nachweis');
