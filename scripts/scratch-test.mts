/**
 * Rechenprobe für die frische Reise: eine Reise ohne einen einzigen Eintrag anlegen,
 * dann wachsen lassen – Zeitraum, ein Punkt, ein Bett, ein Umzug. Genau dieser Weg zählt,
 * wenn eine neue Reise begonnen wird und noch nichts da ist. Aufruf: npm run test:scratch
 */
const { dayPlan, nightCoverage } = await import('../src/lib/stats.ts');
const { checkTrip } = await import('../src/lib/checks.ts');
const { assign, dayPlaces, moveToIndex, shiftWithin } = await import('../src/lib/dayplan.ts');
import type { Place } from '../src/lib/types';
const { addDays } = await import('../src/lib/format.ts');
const { cloneInto } = await import('../src/lib/seed.ts');

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

const empty = { trips: [], places: [], hotels: [], journeys: [], expenses: [] };
const tripRow = (start: string | null, end: string | null, over: Record<string, unknown> = {}) => ({
  id: 'neu',
  name: 'Herbst 2027',
  destination: 'Japan',
  start_date: start,
  end_date: end,
  travelers: 2,
  budget_eur: null,
  jpy_rate: null,
  notes: null,
  archived: false,
  started: false,
  started_at: null,
  planned_start: null,
  planned_end: null,
  ...over,
});
const hotel = (id: string, inDay: string | null, outDay: string | null, city: string, name?: string) => ({
  id,
  trip_id: 'neu',
  name: name ?? `Bett ${id}`,
  city,
  check_in: inDay,
  check_out: outDay,
  nights: null,
  price_total_eur: 90,
  price_per_night_eur: null,
  address: null,
  lat: null,
  lng: null,
  booking_url: null,
  booking_status: 'offen',
  notes: null,
});
const place = (id: string, name: string, date: string | null, over: Record<string, unknown> = {}) => ({
  id,
  trip_id: 'neu',
  name,
  city: 'Kyoto',
  date,
  end_date: null,
  notes: null,
  price_eur: null,
  booking_status: 'offen',
  ticket_status: 'unklar',
  priority: 'soll',
  lat: null,
  lng: null,
  sort_order: 0,
  ...over,
});

/* ── 1 · Reise ohne nichts ────────────────────────────────────────────────── */
{
  const bundle = { ...empty, trip: tripRow(null, null) } as never;
  const plan = dayPlan(bundle);
  const cov = nightCoverage(bundle);
  const fs = checkTrip(bundle, 'neu');
  step('ohne Zeitraum kein Tag, keine Nacht', plan.length === 0 && cov.length === 0, { plan: plan.length, cov: cov.length });
  step('der Prüfer bleibt höflich statt abzustürzen', fs.length === 1 && fs[0].id === 'kein-zeitraum', fs.map((f) => f.id));
  step('und zeigt den einen Weg', fs[0].actions[0].href === '/t/neu/reise', fs[0].actions);
  step('Prüfen erfindet keine Nächte', !fs.some((f) => /ohne Bett/.test(f.title)), fs.map((f) => f.title));
}

/* ── 2 · Zeitraum dazu – die Tage sind da ────────────────────────────────── */
const start = '2027-10-24';
const end = addDays(start, 4); // fünf Reisetage
{
  const bundle = { ...empty, trip: tripRow(start, end) } as never;
  const plan = dayPlan(bundle);
  step('fünf Reisetage, sechs Daten? nein: 5 Tage', plan.length === 5, plan.map((d) => d.date));
  step('jeder Tag beginnt leer', plan.every((d) => d.places.length === 0 && d.count === 0));
  step('Stichprobe: Tag 1 = Anreisetag', plan[0].date === '2027-10-24' && plan[4].date === '2027-10-28', plan.map((d) => d.date));
  const cov = nightCoverage(bundle);
  step('vier Nächte, alle ohne Bett', cov.length === 4 && cov.every((c) => !c.covered), cov.length);
  const fs = checkTrip(bundle, 'neu');
  step('Prüfer meldet das Loch statt Fehler', fs.some((f) => f.id === 'nächte-fehlen') && !fs.some((f) => f.id === 'kein-zeitraum'), fs.map((f) => f.id));
  step('… und zählt die Punkte, die noch keinen Tag haben', !fs.some((f) => f.id === 'pool'));
}

/* ── 3 · ein Punkt, ein Bett ──────────────────────────────────────────────── */
{
  const places = [place('p1', 'Fushimi Inari', start), place('p2', 'Nishiki Markt', null), place('p3', 'Arashiyama', '2027-10-26')];
  const hotels = [hotel('h1', start, end, 'Kyoto')];
  const bundle = { ...empty, trip: tripRow(start, end), places, hotels } as never;
  const plan = dayPlan(bundle);
  step('Punkte landen an ihrem Tag, der ohne Tag bleibt offen', plan[0].places.length === 1 && plan[2].places.length === 1 && places[1].date === null);
  const cov = nightCoverage(bundle);
  step('ein Bett deckt alle vier Nächte', cov.length === 4 && cov.every((c) => c.covered && c.hotelId === 'h1'), cov);
  step('das Bett kennt seine Spanne', cov.every((c) => c.stays === 4), cov[0]?.stays);
  const fs = checkTrip(bundle, 'neu');
  step('nachts ist alles gedeckt → kein Bett-Befund', !fs.some((f) => /bett|nacht/i.test(f.id)), fs.map((f) => f.id));
  step('offener Punkt wird als Hinweis gemeldet', fs.some((f) => f.id === 'pool'), fs.map((f) => f.id));

  // ans Ende des Tages legen, einfügen, umräumen – über denselben Weg, den die UI nimmt
  const rows = places as never as Place[];
  const notes: string[] = [];
  const find = (id: string) => rows.find((x) => x.id === id)!;
  const store = {
    patch: (_table: 'places', id: string, patch: Partial<Place>) => {
      const i = rows.findIndex((x) => x.id === id);
      if (i >= 0) rows[i] = { ...rows[i], ...patch };
    },
    patchMany: (_table: 'places', changes: { id: string; patch: Partial<Place> }[]) => {
      for (const c of changes) store.patch('places', c.id, c.patch);
    },
    say: (msg: string) => notes.push(msg),
  };
  const ok = assign(store, rows, find('p2'), { date: start });
  step('hinlegen setzt Tag und die nächste freie Stelle', ok && find('p2').date === start && find('p2').sort_order === 1, [find('p2').date, find('p2').sort_order]);
  step('die Meldung sagt, wo der Punkt jetzt steht', notes.some((n) => /Stelle 2 von 2/.test(n)), notes.slice(-1));
  moveToIndex(store, rows, 'p2', start, 0);
  step('einfügen vorn schiebt den Rest eine Reihe weiter', dayPlaces(rows, start).map((x) => x.id).join() === 'p2,p1', dayPlaces(rows, start).map((x) => x.id));
  shiftWithin(store, rows, find('p2'), 1);
  step('▲▼ räumen innerhalb des Tages um', dayPlaces(rows, start).map((x) => x.id).join() === 'p1,p2', dayPlaces(rows, start).map((x) => x.id));
  const dup = assign(store, rows, { id: 'p4', name: '  fushimi inari ' } as never, { date: start });
  step('derselbe Name am selben Tag wird abgewiesen, nicht gelegt', dup === false && find('p1').id === 'p1' && !rows.some((x) => x.id === 'p4'), notes.slice(-1));
  const back = assign(store, rows, find('p2'), { date: null });
  step('zurück in die Liste geht auch (Tag null)', back && find('p2').date === null);
}

/* ── 4 · Umzug mitten in der Reise ────────────────────────────────────────── */
{
  const hotels = [hotel('h1', start, '2027-10-26', 'Kyoto'), hotel('h2', '2027-10-26', end, 'Osaka')];
  const bundle = { ...empty, trip: tripRow(start, end), places: [place('p1', 'Burg', start)], hotels } as never;
  const cov = nightCoverage(bundle);
  step('Nacht vor dem Umzug gehört dem alten Bett', cov[0].hotelId === 'h1' && cov[1].hotelId === 'h1', cov.map((c) => c.hotelId));
  step('Nacht ab dem Umzug dem neuen', cov[2].hotelId === 'h2' && cov[3].hotelId === 'h2', cov.map((c) => c.hotelId));
  step('keine Lücke, kein Doppelbett', cov.every((c) => c.covered) && !checkTrip(bundle, 'neu').some((f) => f.id === 'doppeltes-bett'), checkTrip(bundle, 'neu').map((f) => f.id));
}

/* ── 5 · die typischen Anfängerfehler ─────────────────────────────────────── */
{
  // Bett billiger gekauft als die Reise lang
  const short = { ...empty, trip: tripRow(start, end), places: [], hotels: [hotel('h1', start, '2027-10-25', 'Kyoto')] } as never;
  const fs = checkTrip(short, 'neu');
  step('ein Nacht zu kurz → drei Nächte ohne Bett gemeldet', (fs.find((f) => f.id === 'nächte-fehlen') as { title: string }).title === '3 Nächte ohne Bett', fs.find((f) => f.id === 'nächte-fehlen')?.title);

  // zwei Unterkünfte, dieselbe Nacht
  const two = {
    ...empty,
    trip: tripRow(start, end),
    places: [],
    hotels: [hotel('h1', start, end, 'Kyoto', 'Basis'), hotel('h2', '2027-10-25', '2027-10-26', 'Kyoto', 'Eine Nacht außer Haus')],
  } as never;
  const covTwo = nightCoverage(two);
  step('bei zwei Betten gewinnt das engere', covTwo[1].hotelId === 'h2' && covTwo[0].hotelId === 'h1', covTwo.map((c) => c.hotelId));
  step('der Prüfer meldet die Nacht trotzdem', checkTrip(two, 'neu').some((f) => f.id === 'doppeltes-bett'));

  // ein Punkt eine Woche nach der Reise
  const stray = { ...empty, trip: tripRow(start, end), places: [place('p9', 'Zu spät', '2027-11-04')], hotels: [hotel('h1', start, end, 'Kyoto')] } as never;
  const fsStray = checkTrip(stray, 'neu');
  step('Ausreißer wird gefunden, Tagliste zieht ihn trotzdem ein', fsStray.some((f) => f.id === 'außerhalb-nach') && dayPlan(stray).some((d) => d.date === '2027-11-04'), fsStray.map((f) => f.id));
  const fix = fsStray.find((f) => f.id === 'außerhalb-nach')!.actions[0];
  step('Verlängern weißt das richtige Datum', fix.run?.[0].rows[0].patch.end_date === '2027-11-04', fix.run?.[0].rows[0].patch);
}

/* ── 6 · dieselbe Reise als Vorlage für die nächste ──────────────────────── */
{
  const src = tripRow(start, end);
  const snapshot = {
    trips: [src, { ...tripRow('2028-03-01', '2028-03-05'), id: 'naechste', name: 'Frühling 2028' }],
    places: [place('p1', 'Burg', start), place('p2', 'Markt', null)],
    hotels: [hotel('h1', start, end, 'Kyoto')],
    journeys: [],
    expenses: [],
  } as never;
  const next = cloneInto(snapshot, 'neu', 'naechste');
  const moved = next.places.filter((p) => p.trip_id === 'naechste');
  const hotels = next.hotels.filter((h) => h.trip_id === 'naechste');
  step('Kopie behält die Tage, nur der Zeitraum wandert', moved.find((p) => p.name === 'Burg')?.date === '2028-03-01', moved.map((p) => [p.name, p.date]));
  step('der offene Punkt bleibt offen', moved.find((p) => p.name === 'Markt')?.date === null);
  step('das Bett wandert mit (Umzüge bleiben erhalten)', hotels.length === 1 && hotels[0].check_in === '2028-03-01' && hotels[0].check_out === '2028-03-05', [hotels[0]?.check_in, hotels[0]?.check_out]);
  step('neue Reise startet ungeplant, nicht halb abgehakt', moved.every((p) => p.booking_status === 'offen'));
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Eine Reise bei null zu beginnen funktioniert – Tage, Betten, Prüfer und Kopie\n');
if (errors.length) process.exit(1);
