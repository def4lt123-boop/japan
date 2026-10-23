/**
 * Rechenprobe für den Import: was der Export schreibt, muss wieder reingehen – und zwar
 * zweimal hintereinander, ohne dass etwas doppelt steht. Auch Spreadsheet-Einfügen
 * (Tabeller), Notizzeilen ohne Überschrift und die JSON-Sicherung werden geprüft.
 * Aufruf: npm run test:import
 */
const { planImport, parseTable } = await import('../src/lib/import.ts');
const { placeCsv, hotelCsv, journeyCsv } = await import('../src/lib/export.ts');
const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

const trip = {
  id: 'neu',
  name: 'Herbst 2027',
  destination: 'Japan',
  start_date: '2027-10-24',
  end_date: '2027-11-02',
  travelers: 2,
  budget_eur: null,
  jpy_rate: null,
  notes: null,
  archived: false,
  started: false,
  started_at: null,
  planned_start: null,
  planned_end: null,
} as never;

const { default: seed } = await import('../data/seed.json', { with: { type: 'json' } });
const base = seed as unknown as { places: never[]; hotels: never[]; journeys: never[] };
// die Referenzreise hat Tage mit mehreren Punkten und welche ohne – genau der Mischwald,
// der wieder rein muss
const rowsSrc = (base.places as never[]).filter((p) => (p as { trip_id: string }).trip_id === 'trip-2025');
const csv = placeCsv(rowsSrc as never, base.hotels as never);

/* ── 1 · der eigene Export, zurückgelesen ────────────────────────────────── */
{
  const plan = planImport(csv, 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  const places = plan.fresh as { name: string; date: string | null; price_eur: number | null; notes: string | null; category: string | null; sort_order: number }[];
  step('CSV-Export läuft vollständig wieder rein', plan.total === rowsSrc.length && plan.fresh.length === rowsSrc.length, { total: plan.total, neu: plan.fresh.length, soll: rowsSrc.length });
  step('alle 14 Spalten des Exports sind zugeordnet', plan.columns.length === 14 && plan.problems.length === 0, { spalten: plan.columns.length, probleme: plan.problems });
  step('Daten bleiben Daten (auch die ohne Tag)', places.every((p) => p.date === null || /^\d{4}-\d{2}-\d{2}$/.test(p.date)), places.find((p) => p.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(p.date))?.date);
  const src = rowsSrc as unknown as { name: string; date: string | null; price_eur: number | null; notes: string | null }[];
  const preisOk = places.every((p) => {
    const want = src.find((s) => s.name === p.name);
    return !want || Math.abs((p.price_eur ?? 0) - (want.price_eur ?? 0)) < 0.011;
  });
  const textOk = src.every((s) => !s.notes || (places.find((x) => x.name === s.name)?.notes ?? null) === s.notes);
  step('deutsche Preise (1.234,50 €) werden wieder zu Zahlen', preisOk, places.slice(0, 3).map((p) => [p.name, p.price_eur]));
  step('Hinweise überleben den Umweg', textOk, src.filter((x) => !places.some((p) => p.name === x.name && (p.notes ?? null) === x.notes)).slice(0, 2));
  step('jede Kategorie steht fest (erkannt oder geraten)', places.every((p) => Boolean(p.category)));
  const byDay = new Map<string, number[]>();
  for (const p of places) byDay.set(String(p.date), [...(byDay.get(String(p.date)) ?? []), p.sort_order]);
  const multi = [...byDay.values()].filter((v) => v.length > 1);
  step(
    'Reihenfolge am Tag folgt der Datei (0, 1, 2 …)',
    multi.length >= 1 && multi.every((v) => v.join() === v.map((_, i) => i).join()),
    multi.slice(0, 3),
  );
  step('neue ids, alle verschieden', new Set(places.map((p) => (p as unknown as { id: string }).id)).size === places.length);

  // noch einmal in die Reise, in der alles schon steht → kein einziger Neuzugang
  const again = planImport(csv, 'places', {
    tripId: 'neu',
    trip,
    places: plan.fresh as never,
    hotels: [],
    journeys: [],
  });
  step('zweiter Import derselben Datei legt nichts doppelt an', again.fresh.length === 0 && again.rows.every((r) => r.status === 'duplikat'), { frisch: again.fresh.length });
}

/* ── 2 · Einfügen aus dem Tabellenprogramm (Tabeller, Überschrift variiert) ─ */
{
  const text = ['Aktivität\tStadt\tDatum\tHinweise\tPreis', 'Fushimi Inari\tKyoto\t25.10.2027\tSonnenaufgang\t12,50', 'Nishiki Markt\tKyoto\t25.10.2027\t\t8'].join('\n');
  const plan = planImport(text, 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  const rows = plan.rows.map((r) => r.value as { name: string; date: string | null; notes: string | null; price_eur: number | null });
  step('Tabeller-getrennte Zeilen mit Überschrift', plan.total === 2 && rows[0].name === 'Fushimi Inari' && rows[0].date === '2027-10-25', rows);
  step('Komma-Preis und leere Zellen', rows[0].price_eur === 12.5 && rows[1].price_eur === 8 && rows[0].notes === 'Sonnenaufgang');
  const orders = plan.rows.map((r) => (r.value as { sort_order: number }).sort_order);
  step('beide landen untereinander am selben Tag', orders.join() === '0,1', orders);
}

/* ── 3 · nur Textzeilen (Notizen, Messenger) ─────────────────────────────── */
{
  const text = ['12.04. Nishiki Markt', 'Kifune-Kaffee in Kyoto', '  ', '24.10. Fushimi Inari – Sonnenaufgang'].join('\n');
  const plan = planImport(text, 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  const rows = plan.rows.map((r) => r.value as { name: string; date: string | null; notes: string | null });
  step('Zeile pro Punkt, ohne Überschrift', plan.total === 3 && rows[1].name === 'Kifune-Kaffee in Kyoto' && rows[1].date === null, rows.map((r) => [r.name, r.date]));
  step('leadinges Datum wird zum Tag – nächstes Jahr, das dem Zeitraum am nächsten liegt', rows[2].date === '2027-10-24' && rows[0].date === '2028-04-12', rows.map((r) => r.date));
  step('der Nachsatz nach dem Gedankenstrich bleibt Notiz', rows[2].notes === 'Sonnenaufgang' && rows[2].name === 'Fushimi Inari', [rows[2].name, rows[2].notes]);
  step('und die Zeile ohne Tag bleibt ein Name ohne alles', rows[1].name === 'Kifune-Kaffee in Kyoto' && rows[1].notes === null, [rows[1].name, rows[1].notes]);
  step('leere Zeile zählt nicht', !rows.some((r) => r.name === ''));
  step('ein Datum außerhalb wird gemerkt, nicht verschluckt', plan.rows.some((r) => /Reise/.test(r.note ?? '')), plan.rows.map((r) => r.note));
}

/* ── 4 · Unterkünfte und Fahrten ─────────────────────────────────────────── */
{
  const hotels = (base.hotels as never[]).filter((h) => (h as { trip_id: string }).trip_id === 'trip-2025');
  const csvH = hotelCsv(hotels as never);
  const plan = planImport(csvH, 'hotels', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  const rows = plan.rows.map((r) => r.value as { name: string; check_in: string; check_out: string; nights: number | null; price_total_eur: number | null });
  step('Unterkunfts-CSV geht genauso zurück', plan.total === hotels.length && rows.every((r) => r.check_in < r.check_out), rows.slice(0, 2));
  step('Nächte stehen da (aus der Spalte oder den Daten)', rows.every((r) => (r.nights ?? 0) > 0), rows.map((r) => r.nights));
  step('Preis je Unterkunft ist eine Zahl (leer bleibt leer)', rows.every((r) => r.price_total_eur === null || typeof r.price_total_eur === 'number'), rows.map((r) => r.price_total_eur));

  const jCsv = journeyCsv((base.journeys as never[]).filter((j) => (j as { trip_id: string }).trip_id === 'trip-2025') as never);
  const jp = planImport(jCsv, 'journeys', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  step('Fahrten-CSV: Titel, Von→Nach, Uhrzeit', jp.fresh.length > 0 && (jp.rows[0].value as { title: string }).title.length > 0, (jp.rows[0]?.value as { title: string; departure_time: string | null; mode: string | null; duration_min: number | null }));
}

/* ── 5 · die Sicherung ───────────────────────────────────────────────────── */
{
  const json = JSON.stringify({ places: (base.places as never[]).slice(0, 8), hotels: [], journeys: [] });
  const plan = planImport(json, 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  step('JSON-Sicherung wird gelesen', plan.total === 8 && plan.fresh.length === 8, { total: plan.total, frisch: plan.fresh.length });
  const first = plan.rows[0].value as { name: string; lat: number | null; price_eur: number | null };
  step('Felder bleiben Felder (Zahlen keine Texte)', typeof first.price_eur === 'number' || first.price_eur === null, [first.name, first.lat, first.price_eur]);
}

/* ── 6 · Müll und Sonderfälle ─────────────────────────────────────────────── */
{
  step('leerer Text: eine Meldung, kein Absturz', planImport('   ', 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] }).problems.length === 1);
  const kaputt = planImport('Spalte A;Spalte B\n;\n;"  "', 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  step('Zeilen ohne Namen werden nicht angelegt', kaputt.fresh.length === 0 && kaputt.rows.every((r) => r.status !== 'neu'), kaputt.rows.map((r) => r.status));
  step('unbekannte Spalten werden benannt', kaputt.problems.some((p) => /ohne Zuordnung/.test(p)), kaputt.problems);
  const ziffern = planImport('Datum;Aktivität\n13.13.2027;Unsinn\n0;Auch', 'places', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  step('kein Datum → Punkt ohne Tag, mit Erklärung', ziffern.rows.every((r) => r.value.date === null && /kein Datum/.test(r.note ?? '')), ziffern.rows.map((r) => r.note));
  const uhr = planImport('Fahrt;Datum;Abflug;Dauer;Von;Nach\nShinkansen;27.10.;7:05;2 h 15;Kyoto;Tokio', 'journeys', { tripId: 'neu', trip, places: [], hotels: [], journeys: [] });
  const j = uhr.rows[0].value as { departure_time: string | null; duration_min: number | null };
  step('Uhrzeit und Dauer aus freiem Text', j.departure_time === '07:05' && j.duration_min === 135, j);
  const table = parseTable('a\tb\n1\t2', 'places');
  step('parseTable erkennt den Trenner selbst', table.separated === '\t' && table.rows.length === 1, table.separated);
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Import lies, was der Export schreibt – und legt nichts doppelt an\n');
if (errors.length) process.exit(1);
