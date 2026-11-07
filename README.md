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
- **`eintraege`** – alles, was in einen Kalender gehört: `art` ist `aktivitaet`, `unterkunft` oder `fahrt`. Kategorie, Titel, Tag, Zeiten, Dauer, Ort, Adresse, Punkt (lat/lng), Notiz, Preis mit eigener Währung, Buchungsnummer und -link, Foto samt Nachweis und Sortierung

Eine Unterkunft mit Check-in und Check-out (Datum wie Uhrzeit) gilt für jede Nacht dazwischen und erscheint dort automatisch – sie wird nicht für jeden Tag einzeln eingetragen. Auf dem Reisetag steht sie als eigener Bett-Block, in Listen an der violetten Kante, und die Nächte-Zeile zeigt sofort, wo noch kein Bett ist. Aktivitäten ohne Tag sind ausdrücklich erlaubt und sammeln sich unter „Ohne Tag".

Preis und Währung gehören zusammen, stehen aber je Eintrag: ein Ryokan in ¥ neben dem Zug in € ist normal. Summen und Budget laufen in der Reise-Währung, Beträge in anderer Währung werden daneben aufgezählt und nicht umgerechnet – ohne Kurs wäre das erfunden.

## Ortssuche, Bilder, Routen

Ohne jeden Schlüssel: Suche über OpenStreetMap (Nominatim), Bilder über Wikimedia Commons, Fahrtzeiten über den offenen OSRM-Dienst. Der Code merkt sich, wenn eine Quelle nicht antwortet, und schätzt die Zeit dann aus der Luftlinie – die Anzeige sagt dann „geschätzt".

Mit Schlüsseln in der Umgebung werden dieselben Stellen besser: `GOOGLE_MAPS_API_KEY` (oder `PLACES_API_KEY`) für die Ortssuche, `UNSPLASH_ACCESS_KEY` oder `PEXELS_API_KEY` für Bilder. Die Schlüssel bleiben auf dem Server, die Route `/api/orte` und `/api/bild` geben nur Namen, Punkt, Adresse und Bild weiter. Ein eigenes Foto lädt ins Blatt und wird klein gerechnet (900 px Kante), damit es nicht den Speicher sprengt.

Lizenzpflichtige Bilder behalten ihren Nachweis am Bild (`foto_nachweis`, `cover_credit`).

## Daten liegen, wo sie liegen sollen

Stehen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`, liegt alles in `reisen` und `eintraege` – offen ohne Konto, jede Person mit der Adresse kann sehen und ändern. Ohne diese Werte liegt alles auf dem Gerät und die App läuft genauso. Geschrieben wird immer erst lokal, dann online; schlägt das nach, bleibt die Änderung auf dem Gerät und eine Zeile sagt es.

`supabase/schema.sql` (oder `supabase/migrations/…`) einspielen, fertig.

Verdacht auf einen halben Stand in Supabase – eine Spalte fehlt, eine Richtlinie steht nicht, der Zwischenspeicher von PostgREST kennt die neue Tabelle nicht: `supabase/neu-aufbau.sql` im SQL-Editor ausführen. Der Durchgang wirft alles in `public` fort, legt die zwei Blätter neu an, stellt die Rechte zu und prüft am Ende nach, dass Spalten, Kaskade, Index und Richtlinien wirklich dastehen – passt etwas nicht, bricht er ab, statt ein halbes Blatt zurückzulassen. Vorher in der App unter Profil „als Datei sichern“ drücken, danach wieder laden; das Gerät wird beim nächsten Öffnen vom leeren Online-Stand ersetzt. Abgespielt wird die Datei nie von sich aus (der Workflow sieht nur `supabase/migrations/` vor). Ein GitHub-Workflow überträgt Änderungen an `supabase/migrations/` automatisch, wenn `SUPABASE_ACCESS_TOKEN` und `SUPABASE_PROJECT_REF` als Secrets gesetzt sind.

## Betreiben

```bash
npm install
npm run dev            # http://localhost:3000
npm run build
npm run test:all       # Typen, Rechenblatt, Suche und Bild, Layout, Sql, Listen im Speicher, alle Seiten
```

Auf Vercel reicht das Projekt verbinden; die vier Umgebungswerte sind optional. Region `fra1` in `vercel.json`.

## Status

Unten in der Seitenspalte (und auf dem Handy im Profil) steht ein Satz: **Datenbank verbunden**. Er kommt nicht aus einer Annahme – `/api/status` tut eine echte winzige Abfrage und meldet die Antwortzeit. Ist der Speicher nicht erreichbar, heißt es „Datenbank nicht erreichbar“ mit einem Knopf zur erneuten Prüfung; ohne angebundenen Speicher „Auf diesem Gerät“. Beim Prüfen selbst sagt die App nichts.

## Regeln, nach denen gebaut wird

- **Mobile zuerst.** Was auf dem Handy nicht geht, ist kaputt. Keine Seite ist breiter als das Gerät, Scrollen nur da, wo es ein Zweck hat (Tagesstreifen, Kartenliste).
- **Ein Wort, ein Begriff.** Aktivität, Unterkunft, Fahrt, Reisetag, Ort. Das Feld heißt „Punkt", nie „Koordinaten".
- **Ein Aussehen pro Ding.** Prioritäten, Farben und Kategorien kommen aus `src/lib/kategorien.ts`, Kurzdatum („So 24.10.") aus `src/lib/dates.ts`; ausgeschrieben nur in Überschriften.
- **Lesen:** mindestens 13 px, Grautöne mit genug Kontrast, Namen in Reinschrift.
- **Tippen:** jede Fläche mindestens 44 px hoch; 44 px breit nur bei Knöpfen, die ein einzelnes Zeichen tragen – sonst zerdrücken sie den Text daneben. In einer Zeile stehen die Knöpfe auf dem Handy unter dem Text.
- **Menüs und Formulare** laufen als Ablage unten und werden nie abgeschnitten.
- **Das Bild des Ortes steht hinter der Reihe**, nicht daneben: hell überfangen, damit der Text ruhig bleibt, mit Nachweis des Bilddienstes darunter. Gefunden wird für den Reisetag und die Unterkünfte; übernommen (oder entfernt) wird nur, wenn jemand es im Menü sagt.
- **Nichts wird ungefragt verändert.** Vorschläge (Kategorie, Bild, Stadt aus der Adresse) stehen da, weil sie beim Tippen helfen, und lassen sich überdecken.
