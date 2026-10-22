/**
 * Rechenprobe für die zwei Modi: 🗓️ Planung ↔ ▶️ Unterwegs.
 * Aufruf: npm run test:mode
 */
import { endTrip, liveDay, liveDays, nextUp, nowMinutes, startHint, startTrip, tripMode } from '../src/lib/mode.ts';
import { addDays, today } from '../src/lib/format.ts';
import { dayDiff } from '../src/lib/planner.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

const place = (over: Record<string, unknown> = {}) =>
  ({ id: 'p', trip_id: 't', name: 'Punkt', city: 'Osaka', date: '2027-03-08', start_time: null, duration_min: 90, time_slot: null, end_date: null, sort_order: 0, booking_status: 'offen', priority: 'soll', category: 'Sehenswürdigkeit', notes: null, district: null, travel_time: null, lat: null, lng: null, maps_query: null, booking_url: null, price_eur: null, price_note: null, ticket_status: 'unklar', ticket_note: null, ...over } as any) as never;
const hotel = (over: Record<string, unknown> = {}) =>
  ({ id: 'h', trip_id: 't', name: 'Hotel', city: 'Osaka', check_in: '2027-03-06', check_out: '2027-03-13', nights: 7, price_eur: 120, booking_status: 'offen', address: null, lat: null, lng: null, notes: null, ...over } as any) as never;
const trip = (over: Record<string, unknown> = {}) =>
  ({ id: 't', name: 'Japan', destination: 'Japan', start_date: '2027-03-06', end_date: '2027-04-14', travelers: 2, budget_eur: null, jpy_rate: null, notes: null, archived: false, started: false, started_at: null, planned_start: null, planned_end: null, ...over } as any) as never;

/** Fake-Store: notiert jeden patch/patchMany, damit man nachprüfen kann */
function fakeStore() {
  const patches: { table: string; id: string; patch: any }[] = [];
  const notes: string[] = [];
  return {
    store: {
      patch: async (table: any, id: any, patch: any) => void patches.push({ table, id, patch }),
      patchMany: async (table: any, changes: any[]) => {
        for (const c of changes) patches.push({ table, id: c.id, patch: c.patch });
      },
      upsert: async (table: any, row: any) => void patches.push({ table, id: row.id, patch: row }),
      say: (msg: string) => notes.push(msg),
    } as any,
    patches,
    notes,
  };
}

const iso = today();
const T = (offset: number) => addDays(iso, offset);

// ── Modus ableiten ───────────────────────────────────────────────────────────
step('ohne Start ist Planung', tripMode(trip({})) === 'plan');
step('started = unterwegs', tripMode(trip({ started: true, started_at: iso })) === 'live');
step('_started fehlt (alte Daten) → Planung', tripMode({ ...trip(), started: undefined } as any) === 'plan');
step('Tagzähler zählt ab start_date', liveDays(trip({ started: true, started_at: T(-2), start_date: T(-2) })) === 3);

// ── Starten: Zukunft rutscht mit ─────────────────────────────────────────────
{
  const { store, patches, notes } = fakeStore();
  const t = trip({ start_date: T(10), end_date: T(20) });
  const p = place({ id: 'a', date: T(10) });
  const h = hotel({ id: 'h', check_in: T(10), check_out: T(20) });
  const ok = startTrip(store, { trip: t, places: [p], hotels: [h], journeys: [], expenses: [] });
  const tripPatch = Object.assign({}, ...patches.filter((x) => x.table === 'trips').map((x) => x.patch));
  const placePatch = patches.find((x) => x.table === 'places' && x.id === 'a')?.patch ?? {};
  const hotelPatch = patches.find((x) => x.table === 'hotels')?.patch ?? {};
  step('Starten gibt true und meldet', ok && notes.length > 0, notes.at(-1)?.slice(0, 40));
  step('Reise läuft ab heute', tripPatch.started === true && tripPatch.started_at === iso);
  step('alter Zeitraum gemerkt', tripPatch.planned_start === T(10) && tripPatch.planned_end === T(20));
  step('neuer Zeitraum = heute bis +10', tripPatch.start_date === undefined || tripPatch.start_date === iso);
  step('Aktivität rutscht auf Tag 1', placePatch.date === iso, { erwartet: iso, bekommen: placePatch.date });
  step('Nächte rutschen mit', hotelPatch.check_in === iso && hotelPatch.check_out === addDays(iso, 10), hotelPatch);
  step('Meldung nennt Tag und Ort', /Tag 1/.test(notes.at(-1) ?? '') && /Osaka/.test(notes.at(-1) ?? ''), notes.at(-1));
}

// ── Starten: mitten in der Reise bleibt der Kalender stehen ───────────────────
{
  const { store, patches, notes } = fakeStore();
  const t = trip({ start_date: T(-3), end_date: T(30) });
  const p = place({ id: 'a', date: T(-3) });
  const ok = startTrip(store, { trip: t, places: [p], hotels: [], journeys: [], expenses: [] });
  const tripPatch = Object.assign({}, ...patches.filter((x) => x.table === 'trips').map((x) => x.patch));
  step('mitten drin: gestartet', ok && tripPatch.started === true);
  step('mitten drin: nichts verrutscht', !patches.some((x) => x.table === 'places'));
  step('mitten drin: alter Zeitraum bleibt frei', tripPatch.planned_start === undefined);
  step('Meldung zählt Tag 4', /Tag 4\b/.test(notes.at(-1) ?? ''), notes.at(-1));
}

// ── Starten: Plan liegt vorbei ───────────────────────────────────────────────
{
  const { store, patches } = fakeStore();
  const t = trip({ start_date: T(-40), end_date: T(-20) });
  startTrip(store, { trip: t, places: [place({ id: 'a', date: T(-40) })], hotels: [], journeys: [], expenses: [] });
  const tripPatch = Object.assign({}, ...patches.filter((x) => x.table === 'trips').map((x) => x.patch));
  step('vorbei: Tag 1 ist wieder heute, alter Anfang gemerkt', tripPatch.start_date === iso && tripPatch.started_at === iso && tripPatch.planned_start === T(-40), { start: tripPatch.start_date, alt: tripPatch.planned_start });
  step('vorbei: Aktivität rutscht nach vorn', patches.find((x) => x.id === 'a')?.patch.date === iso);
}

// ── Starten ohne Zeitraum ────────────────────────────────────────────────────
{
  const { store, patches } = fakeStore();
  const t = trip({ start_date: null, end_date: null });
  startTrip(store, { trip: t, places: [place({ id: 'a', date: null }), place({ id: 'b', date: null })], hotels: [], journeys: [], expenses: [] });
  const tripPatch = Object.assign({}, ...patches.filter((x) => x.table === 'trips').map((x) => x.patch));
  step('ohne Zeitraum: Tag 1 = heute', tripPatch.start_date === iso);
  step('ohne Zeitraum: Ende aus dem Pool', tripPatch.end_date === addDays(iso, 6), tripPatch.end_date);
}

// ── Starten ist kein zweites Mal ─────────────────────────────────────────────
{
  const { store, notes } = fakeStore();
  const ok = startTrip(store, { trip: trip({ started: true, started_at: iso }), places: [], hotels: [], journeys: [], expenses: [] });
  step('läuft schon → false mit Hinweis', ok === false && /läuft schon/.test(notes.at(-1) ?? ''), notes.at(-1));
  step('ohne Reise nichts zu starten', startTrip(store, { trip: undefined, places: [], hotels: [], journeys: [], expenses: [] }) === false);
}

// ── Beenden ──────────────────────────────────────────────────────────────────
{
  const { store, patches, notes } = fakeStore();
  const t = trip({ started: true, started_at: iso, start_date: iso, end_date: T(10), planned_start: T(10), planned_end: T(20) });
  const p = place({ id: 'a', date: iso, booking_status: 'erledigt' });
  endTrip(store, { trip: t, places: [p], hotels: [hotel({ check_in: iso, check_out: T(10) })], journeys: [], expenses: [] }, false);
  const tripPatch = Object.assign({}, ...patches.filter((x) => x.table === 'trips').map((x) => x.patch));
  step('beenden: Planung an', tripPatch.started === false && tripPatch.started_at === null);
  step('beenden: Merker bleibt für später', tripPatch.planned_start === undefined);
  step('beenden: Abgehaktes wird gemeldet', /1 Punkt abgehakt/.test(notes.at(-1) ?? ''), notes.at(-1));
}
{
  const { store, patches } = fakeStore();
  const t = trip({ started: true, started_at: iso, start_date: iso, end_date: T(10), planned_start: T(10), planned_end: T(20) });
  endTrip(store, { trip: t, places: [place({ id: 'a', date: iso })], hotels: [], journeys: [], expenses: [] }, true);
  const tripPatch = Object.assign({}, ...patches.filter((x) => x.table === 'trips').map((x) => x.patch));
  step('zurücknehmen: Zeitraum steht wieder', tripPatch.planned_start === null && tripPatch.planned_end === null && tripPatch.started === false);
  step('zurücknehmen: Aktivität wandert zurück', patches.find((x) => x.id === 'a')?.patch.date === T(10));
  step('beenden ohne laufende Reise → false', endTrip(store, { trip: trip({}), places: [], hotels: [], journeys: [], expenses: [] }, true) === false);
}

// ── Der angezeigte Tag klemmt nie ────────────────────────────────────────────
{
  const t = trip({ start_date: T(10), end_date: T(20) });
  const vorher = liveDay(t, T(2))!;
  step('vorher → Tag 1 mit Hinweis', vorher.iso === T(10) && vorher.tagIndex === 1 && vorher.klemmt === 'vorher');
  const mitten = liveDay(t, T(13))!;
  step('mitten drin → heute mit Tag 4', mitten.iso === T(13) && mitten.tagIndex === 4 && mitten.klemmt === null);
  const nachher = liveDay(t, T(40))!;
  step('nachher → letzter Tag', nachher.iso === T(20) && nachher.tagIndex === 11 && nachher.klemmt === 'nachher');
  step('ohne Zeitraum → kein Tag', liveDay(trip({ start_date: null, end_date: null }), iso) === null);
}

// ── Der nächste Halt ─────────────────────────────────────────────────────────
{
  const heute = [
    place({ id: 'a', start_time: '09:00', duration_min: 60, booking_status: 'erledigt' }),
    place({ id: 'b', start_time: '12:00', duration_min: 120 }),
    place({ id: 'c', start_time: '19:00', duration_min: 90 }),
  ];
  const vor = nextUp(heute, 11 * 60)!;
  step('vor dem Termin: der nächste Punkt', vor.place.id === 'b' && vor.inMin === 60 && !vor.laeuft, { in: vor?.inMin });
  const waehrend = nextUp(heute, 12 * 60 + 30)!;
  step('währenddessen: läuft gerade', waehrend.place.id === 'b' && waehrend.laeuft);
  const spaet = nextUp(heute, 23 * 60)!;
  step('nach dem letzten: der letzte Punkt bleibt', spaet.place.id === 'c');
  step('leerer Tag → kein nächster Halt', nextUp([], 12 * 60) === null);
  const nurAbgehakt = [place({ id: 'x', start_time: '09:00', duration_min: 60, booking_status: 'erledigt' }), place({ id: 'y', start_time: '10:00', duration_min: 60, booking_status: 'erledigt' })];
  step('alles erledigt → kein nächster Halt', nextUp(nurAbgehakt, 9 * 60) === null);
}

// ── Knopfbeschriftung ────────────────────────────────────────────────────────
{
  const hint = startHint({ trip: trip({ start_date: T(135), end_date: T(174) }), places: [], hotels: [], journeys: [], expenses: [] });
  step('Hinweis nennt den Vorlauf', /135 Tage nach vorn/.test(hint) && /Tag 136/.test(hint), hint);
  const frei = startHint({ trip: trip({ start_date: null, end_date: null }), places: [place({ id: 'a', date: T(10) }), place({ id: 'b', date: T(10) })], hotels: [], journeys: [], expenses: [] });
  step('ohne Zeitraum: Tage übernommen', /1 Tag übernommen/.test(frei), frei);
  step('nur Minuten des Tages', nowMinutes(new Date('2026-10-22T13:37:00')) === 13 * 60 + 37);
  step('dayDiff zählt wie erwartet', dayDiff(iso, T(5)) === 5);
}

console.log(errors.length ? `\n❌ ${errors.length} Probleme: ${errors.join(', ')}` : '\n🎉 Modi-Rechnung passt');
process.exit(errors.length ? 1 : 0);
