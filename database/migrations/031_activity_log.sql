-- 031 — dziennik aktywności serwisu (logowania, resety hasła, blokady, personalizacja…).
-- Pozwala adminowi zobaczyć „co się dzieje", gdy klient dzwoni z problemem.
SET NAMES utf8mb4;

CREATE TABLE activity_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(50) NOT NULL,            -- login_ok, login_fail, login_blocked, reset_request, reset_blocked, reset_done, personalization_update…
  user_id BIGINT UNSIGNED NULL,          -- konto, którego dotyczy (gdy znane)
  email VARCHAR(255) NULL,               -- adres podany w formularzu (logowanie/reset) — też gdy konta brak
  ip VARCHAR(45) NULL,                   -- IP klienta (zza Cloudflare)
  booking_id BIGINT UNSIGNED NULL,       -- powiązana rezerwacja (np. personalizacja)
  detail VARCHAR(255) NULL,              -- krótki opis dodatkowy
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_event (event),
  KEY idx_activity_date (created_at),
  KEY idx_activity_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
