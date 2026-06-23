-- 014 — ujednolicenie marki na „MMEvents" + domena mmevents.pl + powiadomienie właściciela.
-- Idempotentne: podwójny REPLACE (MMEvents→MMEvent→MMEvents) nie tworzy „MMEventss";
-- domena 'mmevent.pl' nie jest podciągiem 'mmevents.pl', więc zamiana jest bezpieczna.
SET NAMES utf8mb4;

-- Ustawienia (nazwa firmy, nadawca, stopka, strona, e-maile)
UPDATE settings SET value = REPLACE(REPLACE(value, 'MMEvents', 'MMEvent'), 'MMEvent', 'MMEvents');
UPDATE settings SET value = REPLACE(value, 'mmevent.pl', 'mmevents.pl');

-- Szablony e-mail
UPDATE email_templates SET subject = REPLACE(REPLACE(subject, 'MMEvents', 'MMEvent'), 'MMEvent', 'MMEvents');
UPDATE email_templates SET body = REPLACE(REPLACE(body, 'MMEvents', 'MMEvent'), 'MMEvent', 'MMEvents');
UPDATE email_templates SET body = REPLACE(body, 'mmevent.pl', 'mmevents.pl');

-- Szablony SMS (prefiks „MMEvent:")
UPDATE sms_templates SET body = REPLACE(REPLACE(body, 'MMEvents', 'MMEvent'), 'MMEvent', 'MMEvents');

-- Powiadomienie właściciela o nowej rezerwacji
INSERT IGNORE INTO email_templates (code, name, subject, body, variables) VALUES
('admin_new_booking', 'Nowa rezerwacja — powiadomienie właściciela',
 'Nowa rezerwacja #{{booking_id}} — {{data_imprezy}} ({{typ_imprezy}})',
'<p><strong>Nowa rezerwacja w systemie.</strong></p>
<table style="border-collapse:collapse" cellpadding="4">
<tr><td style="color:#777">Numer</td><td><strong>#{{booking_id}}</strong></td></tr>
<tr><td style="color:#777">Status</td><td>{{status}}</td></tr>
<tr><td style="color:#777">Typ imprezy</td><td>{{typ_imprezy}}{{liczba_osob_info}}</td></tr>
<tr><td style="color:#777">Termin</td><td>{{data_imprezy}}, start {{godzina_startu}}</td></tr>
<tr><td style="color:#777">Pakiet</td><td>{{pakiet}}</td></tr>
<tr><td style="color:#777">Lokalizacja</td><td>{{lokalizacja}}</td></tr>
<tr><td style="color:#777">Klient</td><td>{{imie}} {{nazwisko}}</td></tr>
<tr><td style="color:#777">Telefon</td><td>{{telefon}}</td></tr>
<tr><td style="color:#777">E-mail</td><td>{{email}}</td></tr>
<tr><td style="color:#777">Kwota</td><td><strong>{{kwota}}</strong> (zadatek {{zadatek}})</td></tr>
</table>
{{wycena_indywidualna_info}}
<p style="margin-top:16px"><a href="{{link_crm}}">Otwórz rezerwację w CRM →</a></p>',
'["booking_id","status","typ_imprezy","liczba_osob_info","data_imprezy","godzina_startu","pakiet","lokalizacja","imie","nazwisko","telefon","email","kwota","zadatek","wycena_indywidualna_info","link_crm"]');
