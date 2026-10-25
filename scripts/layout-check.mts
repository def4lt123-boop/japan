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

/* ── 2 · untere Reiterleiste: jeder Reiter muss in eine Zeile passen ──────
   jsdom kann kein Layout, also wird hier gerechnet: die Leiste ist ein Raster aus
   gleich breiten, schrumpfbaren Spalten. Was nicht passt, fällt raus – deshalb wird
   für jedes Gerät und jede Reiterzahl nachgemessen. Die Zahlen sind dieselben wie in
   `.tabbar` (src/app/globals.css). */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelltext = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

const LEISTE = {
  rand: 3, // padding der Leiste oben/unten
  flaeche: 44, // ein Reiter ist eine Tippfläche – darunter geht auf dem Handy nichts an
  spalt: 2, // Abstand zwischen zwei Reitern
  polster: 1, // waagrechtes Innenpolster eines Reiters
  polsterH: 4 + 3, // senkrechtes Innenpolster
  zeilenabstand: 1,
  icon: 17,
  iconHoehe: 1.1,
  schrift: 9.5,
  zeile: 1.15,
  zeichen: 0.56, // durchschnittliche Breite eines Zeichens bei dieser Schriftgröße
};

const layoutSrc = quelltext('src/app/t/[tripId]/layout.tsx');
const tabsSrc = quelltext('src/app/t/[tripId]/tabs.tsx');
const css = quelltext('src/app/globals.css');

const reiter = [...layoutSrc.matchAll(/\{\s*href:\s*'\/[a-z]+',\s*label:\s*'([^']+)',\s*short:\s*'([^']+)',\s*icon:/g)].map((m) => ({ label: m[1], short: m[2] }));
assert.ok(reiter.length >= 6, `erwartet mindestens 6 Reiter (fünf zu planen + unterwegs), gefunden: ${reiter.length}`);
assert.ok(
  reiter.every((r) => r.short.length <= r.label.length),
  `ein kurzes Label muss kürzer sein als der volle Name: ${reiter.map((r) => `${r.short}/${r.label}`).join(', ')}`,
);
const kurzs = reiter.map((r) => r.short);

const hoehe = Math.max(
  LEISTE.rand * 2 + LEISTE.polsterH + LEISTE.icon * LEISTE.iconHoehe + LEISTE.zeilenabstand + LEISTE.schrift * LEISTE.zeile,
  LEISTE.rand * 2 + LEISTE.flaeche,
);
assert.ok(hoehe <= 50, `die Leiste ist ${hoehe.toFixed(1)}px hoch, reserviert sind 50px – Menü und «als nächstes» rutschen drunter`);
assert.ok(/--dock:\s*calc\(50px/.test(css), 'was die Leiste braucht, muss sie auch freihalten (--dock 50px)');
assert.ok(/\.tabbar > a\s*\{[^}]*min-height:\s*44px/.test(css), 'ein Reiter der unteren Leiste ist eine 44er-Fläche');

const gerate: [string, number][] = [
  ['kleines Android', 320],
  ['Android', 360],
  ['iPhone SE', 375],
  ['iPhone 14', 390],
  ['iPhone Max', 430],
];
let leser = 0;
let engsteSpalte = Infinity;
let engstesGerat = '';
let breitestesWort = '';
let breitestesZeile = 0;
for (const [gerat, vw] of gerate) {
  for (const anzahl of [5, 6]) {
    const spalte = (vw - LEISTE.rand * 2 - (anzahl - 1) * LEISTE.spalt) / anzahl;
    const platz = spalte - LEISTE.polster * 2;
    for (const k of kurzs) {
      const braucht = k.length * LEISTE.schrift * LEISTE.zeichen;
      assert.ok(
        braucht <= platz,
        `${gerat} · ${anzahl} Reiter: „${k}" braucht ${braucht.toFixed(1)}px, die Spalte ist nur ${platz.toFixed(1)}px – ein Reiter fällt aus der Leiste`,
      );
      leser += 1;
      if (platz < engsteSpalte) {
        engsteSpalte = platz;
        engstesGerat = `${gerat} · ${anzahl} Reiter`;
      }
      if (braucht > breitestesZeile) {
        breitestesZeile = braucht;
        breitestesWort = k;
      }
    }
  }
}
console.log(`🎉 Reiterleiste – ${leser} Kurzlabels passen, engste Spalte ${engsteSpalte.toFixed(1)}px (${engstesGerat}), längstes Wort „${breitestesWort}" ${breitestesZeile.toFixed(1)}px`);

// die Leiste muss unten feststehen, gleiche Spalten haben und auf dem Desktop wieder oben liegen
assert.ok(/\.tabbar\s*\{[^}]*position:\s*fixed/.test(css), '.tabbar muss auf dem Handy unten feststehen');
assert.ok(/grid-auto-columns:\s*minmax\(0,\s*1fr\)/.test(css), 'gleiche, schrumpfbare Spalten – sonst schiebt ein Reiter den nächsten raus');
assert.ok(/\.tabbar > a\s*\{[^}]*white-space:\s*normal/.test(css), 'Reiterbeschriftung muss umbrechen können');
assert.ok(/@media \(min-width: 768px\)[\s\S]*?\.tabbar\s*\{[^}]*position:\s*static/.test(css), 'ab Tabletgröße gehört die Leiste wieder nach oben');
assert.ok(/\.pb-tabbar\s*\{[^}]*env\(safe-area-inset-bottom/.test(css), 'der Inhalt muss die Sicherheitszone unter der Leiste freihalten');
assert.ok(/\.menu-sheet\s*\{[^}]*bottom:\s*calc\([^)]*var\(--dock/.test(css), 'das Menü muss über der Leiste aufgehen, nie dahinter');
assert.ok(/\.sticky-next\s*\{[^}]*bottom:\s*var\(--dock/.test(css), 'die «als nächstes»-Leiste darf nicht unter der Reiterleiste liegen');
assert.ok(/data-tabbar=\{tabs\.length\}/.test(layoutSrc), 'die Leiste muss ihre Reiterzahl mitteilen');
assert.ok(/className="pb-tabbar"/.test(layoutSrc), 'den Inhalt unter der Leiste muss man erreichen können');
assert.ok(tabsSrc.includes('tab-label-short') && tabsSrc.includes('tab-label-full'), 'Reiter brauchen kurzes (Handy) und volles (Desktop) Label');
assert.ok(/\.tabbar > a > \[aria-hidden\]\s*\{[^}]*font-size:\s*17px/.test(css), 'auf der unteren Leiste gehört das Icon über das Wort');

/* ── 3 · Quellenprüfung: die Muster, die seitlich rausgewachsen sind ──────
   Kein Browser hier, also wird der Quelltext selbst gelesen. Die drei Muster sind
   die, die auf dem Handy wirklich über den Rand gewachsen sind. */
function quellen(ordner: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(path.join(ROOT, ordner), { withFileTypes: true })) {
    const rel = `${ordner}/${eintrag.name}`;
    if (eintrag.isDirectory()) out.push(...quellen(rel));
    else if (/\.(tsx|ts)$/.test(eintrag.name)) out.push(rel);
  }
  return out.sort();
}

const dateien = quellen('src');
let geprüfteZeilen = 0;
const ohneBasisSpalte: string[] = [];
const tabelleOhneRahmen: string[] = [];
const abgschnitten: string[] = [];
const doppelt: string[] = [];

for (const rel of dateien) {
  const zeilen = quelltext(rel).split('\n');
  geprüfteZeilen += zeilen.length;
  zeilen.forEach((zeile, i) => {
    // ein Raster, das seine Spalten erst ab dem Breakpoint setzt, lässt darunter eine
    // implizite Auto-Spalte stehen – die wächst mit dem Inhalt über den Bildschirm
    if (/(className=)(["'`])[^"'`]*(\s|^)grid(\s|$)/.test(zeile) && /(sm|md|lg|xl|2xl):grid-cols-/.test(zeile) && !/(\s|["'`])grid-cols-/.test(zeile)) {
      ohneBasisSpalte.push(`${rel}:${i + 1}`);
    }
    // Tabellen mit nowrap-Zellen brauchen einen eigenen Scrollrahmen, sonst schieben
    // sie die ganze Seite seitlich weg (auf dem Handy ist der Rahmen zu)
    if (zeile.includes('<table') && !zeilen.slice(Math.max(0, i - 8), i).join(' ').includes('overflow-x-auto')) {
      tabelleOhneRahmen.push(`${rel}:${i + 1}`);
    }
    // abgeschnittener Text braucht einen schrumpfbaren Eltern- oder sich selbst –
    // ohne min-w-0 schiebt er den Nachbar-Knopf aus dem Bild
    if (/className=\{?[cx]*\(?["'`][^"'`]*\btruncate\b/.test(zeile)) {
      const umgebung = [zeile, ...zeilen.slice(Math.max(0, i - 4), i)];
      if (!umgebung.some((z) => /min-w-0|max-w-|w-\[\d+px\]|overflow-hidden|grid-cols-\[|minmax\(0/.test(z))) abgschnitten.push(`${rel}:${i + 1}`);
    }
    // "{x.length} … {plural(x.length, …)" schreibt dieselbe Zahl zweimal hin
    const d = /\{([^{}]+)\} \{plural\(([^,]+),/.exec(zeile);
    if (d && d[1].trim() === d[2].trim()) doppelt.push(`${rel}:${i + 1} „${d[1].trim()}"`);
  });
}

assert.ok(!ohneBasisSpalte.length, `Raster ohne Spaltenvorgabe für das Handy (wächst seitlich raus): ${ohneBasisSpalte.join(', ')}`);
assert.ok(!tabelleOhneRahmen.length, `Tabelle ohne Scrollrahmen (schiebt die Seite seitlich weg): ${tabelleOhneRahmen.join(', ')}`);
assert.ok(!abgschnitten.length, `abgeschnittener Text ohne min-w-0 (drückt den Nachbar-Knopf aus dem Bild): ${abgschnitten.join(', ')}`);
assert.ok(!doppelt.length, `dieselbe Zahl zweimal im Satz: ${doppelt.join(', ')}`);
console.log(
  `🎉 Bildschirmbreite hält – ${dateien.length} Dateien (${geprüfteZeilen} Zeilen): jedes Raster mit Basis-Spalte, jede Tabelle im Scrollrahmen, kein abgeschnittener Text ohne min-w-0, keine Zahl doppelt`,
);

/* ── 4 · Schrift, Kontrast, Tippflächen ─────────────────────────────
   Der Testdom rechnet nicht: zu kleine Schrift, zu grauer Text und zu kleine
   Knöpfe fallen erst auf, wenn jemand auf dem echten Gerät liest oder tippt. */
const DRUCKSEITE = 'src/app/t/[tripId]/druck/page.tsx'; // Papier ist davon ausgenommen
const zuKlein: string[] = [];
const zuGrau: string[] = [];
const datumEigen: string[] = [];
const stufeEigen: string[] = [];
const eingerueckt: string[] = [];
let unter13 = 0;
for (const rel of dateien) {
  const zeilen = quelltext(rel).split('\n');
  zeilen.forEach((zeile, i) => {
    if (rel !== DRUCKSEITE) {
      // was auf dem Schirm steht, ist mindestens 13px – winzige Schrift in Grafiken
      // (Hitzefeld, Nacht-Streifen, Kalender, Kartenrand) trägt `mikro` und ist damit gemeldet
      const klein = /text-!?\[(\d+(?:\.\d+)?)px\]/.exec(zeile);
      if (klein && Number(klein[1]) < 13) {
        if (zeile.includes('mikro')) unter13 += 1;
        else zuKlein.push(`${rel}:${i + 1} ${klein[0]}`);
      }
      // Listen in einer Karte mit Kopf dürfen nicht seitlich einrücken: Kopf (px-3) und Zeile
      // müssen am selben Rand stehen, sonst steht die Liste im Treppenabsatz
      if (/className="space-y-[\d.]+ p-2(?:\.5)?"/.test(zeile)) eingerueckt.push(`${rel}:${i + 1}`);

      // Grautext über der dunklen Karte: slate-400 sind 7:1, slate-500 nur 3,8:1 – das zweite ist zu wenig
      if (/text-slate-[5-9]00\b/.test(zeile) && !/print:text-slate-[3-4]00/.test(zeile)) zuGrau.push(`${rel}:${i + 1} ${/text-slate-\d00/.exec(zeile)?.[0]}`);
    }
    if (rel !== 'src/lib/format.ts') {
      // ein Datum in einer Liste kommt aus fmtDay – Intl setzt sonst „Sa., 06.03.“
      if (/weekday:\s*'short'/.test(zeile) && /day:\s*'2-digit'/.test(zeile) && /month:\s*'2-digit'/.test(zeile) && !/year:/.test(zeile)) datumEigen.push(`${rel}:${i + 1}`);
      // die drei Stufen stehen nur in PRIORITY_META, sonst schreibt sie jeder anders
      if (rel !== 'src/lib/categories.ts' && /[★☆·]\s*(Muss|Soll|Kann)/.test(zeile) && !/priorityLabel|PRIORITY_META/.test(zeile)) stufeEigen.push(`${rel}:${i + 1} „${/[★☆·]\s*(Muss|Soll|Kann)/.exec(zeile)?.[0]}“`);
    }
  });
}
assert.ok(!zuKlein.length, `Schrift unter 13px ohne „mikro“: ${zuKlein.slice(0, 6).join(', ')}`);
assert.ok(!zuGrau.length, `Grautext unter 4,5:1 Kontrast (slate-500 und dunkler): ${zuGrau.slice(0, 6).join(', ')}`);
assert.ok(!datumEigen.length, `Kurzdatum von Hand gebaut statt fmtDay: ${datumEigen.join(', ')}`);
assert.ok(!stufeEigen.length, `Priorität von Hand geschrieben: ${stufeEigen.join(', ')}`);
assert.ok(!eingerueckt.length, `Liste rückt gegenüber dem Kopf ein (gleicher Rand statt eigener Einrückung): ${eingerueckt.join(', ')}`);
// eine Zeile, neben deren Text sechs 44er-Knöpfe stehen, verliert bei 320px jede Breite:
// 6 × 44 + Greifpunkt + Nummer + Punkt sind die Zeile – also muss die Gruppe darunter
assert.ok(/no-print flex w-full[^\n]*md:w-auto/.test(quelltext('src/components/PlaceCard.tsx')), 'die Aktionsgruppe einer Aktivitätszeile muss auf dem Handy unter den Text rücken – sonst bleibt vom Namen nichts übrig');
assert.ok(/@media \(hover: none\)[\s\S]*?\.icon-btn,[\s\S]*?min-width:\s*44px/.test(css), '44px Breite gilt den Flächen, die nur ein Zeichen tragen');
const flechenBlock = css.match(/button,\s*\n\s*\.btn,[\s\S]*?textarea\s*\{[^}]*\}/);
assert.ok(flechenBlock && !/min-width/.test(flechenBlock[0]), 'die Mindestbreite steht nur bei den Zeichen-Knöpfen – pauschal quetscht sie Liste und Chips zusammen');
// …und was die Quelle nicht zeigen kann: die Regeln in der CSS
assert.ok(/@media \(hover: none\)[\s\S]*?button,[\s\S]*?min-height:\s*44px/.test(css), 'auf dem Handy muss jede Tippfläche 44px hoch sein');
assert.ok(/@media \(hover: none\)[\s\S]*?\.icon-btn\s*\{[^}]*width:\s*44px/.test(css), 'auch die kleinen Knöpfe in einer Zeile sind 44px breit');
assert.ok(/@media \(hover: none\)[\s\S]*?\.grip\s*\{[^}]*height:\s*44px/.test(css), 'der Greifpunkt zum Ziehen ist eine 44er-Fläche');
assert.ok(/\.prio\s*\{[^}]*text-\[13px\]/.test(css), 'das Stufen-Etikett hat überall dieselbe Größe');
assert.ok(/\.label\s*\{[^}]*text-\[13px\]/.test(css) && /\.chip\s*\{[^}]*text-\[13px\]/.test(css), 'Formularbeschriftung und Chips sind mindestens 13px');
assert.ok(!/\.label\s*\{[^}]*text-slate-[5-9]00/.test(css), 'Beschriftungen bleiben hell genug');
console.log(
  `🎉 Lesen und Tippen hält – ${unter13} gemeldete Mikro-Ausnahmen in Grafiken, sonst nichts unter 13px, kein Grautext unter 4,5:1, Kurzdatum und Priorität aus einer Hand, Kopf und Liste am selben Rand, 44×44 auf Touch`,
);