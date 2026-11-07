import assert from 'node:assert/strict';
import { ausCommons, ausGoogle, ausOpenStreetMap, ausPexels, ausUnsplash, punktAusText, stadtAusAdresse } from '../src/lib/orte';
import { kategorieVorschlag } from '../src/lib/kategorien';
import { SIEHBT_BILDDIENST, SIEHBT_GOOGLE } from '../src/lib/anbieter';

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
