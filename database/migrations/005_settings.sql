-- 005_settings.sql — ustawienia systemowe + audyt zmian
SET NAMES utf8mb4;

CREATE TABLE settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `group` VARCHAR(50) NOT NULL COMMENT 'company|finance|maps|calendar|drive|brevo|smsapi|paynow|signing|booking|appearance|app',
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NULL,
  type ENUM('string','text','int','float','bool','json','secret') NOT NULL DEFAULT 'string',
  label VARCHAR(200) NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'widoczne bez logowania (np. kolory, logo)',
  sort_order INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_settings_key (`key`),
  KEY idx_settings_group (`group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE settings_audit (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  changed_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_key (setting_key),
  KEY idx_audit_date (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
