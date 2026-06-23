-- 021 — bezpieczeństwo: limity (logowanie, sprawdzanie terminu) + Cloudflare Turnstile (CAPTCHA).
SET NAMES utf8mb4;

CREATE TABLE rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(40) NOT NULL COMMENT 'login | availability',
  identifier VARCHAR(190) NOT NULL COMMENT 'np. adres IP',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  strikes INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'liczba naruszeń — eskalacja długości blokady',
  window_started_at DATETIME NULL,
  blocked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rate (scope, identifier),
  KEY idx_rate_blocked (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ustawienia Cloudflare Turnstile (widoczne w CRM → Ustawienia → Bezpieczeństwo).
-- Site Key jest publiczny (frontend), Secret Key trzymany jako sekret.
INSERT IGNORE INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('security', 'security.turnstile_site_key',   '', 'string', 'Cloudflare Turnstile — Site Key (publiczny)', 1, 1),
('security', 'security.turnstile_secret_key', '', 'secret', 'Cloudflare Turnstile — Secret Key',            0, 2);
