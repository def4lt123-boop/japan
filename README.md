# Urlaubsplaner – Japan 🗾

Urlaubsplanung als richtige Web-App: jeder Reisetag als **nummerierte Liste** von Aktivitäten – mit **Hinweisen**, **Preisen**, **Buchungsstatus**, **Ticket-Status** und **Punkt auf der Karte** – plus Unterkünfte, Reiseverlauf, Budget und eine grafische Übersicht, die pro Tag zeigt, was geplant ist und was noch fehlt. Keine Uhrzeiten, keine Dauern: zuerst, dann, danach. Gebaut mit **Next.js + Tailwind**, gehostet auf **Vercel**, Daten optional in **Supabase (Postgres)**.

Ohne Datenbank-Zugangsdaten läuft die App im **Demo-Modus**: alle Daten liegen im Browser (localStorage), die mitgelieferte Vorlage (Japan 2025 als Referenz, Japan 2027 als Planungsreise) ist eingebaut. Sobald `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind, werden die gleichen Tabellen in Supabase gelesen/geschrieben. Auf der Seite selbst steht dazu nur der Status **„Datenbank verbunden"** – alle Einrichtungsdoku liegt hier im README, nicht im UI.

---

## Was die App kann

Fünf Reiter, alles Wichtige vorn, der Rest hinter `⋯`. Vorn liegt ein Knopf, der sofort tut, was man meint: **＋ Idee** öffnet die neue Aktivität – Unterkunft, Flug & Zug und Ausgabe daneben im `⋯`. Wer die Reise startet, bekommt den sechsten Reiter dazu (**🚶 Unterwegs**).

**Das Modell:** ein Tag ist eine Liste. Punkte werden angehängt, gezogen oder mit ▲▼ verschoben – die Nummer ist die Reihenfolge. Mehr als vier Punkte an einem Tag gelten als voll. **Verteilt wird nichts automatisch** – jeder Punkt landet dort, wo du ihn ablegst.

| Reiter | Inhalt |
| --- | --- |
| 🚶 **Unterwegs** | (nur im gestarteten Modus) der Tag als App für die Hosentasche: Kopf mit **Ring um die Tagesnummer** (*Tag 3 von 40*, der Ring ist der Tagesfortschritt), Stadt und Bett in der Farbe der Nacht, darunter **die ganze Reise als Farbleiste** – ein Feld pro Nacht, so gefärbt wie das Bett, Löcher schraffiert, der Abreisetag markiert. Mit ◀ ▶ blätterst du zum morgen und zurück, ohne den Reiter zu wechseln. **als nächstes** ist eine Karte für sich: der erste offene Punkt, 🗺️ Hinfinden und ein ✓, das groß genug für den Daumen ist. Die Liste darunter zeigt pro Zeile nur Nummer, Name, Kategorie – **Tippen auf die Zeile** klappt Notiz, 🗺️, ✎ und ▲▼ auf. Rutscht die „als nächstes“-Karte hoch, kommt dieselbe Aufgabe als **Daumen-Leiste** von unten herein (und nur dann). Danach die **Reiseplan-Chips** der nächsten Tage, jeder ein Sprung zu dem Tag |
| 🗓️ **Tage** | **oben die Liste „Noch ohne Tag“**: jeder neue Punkt landet hier, Tag im Dropdown wählen und **✓ hinlegen** – der Punkt rutscht ans Ende dieses Tages. Darunter die Reisetage: **ein Punkt drin = Karte mit nummerierter Liste, kein Punkt drin = eine Zeile** („Di 27.10. · Osaka · frei ＋“) – sonst besteht vier Wochen Plan nur aus Scrollen. **Das Bett steht nicht als Zeile an jedem Tag**: seine Farbe läuft links am Kartenrand mit, genannt wird es am Check-in („Ankunft im … · 3 Nächte“), am Wechseltag und – als „Kein Bett eingetragen“ mit Knopf zum Eintragen – überall, wo die Nacht frei ist. Auf den Tag ziehen = ans Ende, auf eine Zeile ziehen = dort einfügen, ▲▼ = eine Stelle rauf oder runter. **Auf dem Handy funktioniert das Ziehen genauso**: Greifpunkt ⠿ (oder kurz auf den Namen drücken), der Punkt folgt dem Daumen, die Seitenskante scrollt von selbst, loslassen legt ab – derselbe Weg wie mit der Maus, nur ohne HTML5-Drag & Drop (das gibt es auf Touchscreen nicht). **＋ am Tag** hebt die Ideen von unten: Suche, Filter nach Stadt, ein Tipp und der Punkt liegt am Ende dieses Tages, darunter „Neue Aktivität anlegen“. Im `⋯` des Tages: 🗺️ Karte inline und 🧭 Tagesroute bei Google Maps · oben eine schmale Navigation mit dem Zähler je Tag |
| 🗂️ **Aktivitäten** | vorn wenig, dann die Liste: **eine Filterreihe** (Alle · Ohne Tag · Ticket offen · ★ Muss · ☆ Soll · · Kann · Ohne Karte), darunter Suche und Stadt in einer Zeile, der Erklärtext hinter **ⓘ**. Oben, was noch **ohne Tag** ist – der Kasten zeigt sich nur, wenn wirklich einer da ist –, darunter die Tage mit ihrer Nummer. Tag, **🏷️ Kategorie**, Ticket und Status direkt in der Zeile (ein Dropdown, kein Tippen) – **derselbe Punkt zweimal am selben Tag wird abgewiesen** |
| 🗺️ **Karte** | Marker (Farbe = Kategorie, hohle Kontur = noch ohne Tag), Route des Tages als Linie, 🏨 Unterkünfte · **Hintergrund: offene OpenStreetMap-Kacheln** – kein API-Key, keine Testphase, keine Rechnung, dunkel gefiltert oder hell umschaltbar · rechte Spalte dieselbe Ansicht bei Google Maps, Punkte ohne Ort lassen sich einzeln oder auf einen Schlag suchen · **Filter nach Tag, Stadt und Kategorie**, im Popup des Punktes die Kategorie gleich umstellen |
| 🧳 **Reise** | Unterkünfte · Fahrten · Kosten in einem Screen (Umschalter oben), darunter alle Downloads: CSV, JSON, KML |
| 📊 **Übersicht** | grafische Reisekarte: Bett-Band über alle Tage, jeder Tag als Feld mit Zähler und Säulenhöhe, Ring „Planungsgrad“, Checklist „was noch fehlt“ und „was noch frei ist“ |

Kategorien sind ein **Dropdown** mit 16 festen Begriffen plus allem, was in der Reise schon drinsteht – nichts verschwindet. **🏷️ automatisch kategorisieren** (unten in der Karten-Legende und im `⋯`-Menü) gibt allen Punkten, die noch keinen passenden Begriff haben, eine Kategorie aus Name und Notiz; was schon sauber dasteht, wird nicht angefasst.

**Unterwegs ist für den Daumen gemacht**: Farbe kommt von den Betten und Kategorien, Bewegung nur dort, wo sie etwas bestätigt – ✓ lässt den Haken federn und die Zeile kurz aufleuchten, Ring und Balken wachsen mit, die Daumen-Leiste gleitet hoch, die Karten des Tages staffeln sich beim Laden. Das alles ist CSS in `globals.css` (`.rise`, `.check-pop`, `.done-sweep`, `.ring-fill`, `.sticky-next`) ohne eine einzige Bibliothek, und `prefers-reduced-motion` schaltet die Bewegungen ab – die Farben bleiben.

**Alles wird getippt, also ist das Tippen der Weg.** In jeder neuen Maske steht außer dem Namen schon so viel wie möglich da: Tag und Stadt kommen aus dem Bett des Tages, Status und Kategorie bleiben vom letzten Punkt, die neue Aktivität rutscht ans Ende der Tagesliste (die Tipp-Reihenfolge ist die Reihenfolge) und in 📋 Tabelle lässt sich die Stelle auch eintippen – 3 und Enter, der Rest des Tages zieht nach. **✓ speichern & weiter** in Aktivität, Unterkunft und Ausgabe schließt das Formular nicht, sondern leert nur das Nötigste: weiter geht's zum nächsten Punkt, zum nächsten Bett (Check-in schon am alten Check-out) oder zum nächsten Bon (Datum, Kategorie und Zahler bleiben stehen). Beim Verlassen rechnet die Maske ¥ → € und zeigt den Umrechnerkurs, ⌘↵ speichert wie immer.

**Wer war in Vorleistung?** ist ein Feld, das mehrere Köpfe annimmt: `Satzi / Anna` teilt die Ausgabe durch zwei, `Satzi / Satzi / Anna` heißt – Satzi trug zwei der drei Anteile. Auf 💶 Kosten steht daraus die Rechnung: wer vorgestreckt hat, was ein Kopf tragen müsste und wer wem was zurückgibt. Ausgaben ohne Zahler laufen nicht mit, sie werden genannt.

Jedes `⋯`-Menü sitzt am **Viewport** verankert – auf dem Handy als Blech von unten mit großen Feldern, auf dem Desktop als Panel, das nie über den Rand läuft und sich nach oben öffnet, wenn darunter zu wenig Platz ist (`npm run test:layout` prüft 60 Geräte-/Knopf-Kombinationen, `npm run test:mode` das Starten und Zurücknehmen samt der 14-Tage-Grenze für den Startknopf, `npm run test:render` außerdem, dass ein leerer Tag eine Zeile ist (13 Zeilen statt 13 Karten auf der Beispielreise), dass ＋ das Ideen-Blech hebt (alle Punkte ohne Tag zur Wahl, ein Tipp und die Zeile wird zur Karte) und dass „Neue Aktivität anlegen“ dort den Tag vorbelegt).

**Auf dem Handy ist die Seite so breit wie das Gerät.** Kein Raster, keine Zeile und keine Tabelle ragt über den Bildschirm: jedes Raster hat nach unten eine echte Spalte (`grid-cols-1`), lange Texte brechen um oder enden mit „…“, Tabellen scrollen im eigenen Rahmen, und die Bediengruppe einer Aktivität rückt unter den Text, wenn der Platz nicht reicht. Die Reiter liegen auf dem Handy deshalb als **feste Leiste unten** – Icon über einem kurzen Wort, alle Bereiche gleich breit nebeneinander, kein seitliches Wischen, über der Sicherheitskante des Geräts; ab Tabletgröße stehen sie wieder oben. Menü, «als nächstes»-Leiste und die Meldung unten heben sich um genau diese Leiste (`--dock`). Was vor einer Liste steht, bleibt knapp: auf dem Aktivitäten-Reiter sind es drei Zeilen – Titel mit Zahl, Filterreihe, Suche – und die Filterreihe ist eine **durchziehbare Zeile** (`.filter-row`) statt zwei Chip-Reihen. `npm run test:layout` misst deshalb vier Sachen nach: die Menü-Position über 60 Geräte-/Knopf-Kombinationen, jedes Reiter-Label in der schmalsten Spalte (320–430 px, 5 und 6 Reiter), den Quelltext auf die drei Muster, die schon einmal rausgewachsen sind, und jede Zeile davon auf Schrift, Kontrast, Datumsformat und dieselben drei Prioritätsworte.

**Ein Format, ein Wort – über die ganze Seite.** Ein Datum in einer Liste ist immer `Sa 24.10.` (`fmtDay`), ausgeschrieben (`Samstag, 24. Oktober`) nur, wo eine Überschrift steht – gebaut wird das Kurzdatum an einer Stelle und nicht nebenbei. Die Priorität hat drei Stufen, und jede heißt an jeder Stelle gleich: **★ Muss · ☆ Soll · · Kann** – in der Filterreihe, am Punkt in der Liste, im Ideen-Blech, im Formular und im Dropdown der Tabelle; es gibt kein Symbol allein und kein Wort ohne Symbol (`PriorityTag`, `.prio`). Städte- und Unterkunftsnamen stehen in Reinschrift: „ osaka “ wird `Osaka`, „hotel osaka“ wird `Hotel Osaka`, gemischt schreibt sich nichts, weil beim Speichern *und* beim Anzeigen derselbe Schritt drüberläuft (`properName`; Abkürzungen wie `JR Pass` bleiben, wie sie sind, und Aktivitätsnamen sowieso – wer „teamLab“ tippt, bekommt teamLab). Fürs Handy schließlich: Grautext ist mindestens `slate-400` (**7:1** auf der dunklen Karte; `slate-500` wären 3,8:1), nichts auf dem Schirm ist kleiner als **13px** (winzige Schrift in Hitzefeld, Nacht-Streifen, Kalender und Kartenrand ist mit `mikro` als Ausnahme gemeldet), und jede Tippfläche ist auf dem Touch-Gerät mindestens **44 × 44px** – Knöpfe, Greifpunkte, Felder und die Zeile eines leeren Tags.

Zwei Zustände, ein Reiseplan: **🗓️ planen** und **🚶 unterwegs**. **▶️ Reise starten** (im `⋯`-Menü und auf der Reisekarte – oben rechts als eigener Knopf **nur, wenn der Reisebeginn weniger als 14 Tage entfernt ist**, `startIsNear`) setzt Tag 1 auf heute – liegt der geplante Zeitraum in der Zukunft oder schon vorbei, rutschen Punkte, Nächte, Fahrten und Ausgaben komplett mit, Reihenfolge und Abstände bleiben gleich; der alte Zeitraum wird gemerkt. Die Unterwegs-Seite wird damit zur Tages-App für die Hosentasche: Ort, Hinweise, Ticket-Status, 🗺️ Route, ✓ – und darunter der Reiseplan der nächsten Tage. **✕ Reise beenden** dreht das um: alles bleibt, was abgehakt ist, die Daten bleiben stehen. **↩ Start zurücknehmen** (nur im `⋯`, wenn ein alter Zeitraum gemerkt ist) schiebt den Plan zusätzlich auf die ursprünglichen Daten zurück, als wäre nie gestartet worden. Archivierte Reisen lassen sich nicht starten.

**🖨️ Tages-Ausdruck** (im `⋯`-Menü) schreibt die Reise auf Papier neu: ein Blatt pro Tag mit der nummerierten Liste, dem Bett der Nacht samt Adresse, den Maps-Links und – wenn gewünscht – den Wünschen ohne Tag zum Ankreuzen. **🧯 Reise prüfen** (ebenfalls im `⋯`) hält Zeiträume, Betten und Tage gegen sich selbst: Nächte ohne Bett, Nächte mit zwei Betten, Punkte neben dem Reisezeitraum und ein Plan, der komplett um ein, zwei Tage verrutscht ist. Nichts davon wird von selbst geändert – jeder Befund hat seinen Knopf, und der zeigt vorher im `⋯`-Menü, wie viel er gefunden hat.

Der **Nächte-Check** auf der Unterkünfte-Seite zeigt jede Nacht der Reise als Kachel – eingefärbt in der Farbe der Unterkunft, mit einer neuen Gruppe dort, wo das Bett wechselt. Eine Nacht antippen öffnet das Bett (oder trägt für eine Lücke sofort eines ein, Stadt aus der Nachbar-Nacht vorbelegt). Auf 🗓️ Tage steht dieselbe Information als farbige Zeile unter den Fahrten des Tages. Gezählt wird bis einen Tag vor Abreise – die Nacht am Abreisetag ist keine Nacht mehr.

**Wo du bist, steht in den Betten.** Die Stadt eines Tages ist die Stadt der Unterkunft, die diese Nacht deckt; wechselt sie, ist das der Ortswechsel – es gibt dafür kein Formular und nichts einzutragen. Trägst du in einer anderen Stadt ein Bett ein, das mitten in einen alten Block fällt, endet der Block an diesem Check-in von selbst (zwei Betten in derselben Stadt, etwa Osaka plus USJ-Nacht, bleiben beide stehen). Die Wechsel stehen chronologisch auf 🏨 Unterkünfte und als schmaler Streifen auf 🗓️ Tage und 🚶 Unterwegs; die Fahrt an dem Tag wird angehängt, wenn sie schon im Fahrten-Log steht, sonst kommt 🚄 *Fahrt fehlt*.

Immer nur zwei Knöpfe oben rechts: **＋ Anlegen** (Aktivität, Unterkunft, Fahrt, Ausgabe – mit kurzer Erklärung, was die Kachel tut) und
**⋯** (Reise bearbeiten, Punkte nachziehen, alle Tage sortieren, als Tabelle öffnen, exportieren, drucken). Feinfilter, Tabellenansicht,
Einzel screens (`/tabelle`, `/unterkuenfte`, `/kosten`, `/verlauf`) und der Druckbogen hängen dahinter bzw. unter denselben Deep-Links.

### Begriffe
**Aktivität** = ein Punkt im Programm (sehen, essen, baden, Ticket lösen) · **Unterkunft** = Bett für eine oder mehrere Nächte ·
**Fahrt** = der Weg von einer Stadt zur nächsten (Flug, Shinkansen, Fähre) · **Ausgabe** = Geld, das sonst geflossen ist.

### Google Maps
Jedes Formular zeigt beim Tippen die **Karte von Google Maps direkt im Formular** (Einbettung `maps.google.com/…&output=embed`, kein
API-Key, keine Abrechnung): erst die Suche nach Name + Stadt, sobald ein Punkt gesetzt ist der Ort selbst. Einen
**Google-Maps-Link** kannst du direkt einfügen (`…/@35.6597,139.7007,17z`, `?query=lat,lng`, `!3d…!4d…`, rohe `35.6597, 139.7007`) –
die Zahlen werden automatisch extrahiert. „öffnen ↗“ führt in die große Ansicht (Adresse, Öffnungszeiten, Navi). Der Tagesplan und die
Karte bieten zusätzlich die **Route über alle Punkte eines Tages** (Unterkunft → Stopps in geplanter Reihenfolge, bis zu 9 Zwischenhalte,
Fahrplan über `travelmode=transit`), und der Export-Knopf schreibt eine **KML-Datei** für Google My Maps. Auf 🗺️-Symbol einer Karte
erscheint die Google-Ansicht des Punktes auch inline. In der Oberfläche gibt es dafür nur noch „Punkt in Google Maps auswählen“ – die Zahlen dahinter (`maps_query`, `lat`, `lng`) bleiben in der Datenbank stehen, werden aber nirgends mehr eingegeben.

## Lokal starten

```bash
npm install
npm run dev          # http://localhost:3000  (Demo-Modus, ohne Datenbank)

npm run build        # Produktions-Build (Next.js)
npm run test:store   # Daten-Logik in jsdom: Seed, CRUD, Duplizieren, Persistenz
npm run test:render  # alle Seiten + Formulare werden wirklich gerendert
npm run test:dayplan # Rechenprobe: Liste, Reihenfolge, Duplikate
npm run test:dates   # Tage & Nächte – absichtlich in Europe/Vienna, ohne UTC-Sprung
npm run test:checks  # Prüfrundgang: Löcher, Doppelbetten, versetzter Zeitraum
npm run test:today   # Reisetage, Stadt des Tages und die Umzüge aus den Betten
npm run test:shares  # Vorleistung: Namen, Anteile und Ausgleich pro Kopf
npm run test:all     # Typecheck + alle Proben
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
Deshalb enthält `supabase/migrations/20261020000001_urlaubsplaner.sql` denselben Inhalt wie `schema.sql` – generiert von `npm run seed:sql`, du musst also nie zwei Dateien pflegen. Spätere Erweiterungen liegen als eigene, idempotente Migration daneben (z. B. `20261022000003_unterwegs_modus.sql` für ▶️ Unterwegs); `supabase/setup.sql` enthält alles zusammen und darf deshalb mehrfach ausgeführt werden. Fehlt eine Spalte noch, schreibt die App einfach ohne sie weiter und zeigt den Modus aus den Daten, die da sind.
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
src/lib/planner.ts        eine Reise in eine neue übernehmen (Tage mitnehmen, Status zurücksetzen) – es wird nichts verteilt
src/lib/store.tsx         React-Context: lädt Supabase ODER localStorage, alle CRUD-Aufrufe
src/lib/geocode.ts        Nominatim-Suche + Google-Maps-URL-Parser
src/lib/stats.ts          Kosten, Nächte-Check (ganze Reise, Lücken inklusive), Tagesplanung, leere Tage
src/lib/palette.ts        eine Farbe pro Unterkunft – Nächte-Check, Tageskarte und Betten-Band nutzen dieselbe
src/lib/dayplan.ts        der Tag als nummerierte Liste: anhängen, einfügen, ▲▼, Duplikatschutz
src/lib/overview.ts       Tagesraster, Hotel-Bänder, Baustellen-Liste, freie Kapazität (Punkte pro Tag)
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
- Ziehen & Ablegen: Punkt auf einen Tag ziehen = ans Ende der Liste, auf eine Zeile ziehen = dort einfügen
- `Esc` schließt ein Menü, ein Klick auf das Ticket-Symbol schaltet es weiter

## Anmerkungen zur Vorlage

Die 2025-Daten sind der übernommene Planungsstand – inklusive der Stellen, die schon damals offen waren (z. B. „Hōsen-in“ bei Shiga statt Ohara/Kyoto; Okinawa: 1 Nacht/55 € vs. 7-Tage-Block; 1.050 € beim 02.04. ohne Zweck). Genau diese Punkte stehen in den **Hinweisen** der Einträge, damit sie für die neue Reise geklärt werden – die Übersichtsseite sammelt sie unter „Was noch fehlen würde“. Die beiden Hakodate-Punkte (Berg Yōmei, Morgenmarkt) sind als Ergänzung markiert, weil für Hakodate nichts geplant war.

**Keine Herkunfts-Vermerke:** in den Notizen stehen nur Reise-Infos, nicht wo sie früher standen. Falls deine Datenbank noch ältere Notiz-Texte hat: `supabase/refresh-notes.sql` im SQL-Editor ausführen – bereinigt auch die kopierten Zeilen der neuen Reise, ist idempotent und überschreibt sonst nichts. Die Datei entsteht aus derselben Quelle wie der Seed → `python3 scripts/clean-notes.py`.
