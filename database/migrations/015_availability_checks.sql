-- 015 — log sprawdzeń terminów (kto / kiedy / jaki termin / IP) + IP utworzenia rezerwacji.
SET NAMES utf8mb4;

CREATE TABLE availability_checks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  check_date DATE NOT NULL COMMENT 'sprawdzany termin imprezy',
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  user_id BIGINT UNSIGNED NULL COMMENT 'gdy sprawdzał zalogowany klient',
  available TINYINT(1) NULL COMMENT 'czy termin był wolny w chwili sprawdzenia',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_checks_ip (ip),
  KEY idx_checks_date (check_date),
  KEY idx_checks_created (created_at),
  CONSTRAINT fk_checks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IP, z którego utworzono rezerwację — do dopasowania sprawdzeń terminów do e-maila klienta
ALTER TABLE bookings
  ADD COLUMN created_ip VARCHAR(45) NULL AFTER admin_notes;
