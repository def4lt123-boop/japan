/**
 * Test für den manuellen weg zum punkt: ein link aus Google Maps, hereinkopiert,
 * muß den punkt hergeben – die geteilte kurzfassung ebenso wie die adresse in der
 * zeile. und was keinen punkt hat, darf keinen schreiben.
 *
 *   TZ=Europe/Vienna npx tsx scripts/kartenlink-test.mts
 */
import assert from 'node:assert/strict';
import { istKartenText, istKurzLink, punktAusKartenLink, punktAusLink } from '../src/lib/kartenlink';
import { punktAusText } from '../src/lib/orte';
import { kartenLink, kartenVorschau } from '../src/lib/karten';
import { wegLink, type Haufung } from '../src/lib/naehe';

const punkt = (text: string) => {
  const fund = punktAusKartenLink(text);
  return fund ? `${fund.lat}|${fund.lng}|${fund.name ?? ''}|${fund.quelle}` : null;
};

/* ── 1. die formen, die google in die adresse legt ──────────────────────── */

const platz =
  'https://www.google.com/maps/place/Borough+Market/@51.5054537,-0.0910505,17z/data=!3m1!4b1!4m6!3m5!1s0x487603a0c747f925:0x2324e61101b4a096!8m2!3d51.5054537!4d-0.0910505!16zL20vMDV5ZjRm';
assert.equal(punkt(platz), '51.505454|-0.091051|Borough Market|Google Maps', 'der platz in der zeile gibt name und punkt');

const klammer = 'https://www.google.com/maps/place/Sky+Garden/data=!4m6!3m5!1s0x48760!8m2!3d51.515512!4d-0.0817144';
assert.equal(punkt(klammer), '51.515512|-0.081714|Sky Garden|Google Maps', 'ohne @ stehen die zahlen in den klammern');

const mitte = 'https://www.google.com/maps/@48.2081743,16.3738336,14z';
assert.equal(punkt(mitte), '48.208174|16.373834||Google Maps', 'die kartenmitte ist ein punkt');

const suche = 'https://www.google.com/maps/search/?api=1&query=51.5054537%2C-0.0910505';
assert.equal(punkt(suche), '51.505454|-0.091051||Google Maps', 'ein link, den die app selbst baut, geht zurück');

const frage = 'https://maps.google.com/maps?q=48.2081743,16.3738336&hl=de';
assert.equal(punkt(frage), '48.208174|16.373834||Google Maps', 'die alte q-form');

const ziel = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=51.5055,-0.0911&destination=51.5155,-0.0817&waypoints=51.51|51.52';
assert.equal(punkt(ziel), '51.5155|-0.0817||Google Maps', 'ein weg endet an einem punkt, nicht an der mitte');

const alt = 'https://maps.google.com/maps?ll=35.0116,135.7681&z=15';
assert.equal(punkt(alt), '35.0116|135.7681||Google Maps', 'll ist die alte mitte-angabe');

const einzeln = 'https://maps.google.com/maps?lat=41.8902&lon=12.4922';
assert.equal(punkt(einzeln), '41.8902|12.4922||Google Maps', 'lat und lon getrennt');

const ohneSchema = 'www.google.com/maps/place/Tower+Bridge/@51.505464,-0.075381,17z';
assert.equal(punkt(ohneSchema), '51.505464|-0.075381|Tower Bridge|Google Maps', 'aus der adreßzeile kopiert steht dort kein https');

/* ── 2. die andern karten ───────────────────────────────────────────────── */

const frei = 'https://www.openstreetmap.org/?mlat=51.5055&mlon=-0.0911#map=17/51.5055/-0.0911';
assert.equal(punkt(frei), '51.5055|-0.0911||OpenStreetMap', 'offene karten gehen auch');

const rahmen = kartenVorschau({ lat: 51.5054537, lng: -0.0910505, titel: 'Borough market' }, 15);
assert.match(rahmen, /^https:/u, 'die einbettung ist ein link');
assert.ok(punktAusKartenLink(rahmen), 'und die app liest, was sie selbst einbettet');

const geo = 'geo:51.5054537,-0.0910505?q=Borough%20Market';
assert.equal(punkt(geo), '51.505454|-0.091051|Borough Market|Kartenverweis', 'ein geo-verweis von der tastatur');

const zahlen = '51.5054537, -0.0910505';
assert.equal(punkt(zahlen), '51.505454|-0.091051||eingegeben', 'zwei zahlen sind auch ein punkt');
assert.deepEqual(punktAusText('51,505454 -0,091051'), { lat: 51.505454, lng: -0.091051 }, 'mit dezimalkomma und leerzeichen');
assert.deepEqual(punktAusText('35.0116, 135.7681'), { lat: 35.0116, lng: 135.7681 }, 'und wie bisher mit punkt');

/* ── 3. nichts schreiben, wenn nichts da ist ────────────────────────────── */

assert.equal(punktAusKartenLink('https://www.google.com/maps/place/Borough+Market'), null, 'ein platz ohne zahl schreibt nichts');
assert.equal(punktAusKartenLink('https://www.google.com/maps?q=Borough+Market&hl=de'), null, 'eine suche ohne zahl schreibt nichts');
assert.equal(punktAusKartenLink('https://www.google.com/maps/@191.5,16.3,14z'), null, 'eine breite über 90 grad ist keine weltgegend');
assert.equal(punktAusKartenLink('https://www.google.com/maps/@51.5,191.3,14z'), null, 'eine länge über 180 grad ebenso');
assert.equal(punktAusKartenLink('https://www.google.com/maps/@0,0,3z'), null, 'null/null ist der atlantik, kein ort');
assert.equal(punktAusKartenLink('https://www.google.com/maps/@51.5'), null, 'eine zahl allein ist kein punkt');
assert.equal(punktAusKartenLink('Borough market'), null, 'ein name ist kein link');
assert.equal(punktAusKartenLink(''), null, 'leer nicht');
assert.equal(punktAusKartenLink('   '), null, 'und luft auch nicht');

assert.equal(istKurzLink('https://maps.app.goo.gl/K3vQ9m2LyWonE9JP9'), true, 'der teilen-knopf gibt eine kurzfassung');
assert.equal(istKurzLink('https://goo.gl/maps/4J6dP4fT8v2nA9Zk6'), true, 'auch die alte kurzfassung');
assert.equal(istKurzLink(platz), false, 'ein langer link ist keine kurzfassung');
assert.equal(istKartenText('https://maps.app.goo.gl/K3vQ9m2LyWonE9JP9'), true, 'die kurzfassung will gelesen werden');
assert.equal(istKartenText('Borough market'), false, 'ein getippter name nicht');
assert.equal(istKartenText(zahlen), false, 'und zwei zahlen sind kein verweis');

/* ── 4. die kurzfassung wird nachgelesen, nicht geraten ─────────────────── */

async function nachlesen() {
  return { ziel: platz };
}

const gefunden = await punktAusLink('https://maps.app.goo.gl/K3vQ9m2LyWonE9JP9', { holen: nachlesen });
assert.ok(gefunden.punkt, 'der kurze link gibt seinen punkt, nachdem er vorgelegt wurde');
assert.equal(`${gefunden.punkt!.lat},${gefunden.punkt!.lng}`, '51.505454,-0.091051');
assert.equal(gefunden.grund, 'nichts');

const verschollen = await punktAusLink('https://maps.app.goo.gl/K3vQ9m2LyWonE9JP9', { holen: async () => null });
assert.equal(verschollen.punkt, null, 'antwortet der dienst nicht, wird nichts geschrieben');
assert.equal(verschollen.grund, 'zu kurz', 'und das feld kann sagen, warum');

const verwaist = await punktAusLink('https://maps.app.goo.gl/K3vQ9m2LyWonE9JP9', {
  holen: async () => ({ ziel: 'https://www.google.com/maps/search/?api=1&query=Borough+Market' }),
});
assert.equal(verwaist.punkt, null, 'führt der verweis ins leere, bleibt das feld leer');
assert.equal(verwaist.grund, 'kein punkt');

const schnell = await punktAusLink(platz, {
  holen: async () => {
    throw new Error('ein langer link braucht das nachlesen nicht');
  },
});
assert.ok(schnell.punkt, 'der lange link wird allein gelesen');

const abgebrochen = await punktAusLink('https://maps.app.goo.gl/K3vQ9m2LyWonE9JP9', { holen: nachlesen, abgebrochen: () => true });
assert.equal(abgebrochen.punkt, null, 'wer das feld verläßt, kriegt den punkt nicht mehr geschrieben');

/* ── 5. der rückweg: was die app baut, kann sie auch lesen ──────────────── */

const satz = {
  id: 'g1',
  punkte: [
    { id: 'a', titel: 'Borough market', lat: 51.5055, lng: -0.0911, ort: 'London' },
    { id: 'b', titel: 'Sky Garden', lat: 51.5155, lng: -0.0817, ort: 'London' },
  ],
  wegKm: 2.6,
  minuten: 34,
  lat: 51.5105,
  lng: -0.0864,
  stadt: 'London',
  schrittKm: 1.9,
} satisfies Haufung;

assert.equal(punkt(kartenLink({ lat: 51.5055, lng: -0.0911, titel: 'Borough market' })), '51.5055|-0.0911||Google Maps', 'die nadel, die die app baut, liest sich selbst');
assert.equal(punkt(wegLink(satz)), '51.5155|-0.0817||Google Maps', 'und ein weg aus der analyse endet dort, wo er hinführt');

console.log('🎉 Kartenlinks geben ihren Punkt – und schreiben nichts, wenn keiner drin steht');
