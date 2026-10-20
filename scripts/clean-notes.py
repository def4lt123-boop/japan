#!/usr/bin/env python3
"""Daten-Hinweise bereinigen: keine Verweise auf frühere Tabellenkalkulationen.

macht drei Dinge, jederzeit wiederholbar:
  1. data/seed.json   → Notizen/Beschreibungen auf den kanonischen Text setzen (NOTES)
  2. Kontrolle        → meldet jeden Rest, der nach google/excel/sheets/tabelle/spalte klingt
  3. supabase/refresh-notes.sql → UPDATEs für eine bereits gefüllte Datenbank
     (jede Zeile durch `is distinct from` geschützt → mehrmals ausführbar, keine Überschreibung)

Nach Änderung an NOTES immer: python3 scripts/clean-notes.py && npm run seed:sql
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / 'data' / 'seed.json'
OUT = ROOT / 'supabase' / 'refresh-notes.sql'

TABLE_OF = {'trip': 'trips', 'pl': 'places', 'ht': 'hotels', 'jn': 'journeys', 'ex': 'expenses'}

# id -> {Feld: neuer Text}   (None = Notiz soll leer sein)
NOTES = {
    # Reise
    'trip-2025': {'notes': 'Referenz-Reise 2025, so wie geplant – zum Anschauen und Duplizieren. Hier nichts ändern, außer du willst die Vorlage nachziehen.'},
    # Orte
    'pl-001': {'notes': 'Gibt es nur am Flughafen – Suica direkt am Haneda Terminal 3 holen.'},
    'pl-006': {'notes': None},
    'pl-010': {'notes': '„a Tempel halt mein Gott“ 😄'},
    'pl-012': {'notes': 'Seconds Street – günstige Figuren und Kleinkram.'},
    'pl-013': {'notes': 'Café mit tollen Süßigkeiten – uiiii.'},
    'pl-024': {'notes': '„keine ahnung diggah“ 😅 – DIY, Beauty, Reisekram.'},
    'pl-030': {'notes': 'Achtung: der berühmte Bambuswald liegt in Arashiyama (Nordwest-Kyoto), nicht außerhalb von Tokio. Tag und Stadt noch klären.'},
    'pl-034': {'notes': 'Liegt in Ohara (Nord-Kyoto), nicht in Shiga. Jikkō-in und Sanzen-in sind gleich daneben.'},
    'pl-039': {'notes': 'Kaffee mit Matcha und Kuchi.'},
    'pl-042': {'notes': '„Essen ganz eigen, mit Pflanzen oder so“ – Kaiseki-Restaurant mit Garten, mittags auch Café.'},
    'pl-045': {'notes': 'Higashiyama-ähnlich – Shops, Matcha-Eis, Kiyomizu-dera am Ende.'},
    'pl-051': {'notes': 'Ganzer Tag einplanen. Early Entry nutzen, Power-Up-Band vorab buchen.'},
    'pl-053': {'notes': '„Der Park drum herum, nicht in die Burg hinein“ – Park + Nishinomaru reichen.'},
    'pl-056': {'notes': 'Mojitos? – „Moji Fruits": Fruchtsandwiches und Parfaits.'},
    'pl-060': {'notes': 'Dotonbori Street (auch Einkaufsmeile) – überdacht, gutes Regen-Backup.'},
    'pl-061': {'notes': 'Figuren usw. – Dachgeschoss = Food Court.'},
    'pl-062': {'notes': 'Nara-Park, Tōdai-ji, Kasuga-Schrein. Der Kifune-Schrein gehört nicht hierher – der liegt in Kyoto.'},
    'pl-063': {'notes': '„müssen no schauen“ – Optionen: Fish Market um 6 Uhr, Wakayama Castle.'},
    'pl-065': {'notes': '„müssen no schauen“. 10-Million-Dollar-Night-View, Alpina-Rokko (Sesselbahn).'},
    'pl-074': {'notes': '27.03.–03.04., 7 Tage, ohne Programm. Nachholen für 2027: Shuri-Jō, Manmo Beach, Manzamo, Ryukyu Mura, Churaumi-Aquarium.'},
    'pl-075': {'notes': 'Neu für 2027 dazugenommen: Seilbahn rauf, einer der besten Night Views Japans.'},
    'pl-076': {'notes': 'Neu für 2027 dazugenommen: Fisch-Restaurant-Straße, danach Yunokawa Onsen (Meerwasser-Bäder).'},
    # Unterkünfte
    'ht-tokio-1': {'notes': 'Preis vom 04.03. überliefert, der Name des Hotels ist nicht notiert.'},
    'ht-hakodate': {'notes': '„Hakkodate“ – 72,00 € beim 09.03.'},
    'ht-usj': {'notes': '18.03., ganzer Tag, Super Nintendo World. Ist der Preis in den 601 € für Osaka enthalten? Unklar – nicht doppelt zählen.'},
    'ht-okinawa': {'notes': '1 Nacht / 55 €. Der Okinawa-Block sagt aber 27.03.–03.04. (7 Tage) – und 1.050 € beim 02.04. Offener Punkt.'},
    # Etappen
    'jn-04': {'notes': 'Die 218,00 € / 7 Nächte beim 04.03. gehören zum Hotel Tokio.'},
    'jn-07': {'notes': '7 Tage Tokio gesamt.'},
    'jn-09': {'notes': '2 Nächte, 72,00 €.'},
    'jn-18': {'notes': '15 Nächte Osaka, 601,00 € – ab hier sind die Preise notiert.'},
    'jn-21': {'notes': '6 Tage Osaka gesamt.'},
    'jn-24': {'notes': 'Tottori (Conan Town + Dünen) war ohne Datum überliefert – 2 Tage eingeplant, taucht im Reiseverlauf nicht auf.'},
    'jn-29': {'notes': '1 Nacht / 55,00 € beim 29.03., der Okinawa-Block sagt 27.03.–03.04. (7 Tage) – bitte prüfen.'},
    'jn-33': {'notes': '1.050,00 € beim 02.04. – Zweck unklar, vermutlich Unterkunft oder Flüge.'},
    'jn-34': {'notes': 'Okinawa-Block: 27.03. bis 03.04., 7 Tage.'},
    'jn-39': {'notes': '6 Tage Tokio am Ende.'},
    # Ausgaben
    'ex-03': {'description': '1.050,00 € beim Okinawa-Block (02.04.) – Zweck klären'},
}

# reine Links sind keine „Hinweise auf die alte Datei“
URL_FIELDS = {'image_url', 'booking_url', 'maps_query'}
PATTERN = re.compile(r'google|excel|sheets|spreadsheet|reiseplan|tabelle|spalte', re.I)


def q(v):
    return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"


data = json.loads(SEED.read_text(encoding='utf-8'))
rows = {k: v for k, v in data.items() if isinstance(v, list)}

# 1) seed.json auf den Stand von NOTES bringen
touched = 0
for table, items in rows.items():
    for row in items:
        rid = row.get('id')
        if not isinstance(rid, str) or rid not in NOTES:
            continue
        for field, new in NOTES[rid].items():
            if row.get(field) != new:
                row[field] = new
                touched += 1
if touched:
    SEED.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

# 2) Rest-Kontrolle in den Daten
leftovers = [
    f'{table}.{row.get("id")}.{field}: {value[:80]}'
    for table, items in rows.items()
    for row in items
    for field, value in row.items()
    if isinstance(value, str) and field not in URL_FIELDS and PATTERN.search(value)
]

# 3) UPDATE-Skript für die Datenbank (immer aus NOTES, durch Guard schonend)
lines = [
    '-- ============================================================================',
    '-- Notizen bereinigen: Hinweise auf frühere Dateien raus, Reise-Info bleibt.',
    '-- Optional – nur für Datenbanken, in denen setup.sql/seed.sql ÄLTEREN Stand haben.',
    '-- Mehrfach ausführbar: jede Zeile greift nur, wenn der Text wirklich anders ist.',
    '-- Erzeugt von: python3 scripts/clean-notes.py',
    '-- ============================================================================',
    '',
    'begin;',
    '',
]
count = 0
for rid, fields in NOTES.items():
    table = TABLE_OF[rid.split('-')[0]]
    for field, new in fields.items():
        count += 1
        lines.append(f"update public.{table} set {field} = {q(new)} where id = {q(rid)} and {field} is distinct from {q(new)};")
lines += [
    '',
    'commit;',
    '',
    '-- Kontrolle (muss 0 Zeilen liefern):',
    "--   select id, name, notes from public.places where notes ~* 'tabelle|google|spalte|excel|sheets';",
    "--   select id, name, notes from public.trips  where notes ~* 'tabelle|google|spalte|excel|sheets';",
    '',
]
OUT.write_text('\n'.join(lines), encoding='utf-8')

print(f'seed.json: {touched} Felder aktualisiert · refresh-notes.sql: {count} UPDATEs')
if leftovers:
    print('❌ immer noch Verweise auf Tabellenkalkulationen in data/seed.json:')
    for line in leftovers:
        print('  ', line)
    sys.exit(1)
print('✅ Daten frei von Verweisen auf alte Tabellen/Dateien')
