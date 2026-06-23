-- 026 — pamięć przejścia Cloudflare Turnstile per IP (żeby nie wymagać tokenu przy każdym
-- sprawdzeniu terminu). Po jednorazowej weryfikacji człowieka kolejne sprawdzenia są przepuszczane.
SET NAMES utf8mb4;

CREATE TABLE human_verifications (
  ip VARCHAR(45) NOT NULL PRIMARY KEY,
  verified_until DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
