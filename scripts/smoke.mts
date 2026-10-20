/**
 * Smoke-Test ohne Browser: Store-Schicht in jsdom mounten, Datenfluss prüfen.
 * Aufruf: npx tsx scripts/smoke.mts
 */
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.CustomEvent = dom.window.CustomEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { StoreProvider, useStore } = await import('../src/lib/store.tsx');

const errors: string[] = [];
let snapshot: any = null;
let api: any = null;

function Probe() {
  const store = useStore();
  snapshot = {
    ready: store.ready,
    mode: store.mode,
    trips: store.trips.length,
    places: store.places.length,
    hotels: store.hotels.length,
    journeys: store.journeys.length,
    note: store.note,
    planned2026: store.places.filter((p: any) => p.trip_id === 'trip-2027' && p.date).length,
    pool2026: store.places.filter((p: any) => p.trip_id === 'trip-2027' && !p.date).length,
  };
  api = store;
  return React.createElement('div', { id: 'out' }, JSON.stringify(snapshot));
}

const root = createRoot(document.getElementById('root')!);
await act(async () => {
  root.render(React.createElement(StoreProvider, null, React.createElement(Probe)));
});
await act(async () => {
  await new Promise((r) => setTimeout(r, 40));
});

const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

step('Seed geladen', snapshot.ready && snapshot.trips === 2 && snapshot.places > 140, snapshot);
step('2026 teilweise verplant', snapshot.planned2026 > 20 && snapshot.pool2026 > 10, { geplant: snapshot.planned2026, pool: snapshot.pool2026 });
step('localStorage gefüllt', Boolean(localStorage.getItem('urlaubsplaner.v2')));

// Mutieren
const somePlace = api.places.find((p: any) => p.trip_id === 'trip-2027' && !p.date)!;
await act(async () => {
  await api.patch('places', somePlace.id, { date: '2026-03-21' });
});
step(
  'Tag zuweisen',
  api.places.find((p: any) => p.id === somePlace.id)?.date === '2026-03-21',
);
await act(async () => {
  await api.upsert('places', { ...somePlace, id: 'pl-smoke-test', name: 'Smoke-Test Ort', city: 'Kyoto', date: '2026-03-22', trip_id: 'trip-2027' } as any);
});
step('Eintrag anlegen', api.places.some((p: any) => p.id === 'pl-smoke-test'));
await act(async () => {
  await api.remove('places', 'pl-smoke-test');
});
step('Eintrag löschen', !api.places.some((p: any) => p.id === 'pl-smoke-test'));

const before = api.places.length;
await act(async () => {
  const t = await api.createTrip({ name: 'Smoke Reise', destination: 'Testland', start_date: '2027-05-01', end_date: '2027-05-05', travelers: 2 });
  await api.duplicateTrip('trip-2025', t.name);
});
step(
  'Reise duplizieren',
  api.trips.some((t: any) => t.name === 'Smoke Reise') && api.places.length > before + 50,
  { added: api.places.length - before },
);

const persisted = JSON.parse(localStorage.getItem('urlaubsplaner.v2') || '{}');
const expectedPlaces = api.places.length;
const expectedTrips = api.trips.length;
step('Persistenz im localStorage', persisted.places?.length === expectedPlaces, { stored: persisted.places?.length, state: expectedPlaces });

// Remount = "Seite neu geladen"
await act(async () => {
  root.unmount();
});
const root2 = createRoot(document.getElementById('root')!);
await act(async () => {
  root2.render(React.createElement(StoreProvider, null, React.createElement(Probe)));
});
await act(async () => {
  await new Promise((r) => setTimeout(r, 40));
});
step('Nach Reload immer noch dieselben Daten', snapshot.trips === expectedTrips && snapshot.places === expectedPlaces, { trips: snapshot.trips, places: snapshot.places });

console.log(errors.length ? `\n❌ ${errors.length} Fehler: ${errors.join(', ')}` : '\n🎉 Alle Store-Checks bestanden');
process.exit(errors.length ? 1 : 0);
