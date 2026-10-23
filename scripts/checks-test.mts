/**
 * Rechenprobe für „Reise prüfen“ – findet der Rundgang wirklich, was in den Daten steckt,
 * und schreiben seine Knöpfe nur das, was sie ankündigen? Aufruf: npm run test:checks
 */
const { checkTrip, findingCount } = await import('../src/lib/checks.ts');
const { addDays } = await import('../src/lib/format.ts');

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

type Row = Record<string, unknown>;
const tripOf = (start: string | null, end: string | null): Row => ({
  id: 't',
  name: 'Frühling',
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
});
const hotel = (id: string, inDay: string | null, outDay: string | null, city = 'Osaka'): Row => ({
  id,
  trip_id: 't',
  name: `hotel ${id}`,
  city,
  check_in: inDay,
  check_out: outDay,
  nights: null,
  price_total_eur: 100,
  price_per_night_eur: null,
  address: null,
  lat: null,
  lng: null,
  booking_url: null,
  booking_status: 'gebucht',
  notes: null,
});
const place = (id: string, name: string, date: string | null, city = 'Osaka'): Row => ({
  id,
  trip_id: 't',
  name,
  city,
  date,
  end_date: null,
  notes: null,
  price_eur: null,
  booking_status: 'offen',
  ticket_status: 'unklar',
  priority: 'soll',
  lat: 34.6,
  lng: 135.5,
  sort_order: 1,
});
const journey = (id: string, title: string, date: string | null): Row => ({
  id,
  trip_id: 't',
  title,
  date,
  end_date: null,
  from_city: 'Osaka',
  to_city: 'Kyoto',
  mode: 'Zug',
  departure_time: '09:00',
  duration_min: 30,
  price_eur: null,
  booking_status: 'gebucht',
  notes: null,
});
const bundle = (trip: Row, places: Row[], hotels: Row[] = [], journeys: Row[] = []) =>
  ({ trip, places, hotels, journeys, expenses: [] }) as never;

const find = (list: { id: string }[], id: string) => list.find((f) => f.id === id);
/** nur was wirklich weh tut – Hinweise (leere Tage, offener Pool) sind Optional */
const hard = (list: { tone: string }[]) => list.filter((f) => f.tone !== 'info');
const rowsOf = (action: { run?: { table: string; rows: { id: string; patch: Row }[] }[] }, table: string) =>
  (action.run ?? []).find((s) => s.table === table)?.rows ?? [];

/** ein Set Patches auf einen Haufen Zeilen anwenden – so prüft die UI auch */
function patchRows(rows: Row[], changes: { id: string; patch: Row }[], dateKeys: string[]) {
  return rows.map((r) => {
    const hit = changes.find((c) => c.id === r.id);
    return hit ? { ...r, ...hit.patch } : r;
  }).map((r) => {
    // nachziehen darf kein Datum außerhalb des alten Musters hinterlassen
    for (const k of dateKeys) if (typeof r[k] === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(r[k] as string)) errors.push(`Datum ${k} kaputt: ${String(r[k])}`);
    return r;
  });
}

/* ── 1 · ein sauberer Plan bleibt in Ruhe ──────────────────────────────────── */
{
  const clean = bundle(
    tripOf('2027-04-02', '2027-04-16'),
    [place('p1', 'Burg', '2027-04-03'), place('p2', 'Markt', '2027-04-10'), place('p3', 'Schloss', '2027-04-15')],
    [hotel('a', '2027-04-02', '2027-04-09'), hotel('b', '2027-04-09', '2027-04-16')],
    [journey('j1', 'Ankunft KIX', '2027-04-02'), journey('j2', 'Rückflug', '2027-04-16')],
  );
  const fs = checkTrip(clean, 't');
  step('gesunde Reise liefert nichts zurück', hard(fs).length === 0, fs.map((f: Row) => f.id));
}

/* ── 2 · Löcher, Doppelbuchungen, Nächte ohne Bett ────────────────────────── */
{
  const gapped = bundle(tripOf('2027-04-02', '2027-04-16'), [], [hotel('a', '2027-04-02', '2027-04-09')]);
  const fs = checkTrip(gapped, 't');
  const gap = find(fs, 'nächte-fehlen');
  step('7 Nächte ohne Bett gefunden', Boolean(gap) && /7 Nächte ohne Bett/.test((gap as Row).title as string), (gap as Row)?.title);
  step('Loch führt zu den Betten', (gap as Row)?.actions[0].href === '/t/t/unterkuenfte');
  step('Ton zuerst: ein Fehler steht oben', fs[0].tone === 'bad', fs.map((f: Row) => f.tone));

  const double = bundle(
    tripOf('2027-04-02', '2027-04-16'),
    [],
    [hotel('a', '2027-04-02', '2027-04-09'), hotel('b', '2027-04-07', '2027-04-16')],
  );
  const d = find(checkTrip(double, 't'), 'doppeltes-bett');
  step('doppeltes Bett in 2 Nächten', Boolean(d) && (d as Row).example === '07.04. hotel a + hotel b · 08.04. hotel a + hotel b', (d as Row)?.example);

  const flat = bundle(tripOf('2027-04-02', '2027-04-16'), [], [hotel('a', '2027-04-02', '2027-04-02'), hotel('b', '2027-04-09', null)]);
  const n = find(checkTrip(flat, 't'), 'betten-ohne-nacht');
  step('2 Unterkünfte ohne Nacht', Boolean(n) && (n as Row).title === '2 Unterkünfte haben keine Nacht', (n as Row)?.title);

  const none = bundle(tripOf('2027-04-02', '2027-04-16'), [], [hotel('a', null, null)]);
  step('gar kein Bett gezählt → eigener Hinweis', Boolean(find(checkTrip(none, 't'), 'betten-ohne-nacht')));
}

/* ── 3 · der verrutschte Plan ──────────────────────────────────────────────── */
{
  const shifted = bundle(
    tripOf('2027-04-02', '2027-04-16'),
    [place('p1', 'Burg', '2027-04-03'), place('p2', 'Markt', '2027-04-11')],
    [hotel('a', '2027-04-03', '2027-04-10'), hotel('b', '2027-04-10', '2027-04-17')],
    [journey('j1', 'Ankunft', '2027-04-03')],
  );
  const fs = checkTrip(shifted, 't');
  const v = find(fs, 'versatz');
  step('Versatz um 1 Tag erkannt', Boolean(v), fs.map((f: Row) => f.id));
  step('der Befund erklärt beide Richtungen', (v as Row)?.actions.length === 2, (v as Row)?.actions?.map((a: Row) => a.label));
  step('Versatz frisst keine Löcher und keine Ausreißer', !find(fs, 'außerhalb-nach') && !find(fs, 'nächte-fehlen'), fs.map((f: Row) => f.id));

  const back = (v as Row).actions[1];
  const newPlaces = patchRows([place('p1', 'Burg', '2027-04-03'), place('p2', 'Markt', '2027-04-11')], rowsOf(back, 'places'), ['date']);
  const newHotels = patchRows([hotel('a', '2027-04-03', '2027-04-10'), hotel('b', '2027-04-10', '2027-04-17')], rowsOf(back, 'hotels'), ['check_in', 'check_out']);
  const newJourneys = patchRows([journey('j1', 'Ankunft', '2027-04-03')], rowsOf(back, 'journeys'), ['date']);
  step(
    'Einträge nachziehen schiebt jeden Punkt um einen Tag zurück',
    newPlaces[0].date === '2027-04-02' && newPlaces[1].date === '2027-04-10' && newJourneys[0].date === '2027-04-02',
    { p: newPlaces.map((r) => r.date), j: newJourneys.map((r) => r.date) },
  );
  step(
    '… und die Betten mit, Nächte bleiben gleich',
    newHotels[0].check_in === '2027-04-02' && newHotels[0].check_out === '2027-04-09' && newHotels[1].check_out === '2027-04-16',
    newHotels.map((h) => [h.check_in, h.check_out]),
  );
  const after = checkTrip(bundle(tripOf('2027-04-02', '2027-04-16'), newPlaces, newHotels, newJourneys), 't');
  step('danach ist der Plan sauber', hard(after).length === 0, after.map((f: Row) => f.id));

  const extend = (v as Row).actions[0];
  const tRow = rowsOf(extend, 'trips')[0];
  step('Reise nachziehen setzt den Zeitraum auf den Plan', tRow?.patch.start_date === '2027-04-03' && tRow?.patch.end_date === '2027-04-17', tRow?.patch);
}

/* ── 4 · Ausreißer ─────────────────────────────────────────────────────────── */
{
  const late = bundle(
    tripOf('2027-04-02', '2027-04-16'),
    [place('p1', 'Burg', '2027-04-03'), place('p2', 'Spät', '2027-04-18')],
    [hotel('a', '2027-04-02', '2027-04-16')],
  );
  const fs = checkTrip(late, 't');
  const o = find(fs, 'außerhalb-nach');
  step('ein Punkt nach dem Reiseende', Boolean(o) && (o as Row).title === '1 Eintrag liegt nach dem Reisezeitraum', (o as Row)?.title);
  step('Verlängern setzt das Ende auf den letzten Tag', rowsOf((o as Row).actions[0], 'trips')[0]?.patch.end_date === '2027-04-18', rowsOf((o as Row).actions[0], 'trips')[0]?.patch);
  step('ein Bett bis übers Ende ist kein Loch', !find(fs, 'nächte-fehlen'), fs.map((f: Row) => f.id));
  step('Aufräumen danach meldet nichts mehr', hard(checkTrip(bundle(tripOf('2027-04-02', '2027-04-18'), [place('p1', 'Burg', '2027-04-03'), place('p2', 'Spät', '2027-04-18')], [hotel('a', '2027-04-02', '2027-04-16'), hotel('b', '2027-04-16', '2027-04-18')]), 't')).length === 0, checkTrip(bundle(tripOf('2027-04-02', '2027-04-18'), [place('p1', 'Burg', '2027-04-03')], [hotel('a', '2027-04-02', '2027-04-16'), hotel('b', '2027-04-16', '2027-04-18')]), 't').map((f: Row) => f.id));

  const early = bundle(tripOf('2027-04-02', '2027-04-16'), [place('p0', 'Vorher', '2027-03-30')], [hotel('a', '2027-04-02', '2027-04-16')]);
  step('ein Punkt vor dem Reisebeginn', Boolean(find(checkTrip(early, 't'), 'außerhalb-vor')));

  const swapped = bundle(tripOf('2027-04-16', '2027-04-02'), [], []);
  step('vertauschter Zeitraum wird benannt', Boolean(find(checkTrip(swapped, 't'), 'zeitraum-vertauscht')));
  step('ohne Zeitraum ist der Befund der erste', checkTrip(bundle(tripOf(null, null), [], []), 't')[0].id === 'kein-zeitraum');
}

/* ── 5 · Kleinkram, Reihenfolge, Zählung ──────────────────────────────────── */
{
  const dup = bundle(
    tripOf('2027-04-02', '2027-04-04'),
    [place('p1',  'Nishiki Markt', '2027-04-03'), place('p2', 'Nishiki  Markt', '2027-04-03'), place('p3', 'Ohne Tag', null)],
    [hotel('a', '2027-04-02', '2027-04-04')],
    [journey('j1', 'Zug ohne Tag', null)],
  );
  const fs = checkTrip(dup, 't');
  step('Dopplung am selben Tag (Groß-/Kleinschreibung egal)', Boolean(find(fs, 'doppelt-am-tag')));
  step('Punkt ohne Tag zählt als Pool', (find(fs, 'pool') as Row)?.title === '1 Punkt wartet noch auf einen Tag', (find(fs, 'pool') as Row)?.title);
  step('Fahrt ohne Datum', Boolean(find(fs, 'fahrten-ohne-datum')));
  step('leere Reisetage', Boolean(find(fs, 'leere-tage')));
  const tones = fs.map((f: Row) => f.tone);
  step('Fehler vor Warnung vor Hinweis', tones.join() === [...tones].sort((a, b) => ({ bad: 0, warn: 1, info: 2 })[a] - { bad: 0, warn: 1, info: 2 }[b]).join(), tones);
  const c = findingCount(fs);
  step('Zählung für den Knopf', c.bad + c.warn + c.info === fs.length && c.info > 0, c);
  step('kein Knopf schreibt leere Zeilen', fs.every((f: Row) => f.actions.every((a: Row) => (a.run ? a.run.every((s: Row) => s.rows.length > 0) : Boolean(a.href)))), fs.map((f: Row) => f.id));
  step('jeder Knopf weiß, wohin', fs.every((f: Row) => f.actions.length > 0));
}

/* ── 6 · Nächte am Rand ───────────────────────────────────────────────────── */
{
  // ein Tag Reise, ein Bett: eine Nacht, und die ist gedeckt
  const one = bundle(tripOf('2027-04-02', '2027-04-03'), [], [hotel('a', '2027-04-02', '2027-04-03')]);
  step('eine Nacht ist kein Loch', hard(checkTrip(one, 't')).length === 0, checkTrip(one, 't').map((f: Row) => f.id));
  // Bett einen Tag über die Reise hinaus → nachziehen ist erlaubt, Prüfen meldet es
  const long = bundle(tripOf('2027-04-02', '2027-04-16'), [], [hotel('a', '2027-04-02', '2027-04-17')]);
  const lf = checkTrip(long, 't');
  step('ein Tag über das Reiseende wird nicht als Nacht-Loch gemeldet', !find(lf, 'nächte-fehlen'), lf.map((f: Row) => f.id));
  step('… aber als Ausreißer', Boolean(find(lf, 'außerhalb-nach')), lf.map((f: Row) => f.id));
  step('addDays-Datum bleibt ein Datum', addDays('2027-04-30', 1) === '2027-05-01');
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Prüfen findet Löcher, Doppelbetten und Versatz – und korrigiert nur auf Klick\n');
if (errors.length) process.exit(1);
