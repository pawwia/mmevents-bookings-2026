-- 005 — szablony SMS (edytowalne w CRM)
SET NAMES utf8mb4;

INSERT INTO sms_templates (code, name, body, variables) VALUES
('reminder_7days', 'Przypomnienie przed imprezą',
 'MMEvents: przypominamy o imprezie {{data_imprezy}} (start {{godzina_startu}}). Personalizacje mozesz zmienic do {{data_blokady}} w panelu klienta.',
 '["data_imprezy","godzina_startu","data_blokady"]'),
('deposit_received', 'Zadatek zaksięgowany',
 'MMEvents: zadatek zaksiegowany, rezerwacja {{data_imprezy}} potwierdzona. Dziekujemy!',
 '["data_imprezy"]'),
('contract_ready', 'Umowa gotowa',
 'MMEvents: umowa {{numer_umowy}} czeka na podpis. Link wyslalismy e-mailem.',
 '["numer_umowy"]');
