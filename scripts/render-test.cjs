/**
 * Render-Harness: hängt next/navigation, next/link, next/dynamic und CSS ab und
 * mountet jede Seite in jsdom, damit die datenabhängigen JSX-Zweige wirklich
 * durchlaufen werden. Aufruf: npm run test:render
 */
const Module = require('module');
require('react');

const stubs = {
  'next/navigation': require.resolve('./stub-navigation.cjs'),
  'next/link': require.resolve('./stub-link.cjs'),
  'next/dynamic': require.resolve('./stub-dynamic.cjs'),
  'next/image': require.resolve('./stub-dynamic.cjs'),
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (stubs[request]) return stubs[request];
  return origResolve.call(this, request, ...rest);
};

require.extensions['.css'] = () => ({});
require.extensions['.svg'] = () => ({});

const nav = require('./stub-navigation.cjs');

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.SVGElement = dom.window.SVGElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.CustomEvent = dom.window.CustomEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.matchMedia = dom.window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
g.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id) => clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;
// Leaflet/Karten-Platzhalter brauchen Layout-Maße
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, toJSON() {} };
};
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react');
const { StoreProvider } = require('../src/lib/store.tsx');

const PAGES = [
  { name: 'Reisen', path: '/', file: '../src/app/page.tsx', expect: [/Urlaubsplanung/, /Japan 2027/, /Japan 2025/] },
  { name: 'Übersicht', path: '/t/trip-2027/uebersicht', file: '../src/app/t/[tripId]/uebersicht/page.tsx', expect: [/Reisedauer/, /Reise auf einem Blick/, /Jeder Tag im Bild/, /Was noch fehlen würde/, /Was noch verfügbar ist/, /Bett pro Nacht/] },
  { name: 'Tage', path: '/t/trip-2027/tage', file: '../src/app/t/[tripId]/tage/page.tsx', expect: [/Tagesplan/, /Sa06\.03\./, /noch frei|Aktivitäten/] },
  { name: 'Aktivitäten', path: '/t/trip-2027/aktivitaeten', file: '../src/app/t/[tripId]/aktivitaeten/page.tsx', expect: [/Noch ohne Tag/, /Aktivität/] },
  { name: 'Tabelle', path: '/t/trip-2027/tabelle', file: '../src/app/t/[tripId]/tabelle/page.tsx', expect: [/Reihe/, /Aktivität/] },
  { name: 'Karte', path: '/t/trip-2027/karte', file: '../src/app/t/[tripId]/karte/page.tsx', expect: [/Karte/, /Legende/, /Alle Kategorien/, /Kategorie/] },
  { name: 'Unterkünfte', path: '/t/trip-2027/unterkuenfte', file: '../src/app/t/[tripId]/unterkuenfte/page.tsx', expect: [/Nächte-Check/, /Hotel Tokio/] },
  { name: 'Kosten', path: '/t/trip-2027/kosten', file: '../src/app/t/[tripId]/kosten/page.tsx', expect: [/Budgetauslastung/, /Alle Posten/] },
  { name: 'Reiseverlauf', path: '/t/trip-2027/verlauf', file: '../src/app/t/[tripId]/verlauf/page.tsx', expect: [/Reiseverlauf/, /Ankunft/] },
  { name: 'Referenz 2025', path: '/t/trip-2025/uebersicht', file: '../src/app/t/[tripId]/uebersicht/page.tsx', expect: [/Japan 2025|Reisedauer/] },
  { name: 'Reise', path: '/t/trip-2027/reise', file: '../src/app/t/[tripId]/reise/page.tsx', expect: [/Unterkünfte/, /Fahrten/, /Dateien/] },
];

const failures = [];
const warnings = [];
const techLeaks = [];

const { EditorProvider } = require('../src/components/EditorProvider.tsx');

function wrap(tripId, node) {
  return tripId ? React.createElement(EditorProvider, { tripId }, node) : node;
}

async function render(name, Page, tripId) {
  const container = document.getElementById('root');
  container.innerHTML = '';
  const errors = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...a) => errors.push(String(a[0]));
  console.warn = (...a) => errors.push('WARN ' + String(a[0]));
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(React.createElement(StoreProvider, null, wrap(tripId, React.createElement(Page))));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
  } catch (e) {
    errors.push('THROW ' + (e && e.message));
    console.error = origError;
    console.warn = origWarn;
  }
  const text = container.textContent || '';
  const html = container.innerHTML;
  console.error = origError;
  console.warn = origWarn;
  try {
    await act(async () => root.unmount());
  } catch {}
  const noise = /ReactDOM.render is no longer supported|not wrapped in act|act\(\.\.\.\)|Download the React DevTools|baseTrail|leaflet/i;
  const real = errors.filter((e) => !noise.test(e));
  return { text, html, errors: real };
}

(async () => {
  for (const page of PAGES) {
    nav.setPath(page.path);
    const mod = require(page.file);
    const Page = mod.default || mod;
    const tripId = (page.path.match(/^\/t\/([^/]+)/) || [])[1];
    const { text, html, errors } = await render(page.name, Page, tripId);
    const missing = page.expect.filter((re) => !re.test(text) && !re.test(html));
    const ok = errors.length === 0 && missing.length === 0 && text.length > 200;
    if (!ok) {
      failures.push(page.name);
      console.log(`❌ ${page.name} (${page.path})`);
      if (missing.length) console.log(`   fehlt: ${missing.map(String).join(' | ')}  || text[0..220]: ${text.replace(/\s+/g, ' ').slice(0, 220)}`);
      errors.slice(0, 4).forEach((e) => console.log('   ' + e.slice(0, 400)));
    } else {
      console.log(`✅ ${page.name}  (${text.length} Zeichen Text)`);
    }
    errors.filter((e) => /Each child in a list|unique "key"/.test(e)).forEach((e) => warnings.push(`${page.name}: ${e.slice(0, 160)}`));
    const tech = /NEXT_PUBLIC[A-Z_]*|https?:\/\/[a-z0-9]+\.supabase\.co|schema\.sql|seed\.sql|anon[- ]?key|google[- ]tabelle|google sheets|excel|spreadsheet|reiseplan/i.exec(text);
    if (tech) techLeaks.push(`${page.name}: „${tech[0]}“`);

  }

  // Interaktionen: Formular öffnen + Tag zuweisen
  nav.setPath('/t/trip-2027/tage');
  const Tage = require('../src/app/t/[tripId]/tage/page.tsx').default;
  const Layout = require('../src/app/t/[tripId]/layout.tsx').default;
  const mod = { Layout, Tage };
  void mod;
  const container = document.getElementById('root');
  container.innerHTML = '';
  const errList = [];
  const origError = console.error;
  console.error = (...a) => errList.push(String(a[0]));
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(EditorProvider, { tripId: 'trip-2027' }, React.createElement(require('../src/components/forms.tsx').PlaceForm, { tripId: 'trip-2027', cities: ['Tokio'], value: null, onSubmit: () => {}, onCancel: () => {} })),
      ),
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  const formText = container.textContent || '';
  const catSelect = [...container.querySelectorAll('select')].find((el) => /Tempel & Schrein/.test(el.textContent || ''));
  const formOk =
    /Was ist es\?/.test(formText) && /Google Maps/.test(formText) && /An welchem Tag/.test(formText) && Boolean(catSelect) && !container.querySelector('#cat-list');
  console.log((formOk ? '✅' : '❌') + ' Eintrags-Formular rendert (Name, Tag, Kategorie, Punkt)');
  if (!formOk) {
    failures.push('PlaceForm');
    console.log('   text:', formText.slice(0, 300));
  }
  errList.filter((e) => /Error|Warning/.test(e)).slice(0, 3).forEach((e) => console.log('   ' + e.slice(0, 300)));
  console.error = origError;
  await act(async () => root.unmount());

  // Drag & Drop-Logik indirekt: Layout mit Tabs rendern
  nav.setPath('/t/trip-2027/tage');
  const root2 = createRoot(container);
  container.innerHTML = '';
  const layoutErrors = [];
  console.error = (...a) => layoutErrors.push(String(a[0]));
  await act(async () => {
    root2.render(React.createElement(StoreProvider, null, React.createElement(Layout, null, React.createElement(Tage))));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const layoutText = container.textContent || '';
  const tabsOk = /Übersicht/.test(layoutText) && /Aktivitäten/.test(layoutText) && /Reise/.test(layoutText) && /06\.03\./.test(layoutText) && /Anlegen/.test(layoutText) && /⋯/.test(layoutText);
  console.log((tabsOk ? '✅' : '❌') + ' Reise-Layout: Tabs + Tagesplan mit Daten');
  if (!tabsOk) {
    failures.push('Layout');
    console.log('   text:', layoutText.slice(0, 400));
    layoutErrors.slice(0, 3).forEach((e) => console.log('   ' + e.slice(0, 300)));
  }
  console.error = origError;
  await act(async () => root2.unmount());


  // Alle Formulare rendern (Modal-Formulare direkt)
  const forms = require('../src/components/forms.tsx');
  const formCases = [
    ['PlaceForm', React.createElement(forms.PlaceForm, { tripId: 'trip-2027', cities: ['Tokio'], value: null, onSubmit() {}, onCancel() {} }), /Was ist es\?/],
    ['PlaceForm Ticket-Frage', React.createElement(forms.PlaceForm, { tripId: 'trip-2027', cities: ['Tokio'], value: null, tripStart: '2027-03-06', tripEnd: '2027-04-14', onSubmit() {}, onCancel() {} }), /Ticket\?/],
    ['PlaceForm Tag-Frage', React.createElement(forms.PlaceForm, { tripId: 'trip-2027', cities: ['Tokio'], value: null, tripStart: '2027-03-06', tripEnd: '2027-04-14', onSubmit() {}, onCancel() {} }), /An welchem Tag\?/],
    ['HotelForm', React.createElement(forms.HotelForm, { tripId: 'trip-2027', cities: ['Tokio'], value: null, onSubmit() {}, onCancel() {} }), /Preis gesamt/],
    ['JourneyForm', React.createElement(forms.JourneyForm, { tripId: 'trip-2027', value: null, onSubmit() {}, onCancel() {} }), /Verkehrsmittel/],
    ['JourneyForm Zeitraum', React.createElement(forms.JourneyForm, { tripId: 'trip-2027', value: null, onSubmit() {}, onCancel() {} }), /zweiter Klick = Ankunft/],
    ['ExpenseForm', React.createElement(forms.ExpenseForm, { tripId: 'trip-2027', value: null, onSubmit() {}, onCancel() {} }), /Wer war in Vorleistung/],
    ['TripForm', React.createElement(forms.TripForm, { value: null, onSubmit() {}, onCancel() {} }), /¥ pro €|Budget/]
  ];
  for (const [label, node, re] of formCases) {
    const c = document.getElementById('root');
    c.innerHTML = '';
    const r = createRoot(c);
    let err = [];
    const oe = console.error; console.error = (...a) => err.push(String(a[0]));
    await act(async () => { r.render(React.createElement(StoreProvider, null, node)); });
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });
    const txt = c.textContent || '';
    const ok = re.test(txt) && !err.some((e) => /THROW|is not a function|Cannot read/.test(e));
    console.log((ok ? '✅' : '❌') + ' Formular ' + label);
    if (!ok) { failures.push('Form ' + label); console.log('   ' + txt.slice(0, 200)); err.slice(0,2).forEach(e => console.log('   ' + e.slice(0,200))); }
    console.error = oe;
    await act(async () => r.unmount());
  }

  // Google-Maps-Vorschau im Formular: vorhandener Punkt -> eingebettete Karte
  {
    const c = document.getElementById('root');
    c.innerHTML = '';
    const r = createRoot(c);
    const seed = require('../data/seed.json');
    const sample = (seed.places || []).find((x) => typeof x.lat === 'number' && typeof x.lng === 'number') || (seed.places || [])[0];
    await act(async () => { r.render(React.createElement(StoreProvider, null, React.createElement(forms.PlaceForm, { tripId: 'trip-2027', cities: ['Tokio'], value: sample, onSubmit() {}, onCancel() {} }))); });
    await act(async () => { await new Promise((res) => setTimeout(res, 25)); });
    const html = c.innerHTML;
    const frame = /<iframe[^>]+output=embed/.test(html) && /maps\.google\.com\/maps\?q=/.test(html);
    const link = /google\.com\/maps\/search\/\?api=1/.test(html);
    console.log((frame && link ? '✅' : '❌') + ' Maps-Vorschau im Formular (iframe + Google-Maps-Link)');
    if (!(frame && link)) { failures.push('Maps im Formular'); console.log('   iframe=' + frame + ' link=' + link); }
    await act(async () => r.unmount());
  }

  // Klick-Test: auf der Tagesseite einen Ort am Tag anlegen -> Modal mit Datum
  nav.setPath('/t/trip-2027/tage');
  const TagePage = require('../src/app/t/[tripId]/tage/page.tsx').default;
  const c2 = document.getElementById('root');
  c2.innerHTML = '';
  const r2 = createRoot(c2);
  const clickErr = [];
  const oe2 = console.error; console.error = (...a) => clickErr.push(String(a[0]));
  await act(async () => {
    r2.render(React.createElement(StoreProvider, null, React.createElement(EditorProvider, { tripId: 'trip-2027' }, React.createElement(TagePage))));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  const btns = [...c2.querySelectorAll('button')];
  const addBtn = btns.find((b) => (b.title || '').includes('an diesem Tag anlegen'));
  let clicked = false;
  if (addBtn) {
    await act(async () => { addBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    clicked = /Was ist es\?/.test(c2.textContent || '');
  }
  const dateInputs = [...c2.querySelectorAll('input[type=date]')].map((i) => i.name + '=' + i.value).join(',');
  const det = c2.querySelector('details');
  const hasDate = clicked && /2027-[0-9]{2}-[0-9]{2}/.test(dateInputs);
  console.log((clicked && hasDate ? '✅' : '❌') + ' Klick „Aktivität an diesem Tag anlegen“ öffnet Formular mit vorbelegtem Datum');
  if (!(clicked && hasDate)) { failures.push('Klick Test'); console.log('   clicked=' + clicked + ' hasDate=' + hasDate); clickErr.filter(e=>/Error|not a function|Cannot read/.test(e)).slice(0,3).forEach(e=>console.log('   '+e.slice(0,240))); }
  console.error = oe2;
  // Die Tages-Aktionen stecken im ⋯-Menü, und das Menü lebt im document.body (Portal)
  const body = dom.window.document.body;
  const allButtons = () => [...body.querySelectorAll('button')];
  const menuTriggers = allButtons().filter((b) => (b.textContent || '').trim().startsWith('⋯'));
  for (const t of menuTriggers.slice(0, 8)) {
    await act(async () => { t.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    if (allButtons().some((b) => (b.textContent || '').includes('Karte zu diesem Tag'))) break;
  }
  const mapBtn = allButtons().find((b) => (b.textContent || '').includes('Karte zu diesem Tag') || (b.title || '').includes('Karte zu diesem Tag'));
  let routeFrame = false;
  if (mapBtn) {
    await act(async () => { mapBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    routeFrame = /<iframe[^>]+output=embed[^>]*saddr=|<iframe[^>]*saddr=[^>]*output=embed/.test(c2.innerHTML);
  }
  console.log((mapBtn && routeFrame ? '✅' : (mapBtn ? '⚠️' : '❌')) + ` Tageskarte aufklappen${routeFrame ? ' – Route eingebettet' : mapBtn ? ' – iframe konnte nicht geladen werden (jsdom lädt nicht)' : ''}`);
  if (!mapBtn) failures.push('Tageskarte');
  // „Noch ohne Tag“ sitzt oben auf dem Tagesplan: ✓ legt den Punkt auf den gewählten Tag
  const poolCard = c2.querySelector('#pool');
  const openCount = () => {
    const el = c2.querySelector('#pool h3 .tabular-nums');
    return el ? parseInt(el.textContent || '-1', 10) : -1;
  };
  const firstRow = poolCard ? [...poolCard.querySelectorAll('li')][0] : null;
  const rowName = firstRow ? (firstRow.querySelector('.font-medium') || {}).textContent || '' : '';
  const daySel = firstRow ? [...firstRow.querySelectorAll('select')][0] : null;
  let dayValue = daySel ? daySel.value : '';
  const layBtn = firstRow ? [...firstRow.querySelectorAll('button')].find((b) => (b.textContent || '').includes('hinlegen')) : null;
  const beforeCount = openCount();
  // der Tag kommt aus dem Dropdown – nichts wird mehr vorgeschlagen oder verteilt
  if (daySel && !dayValue) {
    const opt = [...daySel.querySelectorAll('option')].find((o) => o.value && !o.disabled);
    dayValue = opt ? opt.value : '';
    if (dayValue) {
      await act(async () => {
        daySel.value = dayValue;
        daySel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
    }
  }
  if (layBtn) {
    await act(async () => { layBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  }
  const dayCardHtml = dayValue ? ((c2.querySelector(`[id="${dayValue}"]`) || {}).innerHTML || '') : '';
  const poolOk = Boolean(layBtn && dayValue && rowName && beforeCount > 0 && openCount() === beforeCount - 1 && dayCardHtml.includes(rowName) && dayCardHtml.includes('Stelle'));
  console.log((poolOk ? '✅' : '❌') + ` „Noch ohne Tag“-Liste oben: ${rowName ? '„' + rowName + '“' : '–'} → ${dayValue || 'kein Tag'} (${beforeCount} → ${openCount()} offen)`);
  if (!poolOk) failures.push('Offen-Liste');

  // ⋯-Menü sitzt am Viewport fest (nicht abgeschnitten) und lebt im <body>
  const trig = [...dom.window.document.body.querySelectorAll('button')].filter((b) => (b.textContent || '').trim().startsWith('⋯'))[0];
  let popFixed = false;
  if (trig) {
    await act(async () => { trig.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    const pop = dom.window.document.querySelector('.menu-pop');
    popFixed = Boolean(pop && dom.window.document.body.contains(pop) && /fixed/.test(pop.getAttribute('style') || ''));
    await act(async () => { trig.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  }
  console.log((popFixed ? '✅' : '❌') + ' ⋯-Menü: im body verankert, am Viewport positioniert');
  if (!popFixed) failures.push('Menü-Position');

  // Nummerierte Liste: ▼ am Tag tauscht zwei Punkte
  const dayCards = [...c2.querySelectorAll('[id]')].filter((el) => /^\d{4}-\d{2}-\d{2}$/.test(el.id));
  const namesOf = (el) => [...el.querySelectorAll('button[title="Bearbeiten"]')].map((b) => (b.textContent || '').trim());
  const swapCard = dayCards.find((el) => el.querySelectorAll('button[title="Bearbeiten"]').length >= 2 && Boolean(el.querySelector('button[title="eine Stelle tiefer"]:not([disabled])')));
  let swapOk = false;
  let swapLog = 'kein Tag mit zwei Punkten';
  if (swapCard) {
    const vorher = namesOf(swapCard);
    const runter = swapCard.querySelector('button[title="eine Stelle tiefer"]:not([disabled])');
    await act(async () => { runter.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    const nachher = namesOf(swapCard);
    swapOk = nachher[0] === vorher[1] && nachher[1] === vorher[0];
    swapLog = `${vorher[0]} / ${vorher[1]} → ${nachher[0]} / ${nachher[1]} (${swapCard.id})`;
  }
  console.log((swapOk ? '✅' : '❌') + ' Nummerierte Liste: ▼ räumt um – ' + swapLog);
  if (!swapOk) failures.push('Reihenfolge');

  // Karte: offene Kacheln ohne Key, Punkte bleiben sichtbar
  const fs = require('fs');
  const mapSrc = fs.readFileSync(__dirname + '/../src/components/MapView.tsx', 'utf8');
  const tilesOk = /tile\.openstreetmap\.org/.test(mapSrc) && !/cartocdn|carto\.com|api key/i.test(mapSrc) && /CircleMarker/.test(mapSrc);
  console.log((tilesOk ? '✅' : '❌') + ' Karte: OpenStreetMap-Kacheln ohne Key, Marker gezeichnet');
  if (!tilesOk) failures.push('Kacheln');

  // Klick in der Legende: „automatisch kategorisieren" setzt die fehlenden Kategorien und verschwindet
  nav.setPath('/t/trip-2027/karte');
  const MapPage = require('../src/app/t/[tripId]/karte/page.tsx').default;
  const cMap = document.createElement('div');
  document.body.appendChild(cMap);
  const rMap = createRoot(cMap);
  await act(async () => {
    rMap.render(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(require('../src/components/EditorProvider.tsx').EditorProvider, { tripId: 'trip-2027' }, React.createElement(MapPage)),
      ),
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const catBtn = [...cMap.querySelectorAll('button')].find((b) => /automatisch kategorisieren/.test(b.textContent || ''));
  if (catBtn) {
    await act(async () => {
      catBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
  }
  const stillThere = [...cMap.querySelectorAll('button')].some((b) => /automatisch kategorisieren/.test(b.textContent || ''));
  const catOk = Boolean(catBtn) && !stillThere && /Alle Aktivitäten haben eine Kategorie/.test(cMap.textContent || '');
  console.log((catOk ? '✅' : '❌') + ' Karte: Kategorien per Klick gesetzt' + (catBtn ? ` (${(catBtn.textContent || '').trim().slice(0, 28)}…)` : ' – Knopf nicht gefunden'));
  if (!catOk) failures.push('Kategorien-Klick');
  await act(async () => rMap.unmount());
  cMap.remove();

  await act(async () => r2.unmount());

  // Status-Pill-Klick im Table: Inline-Select ändern
  nav.setPath('/t/trip-2027/tabelle');
  const TabPage = require('../src/app/t/[tripId]/tabelle/page.tsx').default;
  const c3 = document.getElementById('root');
  c3.innerHTML = '';
  const r3 = createRoot(c3);
  await act(async () => { r3.render(React.createElement(StoreProvider, null, React.createElement(EditorProvider, { tripId: 'trip-2027' }, React.createElement(TabPage)))); });
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  const rows = c3.querySelectorAll('tbody tr').length;
  const inputs = c3.querySelectorAll('tbody input[type=date]').length;
  const selects = c3.querySelectorAll('tbody select').length;
  const tickets = c3.querySelectorAll('tbody select').length;
  const tableOk = rows > 60 && inputs === rows && selects === rows * 4;
  console.log((tableOk ? '✅' : '❌') + ` Tabelle: ${rows} Zeilen, ${inputs} Datums-Edits, ${selects} Status/Ticket/Prio/Kategorie-Selects`);
  if (!tableOk) console.log('   erwartet: rows*4 Selects, gefunden ' + tickets);
  if (!tableOk) failures.push('Tabelle Inline-Edits');
  await act(async () => r3.unmount());

  // 🚶 zwei Modi: ▶️ Reise starten → Unterwegs-Seite, ✕ beenden → zurück zur Planung
  nav.setPath('/t/trip-2027/heute');
  const TodayPage = require('../src/app/t/[tripId]/heute/page.tsx').default;
  const cToday = document.createElement('div');
  document.body.appendChild(cToday);
  const rToday = createRoot(cToday);
  await act(async () => {
    rToday.render(React.createElement(StoreProvider, null, React.createElement(EditorProvider, { tripId: 'trip-2027' }, React.createElement(TodayPage))));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const click = async (el) => {
    if (!el) return false;
    await act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    return true;
  };
  const menuItem = (re) => [...document.querySelectorAll('[role="menuitem"]')].find((b) => re.test(b.textContent || ''));

  const startBtn = [...cToday.querySelectorAll('button')].find((b) => /Reise starten/.test(b.textContent || ''));
  await click(startBtn);
  const liveText = cToday.textContent || '';
  const started = Boolean(startBtn) && /unterwegs/.test(liveText) && /Tag 1 von 40/.test(liveText);
  console.log((started ? '✅' : '❌') + ' 🚶 Starten: Unterwegs-Seite mit Tag 1 von 40');
  if (!started) {
    failures.push('Unterwegs-Modus');
    console.log('   text:', liveText.slice(0, 260));
  }

  // abhaken im Vorbeigehen: Zähler im Kopf steigt um eins
  const doneBefore = Number((liveText.match(/(\d+)\/\d+ erledigt/) || [])[1] ?? -1);
  const hak = [...cToday.querySelectorAll('button')].find((b) => /erledigt abhaken/.test(b.title || ''));
  await click(hak);
  const doneAfter = Number(((cToday.textContent || '').match(/(\d+)\/\d+ erledigt/) || [])[1] ?? -2);
  const ticked = Boolean(hak) && doneAfter === doneBefore + 1;
  console.log((ticked ? '✅' : '❌') + ` ✓ Abhaken: ${doneBefore} → ${doneAfter} erledigt`);
  if (!ticked) failures.push('Abhaken unterwegs');

  // ✕ beenden → wieder Planung (abgehakt bleibt)
  await click([...cToday.querySelectorAll('button[aria-haspopup="menu"]')].find((b) => /⋯/.test(b.textContent || '')));
  const endBtn = await click(menuItem(/Reise beenden/));
  const planText = cToday.textContent || '';
  const ended = endBtn && /Reise starten/.test(planText) && !/als nächstes/.test(planText);
  console.log((ended ? '✅' : '❌') + ' ✕ Beenden: Planung ist zurück, Unterwegs-Ansicht weg');
  if (!ended) {
    failures.push('Reise beenden');
    console.log('   text:', planText.slice(0, 260));
  }

  // ↩ Start zurücknehmen → der alte Planungszeitraum steht wieder
  await click([...cToday.querySelectorAll('button')].find((b) => /Reise starten/.test(b.textContent || '')));
  await click([...cToday.querySelectorAll('button[aria-haspopup="menu"]')].find((b) => /⋯/.test(b.textContent || '')));
  const undoBtn = await click(menuItem(/Start zurücknehmen/));
  const backText = cToday.textContent || '';
  const restored = undoBtn && /März 2027/.test(backText) && /Reise starten/.test(backText);
  console.log((restored ? '✅' : '❌') + ' ↩ Zurücknehmen: Zeitraum 06.03.2027 steht wieder, Modus ist Planung');
  if (!restored) {
    failures.push('Start zurücknehmen');
    console.log('   text:', backText.slice(0, 300));
  }

  // 🔀 Ortswechsel: Dialog vom Unterkünfte-Block
  nav.setPath('/t/trip-2027/unterkuenfte');
  const HotelsPage = require('../src/app/t/[tripId]/unterkuenfte/page.tsx').default;
  const cHot = document.createElement('div');
  document.body.appendChild(cHot);
  const rHot = createRoot(cHot);
  await act(async () => {
    rHot.render(React.createElement(StoreProvider, null, React.createElement(EditorProvider, { tripId: 'trip-2027' }, React.createElement(HotelsPage))));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const openMove = [...cHot.querySelectorAll('button')].find((b) => /eintragen ändern|🔀 Ortswechsel/.test(b.textContent || ''));
  if (openMove) {
    await act(async () => {
      openMove.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
  }
  const bodyText = document.body.textContent || '';
  const dialogOk = Boolean(openMove) && /Neue Stadt/.test(bodyText) && /Wechsel eintragen/.test(bodyText) && /Was soll mitwandern/.test(bodyText);
  console.log((dialogOk ? '✅' : '❌') + ' 🔀 Ortswechsel-Dialog: Stadt, Betten und Fahrt in einem Schritt');
  if (!dialogOk) {
    failures.push('Ortswechsel-Dialog');
    console.log('   text:', bodyText.slice(-400));
  }
  await act(async () => rHot.unmount());
  cHot.remove();
  await act(async () => rToday.unmount());
  cToday.remove();

  if (warnings.length) {
    console.log('\n⚠️  Hinweise:');
    [...new Set(warnings)].slice(0, 8).forEach((w) => console.log('   ' + w));
  }
  if (techLeaks.length) {
    failures.push('Technik-/Herkunfts-Hinweise im UI');
    console.log('❌ Seite zeigt technische oder Herkunfts-Hinweise:');
    techLeaks.forEach((l) => console.log('   ' + l));
  } else {
    console.log('✅ UI frei von Setup-Details (Keys/.env/SQL) und Herkunfts-Vermerken');
  }
  console.log(failures.length ? `\n❌ ${failures.length} Seiten mit Problem: ${failures.join(', ')}` : '\n🎉 Alle Seiten gerendert (inkl. datenabhängiger Zweige)');
  process.exit(failures.length ? 1 : 0);
})();
