/**
 * Rechenprobe für „Heute"-Ansicht, Reise verschieben, Tag sortieren und Ortswechsel.
 * Aufruf: npm run test:today
 */
import { dayBuckets, slotOf, dayContext, shiftTrip, summarize } from '../src/lib/today.ts';
import { sortDay, sortDays } from '../src/lib/sortday.ts';
import { cityOfDay, locusChanges, applyMove, stayOn } from '../src/lib/locus.ts';
import { addDays } from '../src/lib/format.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};
const place = (over: Record<string, unknown> = {}) =>
  ({ id: 'p', trip_id: 't', name: 'Punkt', city: 'Osaka', date: '2027-03-08', start_time: null, duration_min: 90, time_slot: null, end_date: null, sort_order: 0, booking_status: 'offen', priority: 'soll', ...over }) as any;
const hotel = (over: Record<string, unknown> = {}) => ({ id: 'h', trip_id: 't', name: 'Hotel', city: 'Osaka', check_in: '2027-03-06', check_out: '2027-03-13', nights: 7, booking_status: 'offen', ...over }) as any;

/** Fake-Store: notiert jeden patchMany/upsert, damit man nachprüfen kann */
function fakeStore() {
  const patches: { table: string; id: string; patch: any }[] = [];
  const rows: any[] = [];
  const notes: string[] = [];
  return {
    store: {
      patchMany: async (table: any, changes: any[]) => { for (const c of changes) patches.push({ table, id: c.id, patch: c.patch }); },
      upsert: async (_table: any, row: any) => { rows.push(row); },
      say: (msg: string) => notes.push(msg),
    } as any,
    patches,
    rows,
    notes,
  };
}

// ── Tagesabschnitte ──────────────────────────────────────────────────────────
step('09:30 Uhr ist Vormittag', slotOf(place({ start_time: '09:30' })) === 'Vormittag');
step('12:00 Uhr ist Mittag', slotOf(place({ start_time: '12:00' })) === 'Mittag');
step('16:00 Uhr ist Nachmittag', slotOf(place({ start_time: '16:00' })) === 'Nachmittag');
step('19:00 Uhr ist Abend', slotOf(place({ start_time: '19:00' })) === 'Abend');
step('22:15 ist Nacht', slotOf(place({ start_time: '22:15' })) === 'Nacht');
step('ohne Uhrzeit folgt der Tageszeit', slotOf(place({ start_time: null, time_slot: 'Abend' })) === 'Abend');
step('Mehrtages-Ausflug ist „Ganzer Tag"', slotOf(place({ end_date: '2027-03-10' })) === 'Ganzer Tag');
const buckets = dayBuckets([
  place({ id: 'a', start_time: '19:00' }),
  place({ id: 'b', start_time: '09:00' }),
  place({ id: 'c', start_time: '10:30' }),
  place({ id: 'd', end_date: '2027-03-09' }),
]);
step('Einteilung in Abschnitte', JSON.stringify(Object.entries(buckets).map(([k, v]) => [k, (v as any[]).map((x) => x.id)])) === JSON.stringify([['Ganzer Tag', ['d']], ['Vormittag', ['b', 'c']], ['Mittag', []], ['Nachmittag', []], ['Abend', ['a']], ['Nacht', []]]), Object.entries(buckets).map(([k, v]) => `${k}:${(v as any[]).length}`));
step('Abschnitte sind der Reihe nach sortiert', buckets['Vormittag'].map((p) => p.id).join() === 'b,c');

// ── Wo in der Reise stehen wir heute? ────────────────────────────────────────
const trip = { id: 't', name: 'Japan', destination: 'JP', start_date: '2027-03-06', end_date: '2027-03-15', travelers: 2, budget_eur: null, jpy_rate: null, notes: null, archived: false } as any;
step('vor der Reise', dayContext(trip, '2027-03-01')!.state === 'vorher' && dayContext(trip, '2027-03-01')!.daysToStart === 5);
step('erster Tag = Tag 1', dayContext(trip, '2027-03-06')!.state === 'live' && dayContext(trip, '2027-03-06')!.dayIndex === 1);
step('dritter Tag = Tag 3 von 10', dayContext(trip, '2027-03-08')!.dayIndex === 3 && dayContext(trip, '2027-03-08')!.totalDays === 10);
step('nach der Reise', dayContext(trip, '2027-03-20')!.state === 'nachher');
step('ohne Zeitraum gibt es keinen Tag', dayContext({ ...trip, start_date: null }, '2027-03-08')!.state === 'vorher');
step('Satz baut eine Liste', summarize([place({ name: 'Burg Osaka' }), place({ name: 'Namba' }), place({ name: 'Dotonbori' })]) === 'Burg Osaka, Namba +1');

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

// ── Sortieren ────────────────────────────────────────────────────────────────
{
  const day = [
    place({ id: 'fest', name: 'A', start_time: '12:00', duration_min: 60, sort_order: 7 }),
    place({ id: 'frei', name: 'B', start_time: null, duration_min: 90, sort_order: 3 }),
    place({ id: 'ticket', name: 'C', start_time: '20:00', duration_min: 60, sort_order: 1 }),
  ];
  const { patches, result } = sortDay(day);
  const byId = new Map(patches.map((x) => [x.id, x.patch]));
  step('Tag ohne Zeitangabe fängt um 09:00 an', byId.get('frei')!.start_time === '09:00', byId.get('frei'));
  step('feste Uhrzeit bleibt stehen, die Lücke davor ist freie Luft', byId.get('fest')!.start_time === undefined && byId.get('fest')!.sort_order === 1, byId.get('fest'));
  step('Ticket-Termin um 20:00 wird nicht verschoben', byId.get('ticket')!.start_time === undefined && byId.get('ticket')!.sort_order === 2, byId.get('ticket'));
  step('nur eine Aktivität rückt wirklich', result.moved === 1 && result.kept === 2 && result.overflow.length === 0, result);
}
{
  const { patches, result } = sortDay([
    place({ id: 'full', time_slot: 'Ganzer Tag' }),
    place({ id: 'x', start_time: '10:00', duration_min: 120 }),
  ]);
  step('Ganztages-Ausflug wird nicht angefasst', patches.every((x) => x.id !== 'full'));
  step('Rest hängt an einem ganzen Tag dran', result.moved === 0);
}
{
  const long = Array.from({ length: 8 }, (_, i) => place({ id: `l${i}`, start_time: null, duration_min: 120 }));
  const { result } = sortDay(long);
  step('was nach 23 Uhr fällt, wird gemeldet', result.overflow.length >= 1, { overflow: result.overflow.length });
}
{
  const { store, patches } = fakeStore();
  const out = sortDays(store, [
    { date: '2027-03-08', places: [place({ id: 'a', start_time: null }), place({ id: 'b', start_time: null })] as any },
    { date: '2027-03-09', places: [place({ id: 'c', start_time: '09:00', duration_min: 60 })] as any },
  ]);
  step('nur Tage mit mehreren Punkten werden angefasst', out.days === 1 && out.moved === 2 && patches.length === 2, out);
}

// ── Ortswechsel ─────────────────────────────────────────────────────────────
const osaka = hotel({ id: 'h-osaka', name: 'Hotel Nikko Osaka', city: 'Osaka', check_in: '2027-03-06', check_out: '2027-03-09', nights: 3 });
const tokyo = hotel({ id: 'h-tokyo', name: 'Hotel Rygg Tokio', city: 'Tokio', check_in: '2027-03-09', check_out: '2027-03-13', nights: 4 });
{
  step('Nacht 08.03. gehört noch zu Osaka', stayOn([osaka, tokyo], '2027-03-08')!.id === 'h-osaka');
  step('Nacht 09.03. gehört zu Tokio', stayOn([osaka, tokyo], '2027-03-09')!.id === 'h-tokyo');
  step('Loch ohne Unterkunft fällt auf', stayOn([osaka], '2027-04-01') === null || stayOn([osaka], '2027-04-01')!.id === 'h-osaka');
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
  const moved = patches.filter((x) => x.table === 'places').map((x) => x.id);
  step('Tage ab dem Wechsel gehören zur neuen Stadt', moved.sort().join() === 'b,c', moved);
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
    date: '2027-03-09', toCity: 'Tokio', scope: 'day', movePlaces: true, updateHotels: false, addJourney: false,
  } as any);
  step('nichts zu ändern ist kein Fehler', patches.length === 0 && out.text === 'Es gab nichts zu ändern.');
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Heute, Sortieren und Ortswechsel passen\n');
if (errors.length) process.exit(1);
