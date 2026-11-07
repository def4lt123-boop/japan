# Reiseplan

Ein universeller Reiseplaner fürs Handy: Reisen anlegen, Tage füllen, Unterkünfte gelten lassen, Orte auf der Karte. Kein Konto, keine App – eine Web-App, die sich wie eine anfühlt.

## Was drin ist

| Bereich | Seite | Was dort passiert |
| --- | --- | --- |
| Dashboard | `/` | Begrüßung, die laufende oder nächste Reise als Titelkarte, was noch fehlt, frühere Reisen |
| Meine Reisen | `/reisen` | suchen, blättern (geplant · läuft · vergangen · Archiv), anlegen, ins Archiv, löschen |
| Reise anlegen | `/reisen/neu` | Name, Land, Ziele, zwei Termine, Budget, Währung, Titelbild – mehr nicht nötig |
| Kalender | `/t/<reise>/kalender` | Tag, Woche oder die ganze Reise als Zeitleiste, dazu immer das Monatsbild mit Punkten |
| Reisetag | `/t/<reise>/tag/<datum>` | die Zeitleiste des Tages: Uhrzeit, Bild, Ort, Weg zum nächsten Punkt, dazu die Nacht ins Bett |
| Aktivitäten | `/t/<reise>/liste` | alle Orte der Reise, gefiltert nach Kategorie oder Tag, auch ohne Tag |
| Unterkünfte | `/t/<reise>/hotels` | Betten mit Check-in und Check-out – die Nächte dazwischen füllen sich von selbst |
| Karte | `/t/<reise>/karte` | nummerierte Nadeln in Kategoriefarbe, Weg des Tages, Punkt antippen öffnet das Blatt |
| Reisedaten | `/t/<reise>/daten` | die Reise selbst ändern, Prüfliste, Archiv und Löschen |
| Profil | `/profil` | Ansprache, Standardwährung, Personen, Bilder an oder aus, Sicherung als Datei |

Die untere Leiste führt auf dem Handy durch Dashboard, Reisen, Kalender, Karte und Profil; ab dem Rechner steht sie als Spalte links. „Kalender" und „Karte" öffnen dabei die Reise, die zuletzt offen war.

## Datenmodell

Zwei Tabellen, Feldnamen identisch zu `src/lib/types.ts`:

- **`reisen`** – Name, Land, Stationen, Zeitraum, Titelbild samt Nachweis, Beschreibung, Budget, Währung, Personen, Archiv
- **`eintraege`** – alles, was in einen Kalender gehört: `art` ist `aktivitaet`, `unterkunft` oder `fahrt`. Kategorie, Titel, Tag, Zeiten, Dauer, Ort, Adresse, Punkt (lat/lng), Notiz, Preis, Buchung, Foto und Sortierung

Eine Unterkunft mit Check-in und Check-out gilt für jede Nacht dazwischen und erscheint dort automatisch – sie wird nicht für jeden Tag einzeln eingetragen. Aktivitäten ohne Tag sind ausdrücklich erlaubt und sammeln sich unter „Ohne Tag".

## Ortssuche, Bilder, Routen

Ohne jeden Schlüssel: Suche über OpenStreetMap (Nominatim), Bilder über Wikimedia Commons, Fahrtzeiten über den offenen OSRM-Dienst. Der Code merkt sich, wenn eine Quelle nicht antwortet, und schätzt die Zeit dann aus der Luftlinie – die Anzeige sagt dann „geschätzt".

Mit Schlüsseln in der Umgebung werden dieselben Stellen besser: `GOOGLE_MAPS_API_KEY` (oder `PLACES_API_KEY`) für die Ortssuche, `UNSPLASH_ACCESS_KEY` oder `PEXELS_API_KEY` für Bilder. Die Schlüssel bleiben auf dem Server, die Route `/api/orte` und `/api/bild` geben nur Namen, Punkt, Adresse und Bild weiter. Ein eigenes Foto lädt ins Blatt und wird klein gerechnet (900 px Kante), damit es nicht den Speicher sprengt.

Lizenzpflichtige Bilder behalten ihren Nachweis am Bild (`foto_nachweis`, `cover_credit`).

## Daten liegen, wo sie liegen sollen

Stehen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`, liegt alles in `reisen` und `eintraege` – offen ohne Konto, jede Person mit der Adresse kann sehen und ändern. Ohne diese Werte liegt alles auf dem Gerät und die App läuft genauso. Geschrieben wird immer erst lokal, dann online; schlägt das nach, bleibt die Änderung auf dem Gerät und eine Zeile sagt es.

`supabase/schema.sql` (oder `supabase/migrations/…`) einspielen, fertig. Ein GitHub-Workflow überträgt Änderungen an `supabase/migrations/` automatisch, wenn `SUPABASE_ACCESS_TOKEN` und `SUPABASE_PROJECT_REF` als Secrets gesetzt sind.

## Betreiben

```bash
npm install
npm run dev            # http://localhost:3000
npm run build
npm run test:all       # Typen, Rechenblatt, Suche und Bild, Layout, alle Seiten
```

Auf Vercel reicht das Projekt verbinden; die vier Umgebungswerte sind optional. Region `fra1` in `vercel.json`.

## Regeln, nach denen gebaut wird

- **Mobile zuerst.** Was auf dem Handy nicht geht, ist kaputt. Keine Seite ist breiter als das Gerät, Scrollen nur da, wo es ein Zweck hat (Tagesstreifen, Kartenliste).
- **Ein Wort, ein Begriff.** Aktivität, Unterkunft, Fahrt, Reisetag, Ort. Das Feld heißt „Punkt", nie „Koordinaten".
- **Ein Aussehen pro Ding.** Prioritäten, Farben und Kategorien kommen aus `src/lib/kategorien.ts`, Kurzdatum („So 24.10.") aus `src/lib/dates.ts`; ausgeschrieben nur in Überschriften.
- **Lesen:** mindestens 13 px, Grautöne mit genug Kontrast, Namen in Reinschrift.
- **Tippen:** jede Fläche mindestens 44 px hoch; 44 px breit nur bei Knöpfen, die ein einzelnes Zeichen tragen – sonst zerdrücken sie den Text daneben. In einer Zeile stehen die Knöpfe auf dem Handy unter dem Text.
- **Menüs und Formulare** laufen als Ablage unten und werden nie abgeschnitten.
- **Nichts wird ungefragt verändert.** Vorschläge (Kategorie, Bild, Stadt aus der Adresse) stehen da, weil sie beim Tippen helfen, und lassen sich überdecken.
