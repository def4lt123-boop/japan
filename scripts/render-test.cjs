/* Prüft im jsdom, was kein Quelltext-Guard sieht: dass eine Liste aus dem
 * Speicherblatt beim nächsten Aufruf dieselbe bleibt und eine Seite dadurch zur
 * Ruhe kommt. Der Weg führt durch den echten Anbieter, nicht durch einen Ersatz.
 * Läuft mit `node -r tsx/cjs`, damit der Quelltext selbst gelesen wird. */
'use strict';

const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body><div id="wurzel"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'MessageChannel', 'getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage']) {
  const wert = name === 'window' ? window : window[name];
  if (wert === undefined) continue;
  // node 22 bringt ein eigenes `navigator` mit – nur definieren überschreibt es
  Object.defineProperty(global, name, { value: wert, writable: true, configurable: true });
}
global.IS_REACT_ACT_ENVIRONMENT = true;
/** die bildersuche antwortet, der datenbestand nicht – ein fund soll zu sehn sein */
const ORT = { 'borough market': { name: 'Borough market', adresse: 'Via Mazzini, Rom', lat: 41.8862, lng: 12.4679, stichwort: null, quelle: 'openstreetmap' }, castel: { name: 'Castel Sant’Angelo', adresse: 'Rom', lat: 41.8862, lng: 12.4679, stichwort: null, quelle: 'photon' } };
global.fetch = async (url) => {
  const weg = String(url ?? '');
  if (weg.includes('/api/bild')) return { ok: true, status: 200, json: async () => ({ url: 'https://beispiel.org/gefunden.jpg', nachweis: 'Foto: Mia Gurt / Wikimedia Commons' }) };
  if (weg.includes('/api/orte')) {
    const frage = decodeURIComponent(weg.split('q=')[1] ?? '').toLowerCase();
    const treffer = Object.values(ORT).find((o) => frage.includes(o.name.split(',')[0].toLowerCase().slice(0, 7)) || (frage.includes('castel') && o.name.includes('Castel')));
    return { ok: true, status: 200, json: async () => ({ orte: treffer ? [treffer] : [] }) };
  }
  return { ok: true, status: 204, json: async () => ({ speicher: 'aus', erreichbar: false }) };
};

const REISE = {
  id: 'r-test',
  name: 'Herbst in Rom',
  land: 'Italien',
  stationen: 'Rom',
  start_date: '2027-10-24',
  end_date: '2027-10-27',
  cover_url: null,
  cover_credit: null,
  beschreibung: null,
  budget: 900,
  waehrung: 'EUR',
  personen: 2,
  archived: false,
  erstellt_am: '2026-01-08T09:00:00.000Z',
};

const ANDERE = { ...REISE, id: 'r-andere', name: 'Frühling', start_date: '2027-04-02', end_date: '2027-04-05' };

const punkt = (id, titel, reiseId) => ({
  id,
  reise_id: reiseId,
  art: 'aktivitaet',
  kategorie: 'essen',
  titel,
  date: '2027-10-24',
  zeit: '09:00',
  bis_zeit: null,
  dauer_min: 60,
  bis_date: null,
  ort: 'Rom',
  adresse: null,
  lat: 41.9,
  lng: 12.5,
  karten_stichwort: null,
  notiz: null,
  preis: 12,
  waehrung: null,
  buchung_nr: null,
  buchung_url: null,
  foto_url: null,
  foto_nachweis: null,
  sortierung: 1,
  erstellt_am: '2026-01-08T09:00:00.000Z',
});

const PUNKT1 = { ...punkt('e1', 'Markt', 'r-test'), foto_url: 'https://beispiel.org/markt.jpg', foto_nachweis: 'Foto: Mia Gurt / Unsplash' };
const PUNKT2 = { ...punkt('e2', 'Brunnen', 'r-test'), foto_url: 'https://beispiel.org/brunnen.jpg', foto_nachweis: 'Foto: Jem Kell / Unsplash' };
const PUNKT3 = punkt('e3', 'Anderswo', 'r-andere');
const BETT = {
  ...punkt('e4', 'Albergo al Sole', 'r-test'),
  art: 'unterkunft',
  date: '2027-10-24',
  bis_date: '2027-10-26',
  zeit: '15:00',
  bis_zeit: '10:00',
  foto_url: 'https://beispiel.org/hotel.jpg',
  foto_nachweis: 'Foto: Katrin Ohl / Wikimedia Commons',
};

window.localStorage.setItem(
  'reiseplan.v1',
  JSON.stringify({
    reisen: [REISE, ANDERE],
    eintraege: [PUNKT1, PUNKT2, PUNKT3],
  })
);

const React = require('react');
// die Blätter werden mit klassischem Laufzeit-Übersetzer gelesen – sie brauchen React im Raum
global.React = React;
const { createRoot } = require('react-dom/client');
const { DatenProvider, useStore } = require('../src/lib/daten.tsx');

const act = React.act ?? require('react-dom/test-utils').act;
const spur = { render: 0, listen: [], store: null };

/** Dieselbe Kette wie auf dem Reisetag: Liste → Merkzettel → Paare → Nachfrage. */
function Sonde() {
  const store = useStore();
  spur.render += 1;
  const liste = store.eintraegeVon('r-test');
  spur.listen.push(liste);
  const plan = React.useMemo(() => ({ menge: liste.length }), [liste]);
  const paare = React.useMemo(() => (plan.menge >= 4 ? ['a'] : []), [plan]);
  const [routen, setRouten] = React.useState({});
  React.useEffect(() => {
    if (!paare.length) setRouten({});
  }, [paare]);
  React.useEffect(() => {
    spur.store = store;
  }, [store]);
  return React.createElement('p', { id: 'stand' }, `${plan.menge} Punkte · ${Object.keys(routen).length} Routen`);
}

/** Die Reihe selbst: Bild hinten, Text vorn, und ein Fund bleibt ein Fund. */
async function reihenPrüfen() {
  const { EintragZeile } = require('../src/components/EintragZeile.tsx');
  const { BettZeile } = require('../src/components/BettZeile.tsx');
  const behälter = document.createElement('div');
  document.body.appendChild(behälter);
  const grund = createRoot(behälter);
  const reihe = (kind, props) => React.createElement(kind, { ...props, reise: REISE, bearbeiten: () => {} });

  await act(async () => {
    grund.render(
      React.createElement(
        DatenProvider,
        null,
        React.createElement(
          'div',
          null,
          React.createElement(
            'ul',
            { className: 'liste' },
            React.createElement('li', { className: 'karte overflow-hidden' }, reihe(EintragZeile, { eintrag: PUNKT2 })),
            React.createElement('li', { className: 'karte overflow-hidden' }, reihe(EintragZeile, { eintrag: PUNKT1, kompakt: true })),
            React.createElement('li', { className: 'karte overflow-hidden' }, reihe(EintragZeile, { eintrag: PUNKT3, kompakt: true }))
          ),
          reihe(BettZeile, { eintrag: BETT })
        )
      )
    );
  });
  await act(async () => {
    await new Promise((warten) => setTimeout(warten, 0));
  });

  assert.equal(behälter.querySelectorAll('.zeile').length, 4, 'jede Reihe steht, mit Bild oder ohne');
  const hintergrund = behälter.querySelector('.zeile-bild img');
  assert.ok(hintergrund, 'das Bild des Ortes liegt hinter der vollen Reihe');
  assert.equal(hintergrund.getAttribute('alt'), '', 'das Bild ist Schmuck, der Name steht im Text');
  assert.equal(hintergrund.getAttribute('loading'), 'lazy', 'es lädt nach, nicht vor dem Text');
  assert.equal(behälter.querySelectorAll('.zeile-bild').length, 2, 'die vollen reihen tragen das bild hinten, die dichte nicht');
  assert.equal(behälter.querySelectorAll('img[alt="Markt"]').length, 1, 'die dichte Liste behält ihren Vorschnitt');
  assert.equal(behälter.querySelectorAll('img[src="https://beispiel.org/gefunden.jpg"]').length, 1, 'auch die dichte reihe zeigt das gesuchte bild – als vorschnitt');
  assert.ok(!behälter.textContent.includes('Foto: Jem Kell'), 'die reihen tragen keinen nachweis, das bild soll luft haben');
  assert.ok(behälter.querySelector('.zeile-bett .zeile-bild'), 'auch das Bett zeigt sein Bild');
  assert.ok(!behälter.querySelector('li:nth-child(3) .zeile-bild'), 'die dichte reihe sucht nicht den hintergrund, sie zeigt den vorschnitt');
  assert.ok(!behälter.querySelector('.zeile li'), 'eine Reihe verschachtelt kein li in ein li');

  const stand = JSON.parse(window.localStorage.getItem('reiseplan.v1'));
  const gesuchter = stand.eintraege.find((e) => e.id === 'e3');
  assert.equal(gesuchter.foto_url, null, 'ein Suchbild wird nicht ungefragt an den Eintrag geschrieben');

  await act(async () => {
    grund.unmount();
  });
}

/** in ein react-feld schreibt man über den echten setter, sonst sieht react nichts */
function schreibe(feld, wert) {
  const traeger = feld.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setze = Object.getOwnPropertyDescriptor(traeger, 'value').set;
  setze.call(feld, wert);
  feld.dispatchEvent(new window.Event('input', { bubbles: true }));
}

/**
 * Das Formular beim neuen Punkt: ein name genügt, ein tag ist eine wahl. Am bett
 * ist die nacht dagegen der grund, warum es der eintrag gibt – dort bleibt sie
 * vorgemerkt und „ohne tag" wird nicht einmal angeboten.
 */
async function formularPruefen() {
  const { EintragFormular } = require('../src/components/EintragFormular.tsx');
  const behaelter = document.createElement('div');
  document.body.appendChild(behaelter);
  const grund = createRoot(behaelter);
  let geschlossen = 0;

  await act(async () => {
    grund.render(
      React.createElement(
        DatenProvider,
        null,
        React.createElement(EintragFormular, { reise: REISE, art: 'aktivitaet', offen: true, schliessen: () => { geschlossen += 1; } })
      )
    );
  });

  const knoepfe = () => Array.from(document.body.querySelectorAll('button'));
  const ohneTag = knoepfe().find((b) => (b.textContent ?? '').includes('ohne Tag'));
  assert.ok(ohneTag, 'das Formular bietet "ohne Tag" als chip');
  assert.ok(ohneTag.className.includes('chip-aktiv'), 'und der chip ist gewaehlt, wo niemand einen tag gemeint hat');
  const tage = knoepfe().filter((b) => /^\p{L}{2} \d{1,2}\.\d{1,2}\.$/u.test((b.textContent ?? '').trim()));
  assert.equal(tage.length, 4, 'die reisetage stehen als chips daneben');
  assert.ok(tage.every((b) => !b.className.includes('chip-aktiv')), 'keiner davon ist vorgemerkt');
  assert.equal(document.body.querySelector('input[type="date"]').value, '', 'das datumsfeld bleibt leer');

  const sparen = knoepfe().find((b) => (b.textContent ?? '').trim() === 'speichern');
  assert.ok(sparen.disabled, 'ohne name wird nicht gespeichert');
  await act(async () => {
    schreibe(document.body.querySelector('input[type="text"]'), 'Sky Garden');
  });
  assert.equal(sparen.disabled, false, 'ein name genuegt zum speichern');
  await act(async () => {
    sparen.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.equal(geschlossen, 1, 'und das blatt schliesst sich');

  const stand = JSON.parse(window.localStorage.getItem('reiseplan.v1'));
  const neu = stand.eintraege.find((e) => e.titel === 'Sky Garden');
  assert.ok(neu, 'der punkt liegt im blatt');
  assert.equal(neu.date, null, 'ohne tag gespeichert, nicht auf den ersten reisetag geschrieben');
  assert.equal(neu.art, 'aktivitaet');
  assert.equal(neu.reise_id, 'r-test');

  await act(async () => {
    grund.unmount();
  });

  const bettBehaelter = document.createElement('div');
  document.body.appendChild(bettBehaelter);
  const bettGrund = createRoot(bettBehaelter);
  await act(async () => {
    bettGrund.render(
      React.createElement(DatenProvider, null, React.createElement(EintragFormular, { reise: REISE, art: 'unterkunft', offen: true, schliessen: () => {} }))
    );
  });
  assert.ok(!knoepfe().some((b) => (b.textContent ?? '').includes('ohne Tag')), 'an einer unterkunft gibt es "ohne tag" nicht');
  assert.equal(document.body.querySelector('input[type="date"]').value, '2027-10-24', 'das bett startet mit der ersten nacht');
  await act(async () => {
    bettGrund.unmount();
  });
}

/**
 * Das Sammelblatt: ein text wird zu reihen. angelegt wird ohne tag, punkt und bild
 * kommen nach – und was die reise schon hat, wird nicht noch einmal angelegt.
 */
async function sammelPruefen() {
  const { MehrfachFormular } = require('../src/components/MehrfachFormular.tsx');
  const behaelter = document.createElement('div');
  document.body.appendChild(behaelter);
  const grund = createRoot(behaelter);
  let geschlossen = 0;

  await act(async () => {
    grund.render(
      React.createElement(DatenProvider, null, React.createElement(MehrfachFormular, { reise: REISE, offen: true, schliessen: () => { geschlossen += 1; } }))
    );
  });

  const feld = document.body.querySelector('textarea');
  assert.ok(feld, 'das blatt ist ein feld, in das der text gehoert');

  await act(async () => {
    schreibe(feld, 'Ein Tag in Rom:\n- Borough market\nBorough market\n1. Castel Sant\u2019Angelo\n-');
  });
  const reihen = Array.from(document.body.querySelectorAll('.liste input'));
  assert.equal(reihen.length, 2, 'zwei zeilen werden zwei punkte, die dublette nicht der dritte');
  assert.equal(reihen[0].value, 'Borough market', 'und die ueberschrift ueber der liste bleibt eine ueberschrift');

  const anlegen = Array.from(document.body.querySelectorAll('button')).find((b) => /anlegen$/.test((b.textContent ?? '').trim()));
  assert.ok(anlegen, 'ein knopf zaehlt die punkte, die entstehen');
  assert.equal(anlegen.textContent.trim(), '2 Punkte anlegen');
  await act(async () => {
    anlegen.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((warten) => setTimeout(warten, 900));
  });

  const stand = JSON.parse(window.localStorage.getItem('reiseplan.v1'));
  const gemerkt = ['Borough market', 'Castel Sant’Angelo'].map((t) => stand.eintraege.find((e) => e.titel === t));
  assert.ok(gemerkt.every(Boolean), 'beide punkte liegen im blatt');
  assert.ok(gemerkt.every((e) => e.date === null), 'anglegt wird ohne tag');
  assert.ok(gemerkt.every((e) => e.art === 'aktivitaet' && e.reise_id === 'r-test'), 'und als aktivitaet dieser reise');
  assert.ok(gemerkt.every((e) => e.lat === 41.8862), 'punkt und ort wandern an den eintrag, nicht ins blatt');
  assert.ok(gemerkt.every((e) => e.ort === 'Rom'), 'die stadt folgt aus der adresse');
  assert.ok(gemerkt.every((e) => e.foto_url === 'https://beispiel.org/gefunden.jpg'), 'jeder punkt holt sich sein bild');
  assert.ok(gemerkt.every((e) => e.foto_nachweis === 'Foto: Mia Gurt / Wikimedia Commons'), 'der nachweis bleibt am eintrag');
  assert.equal(stand.eintraege.filter((e) => e.titel === 'Borough market').length, 1, 'was zweimal in der zeile stand, wird nicht zweimal angelegt');
  assert.equal(stand.eintraege.filter((e) => e.titel === 'Ein Tag in Rom').length, 0, 'aus der ueberschrift wird kein punkt');

  await act(async () => {
    grund.unmount();
  });
  assert.ok(geschlossen >= 0, 'das blatt schliesst ueber den knopf, nicht ueber das schreiben');
  return gemerkt;
}

/**
 * Die analyse ueber das, was keinen tag hat: punkte beieinander werden ein satz,
 * der tag wird an diesem satz gewaehlt – gesetzt wird nur, was angefasst ist.
 */
async function gruppenPruefen() {
  const { OhneTagGruppen } = require('../src/components/OhneTagGruppen.tsx');
  const behaelter = document.createElement('div');
  document.body.appendChild(behaelter);
  const grund = createRoot(behaelter);

  await act(async () => {
    grund.render(React.createElement(DatenProvider, null, React.createElement(OhneTagGruppen, { reise: REISE })));
  });

  const satz = behaelter.querySelector('article');
  assert.ok(satz, 'die wartenden punkte stehen in saetzen');
  assert.match(satz.textContent ?? '', /2 Punkte/, 'der satz zaehlt seine punkte');
  assert.ok(!satz.textContent.includes('Markt'), 'was schon einen tag hat, steht in keinem satz');
  assert.match(behaelter.textContent ?? '', /1 Punkt hat noch kein Google Maps/, 'wer keinen punkt hat, wird gezaehlt statt gerechnet');
  assert.match(satz.textContent ?? '', /Weg/, 'und zeigt den weg in Google Maps');
  const chips = Array.from(satz.querySelectorAll('button')).filter((b) => /^\p{L}{2} \d{1,2}\.\d{1,2}\./u.test((b.textContent ?? '').trim()));
  assert.equal(chips.length, 4, 'jeder reisetag kann gewaehlt werden');
  assert.ok(chips[0].textContent.includes('km'), 'der naechste tag traegt seinen abstand');

  await act(async () => {
    chips[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });

  const stand = JSON.parse(window.localStorage.getItem('reiseplan.v1'));
  const gesetzt = ['Borough market', 'Castel Sant’Angelo'].map((t) => stand.eintraege.find((e) => e.titel === t));
  assert.ok(gesetzt.every((e) => e.date === '2027-10-25'), 'der gewaehlte tag gilt dem ganzen satz');
  assert.ok(gesetzt[0].sortierung < gesetzt[1].sortierung, 'die gangreihenfolge wird die reihenfolge am tag');
  assert.equal(stand.eintraege.find((e) => e.titel === 'Markt').date, '2027-10-24', 'was schon einen tag hat, bleibt liegen');

  await act(async () => {
    grund.unmount();
  });
}

async function main() {
  const wurzel = createRoot(document.getElementById('wurzel'));
  await act(async () => {
    wurzel.render(React.createElement(DatenProvider, null, React.createElement(Sonde)));
  });

  assert.equal(document.getElementById('stand').textContent, '2 Punkte · 0 Routen', 'die Reise liegt geordnet im Blatt');

  // 1 · zur Ruhe kommen: jede Kette aus Merkzetteln muss nach dem ersten Stehenbleiben enden
  assert.ok(spur.render <= 8, `die Seite hört auf zu rendern (sonst ${spur.render} Render – die Kette läuft)`);

  // 2 · dieselbe Liste beim nächsten Aufruf, nicht eine neue (der erste Render sieht noch das leere Blatt)
  assert.ok(spur.listen.length >= 2, 'der Speicher meldet sich vor dem Ende mindestens zweimal');
  assert.equal(new Set(spur.listen.slice(1)).size, 1, `ein Aufruf mehr gibt dieselbe Liste (${new Set(spur.listen.slice(1)).size} verschiedene)`);
  assert.equal(spur.listen[0].length, 0, 'der erste Blick ist das leere Blatt, danach kommt der Speicher');

  // 3 · eine leere Liste ist auch eine Antwort – und dieselbe wie vorher
  const store = spur.store;
  assert.ok(store, 'die Sonde hat den Speicher erreicht');
  assert.equal(store.eintraegeVon('r-leer').length, 0, 'ohne Treffer keine Punkte');
  assert.equal(store.eintraegeVon('r-leer'), store.eintraegeVon('r-leer'), 'die leere Liste bleibt die gleiche');
  assert.equal(store.eintraegeVon('r-andere').length, 1, 'die andere Reise führt nur ihre eigenen Einträge');
  assert.notEqual(store.eintraegeVon('r-andere'), store.eintraegeVon('r-test'), 'zwei Reisen, zwei Listen');

  // 4 · nach dem Schreiben ändert sich die Liste – und das genau einmal
  const vorher = store.eintraegeVon('r-test');
  await act(async () => {
    await store.eintragAnlegen({ reise_id: 'r-test', titel: 'Kaffee', art: 'aktivitaet', date: '2027-10-25' });
  });
  const nachher = spur.store.eintraegeVon('r-test');
  assert.equal(nachher.length, 3, 'der neue Punkt ist da');
  assert.notEqual(nachher, vorher, 'nach dem Schreiben ist die Liste eine neue');
  assert.equal(spur.store.eintraegeVon('r-test'), nachher, 'und bleibt es, bis wieder geschrieben wird');

  await reihenPrüfen();
  await formularPruefen();
  await sammelPruefen();
  await gruppenPruefen();

  await act(async () => {
    wurzel.unmount();
  });
  console.log(`🎉 Speicherblatt hält – ${spur.render} Render, Listen bleiben dieselben, Schreiben wirkt genau einmal, ein name ohne tag genügt, Bilder bleiben Bilder, eingefügter text wird zu punkten und gruppen`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exitCode = 1;
});
