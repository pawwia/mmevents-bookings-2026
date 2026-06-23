-- 012 — generowanie umowy z szablonu Google Docs przez Google Apps Script (web-app).
-- Skrypt działa jako konto właściciela: kopiuje szablon na jego Dysk i podstawia znaczniki,
-- zwraca PDF. Backend tylko wysyła dane (POST) na adres .../exec z hasłem. Gdy adres web-app
-- jest pusty — umowa generowana jest lokalnie z szablonu HTML (Dompdf).
SET NAMES utf8mb4;

INSERT IGNORE INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('signing', 'contract.gdocs_webapp_url', '', 'string', 'Google Apps Script — adres web-app (.../exec)', 0, 22),
('signing', 'contract.gdocs_secret',     '', 'secret', 'Google Apps Script — wspólne hasło (secret)', 0, 23),
('signing', 'contract.gdocs_template_id','', 'string', 'Google Docs — ID szablonu (informacyjnie)', 0, 24);
