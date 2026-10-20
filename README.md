# Urlaubsplaner – Japan 🗾

Urlaubsplanung als richtige Web-App: Reisetage, Aktivitäten mit **Fahrzeit ab Hotel**, **Dauer**, **Tageszeit**, **Hinweisen**, **Preisen**, **Buchungsstatus** und **Google-Maps-Koordinaten** – plus Unterkünfte, Reiseverlauf, Budget und eine grafische Übersicht, die pro Tag zeigt, was geplant ist und was noch fehlt. Gebaut mit **Next.js + Tailwind**, gehostet auf **Vercel**, Daten optional in **Supabase (Postgres)**.

Ohne Datenbank-Zugangsdaten läuft die App im **Demo-Modus**: alle Daten liegen im Browser (localStorage), die mitgelieferte Vorlage (Japan 2025 als Referenz, Japan 2027 als Planungsreise) ist eingebaut. Sobald `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind, werden die gleichen Tabellen in Supabase gelesen/geschrieben. Auf der Seite selbst steht dazu nur der Status **„Datenbank verbunden"** – alle Einrichtungsdoku liegt hier im README, nicht im UI.

---

## Was die App kann

| Bereich | Inhalt |
| --- | --- |
| 🏠 **Übersicht** | **grafische Reisekarte**: Band über alle Reisetage (Bett-Balken pro Unterkunft, Nächte mit/ohne Quartier, Fahrten-Icons, Auslastungssäulen) · **jeder Tag als Zeitbild** auf der Achse 07–23 Uhr (Balken = Eintrag, gestrichelt = ohne feste Uhrzeit, rot umrandet = Muss noch offen) · **Ring „Planungsgrad“** mit Checklist „was noch fehlen würde" (Nächte, Termine, Tickets, Preise, Fahrzeiten, Koordinaten, Fahrten mit Uhrzeit, Tickets, Budget) · **„was noch verfügbar ist"**: freie Tage, Luft pro Tag, Punkte/Nächte-Balance pro Stadt, ⚡ Wünsche auf freie Tage legen, offene Buchungen mit Link |
| 🗓️ **Tage** | Tagesplan pro Reisetag, Einträge per **Drag & Drop** verschieben (mobil ◀ ▶), Tagesband mit den verplanten Abschnitten (Lücke anklicken = oberster Wunsch rutscht dorthin), Hotel der Nacht + Fahrten (Flug/Zug) direkt am Tag · 🗺️ eingeblendete Google-Maps-Karte mit der Tagesroute, ✓ erledigt |
| 🗂️ **Aktivitäten** | alles als Liste untereinander: oben, was noch **ohne Tag** ist, darunter die Tage mit ihrem belegten Zeitfenster · Tag, Uhrzeit und Dauer direkt in der Zeile · **Doppelplanung wird abgewiesen**, belegte Zeiten rutschen in die nächste Lücke · ⚡ automatisch verteilen |
| 📊 **Tabelle** | alle Felder als Zeilen: sortierbare Spalten, Inline-Edit (Datum/Status/Ticket/Prio), Filter + Suche, **CSV-Export** (Semikolon, de-DE → in jedes Tabellenprogramm importierbar) |
| 🗺️ **Karte** | Marker aus den Koordinaten (Farbe = Kategorie, hohl = ohne Tag), Route des gewählten Tages als Linie, Unterkünfte als 🏨-Marker, Popup mit Details · rechte Spalte: **dieselbe Ansicht bei Google Maps** (Einbettung ohne API-Key) für Auswahl oder Tagesroute, oben der Knopf **🧭 Route** |
| 🏨 **Unterkünfte** | Nächte, Gesamtpreis, € / Nacht, € / Person / Nacht, **Nächte-Check** (welche Nacht hat kein Hotel?), Preisvergleich-Balken |
| 💶 **Kosten** | Budgetauslastung, aufgeschlüsselt nach Unterkunft / Transport / Tickets / Ausgaben, Yen-Umrechnung mit einstellbarem Kurs, „wer hat vorgestreckt“ + Ausgleich |
| 🚄 **Reiseverlauf** | Fahrten (Ankunft, Shinkansen, Flüge, Hotelwechsel) inkl. Preis, Hotel und Nächten je Halt |
| ⚙ **Reisen** | mehrere Reisen, **duplizieren** (neues Jahr = alte Reise als Vorlage, Wochentage bleiben gleich), archivieren, Budget/¥-Kurs/Personen |

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
psql "DEINE_DB_URL" -f supabase/seed.sql   # optional die Beispieldaten
```
Deshalb enthält `supabase/migrations/20261020000001_urlaubsplaner.sql` denselben Inhalt wie `schema.sql` – generiert von `npm run seed:sql`, du musst also nie zwei Dateien pflegen.
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
