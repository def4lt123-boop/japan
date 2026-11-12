import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test für die staffel der suche, für den fußweg in minuten und für das schloss
 * vorn an der seite. Alles läuft ohne netz: die dienste werden so gestellt, wie
 * sie antworten – auch mit einer absage.
 *
 *   TZ=Europe/Vienna npx tsx scripts/weg-test.mts
 */

import { TAKT_WERTE, bremsMelden, gebremst, takt, taktVergessen } from '../src/lib/suchtakt';
import { bremsenVergessen, fragegedaechtnisVergessen, orteSuchen, bremsZuletzt, frageLohnt } from '../src/lib/anbieter';
import { routeBekannt, routeZwischen } from '../src/lib/routen';
import { FUSS, minutenAus, nahGenug, wegLaenge, wegSchaetzen, wegText, wegTitel, type Fussweg } from '../src/lib/weg';
import { haufungen, nachbarn } from '../src/lib/naehe';
import { ansichtWert, aufgesperrt, passtDas, wurzel, zielSichern } from '../src/lib/ansicht.server';
import type { Eintrag } from '../src/lib/types';

const LEER = {
  reise_id: 'r1',
  art: 'aktivitaet',
  date: null,
  zeit: null,
  bis_zeit: null,
  dauer_min: null,
  bis_date: null,
  notiz: null,
  preis: null,
  waehrung: 'EUR',
  foto_url: null,
  foto_nachweis: null,
  buchungs_url: null,
  karten_stichwort: null,
  ort: null,
  adresse: null,
  kategorie: null,
};

const eintrag = (id: string, titel: string, lat: number | null, lng: number | null): Eintrag =>
  ({ id, titel, lat, lng, erstellt_am: '2026-01-01T10:00:00Z', sortierung: 1, ...(LEER as object) }) as Eintrag;

/* ── 1 · der suchtakt: in ruhe schnell, nach der bremse langsam ───────── */

taktVergessen();
assert.equal(gebremst(), false, 'ein frisches blatt fragt, wann es will');
assert.equal(takt(), TAKT_WERTE.ruhig, 'in ruhe eine viertelsekunde zwischen zwei fragen');
bremsMelden(true);
assert.equal(gebremst(), true, 'eine meldung bremst das blatt');
assert.equal(takt(), TAKT_WERTE.gebremst, 'und die pause wird lang');
assert.ok(TAKT_WERTE.gebremst >= 1_000, 'eine sekunde – die freien quellen mögen eine frage pro sekunde');
assert.ok(TAKT_WERTE.dauer >= 20_000, 'die bremse hält eine weile, nicht einen augenblick');
assert.equal(gebremst(Date.now() + TAKT_WERTE.dauer + 1), false, 'nach der frist fragt wieder wer will');
taktVergessen();
assert.equal(takt(), TAKT_WERTE.ruhig, 'und ein blatt, das nichts mehr zu tun hat, fängt von vorn an');

console.log('🎉 Die staffel bremst sich selbst, wo die quellen zumachen');

/* ── 2 · die quelle meldet die bremse, die leere hand bleibt draußen ──── */

const hand: string[] = [];
let lage: 'ruhig' | 'abgewiesen' | 'leer' = 'ruhig';

globalThis.fetch = (async (url: string | URL) => {
  const text = String(url);
  hand.push(text);
  if (lage === 'abgewiesen') return new Response('zu viele anfragen', { status: 429, headers: { 'retry-after': '7' } });
  if (lage === 'leer') return new Response(text.includes('photon.komoot.io') ? JSON.stringify({ features: [] }) : JSON.stringify([]));
  if (text.includes('photon.komoot.io')) {
    return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-0.0759, 51.5081] }, properties: { name: 'Tower of London', city: 'London', country: 'United Kingdom', countrycode: 'GB', type: 'castle' } }] }));
  }
  return new Response(JSON.stringify([]));
}) as typeof fetch;

assert.equal(frageLohnt('tower of london'), true, 'eine richtige frage wird gestellt');

bremsenVergessen();
fragegedaechtnisVergessen();
const ruhigeHand = await orteSuchen('tower of london', null, true);
assert.ok(ruhigeHand.length >= 1, 'in ruhe antwortet eine quelle, die andre schweigt');
assert.equal(bremsZuletzt(), false, 'eine volle hand meldet keine bremse');
const vorZweiter = hand.length;
await orteSuchen('tower of london', null);
assert.equal(hand.length, vorZweiter, 'dieselbe frage zum zweiten mal geht nicht noch einmal ins netz');

// eine leere hand ohne bremse ist eine antwort: sie wird gemerkt
lage = 'leer';
fragegedaechtnisVergessen();
assert.deepEqual(await orteSuchen('qwxvrtz ruhige frage', null), [], 'was niemand kennt, ist eine leere hand, kein fehler');
assert.equal(bremsZuletzt(), false, 'und eine leere hand ohne absage ist keine bremse');
const vorGemerkt = hand.length;
await orteSuchen('qwxvrtz ruhige frage', null);
assert.equal(hand.length, vorGemerkt, 'die leere hand wird gemerkt – dieselbe frage fragt nicht noch einmal');

// eine leere hand mitten in der bremse ist keine antwort, sondern eine pause
lage = 'abgewiesen';
const abgewiesen = await orteSuchen('ghost sign qwxvrtz', null, true);
assert.deepEqual(abgewiesen, [], 'eine absage wirft die suche nicht um');
assert.equal(bremsZuletzt(), true, 'die absage wird mitgemeldet – das blatt zieht die pause daraus');
const inDerBremse = hand.length;
await orteSuchen('andere frage qwxvrtz', null, true);
assert.equal(hand.length, inDerBremse, 'in der bremse wird keine quelle mehr angestupst – das spart die nächste absage');
bremsenVergessen();
lage = 'ruhig';
const vorErinnerung = hand.length;
const nochmal = await orteSuchen('ghost sign qwxvrtz', null);
assert.ok(hand.length > vorErinnerung, 'was in der bremse leer war, wird ein zweites mal gefragt – die leere hand bleibt nicht liegen');
assert.ok(nochmal.length >= 1, 'und beim zweiten mal findet die suche, was beim ersten mal nicht zu fragen war');

console.log('🎉 Abgewiesene fragen werden gemeldet und nicht vorgemerkt');

/* ── 3 · der fußweg: minuten zuerst ──────────────────────────────────── */

const turm = { lat: 51.5081, lng: -0.0759 };
const bruecke = { lat: 51.5104, lng: -0.0765 };

const ueberschlagen = wegSchaetzen(turm, bruecke);
assert.ok(ueberschlagen, 'zwei punkte ergeben einen schritt');
assert.equal(ueberschlagen!.quelle, 'geschätzt', 'ohne netz ist die zahl eine überschlagung');
assert.ok(ueberschlagen!.km > 0.3 && ueberschlagen!.km < 0.6, `ein viertel kilometer luft bleibt ein halber kilometer weg (ist ${ueberschlagen!.km})`);
assert.ok(ueberschlagen!.minuten >= 4 && ueberschlagen!.minuten <= 10, 'und das sind ein paar minuten zu fuß, nicht ein tag');
assert.deepEqual(ueberschlagen, wegSchaetzen(bruecke, turm), 'der schritt ist in beide richtungen gleich lang');
assert.equal(wegSchaetzen(turm, null), null, 'wo kein zweiter punkt ist, ist kein weg');
assert.equal(wegSchaetzen({ lat: null, lng: null }, bruecke), null, 'ein punkt ohne Google Maps hat keinen weg');

assert.match(wegText(ueberschlagen), /^≈ \d+ Min\.$/, 'die überschlagung steht mit ≈ da');
assert.equal(wegText({ km: 1.2, minuten: 16, quelle: 'gerechnet' }), '16 Min.', 'und die gerechnete zahl ohne schmuck');
assert.equal(wegText({ km: 50, minuten: 400, quelle: 'gerechnet' }), '6 h 40 Min.', 'stunden bleiben lesbar');
assert.equal(wegText({ km: 0.1, minuten: 0, quelle: 'gerechnet' }), '', 'null minuten sind kein text');
assert.equal(wegText(null), '');
assert.equal(wegLaenge({ km: 0.85, minuten: 11, quelle: 'gerechnet' }), '850 m', 'unter einem kilometer in metern');
assert.equal(wegLaenge({ km: 1.4, minuten: 18, quelle: 'geschätzt' }), '1,4 km', 'darüber in kommaschreibweise');
assert.equal(wegLaenge(null), '');
assert.match(wegTitel(ueberschlagen), /Wegdienst war nicht zu erreichen/, 'die zeile sagt, woran die überschlagung liegt');
assert.match(wegTitel({ km: 1.2, minuten: 16, quelle: 'gerechnet' }), /gerechnet$/);
assert.equal(minutenAus(null), 0, 'ohne strecke keine minuten');
assert.equal(minutenAus(4.6, FUSS), 60, 'vier kilometer und sechs hundert meter sind eine stunde zu fuß');
assert.equal(minutenAus(4.6, 'auto'), 7, 'und sieben minuten mit dem auto');

assert.equal(nahGenug({ km: 0.9, minuten: 12, quelle: 'gerechnet' }, 1), true, 'unter der grenze bleibt der punkt stehen');
assert.equal(nahGenug({ km: 1, minuten: 13, quelle: 'geschätzt' }, 1), true, 'und auf der grenze');
assert.equal(nahGenug({ km: 1.1, minuten: 15, quelle: 'geschätzt' }, 1), false, 'darüber fällt er aus dem filter');
assert.equal(nahGenug(null, 1), true, 'ein punkt ohne Google Maps wird nicht aussortiert – ihm fehlt der punkt, nicht die nähe');

console.log('🎉 Der Fußweg steht in Minuten, die Luftlinie nur noch dahinter');

/* ── 4 · der wegdienst rechnet, und meldet ab ────────────────────────── */

taktVergessen();
const gefragte: string[] = [];
globalThis.fetch = (async (url: string | URL) => {
  const text = String(url);
  gefragte.push(text);
  if (text.includes('16.37')) return new Response('zu viele anfragen', { status: 429, headers: { 'retry-after': '9' } });
  if (text.includes('135.')) return new Response('dienst ausgefallen', { status: 500 });
  return new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 1180, duration: 940, geometry: { coordinates: [[-0.0759, 51.5081], [-0.0745, 51.5014]] } }] }));
}) as typeof fetch;

const gerechnet = await routeZwischen(turm, bruecke, 'zu fuss');
assert.equal(gerechnet?.km, 1.2, 'der weg wird auf einen dezimal gerundet');
assert.equal(gerechnet?.minuten, 16, '940 sekunden sind sechzehn minuten');
assert.equal(gerechnet?.quelle, 'gerechnet', 'und die zeile sagt, dass gerechnet ist');
assert.deepEqual(gerechnet?.strecke, [[51.5081, -0.0759], [51.5014, -0.0745]], 'die linie für die karte kommt mit');
assert.ok(/router\.project-osrm\.org\/route\/v1\/foot\//.test(gefragte[0]!), 'gerechnet wird über den offenen fußwegdienst');
assert.ok(/overview=false/.test(gefragte[0]!), 'ohne zeichenauftrag bleibt die anfrage klein');
assert.equal(routeBekannt(turm, bruecke, 'zu fuss')?.quelle, 'gerechnet', 'was gerechnet ist, liegt im kopf');
assert.equal(routeBekannt(bruecke, turm, 'zu fuss'), null, 'das paar zurück ist eine eigne frage');
const verrat = gefragte.length;
await routeZwischen(turm, bruecke, 'zu fuss');
assert.equal(gefragte.length, verrat, 'dasselbe paar wird nicht noch einmal gefragt');

const wiener = await routeZwischen({ lat: 48.2082, lng: 16.3738 }, { lat: 48.2103, lng: 16.368 }, 'zu fuss');
assert.equal(wiener?.quelle, 'geschätzt', 'die absage wird zur überschlagung – die zeile bleibt gefüllt');
assert.ok((wiener?.minuten ?? 0) > 0, 'und die überschlagung ist keine null');
assert.equal(gebremst(), true, 'die absage bremst das blatt');
assert.equal(takt(), TAKT_WERTE.gebremst, 'von da an liegen pausen zwischen den fragen');
const nachDerBremse = gefragte.length;
await routeZwischen({ lat: 41.3902, lng: 2.1638 }, { lat: 41.3938, lng: 2.1689 }, 'zu fuss');
assert.equal(gefragte.length, nachDerBremse, 'in der bremse wird der dienst gar nicht mehr gefragt');
taktVergessen();

const ausgefallen = await routeZwischen({ lat: 35.0116, lng: 135.7681 }, { lat: 35.0394, lng: 135.7292 }, 'zu fuss');
assert.equal(ausgefallen?.quelle, 'geschätzt', 'ein dienst, der ausfällt, wirft niemanden um');
assert.equal(gebremst(), true, 'und er wird eine zeitlang nicht weiter gefragt – die zeilen bleiben trotzdem gefüllt');
taktVergessen();
assert.equal(gebremst(), false, 'nach der frist ist die rechnung wieder frei');

console.log('🎉 Der Weg wird gerechnet, wo der Dienst antwortet, und überschlagen, wo nicht');

/* ── 5 · der filter mißt, was die zeile zeigt ─────────────────────────── */

const nah = eintrag('a', 'Turm', 51.5081, -0.0759);
const dabei = eintrag('b', 'Platz am Turm', 51.5104, -0.0765);
const daneben = eintrag('c', 'Markthalle', 51.5155, -0.0927);
const weit = eintrag('d', 'Fähre nach Gravesend', 51.2, -0.6);
const blind = eintrag('e', 'Ohne Punkt', null, null);
const wartend = [nah, dabei, daneben, weit, blind];

const funde = nachbarn(wartend);
assert.equal(funde.has('e'), false, 'wer keinen punkt hat, hat keinen nachbarn');
assert.ok(funde.get('a')!.partner.id !== 'a', 'der nächste ist ein andrer, nicht man selbst');
const abstand = new Map<string, Fussweg | null>();
for (const e of wartend) abstand.set(e.id, funde.get(e.id)?.weg ?? null);
assert.ok((abstand.get('a')?.km ?? 99) <= 1, 'turm und platz liegen beieinander');
assert.ok((abstand.get('b')?.km ?? 99) <= 1, 'und umgekehrt');

const bei1 = wartend.filter((e) => nahGenug(abstand.get(e.id) ?? null, 1));
assert.deepEqual(bei1.map((e) => e.id).sort(), ['a', 'b', 'e'], 'bei einem kilometer bleiben die beieinanderliegenden – und der punkt ohne google maps');
assert.deepEqual(
  wartend.filter((e) => nahGenug(abstand.get(e.id) ?? null, 2)).map((e) => e.id).sort(),
  ['a', 'b', 'c', 'e'],
  'bei zwei kilmetern kommt die markthalle dazu, die färre bleibt draußen'
);
assert.ok((abstand.get('d')?.km ?? 0) > 2, 'die färre bleibt das ziel für sich');

const gruppen1 = haufungen(wartend, 1);
assert.equal(gruppen1.find((g) => g.punkte.length >= 2)?.punkte.length, 2, 'bei einem kilometer gehören turm und brücke zusammen');
assert.ok(!gruppen1.some((g) => g.punkte.length >= 2 && g.punkte.some((p) => p.id === 'c')), 'und die markthalle ist bei einem kilometer noch allein');
assert.ok(haufungen(wartend, 2).some((g) => g.punkte.length >= 3), 'bei zwei kilometern wächst die gruppe');
assert.ok(gruppen1.every((g) => g.minuten > 0 || g.punkte.length === 1), 'jede gruppe mit wegen hat minuten');

console.log('🎉 Der filter für höchstens einen kilometer nimmt dieselbe zahl wie die zeile');

/* ── 6 · das schloss: ein passwort, kein benutzername ────────────────── */

assert.equal(zielSichern('/t/r1/liste'), '/t/r1/liste', 'ein weg innerhalb der seite führt zurück');
assert.equal(zielSichern('/t/r1/liste?x=1'), '/t/r1/liste?x=1', 'und die frage dahinter bleibt dran');
assert.equal(zielSichern('//evil.example/x'), '/', 'zwei striche sind eine fremde seite, kein weg');
assert.equal(zielSichern('https://evil.example'), '/', 'und eine volle adresse schon gar nicht');
assert.equal(zielSichern('t/r1/liste'), '/', 'ein weg ohne strich vorn ist kein weg');
assert.equal(zielSichern(null), '/', 'ohne angabe geht es heim');
assert.equal(zielSichern(`/${'a'.repeat(500)}`.slice(0, 200)).length, 200, 'und ein langer weg wird abgeschnitten');

process.env.ANSICHT_PASSWORT = '170493';
assert.equal(await passtDas('170493'), true, 'das wort macht die tür auf');
assert.equal(await passtDas('123456'), false, 'ein andres nicht');
assert.equal(await passtDas(''), false, 'und das leere feld auch nicht');
const kennung = await wurzel('170493');
assert.match(kennung, /^[0-9a-f]{64}$/, 'vergleichen wird eine wurzel, nicht das wort');
assert.equal(await wurzel('170493'), kennung, 'dieselbe eingabe, dieselbe wurzel');
assert.notEqual(await wurzel('170494'), kennung, 'ein zeichen mehr ist eine andre wurzel');
const cookie = await ansichtWert();
assert.equal(cookie, kennung, 'der cookie trägt die wurzel');
assert.notEqual(cookie, '170493', 'das wort selbst steht in keinem cookie');
assert.equal(await aufgesperrt(cookie), true, 'und die wurzel öffnet die tür');
assert.equal(await aufgesperrt('170493'), false, 'das wort allein tut es nicht');
assert.equal(await aufgesperrt(null), false, 'ohne cookie bleibt die tür zu');
process.env.ANSICHT_PASSWORT = 'andres wort';
assert.equal(await passtDas('170493'), false, 'wer das wort über die umgebung setzt, setzt es überall');
assert.equal(await passtDas('andres wort'), true);
delete process.env.ANSICHT_PASSWORT;
assert.equal(await passtDas('170493'), true, 'ohne umgebung gilt das kurze wort');

console.log('🎉 Die seite ist zum ansehen verschlossen – nach dem selben wort wie überall');

/* ── 7 · und das wort bleibt, wo es hingehört ────────────────────────── */

const Wurzel = process.cwd();
const gefundene: string[] = [];
function sammeln(ordner: string, akku: string[] = []) {
  for (const name of readdirSync(join(Wurzel, ordner))) {
    const pfad = join(ordner, name);
    if (statSync(join(Wurzel, pfad)).isDirectory()) sammeln(pfad, akku);
    else if (/\.(tsx?|css)$/.test(name)) akku.push(pfad);
  }
  return akku;
}

for (const pfad of sammeln('src')) {
  if (/\.server\.ts$/.test(pfad)) continue;
  const inhalt = readFileSync(join(Wurzel, pfad), 'utf8');
  if (inhalt.includes('170493')) gefundene.push(pfad);
}
assert.deepEqual(gefundene, [], 'das ansehen-wort steht in keiner datei, die ins blatt kommt');
assert.ok(existsSync(join(Wurzel, 'src/middleware.ts')), 'die tür sitzt vorn an der seite');
const mittel = readFileSync(join(Wurzel, 'src/middleware.ts'), 'utf8');
assert.ok(!mittel.includes('170493'), 'auch im mittel steht das wort nicht, nur die wurzel');

console.log('🎉 Das Passwort bleibt auf dem server');
