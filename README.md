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
| Aktivitäten | `/t/<reise>/liste` | alle Orte der Reise, gefiltert nach Kategorie oder Tag; hier kommen mehrere Punkte auf einmal rein und werden in Gruppen verteilt |
| Unterkünfte | `/t/<reise>/hotels` | Betten mit Check-in und Check-out – die Nächte dazwischen füllen sich von selbst |
| Karte | `/t/<reise>/karte` | nummerierte Nadeln in Kategoriefarbe, Weg des Tages, Punkt antippen öffnet das Blatt |
| Reisedaten | `/t/<reise>/daten` | die Reise selbst ändern, Prüfliste, Archiv und Löschen |
| Einstellungen | ⚙️ (Blatt, keine Seite) | Licht, Anrede, Standardwährung, Personen, Bilder an oder aus, Sicherung als Datei, alles löschen |

Die untere Leiste führt auf dem Handy durch Dashboard, Reisen, Kalender und Karte; ab dem Rechner steht dasselbe als Spalte links. „Kalender" und „Karte" öffnen dabei die Reise, die zuletzt offen war. Was früher ein Profil-Reiter war, ist ein Blatt geworden: ⚙️ oben rechts auf dem Dashboard und in der Seitenleiste – vier Entscheidungen füllen keine eigene Seite.

## Datenmodell

Zwei Tabellen, Feldnamen identisch zu `src/lib/types.ts`:

- **`reisen`** – Name, Land, Stationen, Zeitraum, Titelbild samt Nachweis, Beschreibung, Budget, Währung, Personen, Archiv
- **`eintraege`** – alles, was in einen Kalender gehört: `art` ist `aktivitaet`, `unterkunft` oder `fahrt`. Kategorie, Titel, Tag, Zeiten, Dauer, Ort, Adresse, Punkt (lat/lng), Notiz, Preis mit eigener Währung, Buchungsnummer und -link, Foto samt Nachweis und Sortierung

Eine Unterkunft mit Check-in und Check-out (Datum wie Uhrzeit) gilt für jede Nacht dazwischen und erscheint dort automatisch – sie wird nicht für jeden Tag einzeln eingetragen. Auf dem Reisetag steht sie als eigener Bett-Block, in Listen an der violetten Kante, und die Nächte-Zeile zeigt sofort, wo noch kein Bett ist. Aktivitäten ohne Tag sind ausdrücklich erlaubt, und das Formular drängt sie nicht mehr auf einen Tag: vorgemerkt wird ein Datum nur, wo einer gemeint ist – aus dem Kalender, von einem Reisetag, an einer Unterkunft. „🕓 ohne Tag" ist der erste Chip in der Tagzeile, ein Name genügt zum Speichern. Die Punkte sammeln sich in der Liste unter „Ohne Tag", und von dort gibt das ⋯ einer Zeile mit einem Tip einen Tag – „ohne Tag" nimmt ihn auch wieder weg.

Preis und Währung gehören zusammen, stehen aber je Eintrag: ein Ryokan in ¥ neben dem Zug in € ist normal. Summen und Budget laufen in der Reise-Währung, Beträge in anderer Währung werden daneben aufgezählt und nicht umgerechnet – ohne Kurs wäre das erfunden.

## Ortssuche, Bilder, Routen

**Ortssuche.** Ins Feld „Was?" gehören ein, zwei Wörter, wie in einer Kartensuche: „big ben", „alkazar sevilla", „hotel in kyoto". Zuerst antwortet, was der Rechner schon weiß – die Treffer aus diesem Besuch und die zuletzt benutzten Orte liegen auf dem Gerät –, daneben laufen die offenen Quellen parallel: Photon (die OpenStreetMap-Suche; denkt bei Kurznamen mit, verzeiht Kleinbuchstaben und Tippfehler) und Nominatim. Gereiht wird nach der Nähe zum getippten Wort, nicht nach der Reihenfolge der Antwort: ein voller Name schlägt eine Adresse, ein Ort schlägt eine Flächenangabe („England" statt „Big Ben"), und was nahe an der Reise liegt, schlägt dasselbe Ding in einer anderen Stadt. Derselbe Punkt von zwei Diensten bleibt ein Vorschlag. Der Server merkt sich eine Frage eine halbe Stunde und legt die Antwort an den Rand, Nominatim wird höchstens einmal pro Sekunde gefragt – tippen kostet also nichts. Ein Treffer (Tip oder Eingabetaste) nimmt Name, Adresse, Punkt und Bild mit, klein darunter steht, woher er kommt. Ist nichts zu finden, sagt die Zeile das und schickt zum Feld „Punkt“, das den Link aus Google Maps liest (siehe unten); planen lässt sich auch ohne Punkt, die Karte holt ihn nachträglich.

**Bildersuche.** Dasselbe Feld, dieselbe Staffel: gefragt wird der Name, dann Name und Ort, dann die Reise – nie die zusammengeklebte Adresse, denn „big ben, Westminster, London, England" malt nirgends ein Bild. Alle Quellen, die etwas zu sagen haben, laufen gleichzeitig (Google Places, wenn ein Schlüssel da ist, sonst Unsplash oder Pexels, dazu Wikimedia Commons); welches Bild genommen wird, entscheidet die Rangfolge der Quellen, nicht welche davon zuerst antwortet. Findet eine zu lange Frage nichts, wird sie auf ihren Kern gekürzt (was vor dem ersten Komma steht) und noch einmal gefragt. Ein Fund wird einen Tag lang getragen, eine leere Hand nicht – deshalb darf „nochmal suchen" im Formular das Gedächtnis wegwerfen, und wenn wirklich nichts zu finden ist, führen zwei Links in Google Bilder und in Wikimedia Commons weiter. Ein eigenes Bild lädt das Formular sowieso, und die Reihe an sich braucht für dasselbe höchstens zwei Anfragen gleichzeitig.

Ohne jeden Schlüssel: Bilder über Wikimedia Commons, Fahrtzeiten über den offenen OSRM-Dienst, Suche über Photon und Nominatim. Der Code merkt sich, wenn eine Quelle nicht antwortet, und schätzt die Zeit dann aus der Luftlinie – die Anzeige sagt dann „geschätzt".

Mit Schlüsseln in der Umgebung werden dieselben Stellen besser: `GOOGLE_MAPS_API_KEY` (oder `PLACES_API_KEY`) für die Ortssuche (Places läuft dann als dritte Quelle mit, vorn steht, was besser zum getippten Namen passt) **und für die Fotos von Google Places** – die laufen dann über `/api/bild?foto=…`, damit der Schlüssel im Server bleibt und nie in einem Eintrag; `UNSPLASH_ACCESS_KEY` oder `PEXELS_API_KEY` für Bilder. Die Schlüssel bleiben auf dem Server, die Route `/api/orte` und `/api/bild` geben nur Namen, Punkt, Adresse und Bild weiter. Ein eigenes Foto lädt ins Blatt und wird klein gerechnet (900 px Kante), damit es nicht den Speicher sprengt.

Lizenzpflichtige Bilder behalten ihren Nachweis am Bild (`foto_nachweis`, `cover_credit`).

## Karte

Die Karte steht auf offenen Kacheln von OpenStreetMap, mit Esri als Rückhalt – kein Schlüssel, kein Konto, kein Wasserzeichen. Kippt eine Quelle, rückt die nächste nach (`src/lib/kacheln.ts`); wer eigene Kacheln dienen lässt, setzt `NEXT_PUBLIC_KARTE_KACHELN`. Die Vorschau im Formular bettet dasselbe offen ein, der Sprung in Google Maps bleibt ein einfacher Link. Punkte stehen als Nadel da – Nummer im Körper, Kategorie als Siegel daneben; die Übernachtung gehört ebenfalls auf die Karte, als 🛏️ ohne Nummer, weil das Bett kein Halt der Route ist, sondern der Grund für sie. Und ein Eintrag ohne Punkt bleibt nicht liegen: fehlt er, steht unter der Karte, welche es sind, und ein Tip auf „Punkte finden“ holt den Punkt über dieselbe offene Suche – übernommen wird nur, was zum genannten Ort passt (Stadt muss dabeisein), der Nachweis bleibt im Toast. Beim Speichern eines neuen Eintrags passiert dasselbe von allein – nur wenn Name oder Adresse eindeutig sind, sonst bleibt der Eintrag ohne Punkt und die Zeile sagt es.

## Daten liegen, wo sie liegen sollen

Stehen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`, liegt alles in `reisen` und `eintraege` – offen ohne Konto, jede Person mit der Adresse kann sehen und ändern. Ohne diese Werte liegt alles auf dem Gerät und die App läuft genauso. Geschrieben wird immer erst lokal, dann online; schlägt das nach, bleibt die Änderung auf dem Gerät und eine Zeile sagt es.

`supabase/schema.sql` (oder `supabase/migrations/…`) einspielen, fertig.

Verdacht auf einen halben Stand in Supabase – eine Spalte fehlt, eine Richtlinie steht nicht, der Zwischenspeicher von PostgREST kennt die neue Tabelle nicht: `supabase/neu-aufbau.sql` im SQL-Editor ausführen. Der Durchgang wirft alles in `public` fort, legt die zwei Blätter neu an, stellt die Rechte zu und prüft am Ende nach, dass Spalten, Kaskade, Index und Richtlinien wirklich dastehen – passt etwas nicht, bricht er ab, statt ein halbes Blatt zurückzulassen. Vorher in der App unter ⚙️ „als Datei sichern“ drücken, danach wieder laden; das Gerät wird beim nächsten Öffnen vom leeren Online-Stand ersetzt. Abgespielt wird die Datei nie von sich aus (der Workflow sieht nur `supabase/migrations/` vor). Ein GitHub-Workflow überträgt Änderungen an `supabase/migrations/` automatisch, wenn `SUPABASE_ACCESS_TOKEN` und `SUPABASE_PROJECT_REF` als Secrets gesetzt sind.

## Betreiben

```bash
npm install
npm run dev            # http://localhost:3000
npm run build
npm run test:all       # Typen, Rechenblatt, Suche und Bild, Layout, Sql, Listen im Speicher, alle Seiten
```

Auf Vercel reicht das Projekt verbinden; die vier Umgebungswerte sind optional. Region `fra1` in `vercel.json`.

## Status

Unten in der Seitenspalte (und auf dem Handy im Einstellungsblatt) steht ein Satz: **Datenbank verbunden**. Er kommt nicht aus einer Annahme – `/api/status` tut eine echte winzige Abfrage und meldet die Antwortzeit. Ist der Speicher nicht erreichbar, heißt es „Datenbank nicht erreichbar“ mit einem Knopf zur erneuten Prüfung; ohne angebundenen Speicher „Auf diesem Gerät“. Beim Prüfen selbst sagt die App nichts.

## Regeln, nach denen gebaut wird

- **Mobile zuerst.** Was auf dem Handy nicht geht, ist kaputt. Keine Seite ist breiter als das Gerät, Scrollen nur da, wo es ein Zweck hat (Tagesstreifen, Kartenliste).
- **Ein Wort, ein Begriff.** Aktivität, Unterkunft, Fahrt, Reisetag, Ort. Das Feld heißt „Punkt", nie „Koordinaten".
- **Ein Aussehen pro Ding.** Prioritäten, Farben und Kategorien kommen aus `src/lib/kategorien.ts`, Kurzdatum („So 24.10.") aus `src/lib/dates.ts`; ausgeschrieben nur in Überschriften.
- **Lesen:** mindestens 13 px, Grautöne mit genug Kontrast, Namen in Reinschrift.
- **Tippen:** jede Fläche mindestens 44 px hoch; 44 px breit nur bei Knöpfen, die ein einzelnes Zeichen tragen – sonst zerdrücken sie den Text daneben. In einer Zeile stehen die Knöpfe auf dem Handy unter dem Text.
- **Menüs und Formulare** laufen als Ablage unten und werden nie abgeschnitten.
- **Das Bild des Ortes steht hinter der Reihe**: leise überfangen, damit der Text ruhig bleibt, und in dichten Listen als Vorschnitt daneben. Gefunden wird der Reihe nach – Name, dann Name und Ort, dann die Reise selbst; ein Land wird nie gesucht. Der Knopf „Bild suchen" im Formular fragt über dieselbe Staffel, nie über eine angehängte Adresse. Der Nachweis bleibt am Eintrag (und ist im Formular zu sehn), die Reihen selbst bleiben frei davon. Übernommen oder entfernt wird nur, wenn jemand es im Menü sagt.
- **Zwei Lichter, eine Palette.** Hell und dunkel stehen an einer Stelle in `src/app/globals.css` (`[data-thema='dunkel']` über dieselben Variablennamen), und ein kurzes Skript in `layout.tsx` entscheidet sie vor dem ersten Bild. Gefärbt wird nur über `var(--…)`, damit ein drittes Licht eine Zeile wäre.
- **Die Suche folgt dem Tippen.** „big ben“ muss den Turm finden: die offenen Quellen laufen gleichzeitig (Photon und Nominatim), gereiht wird nach dem getippten Wort – Name vor Adresse, Ort vor Fläche, die Nähe zur Reise vor der Ferne – und was schon gefragt wurde, wird nicht noch einmal gefragt (auf dem Gerät wie auf dem Server). Beide offenen Quellen heißen im Blatt auch genauso: OpenStreetMap.
- **Ein Tag ist eine Wahl, keine Pflicht.** Ein Name genügt zum Speichern – ohne Tag wartet der Punkt in der Liste unter „Ohne Tag“ und wird dort mit einem Tip verteilt. Nur an einer Unterkunft ist die Nacht der Grund, warum es sie gibt.
- **Ein Text, mehrere Punkte.** „Mehrere“ öffnet ein Feld, darein wandert der Text aus einer Notiz oder Nachricht: eine Zeile wird ein Aktivität, Aufzählungszeichen und Emoji-Ränder fallen weg, ein Umbruch wird angeschlossen, was die Reise schon hat, kommt nicht noch einmal. Angelegt wird ohne Tag, höchstens vierzig auf einmal; Punkt und Bild holt sich jeder Punkt danach selbst, einer nach dem anderen und über dieselben offenen Dienste wie im Formular. Gelesen wird der Text, nie ein Foto.
- **Was beieinander liegt, geht an einem Tag.** Die Punkte ohne Tag werden nach Abstand gruppiert (Luftlinie mit Wegzuschlag, eine Schwelle zum Auswählen), innerhalb der Gruppe führt der kürzeste Weg – die Folge wird die Reihenfolge am Tag. Die Gruppe ist ein Vorschlag und bleibt einer: Der Tag wird an der Gruppe angefasst, und geschrieben wird sie in einem Schritt, also ist sie in einem Schritt zurückzunehmen. Was noch keinen Punkt hat, wird gezählt, nicht gerechnet.
- **Wenn die Suche nichts findet, geht der Link.** Das Feld „Punkt“ liest einen Google-Maps-Link: die Adresszeile mit dem Platz, das @ in der Kartenmitte, die Zahlen in den Datenklammern, die Suche, auch `openstreetmap.org` und zwei Zahlen von Hand. Die Kurzform aus dem Teilen-Knopf trägt den Punkt nicht – sie wird über den Dienst der app nachgelesen (mit Frist, nur Kartenadressen, nur die Ankunft, nie der Seiteninhalt); antwortet er nicht, sagt das Feld, was zu tun ist. Ein Link in der Suche wird nicht gesucht, sondern als Punkt angeboten, und ein Link wird kein Titel. Was keinen Punkt hergibt, schreibt nichts.
- **Nichts wird ungefragt verändert.** Vorschläge (Kategorie, Bild, Stadt aus der Adresse) stehen da, weil sie beim Tippen helfen, und lassen sich überdecken.
