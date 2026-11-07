import assert from 'node:assert/strict';
import { abstandTage, addTage, gilt, monatsRaster, tagKurz, tagLang, wochenTage, zeitraum, zahlReisetage, heuteIso, WOCHEN_ANFANG } from '../src/lib/dates';
import { chronologisch, eintragVersetzen, preisText, reiseTage, giltAm, naechte, offeneNachte, planFortschritt, sortierungTauschen, stadtDesTages, tagesPlan, tagEintraege, tagWechsel, uebernachtungAm, unterkuenfte, aufschluesselung, laufend, vergangen, inTagen, heutigerTag } from '../src/lib/plan';
import { ANDERE_KATEGORIEN, KATEGORIEN, kategorie, kategorieVorschlag, artMeta } from '../src/lib/kategorien';
import { geld, plural, sauber, uid, zaehlen, minutenText } from '../src/lib/format';
import { MODI, entfernungKm, kartenLink, kartenVorschau, schaetzungKm, schaetzungMinuten } from '../src/lib/karten';
import type { Eintrag, Reise } from '../src/lib/types';

/** Rechenblatt der App: Datum, Kalender, Betten, Sortierung, Budget. */

const reise: Reise = {
  id: 'r1',
  name: 'Herbst in Andalusien',
  land: 'Spanien',
  stationen: 'Sevilla · Granada',
  start_date: '2027-10-24',
  end_date: '2027-10-28',
  cover_url: null,
  cover_credit: null,
  beschreibung: null,
  budget: 1200,
  waehrung: 'EUR',
  personen: 2,
  archived: false,
};

const ein = (patch: Partial<Eintrag>): Eintrag => ({
  id: uid('e'),
  reise_id: 'r1',
  art: 'aktivitaet',
  kategorie: 'sehenswuerdigkeit',
  titel: 'Ort',
  date: '2027-10-24',
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
  sortierung: 1,
  ...patch,
});

/* ── Datum ────────────────────────────────────────────────────────────── */
assert.equal(gilt('2027-02-30'), false, '29. Februar in einem gemeinen Jahr ist ungültig nicht');
assert.equal(gilt('2028-02-29'), true);
assert.equal(addTage('2027-10-24', 4), '2027-10-28');
assert.equal(addTage('2027-12-30', 3), '2028-01-02');
assert.equal(abstandTage('2027-06-14', '2027-06-17'), 3, '14. bis 17. Juni sind drei Nächte');
assert.equal(zahlReisetage('2027-06-14', '2027-06-17'), 4);
assert.equal(tagKurz('2027-10-24'), 'So 24.10.', 'der 24. Oktober 2027 fällt auf einen Sonntag');
assert.equal(tagLang('2027-10-24'), 'Sonntag, 24. Oktober');
assert.equal(zeitraum('2027-10-24', '2027-10-28'), '24.–28. Okt 2027');
assert.equal(zeitraum('2027-10-29', '2027-11-02'), '29.10. 2027 – 02.11. 2027');
assert.equal(zeitraum('2027-10-24', '2027-10-24'), 'So 24.10.');
assert.equal(zeitraum(null, null), 'ohne Termine');
assert.deepEqual(WOCHEN_ANFANG, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
assert.deepEqual(wochenTage('2027-10-24').slice(0, 2), ['2027-10-18', '2027-10-19'], 'Woche beginnt montags');
const raster = monatsRaster(2027, 10);
assert.equal(raster[0]![0], null, 'Okt 2027 beginnt freitags → Lücke davor');
assert.equal(raster.flat().filter(Boolean).length, 31);
assert.equal(gilt(heuteIso()), true);

/* ── Kalender und Bett ────────────────────────────────────────────────── */
assert.deepEqual(reiseTage(reise), ['2027-10-24', '2027-10-25', '2027-10-26', '2027-10-27', '2027-10-28']);
const bett = ein({ titel: 'Hotel Prado', art: 'unterkunft', date: '2027-10-24', bis_date: '2027-10-27', ort: 'Sevilla', preis: 300, zeit: '15:00', bis_zeit: '11:00', kategorie: 'unterschlupf' });
const erste = ein({ titel: 'Alcázar', date: '2027-10-24', zeit: '09:30', dauer_min: 90, lat: 37.3833, lng: -5.99, preis: 14 });
const zweite = ein({ titel: 'Flamenco', date: '2027-10-24', zeit: '20:00', dauer_min: 70, lat: 37.389, lng: -5.984, sortierung: 3 });
const dritte = ein({ titel: 'Kathedrale', date: '2027-10-24', sortierung: 2 });
const fahrt = ein({ titel: 'Zug nach Granada', art: 'fahrt', date: '2027-10-27', zeit: '08:15', dauer_min: 200, preis: 42, lat: 37.3969, lng: -5.9593 });
const alle = [erste, zweite, dritte, bett, fahrt];

assert.deepEqual(tagEintraege(alle, '2027-10-24').map((e) => e.titel), ['Alcázar', 'Flamenco', 'Kathedrale'], 'erst die Uhrzeiten, dann was ohne Zeit am Ende steht');
assert.deepEqual(chronologisch(erste, dritte) < 0 ? ['Alcázar'] : [], ['Alcázar'], 'ohne Zeit steht der Punkt am Ende des Tages');
assert.equal(uebernachtungAm(alle, '2027-10-26')?.titel, 'Hotel Prado');
assert.equal(uebernachtungAm(alle, '2027-10-27'), null, 'in der Nacht nach dem Check-out gehört das Bett nicht mehr dazu');
assert.equal(giltAm(bett, '2027-10-24'), true);
assert.equal(giltAm(bett, '2027-10-28'), false);
assert.deepEqual(offeneNachte(reise, alle), ['2027-10-27'], 'eine Nacht ohne Bett');
assert.deepEqual(naechte(reise, alle).map((n) => Boolean(n.bett)), [true, true, true, false]);
assert.equal(stadtDesTages(alle, reise, '2027-10-28'), 'Granada', 'ohne Bett folgt die Stadt den Stationen');
const plan = tagesPlan(reise, alle, '2027-10-24');
assert.equal(plan.nummer, 1);
assert.equal(plan.stadt, 'Sevilla');
assert.equal(plan.minuten, 160);
assert.equal(plan.fuellung, 'gut');
assert.equal(heutigerTag(reise, '2027-10-26'), '2027-10-26');
assert.equal(heutigerTag(reise, '2027-10-01'), '2027-10-24', 'vor der Reise → erster Tag');
assert.equal(laufend(reise, '2027-10-25'), true);
assert.equal(vergangen(reise, '2027-11-01'), true);
assert.equal(inTagen(reise, '2027-10-20'), 4);

/* ── Sortieren und Verschieben ───────────────────────────────────────── */
const amTag = tagEintraege(alle, '2027-10-24');
assert.deepEqual(sortierungTauschen(amTag, dritte.id, -1).length, 2, 'Tausch betrifft genau zwei Zeilen');
const rutsch = eintragVersetzen(amTag, zweite.id, 0);
assert.ok(rutsch.length >= 2, 'nach oben schieben rückt die Kette');
assert.equal(eintragVersetzen(amTag, zweite.id, 1).length, 0, 'ein Feld zur Seite ist kein Umweg');
const umzug = tagWechsel(alle, erste.id, '2027-10-26');
assert.equal(umzug?.date, '2027-10-26');
assert.equal(umzug?.sortierung, 1, 'am neuen Tag hängt sich der Punkt ans Ende');
assert.equal(tagWechsel(alle, erste.id, '2027-10-24'), null, 'auf demselben Tag bleibt alles wie es ist');

/* ── Fortschritt, Geld, Karten ────────────────────────────────────────── */
const fort = planFortschritt(reise, alle);
assert.equal(fort.punkte.filter((p) => p.ok).length, 2, 'Zeitraum steht, Ort fehlt, Bild/Budget halblinks');
assert.equal(fort.prozent, 40);
assert.equal(planFortschritt({ ...reise, cover_url: 'x', budget: 900 }, [...alle, ein({ titel: 'Albaicín', date: '2027-10-25' }), ein({ titel: 'Sierra', date: '2027-10-26' }), ein({ titel: 'Sacromonte', date: '2027-10-27' }), ein({ titel: 'Markthalle', date: '2027-10-28' }), bett]).punkte[1].ok, false, 'die letzte Nacht bleibt ohne Bett');
const kosten = aufschluesselung(reise, alle);
assert.equal(kosten.gesamt, 356);
assert.equal(kosten.gesamtProPerson, 178);
assert.equal(kosten.offen, 844);
assert.deepEqual(kosten.jeKategorie.map((k) => k.kategorie), ['unterschlupf', 'transport', 'sehenswuerdigkeit'], 'nach Betrag sortiert, die Fahrt zählt zu Transport');
assert.deepEqual(kosten.jeKategorie.map((k) => k.betrag), [300, 42, 14]);

/* eigene Währung am Preis */
const ryokan = ein({ titel: 'Ryokan am See', art: 'unterkunft', date: '2027-10-26', bis_date: '2027-10-27', preis: 30000, waehrung: 'JPY', kategorie: 'unterschlupf' });
const gemischt = aufschluesselung(reise, [...alle, ryokan]);
assert.equal(gemischt.gesamt, 356, 'ein Betrag in anderer Währung läuft nicht in die Summe');
assert.deepEqual(gemischt.fremde.map((f) => f.titel), ['Ryokan am See']);
assert.match(gemischt.fremde[0]!.text, /30\.000 ¥ in JPY/);
assert.equal(gemischt.mitPreis, kosten.mitPreis + 1, 'gezählt wird er trotzdem');
assert.equal(preisText(ryokan, reise), '30.000 ¥');
assert.equal(preisText(erste, reise), '14 €');
assert.equal(geld(1240, 'EUR'), '1.240 €');
assert.equal(geld(99.5, 'USD'), '99,50 $');
assert.equal(geld(null, 'EUR'), '—');
assert.equal(minutenText(95), '1 h 35 Min');
assert.equal(plural(2, 'Tag', 'Tage'), '2 Tage');
assert.equal(zaehlen([[0, 'x', 'y'], [3, 'Aktivität', 'Aktivitäten']]), '3 Aktivitäten');
assert.equal(sauber('  kyoto   station '), 'Kyoto Station');
assert.equal(sauber('the db of dreams'), 'The db of Dreams', 'Kürzel und Bindewörter bleiben klein, der Rest in Großschreibung');

assert.equal(entfernungKm(erste, zweite), 0.8);
assert.ok(schaetzungKm(erste, zweite)! >= (entfernungKm(erste, zweite) ?? 0), 'geschätzter Weg ist nie kürzer als die Luftlinie');
assert.ok(schaetzungMinuten(1, 'zu fuss') >= 12 && schaetzungMinuten(1, 'zu fuss') <= 15);
assert.equal(MODI.length, 4);
assert.match(kartenLink(erste), /37\.3833/);
assert.match(kartenLink({ titel: 'Alcázar', ort: 'Sevilla' }), /query=Alc%C3%A1zar%2C%20Sevilla/);
assert.match(kartenVorschau(erste), /output=embed/);
assert.equal(kartenVorschau({ lat: 1, lng: 2, titel: 'x' }).includes('zoom=15'), true);

/* ── Kategorien ───────────────────────────────────────────────────────── */
assert.equal(kategorieVorschlag('Ramen Ichiran'), 'restaurant');
assert.equal(kategorieVorschlag('Kinkaku-ji Tempel'), 'sehenswuerdigkeit');
assert.equal(kategorieVorschlag('Strand von Naha'), 'strand');
assert.equal(kategorieVorschlag(''), 'sonstiges');
assert.equal(kategorie('unbekannt').id, 'sonstiges', 'unbekannte Kategorie fällt hörbar zurück');
assert.ok(ANDERE_KATEGORIEN.length >= 10);
assert.equal(artMeta('unterkunft').wort, 'Unterkunft');
const alleLabels = KATEGORIEN.map((k) => k.label);
const alleFarben = KATEGORIEN.map((k) => k.farbe);
assert.equal(new Set(alleLabels).size, alleLabels.length, 'kein Label doppelt');
assert.equal(new Set(alleFarben).size, alleFarben.length, 'jede Kategorie hat ihre eigene Farbe');
assert.ok(alleLabels.includes('Unterkunft'));
assert.equal(unterkuenfte(alle).length, 1);

console.log(`🎉 Rechenblatt passt – ${reiseTage(reise).length} Reisetage, 4 Betten-Regeln, ${ANDERE_KATEGORIEN.length} Kategorien`);
