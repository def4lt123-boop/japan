import assert from 'node:assert/strict';
import { ausCommons, ausGoogle, ausOpenStreetMap, ausPexels, ausUnsplash, punktAusText, stadtAusAdresse } from '../src/lib/orte';
import { kategorieVorschlag } from '../src/lib/kategorien';
import { bestenPunkt, punktFuer, suchkandidaten } from '../src/lib/punktfindung';
import type { Ortsvorschlag } from '../src/lib/types';
import { SIEHBT_BILDDIENST, SIEHBT_GOOGLE } from '../src/lib/anbieter';
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
