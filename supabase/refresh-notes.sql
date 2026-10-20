-- ============================================================================
-- Notizen bereinigen: Hinweise auf frühere Dateien raus, Reise-Info bleibt.
-- Optional – nur für Datenbanken, in denen setup.sql/seed.sql ÄLTEREN Stand haben.
-- Mehrfach ausführbar: jede Zeile greift nur, wenn der Text wirklich anders ist.
-- Erzeugt von: python3 scripts/clean-notes.py
-- ============================================================================

begin;

update public.trips set notes = 'Referenz-Reise 2025, so wie geplant – zum Anschauen und Duplizieren. Hier nichts ändern, außer du willst die Vorlage nachziehen.' where id = 'trip-2025' and notes is distinct from 'Referenz-Reise 2025, so wie geplant – zum Anschauen und Duplizieren. Hier nichts ändern, außer du willst die Vorlage nachziehen.';
update public.places set notes = 'Gibt es nur am Flughafen – Suica direkt am Haneda Terminal 3 holen.' where id = 'pl-001' and notes is distinct from 'Gibt es nur am Flughafen – Suica direkt am Haneda Terminal 3 holen.';
update public.places set notes = null where id = 'pl-006' and notes is distinct from null;
update public.places set notes = '„a Tempel halt mein Gott“ 😄' where id = 'pl-010' and notes is distinct from '„a Tempel halt mein Gott“ 😄';
update public.places set notes = 'Seconds Street – günstige Figuren und Kleinkram.' where id = 'pl-012' and notes is distinct from 'Seconds Street – günstige Figuren und Kleinkram.';
update public.places set notes = 'Café mit tollen Süßigkeiten – uiiii.' where id = 'pl-013' and notes is distinct from 'Café mit tollen Süßigkeiten – uiiii.';
update public.places set notes = '„keine ahnung diggah“ 😅 – DIY, Beauty, Reisekram.' where id = 'pl-024' and notes is distinct from '„keine ahnung diggah“ 😅 – DIY, Beauty, Reisekram.';
update public.places set notes = 'Achtung: der berühmte Bambuswald liegt in Arashiyama (Nordwest-Kyoto), nicht außerhalb von Tokio. Tag und Stadt noch klären.' where id = 'pl-030' and notes is distinct from 'Achtung: der berühmte Bambuswald liegt in Arashiyama (Nordwest-Kyoto), nicht außerhalb von Tokio. Tag und Stadt noch klären.';
update public.places set notes = 'Liegt in Ohara (Nord-Kyoto), nicht in Shiga. Jikkō-in und Sanzen-in sind gleich daneben.' where id = 'pl-034' and notes is distinct from 'Liegt in Ohara (Nord-Kyoto), nicht in Shiga. Jikkō-in und Sanzen-in sind gleich daneben.';
update public.places set notes = 'Kaffee mit Matcha und Kuchi.' where id = 'pl-039' and notes is distinct from 'Kaffee mit Matcha und Kuchi.';
update public.places set notes = '„Essen ganz eigen, mit Pflanzen oder so“ – Kaiseki-Restaurant mit Garten, mittags auch Café.' where id = 'pl-042' and notes is distinct from '„Essen ganz eigen, mit Pflanzen oder so“ – Kaiseki-Restaurant mit Garten, mittags auch Café.';
update public.places set notes = 'Higashiyama-ähnlich – Shops, Matcha-Eis, Kiyomizu-dera am Ende.' where id = 'pl-045' and notes is distinct from 'Higashiyama-ähnlich – Shops, Matcha-Eis, Kiyomizu-dera am Ende.';
update public.places set notes = 'Ganzer Tag einplanen. Early Entry nutzen, Power-Up-Band vorab buchen.' where id = 'pl-051' and notes is distinct from 'Ganzer Tag einplanen. Early Entry nutzen, Power-Up-Band vorab buchen.';
update public.places set notes = '„Der Park drum herum, nicht in die Burg hinein“ – Park + Nishinomaru reichen.' where id = 'pl-053' and notes is distinct from '„Der Park drum herum, nicht in die Burg hinein“ – Park + Nishinomaru reichen.';
update public.places set notes = 'Mojitos? – „Moji Fruits": Fruchtsandwiches und Parfaits.' where id = 'pl-056' and notes is distinct from 'Mojitos? – „Moji Fruits": Fruchtsandwiches und Parfaits.';
update public.places set notes = 'Dotonbori Street (auch Einkaufsmeile) – überdacht, gutes Regen-Backup.' where id = 'pl-060' and notes is distinct from 'Dotonbori Street (auch Einkaufsmeile) – überdacht, gutes Regen-Backup.';
update public.places set notes = 'Figuren usw. – Dachgeschoss = Food Court.' where id = 'pl-061' and notes is distinct from 'Figuren usw. – Dachgeschoss = Food Court.';
update public.places set notes = 'Nara-Park, Tōdai-ji, Kasuga-Schrein. Der Kifune-Schrein gehört nicht hierher – der liegt in Kyoto.' where id = 'pl-062' and notes is distinct from 'Nara-Park, Tōdai-ji, Kasuga-Schrein. Der Kifune-Schrein gehört nicht hierher – der liegt in Kyoto.';
update public.places set notes = '„müssen no schauen“ – Optionen: Fish Market um 6 Uhr, Wakayama Castle.' where id = 'pl-063' and notes is distinct from '„müssen no schauen“ – Optionen: Fish Market um 6 Uhr, Wakayama Castle.';
update public.places set notes = '„müssen no schauen“. 10-Million-Dollar-Night-View, Alpina-Rokko (Sesselbahn).' where id = 'pl-065' and notes is distinct from '„müssen no schauen“. 10-Million-Dollar-Night-View, Alpina-Rokko (Sesselbahn).';
update public.places set notes = '27.03.–03.04., 7 Tage, ohne Programm. Nachholen für 2027: Shuri-Jō, Manmo Beach, Manzamo, Ryukyu Mura, Churaumi-Aquarium.' where id = 'pl-074' and notes is distinct from '27.03.–03.04., 7 Tage, ohne Programm. Nachholen für 2027: Shuri-Jō, Manmo Beach, Manzamo, Ryukyu Mura, Churaumi-Aquarium.';
update public.places set notes = 'Neu für 2027 dazugenommen: Seilbahn rauf, einer der besten Night Views Japans.' where id = 'pl-075' and notes is distinct from 'Neu für 2027 dazugenommen: Seilbahn rauf, einer der besten Night Views Japans.';
update public.places set notes = 'Neu für 2027 dazugenommen: Fisch-Restaurant-Straße, danach Yunokawa Onsen (Meerwasser-Bäder).' where id = 'pl-076' and notes is distinct from 'Neu für 2027 dazugenommen: Fisch-Restaurant-Straße, danach Yunokawa Onsen (Meerwasser-Bäder).';
update public.hotels set notes = 'Preis vom 04.03. überliefert, der Name des Hotels ist nicht notiert.' where id = 'ht-tokio-1' and notes is distinct from 'Preis vom 04.03. überliefert, der Name des Hotels ist nicht notiert.';
update public.hotels set notes = '„Hakkodate“ – 72,00 € beim 09.03.' where id = 'ht-hakodate' and notes is distinct from '„Hakkodate“ – 72,00 € beim 09.03.';
update public.hotels set notes = '18.03., ganzer Tag, Super Nintendo World. Ist der Preis in den 601 € für Osaka enthalten? Unklar – nicht doppelt zählen.' where id = 'ht-usj' and notes is distinct from '18.03., ganzer Tag, Super Nintendo World. Ist der Preis in den 601 € für Osaka enthalten? Unklar – nicht doppelt zählen.';
update public.hotels set notes = '1 Nacht / 55 €. Der Okinawa-Block sagt aber 27.03.–03.04. (7 Tage) – und 1.050 € beim 02.04. Offener Punkt.' where id = 'ht-okinawa' and notes is distinct from '1 Nacht / 55 €. Der Okinawa-Block sagt aber 27.03.–03.04. (7 Tage) – und 1.050 € beim 02.04. Offener Punkt.';
update public.journeys set notes = 'Die 218,00 € / 7 Nächte beim 04.03. gehören zum Hotel Tokio.' where id = 'jn-04' and notes is distinct from 'Die 218,00 € / 7 Nächte beim 04.03. gehören zum Hotel Tokio.';
update public.journeys set notes = '7 Tage Tokio gesamt.' where id = 'jn-07' and notes is distinct from '7 Tage Tokio gesamt.';
update public.journeys set notes = '2 Nächte, 72,00 €.' where id = 'jn-09' and notes is distinct from '2 Nächte, 72,00 €.';
update public.journeys set notes = '15 Nächte Osaka, 601,00 € – ab hier sind die Preise notiert.' where id = 'jn-18' and notes is distinct from '15 Nächte Osaka, 601,00 € – ab hier sind die Preise notiert.';
update public.journeys set notes = '6 Tage Osaka gesamt.' where id = 'jn-21' and notes is distinct from '6 Tage Osaka gesamt.';
update public.journeys set notes = 'Tottori (Conan Town + Dünen) war ohne Datum überliefert – 2 Tage eingeplant, taucht im Reiseverlauf nicht auf.' where id = 'jn-24' and notes is distinct from 'Tottori (Conan Town + Dünen) war ohne Datum überliefert – 2 Tage eingeplant, taucht im Reiseverlauf nicht auf.';
update public.journeys set notes = '1 Nacht / 55,00 € beim 29.03., der Okinawa-Block sagt 27.03.–03.04. (7 Tage) – bitte prüfen.' where id = 'jn-29' and notes is distinct from '1 Nacht / 55,00 € beim 29.03., der Okinawa-Block sagt 27.03.–03.04. (7 Tage) – bitte prüfen.';
update public.journeys set notes = '1.050,00 € beim 02.04. – Zweck unklar, vermutlich Unterkunft oder Flüge.' where id = 'jn-33' and notes is distinct from '1.050,00 € beim 02.04. – Zweck unklar, vermutlich Unterkunft oder Flüge.';
update public.journeys set notes = 'Okinawa-Block: 27.03. bis 03.04., 7 Tage.' where id = 'jn-34' and notes is distinct from 'Okinawa-Block: 27.03. bis 03.04., 7 Tage.';
update public.journeys set notes = '6 Tage Tokio am Ende.' where id = 'jn-39' and notes is distinct from '6 Tage Tokio am Ende.';
update public.expenses set description = '1.050,00 € beim Okinawa-Block (02.04.) – Zweck klären' where id = 'ex-03' and description is distinct from '1.050,00 € beim Okinawa-Block (02.04.) – Zweck klären';

commit;

-- Kontrolle (muss 0 Zeilen liefern):
--   select id, name, notes from public.places where notes ~* 'tabelle|google|spalte|excel|sheets';
--   select id, name, notes from public.trips  where notes ~* 'tabelle|google|spalte|excel|sheets';
