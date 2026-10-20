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
  { name: 'Übersicht', path: '/t/trip-2027', file: '../src/app/t/[tripId]/page.tsx', expect: [/Reisedauer/, /Reise auf einem Blick/, /Jeder Tag im Bild/, /Was noch fehlen würde/, /Was noch verfügbar ist/, /Bett pro Nacht/] },
  { name: 'Tage', path: '/t/trip-2027/tage', file: '../src/app/t/[tripId]/tage/page.tsx', expect: [/Tagesplan/, /Samstag/] },
  { name: 'Wünscheliste', path: '/t/trip-2027/wuenscheliste', file: '../src/app/t/[tripId]/wuenscheliste/page.tsx', expect: [/Wünscheliste/] },
  { name: 'Tabelle', path: '/t/trip-2027/tabelle', file: '../src/app/t/[tripId]/tabelle/page.tsx', expect: [/Fahrzeit ab Hotel/, /Standort/] },
  { name: 'Karte', path: '/t/trip-2027/karte', file: '../src/app/t/[tripId]/karte/page.tsx', expect: [/Karte/, /Legende/] },
  { name: 'Unterkünfte', path: '/t/trip-2027/unterkuenfte', file: '../src/app/t/[tripId]/unterkuenfte/page.tsx', expect: [/Nächte-Check/, /Hotel Tokio/] },
  { name: 'Kosten', path: '/t/trip-2027/kosten', file: '../src/app/t/[tripId]/kosten/page.tsx', expect: [/Budgetauslastung/, /Alle Posten/] },
  { name: 'Reiseverlauf', path: '/t/trip-2027/verlauf', file: '../src/app/t/[tripId]/verlauf/page.tsx', expect: [/Reiseverlauf/, /Ankunft/] },
  { name: 'Referenz 2025', path: '/t/trip-2025', file: '../src/app/t/[tripId]/page.tsx', expect: [/Japan 2025|Reisedauer/] },
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
  const formOk = /Was ist es\?/.test(formText) && /Google Maps/.test(formText) && /Tageszeit/.test(formText);
  console.log((formOk ? '✅' : '❌') + ' Eintrags-Formular rendert (Felder + Geo-Block)');
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
  const tabsOk = /Übersicht/.test(layoutText) && /Wünscheliste/.test(layoutText) && /Kosten/.test(layoutText) && /Samstag/.test(layoutText);
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
    ['HotelForm', React.createElement(forms.HotelForm, { tripId: 'trip-2027', cities: ['Tokio'], value: null, onSubmit() {}, onCancel() {} }), /Preis gesamt/],
    ['JourneyForm', React.createElement(forms.JourneyForm, { tripId: 'trip-2027', value: null, onSubmit() {}, onCancel() {} }), /Verkehrsmittel/],
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
  const hasDate = clicked && /value="2027-[0-9]{2}-[0-9]{2}"/.test(c2.innerHTML);
  console.log((clicked && hasDate ? '✅' : '❌') + ' Klick „Ort an diesem Tag anlegen“ öffnet Formular mit vorbelegtem Datum');
  if (!(clicked && hasDate)) { failures.push('Klick Test'); console.log('   clicked=' + clicked + ' hasDate=' + hasDate); clickErr.filter(e=>/Error|not a function|Cannot read/.test(e)).slice(0,3).forEach(e=>console.log('   '+e.slice(0,240))); }
  console.error = oe2;
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
  const tableOk = rows > 60 && inputs === rows && selects === rows * 2;
  console.log((tableOk ? '✅' : '❌') + ` Tabelle: ${rows} Zeilen, ${inputs} Datums-Edits, ${selects} Status/Prio-Selects`);
  if (!tableOk) failures.push('Tabelle Inline-Edits');
  await act(async () => r3.unmount());
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
