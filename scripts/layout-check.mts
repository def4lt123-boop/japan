/**
 * Rechenprobe für die Menü-Position: das Panel darf auf keinem Gerät über den
 * Rand laufen und muss nach oben aufgehen, wenn unter dem Knopf zu wenig Platz ist.
 * Aufruf: npx tsx scripts/layout-check.mts
 */
import assert from 'node:assert/strict';

type Rect = { top: number; bottom: number; left: number; right: number };

function placeMenu(btn: Rect, vw: number, vh: number, items: number, align: 'left' | 'right' = 'right') {
  const width = Math.min(268, vw - 16);
  const height = Math.min(44 + items * 44, vh * 0.72);
  const raw = align === 'left' ? btn.left : btn.right - width;
  const left = Math.max(8, Math.min(raw, vw - width - 8));
  const below = btn.bottom + 8;
  const top = below + height > vh - 8 ? Math.max(8, btn.top - height - 8) : below;
  return { top, left, width, height };
}

const cases: [string, number, number][] = [['Android klein', 360, 640], ['iPhone SE', 375, 667], ['iPhone Pro Max', 430, 932], ['Tablet hoch', 768, 1024], ['Desktop', 1440, 900]];
const buttons: [string, Rect][] = [
  ['Kopfzeile rechts', { top: 96, bottom: 130, left: 250, right: 342 }],
  ['Tab-Streifen', { top: 150, bottom: 176, left: 300, right: 372 }],
  ['ganz unten auf der Seite', { top: 600, bottom: 634, left: 120, right: 212 }],
  ['randnah links', { top: 40, bottom: 74, left: 2, right: 90 }],
];

let checks = 0;
for (const [device, vw, vh] of cases) {
  for (const [where, btn] of buttons) {
    for (const n of [4, 5, 9]) {
      const p = placeMenu(btn, vw, vh, n);
      assert.ok(p.left >= 8 - 0.01, `${device} · ${where}: Panel läuft links über (${p.left})`);
      assert.ok(p.left + p.width <= vw - 8 + 0.01, `${device} · ${where}: Panel läuft rechts über (${p.left + p.width} > ${vw - 8})`);
      assert.ok(p.top >= 0, `${device} · ${where}: Panel über dem Rand (${p.top})`);
      assert.ok(p.top + p.height <= vh + 0.01, `${device} · ${where}: Panel unter dem Rand (${p.top + p.height} > ${vh})`);
      checks += 1;
    }
  }
}

// wenig Platz unter dem Knopf → Menü öffnet sich nach oben
const low = placeMenu({ top: 520, bottom: 552, left: 250, right: 342 }, 375, 667, 5);
assert.ok(low.top < 520, 'Menü müsste nach oben aufgehen');
// viel Platz → öffnet nach unten
const high = placeMenu({ top: 90, bottom: 122, left: 250, right: 342 }, 1280, 900, 4);
assert.ok(high.top > 122, 'Menü müsste nach unten aufgehen');

console.log(`🎉 Menü-Position passt – ${checks} Kombinationen aus Gerät, Knopf und Menülänge ( Handy ↔ Desktop )`);
