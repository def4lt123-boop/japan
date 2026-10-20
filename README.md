# Urlaubsplaner – Japan 🗾

Aus der alten Google-Tabelle („Reiseplan“) wurde eine richtige Web-App: Reisetage, Orte mit **Fahrzeit ab Hotel**, **Dauer**, **Tageszeit**, **Hinweisen**, **Preisen**, **Buchungsstatus** und **Google-Maps-Koordinaten** – plus Unterkünfte, Reiseverlauf und Budget. Gebaut mit **Next.js + Tailwind**, gehostet auf **Vercel**, Daten optional in **Supabase (Postgres)**.

Ohne Datenbank-Zugangsdaten läuft die App im **Demo-Modus**: alle Daten liegen im Browser (localStorage), die Vorlage (Japan 2025) ist 1:1 aus der Tabelle übernommen. Sobald `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind, werden die gleichen Tabellen in Supabase gelesen/geschrieben.

---

## Was die App kann

| Bereich | Inhalt |
| --- | --- |
| 🗓️ **Tage** | Tagesplan pro Reisetag, Einträge per **Drag & Drop** verschieben (mobil ◀ ▶), Tagesauslastung in Stunden, Hotel der Nacht + Etappen (Flug/Zug) direkt am Tag, ✓ erledigt |
| ✨ **Wünscheliste** | alles ohne Tag; pro Eintrag Tag zuweisen, **⚡ Automatisch verteilen**, Koordinaten nachziehen |
| 📊 **Tabelle** | Ansicht wie in Google Sheets: sortierbare Spalten, Inline-Edit (Datum/Status/Prio), Filter + Suche, **CSV-Export** (Semikolon, de-DE → wieder nach Sheets/Excel importierbar) |
| 🗺️ **Karte** | Marker aus den Koordinaten (Farbe = Kategorie, hohl = ohne Tag), Route des gewählten Tages als Linie, Unterkünfte als 🏨-Marker, Popup mit Details + Maps/Route-Links |
| 🏨 **Unterkünfte** | Nächte, Gesamtpreis, € / Nacht, € / Person / Nacht, **Nächte-Check** (welche Nacht hat kein Hotel?), Preisvergleich-Balken |
| 💶 **Kosten** | Budgetauslastung, aufgeschlüsselt nach Unterkunft / Transport / Tickets / Ausgaben, Yen-Umrechnung mit einstellbarem Kurs, „wer hat vorgestreckt“ + Ausgleich |
| 🚄 **Reiseverlauf** | Etappen (Ankunft, Shinkansen, Flüge, Hotelwechsel) inkl. Preis und Nights – wie die rechte Spaltengruppe in der Tabelle |
| ⚙ **Reisen** | mehrere Reisen, **duplizieren** (neues Jahr = alte Reise als Vorlage, Wochentage bleiben gleich), archivieren, Budget/¥-Kurs/Personen |

Jeder Eintrag speichert zusätzlich `maps_query`, `lat`, `lng`: Koordinaten lassen sich per **OpenStreetMap-Suche** füllen oder indem du einen **Google-Maps-Link einfügst** (`…/@35.6597,139.7007,17z`, `?query=lat,lng`, `!3d…!4d…`, rohe `35.6597, 139.7007`) – das Formular extrahiert die Zahlen automatisch.

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

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. **SQL-Editor** → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen (Tabellen, Sichten, RLS-Policies, Realtime).
3. Optional die Vorjahresdaten laden: [`supabase/seed.sql`](supabase/seed.sql) ausführen (damit steht „Japan 2025“ inklusive kopierter Reise 2026 sofort bereit).
4. `.env.local` anlegen (lokal) bzw. Vercel → *Settings → Environment Variables*:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
   ```

5. Neu deployen – der Header zeigt dann **„Supabase verbunden“**.

> Ohne Seed-Dateien: beim ersten Start in eine leere Datenbank lädt die App `data/seed.json` automatisch hoch.

### Sicherheit

Die Schema-Datei öffnet Lese-/Schreibrecht für den Anon-Key (praktisch für eine persönliche App, **aber**: jeder mit dem Key darf schreiben). Für ein privates Tool: Supabase-Auth einschalten, Policies auf `to authenticated` ändern und die anon-Policies löschen – die App nutzt weiterhin nur den Anon-Key und funktioniert 1:1 weiter, sobald du `supaSelect/supaUpsert` in [`src/lib/supabase.ts`](src/lib/supabase.ts) um einen Login erweiterst.

## Datenhaltung / Architektur

```
data/seed.json            Vorlage aus der Google-Tabelle (Reisen, Orte, Hotels, Etappen, Ausgaben)
src/lib/types.ts          Feldnamen = Datenbankspalten (snake_case) → kein Mapping nötig
src/lib/supabase.ts       Client, Spaltenlisten, select/upsert/patch/delete
src/lib/seed.ts           Seed + „Reise duplizieren“ (Tage verschieben, Status zurücksetzen)
src/lib/planner.ts        Automatisch verteilen, Stadt→Tage-Ableitung inkl. Alias-Regeln (Nara → Osaka, Kamakura → Tokio …)
src/lib/store.tsx         React-Context: lädt Supabase ODER localStorage, alle CRUD-Aufrufe
src/lib/geocode.ts        Nominatim-Suche + Google-Maps-URL-Parser
src/lib/stats.ts          Kosten, Nächte-Check, Tagesplanung, leere Tage
src/app/page.tsx          Reisen-Übersicht (anlegen, duplizieren, öffnen)
src/app/t/[tripId]/*      Reise-Workspace mit Tabs
supabase/schema.sql       Tabellen + Sichten + Policies
supabase/seed.sql         erzeugt aus data/seed.json via: node scripts/emit-seed-sql.mjs
```

Änderungen an `data/seed.json` immer mit `node scripts/emit-seed-sql.mjs` in SQL spiegeln.

## Kurz-Tastatur

- `Esc` schließt ein Formular, `⌘/Ctrl + Enter` speichert
- Ziehen & Ablegen: Karte auf einen Tagesrahmen ziehen = neuer Tag; auf „Wünscheliste“ = Tag entfernen

## Anmerkungen zur Vorlage

Die 2025-Daten sind so übernommen, wie sie in der Tabelle standen – auch die offenen Punkte (z. B. „Hōsen-in“ stand bei Shiga, liegt aber in Ohara/Kyoto; Okinawa: 1 Nacht/55 € vs. 7-Tage-Block; 1.050 € beim 02.04. ohne Zweck). Solche Stellen sind in den Hinweisen markiert, damit sie in der neuen Reise geklärt werden können. Die beiden Hakodate-Punkte (Berg Yōmei, Morgenmarkt) wurden als Vorschlag ergänzt, weil für Hakodate gar nichts geplant war.
