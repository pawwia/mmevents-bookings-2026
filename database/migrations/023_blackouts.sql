-- 023 — urlopy / blokady terminów: pojedynczy dzień lub przedział, z komentarzem dla klienta.
SET NAMES utf8mb4;

CREATE TABLE blackout_dates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  comment VARCHAR(500) NULL COMMENT 'pokazywany klientowi przy sprawdzaniu terminu',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_blackout_range (start_date, end_date),
  CONSTRAINT fk_blackout_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
