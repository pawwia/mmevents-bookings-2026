-- 010 — OAuth Dysku Google na koncie właściciela (zwykłe Gmail, bez Workspace).
-- Pozwala kopiować/zapisywać umowy na prywatnym Dysku właściciela (jego limit miejsca),
-- zamiast konta serwisowego (które nie ma własnego storage). Konto serwisowe pozostaje
-- dostępne dla Kalendarza. Jeśli refresh token jest ustawiony — Drive/Docs używają OAuth.
SET NAMES utf8mb4;

-- INSERT IGNORE — bezpieczne przy ponownym imporcie (pomija istniejące klucze).
INSERT IGNORE INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('drive', 'drive.oauth_refresh_token', '', 'secret', 'Połączone konto Google (token — ustawiany automatycznie)', 0, 10),
('drive', 'drive.oauth_account_email', '', 'string', 'Połączone konto Google (e-mail)', 0, 11);
