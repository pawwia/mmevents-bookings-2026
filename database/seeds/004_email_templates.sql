-- 004 — szablony e-mail (edytowalne w CRM, zmienne {{...}})
SET NAMES utf8mb4;

INSERT INTO email_templates (code, name, subject, body, variables) VALUES
('booking_created', 'Nowa rezerwacja', 'Dziękujemy za rezerwację — {{data_imprezy}}',
'<p>Dzień dobry {{imie}},</p><p>dziękujemy za rezerwację fotolustra na <strong>{{data_imprezy}}</strong> (start: {{godzina_startu}}).</p><p>Pakiet: <strong>{{pakiet}}</strong><br>Lokalizacja: {{lokalizacja}}<br>Kwota: <strong>{{kwota}} zł</strong> (zadatek: {{zadatek}} zł)</p><p>Wkrótce otrzymasz umowę do podpisu elektronicznego.</p><p>{{stopka}}</p>',
'["imie","nazwisko","data_imprezy","godzina_startu","pakiet","lokalizacja","kwota","zadatek","stopka"]'),

('booking_inquiry', 'Zapytanie o termin (potwierdzenie ręczne)', 'Otrzymaliśmy Twoje zapytanie — {{data_imprezy}}',
'<p>Dzień dobry {{imie}},</p><p>otrzymaliśmy Twoje zapytanie o rezerwację w terminie <strong>{{data_imprezy}}</strong>. W tym dniu mamy już zaplanowaną realizację, dlatego Twoją rezerwację potwierdzimy ręcznie po analizie logistyki.</p><p>Odezwiemy się najszybciej jak to możliwe.</p><p>{{stopka}}</p>',
'["imie","data_imprezy","stopka"]'),

('contract_ready', 'Umowa gotowa', 'Twoja umowa {{numer_umowy}} jest gotowa do podpisu',
'<p>Dzień dobry {{imie}},</p><p>Twoja umowa nr <strong>{{numer_umowy}}</strong> jest gotowa. Podpiszesz ją elektronicznie pod adresem:</p><p><a href="{{link_umowy}}">{{link_umowy}}</a></p><p>{{stopka}}</p>',
'["imie","numer_umowy","link_umowy","stopka"]'),

('awaiting_deposit', 'Oczekiwanie na zadatek', 'Dane do przelewu — zadatek {{zadatek}} zł',
'<p>Dzień dobry {{imie}},</p><p>dziękujemy za podpisanie umowy <strong>{{numer_umowy}}</strong>. Aby potwierdzić rezerwację, prosimy o wpłatę zadatku:</p><p>Kwota: <strong>{{zadatek}} zł</strong><br>Numer konta: <strong>{{numer_konta}}</strong><br>Tytuł przelewu: <strong>Zadatek {{numer_umowy}}</strong></p><p>{{stopka}}</p>',
'["imie","numer_umowy","zadatek","numer_konta","stopka"]'),

('deposit_received', 'Zadatek zaksięgowany', 'Rezerwacja potwierdzona — {{data_imprezy}}',
'<p>Dzień dobry {{imie}},</p><p>zadatek został zaksięgowany. Twoja rezerwacja na <strong>{{data_imprezy}}</strong> jest <strong>potwierdzona</strong>! 🎉</p><p>W panelu klienta możesz spersonalizować animację, tło i szablon wydruku (do {{dni_blokady}} dni przed imprezą): <a href="{{link_panelu}}">{{link_panelu}}</a></p><p>{{stopka}}</p>',
'["imie","data_imprezy","dni_blokady","link_panelu","stopka"]'),

('reminder_7days', 'Przypomnienie przed imprezą', 'Już za {{dni}} dni — Twoja impreza {{data_imprezy}}',
'<p>Dzień dobry {{imie}},</p><p>przypominamy: impreza już <strong>{{data_imprezy}}</strong> (start: {{godzina_startu}}).</p><p>Jeśli chcesz zmienić personalizację (animację, tło, szablon wydruku, tekst), zrób to do {{data_blokady}} — później zmiany nie będą możliwe.</p><p><a href="{{link_panelu}}">Przejdź do panelu klienta</a></p><p>{{stopka}}</p>',
'["imie","dni","data_imprezy","godzina_startu","data_blokady","link_panelu","stopka"]'),

('last_call', 'Last call personalizacji', 'Ostatni moment na personalizację — {{data_imprezy}}',
'<p>Dzień dobry {{imie}},</p><p>to ostatni moment na zmiany w personalizacji Twojej imprezy ({{data_imprezy}}). Po {{data_blokady}} ustawienia zostaną zablokowane.</p><p><a href="{{link_panelu}}">Przejdź do panelu klienta</a></p><p>{{stopka}}</p>',
'["imie","data_imprezy","data_blokady","link_panelu","stopka"]'),

('thank_you', 'Podziękowanie po imprezie', 'Dziękujemy za wspólną zabawę!',
'<p>Dzień dobry {{imie}},</p><p>dziękujemy, że byliście z nami! Mamy nadzieję, że fotolustro dostarczyło mnóstwo radości.</p><p>{{stopka}}</p>',
'["imie","stopka"]'),

('gallery_ready', 'Galeria online', 'Twoja galeria zdjęć jest gotowa! 📸',
'<p>Dzień dobry {{imie}},</p><p>galeria zdjęć z Twojej imprezy ({{data_imprezy}}) jest już dostępna:</p><p><a href="{{link_galerii}}">{{link_galerii}}</a></p>{{prosba_o_opinie}}<p>{{stopka}}</p>',
'["imie","data_imprezy","link_galerii","prosba_o_opinie","stopka"]'),

('review_request', 'Prośba o opinię (fragment)', '—',
'<p>Będzie nam bardzo miło, jeśli zostawisz nam opinię w Google — to dla nas ogromne wsparcie: <a href="{{link_opinii}}">zostaw opinię</a>.</p>',
'["link_opinii"]');
