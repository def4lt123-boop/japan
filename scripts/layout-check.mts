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
assert.equal(kurz.length, 4, 'vier Bereiche in der Leiste – das profil ist ein blatt, kein bereich');
assert.ok(!/href:\s*'\/profil'|label:\s*'Profil'/.test(huelle), 'der Profil-Reiter ist weg, nicht nur ausgeblendet');
assert.ok(!/Einstellungen/.test(huelle), 'die seitenleiste hat kein einstellungsblatt mehr');
assert.ok(kurz.every((k) => k.length <= 10), `Kurze Namen für die Leiste (${kurz.join(', ')})`);
for (const weg of ['src/app/page.tsx', 'src/app/reisen/page.tsx', 'src/app/kalender/page.tsx', 'src/app/karte/page.tsx', 'src/app/reisen/neu/page.tsx', 'src/app/t/[tripId]/layout.tsx']) {
  assert.ok(existsSync(join(WURZEL, weg)), `${weg} fehlt`);
}
const grund = 'src/app/t/[tripId]';
const blätter = [...text(`${grund}/layout.tsx`).matchAll(/id:\s*'([a-z]+)',\s*label:/g)].map((m) => m[1]!);
assert.ok(blätter.length >= 4, 'die Reise hat Blätter');
for (const b of blätter) {
  assert.ok(existsSync(join(WURZEL, `${grund}/${b}/page.tsx`)), `Blatt „${b}“ hat keine Seite`);
}
for (const { pfad, inhalt } of texte(seiten)) {
  assert.match(inhalt, /export default (async )?function/, `${pfad} zeigt nichts`);
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
assert.ok(!existsSync(join(WURZEL, 'src/components/Einstellungen.tsx')), 'das einstellungsblatt gibt es nicht mehr');
assert.ok(!/Einstellungen/.test(text('src/app/page.tsx')), 'und das dashboard öffnet auch keins');
assert.match(text('src/app/page.tsx'), /<span className="md:hidden">\s*<StatusAnzeige \/>/, 'auf dem handy steht der status im kopf des dashboards');
const bettZeileText = text('src/components/BettZeile.tsx');
assert.match(bettZeileText, /store\.eintragLoeschen\(eintrag\.id\)/, 'ein bett lässt sich am reisetag löschen, wie eine aktivität');
assert.match(bettZeileText, /Unterkunft löschen\?/, 'aber mit rückfrage – ein aufenthalt gilt für mehrere nächte');
const seitenAlles = texte(seiten).join('\n');
assert.ok(!/'\/profil/.test(seitenAlles), 'kein Weg führt noch nach /profil');

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
assert.ok(!/ReihenNachweis/.test(text('src/components/EintragZeile.tsx') + text('src/components/BettZeile.tsx')), 'die reihen tragen keine nachweiszeile – das bild soll luft behalten');
assert.match(text('src/components/EintragFormular.tsx'), /foto_nachweis/, 'der nachweis bleibt am eintrag und ist im formular zu sehn');
assert.match(text('src/components/EintragZeile.tsx'), /Bild übernehmen/, 'behalten wird ein Fund erst nach dem Zuruf');
assert.ok(!/<li[\s>]/.test(text('src/components/EintragZeile.tsx')), 'eine Reihe ist ein div – die Liste trägt das li');
assert.match(css, /\.zeile\s*\{[^}]*isolation:\s*isolate/, 'die Bildebene bleibt in der Reihe');
assert.match(css, /\.zeile-bild img\s*\{[^}]*object-fit:\s*cover/, 'das Bild füllt die Reihe, ohne es zu zerren');
assert.match(css, /\.zeile-bild::after\s*\{[^}]*linear-gradient/, 'vor dem Text liegt ein Vorhang');
assert.match(css, /\.zeile > :not\(\.zeile-bild\)\s*\{[^}]*z-index:\s*1/, 'Text und Knöpfe stehen über dem Bild');
assert.match(css, /@media print[\s\S]*\.zeile-bild\s*\{\s*display:\s*none/, 'auf Papier bleibt die Reihe weiß');
assert.match(text('src/app/api/bild/route.ts'), /max-age=86400/, 'ein Ort sieht den Tag über gleich aus');
assert.match(text('src/lib/ortsbild.ts'), /frisch \? \{ cache: 'no-store' \} : undefined/, 'wer selbst noch einmal sucht, hängt nicht im alten vorrat');


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
assert.match(nadel, /border: 2px solid var\(--nadel-ring\)/, 'ein ring hebt ihn von jeder kachel ab');
assert.match(text('src/app/globals.css'), /--nadel-ring: #ffffff;/, 'der ring bleibt weiß – die kacheln in der mitte sind hell');
assert.match(nadel, /box-shadow:/, 'ein schatten setzt ihn darauf');
assert.ok(nadel.includes('rotate(45deg)'), 'zahl und zeichen stehen gegen die neigung des körpers');
assert.ok(/\.nadel-koerper b \{[\s\S]{0,320}border-radius: 999px/.test(nadel), 'das zeichen sitzt in einem siegel, nicht auf dem kopf');
assert.ok(/@media \(hover: hover\)[\s\S]{0,200}\.nadel-koerper:hover[\s\S]{0,120}scale\(1\.07\)/.test(scss), 'ein aufziehen nur für die maus');
assert.match(scss, /@media \(prefers-reduced-motion: no-preference\)[\s\S]{0,120}\.nadel-koerper[\s\S]{0,80}transition/, 'die bewegung bleibt eine Bitte');
assert.match(text('src/lib/karten.ts'), /export function nadelHtml/, 'die nadel ist reine rechnung und damit ohne karte prüfbar');

const punktfindung = text('src/lib/punktfindung.ts');
assert.match(punktfindung, /fetch\(\s*["'`~]\/api\/orte\?q=/, 'die suche nach dem punkt geht durch dasselbe tor wie das formular');
assert.ok(!/key=|API_KEY|process\.env/.test(punktfindung), 'kein zweiter schlüssel und keine neue anbietertür');
assert.match(punktfindung, /if \(!stadt\.some\(\(w\) => wortKommtVor\(w, ziel\)\)\) continue/, 'eine genannte stadt muss dabeisein – lieber kein punkt als ein falscher');
assert.match(punktfindung, /if \(!vertraut && !gesuchte\.some\(\(w\) => wortKommtVor\(w, name\)\)\) continue/, 'ein treffer muss sich für den namen halten, nicht nur für die stadt – nur Googles erster Treffer darf einen anderen Namen tragen');
assert.match(text('src/components/EintragFormular.tsx'), /if \(werte\.lat === null\) void punktNachtragen/, 'nachgereicht wird nur, wo noch keiner steht');
assert.match(text('src/components/EintragFormular.tsx'), /Punkt von \$\{treffer\.name\} · \$\{treffer\.quelle\} übernommen/, 'und es bleibt gesagt, woher der punkt kommt');
assert.match(karte, /onClick=\{\(\) => void punkteFinden\(\)\}/, 'auf der karte liegt der knopf, nicht im formularversteck');
assert.match(karte, /ohnePunktListe\.slice\(0, 5\)/, 'höchstens fünf auf einmal – die offene suche will nicht gemäht werden');
assert.match(karte, /window\.setTimeout\(r, takt\(\)\)/, 'zwischen zwei anfragen liegt eine pause – nach einer bremse eine lange');
assert.match(karte, /ohne Punkt steht nichts auf der Karte/, 'die lücke ist am bild erklärt, nicht unterm knick');
assert.ok(!/p\.titel/.test(text('src/lib/karten.ts').split('nadelHtml')[1] ?? ''), 'fremder text wird nicht in die nadel gehoben');


/* ── 12 · das bild im hintergrund (die app hat nur ein helles licht) ──── */

assert.ok(!/data-thema|dangerouslySetInnerHTML/.test(text('src/app/layout.tsx')), 'kein umschalten des lichts mehr beim start');
assert.ok(!/data-thema/.test(text('src/app/globals.css')), 'keine zweite palette – die app ist hell');
assert.ok(!/thema/.test(text('src/lib/types.ts')), 'das licht ist keine einstellung mehr');
assert.ok(!existsSync(join(WURZEL, 'src/lib/thema.ts')), 'die rechnung fürs licht ist weg');
assert.ok(!/color: '#fff'/.test(text('src/components/Huelle.tsx') + text('src/components/Kalender.tsx')), 'kein weiß mehr auf akzentflächen');

const suche = text('src/components/ReihenBild.tsx');
assert.match(suche, /bildFragen\(/, 'die reihe fragt die staffel, nicht ein einzelnes feld');
assert.match(suche, /amEintrag \?\? fund/, 'was übernommen ist, gilt – sonst sucht die reihe für sich');
assert.match(text('src/lib/ortsbild.ts'), /return fragen\.slice\(0, 3\)/, 'höchstens drei fragen pro reihe');
assert.match(text('src/lib/ortsbild.ts'), /const HÖCHSTENS = 2/, 'und höchstens zwei anfragen gleichzeitig');
assert.match(text('src/lib/anbieter.ts'), /SIEHBT_GOOGLE \? await beiGoogleFoto|if \(SIEHBT_GOOGLE\)/, 'wer einen schlüssel hat, kriegt die fotos von google');
assert.match(text('src/app/api/bild/route.ts'), /googleBild\(foto\)/, 'gereicht wird durch unsere eigene tür, der schlüssel bleibt im server');
assert.ok(/export const Fotopfad = \/.*places/.test(text('src/lib/orte.ts')), 'nur ein google-fotopfad – die tür bleibt kein offener verteiler');
assert.match(text('src/components/EintragZeile.tsx'), /eintrag\.foto_url \?\? bild\?\.url/, 'auch die dichte reihe zeigt das bild, als vorschnitt');

/* ── 13. ortssuche: kurz tippen, richtig treffen ────────────────────────── */

const orteLib = text('src/lib/orte.ts');
const anbieterLib = text('src/lib/anbieter.ts');
const orteRoute = text('src/app/api/orte/route.ts');
const suchBlatt = text('src/components/OrtSuche.tsx');

assert.match(orteLib, /export function ausPhoton/, 'photon wird geformt wie die anderen quellen');
assert.match(orteLib, /export function stelleOrte/, 'mischen und reihen steht im reinen teil, nicht im netzwerk');
assert.match(orteLib, /export function frageLohnt/, 'dieselbe schwelle für blatt und server');
assert.ok(orteLib.includes("'ss'"), 'ein ß wird für den vergleich zu ss');
assert.match(anbieterLib, /photon\.komoot\.io\/api/, 'photon wird gefragt');
assert.match(anbieterLib, /Promise\.allSettled/, 'keine quelle wartet auf die andere');
assert.match(anbieterLib, /stelleOrte\(/, 'was beide liefern, wird gemischt');
assert.match(anbieterLib, /const ABSTAND_UNTER_EINANDER = 1\d{3}/, 'nominatim wird höchstens einmal pro sekunde gefragt');
assert.match(anbieterLib, /const gemerkte_fragen = new Map/, 'und eine frage wird sich eine weile gemerkt');
for (const zweig of ['beiPhoton', 'beiOpenStreetMap']) {
  const stelle = anbieterLib.indexOf(`async function ${zweig}`);
  assert.ok(stelle > 0, `${zweig} ist da`);
  const brocken = anbieterLib.slice(stelle, anbieterLib.indexOf('\n}', stelle));
  assert.ok(/hole\(/.test(brocken), `${zweig}: durch dieselbe tür mit frist`);
  assert.ok(!/process\.env/.test(brocken), `${zweig}: läuft ohne schlüssel`);
  assert.ok(/FRAGEKOPF/.test(brocken), `${zweig}: sagt den freien quellen, wer fragt`);
}
assert.match(orteRoute, /s-maxage=\d+/, 'die antwort darf am rand liegen bleiben');
assert.match(orteRoute, /frageLohnt\(q\)/, 'die tür kennt dieselbe schwelle wie das blatt');
assert.match(orteRoute, /no-store/, 'wer frisch fragt, bekommt nichts aus dem gedächtnis');
assert.match(suchBlatt, /const AB_KUERZE = 2/, 'zwei zeichen reichen zum suchen');
assert.match(suchBlatt, /new AbortController\(\)/, 'und eine alte antwort wird weggeworfen');
assert.match(suchBlatt, /signal: lauf\.signal/, 'der lauf selbst wird abgebrochen, nicht nur ignoriert');
assert.match(suchBlatt, /reiseplan\.orte\.zuletzt\.v1/, 'die letzten orte liegen auf dem gerät');
assert.match(suchBlatt, /const sitzung = new Map/, 'was schon gesucht wurde, wird nicht noch einmal gefragt');
assert.match(suchBlatt, /if \(liste\.length\) sitzung\.set/, 'ein „nichts" wird nicht gemerkt');
assert.match(suchBlatt, /google\.com\/maps/, 'ist nichts zu finden, führt die zeile zu google maps');
assert.match(suchBlatt, /quellenName\(v\.quelle\)/, 'die quelle steht unter dem treffer');
assert.match(orteLib, /export function quellenName/, 'eine benennung pro concept: photon und nominatim heißen beide openstreetmap');
assert.match(text('src/lib/punktfindung.ts'), /quellenName\(treffer\.quelle\)/, 'auch ein nachgesuchter punkt nennt dieselbe quelle');
assert.match(suchBlatt, /entfernungKm\(/, 'und was nahe an der reise liegt, sagt das');
assert.match(text('src/lib/types.ts'), /'google' \| 'openstreetmap' \| 'photon' \| 'geonames'/, 'die quellen photon und geonames sind im typ bekannt');
assert.match(text('src/components/ui.tsx'), /onKeyDown=\{onTaste\}/, 'das feld kennt die taste');
assert.match(suchBlatt, /e\.key !== 'Enter'/, 'eintreten nimmt den ersten vorschlag');


/* ── 14. das bild folgt denselben regeln wie die suche ───────────────────── */

const bildLib = text('src/lib/anbieter.ts');
const bildRoute = text('src/app/api/bild/route.ts');
const bildVorrat = text('src/lib/ortsbild.ts');
const bildFormular = text('src/components/EintragFormular.tsx');
const bildReihe = text('src/components/ReihenBild.tsx');

assert.equal((bildLib.match(/Promise\.allSettled/g) ?? []).length, 2, 'suche und bild laufen beide gleichzeitig, keines hintereinander');
assert.match(bildLib, /bestesBild\(/, 'nicht die reihenfolge der antwort zählt, sondern die der quellen');
assert.match(bildLib, /bildGrund\(suchwort\)/, 'findet die ganze frage nichts, bleibt ihr kern');
assert.match(bildLib, /kern !== suchwort \? beiDenBildquellen\(kern\)/, 'und der kern wird wirklich noch einmal gefragt');
assert.match(bildVorrat, /export async function bildFuer\(/, 'ein tor für die staffel – reihe und formular gehen durch dasselbe');
assert.match(bildVorrat, /export function ortsBild\(frage: string, frisch = false\)/, 'wer will, kann eine frage auffrischen');
assert.match(bildVorrat, /vorrat\.delete\(sauber\)/, 'eine leere hand wird nicht gemerkt');
assert.match(bildVorrat, /cache: 'no-store'/, 'ein nochmal hängt nicht im netzvorrat der seite');
assert.match(bildRoute, /'cache-control': 'no-store'/, 'und ein „nichts" wird nicht einen tag lang weitergereicht');
assert.ok(!/bild \?\? \{ url: null \}/.test(bildRoute), 'der lange header hängt nur an einem fund');
assert.match(bildFormular, /await bildFuer\(/, 'das feld fragt die staffel, nicht einen langen adresssatz');
assert.ok(!/filter\(Boolean\)\.join\(', '\)/.test(bildFormular), 'keine zusammengeklebte adresse mehr als bildfrage');
assert.match(bildFormular, /bildeins\(entwurf, true\)/, 'ein „nochmal suchen" ist da, wenn nichts kam');
assert.match(bildFormular, /google\.com\/search\?tbm=isch/, 'und die suche führt weiter, wohin sie selbst nicht sieht');
assert.match(bildFormular, /commons\.wikimedia\.org\/w\/index\.php\?search=/, 'bei commons ebenso');
assert.match(bildReihe, /bildFuer\(eintrag, reise/, 'die reihe geht denselben weg');
assert.ok(!/for \(const frage of fragen\)/.test(bildReihe), 'die staffel wird an einer stelle durchgegangen, nicht doppelt');


/* ── 15. ein tag ist eine wahl, keine pflicht ───────────────────────────── */

const formularText = text('src/components/EintragFormular.tsx');
const zeilenText = text('src/components/EintragZeile.tsx');
const listenSeite = text('src/app/t/[tripId]/liste/page.tsx');
const planText = text('src/lib/plan.ts');

assert.match(formularText, /art === 'unterkunft' \? reise\.start_date \?\? '' : ''/, 'ein tag wird nur am bett vorgemerkt, sonst bleibt das feld leer');
assert.match(formularText, /\{ date: '' \}/, '„ohne Tag" ist ein chip im formular');
assert.match(formularText, /\{istBett \? null : \(/, 'an einem bett wird er nicht angeboten – eine nacht ohne tag gibt es nicht');
assert.match(formularText, /disabled=\{!entwurf\.titel\.trim\(\)\}/, 'ein name genügt zum speichern');
assert.match(formularText, /ohne Tag\.`\);/, 'und das echo sagt, dass der punkt ohne tag liegt');
assert.match(zeilenText, /ohneTag\(eintrag\.id\)/, 'zurück ohne tag ist ein tip in der zeile');
assert.match(zeilenText, /eintragAendern\(id, \{ date: null \}\)/, 'ein tip, kein umweg über das datum');
assert.ok(!/aus dem Kalender nehmen/.test(zeilenText), 'eine benennung für das eine concept: ohne tag');
assert.ok(!/datum: tage\[0\]/.test(listenSeite), 'die liste zwingt keinem neuen punkt einen tag auf');
assert.match(listenSeite, /ohneTagEintraege\(gefiltert\)/, 'die gruppe rechnet im plan, nicht auf der seite');
assert.match(planText, /export function ohneTagEintraege/, 'und der einlauf ist eine regel im rechenblatt');
assert.ok(/ohne Tag/.test(formularText) && /ohne Tag/.test(zeilenText) && /ohne Tag/.test(listenSeite), 'dieselben worte an allen drei stellen');

/* ── 16. mehrere auf einmal, und was zusammengehört ─────────────────────── */

const sammelLib = text('src/lib/sammel.ts');
const naheLib = text('src/lib/naehe.ts');
const sammelBlatt = text('src/components/MehrfachFormular.tsx');
const gruppenBlatt = text('src/components/OhneTagGruppen.tsx');

assert.match(sammelLib, /export function zeilenAusText/, 'der eingefügte text wird in einer regel gelesen, nicht im blatt');
assert.match(sammelLib, /export function ohneDubletten/, 'und das doppeltprüfen gehört dazu');
assert.match(sammelLib, /HOECHSTEN = 40/, 'eine obergrenze schützt die staffel danach');
assert.match(sammelBlatt, /mehrzeilig/, 'das einfügen ist ein feld, in das einer seinen text legt');
assert.match(sammelBlatt, /zeilenAusText\(/, 'das blatt rechnet nicht selbst');
assert.match(sammelBlatt, /punktFuer\(/, 'jeder neue punkt sucht sein Google Maps');
assert.match(sammelBlatt, /bildFuer\(/, 'und sein bild');
assert.match(sammelBlatt, /date: null/, 'angelegt wird ohne tag');
assert.match(sammelBlatt, /eintragAnlegen\(/, 'die reihe entsteht zuerst, das Suchen danach');
assert.match(sammelBlatt, /const warten = \(zeit = takt\(\)\)/, 'die staffel geht in ruhe, nicht auf einmal');
assert.ok(!/input type="file"|FileReader|bild-?lesen/i.test(sammelBlatt), 'hier wird text eingefügt, kein bild hochgeladen');

assert.match(naheLib, /export function haufungen/, 'die gruppen rechnet ein blatt, keine seite');
assert.match(naheLib, /schaetzungKm\(/, 'der abstand ist ein weg, keine luftlinie allein');
assert.match(naheLib, /unterkunft/, 'betten werden nicht mitgruppiert');
assert.match(naheLib, /export function tagAenderung/, 'und der satz schreibt in der form von eintraegeRueckwaerts');
assert.match(naheLib, /export function wegLink/, 'der weg durch die gruppe führt nach Google Maps');
assert.match(gruppenBlatt, /haufungen\(/, 'die analyse zeigt die gruppen');
assert.match(gruppenBlatt, /eintraegeRueckwaerts\(/, 'ein tag für die gruppe ist ein schritt, kein kilometer an klicken');
assert.match(gruppenBlatt, /onClick=\{\(\) => aufTag\(tag\.datum\)\}/, 'der tag kommt aus einem tip – verteilt wird nichts von allein');
assert.match(gruppenBlatt, /ohnePunkt\.length/, 'wer keinen punkt hat, bleibt eine zeile, kein fehler');
assert.ok(!/Promise\.all\(/.test(gruppenBlatt + sammelBlatt), 'keine seite wirft zwanzig suchanfragen auf einmal');
assert.ok(!/verteil|automatisch auf/.test(gruppenBlatt), 'keine automatische verteilung über die tage');
assert.match(listenSeite, /MehrfachFormular/, 'das mehrfache liegt an der stelle, an der die punkte warten');
assert.match(listenSeite, /OhneTagGruppen/, 'und die gruppen direkt darunter');
assert.ok(/ohne Tag/.test(sammelBlatt) && /ohne Tag/.test(gruppenBlatt), 'dasselbe wort an allen stellen');
assert.ok(!/min-h-0/.test(sammelBlatt + gruppenBlatt), 'auch in der vorschlagsliste ist ein feld fingerbreit');

/* ── 17. der punkt von hand: ein link, wenn die suche nichts findet ──────── */

const kartenlinkLib = text('src/lib/kartenlink.ts');
const punktFeldBlatt = text('src/components/PunktFeld.tsx');
const sucheBlatt = text('src/components/OrtSuche.tsx');
const karteRoute = text('src/app/api/karte/route.ts');

assert.match(kartenlinkLib, /export function punktAusKartenLink/, 'der link wird in einer regel gelesen, nicht im feld');
assert.match(kartenlinkLib, /!3d/, 'die datenklammer hinter dem platz wird gelesen');
assert.match(kartenlinkLib, /const MITTE = paarweise\('@'/, 'die kartenmitte wird gelesen');
assert.match(kartenlinkLib, /destination/, 'ein weg endet an einem punkt');
assert.match(kartenlinkLib, /lat === 0 && lng === 0/, 'null/null ist kein ziel');
assert.match(kartenlinkLib, /export function istKurzLink/, 'der kurze link aus dem teilen-knopf wird erkannt');
assert.match(kartenlinkLib, /export async function punktAusLink/, 'und nur der wird nachgelesen');
assert.match(karteRoute, /dynamic = 'force-dynamic'/, 'das nachlesen wird nicht zwischengespeichert');
assert.match(karteRoute, /AbortSignal\.timeout/, 'das nachlesen hat eine frist');
assert.match(karteRoute, /ERLAUBT/, 'angefasst werden nur kartenadressen');
assert.ok(!/text\(\)|html\(/.test(karteRoute), 'zurückkommt die adresse, nie der seiteninhalt');
assert.match(punktFeldBlatt, /label="Punkt"/, 'das feld heißt Punkt, nicht Koordinaten');
assert.match(punktFeldBlatt, /hinweis="Wenn die Suche den Ort nicht findet/, 'und sagt, wofür es da ist');
assert.match(punktFeldBlatt, /Punkt übernehmen/, 'geschrieben wird, wer übernimmt');
assert.match(sucheBlatt, /istKartenText/, 'ein link in der suche bleibt eine frage erspart');
assert.match(sucheBlatt, /beimKartenLink\?\.\(verweis\)|beimKartenLink\?\.\(link\)/, 'und wird als punkt angeboten');
assert.match(formularText, /Keinen passenden Punkt gefunden – den Google-Maps-Link beim Punkt einfügen/, 'die nachsuche schickt an dasselbe feld');
assert.ok(!/Koordinaten/.test(kartenlinkLib + punktFeldBlatt + sucheBlatt + formularText), 'ein punkt hat keinen zweiten namen');
assert.ok(!/NEXT_PUBLIC|supabase|apikey/i.test(karteRoute), 'der dienst nennt keine umgebungswerte');
assert.match(text('src/lib/orte.ts'), /dezimaltrenner/, 'und zwei zahlen mit komma gehen weiterhin');



/* ── 18. die staffel, der fußweg in minuten und das schloss ────────────── */

const taktLib = text('src/lib/suchtakt.ts');
assert.match(taktLib, /const TAKT_RUHIG = 240/, 'in ruhe liegt eine viertelsekunde zwischen zwei fragen');
assert.match(taktLib, /const TAKT_GEBREMST = 1\d{3}/, 'nach einer bremse wird die pause eine sekunde und länger');
assert.match(taktLib, /const BREMS_DAUER = 2\d_\d{3}/, 'und sie hält eine weile, nicht einen augenblick');
assert.match(taktLib, /export function takt\(jetzt = Date\.now\(\)\)/, 'der takt ist eine rechnung, keine uhr – damit er prüfbar ist');
assert.match(taktLib, /export function gebremst\(/, 'und das blatt kann nachsehen, ob gerade gebremst wird');

const anbieterQuelle = text('src/lib/anbieter.ts');
assert.match(anbieterQuelle, /const gebremst_bis = new Map<string, number>\(\)/, 'gebremst wird pro quelle, nicht für alle zusammen');
assert.match(anbieterQuelle, /antwort\.status === 429 \|\| antwort\.status === 503/, 'eine absage macht die tür zu');
assert.match(anbieterQuelle, /retry-after/, 'und die frist, die der dienst nennt, wird gehalten');
assert.match(anbieterQuelle, /else if \(!brems_gemeldet && antworten\.every\(\(a\) => a !== null\)\) gemerkte_fragen\.set/, 'eine leere hand wird nur gemerkt, wenn keine bremse lief und jede quelle geantwortet hat');
assert.match(anbieterQuelle, /export function bremsZuletzt\(\)/, 'die meldung geht an die antwort der api weiter');
assert.match(anbieterQuelle, /!gebremst\('nominatim'/, 'in der eignen bremse wird nominatim gar nicht gefragt');

const orteAntwort = text('src/app/api/orte/route.ts');
assert.match(orteAntwort, /bremsZuletzt\(\)/, 'die suche sagt, ob sie gebremst wurde');
assert.match(orteAntwort, /brems: true/, 'und zwar als feld in der antwort, nicht als fehler');
assert.match(orteAntwort, /const lagern = orte\.length && !frisch && !gebremst/, 'eine leere hand wird nicht zwischengelagert');
assert.ok(!/s-maxage=1800[^']*'[\s\S]{0,40}Cache-Control/.test(orteAntwort), 'das lagern hängt an einer bedingung, nicht am kopf');

const sucheQuelle = text('src/lib/punktfindung.ts');
assert.match(sucheQuelle, /export function sucheDurchsuchen\(frisch = false\)/, 'die suche hat ein tor, mit frage am zwischenspeicher vorbei');
assert.match(sucheQuelle, /bremsMelden\(daten\.brems \?\? false\)/, 'die meldung der suche wird angenommen, nicht verschluckt');
assert.match(sucheQuelle, /opts: \{ höchstens\?: number \} = \{\}/, 'in der bremse genügt eine frage pro eintrag');

const wegQuelle = text('src/lib/weg.ts');
assert.match(wegQuelle, /export function wegText\(/, 'der fußweg wird in minuten gesagt');
assert.match(wegQuelle, /geschätzt' \? '≈ '/, 'und die überschlagung bleibt als solche lesbar');
assert.match(wegQuelle, /export function wegLaenge\(/, 'die länge des weges steht dahinter');
assert.match(wegQuelle, /export function nahGenug\(/, 'und derselbe wert öffnet den filter');
assert.match(wegQuelle, /if \(!weg\) return true;/, 'ein punkt ohne Google Maps fällt nicht aus dem filter – ihm fehlt der punkt');
assert.match(wegQuelle, /Wegdienst war nicht zu erreichen/, 'die wegZeile sagt, woran eine überschlagung liegt');

const wegBlatt = text('src/components/Fussweg.tsx');
assert.match(wegBlatt, /export function useFussWege\(/, 'die schritte holt ein blatt, keine seite');
assert.match(wegBlatt, /await warten\(takt\(\)\)/, 'einer nach dem andern, mit der pause der staffel');
assert.match(wegBlatt, /const gefragt = new Set<string>\(\)/, 'und dasselbe paar wird nicht zweimal gefragt');
assert.match(wegBlatt, /if \(fund\.quelle !== 'gerechnet'\) return;/, 'die überschlagung wird nur durch eine rechung ersetzt');

const wegZeile = text('src/components/EintragZeile.tsx');
assert.match(wegZeile, /function Wegangabe\(/, 'eine darstellung für den weg, nicht zwei');
assert.match(wegZeile, /wegText\(weg\)/, 'minuten zuerst');
assert.match(wegZeile, /wegLaenge\(weg\)/, 'die länge dahinter');
assert.ok(!/Math\.round\(verbinden\.km \* 1000\)/.test(wegZeile), 'die wegZeile formatiert kilometer nicht mehr selbst');
assert.match(wegZeile, /nachbarWeg\?: Fussweg \| null/, 'und die liste darf denselben wert hineingeben');

const haufungsBlatt = text('src/components/OhneTagGruppen.tsx');
assert.match(haufungsBlatt, /const SCHWELLEN = \[1, 1\.5, 2\.5, 4\]/, 'ein schritt von höchstens einem kilometer ist die engste gruppe');
assert.match(haufungsBlatt, /useFussWege\(schritte\)/, 'die gruppen rechnen ihre wege selbst');
assert.match(haufungsBlatt, /minutenText\(gang\.minuten\)/, 'und die kopfwegZeile sagt minuten');
assert.match(haufungsBlatt, /🚶 \$\{wegText\(schritt\)\}/, 'jede wegZeile ihren schritt');
assert.ok(!/schaetzungKm\(/.test(haufungsBlatt), 'das blatt rechnet keine luftlinie nebenher');

assert.match(listenSeite, /const NAHE_KM = 1/, 'der filter heißt höchstens ein kilometer');
assert.match(listenSeite, /höchstens \{kmText\(NAHE_KM\)\} beieinander/, 'und das steht auf dem knopf');
assert.match(listenSeite, /nachbarn\(wartend\)/, 'gemessen wird der nächste schritt');
assert.ok((listenSeite.match(/wege\[e\.id\]/g) ?? []).length >= 2, 'filter und wegZeile lesen dieselbe zahl');
assert.match(listenSeite, /weiter als \{kmText\(NAHE_KM\)\} zum nächsten/, 'und was fällt, wird gesagt');

const kartenSeite = text('src/app/t/[tripId]/karte/page.tsx');
assert.match(kartenSeite, /window\.setTimeout\(r, takt\(\) \* 2\)|window\.setTimeout\(r, takt\(\)\)/, 'die nachsuche hält die staffel ein');
assert.match(kartenSeite, /sucheDurchsuchen\(true\)/, 'und fragt was leer blieb ein zweites mal, am zwischenspeicher vorbei');
assert.match(kartenSeite, /Die Kartensuche war gerade zugemacht/, 'liegt die tür zu, steht das da – nicht „kein punkt\"');

const sammelBlatt2 = text('src/components/MehrfachFormular.tsx');
assert.match(sammelBlatt2, /const warten = \(zeit = takt\(\)\)/, 'die masse geht im takt der suche');
assert.match(sammelBlatt2, /höchstens: gebremst\(\) \? 1 : 3/, 'und in der bremse mit einer frage pro eintrag');
assert.match(sammelBlatt2, /async function nachholen\(/, 'der zweite durchgang holt, was die bremse verschluckt hat');
assert.match(sammelBlatt2, /bremsMelden\(daten\?\.brems \?\? false\)/, 'die meldung der suche erreicht das blatt');

const vorschlagsBlatt = text('src/components/OrtSuche.tsx');
assert.match(vorschlagsBlatt, /Min\. zu Fuß/, 'die vorschläge sagen minuten, nicht kilometer');
assert.match(vorschlagsBlatt, /gleich hier/, 'und was direkt daneben liegt, steht auch so da');
assert.match(haufungsBlatt, /minutenAus\(tag\.km\)\} Min\./, 'auch der tag wird in minuten gelesen');
assert.match(vorschlagsBlatt, /schaetzungKm\(anfrage, konzentriert\)/, 'der weg wird überschlagen, die luftlinie bleibt die sortierung');

const schlossSeite = text('src/app/ansicht/page.tsx');
const schlossBlatt = text('src/components/AnsichtSchloss.tsx');
const schlossWarte = text('src/app/api/ansicht/route.ts');
const schlossLib = text('src/lib/ansicht.server.ts');
const mittel = text('src/middleware.ts');
assert.match(mittel, /export async function middleware\(/, 'die tür sitzt vorn an der seite');
assert.match(mittel, /aufgesperrt\(anfrage\.cookies\.get\(ANSICHT_COOKIE\)\?\.value\)/, 'geprüft wird der cookie, nie das wort im blatt');
assert.match(mittel, /searchParams\.set\('von', /, 'und der weg, den einer wollte, bleibt gemerkt');
assert.match(schlossSeite, /redirect\(zielSichern\(von\)\)/, 'wer hinein kann, kommt ohne fragen weiter');
assert.match(schlossBlatt, /'password'/, 'das feld ist ein passwortfeld – und sichtbar nur auf Tipp');
assert.ok(!/flex-row|sm:flex-row/.test(schlossBlatt), 'nichts steht neben etwas anderem: die spalte läuft von oben nach unten');
assert.ok(!/benutzername|type="email"|konto anlegen/i.test(schlossBlatt), 'nach einem namen wird nicht gefragt');
assert.match(schlossWarte, /export const dynamic = 'force-dynamic'/, 'die tür wird nicht zwischengespeichert');
assert.match(schlossWarte, /httpOnly: true/, 'der schlüssel liegt nur beim browser, nicht im blatt');
assert.match(schlossWarte, /VERSUCHE = 5/, 'fünf mal probieren, dann eine minute ruhe');
assert.ok(!/json\(\{[^}]*eingegeben/.test(schlossWarte), 'was ins feld getippt wird, kommt nicht zurück');
assert.match(schlossLib, /process\.env\.ANSICHT_PASSWORT \|\| '170493'/, 'das wort steht auf dem server, mit raum zum ändern');
assert.match(schlossLib, /crypto\.subtle\.digest\('SHA-256'/, 'verglichen wird die wurzel');
assert.match(schlossLib, /startsWith\('\/\/'\)/, 'und der weg nach dem aufschließen bleibt in der seite');
for (const [name, inhalt] of [['das blatt', schlossBlatt], ['die seite', schlossSeite], ['die tür', schlossWarte], ['das mittel', mittel]] as [string, string][]) {
  assert.ok(!inhalt.includes('170493'), `${name} kennt das ansehen-wort nicht`);
}
assert.ok(!/NEXT_PUBLIC|supabase|apikey/i.test(schlossWarte + schlossLib), 'das schloss nennt keine umgebungswerte');
assert.ok(!/passwort ist|so lautet|lautet das/i.test(schlossBlatt + schlossSeite), 'die seite rät das wort nicht');
assert.ok(!/passwort[^\n]{0,12}\d{3,}/i.test(schlossBlatt + schlossSeite + orteAntwort), 'und schreibt es nirgends hin');

/* ── 19. wer die seite gemacht hat, und was ein weg kosten darf ─────────── */

const uiBlatt = text('src/components/ui.tsx');
assert.match(uiBlatt, /export function MadeByFlo\(/, 'eine darstellung dafür, wer die seite gemacht hat');
assert.match(uiBlatt, /made by <span className="font-semibold">Flo<\/span>/, 'und sie sagt es in denselben worten');
const floStellen = dateien.filter((d) => text(d).includes('<MadeByFlo')).sort();
assert.deepEqual(floStellen, ['src/app/page.tsx', 'src/components/AnsichtSchloss.tsx', 'src/components/Huelle.tsx'], 'sie steht am schloss, in der leiste und auf dem dashboard');
const kopfBlatt = text('src/app/layout.tsx');
assert.match(kopfBlatt, /made by Flo/, 'und im reiter steht dasselbe');
for (const { pfad, inhalt } of texte(dateien)) {
  assert.ok(!/gemacht von flo|impressum: flo|© flo/i.test(inhalt), `${pfad} sagt es nicht noch einmal in andern worten`);
}

assert.match(schlossBlatt, /Gib das Passwort ein, das du von Flo bekommen hast\./, 'am schloss steht, woher das wort kommt');
assert.ok(!schlossBlatt.includes('kein Konto'), 'der satz über kontos steht nicht am schloss');
assert.ok(!/(Ein|kein) Passwort, kein/i.test(schlossSeite + schlossBlatt), 'und er kommt auch nirgends sonst wieder');

const routenQuelle = text('src/lib/routen.ts');
assert.match(routenQuelle, /export function untergrenze\(km: number, modus: string\)/, 'jeder modus hat ein tempolimit, und es gilt als untergrenze');
assert.match(routenQuelle, /Math\.max\(1, zeit, untergrenze\(km, modus\)\)/, 'keine dienstantwort ist schneller, als der modus laufen kann');
assert.match(routenQuelle, /export function wegQuellen\(/, 'ein modus hat eine kette von diensten, nicht nur einen');
assert.match(routenQuelle, /if \(diener !== ALLGEMEIN\)/, 'dahinter fragt der allgemeine dienst nach');
assert.match(routenQuelle, /if \(gebremst\(\)\) return bekannt \?\? geschaetzteRoute\(von, nach, modus\);/, 'in der bremse werden die offenen dienste nicht mehr gefragt – die zeile überschlägt sich');
assert.match(routenQuelle, /const ausGoogle = await googleRoute\(von, nach, modus, streckenbild\)/, 'google maps wird vor den offenen diensten gefragt');
assert.match(routenQuelle, /export const TABELLE_MAX = 12/, 'eine gruppe fragt die wege auf einmal, und die anfrage hat ein maß');
assert.match(routenQuelle, /\/table\/v1\/\$\{quelle\.osrm\}/, 'die tabelle fragt denselben diener wie das einzelpaar');
assert.match(routenQuelle, /if \(a === b\) \{/, 'und sich selbst ist kein schritt');
assert.match(routenQuelle, /const speicherTabellen = new Map<string, Wegmatrix>\(\)/, 'was gerechnet ist, wird nicht noch einmal gefragt');

const kartenQuelle = text('src/lib/karten.ts');
assert.match(kartenQuelle, /diener: 'https:\/\/routing\.openstreetmap\.de\/routed-foot'/, 'zu fuß wird der fußwegdienst gefragt');
assert.match(kartenQuelle, /diener: 'https:\/\/routing\.openstreetmap\.de\/routed-bike'/, 'das rad den raddienst');
assert.match(kartenQuelle, /diener: 'https:\/\/router\.project-osrm\.org'/, 'auto und bahn bleiben beim allgemeinen');

const naeheQuelle = text('src/lib/naehe.ts');
assert.match(naeheQuelle, /const paarKm = \(a: Nahpunkt, b: Nahpunkt\) => schaetzungKm\(a, b\)/, 'gruppiert wird über die wege, nicht über die linie');
assert.match(naeheQuelle, /export function naechsteFolge\(/, 'der gang zum nächsten ist eine rechnung für sich');
assert.match(naeheQuelle, /export function routenvorschlag\(/, 'und darüber liegt der vorschlag, der so lange umgedreht wird, bis nichts mehr spart');

const gruppenRoutenBlatt = text('src/components/Fussweg.tsx');
assert.match(gruppenRoutenBlatt, /export function useGruppenRouten\(/, 'eine gruppe ist eine anfrage an den wegdienst');
assert.match(gruppenRoutenBlatt, /if \(gruppe\.punkte\.length < 3\) continue/, 'zwei halte sind noch keine route');
assert.match(haufungsBlatt, /useGruppenRouten\(/, 'das gruppenblatt benutzt die tabelle');
assert.match(haufungsBlatt, /routenvorschlag\(/, 'und ordnet die halte nach den minuten');
assert.match(haufungsBlatt, /vorgeschlagene route ·/, 'die kopfzeile sagt, was sie vorschlägt');
assert.match(haufungsBlatt, /tagAenderung\(eintraege, gruppe, datum\)/, 'auf den tag kommt nur, was einer angefaßt hat');
assert.ok(!/eintragAendern\([^)]*date:/.test(haufungsBlatt), 'der vorschlag setzt keinen tag von selbst');

console.log(`🎉 Neues Fundament hält – ${dateien.length} Dateien (${dateien.reduce((s, d) => s + text(d).split('\n').length, 0)} Zeilen), ${seiten.length} Seiten, ${blätter.length} Reiseblätter, kein Rest von früher`);
