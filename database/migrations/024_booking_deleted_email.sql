-- 024 — szablon e-maila o usunięciu rezerwacji (wysyłany do klienta przy kasowaniu w CRM).
SET NAMES utf8mb4;

INSERT IGNORE INTO email_templates (code, name, subject, body, variables) VALUES
('booking_deleted', 'Rezerwacja usunięta', 'Twoja rezerwacja została usunięta',
'<p>Dzień dobry {{imie}},</p><p>informujemy, że Twoja rezerwacja na <strong>{{data_imprezy}}</strong> została usunięta z naszego systemu.</p><p>Jeśli to pomyłka lub masz pytania — prosimy o kontakt.</p><p>{{stopka}}</p>',
'["imie","data_imprezy","stopka"]');
