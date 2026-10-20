-- ============================================================================
-- Urlaubsplaner – Beispieldaten (Reise 2025 aus der Google-Tabelle)
-- Automatisch erzeugt aus data/seed.json – nicht von Hand editieren.
-- Neu erzeugen: node scripts/emit-seed-sql.mjs
--
-- Wiederholbar & schonend: existing Zeilen werden nie überschrieben
-- (on conflict do nothing), und die neue Reise 'trip-2027' nur gefüllt,
-- wenn sie noch leer ist. Du kannst dieses File also mehrfach ausführen.
-- ============================================================================

begin;

insert into public.trips (id, name, destination, start_date, end_date, travelers, budget_eur, jpy_rate, notes, archived)
values
  ('trip-2025', 'Japan 2025', 'Japan', '2025-03-01', '2025-04-09', 2, 3500, 168, 'Vorlage: 1:1 aus der Google-Tabelle „Reiseplan“ übernommen. Dient als Referenz für die neue Reise – nichts wird hier verbogen oder erfunden.', true),
  ('trip-2027', 'Japan 2027', 'Japan', '2027-03-06', '2027-04-14', 2, 4200, 175, 'Neue Reise: Wünsche, Hotels und Route aus 2025 übernommen und um 105 Wochen verschoben (Start Sa 06.03.2027, gleicher Wochentag wie letztes Jahr). Tage kannst du im Reiter „Wünscheliste“ mit ⚡ Automatisch verteilen neu setzen oder per Drag & Drop.', false)
on conflict (id) do nothing;
insert into public.journeys (id, trip_id, date, title, from_city, to_city, mode, departure_time, duration_min, price_eur, hotel_name, nights, booking_status, notes)
values
  ('jn-01', 'trip-2025', '2025-03-01', 'Ankunft Tokio', 'Frankfurt/München', 'Tokio', 'Flug', null, null, null, 'Hotel Tokio', 7, 'erledigt', 'Suica Card am Haneda Terminal 3 kaufen – gibt es nur am Flughafen.'),
  ('jn-02', 'trip-2025', '2025-03-02', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-03', 'trip-2025', '2025-03-03', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-04', 'trip-2025', '2025-03-04', 'Tokio', null, 'Tokio', null, null, null, 218, null, null, 'erledigt', 'In der Tabelle standen die 218,00 € / 7 Nächte beim 04.03. – gehören zum Hotel Tokio.'),
  ('jn-05', 'trip-2025', '2025-03-05', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-06', 'trip-2025', '2025-03-06', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-07', 'trip-2025', '2025-03-07', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', '7 Tage Tokio gesamt (Spalte „Spalte 1“ in der Tabelle).'),
  ('jn-08', 'trip-2025', '2025-03-08', 'Abreise Tokio nach Hakodate', 'Tokio', 'Hakodate', 'Flug', null, 95, null, 'Hotel Hakodate', 2, 'erledigt', null),
  ('jn-09', 'trip-2025', '2025-03-09', 'Hakodate', null, 'Hakodate', null, null, null, null, null, null, 'erledigt', '2 Nächte, 72,00 € laut Tabelle.'),
  ('jn-10', 'trip-2025', '2025-03-10', 'Von Hakodate nach Osaka', 'Hakodate', 'Osaka', 'Zug', null, 300, null, 'Hotel Osaka', 15, 'erledigt', 'Shinkansen mit JR Pass – über Nagoya/Shin-Osaka.'),
  ('jn-11', 'trip-2025', '2025-03-11', 'Shiga', null, 'Shiga', 'Zug', null, 45, null, null, null, 'erledigt', '2 Tage Shiga (Burg Hikone, Biwa-See).'),
  ('jn-12', 'trip-2025', '2025-03-12', 'Shiga', null, 'Shiga', null, null, null, null, null, null, 'erledigt', null),
  ('jn-13', 'trip-2025', '2025-03-13', 'Kyoto', 'Osaka', 'Kyoto', 'Zug', null, 30, null, null, null, 'erledigt', '4 Tage Kyoto – gemerkt im Hotel Osaka.'),
  ('jn-14', 'trip-2025', '2025-03-14', 'Kyoto', null, 'Kyoto', null, null, null, null, null, null, 'erledigt', null),
  ('jn-15', 'trip-2025', '2025-03-15', 'Kyoto', null, 'Kyoto', null, null, null, null, null, null, 'erledigt', null),
  ('jn-16', 'trip-2025', '2025-03-16', 'Kyoto', null, 'Kyoto', null, null, null, null, null, null, 'erledigt', 'Amanohashidate als weitherzer Tagesausflug.'),
  ('jn-17', 'trip-2025', '2025-03-17', 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-18', 'trip-2025', '2025-03-18', 'Osaka – Universal Studios', null, 'Osaka', null, null, null, null, null, null, 'erledigt', '15 Nächte Osaka, 601,00 € laut Tabelle (ab hier notiert).'),
  ('jn-19', 'trip-2025', '2025-03-19', 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-20', 'trip-2025', '2025-03-20', 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-21', 'trip-2025', '2025-03-21', 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', '6 Tage Osaka gesamt (Tabelle).'),
  ('jn-22', 'trip-2025', '2025-03-22', 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-23', 'trip-2025', '2025-03-23', 'Kobe', 'Osaka', 'Kobe', 'Zug', null, 30, null, null, null, 'erledigt', '2 Tage Kobe.'),
  ('jn-24', 'trip-2025', '2025-03-24', 'Kobe / Tottori', null, 'Kobe', null, null, null, null, null, null, 'offen', 'Tottori (Conan Town + Dünen) stand in der Tabelle ohne Datum – 2 Tage eingeplant, aber im Reiseverlauf nicht aufgetaucht.'),
  ('jn-25', 'trip-2025', '2025-03-25', 'Fahrt nach Hiroshima', 'Osaka', 'Hiroshima', 'Shinkansen', null, 100, null, 'Hotel Hiroshima', 3, 'erledigt', null),
  ('jn-26', 'trip-2025', '2025-03-26', 'Hiroshima', null, 'Hiroshima', null, null, null, null, null, null, 'erledigt', 'Ōkunoshima (Kanincheninsel) einplanen: 45 Min bis zur Fähre + 15 Min Fähre.'),
  ('jn-27', 'trip-2025', '2025-03-27', 'Hiroshima', null, 'Hiroshima', null, null, null, null, null, null, 'erledigt', '3 Nächte Hiroshima, 153,00 €.'),
  ('jn-28', 'trip-2025', '2025-03-28', 'Fahrt nach Tokio', 'Hiroshima', 'Tokio', 'Shinkansen', null, 240, null, null, null, 'erledigt', null),
  ('jn-29', 'trip-2025', '2025-03-29', 'Flug nach Okinawa', 'Tokio', 'Okinawa', 'Flug', null, 150, 55, 'Hotel Okinawa', 1, 'erledigt', 'Tabelle: „1 Nacht | 55,00 €“ beim 29.03., Okinawa-Block weiter unten sagt 27.03.–03.04. (7 Tage) – bitte prüfen.'),
  ('jn-30', 'trip-2025', '2025-03-30', 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', null),
  ('jn-31', 'trip-2025', '2025-03-31', 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', null),
  ('jn-32', 'trip-2025', '2025-04-01', 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', null),
  ('jn-33', 'trip-2025', '2025-04-02', 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', '1.050,00 € in der Tabelle beim 02.04. notiert (Zweck unklar – vermutlich Unterkunft/Flüge).'),
  ('jn-34', 'trip-2025', '2025-04-03', 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', 'Okinawa-Block in der Tabelle: 27.03. bis 03.04., 7 Tage.'),
  ('jn-35', 'trip-2025', '2025-04-04', 'Okinawa → Tokio', 'Okinawa', 'Tokio', 'Flug', null, 150, null, 'Hotel Tokio', 5, 'erledigt', null),
  ('jn-36', 'trip-2025', '2025-04-05', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-37', 'trip-2025', '2025-04-06', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-38', 'trip-2025', '2025-04-07', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', '5 Nächte, 368,00 €.'),
  ('jn-39', 'trip-2025', '2025-04-08', 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', '6 Tage Tokio am Ende (Tabelle).'),
  ('jn-40', 'trip-2025', '2025-04-09', 'Rückflug', 'Tokio', 'Zuhause', 'Flug', null, null, null, null, null, 'erledigt', null)
on conflict (id) do nothing;
insert into public.hotels (id, trip_id, name, city, check_in, check_out, nights, price_total_eur, price_per_night_eur, address, lat, lng, booking_url, booking_status, notes)
values
  ('ht-tokio-1', 'trip-2025', 'Hotel Tokio (1. Block)', 'Tokio', '2025-03-01', '2025-03-08', 7, 218, 31.14, null, null, null, null, 'erledigt', 'Wert aus der Tabelle (Zeile 04.03.). Name des Hotels war nicht notiert.'),
  ('ht-hakodate', 'trip-2025', 'Hotel Hakodate', 'Hakodate', '2025-03-08', '2025-03-10', 2, 72, 36, null, 41.7687, 140.7287, null, 'erledigt', 'In der Tabelle „Hakkodate“ geschrieben; 72,00 € beim 09.03.'),
  ('ht-osaka', 'trip-2025', 'Hotel Osaka', 'Osaka', '2025-03-10', '2025-03-25', 15, 601, 40.07, null, null, null, null, 'erledigt', 'Basis für Kyoto, Kobe, Shiga, Tottori – deshalb 15 Nächte.'),
  ('ht-usj', 'trip-2025', 'The Park Front Hotel at Universal Studios Japan', 'Osaka', '2025-03-18', '2025-03-19', 1, null, null, '2 Chome-1-112 Sakurajima, Konohana Ward, Osaka', 34.6662, 135.4326, 'https://www.parkfront-hotel.com/', 'erledigt', 'Stand in der Standort-Spalte der Tabelle (18.03., ganzer Tag, Super Nintendo World). Preis in 601 € enthalten? Unklar – nicht doppelt zählen.'),
  ('ht-hiroshima', 'trip-2025', 'Hotel Hiroshima', 'Hiroshima', '2025-03-25', '2025-03-28', 3, 153, 51, null, null, null, null, 'erledigt', null),
  ('ht-okinawa', 'trip-2025', 'Hotel Okinawa', 'Okinawa', '2025-03-29', '2025-03-30', 1, 55, 55, null, 26.2124, 127.6809, null, 'erledigt', 'Tabelle: 1 Nacht / 55 €. Okinawa-Block sagt aber 27.03.–03.04. (7 Tage) – und 1.050 € beim 02.04. Offener Punkt.'),
  ('ht-tokio-2', 'trip-2025', 'Hotel Tokio (2. Block)', 'Tokio', '2025-04-04', '2025-04-09', 5, 368, 73.6, null, null, null, null, 'erledigt', null)
on conflict (id) do nothing;
insert into public.places (id, trip_id, name, city, district, category, date, time_slot, start_time, duration_min, travel_time, notes, price_eur, price_note, booking_status, booking_url, priority, maps_query, lat, lng, image_url, sort_order)
values
  ('pl-001', 'trip-2025', 'Suica Card am Flughafen holen', 'Tokio', 'Haneda Terminal 3', 'Organisation', '2025-03-01', 'Vormittag', null, 30, null, 'Gibt es nur am Flughafen (Tabelle: „Suica Card Haneda Terminal 3 kaufen gibts nur am Flughafen“).', 20, 'Kaution 500 ¥', 'erledigt', null, 'muss', 'Haneda Airport Terminal 3', 35.5499, 139.7787, null, 1),
  ('pl-002', 'trip-2025', 'Tokyo DisneySea', 'Tokio', 'Urayasu', 'Freizeitpark', '2025-03-05', 'Vormittag bis Abend', null, 480, 'Ca 1:15h', 'Tickets buchen! Ganzen Tag einplanen.', null, 'Richtwert 7.900–10.900 ¥ / Person', 'offen', 'https://www.tokyodisneyresort.jp/en/', 'muss', 'Tokyo DisneySea', 35.6312, 139.8776, null, 1),
  ('pl-003', 'trip-2025', 'Shinjuku Gyoen Park', 'Tokio', 'Shinjuku', 'Stadtpark', null, 'Tag oder Abend', null, 120, 'Ca 30 Min', 'Zusammen mit Omoide Yokocho („Piss Alley“). Kirschblüte ab Ende März.', 5, '500 ¥ Eintritt', 'offen', null, 'soll', 'Shinjuku Gyoen National Garden', 35.6876, 139.7104, null, 2),
  ('pl-004', 'trip-2025', 'Kabukichō', 'Tokio', 'Shinjuku', 'Stadtteil / Nachtleben', null, 'Bei Nacht', null, 120, 'Ca 30 Min', 'Zum Durchlaufen und Stöbern.', null, null, 'offen', null, 'kann', 'Kabukicho Shinjuku', 35.6958, 139.7045, null, 3),
  ('pl-005', 'trip-2025', 'Golden Gai (1-chōme-2 Nishishinjuku)', 'Tokio', 'Shinjuku', 'Traditionelle Gassen / Essen', null, 'Tag oder Abend', null, 60, 'Ca 30 Min', 'Zusammen mit Shinjuku Gyoen. Kleine Bars, teils Foto-Verbot.', null, null, 'offen', null, 'soll', 'Golden Gai Shinjuku', 35.6945, 139.7047, null, 4),
  ('pl-006', 'trip-2025', 'Ramen Tatsunoya Shinjuku', 'Tokio', 'Shinjuku', 'Ramen Restaurant', null, 'Abend', null, 60, 'Ca 30 Min', 'Bild-Link aus der Tabelle übernommen.', 8, '≈ 1.000–1.300 ¥', 'offen', null, 'soll', 'Ramen Tatsunoya Shinjuku', null, null, 'https://lh3.googleusercontent.com/p/AF1QipPKCSFjGthLq0hiFM4J9619ERebcqlb697fn8tU=s680-w680-h510', 5),
  ('pl-007', 'trip-2025', 'Disney Store Shinjuku (Takashimaya)', 'Tokio', 'Shinjuku', 'Disney Store', null, 'Nachmittag', null, 45, null, 'Souvenirs, wenn der Park zu voll ist.', null, null, 'offen', null, 'kann', 'Disney Store Shinjuku Takashimaya', null, null, null, 6),
  ('pl-008', 'trip-2025', 'Shinjuku Loft', 'Tokio', 'Shinjuku', 'Gemischtwarenladen', null, 'Nachmittag', null, 60, null, 'Kram, Kreativbedarf, Mitbringsel.', null, null, 'offen', null, 'kann', 'Shinjuku Loft', 35.6955, 139.7027, null, 7),
  ('pl-009', 'trip-2025', 'Sunshine 60 Observatory', 'Tokio', 'Ikebukuro', 'Hochhaus / Aussicht', null, 'Bei Nacht', null, 60, null, '„Hochhaus zum runterschauen“, über Shinjuku.', 10, '2.000–3.000 ¥ (Abend-Ticket günstiger)', 'offen', null, 'kann', 'Sunshine 60 Koshien Ikebukuro', 35.7296, 139.7189, null, 8),
  ('pl-010', 'trip-2025', 'Hōrin-ji', 'Tokio', 'Shinjuku', 'Tempel', null, 'Vormittag', null, 45, null, 'Tabelle: „a Tempel halt mein Gott“ 😄', null, null, 'offen', null, 'kann', 'Horinji temple Tokyo', null, null, null, 9),
  ('pl-011', 'trip-2025', 'Akihabara', 'Tokio', 'Akihabara', 'Anime / Elektronik-Stadtteil', null, 'Nachmittag', null, 180, 'Ca 25 Min', 'Shoppen und Anime-Sachen kaufen.', null, null, 'offen', null, 'muss', 'Akihabara Electric Town', 35.7023, 139.771, null, 10),
  ('pl-012', 'trip-2025', 'Seconds Harajuku', 'Tokio', 'Harajuku', 'Anime Figuren Shop', null, 'Nachmittag', null, 45, null, 'Tabelle: „Seconds Street – Tokio günstige Figuren“.', null, null, 'offen', null, 'kann', 'Seconds Harajuku', 35.6708, 139.7017, null, 11),
  ('pl-013', 'trip-2025', 'Iriya Plus Café Custom Warehouse', 'Tokio', 'Iriya', 'Café', null, 'Nachmittag', null, 60, null, 'Tabelle: „Cafe mit Tollen Süßigkeiten – uiiii“.', 12, null, 'offen', null, 'kann', 'Iriya Plus Custom Warehouse cafe', null, null, null, 12),
  ('pl-014', 'trip-2025', 'Asakusa Shrine + Sensō-ji', 'Tokio', 'Asakusa', 'Sehenswürdigkeit', null, 'Bei Tageslicht', null, 120, 'Ca 30 Min', 'Kaiserpalast? / gut essen in der Nähe. Früh da sein.', 0, null, 'offen', null, 'soll', 'Asakusa Shrine', 35.7148, 139.7967, null, 13),
  ('pl-015', 'trip-2025', 'Tokyo Solamachi', 'Tokio', 'Sumida (am Skytree)', 'Einkaufszentrum', null, 'Nachmittag', null, 120, null, 'Kirby Café, Pokémon Center, Tokyo Skytree direkt daneben.', null, null, 'offen', null, 'kann', 'Tokyo Solamachi Skytree', 35.7126, 139.8103, null, 14),
  ('pl-016', 'trip-2025', 'Future Rose Tattoo', 'Tokio', 'Shibuya', 'Tattoo Studio', '2025-03-04', 'Nachmittag', '13:00:00', 60, 'Ca 45 Min', 'Termin: 2 Tattoos. Im Voraus abklären, ob Walk-ins gehen.', null, 'Nach Angebot an der Wand', 'gebucht', null, 'muss', 'Future Rose Tattoo Shibuya Tokyo', null, null, null, 15),
  ('pl-017', 'trip-2025', 'MEGA Don Quijote Shibuya', 'Tokio', 'Shibuya', 'Einkaufszentrum (ein Laden)', null, 'Nachmittag / Abend', null, 120, 'Ca 45 Min', 'Nach dem Tattoo-Termin, 24h geöffnet.', null, null, 'offen', null, 'kann', 'Meg Don Quijote Shibuya', null, null, null, 16),
  ('pl-018', 'trip-2025', 'Shibuya Scramble Crossing', 'Tokio', 'Shibuya', 'Kreuzung', null, 'Abend', null, 10, null, 'Meist genutzte Kreuzung – viele Leute. Bester Blick vom Starbucks/Magic Hours Lounge.', 0, null, 'offen', null, 'soll', 'Shibuya Scramble Crossing', 35.6597, 139.7007, null, 17),
  ('pl-019', 'trip-2025', 'Meiji-jingū Schrein', 'Tokio', 'Shibuya', 'Shinto Schrein', null, 'Tag', null, 90, null, 'Bekanntester Schrein Tokios, toller Waldweg.', 0, null, 'offen', null, 'soll', 'Meiji Jingu Shrine', 35.6764, 139.6993, null, 18),
  ('pl-020', 'trip-2025', 'Daiso Shibuya Center Street', 'Tokio', 'Shibuya', '100-Shop (für Locals)', null, 'Nachmittag', null, 40, null, 'Mitbringsel günstig.', null, null, 'offen', null, 'kann', 'Daiso Shibuya Center Street', null, null, null, 21),
  ('pl-021', 'trip-2025', 'Ichiran Ramen', 'Tokio', 'Shibuya (oder Shinjuku)', 'Ramen Restaurant', null, 'Abend', null, 60, null, 'Einzelkabinen, Tonkotsu. Auch in Shinjuku.', 11, null, 'offen', null, 'kann', 'Ichiran Ramen Shibuya', null, null, null, 22),
  ('pl-022', 'trip-2025', 'Gōtokuji (Katzentempel)', 'Tokio', 'Setagaya / Kawasaki', 'Tempel', null, 'Tag', null, 60, null, 'Maneki-neko Legende. Ticket für die kleine Ausstellung mitnehmen.', null, null, 'offen', null, 'soll', 'Gotokuji cat temple', null, null, null, 23),
  ('pl-023', 'trip-2025', 'FamilyMart Harajuku-Takeshita Exit', 'Tokio', 'Shibuya', 'Konbini – Essen & Schauen', null, 'Tag oder Abend', null, 30, null, 'Konbini-Klassiker: Egg Sandwich, Onigiri, Coffee.', 6, null, 'offen', null, 'kann', 'Takeshita Street Harajuku', 35.6705, 139.7015, null, 24),
  ('pl-024', 'trip-2025', 'Hands Shibuya Scramble Square', 'Tokio', 'Shibuya', 'Store für alles irgendwie', null, 'Nachmittag', null, 60, null, 'Tabelle: „keine ahnung diggah“ 😅 – DIY, Beauty, Reisekram.', null, null, 'offen', null, 'kann', 'Hands Shibuya Scramble Square', null, null, null, 25),
  ('pl-025', 'trip-2025', 'Micasadeco & Cafe Jingumae', 'Tokio', 'Shibuya', 'Fluffy Pancakes', null, 'Tag oder Abend', null, 75, null, 'Soufflé-Pancakes + Deko-Laden. Vorher reservieren.', 20, null, 'offen', null, 'soll', 'Micasadeco Cafe Jingumae', null, null, null, 26),
  ('pl-026', 'trip-2025', 'Tagesausflug Kamakura', 'Kamakura', 'Kamakura', 'Ausflug', null, 'Tagesausflug', null, 420, '1–2 h', 'Schöner Ort am Meer / Sicht auf Mt. Fuji vom Enoden-Zug aus.', null, null, 'offen', null, 'soll', 'Kamakura Station', 35.319, 139.5468, null, 27),
  ('pl-027', 'trip-2025', 'Hokoku-ji (Bambushain)', 'Kamakura', 'Kamakura', 'Schrein / Tempel', null, 'Tagesausflug', null, 60, '1–2 h', 'Zu Kamakura dazu.', null, null, 'offen', null, 'kann', 'Hokokuji Kamakura bamboo', 35.3077, 139.5466, null, 28),
  ('pl-028', 'trip-2025', 'Tsurugaoka Hachimangū', 'Kamakura', 'Kamakura', 'Schrein / Tempel', null, 'Tagesausflug', null, 75, null, 'Haupt-Schrein von Kamakura, große Treppe.', 0, null, 'offen', null, 'soll', 'Tsurugaoka Hachimangu Kamakura', 35.314, 139.5525, null, 29),
  ('pl-029', 'trip-2025', 'Tsukiji Outer Market', 'Tokio', 'Chūō (unter Akihabara)', 'Fischmarkt', null, 'Vormittag', '08:00:00', 90, 'Ca 45 Min', 'Früh hin – viele Staden machen mittags zu.', 15, null, 'offen', null, 'muss', 'Tsukiji Outer Market', 35.6657, 139.7703, null, 30),
  ('pl-030', 'trip-2025', 'Arashiyama-Bambuswald (Tokio-Block?)', 'Tokio', null, 'Bambuswald', null, null, null, 90, null, 'In der Tabelle unter Tokio mit „außerhalb Tokios“ notiert – der berühmte Bambuswald ist in Kyoto. Klären.', null, null, 'offen', null, 'kann', 'Arashiyama Bamboo Grove Kyoto', null, null, null, 31),
  ('pl-031', 'trip-2025', 'Shibakōen', 'Tokio', 'Minato', 'Großer Park', null, 'Nachmittag', null, 60, null, 'Blick auf Tokyo Tower vom Park.', 0, null, 'offen', null, 'kann', 'Shiba Park Tokyo', 35.6529, 139.7486, null, 32),
  ('pl-032', 'trip-2025', 'Kōishikawa Kōrakuen Garden', 'Tokio', 'Bunkyō', 'Garten', null, 'Nachmittag', null, 75, null, 'Klassischer Teichgarten, ruhiger als Shinjuku Gyoen.', 3, '300 ¥', 'offen', null, 'kann', 'Koishikawa Korakuen Garden', 35.7126, 139.7555, null, 33),
  ('pl-033', 'trip-2025', 'Burg Hikone', 'Shiga', 'Hikone', 'Japanische Burg', null, 'Vormittag', null, 120, null, 'Original-Burg, Nationaler Schatz. 15 Min Fußweg vom Bahnhof.', 6, '800 ¥ Burg + Garten', 'offen', null, 'soll', 'Hikone Castle', 35.3153, 136.2726, null, 1),
  ('pl-034', 'trip-2025', 'Hōsen-in', 'Shiga', 'Ohara', 'Tempel', null, 'Vormittag', null, 45, null, 'Tabelle sagt Shiga – der Moos-Tempel Hōsen-in liegt in Ohara (Nord-Kyoto). Jikkō-in und Sanzen-in sind daneben.', 4, null, 'offen', null, 'kann', 'Hosen-in Ohara Kyoto', null, null, null, 2),
  ('pl-035', 'trip-2025', 'Biwa-See', 'Shiga', 'Ōmi', 'Orientierungspunkt (See)', null, 'Tag', null, null, null, '„Müss ma noch schauen was genau“ – Uferpromenade in Ōtsu oder Chikubushima.', null, null, 'offen', null, 'kann', 'Lake Biwa', null, null, null, 3),
  ('pl-036', 'trip-2025', 'Shirahige-Schrein (Torii im Wasser)', 'Shiga', 'Takashima', 'Shinto Torii im Wasser', null, 'Nachmittag', null, 60, null, '„Japanisches Mont-Saint-Michel“-Gefühl bei hohem Wasserstand.', 0, null, 'offen', null, 'soll', 'Shirahige Shrine Takashima Biwa torii', 35.3313, 136.0505, null, 4),
  ('pl-037', 'trip-2025', 'Hachiman-bori Kanal (Nagahama)', 'Shiga', 'Nagahama', 'Wasserkanäle im Altstadtdorf', null, 'Nachmittag', null, 60, null, 'Rundboot-Fahrt auf dem Kanal. Nagahama ist bekannt für Tayaki (gegrillter Brassen) und Kirschblüte am Wasser.', null, null, 'offen', null, 'kann', 'Hachiman-bori Nagahama canal', 35.4747, 136.2803, null, 5),
  ('pl-038', 'trip-2025', 'Fushimi Inari-Taisha', 'Kyoto', 'Fushimi', '10.000 Torii + Schrein am Gipfel', null, 'Vormittag', '07:30:00', 180, null, 'Früh hin oder abends – oben kaum Leute, aber dunkel. Ganzer Berg: 2–3 h.', 0, null, 'offen', null, 'muss', 'Fushimi Inari Taisha', 34.9671, 135.7727, null, 1),
  ('pl-039', 'trip-2025', 'Kumonocha Café', 'Kyoto', 'Uji / Fushimi', 'Matcha-Café', null, 'Nachmittag', null, 60, null, 'Kaffee mit Matcha und Kuchi (Tabelle).', 7, null, 'offen', null, 'kann', 'Kumochacha Uji matcha cafe', null, null, null, 2),
  ('pl-040', 'trip-2025', 'Arashiyama Genrokuzanchō (Bambuswald)', 'Kyoto', 'Arashiyama', 'Bambuswald', null, 'Vormittag', '07:00:00', 120, null, 'Früh am Morgen wegen der vielen Leute. Tenryū-ji + Togetsukyō-Brücke dazu.', 0, null, 'offen', null, 'muss', 'Arashiyama Genroku-yama Bamboo Grove', 35.017, 135.6716, null, 3),
  ('pl-041', 'trip-2025', 'Kyoto International Manga Museum', 'Kyoto', 'Nakagyō', 'Museum', null, 'Regen-Backup', null, 120, null, '„Uns zeichnen lassen“ – Comic-Regale zum Durchstöbern.', 6, '1.000 ¥', 'offen', null, 'soll', 'Kyoto International Manga Museum', 35.0106, 135.7465, null, 4),
  ('pl-042', 'trip-2025', '(THISIS)SHIZEN', 'Kyoto', 'Shimogyō', 'Restaurant / Concept Store', null, 'Abend', null, 90, null, 'Tabelle: „Essen ganz eigen, mit Pflanzen oder so“ – Kaiseki-Restaurant mit Garten, mittags auch Café.', 40, null, 'offen', null, 'kann', 'THISIS SHIZEN Kyoto', null, null, null, 5),
  ('pl-043', 'trip-2025', 'Amanohashidate View Land', 'Kyoto', 'Miyazu (Nord-Kyoto)', 'Aussichtspunkt / Sessellift', null, 'Tagesausflug', null, 300, 'Ca 2 h', 'Sandbank – eine der „drei schönsten Ansichten Japans“. Between-the-legs-Blick von oben.', null, 'Sessellift ≈ 1.500 ¥', 'offen', null, 'soll', 'Amanohashidate View Land', 35.5405, 135.21, null, 6),
  ('pl-044', 'trip-2025', 'Kifune-Schrein', 'Kyoto', 'Kibune (außerhalb)', 'Schrein', null, 'Nachmittag', null, 120, null, 'Im Sommer sind die Treppen mit Kerzen beleuchtet (Kibune-Kawaguchi-Bootsfahrt als Rückweg).', null, null, 'offen', null, 'soll', 'Kifune Shrine Kibune Kyoto', 35.1103, 135.7599, null, 7),
  ('pl-045', 'trip-2025', 'Ninenzaka & Sannenzaka', 'Kyoto', 'Higashiyama', 'Altjapanische Gasse', null, 'Nachmittag / Abend', null, 90, null, 'Tabelle: „Higashiyama (ähnlich)“ – Shops, Matcha-Eis, Kiyomizu-dera am Ende.', null, null, 'offen', null, 'soll', 'Ninenzaka Sannenzaka Higashiyama Kyoto', 34.9959, 135.778, null, 8),
  ('pl-046', 'trip-2025', 'Kōmyō-in Tempel', 'Kyoto', 'Higashiyama', 'Tempel', null, 'Nachmittag', null, 45, null, 'Kreisfenster im Kōdai-ji-Komplex – Moos + Ahorn.', 4, null, 'offen', null, 'kann', 'Komyoin temple Kodaiji Kyoto', null, null, null, 9),
  ('pl-047', 'trip-2025', 'Rurikō-in Tempel', 'Kyoto', 'Kita (bei Kinkaku-ji)', 'Tempel', null, 'Vormittag', null, 45, null, 'Kleiner, feiner Moostempel in der Kinkaku-ji-Gegend – kaum was los.', 4, null, 'offen', null, 'kann', 'Rurikoin temple Kyoto', null, null, null, 10),
  ('pl-048', 'trip-2025', 'Gionmachi Minamigawa / Gion-Viertel', 'Kyoto', 'Gion / Higashiyama', 'Altjapanisches Viertel + Yasaka-Schrein', null, 'Abend', null, 90, null, 'Geisha-Viertel. Fotografieren verboten – an die Schilder halten!', 0, null, 'offen', null, 'soll', 'Gionmachi Minamigawa Hanamikoji Kyoto', 35.0037, 135.7753, null, 11),
  ('pl-049', 'trip-2025', 'glänta Kyoto Ninenzaka (Custom Ring Shop)', 'Kyoto', 'Higashiyama', 'Ringe selber machen', null, 'Nachmittag', null, 90, null, 'Workshop – Termin online buchen.', 60, 'je nach Ring/Person', 'offen', 'https://glanta-kyoto.com/', 'muss', 'glanta Kyoto Ninenzaka ring shop', null, null, null, 12),
  ('pl-050', 'trip-2025', 'Nanzen-ji', 'Kyoto', 'Sakyō', 'Tempel', null, 'Tag', null, 90, null, 'Neben dem Gion-/Yasaka-Viertel – riesiges Sanmon-Tor + Aquädukt.', 3, null, 'offen', null, 'soll', 'Nanzenji Temple Kyoto', 35.0114, 135.7938, null, 13),
  ('pl-051', 'trip-2025', 'The Park Front Hotel at USJ', 'Osaka', 'Konohana-ku', 'Super Nintendo World / Universal Studios', '2025-03-18', 'Ganzer Tag', '08:00:00', 600, null, 'Tabelle: 18.03., ganzer Tag. Early Entry nutzen, Power-Up-Band vorab buchen.', 95, '1-Day-Park-Ticket ≈ 10.900 ¥', 'gebucht', 'https://www.usj.co.jp/', 'muss', 'Universal Studios Japan', 34.6654, 135.4323, null, 1),
  ('pl-052', 'trip-2025', 'Hatoya', 'Osaka', null, 'Matcha-Eis Laden', null, 'Nachmittag', null, 45, null, null, 5, null, 'offen', null, 'kann', 'Hatoya matcha ice cream', null, null, null, 2),
  ('pl-053', 'trip-2025', 'Osaka Castle', 'Osaka', 'Chūō-ku', 'Burg', null, 'Vormittag', null, 150, null, 'Tabelle: „Der Park drum herum, nicht in die Burg hinein“ – Park + Nishinomaru-Maru reichen.', 0, 'Park frei, Burg 1.200 ¥', 'offen', null, 'soll', 'Osaka Castle Park', 34.6873, 135.5262, null, 3),
  ('pl-054', 'trip-2025', 'Osaka Aquarium Kaiyukan', 'Osaka', 'Minato-ku', 'Aquarium', null, 'Nachmittag', null, 180, null, 'Walhaie. Kombiticket mit Sky Garden lohnt oft.', 16, '2.700 ¥ (online günstiger)', 'offen', null, 'soll', 'Osaka Aquarium Kaiyukan', 34.6587, 135.4233, null, 4),
  ('pl-055', 'trip-2025', 'Dōtonbori Bridge', 'Osaka', 'Namba', 'Food-Meile', null, 'Abend', null, 120, null, 'Rundherum gutes Essen: Okonomiyaki, Takoyaki (Kukuru Dotonbori). Glico-Schild Foto.', 25, null, 'offen', null, 'muss', 'Dotonbori Bridge', 34.6692, 135.5018, null, 5),
  ('pl-056', 'trip-2025', 'Kajitsu no Hana Shinsaibashi', 'Osaka', 'Shinsaibashi', 'Moji Fruits (obst-Café)', null, 'Nachmittag', null, 60, null, 'Mojitos? – „Moji Fruits“ aus der Tabelle: Fruchtsandwiches/Parfaits.', 12, null, 'offen', null, 'kann', 'Kajitsu no hana Shinsaibashi fruit', null, null, null, 6),
  ('pl-057', 'trip-2025', 'Namba Yasaka-Schrein', 'Osaka', 'Namba', 'Fotospot (Riesen-Löwenkopf)', null, 'Nachmittag', null, 45, null, 'Bühne in Form eines riesigen Löwenkopfs – Glück & Theater. Kurzer, cooler Fotospot.', 0, null, 'offen', null, 'kann', 'Namba Yasaka Shrine', 34.6616, 135.5002, null, 7),
  ('pl-058', 'trip-2025', 'Shinsekai', 'Osaka', 'Nishinari', 'Old Town', null, 'Abend', null, 120, null, 'Kushikatsu-Essen, Tsūtenkaku-Turm, Retro-Atmosphäre.', 15, null, 'offen', null, 'soll', 'Shinsekai Osaka', 34.654, 135.5057, null, 8),
  ('pl-059', 'trip-2025', 'Katsuō-ji (Stempel-Tempel)', 'Osaka', 'Tenma', 'Tempel', null, 'Vormittag', null, 45, null, 'Riesiger Incense-Topf + Stempel-Schildkröten.', 0, null, 'offen', null, 'kann', 'Katsuoji temple Osaka', null, null, null, 9),
  ('pl-060', 'trip-2025', 'Shinsaibashisūji', 'Osaka', 'Chūō-ku', 'Einkaufsstraße', null, 'Nachmittag / Abend', null, 120, null, 'Tabelle: „Dotonbori Street (auch Einkaufsmeile)“ – überdacht, Regen-Backup.', null, null, 'offen', null, 'soll', 'Shinsaibashi-suji Shopping Street', 34.6718, 135.5013, null, 10),
  ('pl-061', 'trip-2025', 'Daimaru Shinsaibashi', 'Osaka', 'Shinsaibashi', 'Anime / Figuren Shopping', null, 'Nachmittag', null, 90, null, 'Tabelle: „Figuren usw“ – Dachgeschoss = Food Court.', null, null, 'offen', null, 'kann', 'Daimaru Shinsaibashi', 34.6712, 135.5006, null, 11),
  ('pl-062', 'trip-2025', 'Tagesausflug Nara', 'Nara', 'Nara', 'Tagesausflug', null, 'Tagesausflug', null, 420, 'Ca 45 Min ab Osaka', 'Nara-Park, Tōdai-ji, Kasuga-Schrein. In der Tabelle stand bei diesem Eintrag noch „Kifune Shrine“ – das gehört nach Kyoto.', 0, 'Hirsch-Cracker 200 ¥', 'offen', null, 'muss', 'Nara Park', 34.6851, 135.843, null, 12),
  ('pl-063', 'trip-2025', 'Tagesausflug Wakayama', 'Wakayama', 'Wakayama', 'Tagesausflug', null, 'Tagesausflug', null, 420, null, 'Tabelle: „müssen no schauen“ – Optionen: Fish Market um 6 Uhr, Wakayama Castle.', null, null, 'offen', null, 'kann', 'Wakayama Castle', 34.231, 135.171, null, 13),
  ('pl-064', 'trip-2025', 'Naruto x Boruto Park – Nijigen no Mori', 'Kobe', 'Awaji (Mugil Bay)', 'Freizeitpark', null, 'Tagesausflug', null, 360, null, 'Liegt auf Awaji-Insel (Mugil Bay Park), nicht direkt in Kobe. Seilbahn + Riesenrad dort.', 30, 'Tageskarte variiert stark', 'offen', null, 'soll', 'Nijigen no Mori Awaji Ninja Village', null, null, null, 1),
  ('pl-065', 'trip-2025', 'Mount Rokkō', 'Kobe', 'Rokko', 'Berg + Umgebung', null, 'Nachmittag bis Abend', null, 240, null, 'Tabelle: „müssen no schauen“. 10-Million-Dollar-Night-View, Alpina-Rokko (Sesselbahn).', 10, 'Parkgebühr 600 ¥ + Seilbahn', 'offen', null, 'soll', 'Mount Rokko Kobi View Platform', 34.7603, 135.2247, null, 2),
  ('pl-066', 'trip-2025', 'Arima Onsen – Ryokan Hanamusubi', 'Kobe', 'Kita-ku', 'Onsen / Ryokan', null, 'Tagesausflug', null, 480, null, 'Einer der ältesten Onsen-Orte Japans. Tagesbad möglich ohne Übernachtung.', 35, 'Tagesbetrieb ~ 2.000–4.000 ¥, Übernachtung deutlich mehr', 'offen', null, 'kann', 'Arima Onsen Kobe', 34.797, 135.284, null, 3),
  ('pl-067', 'trip-2025', 'Goshō Aoyama Manga Factory', 'Tottori', 'Hokuei', 'Conan Town / Museum', null, 'Vormittag', null, 90, null, 'Detektiv-Conan-Dorf mit statues an der Bahnlinie.', 6, '700 ¥', 'offen', null, 'kann', 'Gosho Aoyama Manga Factory', null, null, null, 1),
  ('pl-068', 'trip-2025', 'Tottori-Sanddünen', 'Tottori', 'Tottori', 'Wüste / Dünen', null, 'Nachmittag', null, 150, null, 'Camel Ride, Sand Museum daneben. Sonnenuntergang ist das beste Licht.', 8, 'Dünen frei, Kamel extra', 'offen', null, 'soll', 'Tottori Sand Dunes', 35.5533, 134.2278, null, 2),
  ('pl-069', 'trip-2025', 'Hiroshima Castle', 'Hiroshima', 'Naka-ku', 'Burg + Umgebung', null, 'Vormittag', null, 90, null, null, 4, '400 ¥', 'offen', null, 'soll', 'Hiroshima Castle', 34.4045, 132.4587, null, 1),
  ('pl-070', 'trip-2025', 'Shukkeien-Garten', 'Hiroshima', 'Naka-ku', 'Garten in der Stadt', null, 'Nachmittag', null, 60, null, 'Nur 10 Min von der Burg.', 3, '260 ¥', 'offen', null, 'kann', 'Shukkeien Garden Hiroshima', 34.3943, 132.4521, null, 2),
  ('pl-071', 'trip-2025', 'Hondōri Shopping Street', 'Hiroshima', 'Naka-ku', 'Einkaufsstraße', null, 'Abend', null, 90, null, 'Okonomimura (Essen-Haus) daneben – Muss für Hiroshima-Style Okonomiyaki.', 12, null, 'offen', null, 'soll', 'Hondori Shopping Arcade Hiroshima', 34.3955, 132.4595, null, 3),
  ('pl-072', 'trip-2025', 'Daishō-in (Miyajima)', 'Hiroshima', 'Miyajima', 'Schrein/Tempel auf der Insel', null, 'Vormittag', '08:00:00', 120, '45 Min + 15 Min Fähre', '1.000 steinerne Laternen am Hang + Aussicht über die Bucht. Fähre ab Miyajimaguchi (15 Min).', 15, 'Fähre ≈ 200 ¥ one-way', 'offen', null, 'muss', 'Daishoin temple Miyajima', null, null, null, 4),
  ('pl-073', 'trip-2025', 'Ōkunoshima (Kaninchen-Insel)', 'Hiroshima', 'Takeshima', 'Rabbit Island', null, 'Tagesausflug', '09:00:00', 300, '45 Min bis Fähre + 15 Min Fähre', 'Fütterung mit Karotten KAUFEN (vor Ort teurer), keine Essensreste wegwerfen. Giftgas-Museum mitgehen.', 25, 'Fähre + Museum', 'offen', null, 'muss', 'Okunoshima rabbit island', 34.3389, 132.3636, null, 5),
  ('pl-074', 'trip-2025', 'Okinawa (Strand & Inseltour)', 'Okinawa', 'Inselgruppe', 'Urlaub / Strand', '2025-03-27', 'Ganzer Tag', null, null, null, 'Tabelle: 27.03. bis 03.04., 7 Tage, ohne Programm. Nachholen für 2026: Shuri-Jō, Manmo Beach, Manzamo, Ryukyu Mura, Churaumi-Aquarium.', null, null, 'offen', null, 'soll', 'Okinawa main island', 26.3345, 127.8051, null, 1),
  ('pl-075', 'trip-2025', 'Berg Yōmei & Panorama', 'Hakodate', 'Hakodate', 'Aussichtspunkt', null, 'Bei Nacht', null, 120, null, 'Fehlte in der Tabelle – für 2026 ergänzt: Seilbahn rauf, einer der besten Night Views Japans.', 12, 'Seilbahn ~ 1.280 ¥ retour', 'offen', null, 'soll', 'Mount Hakodate ropeway', 41.758, 140.734, null, 1),
  ('pl-076', 'trip-2025', 'Morgenmarkt Hakodate', 'Hakodate', 'Hakodate', 'Markt / Frühstück', null, 'Vormittag', '07:00:00', 90, null, 'Für 2026 ergänzt – Fisch-Restaurant-Straße, danach Yunokawa Onsen (Meerwasser-Bäder).', 12, null, 'offen', null, 'kann', 'Hakodate Morning Market', 41.8106, 140.7451, null, 2)
on conflict (id) do nothing;
insert into public.expenses (id, trip_id, date, category, description, amount_eur, payer)
values
  ('ex-01', 'trip-2025', '2025-03-01', 'Transport', 'JR Pass 14 Tage (2 Personen)', 0, null),
  ('ex-02', 'trip-2025', '2025-03-01', 'Organisation', 'Suica Cards am Haneda T3', 40, null),
  ('ex-03', 'trip-2025', '2025-04-02', 'Sonstiges', '1.050,00 € laut Tabelle beim Okinawa-Block – Zweck klären', 1050, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Neue Reise 'trip-2027': Inhalte der Vorlage übernehmen, Termine um den
-- Abstand der beiden Startdaten verschieben. Tage bleiben bei Orten ohne
-- Datum leer – im Web-UI verteilt "Wünscheliste → ⚡ Automatisch verteilen"
-- sie gleichmäßig auf die Stadttage.
-- ---------------------------------------------------------------------------

insert into public.places (id, trip_id, name, city, district, category, date, time_slot, start_time, duration_min, travel_time, notes, price_eur, price_note, booking_status, booking_url, priority, maps_query, lat, lng, image_url, sort_order)
select 'pl27-' || gen_random_uuid()::text,
       'trip-2027',
       p.name, p.city, p.district, p.category,
       -- Ort hatte in der Vorlage einen Tag -> um den Reiseabstand verschieben,
       -- sonst leer lassen (= er startet in der Wünscheliste der neuen Reise)
       case when p.date is null then null
            else (p.date + (neu.start_date - alt.start_date))::date end,
       p.time_slot, p.start_time, p.duration_min, p.travel_time,
       p.notes, p.price_eur, p.price_note,
       'offen', p.booking_url, p.priority, p.maps_query, p.lat, p.lng, p.image_url, p.sort_order
from public.places p
join public.trips alt on alt.id = p.trip_id
join public.trips neu on neu.id = 'trip-2027'
where p.trip_id = 'trip-2025'
  and not exists (select 1 from public.places x where x.trip_id = 'trip-2027');

insert into public.hotels (id, trip_id, name, city, check_in, check_out, nights, price_total_eur, price_per_night_eur, address, lat, lng, booking_url, booking_status, notes)
select 'ht27-' || gen_random_uuid()::text,
       'trip-2027',
       h.name, h.city,
       (h.check_in + (neu.start_date - alt.start_date))::date,
       (h.check_out + (neu.start_date - alt.start_date))::date,
       h.nights, h.price_total_eur, h.price_per_night_eur, h.address, h.lat, h.lng, h.booking_url,
       'offen',
       'Aus der Vorjahresreise übernommen – Preis und Verfügbarkeit prüfen.'
from public.hotels h
join public.trips alt on alt.id = h.trip_id
join public.trips neu on neu.id = 'trip-2027'
where h.trip_id = 'trip-2025'
  and not exists (select 1 from public.hotels x where x.trip_id = 'trip-2027');

insert into public.journeys (id, trip_id, date, title, from_city, to_city, mode, departure_time, duration_min, price_eur, hotel_name, nights, booking_status, notes)
select 'jn27-' || gen_random_uuid()::text,
       'trip-2027',
       (j.date + (neu.start_date - alt.start_date))::date,
       j.title, j.from_city, j.to_city, j.mode, j.departure_time, j.duration_min, j.price_eur, j.hotel_name, j.nights,
       'offen',
       'Verschobener Reiseverlauf aus der Vorlage – Uhrzeiten und Preise aktualisieren.'
from public.journeys j
join public.trips alt on alt.id = j.trip_id
join public.trips neu on neu.id = 'trip-2027'
where j.trip_id = 'trip-2025'
  and j.date is not null
  and not exists (select 1 from public.journeys x where x.trip_id = 'trip-2027');

commit;

-- Kontrolle:
--   select id, name, places, nights, total_cost from public.v_trip_summary;
--   select * from public.v_day_load where trip_id = 'trip-2027' order by date;

-- Fall du die Beispielreisen hart zurücksetzen willst (überschreibt deine Arbeit!):
--   delete from public.trips where id in ('trip-2025', 'trip-2027');  -- kaskadiert
--   ... danach dieses File erneut ausführen.
