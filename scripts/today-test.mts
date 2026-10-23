/**
 * Rechenprobe für „wo in der Reise stehen wir\" und „Reise auf ein anderes Datum schieben\",
 * dazu die Ortswechsel. Aufruf: npm run test:today
 */
import { dayContext, shiftTrip, upcoming } from '../src/lib/today.ts';
import { cityOfDay, locusChanges, applyMove, stayOn } from '../src/lib/locus.ts';
import { addDays } from '../src/lib/format.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};
const place = (over: Record<string, unknown> = {}) =>
  ({ id: 'p', trip_id: 't', name: 'Punkt', city: 'Osaka', date: '2027-03-08', end_date: null, sort_order: 0, booking_status: 'offen', priority: 'soll', ...over }) as any;
const hotel = (over: Record<string, unknown> = {}) => ({ id: 'h', trip_id: 't', name: 'Hotel', city: 'Osaka', check_in: '2027-03-06', check_out: '2027-03-13', nights: 7, booking_status: 'offen', ...over }) as any;

/** Fake-Store: notiert jeden patchMany/upsert, damit man nachprüfen kann */
function fakeStore() {
  const patches: { table: string; id: string; patch: any }[] = [];
  const rows: any[] = [];
  const notes: string[] = [];
  return {
    store: {
      patchMany: async (table: any, changes: any[]) => {
        for (const c of changes) patches.push({ table, id: c.id, patch: c.patch });
      },
      upsert: async (_table: any, row: any) => {
        rows.push(row);
      },
      say: (msg: string) => notes.push(msg),
    } as any,
    patches,
    rows,
    notes,
  };
}

// ── Wo in der Reise stehen wir? ──────────────────────────────────────────────
const trip = { id: 't', name: 'Japan', destination: 'JP', start_date: '2027-03-06', end_date: '2027-03-15', travelers: 2, budget_eur: null, jpy_rate: null, notes: null, archived: false } as any;
step('vor der Reise', dayContext(trip, '2027-03-01')!.state === 'vorher' && dayContext(trip, '2027-03-01')!.daysToStart === 5);
step('erster Tag = Tag 1', dayContext(trip, '2027-03-06')!.state === 'live' && dayContext(trip, '2027-03-06')!.dayIndex === 1);
step('dritter Tag = Tag 3 von 10', dayContext(trip, '2027-03-08')!.dayIndex === 3 && dayContext(trip, '2027-03-08')!.totalDays === 10);
step('nach der Reise', dayContext(trip, '2027-03-20')!.state === 'nachher');
step('ohne Zeitraum gibt es keinen Tag', dayContext({ ...trip, start_date: null }, '2027-03-08')!.state === 'vorher');
step('Ausblick nennt nur die Tage danach', upcoming([{ date: '2027-03-07' }, { date: '2027-03-08' }, { date: '2027-03-09' }, { date: '2027-03-10' }], '2027-03-08', 2).map((d) => d.date).join() === '2027-03-09,2027-03-10');

// ── Reise auf ein anderes Datum schieben ─────────────────────────────────────
{
  const { store, patches, notes } = fakeStore();
  const places = [place({ id: 'p1', date: '2027-03-08' }), place({ id: 'p2', date: null }), place({ id: 'p3', date: '2027-03-09', end_date: '2027-03-10' })];
  const hotels = [hotel({ id: 'h1', check_in: '2027-03-06', check_out: '2027-03-09' })];
  const journeys = [{ id: 'j1', trip_id: 't', date: '2027-03-06', title: 'Ankunft' }] as any[];
  const expenses = [{ id: 'e1', trip_id: 't', date: '2027-03-07', amount_eur: 12 }] as any[];
  const offset = shiftTrip(store, { trip, places, hotels, journeys, expenses, start: '2026-01-01' });
  step('Verschiebung rechnet den Abstand', offset === -429, offset);
  const byId = new Map(patches.map((x) => [x.id, x]));
  step('Punkt wandert mit', byId.get('p1')!.patch.date === '2026-01-03', byId.get('p1')!.patch);
  step('Punkt ohne Tag bleibt ohne Tag', !byId.has('p2'));
  step('Mehrtages-Zeitraum wandert komplett', byId.get('p3')!.patch.date === '2026-01-04' && byId.get('p3')!.patch.end_date === '2026-01-05');
  step('Unterkunft wandert mit', byId.get('h1')!.patch.check_in === '2026-01-01' && byId.get('h1')!.patch.check_out === '2026-01-04');
  step('Fahrt wandert mit', byId.get('j1')!.patch.date === '2026-01-01');
  step('Ausgabe wandert mit', byId.get('e1')!.patch.date === '2026-01-02', byId.get('e1'));
  step('Reise selbst bekommt das neue Ende', byId.get('t')!.patch.start_date === '2026-01-01' && byId.get('t')!.patch.end_date === '2026-01-10', byId.get('t')!.patch);
  step('Meldung nennt den neuen Start', /01\.01\.2026/.test(notes[0]), notes[0]);
  step('Meldung zählt grammatisch richtig', /2 Aktivitäten, 1 Unterkunft, 1 Fahrt und 1 Ausgabe sind mitgerutscht/.test(notes[0]), notes[0]);
}
{
  const { store, patches } = fakeStore();
  shiftTrip(store, { trip, places: [place()], hotels: [], journeys: [], start: '2027-03-06' });
  step('Start auf demselben Tag ändert nichts', patches.length === 0);
}

// ── Ortswechsel ─────────────────────────────────────────────────────────────
const osaka = hotel({ id: 'h-osaka', name: 'Hotel Nikko Osaka', city: 'Osaka', check_in: '2027-03-06', check_out: '2027-03-09', nights: 3 });
const tokyo = hotel({ id: 'h-tokyo', name: 'Hotel Rygg Tokio', city: 'Tokio', check_in: '2027-03-09', check_out: '2027-03-13', nights: 4 });
{
  step('Nacht 08.03. gehört noch zu Osaka', stayOn([osaka, tokyo], '2027-03-08')!.id === 'h-osaka');
  step('Nacht 09.03. gehört zu Tokio', stayOn([osaka, tokyo], '2027-03-09')!.id === 'h-tokyo');
  step('Stadt des Tages kommt aus der Unterkunft', cityOfDay([], [osaka, tokyo], '2027-03-07') === 'Osaka');
  step('ohne Unterkunft hilft die Planung', cityOfDay([place({ city: 'Kyoto', date: '2027-03-07' })], [], '2027-03-07') === 'Kyoto');
  const days = ['2027-03-06', '2027-03-07', '2027-03-08', '2027-03-09', '2027-03-10'];
  const changes = locusChanges([], [osaka, tokyo], days);
  step('ein Wechsel gefunden', changes.length === 1, changes.map((c) => `${c.date} ${c.from}→${c.to}`));
  step('Wechsel nennt beide Unterkünfte', changes[0]?.fromHotel === 'Hotel Nikko Osaka' && changes[0]?.toHotel === 'Hotel Rygg Tokio');
  step('Wechsel zählt Tage der alten Stadt', changes[0]?.daysInOld === 3, changes[0]?.daysInOld);
}
{
  const { store, patches, rows } = fakeStore();
  const places = [
    place({ id: 'a', city: 'Osaka', date: '2027-03-08' }),
    place({ id: 'b', city: 'Osaka', date: '2027-03-09' }),
    place({ id: 'c', city: 'Osaka', date: '2027-03-10' }),
    place({ id: 'd', city: 'Tokio', date: '2027-03-10' }),
  ];
  const out = applyMove(store, { trip, places, hotels: [osaka, { ...tokyo, check_in: null, check_out: null, nights: 2 }], journeys: [] }, {
    date: '2027-03-09',
    toCity: 'Tokio',
    hotelId: 'h-tokyo',
    scope: 'onwards',
    movePlaces: true,
    updateHotels: true,
    addJourney: true,
    mode: 'Shinkansen',
  } as any);
  const moved = patches
    .filter((x) => x.table === 'places')
    .map((x) => x.id)
    .sort();
  step('Tage ab dem Wechsel gehören zur neuen Stadt', moved.join() === 'b,c', moved);
  step('Punkt in der neuen Stadt bleibt unangetastet', !moved.includes('d'));
  const hOsaka = patches.find((x) => x.id === 'h-osaka')!.patch;
  const hTokyo = patches.find((x) => x.id === 'h-tokyo')!.patch;
  step('alte Unterkunft checkt am Wechseltag aus', hOsaka.check_out === '2027-03-09' && hOsaka.nights === 3, hOsaka);
  step('neue Unterkunft beginnt am Wechseltag', hTokyo.check_in === '2027-03-09' && hTokyo.check_out === addDays('2027-03-09', 2), hTokyo);
  step('Fahrt wird eingetragen', rows.length === 1 && rows[0].mode === 'Shinkansen' && rows[0].to_city === 'Tokio', rows[0]);
  step('Meldung zählt alles', /2 Aktivitäten in Tokio/.test(out.text) && /2 Unterkünfte/.test(out.text) && /Fahrt eingetragen/.test(out.text), out.text);
}
{
  const { store, patches } = fakeStore();
  const out = applyMove(store, { trip, places: [place({ city: 'Tokio', date: '2027-03-09' })], hotels: [tokyo], journeys: [] }, {
    date: '2027-03-09',
    toCity: 'Tokio',
    scope: 'day',
    movePlaces: true,
    updateHotels: false,
    addJourney: false,
  } as any);
  step('nichts zu ändern ist kein Fehler', patches.length === 0 && out.text === 'Es gab nichts zu ändern.');
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Reisetage und Ortswechsel passen\n');
if (errors.length) process.exit(1);
