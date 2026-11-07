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
global.fetch = async (url) =>
  String(url ?? '').includes('/api/bild')
    ? { ok: true, status: 200, json: async () => ({ url: 'https://beispiel.org/gefunden.jpg', nachweis: 'Foto: Mia Gurt / Wikimedia Commons' }) }
    : { ok: true, status: 204, json: async () => ({ speicher: 'aus', erreichbar: false }) };

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

  await act(async () => {
    wurzel.unmount();
  });
  console.log(`🎉 Speicherblatt hält – ${spur.render} Render, Listen bleiben dieselben, Schreiben wirkt genau einmal, Bilder bleiben Bilder`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exitCode = 1;
});
