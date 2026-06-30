-- 028 — reset hasła („nie pamiętam hasła"). Token jednorazowy z czasem ważności.
SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN password_reset_token VARCHAR(64) NULL AFTER verification_token,
  ADD COLUMN password_reset_expires_at DATETIME NULL AFTER password_reset_token;

-- Szablon e-maila z linkiem do ustawienia nowego hasła.
INSERT IGNORE INTO email_templates (code, name, subject, body, variables) VALUES
('password_reset', 'Reset hasła', 'Ustaw nowe hasło do konta',
'<p>Dzień dobry {{imie}},</p><p>otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta. Aby ustawić nowe hasło, kliknij poniższy przycisk:</p><p><a href="{{link_resetu}}">Ustawiam nowe hasło</a></p><p>Link jest ważny przez {{waznosc}}. Jeśli to nie Ty prosiłeś/aś o zmianę hasła — zignoruj tę wiadomość, Twoje hasło pozostanie bez zmian.</p><p>{{stopka}}</p>',
'["imie","link_resetu","waznosc","stopka"]');
