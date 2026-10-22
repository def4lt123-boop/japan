/**
 * Probe für die Kategorien: fester Katalog, Raten aus Name und Notiz, und was die
 * Massen-Aktion „alle kategorisieren“ überhaupt anfasst.
 * Aufruf: npm run test:category
 */
import { CATEGORY_LABELS, categorizePlan, categoryMeta, categoryOptions, guessCategory, needsCategory } from '../src/lib/categories.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

// ── Katalog ─────────────────────────────────────────────────────────────────
// Invariante: jede Kategorie im Dropdown muss von ihrer eigenen Regel wiedererkannt werden,
// sonst gilt sie fälschlich als „ohne Kategorie" und die Massen-Aktion räumt sie wieder um.
const blind = CATEGORY_LABELS.filter((label) => needsCategory({ category: label }));
step('Jede Kategorie im Dropdown erkennt sich selbst', blind.length === 0, blind);
const metaFalsch = CATEGORY_LABELS.filter((label) => categoryMeta(label).label !== label);
step('Keine Kategorie läuft in eine andere Farbe', metaFalsch.length === 0, metaFalsch);

step('Jede feste Kategorie findet ihr Symbol und ihre Farbe', CATEGORY_LABELS.every((label) => categoryMeta(label).label === label), CATEGORY_LABELS.filter((l) => categoryMeta(l).label !== l));
step('Dropdown-Liste beginnt mit den festen Kategorien', categoryOptions([]).slice(0, 3).map((o) => o.value).join(', ') === CATEGORY_LABELS.slice(0, 3).join(', '), categoryOptions([]).slice(0, 3));
step('Eigene Schreibweisen aus der Reise bleiben wählbar', categoryOptions(['Ramen Restaurant', 'Onsen', null, 'Tempel']).some((o) => o.value === 'Ramen Restaurant'), categoryOptions(['Ramen Restaurant', 'Onsen', null, 'Tempel']).map((o) => o.value));

// ── Raten ───────────────────────────────────────────────────────────────────
type Case = { name: string; category?: string | null; notes?: string | null; want: string | null };
const cases: Case[] = [
  { name: 'Asakusa Shrine + Sensō-ji', category: 'Sehenswürdigkeit', want: 'Tempel & Schrein' },
  { name: 'Namba Yasaka-Schrein', category: 'Fotospot (Riesen-Löwenkopf)', want: 'Tempel & Schrein' },
  { name: 'glänta Kyoto Ninenzaka (Custom Ring Shop)', category: 'Ringe selber machen', want: 'Shoppen' },
  { name: 'Hachiman-bori Kanal (Nagahama)', category: 'Wasserkanäle im Altstadtdorf', want: 'Stadtteile & Nachtleben' },
  { name: 'Ninenzaka & Sannenzaka', category: 'Altjapanische Gasse', want: 'Stadtteile & Nachtleben' },
  { name: 'Shinsekai', category: 'Old Town', want: 'Stadtteile & Nachtleben' },
  { name: 'Tottori-Sanddünen', category: 'Wüste / Dünen', want: 'Ausflüge & Natur' },
  { name: 'Shinjuku Loft', category: 'Gemischtwarenladen', want: 'Shoppen' },
  { name: 'Suica Card am Flughafen holen', category: 'Organisation', want: 'Organisation' },
  { name: 'Kinkaku-ji', want: 'Tempel & Schrein' },
  { name: 'Nishiki Market', want: 'Essen & Cafés' },
  { name: 'Arashiyama Bambuswald', want: 'Parks & Gärten' },
  { name: 'Osaka Kaiyukan', want: 'Museum & Aussicht' },
  { name: 'Dōtonbori bei Nacht', want: 'Stadtteile & Nachtleben' },
  { name: 'Miyajima-Fähre', want: 'Transport' },
  { name: 'Nara Park', want: 'Parks & Gärten' },
  { name: 'Hirschpark Nara', notes: 'Drei Hirsche, Tempelweg', want: 'Parks & Gärten' },
  { name: 'Berg Rokkō', want: 'Ausflüge & Natur' },
  { name: 'Mont Fuji', notes: 'Klar sehen wir den Berg gar nicht', want: 'Ausflüge & Natur' },
  { name: 'irgendwas', notes: 'ohne Hinweis', want: null },
  { name: 'Hotel Nakamura', category: 'Unterkunft', want: 'Unterkunft' },
  { name: 'Onsen im Bürgerbad', want: 'Onsen & Bad' },
  { name: 'Okinawa Beach', category: 'Meer', want: 'Meer & Insel' },
];
for (const c of cases) {
  const got = guessCategory({ name: c.name, category: c.category ?? null, notes: c.notes ?? null });
  step(`${c.name}${c.category ? ` (${c.category})` : ''} → ${c.want ?? 'nichts'}`, got === c.want, got);
}

// ── Was die Massen-Aktion anfasst ─────────────────────────────────────────────
step('Leer braucht eine Kategorie', needsCategory({ category: null }) === true);
step('Fremder Freitext braucht eine', needsCategory({ category: 'Wüste / Dünen' }) === true);
step('Bekannte Kategorie bleibt unangetastet', needsCategory({ category: 'Ramen Restaurant' }) === false);
step('Feste Kategorie bleibt unangetastet', needsCategory({ category: 'Onsen & Bad' }) === false);

const plan = categorizePlan([
  { id: 'a', name: 'Tottori-Sanddünen', category: 'Wüste / Dünen' },
  { id: 'b', name: 'Kinkaku-ji', category: 'Tempel' },
  { id: 'c', name: 'irgendwas', category: null },
]);
step('Plan enthält nur die Treffer', JSON.stringify(plan.map((x) => `${x.id}:${x.category}`)) === JSON.stringify(['a:Ausflüge & Natur']), plan);

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen` : '\n🎉 Kategorien passen');
if (errors.length) process.exit(1);
