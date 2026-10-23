/**
 * Rechenprobe für Daten und Nächte – und zwar in einer Zeitzone östlich von UTC.
 * Genau dort rutscht ein `toISOString()`-Datum einen Tag zurück, und das hat mal
 * den Nächte-Check einen Tag zu kurz gemacht. Aufruf: npm run test:dates
 */
if (!process.env.TZ) process.env.TZ = 'Europe/Vienna';

const { addDays, daysBetween, eachDate, fmtDate, today } = await import('../src/lib/format.ts');
const { shiftDate } = await import('../src/lib/planner.ts');
const { nightCoverage } = await import('../src/lib/stats.ts');
const { tintFor } = await import('../src/lib/palette.ts');

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

const pad = (n: number) => String(n).padStart(2, '0');

step(`Zeitzone wird geprüft (${process.env.TZ})`, process.env.TZ === 'Europe/Vienna');

// ── Tages-Rechnerei ──────────────────────────────────────────────────────────
step('addDays bleibt auf dem Tag', addDays('2027-04-01', 1) === '2027-04-02', addDays('2027-04-01', 1));
step('addDays über die Sommerzeit hinweg', addDays('2027-03-27', 2) === '2027-03-29', addDays('2027-03-27', 2));
step('addDays zurück', addDays('2027-04-30', -29) === '2027-04-01', addDays('2027-04-30', -29));
step('shiftDate (Reise schieben) rechnet wie addDays', shiftDate('2027-10-24', 3) === '2027-10-27', shiftDate('2027-10-24', 3));
step('eachDate endet am letzten Tag', eachDate('2027-04-01', '2027-04-03').join() === '2027-04-01,2027-04-02,2027-04-03', eachDate('2027-04-01', '2027-04-03'));
step('eachDate zählt 40 Reisetage', eachDate('2027-03-06', '2027-04-14').length === 40, eachDate('2027-03-06', '2027-04-14').length);
step('eachDate mit sich selbst = ein Tag', eachDate('2027-04-01', '2027-04-01').join() === '2027-04-01');
step('eachDate in falscher Reihenfolge = leer', eachDate('2027-04-03', '2027-04-01').length === 0);
step('daysBetween zählt beide Ränder', daysBetween('2027-04-02', '2027-04-30') === 29, daysBetween('2027-04-02', '2027-04-30'));
step('heute = heutiger Tag im eigenen Kalender', today() === `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`, today());
step('Formatieren verschiebt nichts', fmtDate('2027-04-01', { day: '2-digit', month: '2-digit', year: 'numeric' }) === '01.04.2027', fmtDate('2027-04-01', { day: '2-digit', month: '2-digit', year: 'numeric' }));

// ── Nächte-Check ─────────────────────────────────────────────────────────────
const trip = (start: string | null, end: string | null) => ({ id: 't', trip_id: 't', name: 'Frühling', start_date: start, end_date: end } as any);
const hotel = (id: string, inDay: string, outDay: string) => ({ id, trip_id: 't', name: `hotel ${id}`, city: 'Osaka', check_in: inDay, check_out: outDay, nights: daysBetween(inDay, outDay) - 1, booking_status: 'gebucht' } as any);

{
  const hotels = [hotel('a', '2027-04-02', '2027-04-09'), hotel('b', '2027-04-09', '2027-04-16')];
  const cov = nightCoverage({ trip: trip('2027-04-02', '2027-04-30'), hotels, places: [], journeys: [], expenses: [] } as any);
  step('Reise 02.04. → 30.04. = 28 Nächte', cov.length === 28, cov.length);
  step('erste Nacht ist der Anreisetag', cov[0]?.date === '2027-04-02', cov[0]);
  step('die Nacht am Abreisetag fehlt', cov[cov.length - 1]?.date === '2027-04-29', cov[cov.length - 1]);
  step('Umzug am 09.04. bleibt gedeckt', cov[7]?.covered === true && cov[7]?.hotelId === 'b', cov[7]);
  step('Nacht nach dem letzten Bett ist ein Loch', cov.filter((c) => !c.covered).length === 14, cov.filter((c) => !c.covered).length);
  step('Loch nennt kein Hotel', cov[14].covered === false && cov[14].hotel === null, cov[14]);
  step('Unterkunft kennt ihre Nächte im Plan', cov.filter((c) => c.hotelId === 'a').length === 7, cov.filter((c) => c.hotelId === 'a').length);
}
{
  // Bett reicht über die Reise hinaus → der Check schaut trotzdem bis zum letzten Bett
  const cov = nightCoverage({
    trip: trip('2027-04-02', '2027-04-30'),
    hotels: [hotel('a', '2027-04-02', '2027-04-09'), hotel('c', '2027-04-29', '2027-05-01')],
    places: [],
    journeys: [],
    expenses: [],
  } as any);
  step('Reise endet früher als das Bett → Nächte bis zuletzt', cov.length === 29 && cov[cov.length - 1]?.date === '2027-04-30', { n: cov.length, last: cov[cov.length - 1]?.date });
  step('die letzte Nacht gehört dem späten Bett', cov[cov.length - 1]?.hotelId === 'c', cov[cov.length - 1]);
}
{
  const cov = nightCoverage({ trip: trip(null, null), hotels: [hotel('a', '2027-05-10', '2027-05-12')], places: [], journeys: [], expenses: [] } as any);
  step('ohne Reisezeitraum zählen die Betten', cov.map((c) => c.date).join() === '2027-05-10,2027-05-11', cov.map((c) => c.date));
}
step('ohne Daten kein Nächte-Check', nightCoverage({ trip: trip(null, null), hotels: [], places: [], journeys: [], expenses: [] } as any).length === 0);
{
  const cov = nightCoverage({ trip: trip('2027-04-02', '2027-04-02'), hotels: [hotel('a', '2027-04-02', '2027-04-03')], places: [], journeys: [], expenses: [] } as any);
  step('ein Tag Reise = eine Nacht', cov.length === 1, cov);
}

// ── Farben ───────────────────────────────────────────────────────────────────
{
  const t = tintFor('ht-a');
  step('Farbe ist gültiges CSS (kein angehängtes Alpha)', /^hsl\([\d.]+ 58% 48%( \/ 0\.16| 66%)?\)$/.test(t.soft) && /^hsl\([\d.]+ 58% 48%\)$/.test(t.base), t);
  step('gleicher Schlüssel = gleiche Farbe', tintFor('ht-a').base === tintFor('ht-a').base && tintFor('ht-a').base !== tintFor('ht-b').base);
  step('ohne Schlüssel greift die Nummer', tintFor(null, 0).base === tintFor(null, 0).base && tintFor(null, 1).base !== tintFor(null, 0).base);
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Tage, Nächte und Farben sitzen – ohne Zeitzonen-Sprung\n');
if (errors.length) process.exit(1);
