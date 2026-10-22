/**
 * Rechenprobe für die Tageszeit: Fenster, Lücken, Ausweichen, Doppelplanung.
 * Aufruf: npm run test:dayplan
 */
import {
  assign,
  busyWindows,
  setSlot,
  collide,
  duplicateOnDay,
  fmtWindow,
  freeWindows,
  plannedMinutes,
  suggestStart,
  windowOf,
} from '../src/lib/dayplan.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};
const min = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

const place = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    trip_id: 't',
    name: 'Nara Park',
    city: 'Nara',
    date: '2027-03-08',
    start_time: '12:00',
    duration_min: 120,
    time_slot: null,
    end_date: null,
    sort_order: 0,
    booking_status: 'offen',
    priority: 'soll',
    ...over,
  }) as any;

const park = place();
const win = windowOf(park);
step('Fenster: 12:00 + 2 h → 12:00–14:00', win!.start === 720 && win!.end === 840, fmtWindow(win!.start, win!.end));

const temple = place({ id: 'p2', name: 'Todai-ji', start_time: '15:00', duration_min: 60 });
const both = [park, temple];
step('Belegt: 12–14 und 15–16', JSON.stringify(busyWindows(both)) === JSON.stringify([[720, 840], [900, 960]]), busyWindows(both));
step('Frei: 07–12, 14–15, 16–23', JSON.stringify(freeWindows(both)) === JSON.stringify([[420, 720], [840, 900], [960, 1380]]), freeWindows(both));
step('Verplante Zeit = 3 h', plannedMinutes(both) === 180, plannedMinutes(both));

const bump = suggestStart([park], 60, min('12:30'));
step('Belegte Zeit weicht auf 14:00 aus', bump.start === 840 && bump.moved, fmtWindow(bump.start, bump.start + 60));
const keep = suggestStart([park], 60, min('10:00'));
step('Freie Zeit bleibt stehen', keep.start === 600 && !keep.moved, fmtWindow(keep.start, keep.start + 60));
const first = suggestStart([park], 90, null);
step('Ohne Wunschzeit: erste Lücke 07:00', first.start === 420, fmtWindow(first.start, first.start + 90));

step('Überschneidung wird gefunden', collide([park], 780, 60, 'pX').length === 1, collide([park], 780, 60, 'pX').map((p: any) => p.name));
step('Eigenes Fenster zählt nicht mit', collide([park], 720, 120, 'p1').length === 0);
step('Ohne Tag kein Fenster', windowOf(place({ date: null })) === null);
step('Ganzer Tag blockiert den Tag', (() => { const w = windowOf(place({ time_slot: 'Ganzer Tag' }))!; return w.start === 420 && w.end === 1380; })());

step('Gleicher Name am selben Tag = Doppelplanung', duplicateOnDay([park, place({ id: 'p9', name: 'nara park ' })], park as any, '2027-03-08').length === 1);
step('Gleicher Name am anderen Tag ist ok', duplicateOnDay([park, place({ id: 'p9', name: 'Nara Park', date: '2027-03-09' })], park as any, '2027-03-08').length === 0);
step('Umbenannte Kopie darf am selben Tag stehen', duplicateOnDay([park, place({ id: 'p9', name: 'Nara Park (Kopie)' })], park as any, '2027-03-08').length === 0);
step('… aber gleicher Name in anderer Schreibweise nicht', duplicateOnDay([park, place({ id: 'p9', name: ' NARA   PARK ' })], park as any, '2027-03-08').length === 1);

const writes: { id: string; patch: any }[] = [];
const notes: string[] = [];
const fake = { patch: async (_t: 'places', id: string, patch: any) => void writes.push({ id, patch }), say: (m: string) => void notes.push(m) };

const refused = assign(fake as any, [park, place({ id: 'p9', name: 'Nara Park' })], place({ id: 'p5', name: 'Nara Park' }) as any, { date: '2027-03-08' });
step('Zweites Mal an denselben Tag wird abgewiesen', refused === false && writes.length === 0, notes[0]);

writes.length = 0;
notes.length = 0;
const movedUp = assign(fake as any, [park], place({ id: 'p5', name: 'Kasuga Taisha', start_time: '13:00', duration_min: 60 }) as any, { date: '2027-03-08', start_time: '13:00' });
step('Belegte Uhrzeit rutscht auf 14:00', movedUp === true && writes[0]?.patch.start_time === '14:00', writes[0]);

writes.length = 0;
notes.length = 0;
const gap = assign(fake as any, [park], place({ id: 'p5', name: 'Freier Punkt', start_time: null, duration_min: 60 }) as any, { date: '2027-03-08' });
step('Ohne Uhrzeit: erste freie Lücke 07:00', gap === true && writes[0]?.patch.start_time === '07:00', writes[0]);

writes.length = 0;
notes.length = 0;
const off = assign(fake as any, [park], park as any, { date: null });
step('Vom Tag lösen geht immer', off === true && writes[0]?.patch.date === null, writes[0]);

// ── Ziehen im Tagesband (setSlot) ───────────────────────────────────────────
writes.length = 0;
notes.length = 0;
setSlot(fake as any, [park], place({ id: 'pX', name: 'Kasuga Taisha', start_time: '15:00', duration_min: 60 }) as any, { start: min('10:00') });
step('Ziehen setzt die Uhrzeit auf 15-Minuten-Schritt', writes[0]?.patch.start_time === '10:00', writes[0]);

writes.length = 0;
notes.length = 0;
setSlot(fake as any, [park], place({ id: 'pX', name: 'Kasuga Taisha', start_time: '15:00', duration_min: 60 }) as any, { start: min('10:07') });
step('Unrunde Zeit wird gerundet (10:07 → 10:00)', writes[0]?.patch.start_time === '10:00', writes[0]);

writes.length = 0;
notes.length = 0;
setSlot(fake as any, both, place({ id: 'pX', name: 'Todai-ji', date: '2027-03-08', start_time: '15:00', duration_min: 60 }) as any, { start: min('12:30') });
step('Überlappung bleibt liegen, wird aber gemeldet', writes[0]?.patch.start_time === '12:30' && /überschneidet sich mit Nara Park/.test(notes[0] || ''), notes[0]);

writes.length = 0;
notes.length = 0;
setSlot(fake as any, [park], place({ id: 'pX', name: 'Spät', start_time: '15:00', duration_min: 120 }) as any, { start: min('23:40') });
step('Über 23:00 wird ans Tagesende geklemmt', writes[0]?.patch.start_time === '21:00', writes[0]);

writes.length = 0;
notes.length = 0;
setSlot(fake as any, [park], place({ id: 'pX', name: 'Früh', start_time: '08:00', duration_min: 90 }) as any, { duration: 150 });
step('Am Rand gezogen = neue Dauer, Anfang bleibt', writes[0]?.patch.duration_min === 150 && writes[0]?.patch.start_time === '08:00', writes[0]);

writes.length = 0;
notes.length = 0;
setSlot(fake as any, [park], place({ id: 'pX', name: 'Ganztags', time_slot: 'Ganzer Tag', start_time: null }) as any, { start: min('09:00') });
step('Ganztages-Ausflug lässt sich am Band nicht verbiegen', writes.length === 0 && /ganzer? Tag/.test(notes[0] || ''), notes[0]);

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen` : '\n🎉 Tageszeit-Rechnung passt');
if (errors.length) process.exit(1);
