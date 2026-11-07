import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Vier Blicke über den Quelltext: alte Restbestände, mobile Breite, Lesen und
 * Tippen, und die Wege, über die die App zu erreichen ist.
 */

const WURZEL = process.cwd();
const dateien: string[] = [];

function sammeln(ordner: string) {
  for (const name of readdirSync(join(WURZEL, ordner))) {
    const pfad = join(ordner, name);
    if (statSync(join(WURZEL, pfad)).isDirectory()) sammeln(pfad);
    else if (/\.(tsx?|css)$/.test(name)) dateien.push(pfad);
  }
}

sammeln('src');
const quelltext = (rel: string) => readFileSync(join(WURZEL, rel), 'utf8');
const text = (datei: string) => quelltext(datei);
const seiten = dateien.filter((d) => d.startsWith('src/app/') && /page\.tsx$/.test(d));
const texte = (liste: string[]) => liste.map((d) => ({ pfad: d, inhalt: text(d) }));

/* ── 1 · nichts Altes ─────────────────────────────────────────────────── */

const verboten = ['japan', 'urlaubsplaner', 'seed', 'etappe', 'koordinaten', 'timeslot', 'ticket_status', 'priorität'];
const reste: string[] = [];
for (const { pfad, inhalt } of texte(dateien)) {
  const kleine = inhalt.toLowerCase();
  for (const wort of verboten) {
    if (kleine.includes(wort)) reste.push(`${pfad}: ${wort}`);
  }
}
assert.deepEqual(reste, [], 'alte Restbestände sind rauszuwerfen');
for (const weg of ['data/seed.json', 'src/lib/seed.ts', 'src/lib/normalize.ts', 'src/lib/checks.ts', 'src/lib/dayplan.ts', 'src/components/PlaceCard.tsx', 'src/components/ActivityRow.tsx']) {
  assert.equal(existsSync(join(WURZEL, weg)), false, `${weg} gehört nicht mehr dazu`);
}

/* ── 2 · Breite ───────────────────────────────────────────────────────── */

const ueberlauf: string[] = [];
for (const { pfad, inhalt } of texte(dateien.filter((d) => d.endsWith('.tsx')))) {
  inhalt.split('\n').forEach((zeile, i) => {
    if (/overflow-x-(auto|scroll)/.test(zeile) && !/gelenk|rahmen-scroll/.test(zeile)) ueberlauf.push(`${pfad}:${i + 1} eigene Scrollfläche`);
    if (/\btruncate\b/.test(zeile) && !/min-w-0|max-w-|flex-1|\bblock\b|w-full|inset-x-0|<p |<h[1-3] /.test(zeile)) ueberlauf.push(`${pfad}:${i + 1} truncate ohne min-w-0`);
    const imFluss = zeile.replace(/\b(?:sm|md|lg|xl):w-\[\d+px\]/g, '');
    if (/\bw-\[\d{3,}px\]/.test(imFluss)) ueberlauf.push(`${pfad}:${i + 1} feste Breite über 99px`);
    if (/<(div|section|main|ul|table)[^>]*\bmin-w-\[2\d\dpx\]/.test(zeile)) ueberlauf.push(`${pfad}:${i + 1} Raster mit Mindestbreite`);
  });
}
assert.deepEqual(ueberlauf, [], 'nichts darf die Seite über das Gerät hinaus schieben');
assert.match(text('src/app/globals.css'), /html\s*\{[^}]*overflow-x:\s*clip/, 'die Seite bricht seitlich ab, ohne zu scrollen');
assert.match(text('src/app/globals.css'), /body\s*\{[^}]*overflow-x:\s*clip/);

/* ── 3 · Lesen und Tippen ─────────────────────────────────────────────── */

const css = text('src/app/globals.css');
const eng = texte(dateien.filter((d) => d.endsWith('.tsx') && !d.includes('druck')));
const klein: string[] = [];
for (const { pfad, inhalt } of eng) {
  inhalt.split('\n').forEach((zeile, i) => {
    const treffer = zeile.match(/text-\[(\d+(?:\.\d+)?)(px|rem)\]/g) ?? [];
    for (const fund of treffer) {
      const zahl = Number(/\[([\d.]+)(?:px|rem)\]/.exec(fund)?.[1] ?? '0');
      const px = fund.includes('rem') ? zahl * 16 : zahl;
      if (px < 13 && !zeile.includes('mikro')) klein.push(`${pfad}:${i + 1} ${fund}`);
    }
    if (/text-(slate|gray|zinc)-[456]00/.test(zeile)) klein.push(`${pfad}:${i + 1} Grauton am Rand`);
    if (/toLocaleDateString|toLocaleString\(\s*'de/.test(zeile)) klein.push(`${pfad}:${i + 1} Datum von Hand formatiert`);
    if (/new Date\(\)\.toISOString\(\)/.test(zeile)) klein.push(`${pfad}:${i + 1} Datum aus der Uhrzeit`);
  });
}
assert.deepEqual(klein, [], `Schrift mindestens 13px, Farben aus dem Designsystem, Datum aus dates.ts (sonst: ${klein.slice(0, 4).join(', ')})`);
assert.match(css, /@media \(hover: none\)[\s\S]*?min-height:\s*44px/, 'jedes Bedienfeld ist 44px hoch');
assert.match(css, /\.icon-knopf\s*\{[^}]*width:\s*44px/, 'die Zeichenfläche ist 44px breit');
const flaeche = css.match(/button,[\s\S]*?textarea\s*\{[^}]*\}/)?.[0] ?? '';
assert.ok(!/min-width/.test(flaeche), 'Breite 44px nur bei Zeichen-Knöpfen – sonst zerdrückt sie den Text daneben');
assert.match(css, /\.zeile\s*\{[^}]*flex-wrap:\s*wrap/, 'Zeilen umbrechen, Knöpfe rücken unter den Text');
assert.match(css, /\.zeile-bett\s*\{[^}]*box-shadow:\s*inset/, 'eine Unterkunft sieht man in jeder Liste als eigene Art');
assert.match(text('src/components/EintragZeile.tsx'), /istBett && 'zeile-bett'/, 'die Bett-Zeile trägt ihr Bild');
assert.match(css, /\.zeile > \.taten\s*\{[^}]*width:\s*100%/, 'die Aktionsgruppe steht auf dem Handy unter dem Text');
assert.match(css, /\.ablage\s*\{[^}]*max-height/, 'die Ablage kann nie höher sein als das Gerät');
assert.match(css, /--dock:\s*60px/, 'die Leiste unten hat eine feste Höhe');
assert.match(css, /env\(safe-area-inset-bottom/, 'und lässt den Rand des Handys frei');
assert.match(text('src/components/ui.tsx'), /createPortal\(/, 'Menü und Formular hängen am Blatt, nicht in der Zeile');
assert.ok(!/<IconKnopf[^>]*>[\s\S]{0,40}<Link/.test(eng.map((e) => e.inhalt).join('\n')), 'kein Link in einem Knopf');

/* ── 4 · Wege ─────────────────────────────────────────────────────────── */

const huelle = text('src/components/Huelle.tsx');
const kurz = [...huelle.matchAll(/kurz:\s*'([^']+)'/g)].map((m) => m[1]!);
assert.equal(kurz.length, 5, 'fünf Bereiche in der Leiste');
assert.ok(kurz.every((k) => k.length <= 10), `Kurze Namen für die Leiste (${kurz.join(', ')})`);
for (const weg of ['src/app/page.tsx', 'src/app/reisen/page.tsx', 'src/app/kalender/page.tsx', 'src/app/karte/page.tsx', 'src/app/profil/page.tsx', 'src/app/reisen/neu/page.tsx', 'src/app/t/[tripId]/layout.tsx']) {
  assert.ok(existsSync(join(WURZEL, weg)), `${weg} fehlt`);
}
const grund = 'src/app/t/[tripId]';
const blätter = [...text(`${grund}/layout.tsx`).matchAll(/id:\s*'([a-z]+)',\s*label:/g)].map((m) => m[1]!);
assert.ok(blätter.length >= 4, 'die Reise hat Blätter');
for (const b of blätter) {
  assert.ok(existsSync(join(WURZEL, `${grund}/${b}/page.tsx`)), `Blatt „${b}“ hat keine Seite`);
}
for (const { pfad, inhalt } of texte(seiten)) {
  assert.match(inhalt, /export default function/, `${pfad} zeigt nichts`);
  if (!inhalt.includes('use client') && !/redirect\(/.test(inhalt)) {
    assert.match(inhalt, /'use client'/, `${pfad} muss ein client-Blatt sein, sonst fehlt der Datenspeicher`);
  }
}
const bildzeilen: string[] = [];
for (const { pfad, inhalt } of eng) {
  inhalt.split('\n').forEach((zeile, i) => {
    if (/<img\s/.test(zeile)) {
      if (!/loading="lazy"/.test(zeile)) bildzeilen.push(`${pfad}:${i + 1} ohne lazy`);
      if (!/alt=/.test(zeile)) bildzeilen.push(`${pfad}:${i + 1} ohne alt`);
    }
    if (/https:\/\/(www\.)?(google\.com\/maps|maps\.google)/.test(zeile) && /key=/.test(zeile)) bildzeilen.push(`${pfad}:${i + 1} Kartenschlüssel im Code`);
  });
}
assert.deepEqual(bildzeilen, [], `Bilder tragen alt und lazy, die Karte braucht keinen Schlüssel (${bildzeilen.slice(0, 3).join(', ')})`);
const seitenTexte = texte(seiten.filter((s) => !s.includes('/api/')));
const technnik = seitenTexte.filter(({ inhalt }) => /NEXT_PUBLIC|supabase|anon-|anon key|Tabelle|SQL/i.test(inhalt)).map(({ pfad }) => pfad);
assert.deepEqual(technnik, [], 'auf den Seiten steht kein Technik-Kram, nur der Status');
assert.match(text('src/lib/anbieter.ts'), /AbortSignal\.timeout/, 'Suche und Bild haben eine Frist');
assert.match(text('src/app/api/orte/route.ts'), /dynamic = 'force-dynamic'/, 'die Suche wird nicht zwischengespeichert');

/* ── 5 · Felder und Spalten ───────────────────────────────────────────── */

function felder(schnittstelle: string, quelltextText: string): string[] {
  const start = quelltextText.indexOf(schnittstelle);
  const end = quelltextText.indexOf('\n}', start);
  const block = quelltextText.slice(start, end);
  return [...block.matchAll(/^\s{2}(\w+)(\??):/gm)].map((m) => m[1]!);
}
const typen = text('src/lib/types.ts');
const spalten = text('src/lib/supabase.ts');
const typZeilen = felder('export interface Reise', typen);
const spaltenText = spalten.slice(spalten.indexOf("  reisen: ["), spalten.indexOf("  eintraege: ["));
const fehlt = typZeilen.filter((f) => !spaltenText.includes(`'${f}'`));
assert.deepEqual(fehlt, [], `jedes Feld der Reise hat eine Spalte (es fehlt: ${fehlt.join(', ')})`);
const eintragZeilen = felder('export interface Eintrag', typen);
const eintragSpalten = spalten.slice(spalten.indexOf("  eintraege: ["), spalten.indexOf('};', spalten.indexOf("  eintraege: [")));
const fehlt2 = eintragZeilen.filter((f) => !eintragSpalten.includes(`'${f}'`));
assert.deepEqual(fehlt2, [], `jedes Feld des Eintrags hat eine Spalte (es fehlt: ${fehlt2.join(', ')})`);
const schema = text('supabase/schema.sql');
for (const feld of [...eintragZeilen, ...typZeilen]) {
  assert.match(schema, new RegExp(`\\b${feld}\\b`), `schema.sql kennt ${feld} nicht`);
}
const migration = text('supabase/migrations/20261107000000_reiseplan.sql');
assert.equal(migration.replace(/^\s*--.*$/gm, '').trim(), schema.replace(/^\s*--.*$/gm, '').trim(), 'schema.sql und die Migration sind dasselbe Blatt');

console.log(`🎉 Neues Fundament hält – ${dateien.length} Dateien (${dateien.reduce((s, d) => s + text(d).split('\n').length, 0)} Zeilen), ${seiten.length} Seiten, ${blätter.length} Reiseblätter, kein Rest von früher`);
