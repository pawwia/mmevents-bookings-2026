-- 018 — weryfikacja adresu e-mail (aktywacja konta). Bez weryfikacji klient nie podpisze umowy.
SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME NULL AFTER is_active,
  ADD COLUMN verification_token VARCHAR(64) NULL AFTER email_verified_at;

-- Istniejące konta uznajemy za zweryfikowane, by nie blokować obecnych klientów.
UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL;

-- Szablon e-maila aktywacyjnego.
INSERT IGNORE INTO email_templates (code, name, subject, body, variables) VALUES
('email_verification', 'Weryfikacja adresu e-mail', 'Potwierdź swój adres e-mail',
'<p>Dzień dobry {{imie}},</p><p>dziękujemy za założenie konta. Aby aktywować konto i móc podpisać umowę, potwierdź swój adres e-mail klikając poniższy przycisk:</p><p><a href="{{link_weryfikacji}}">Potwierdzam adres e-mail</a></p><p>Jeśli to nie Ty zakładałeś/aś konto — zignoruj tę wiadomość.</p><p>{{stopka}}</p>',
'["imie","link_weryfikacji","stopka"]');
