/**
 * Rechenprobe für den Tag als nummerierte Liste: anhängen, einfügen, umhängen, Duplikate.
 * Aufruf: npm run test:dayplan
 */
import { assign, byOrder, dayPlaces, duplicateOnDay, moveToIndex, numbered, shiftWithin } from '../src/lib/dayplan.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

const D = '2027-03-08';
const place = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    trip_id: 't',
    name: 'Nara Park',
    city: 'Nara',
    date: D,
    end_date: null,
    sort_order: 0,
    booking_status: 'offen',
    priority: 'soll',
    ...over,
  }) as any;

/** Fake-Store: notiert jeden Schreibvorgang und jede Meldung */
function fake() {
  const writes: { id: string; patch: any }[] = [];
  const notes: string[] = [];
  const store = { patch: async (_t: 'places', id: string, patch: any) => void writes.push({ id, patch }), say: (m: string) => void notes.push(m) } as any;
  return { store, writes, notes };
}

// ── Reihefolge ───────────────────────────────────────────────────────────────
const a = place({ id: 'a', name: 'A', sort_order: 0 });
const b = place({ id: 'b', name: 'B', sort_order: 1 });
const c = place({ id: 'c', name: 'C', sort_order: 2 });
const outside = place({ id: 'x', name: 'X', date: null });
const day = [c, a, b, outside];

step('sort_order entscheidet, nicht das Anlege-Datum', dayPlaces(day, D).map((p) => p.id).join() === 'a,b,c', dayPlaces(day, D).map((p) => p.id));
step('Punkte ohne Tag gehören zu keinem Tag', dayPlaces(day, null).length === 0);
step('bei gleichem Stand hilft der Name', [place({ id: 'z', name: 'Zoo', sort_order: 3 }), place({ id: 'af', name: 'Affe', sort_order: 3 })].sort(byOrder)[0].name === 'Affe');
step('nummern sind 1 · 2 · 3', numbered(dayPlaces(day, D)).join(' / ') === '1 · A / 2 · B / 3 · C', numbered(dayPlaces(day, D)));

// ── Duplikate ────────────────────────────────────────────────────────────────
step('gleicher Name am selben Tag = Duplikat', duplicateOnDay([a, place({ id: 'dup', name: 'a' })], a, D).length === 1);
step('… auch mit andern Leerzeichen', duplicateOnDay([a, place({ id: 'dup', name: '  N A R A   P A R K ' })], place({ id: 'n', name: 'Nara Park' }), D).length === 1);
step('gleicher Name am anderen Tag ist ok', duplicateOnDay([a, place({ id: 'dup', name: 'A', date: '2027-03-09' })], a, D).length === 0);
step('ohne Tag wird nichts verglichen', duplicateOnDay([a, place({ id: 'dup', name: 'A', date: null })], place({ id: 'dup', name: 'A', date: null }), null).length === 0);

// ── Anhängen ─────────────────────────────────────────────────────────────────
{
  const { store, writes, notes } = fake();
  const all = [a, b];
  const neu = place({ id: 'n', name: 'Kasuga Taisha', date: null, sort_order: 0 });
  const okRun = assign(store, all, neu, { date: D });
  step('anhängen klappt', okRun === true);
  step('der Neue bekommt den Tag', writes[0]?.patch.date === D, writes[0]);
  step('… und die letzte Stelle', writes.some((w) => w.id === 'n' && w.patch.sort_order === 2), writes);
  step('alte Punkte bleiben stehen', !writes.some((w) => w.id === 'a' || w.id === 'b'), writes);
  step('die Meldung zählt die Liste', /Stelle 3 von 3/.test(notes[0]), notes[0]);
}

// ── Einsetzen vor einem Punkt ────────────────────────────────────────────────
{
  const { store, writes, notes } = fake();
  assign(store, [a, b], place({ id: 'n', name: 'Neu', date: null, sort_order: 5 }), { date: D, before: 'b' });
  const order = new Map<string, number>();
  for (const w of writes) if (typeof w.patch.sort_order === 'number') order.set(w.id, w.patch.sort_order);
  step('Neuer rutscht vor B', order.get('n') === 1, [...order]);
  step('B rückt auf die letzte Stelle', order.get('b') === 2, [...order]);
  step('A bleibt auf Stelle 1', !order.has('a'), [...order]);
  step('Meldung nennt die neue Stelle', /Stelle 2 von 3/.test(notes[0]), notes[0]);
}

// ── Abweisen ─────────────────────────────────────────────────────────────────
{
  const { store, writes, notes } = fake();
  const refused = assign(store, [a], place({ id: 'n', name: 'a ', date: null }), { date: D });
  step('zweimal derselbe Punkt am selben Tag geht nicht', refused === false && writes.length === 0, notes[0]);
  step('die Meldung sagt, was zu tun ist', /Duplikat/.test(notes[0]) && /umbenennen/i.test(notes[0]), notes[0]);
}
{
  const { store, writes } = fake();
  assign(store, [a], a, { date: null });
  step('vom Tag lösen geht immer', writes.length === 1 && writes[0].id === 'a' && writes[0].patch.date === null, writes[0]);
}

// ── ▲▼ ──────────────────────────────────────────────────────────────────────
{
  const { store, writes, notes } = fake();
  const okRun = shiftWithin(store, [a, b, c], b, -1);
  step('hoch rücken schreibt die Reihenfolge neu', okRun === true, writes.map((w) => `${w.id}:${w.patch.sort_order}`));
  const order = new Map(writes.map((w) => [w.id, w.patch.sort_order]));
  step('B wird Stelle 1', order.get('b') === 0, [...order]);
  step('A weicht auf Stelle 2', order.get('a') === 1, [...order]);
  step('C bleibt unangetastet', !order.has('c'), [...order]);
  step('Meldung zählt weiter', /Stelle 1 von 3/.test(notes[0]), notes[0]);
}
{
  const { store, writes, notes } = fake();
  step('der erste Punkt kann nicht weiter hoch', shiftWithin(store, [a, b, c], a, -1) === false && writes.length === 0);
  step('… und die Meldung erklärt es', /erste des Tages/.test(notes[0]), notes[0]);
  step('der letzte kann nicht weiter runter', shiftWithin(store, [a, b, c], c, 1) === false && writes.length === 0);
  step('Punkt ohne Tag hat keine Treppe', shiftWithin(store, [a, b, c], outside, -1) === false, notes.length);
}

// ── Ziehen auf eine Zeile ────────────────────────────────────────────────────
{
  const { store, writes, notes } = fake();
  moveToIndex(store, [a, b, c], 'a', D, 2);
  const order = new Map(writes.map((w) => [w.id, w.patch.sort_order]));
  step('A ans Ende der Liste gezogen', order.get('a') === 2, [...order]);
  step('B und C rücken nach vorne', order.get('b') === 0 && order.get('c') === 1, [...order]);
  step('Meldung nennt Stelle 3', /Stelle 3 von 3/.test(notes[0]), notes[0]);
}
{
  const { store, writes } = fake();
  step('Zielindex wird gequetscht, nicht erfunden', moveToIndex(store, [a, b, c], 'a', D, 99) === true && writes.every((w) => (w.patch.sort_order ?? 0) <= 2), writes.map((w) => `${w.id}:${w.patch.sort_order}`));
  const vorher = writes.length;
  step('Punkt von einem anderen Tag wird ignoriert', moveToIndex(store, [a, b, c, outside], 'x', D, 1) === false && writes.length === vorher);
}

// ── Umhängen auf einen anderen Tag ───────────────────────────────────────────
{
  const { store, writes } = fake();
  const to = '2027-03-09';
  assign(store, [a, place({ id: 'k', name: 'K', date: to, sort_order: 0 })], a, { date: to });
  const order = new Map(writes.map((w) => [w.id, w.patch.sort_order]));
  step('umhängen setzt den neuen Tag', writes[0]?.patch.date === to, writes[0]);
  step('… und klebt ans Ende', order.get('a') === 1, [...order]);
  step('der alte Tag behält seine Nummerierung', !order.has('k'), [...order]);
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen` : '\n🎉 Liste, Reihenfolge und Duplikate passen');
if (errors.length) process.exit(1);
