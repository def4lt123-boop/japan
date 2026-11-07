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
assert.match(css, /\.zeile-bett::after\s*\{[^}]*box-shadow:\s*inset/, 'eine Unterkunft sieht man in jeder Liste als eigene Art');
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

/* ── 6 · Status der Datenhaltung ─────────────────────────────────────── */

const status = text('src/components/StatusAnzeige.tsx');
assert.match(status, /verbunden: 'Datenbank verbunden'/, 'der Erfolgssatz heißt genau „Datenbank verbunden“');
assert.match(status, /if \(!text\) return null/, 'beim Prüfen wird nichts behauptet');
assert.ok(!/SUPABASE_URL|process\.env|apikey/i.test(status), 'der Status nennt keine Umgebungswerte');
assert.ok(!/URL|SCHLUESSEL|fetch\(/.test(status), 'gefragt wird im Speicherblatt, nicht im Streifen');
const pruefer = text('src/app/api/status/route.ts');
assert.match(pruefer, /AbortSignal\.timeout/, 'die Nachfrage hat eine Frist');
assert.match(pruefer, /rest\/v1\/reisen/, 'geprüft wird eine echte Abfrage, nicht nur eine Umgebung');
assert.match(pruefer, /cache: 'no-store'/, 'der Status wird nicht zwischengespeichert');
const stores = text('src/lib/daten.tsx');
assert.match(stores, /window\.addEventListener\('focus'/, 'wer zurückkommt, sieht einen frischen Status');
assert.match(text('src/components/Huelle.tsx'), /<StatusAnzeige variant="zeile" pruefen \/>/, 'auf dem Rechner steht der Status in der Spalte');
assert.match(text('src/app/profil/page.tsx'), /<StatusAnzeige pruefen \/>/, 'auf dem Handy steht er im Profil');

/* ── 7 · Listen und Zustände, die dieselben bleiben ───────────────────── */

assert.match(stores, /const eintraegeVon = useCallback\(/, 'die Einträge einer Reise kommen aus einem gemerkten Index');
assert.match(stores, /eintraegeVon = useCallback\(\(reiseId: string\) => nachReise\.get\(reiseId\) \?\? OHNE_EINTRAEGE/, 'die Liste kommt aus dem gemerkten Index, nicht aus einem Filter');
assert.ok(!/eintraegeVon: \(reiseId\) =>/.test(stores), 'der Speicher darf bei jedem Aufruf keine neue Liste bauen');
assert.match(stores, /\[bereit, eintraege, eintraegeVon,/, 'der Index hängt an den gemerkten Werten');
assert.match(stores, /\?\? OHNE_EINTRAEGE/, 'ohne Treffer gilt dieselbe leere Liste');
const eintragFormat = text('src/lib/format.ts');
assert.match(eintragFormat, /export function wieVorher</, 'der gleiche Stand behält seinen Zeiger');
for (const [blatt, setter] of [
  ['src/app/t/[tripId]/tag/[datum]/page.tsx', 'setRouten'],
  ['src/app/t/[tripId]/karte/page.tsx', 'setRoute'],
] as [string, string][]) {
  const inhalt = text(blatt);
  assert.ok(!inhalt.includes(`${setter}({})`), `${blatt}: ein leerer Stand wird nicht blind gesetzt`);
  assert.ok(!inhalt.includes(`${setter}(null)`), `${blatt}: dasselbe gilt für das Wegnehmen`);
}
const ablage = text('src/components/ui.tsx');
assert.match(ablage, /\[offen, fokus\]\);/, 'Sperre und Fokus der Ablage hängen am Öffnen, nicht am Schließen');

/* ── 8 · der Neuaufbau des Speichers ───────────────────────────────────── */

const neu = text('supabase/neu-aufbau.sql');
const spaltentext = text('src/lib/supabase.ts');
const anzahl = (tabelle: string) => {
  const anfang = spaltentext.indexOf(`${tabelle}: [`);
  assert.ok(anfang >= 0, `SPALTEN.${tabelle} ist zu finden`);
  const ende = spaltentext.indexOf(']', anfang);
  return (spaltentext.slice(anfang, ende).match(/'[a-z_]+'/g) ?? []).length;
};
const glatt = neu.replace(/\s+/g, ' ');
for (const [tabelle, spalten] of [['reisen', anzahl('reisen')], ['eintraege', anzahl('eintraege')]] as [string, number][]) {
  assert.ok(glatt.includes(`and table_name = '${tabelle}'; if n <> ${spalten} then`), `der Neuaufbau zählt ${spalten} Spalten in ${tabelle}, weil die App ${spalten} schreibt`);
}
assert.ok(!/NEXT_PUBLIC|anon key|service_role.*session/i.test(neu.replace(/grant usage on schema public to anon, authenticated, service_role;/g, '')), 'im Neuaufbau stehen keine Schlüssel, nur Rollennamen');


/* ── 9 · das Bild des Ortes hinter der Reihe ─────────────────────────── */

const bildreihe = text('src/components/ReihenBild.tsx');
assert.match(bildreihe, /alt="" loading="lazy"/, 'das Reihenbild ist Schmuck und wird nachgeladen');
assert.match(bildreihe, /aria-hidden="true"/, 'die Bildebene sagt niemandem etwas vor');
assert.ok(!/eintragAendern|speichern\(/.test(bildreihe), 'ein gefunden Bild wird nicht von sich geschrieben');
assert.match(text('src/lib/ortsbild.ts'), /const vorrat = new Map/, 'dieselbe Frage sucht nur einmal');
assert.match(text('src/lib/ortsbild.ts'), /HÖCHSTENS = 2/, 'nicht acht Reihen, acht Suchen auf einmal');
assert.match(text('src/components/EintragZeile.tsx'), /ReihenNachweis/, 'der Nachweis des Bilddienstes steht an der Reihe');
assert.match(text('src/components/EintragZeile.tsx'), /Bild übernehmen/, 'behalten wird ein Fund erst nach dem Zuruf');
assert.ok(!/<li[\s>]/.test(text('src/components/EintragZeile.tsx')), 'eine Reihe ist ein div – die Liste trägt das li');
assert.match(css, /\.zeile\s*\{[^}]*isolation:\s*isolate/, 'die Bildebene bleibt in der Reihe');
assert.match(css, /\.zeile-bild img\s*\{[^}]*object-fit:\s*cover/, 'das Bild füllt die Reihe, ohne es zu zerren');
assert.match(css, /\.zeile-bild::after\s*\{[^}]*linear-gradient/, 'vor dem Text liegt ein Vorhang');
assert.match(css, /\.zeile > :not\(\.zeile-bild\)\s*\{[^}]*z-index:\s*1/, 'Text und Knöpfe stehen über dem Bild');
assert.match(css, /@media print[\s\S]*\.zeile-bild\s*\{\s*display:\s*none/, 'auf Papier bleibt die Reihe weiß');
assert.match(text('src/app/api/bild/route.ts'), /max-age=86400/, 'ein Ort sieht den Tag über gleich aus');
assert.match(text('src/components/EintragFormular.tsx'), /api\/bild\?q=\$\{encodeURIComponent\(frage\)\}`, \{ cache: 'no-store' \}/, 'wer selbst nach einem Bild sucht, fragt ohne Vorrat');


/* ── 10 · die Karte ohne Schlüssel ────────────────────────────────────── */

const kachelblatt = text('src/lib/kacheln.ts');
assert.match(kachelblatt, /tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/, 'zuerst fragt die Karte den offenen OpenStreetMap-Dienst');
assert.match(kachelblatt, /arcgisonline\.com[\s\S]*\{z\}\/\{y\}\/\{x\}/, 'danach steht eine zweite offene Quelle bereit');
assert.ok(!/cartocdn/.test(kachelblatt), 'CARTO ist raus – es legt seit 2026 ein Wasserzeichen ohne Schlüssel');
assert.match(kachelblatt, /NEXT_PUBLIC_KARTE_KACHELN/, 'eigene Kacheln darf wer will, nicht muss');
const kachelnAlles = [...dateien.filter((d) => /\.(tsx?|css)$/.test(d))].map((d) => text(d)).join('\n');
assert.ok(!/basemaps\.cartocdn\.com/.test(kachelnAlles), 'kein Blatt bittet mehr um einen Kartenschlüssel');
assert.match(text('src/components/KartenAnsicht.tsx'), /tileerror/, 'eine fehlende Kachel wird bemerkt');
assert.match(text('src/components/KartenAnsicht.tsx'), /setVersuch/, 'dann tritt die nächste Quelle ein');
assert.match(text('src/components/KartenAnsicht.tsx'), /fehler\.current < 3/, 'erst drei Fehlgriffe, dann ein Wechsel – eine Kachel macht noch keinen Ausfall');
assert.match(text('src/lib/karten.ts'), /openstreetmap\.org\/export\/embed\.html/, 'die Vorschau im Formular ist offen eingebettet');
assert.ok(!/output=embed/.test(text('src/lib/karten.ts')), 'kein Google-Fenster, das einen Schlüssel will');


/**
 * Die Nadel und das Bett. Die karte zeigt, was der tag hergibt – und dazu die
 * betten: ein urlaubsplan ohne schlafplatz ist halblebt. Die nadel selbst ist
 * rechnung (in `lib/karten.ts`), ihr aussehn sitzt in der components-ebene.
 */
const scss = text('src/app/globals.css');
/** nur der abschnitt, der die nadel angeht – kein blick ins ganze blatt */
function nadelAbschnitt(css: string) {
  const i = css.indexOf('Die Nadel über einem Punkt');
  assert.ok(i >= 0, 'der nadel-abschnitt ist im stylesblatt gefunden worden');
  return css.slice(i, css.indexOf('@keyframes', i));
}
const karte = text('src/app/t/[tripId]/karte/page.tsx');
assert.match(karte, /kartenEintraege\(eintraege, tag === 'alle' \? null : tag\)/, 'Karte und Tage lesen denselben ausschnitt – keiner rätselt, was wo steht');
assert.ok(!/e\.art !== 'unterkunft'/.test(karte), 'die karte wirft die betten nicht mehr raus');
assert.match(karte, /nr: istBett \? null : \(stelle \+= 1\)/, 'ein bett zählt nicht mit, die halte laufen weiter');
assert.match(karte, /const folge = punkte\.filter\(\(p\) => p\.nr !== null\)/, 'die schnur verbindet nur die halte – ein bett hängt nicht am weg');
assert.match(karte, /artMeta\('unterkunft'\)\.Icon/, 'das bett zeigt sein zeichen, nicht eine zahl');
assert.match(karte, /marke: istBett \? artMeta\('unterkunft'\)\.wort/, 'die legende nennt die art, nicht den ersten titel');
assert.match(karte, /const ohnePunktListe = useMemo\(\(\) => \(reise \? kartenEintraege\([\s\S]{0,90}punktVorhanden/, 'gezählt wird dasselbe wie auf der karte – nicht an ihr vorbei');

const kartenBlatt = text('src/components/KartenAnsicht.tsx');
assert.match(kartenBlatt, /html: nadelHtml\(p\)/, 'die nadel kommt aus dem rechenblatt, nicht aus der ansicht');
assert.match(kartenBlatt, /iconSize: \[44, 44\][\s\S]{0,80}iconAnchor: \[15, 34\]/, 'fingerbreite fläche, die spitze auf dem punkt');
assert.match(kartenBlatt, /popupAnchor: \[0, -42\]/, 'das blatt öffnet über der kuppe, nicht hinter der nadel');

const nadel = nadelAbschnitt(text('src/app/globals.css'));
assert.match(nadel, /border-radius: 50% 50% 50% 6px/, 'ein körper mit zugespitzter ecke, kein kreis');
assert.match(nadel, /transform: rotate\(-45deg\)/, 'und er steht auf der spitze');
assert.match(nadel, /border: 2px solid #fff/, 'ein weißer ring hebt ihn von jeder kachel ab');
assert.match(nadel, /box-shadow:/, 'ein schatten setzt ihn darauf');
assert.ok(nadel.includes('rotate(45deg)'), 'zahl und zeichen stehen gegen die neigung des körpers');
assert.ok(/\.nadel-koerper b \{[\s\S]{0,320}border-radius: 999px/.test(nadel), 'das zeichen sitzt in einem siegel, nicht auf dem kopf');
assert.ok(/@media \(hover: hover\)[\s\S]{0,200}\.nadel-koerper:hover[\s\S]{0,120}scale\(1\.07\)/.test(scss), 'ein aufziehen nur für die maus');
assert.match(scss, /@media \(prefers-reduced-motion: no-preference\)[\s\S]{0,120}\.nadel-koerper[\s\S]{0,80}transition/, 'die bewegung bleibt eine Bitte');
assert.match(text('src/lib/karten.ts'), /export function nadelHtml/, 'die nadel ist reine rechnung und damit ohne karte prüfbar');

const punktfindung = text('src/lib/punktfindung.ts');
assert.match(punktfindung, /fetch\(\s*["'`~]\/api\/orte\?q=/, 'die suche nach dem punkt geht durch dasselbe tor wie das formular');
assert.ok(!/key=|API_KEY|process\.env/.test(punktfindung), 'kein zweiter schlüssel und keine neue anbietertür');
assert.match(punktfindung, /if \(!stadt\.some\(\(w\) => ziel\.has\(w\)\)\) continue/, 'eine genannte stadt muss dabeisein – lieber kein punkt als ein falscher');
assert.match(punktfindung, /if \(!gesuchte\.some\(\(w\) => name\.has\(w\)\)\) continue/, 'ein treffer muss sich für den namen halten, nicht nur für die stadt');
assert.match(text('src/components/EintragFormular.tsx'), /if \(werte\.lat === null\) void punktNachtragen/, 'nachgereicht wird nur, wo noch keiner steht');
assert.match(text('src/components/EintragFormular.tsx'), /Punkt von \$\{treffer\.name\} · \$\{treffer\.quelle\} übernommen/, 'und es bleibt gesagt, woher der punkt kommt');
assert.match(karte, /onClick=\{\(\) => void punkteFinden\(\)\}/, 'auf der karte liegt der knopf, nicht im formularversteck');
assert.match(karte, /ohnePunktListe\.slice\(0, 5\)/, 'höchstens fünf auf einmal – die offene suche will nicht gemäht werden');
assert.match(karte, /window\.setTimeout\(r, 240\)/, 'zwischen zwei anfragen liegt eine pause – die offene suche wird nicht gemäht');
assert.match(karte, /ohne Punkt steht nichts auf der Karte/, 'die lücke ist am bild erklärt, nicht unterm knick');
assert.ok(!/p\.titel/.test(text('src/lib/karten.ts').split('nadelHtml')[1] ?? ''), 'fremder text wird nicht in die nadel gehoben');


console.log(`🎉 Neues Fundament hält – ${dateien.length} Dateien (${dateien.reduce((s, d) => s + text(d).split('\n').length, 0)} Zeilen), ${seiten.length} Seiten, ${blätter.length} Reiseblätter, kein Rest von früher`);
