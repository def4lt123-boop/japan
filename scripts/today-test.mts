/**
 * Rechenprobe für „wo in der Reise stehen wir\" und „Reise auf ein anderes Datum schieben\",
 * dazu die Ortswechsel, die nur aus den Betten gelesen werden. Aufruf: npm run test:today
 */
import { dayContext, shiftTrip, upcoming } from '../src/lib/today.ts';
import { cityOfDay, locusChanges, stayOn, trimPreviousStay } from '../src/lib/locus.ts';
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

// ── Ortswechsel: nur die Betten entscheiden ─────────────────────────────────
const osaka = hotel({ id: 'h-osaka', name: 'Hotel Nikko Osaka', city: 'Osaka', check_in: '2027-03-06', check_out: '2027-03-09', nights: 3 });
const tokyo = hotel({ id: 'h-tokyo', name: 'Hotel Rygg Tokio', city: 'Tokio', check_in: '2027-03-09', check_out: '2027-03-13', nights: 4 });
{
  step('Nacht 08.03. gehört noch zu Osaka', stayOn([osaka, tokyo], '2027-03-08')!.id === 'h-osaka');
  step('Nacht 09.03. gehört zu Tokio', stayOn([osaka, tokyo], '2027-03-09')!.id === 'h-tokyo');
  step('Stadt des Tages kommt aus dem Bett', cityOfDay([osaka, tokyo], '2027-03-07') === 'Osaka');
  step('ohne Bett gibt es keinen Ort', cityOfDay([], '2027-03-07') === null);
  step('Aktivitäten allein erfinden keinen Ort', cityOfDay([], '2027-03-07') === null && cityOfDay([osaka], '2027-03-07') === 'Osaka');
  const days = ['2027-03-06', '2027-03-07', '2027-03-08', '2027-03-09', '2027-03-10'];
  const changes = locusChanges([osaka, tokyo], days);
  step('ein Wechsel gefunden', changes.length === 1, changes.map((c) => `${c.date} ${c.from}→${c.to}`));
  step('Wechsel nennt beide Unterkünfte', changes[0]?.fromHotel === 'Hotel Nikko Osaka' && changes[0]?.toHotel === 'Hotel Rygg Tokio');
  step('Wechsel zählt Nächte der alten Stadt', changes[0]?.nightsInOld === 3, changes[0]?.nightsInOld);
  step('Wechsel fällt auf den Check-in-Tag', changes[0]?.date === '2027-03-09', changes[0]?.date);
  const planOnly = locusChanges([hotel({ check_in: null, check_out: null })], days);
  step('ein Punkt ohne Bett ist kein Umzug', locusChanges([], days).length === 0 && planOnly.length === 0);
  const journey = { id: 'j', trip_id: 't', title: 'Shinkansen', mode: 'Zug', date: '2027-03-09', to_city: 'Tokio' } as any;
  step('die Fahrt am Wechseltag wird angehängt', locusChanges([osaka, tokyo], days, [journey])[0]?.journey?.title === 'Shinkansen');
}
{
  /** neues Bett in anderer Stadt ⇒ das alte endet dort – der Umzug, ohne dass einer tippt */
  const lang = { ...osaka, check_out: '2027-03-13', nights: 7 }; // durchgebucht, dabei geht es früher weiter
  const trim = trimPreviousStay([lang, { ...tokyo, check_in: null, check_out: null, nights: 4 }], tokyo);
  step('altes Bett wird auf den neuen Check-in gekürzt', trim?.id === 'h-osaka' && trim?.patch.check_out === '2027-03-09', trim);
  step('Nächte des alten Bettes stimmen weiter', trim?.patch.nights === 3, trim?.patch);
  step('saubere Aneinanderreihung bleibt unangetastet', trimPreviousStay([osaka], tokyo) === null);
  const sameCity = hotel({ id: 'h-usj', name: 'Park Front at Universal Studios Japan', city: 'Osaka', check_in: '2027-03-07', check_out: '2027-03-08', nights: 1 });
  step('zwei Betten in derselben Stadt bleiben beide stehen', trimPreviousStay([osaka], sameCity) === null);
  step('ohne Stadt wird nichts gekürzt', trimPreviousStay([osaka], { ...tokyo, city: '' }) === null);
  step('danach ist der Umzug gelesen', (() => {
    const cut = { ...osaka, check_out: '2027-03-09', nights: 3 };
    return locusChanges([cut, tokyo], ['2027-03-08', '2027-03-09']).length === 1;
  })());
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Reisetage und Ortswechsel passen\n');
if (errors.length) process.exit(1);
