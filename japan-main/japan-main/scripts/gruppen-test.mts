/**
 * Test für das Sammeln und das Gruppieren: eingefügter text wird zu punkten ohne
 * tag, und was beieinander liegt, wird ein vorschlag für einen tag. gerechnet wird
 * ohne netz – der test läuft deshalb auch in einer kiste ohne verbindung.
 *
 *   TZ=Europe/Vienna npx tsx scripts/gruppen-test.mts
 */
import assert from 'node:assert/strict';
import { HOECHSTEN, ohneDubletten, zeilenAusText } from '../src/lib/sammel';
import { haufungen, naechsteFolge, nachbar, routenvorschlag, sortieren, tagAbstand, tagAenderung, wegLink } from '../src/lib/naehe';
import { schaetzungKm } from '../src/lib/karten';
import type { Eintrag } from '../src/lib/types';

const LEER = {
  reise_id: 'r1',
  art: 'aktivitaet',
  date: null,
  zeit: null,
  bis_zeit: null,
  dauer_min: null,
  bis_date: null,
  ort: null,
  adresse: null,
  lat: null,
  lng: null,
  karten_stichwort: null,
  notiz: null,
  preis: null,
  waehrung: null,
  buchung_nr: null,
  buchung_url: null,
  foto_url: null,
  foto_nachweis: null,
  sortierung: 0,
} as const;

function punkt(id: string, titel: string, lat: number | null = null, lng: number | null = null, date: string | null = null): Eintrag {
  return { ...LEER, id, titel, lat, lng, date } as Eintrag;
}

/* ── 1. der eingefügte text ─────────────────────────────────────────────── */

const eingefügt = `Ein Tag in London:
• Big Ben
1. Tower Bridge
(a) Sky Garden
[ ] Borough market
🌉 Tower Bridge
Shell Walk und die
treppe hoch
-`;

const titel = zeilenAusText(eingefügt).map((z) => z.titel);
assert.deepEqual(
  titel,
  ['Big Ben', 'Tower Bridge', 'Sky Garden', 'Borough market', 'Shell Walk und die treppe hoch'],
  'aufzählung und emoji fallen weg, doppektes kommt einmal, ein umbruch wird angeschlossen'
);
assert.ok(!titel.includes('Ein Tag in London'), 'eine überschrift über der liste ist kein punkt');
assert.ok(!titel.includes('-'), 'ein strich für sich ist kein punkt');
assert.equal(zeilenAusText('12 Oxford Street').length, 1, 'eine adresse mit zahl bleibt ein punkt');
assert.equal(zeilenAusText('').length, 0, 'leerer text erfindet nichts');
assert.equal(zeilenAusText('   \n\n  ').length, 0, 'und leerzeilen auch nicht');

const klein = zeilenAusText('Big Ben\nbig ben!');
assert.deepEqual(klein.map((z) => z.titel), ['Big Ben big ben!'], 'klein geschrieben ist ein umbruch, nicht zweimal derselbe punkt');
const doppelt = ohneDubletten(zeilenAusText('Big Ben!\nSKY GARDEN'), ['Big Ben', 'Tower Bridge']);
assert.deepEqual(doppelt.neu.map((z) => z.titel), ['SKY GARDEN'], 'was die reise schon kennt, wird nicht zweimal angelegt – groß, klein oder mit zeichen');
assert.equal(doppelt.dubletten, 1, 'und es wird gezählt, damit die rückmeldung stimmt');
assert.ok(HOECHSTEN >= 20 && HOECHSTEN <= 60, `die obergrenze hält die staffel klein – ${HOECHSTEN}`);

/* ── 2. abstand unter den wartenden ─────────────────────────────────────── */

const westminster = punkt('w1', 'Big Ben', 51.5007, -0.1246);
const auge = punkt('w2', 'London Eye', 51.5033, -0.1196);
const markt = punkt('s1', 'Borough market', 51.5054, -0.091);
const greenwich = punkt('g1', 'Cutty Sark', 51.4826, -0.0097);
const irrend = punkt('n1', 'Sky Garden');

const { mit, ohne } = sortieren([westminster, auge, markt, greenwich, irrend]);
assert.equal(mit.length, 4, 'gerechnet wird mit dem, was einen punkt hat');
assert.deepEqual(ohne.map((e) => e.id), ['n1'], 'was keinen hat, bleibt sichtbar');
const bett = { ...punkt('b1', 'Hotel Prado', 51.501, -0.085, '2027-10-24'), art: 'unterkunft' } as Eintrag;
assert.deepEqual(sortieren([bett]).mit, [], 'ein bett wird nicht gruppiert');
assert.deepEqual(sortieren([bett]).ohne, [], 'und es gilt nicht als wartend');
assert.deepEqual(haufungen([bett, westminster, auge], 2.5).map((h) => h.punkte.map((p) => p.id)), [['w1', 'w2']], 'die betten bleiben aus den gruppen draußen');

const eng = haufungen([westminster, auge, markt, greenwich, irrend], 1);
assert.deepEqual(eng.map((h) => h.punkte.map((p) => p.id)), [['w1', 'w2'], ['s1'], ['g1']], 'bei einem kilometer gehweite gehört der markt nicht dazu – große zuerst, einzelne nach namen');
assert.equal(eng[0]!.wegKm, 0.7, `der weg durch die gruppe sind die wege, nicht die linie – ${eng[0]!.wegKm} km gehweite bei 0,5 km luftlinie`);
assert.ok(eng[0]!.minuten >= 5 && eng[0]!.minuten <= 10, `und der weg ist ein fußweg – ${eng[0]!.minuten} min`);

const mittel = haufungen([westminster, auge, markt, greenwich, irrend], 3);
const ordnung = mittel.map((h) => [...h.punkte.map((p) => p.id)].sort());
assert.deepEqual(ordnung, [['s1', 'w1', 'w2'], ['g1']], 'bei drei kilometern gehweite rückt der markt an den fluß');
assert.ok(mittel[0]!.schrittKm <= 3, `kein schritt in der gruppe ist weiter als die schwelle – ${mittel[0]!.schrittKm} km`);
assert.ok(mittel[0]!.wegKm <= 2 * 3, `der gang sind zwei schritte, kein hin und her – ${mittel[0]!.wegKm} km`);
assert.equal(new Set(mittel[0]!.punkte.map((p) => p.id)).size, 3, 'und jeder punkt kommt genau einmal');

const weit = haufungen([westminster, auge, markt, greenwich, irrend], 10);
assert.equal(weit.length, 1, 'bei zehn kilometern gehweite – über die thames zwei mal sechs – wird aus allem einer');
assert.equal(weit[0]!.punkte.length, 4, 'und greenwich kommt über die kette dazu');
assert.ok(weit[0]!.schrittKm > 1.5, `der weiteste schritt verrät die kette – ${weit[0]!.schrittKm} km`);
assert.equal(haufungen([westminster, auge, markt, greenwich], 2.5).length, 3, 'eine schwelle weniger, und der markt fällt wieder raus');
assert.deepEqual(haufungen([], 2.5), [], 'ohne wartende punkte keine gruppen');

const einsam = haufungen([greenwich, irrend], 2.5);
assert.equal(einsam.length, 1, 'was allein liegt, bleibt allein');
assert.equal(einsam[0]!.punkte.length, 1, 'und wird nicht mit einem fremden punkt verheiratet');
const nachbarn = nachbar({ id: 'g1', titel: 'Cutty Sark', lat: 51.4826, lng: -0.0097, ort: null }, mit);
assert.ok(nachbarn && nachbarn.km > 0 && nachbarn.nachbar.id !== 'g1', 'ein einzelner punkt kennt seinen nächsten');
assert.equal(nachbar({ id: 'x', titel: 'einziger', lat: 1, lng: 1, ort: null }, [{ id: 'x', titel: 'einziger', lat: 1, lng: 1, ort: null }]), null, 'ohne zweiten punkt gibt es keinen nachbarn');

assert.deepEqual(haufungen([irrend], 2.5), [], 'ohne punkte auf der karte gibt es keine gruppen');

/* ── 3. der tag, der dazu paßt ──────────────────────────────────────────── */

const gruppe = haufungen([westminster, auge, markt], 3)[0]!;
const tage = [
  { datum: '2027-10-26', punkte: [{ lat: 41.38, lng: 2.17 }] },
  { datum: '2027-10-24', punkte: [{ lat: 51.508, lng: -0.076 }] },
  { datum: '2027-10-25', punkte: [] as { lat: number; lng: number }[] },
];
const abstand = tagAbstand(gruppe, tage);
assert.equal(abstand[0]!.datum, '2027-10-24', 'der tag mit der nächsten halte steht oben');
assert.ok(abstand[0]!.km !== null && abstand[0]!.km < 5, `und der abstand ist ein fußweg – ${abstand[0]!.km} km`);
assert.equal(abstand[1]!.datum, '2027-10-26', 'ein tag mit weiter halte rutscht hinter den nächsten');
assert.equal(abstand[2]!.datum, '2027-10-25', 'ein tag ohne halte steht am ende – es fehlt jede rechnung');
assert.equal(abstand[2]!.km, null, 'ohne halte gibt es keinen abstand, aber einen tag');
assert.ok(abstand[2]!.km === null && abstand[0]!.km !== null, 'ein unbekannter abstand wird nicht vorgeschlagen');
assert.equal(tagAbstand(gruppe, []).length, 0, 'ohne reisetage gibt es nichts zu wählen');

const änderung = tagAenderung([westminster, auge, irrend], gruppe, '2027-10-24');
assert.equal(änderung.length, gruppe.punkte.length, 'jeder punkt der gruppe bekommt den tag');
assert.ok(änderung.every((a) => a.patch.date === '2027-10-24'), 'derselbe tag für die ganze gruppe');
assert.deepEqual(änderung.map((a) => a.patch.sortierung), [1, 2, 3], 'die gangreihenfolge wird die reihenfolge am tag');
assert.ok(änderung.every((a) => typeof a.id === 'string' && a.patch !== undefined), 'und es ist die form von eintraegeRueckwaerts');
assert.ok(änderung.every((a) => a.id !== 'n1'), 'wer keinen punkt hat, wird nicht mitgezogen');

assert.ok(wegLink(gruppe).includes('google.com/maps/dir'), 'der weg durch die gruppe führt nach Google Maps');
assert.ok(wegLink(gruppe).includes('travelmode=walking'), 'und zu fuß');
assert.ok(wegLink(haufungen([westminster], 2.5)[0]!).includes('maps/search'), 'ein einzelner punkt hat keinen weg, nur eine nadel');

/* ── 6. der vorschlag folgt den wegen ──────────────────────────────────── */

const matrix = [
  [0, 6, 40, 5],
  [6, 0, 7, 30],
  [40, 7, 0, 4],
  [5, 30, 4, 0],
];
const ecke = (lat: number, lng: number) => ({ lat, lng });
const viereck = [ecke(0, 0), ecke(0, 1), ecke(1, 1), ecke(1, 0)];
const kosten = (reihe: number[]) => reihe.reduce((summe, p, i) => (i ? summe + matrix[reihe[i - 1]!]![p]! : summe), 0);
const folgen = (liste: number[]): number[][] => {
  if (liste.length <= 1) return [liste];
  const fond: number[][] = [];
  liste.forEach((wert, index) => {
    const rest = [...liste.slice(0, index), ...liste.slice(index + 1)];
    for (const folge of folgen(rest)) fond.push([wert, ...folge]);
  });
  return fond;
};
const alleFolgen = folgen([0, 1, 2, 3]);

const vorschlag = routenvorschlag(viereck, (a, b) => matrix[a]![b]!);
assert.deepEqual([...vorschlag].sort(), [0, 1, 2, 3], 'jeder punkt kommt genau einmal vor');
assert.equal(
  kosten(vorschlag),
  Math.min(...alleFolgen.map(kosten)),
  `der vorschlag ist die kürzeste route durch die vier – ${kosten(vorschlag)} gegen ${Math.min(...alleFolgen.map(kosten))}`
);
assert.ok(
  kosten(vorschlag) <= kosten(naechsteFolge(4, (a, b) => matrix[a]![b]!, 0)),
  'und nie teurer als der reine gang zum nächsten'
);
assert.deepEqual(routenvorschlag([ecke(1, 1)], () => 0), [0], 'ein einzelner punkt ist eine route');
assert.deepEqual([...routenvorschlag([ecke(0, 0), ecke(0, 1)], () => 3)].sort(), [0, 1], 'zwei halte sind beide richtungen gleich');
assert.deepEqual(routenvorschlag([], () => 0), [], 'ohne halte kein gang');
assert.deepEqual(
  [...routenvorschlag(viereck, (a, b) => (a === b ? 0 : Number.POSITIVE_INFINITY))].sort(),
  [0, 1, 2, 3],
  'was der dienst nicht beantwortet, wird nicht erfunden – es bleibt eine reihenfolge, keine rechnung'
);

const gruppenfolge = haufungen([westminster, auge, markt], 3)[0]!;
assert.deepEqual(
  gruppenfolge.punkte.map((p) => p.id),
  routenvorschlag(gruppenfolge.punkte, (a, b) => schaetzungKm(gruppenfolge.punkte[a]!, gruppenfolge.punkte[b]!) ?? 0).map((i) => gruppenfolge.punkte[i]!.id),
  'die gruppe steht schon in der reihenfolge des gangs – dasselbe gewicht, dieselbe folge'
);

console.log('🎉 eingefügter text wird zu punkten und gruppen');
