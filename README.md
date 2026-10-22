# Urlaubsplaner – Japan 🗾

Urlaubsplanung als richtige Web-App: Reisetage, Aktivitäten mit **Fahrzeit ab Hotel**, **Dauer**, **Tageszeit**, **Hinweisen**, **Preisen**, **Buchungsstatus** und **Google-Maps-Koordinaten** – plus Unterkünfte, Reiseverlauf, Budget und eine grafische Übersicht, die pro Tag zeigt, was geplant ist und was noch fehlt. Gebaut mit **Next.js + Tailwind**, gehostet auf **Vercel**, Daten optional in **Supabase (Postgres)**.

Ohne Datenbank-Zugangsdaten läuft die App im **Demo-Modus**: alle Daten liegen im Browser (localStorage), die mitgelieferte Vorlage (Japan 2025 als Referenz, Japan 2027 als Planungsreise) ist eingebaut. Sobald `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind, werden die gleichen Tabellen in Supabase gelesen/geschrieben. Auf der Seite selbst steht dazu nur der Status **„Datenbank verbunden"** – alle Einrichtungsdoku liegt hier im README, nicht im UI.

---

## Was die App kann

Sechs Reiter, alles Wichtige vorn, der Rest hinter `⋯`:

| Reiter | Inhalt |
| --- | --- |
| ☀️ **Heute** / 🚶 **Unterwegs** | dieselbe Seite in zwei Zuständen. **🗓️ Planung** (nicht gestartet): was heute Morgen, mittags, nachmittags und abends dran ist, dazu die nächsten sechs Tage mit Stunden, Ort und anstehendem 🔀 Ortswechsel – und der Knopf **▶️ Reise starten**. **🚶 Unterwegs** (gestartet): der Tag als App – großer Tageskopf mit *Tag 3 von 40*, Stadt und Bett, **als nächstes** mit Uhrzeit und Fahrzeit, 🗺️ Route, ✓ abhaken, Hinweise aufgeklappt, dazu **Morgen** und der **Reiseplan** der drei nächsten Tage. Editieren ist nur noch das kleine ✎ daneben |
| 🗓️ **Tage** | **oben die Liste „Noch ohne Tag“**: jeder neue Punkt landet hier und bekommt Tag + Uhrzeit in zwei Dropdowns (der Tag mit der meisten Luft ist vorgeschlagen), ein Klick auf **✓ hinlegen** genügt – oder ⚡ verteilt alle auf einmal. Darunter ein Kartenstapel pro Reisetag: Datum, Stadt, Zahl und Programmstunden in der Zeile, **Zeitband 07–23 Uhr** mit dem belegten Tag: einen **Block ziehen** = neue Uhrzeit (15-Minuten-Schritte), am **rechten Rand ziehen** = Dauer, **Lücke anklicken** = oberster Punkt der Liste rutscht dorthin, ⇧+Pfeiltasten schieben eine Stunde. Im `⋯` des Tages: 🗺️ Karte inline, 🧭 Tagesroute bei Google Maps, **⚡ Tag sortieren** (der Reihe nach, ohne Überschneidung – feste Uhrzeiten bleiben Anker) und 🔀 **Ortswechsel an diesem Tag** · der heutige Tag ist mit einem Ring markiert |
| 🗂️ **Aktivitäten** |  alles als Liste untereinander: oben, was noch **ohne Tag** ist, darunter die Tage. Tag, Uhrzeit, Dauer und **🏷️ Kategorie direkt in der Zeile** (ein Dropdown, kein Tippen), **Doppelplanung wird abgewiesen**, belegte Zeiten rutschen in die nächste Lücke, ⚡ verteilt automatisch |
| 🗺️ **Karte** | Marker aus den Koordinaten (Farbe = Kategorie, hohle Kontur = noch ohne Tag), Route des Tages als Linie, 🏨 Unterkünfte · **Hintergrund: offene OpenStreetMap-Kacheln** – kein API-Key, keine Testphase, keine Rechnung, dunkel gefiltert oder hell umschaltbar · rechte Spalte dieselbe Ansicht bei Google Maps, Punkte ohne Koordinaten lassen sich einzeln oder auf einen Schlag nachziehen · **Filter nach Tag, Stadt und Kategorie**, im Popup des Punktes die Kategorie gleich umstellen |
| 🧳 **Reise** | Unterkünfte · Fahrten · Kosten in einem Screen (Umschalter oben), darunter alle Downloads: CSV, JSON, KML |
| 📊 **Übersicht** | grafische Reisekarte: Bett-Band über alle Tage, jeder Tag als Zeitbild, Ring „Planungsgrad“, Checklist „was noch fehlt“ und „was noch frei ist“ |

Kategorien sind ein **Dropdown** mit 16 festen Begriffen plus allem, was in der Reise schon drinsteht – nichts verschwindet. **🏷️ automatisch kategorisieren** (unten in der Karten-Legende und im `⋯`-Menü) gibt allen Punkten, die noch keinen passenden Begriff haben, eine Kategorie aus Name und Notiz; was schon sauber dasteht, wird nicht angefasst.

Jedes `⋯`-Menü sitzt am **Viewport** verankert – auf dem Handy als Blech von unten mit großen Feldern, auf dem Desktop als Panel, das nie über den Rand läuft und sich nach oben öffnet, wenn darunter zu wenig Platz ist (`npm run test:layout` prüft 60 Geräte-/Knopf-Kombinationen, `npm run test:mode` das Starten und Zurücknehmen des Unterwegs-Modus).

Zwei Zustände, ein Reiseplan: **🗓️ planen** und **🚶 unterwegs**. **▶️ Reise starten** (oben rechts, auf der Reisekarte oder im `⋯`-Menü) setzt Tag 1 auf heute – liegt der geplante Zeitraum in der Zukunft oder schon vorbei, rutschen Punkte, Nächte, Fahrten und Ausgaben komplett mit, Reihenfolge und Abstände bleiben gleich; der alte Zeitraum wird gemerkt. Die ☀️-Seite wird damit zur Tages-App für die Hosentasche: Standort, Fahrzeit vom Hotel, Hinweise, Ticket-Status, 🗺️ Route, ✓ – und darunter Morgen plus Reiseplan. **✕ Reise beenden** dreht das um: alles bleibt, was abgehakt ist, die Daten bleiben stehen. **↩ Start zurücknehmen** (nur im `⋯`, wenn ein alter Zeitraum gemerkt ist) schiebt den Plan zusätzlich auf die ursprünglichen Daten zurück, als wäre nie gestartet worden. Archivierte Reisen lassen sich nicht starten.

Der **🔀 Ortswechsel** (Unterkünfte, Karte des Tages, ⋯-Menü) trägt einen Stadtwechsel in einem Schritt ein: der Dialog zeigt, in welcher Stadt du an dem Tag schläfst, und schreibt dann die Aktivitäten (nur diesen Tag oder alles Danach), die Unterkünfte (alter Check-out, neuer Check-in, Nächte) und – wenn gewünscht – die passende Fahrt ins Fahrten-Log. Erkannte Wechsel stehen chronologisch auf der Unterkünfte-Seite und auf ☀️ Heute.

Immer nur zwei Knöpfe oben rechts: **＋ Anlegen** (Aktivität, Unterkunft, Fahrt, Ausgabe – mit kurzer Erklärung, was die Kachel tut) und
**⋯** (Reise bearbeiten, Koordinaten nachziehen, als Tabelle öffnen, exportieren, drucken). Feinfilter, Tabellenansicht,
Einzel screens (`/tabelle`, `/unterkuenfte`, `/kosten`, `/verlauf`) und der Druckbogen hängen dahinter bzw. unter denselben Deep-Links.

### Begriffe
**Aktivität** = ein Punkt im Programm (sehen, essen, baden, Ticket lösen) · **Unterkunft** = Bett für eine oder mehrere Nächte ·
**Fahrt** = der Weg von einer Stadt zur nächsten (Flug, Shinkansen, Fähre) · **Ausgabe** = Geld, das sonst geflossen ist.

### Google Maps
Jedes Formular zeigt beim Tippen die **Karte von Google Maps direkt im Formular** (Einbettung `maps.google.com/…&output=embed`, kein
API-Key, keine Abrechnung): erst die Suche nach Name + Viertel + Stadt, sobald Koordinaten da sind der Punkt selbst. Einen
**Google-Maps-Link** kannst du direkt einfügen (`…/@35.6597,139.7007,17z`, `?query=lat,lng`, `!3d…!4d…`, rohe `35.6597, 139.7007`) –
die Zahlen werden automatisch extrahiert. „öffnen ↗“ führt in die große Ansicht (Adresse, Öffnungszeiten, Navi). Der Tagesplan und die
Karte bieten zusätzlich die **Route über alle Punkte eines Tages** (Unterkunft → Stopps in geplanter Reihenfolge, bis zu 9 Zwischenhalte,
Fahrplan über `travelmode=transit`), und der Export-Knopf schreibt eine **KML-Datei** für Google My Maps. Auf 🗺️-Symbol einer Karte
erscheint die Google-Ansicht des Punktes auch inline, `maps_query`/`lat`/`lng` sitzen dafür pro Eintrag in der Datenbank.

## Lokal starten

```bash
npm install
npm run dev          # http://localhost:3000  (Demo-Modus, ohne Datenbank)

npm run build        # Produktions-Build (Next.js)
npm run test:store   # Daten-Logik in jsdom: Seed, CRUD, Duplizieren, Persistenz
npm run test:render  # alle Seiten + Formulare werden wirklich gerendert
npm run seed:sql     # data/seed.json → supabase/seed.sql
```

## Auf Vercel deployen

```bash
npm i -g vercel
vercel            # Projekt anlegen
vercel --prod     # Produktions-Deploy
```

Vercel erkennt Next.js automatisch. Es sind keine Server-Funktionen nötig (alles Client-seitig + Supabase), `output` bleibt also Standard.

## Supabase anbinden

**Nein – Supabase liest nichts aus dem Repo.** Die `.sql`-Dateien sind Vorlagen; das Schema muss einmal in die Datenbank. Die App selbst führt kein SQL aus – sie schreibt über die API (PostgREST).

### A) Ein File, ein Klick (empfohlen)

`supabase/setup.sql` enthält **alles für das erste Setup**: Tabellen + Constraints + Indizes + Sichten + RLS-Policies + deine Beispieldaten (Reise 2025 als Referenz, Reise 2027 bereits befüllt).

1. [supabase.com](https://supabase.com) → Projekt öffnen → **SQL Editor** → *New query*
2. Inhalt von [`supabase/setup.sql`](supabase/setup.sql) komplett rein kopieren → **Run**
3. Vercel → *Settings → Environment Variables* (und lokal als `.env.local`):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
   ```

4. Auf Vercel neu deployen (`vercel --prod`) – der Header in der App zeigt dann **„Supabase verbunden"**.

Der File ist idempotent (`on conflict do nothing`, Clone-Inserts nur wenn die neue Reise noch leer ist) → beliebig oft erneut ausführbar, ohne dass eigene Einträge überschrieben oder gelöscht werden.

**Nur Struktur, ohne Beispieldaten?** → [`supabase/schema.sql`](supabase/schema.sql) ausführen. Beim ersten Start in eine **leere** Datenbank lädt die App `data/seed.json` automatisch hoch – du bekommst die Vorlage also auch so.

**Nur Daten, Schema steht schon?** → [`supabase/seed.sql`](supabase/seed.sql).

### B) Supabase CLI (lokal, dasselbe Ergebnis)
```bash
npm i -g supabase
supabase login
supabase link --project-ref DEIN_REF
supabase db push            # legt Tabellen + Sichten aus supabase/migrations/ an
supabase db push --include-all  # nach einem Update: neue Spalten (z. B. ▶️ Unterwegs-Modus) fehlen sonst
psql "DEINE_DB_URL" -f supabase/seed.sql   # optional die Beispieldaten
```
Deshalb enthält `supabase/migrations/20261020000001_urlaubsplaner.sql` denselben Inhalt wie `schema.sql` – generiert von `npm run seed:sql`, du musst also nie zwei Dateien pflegen. Spätere Erweiterungen liegen als eigene, idempotente Migration daneben (z. B. `20261022000003_unterwegs_modus.sql` für ▶️ Unterwegs). **Bei einer Datenbank, die schon läuft, immer die Migration einspielen** – `setup.sql` ist für das erste Setup und ergänzt keine Spalten an bestehende Tabellen (`create table if not exists` überspringt sie). Zum Nachprüfen, was fehlt:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'trips'
  and column_name in ('started', 'started_at', 'planned_start', 'planned_end');
```

Vier Zeilen zurück = alles da. Nichts zurück = die Migration ausführen (oder die vier `alter table … add column if not exists` daraus einzeln – beide Male sicher mehrfach ausführbar). Fehlt eine Spalte noch, bricht kein Schreiben: die App lässt sie weg (hinweisend in der Konsole) und bleibt beim Planungsmodus – gestartet werden kann erst nach der Migration.
Wer so arbeitet, braucht `setup.sql` nur einmal (oder ersetzt die Migration durch den Inhalt von `setup.sql`, falls die Beispieldaten mit rein sollen).

### C) Vollautomatisch bei jedem Push
Zwei Möglichkeiten – beide nutzen `supabase/migrations/`:
* **Supabase GitHub-Integration**: im Dashboard *Integrations → GitHub* das Repo verbinden und einen Branch zuweisen. Bei jedem Push mit neuen Dateien unter `supabase/migrations/` werden die Migrationen automatisch eingespielt.
* **GitHub Actions**: [`.github/workflows/supabase-db-push.yml`](.github/workflows/supabase-db-push.yml) liegt schon im Repo. Nur die Secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (+ `SUPABASE_DB_PASSWORD` für den Pooler) anlegen – dann läuft `supabase db push` automatisch, sobald sich `supabase/` ändert. Variable `LOAD_SEED=true` setzt zusätzlich die Beispieldaten drauf.

> Die App selbst schreibt immer über die API (PostgREST) – sie braucht die SQL-Dateien nicht. Wenn du die `schema.sql` änderst: `npm run seed:sql` ausführen, committen, und der Workflow (oder `db push`) migrationiert die DB nach.

### Sicherheit
`schema.sql` öffnet Lese-/Schreibrecht für den Anon-Key (praktisch für eine persönliche App, **aber**: jeder mit dem Key darf schreiben). Für ein privates Tool: Supabase-Auth aktivieren, Policies auf `to authenticated` ändern und die anon-Policies löschen – die App nutzt weiterhin nur den Anon-Key und funktioniert 1:1 weiter, sobald du `supaSelect/supaUpsert` in [`src/lib/supabase.ts`](src/lib/supabase.ts) um einen Login erweiterst.

## Datenhaltung / Architektur

```
data/seed.json            Vorlage-Reisen (Reisen, Aktivitäten, Unterkünfte, Fahrten, Ausgaben) – Quelle für Seed & SQL
src/lib/types.ts          Feldnamen = Datenbankspalten (snake_case) → kein Mapping nötig
src/lib/supabase.ts       Client, Spaltenlisten, select/upsert/patch/delete
src/lib/seed.ts           Seed + „Reise duplizieren“ (Tage verschieben, Status zurücksetzen)
src/lib/planner.ts        Automatisch verteilen, Stadt→Tage-Ableitung inkl. Alias-Regeln (Nara → Osaka, Kamakura → Tokio …)
src/lib/store.tsx         React-Context: lädt Supabase ODER localStorage, alle CRUD-Aufrufe
src/lib/geocode.ts        Nominatim-Suche + Google-Maps-URL-Parser
src/lib/stats.ts          Kosten, Nächte-Check, Tagesplanung, leere Tage
src/lib/overview.ts       Tagesraster auf der 07–23-Achse, Hotel-Bänder, Baustellen-Liste, freie Kapazität
src/components/overview.tsx  TripRibbon · DayBoard · GapPanel · CapacityPanel (die Grafik der Übersichtsseite)
src/app/page.tsx          Reisen-Übersicht (anlegen, duplizieren, öffnen)
src/app/t/[tripId]/*      Reise-Workspace mit Tabs
supabase/setup.sql        ERSTES SETUP: schema.sql + Beispieldaten in einem File
supabase/schema.sql       Tabellen + Sichten + Policies (Quelle für alles)
supabase/migrations/*     gespiegelte schema.sql → supabase db push / CI / Git-Integration
supabase/seed.sql         Beispieldaten, erzeugt aus data/seed.json (npm run seed:sql)
supabase/refresh-notes.sql  optionales UPDATE-Script: Notizen von Altlasten befreien
```

Änderungen an `data/seed.json` immer mit `node scripts/emit-seed-sql.mjs` in SQL spiegeln.

## Kurz-Tastatur

- `Esc` schließt ein Formular, `⌘/Ctrl + Enter` speichert
- Ziehen & Ablegen: Karte auf einen Tagesrahmen ziehen = neuer Tag; auf „Wünscheliste“ = Tag entfernen

## Anmerkungen zur Vorlage

Die 2025-Daten sind der übernommene Planungsstand – inklusive der Stellen, die schon damals offen waren (z. B. „Hōsen-in“ bei Shiga statt Ohara/Kyoto; Okinawa: 1 Nacht/55 € vs. 7-Tage-Block; 1.050 € beim 02.04. ohne Zweck). Genau diese Punkte stehen in den **Hinweisen** der Einträge, damit sie für die neue Reise geklärt werden – die Übersichtsseite sammelt sie unter „Was noch fehlen würde“. Die beiden Hakodate-Punkte (Berg Yōmei, Morgenmarkt) sind als Ergänzung markiert, weil für Hakodate nichts geplant war.

**Keine Herkunfts-Vermerke:** in den Notizen stehen nur Reise-Infos, nicht wo sie früher standen. Falls deine Datenbank noch ältere Notiz-Texte hat: `supabase/refresh-notes.sql` im SQL-Editor ausführen – bereinigt auch die kopierten Zeilen der neuen Reise, ist idempotent und überschreibt sonst nichts. Die Datei entsteht aus derselben Quelle wie der Seed → `python3 scripts/clean-notes.py`.
