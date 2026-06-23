-- 003_bookings.sql — rezerwacje, personalizacje, umowy, płatności, historia statusów
SET NAMES utf8mb4;

CREATE TABLE bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  attraction_id INT UNSIGNED NOT NULL,
  package_id INT UNSIGNED NOT NULL,
  package_price_id INT UNSIGNED NOT NULL,

  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_hours DECIMAL(4,2) NOT NULL,

  status ENUM('new','awaiting_contract','awaiting_deposit','confirmed','last_call','ready','completed','cancelled')
    NOT NULL DEFAULT 'new',
  requires_manual_confirmation TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'zapytanie kolidujące z inną realizacją',

  -- lokalizacja (Google Places)
  venue_name VARCHAR(255) NULL,
  venue_address VARCHAR(500) NOT NULL,
  venue_place_id VARCHAR(255) NULL,
  venue_lat DECIMAL(10,7) NULL,
  venue_lng DECIMAL(10,7) NULL,
  distance_km DECIMAL(7,1) NOT NULL DEFAULT 0,
  travel_time_min INT UNSIGNED NOT NULL DEFAULT 0,

  -- snapshot wyceny (zł)
  package_price DECIMAL(10,2) NOT NULL,
  free_km INT UNSIGNED NOT NULL DEFAULT 0,
  km_rate DECIMAL(6,2) NOT NULL DEFAULT 1.60,
  transport_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  guestbook ENUM('none','standard','personalized') NOT NULL DEFAULT 'none',
  guestbook_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_code_id INT UNSIGNED NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  deposit_percent DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  deposit_amount DECIMAL(10,2) NOT NULL,

  client_notes TEXT NULL,
  admin_notes TEXT NULL,

  google_event_id VARCHAR(255) NULL,
  gallery_link VARCHAR(500) NULL,
  gallery_sent_at DATETIME NULL,
  ask_review TINYINT(1) NOT NULL DEFAULT 0,

  personalization_locked_at DATETIME NULL,
  reminder_sent_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_bookings_date (event_date),
  KEY idx_bookings_status (status),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_attraction_date (attraction_id, event_date),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_attraction FOREIGN KEY (attraction_id) REFERENCES attractions(id),
  CONSTRAINT fk_bookings_package FOREIGN KEY (package_id) REFERENCES packages(id),
  CONSTRAINT fk_bookings_price FOREIGN KEY (package_price_id) REFERENCES package_prices(id),
  CONSTRAINT fk_bookings_discount FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_personalizations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  animation_id INT UNSIGNED NULL,
  background_id INT UNSIGNED NULL,
  print_template_id INT UNSIGNED NULL,
  print_text VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_personalization_booking (booking_id),
  CONSTRAINT fk_pers_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_pers_animation FOREIGN KEY (animation_id) REFERENCES animations(id) ON DELETE SET NULL,
  CONSTRAINT fk_pers_background FOREIGN KEY (background_id) REFERENCES backgrounds(id) ON DELETE SET NULL,
  CONSTRAINT fk_pers_template FOREIGN KEY (print_template_id) REFERENCES print_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contracts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  number VARCHAR(30) NOT NULL COMMENT 'MME/RRRR/MM/NN, NN od 20 co miesiąc',
  year SMALLINT UNSIGNED NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  seq INT UNSIGNED NOT NULL,
  drive_file_id VARCHAR(255) NULL,
  drive_url VARCHAR(500) NULL,
  pergamin_document_id VARCHAR(255) NULL,
  status ENUM('draft','sent','signed','cancelled') NOT NULL DEFAULT 'draft',
  signed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contract_number (number),
  UNIQUE KEY uq_contract_seq (year, month, seq),
  KEY idx_contracts_booking (booking_id),
  CONSTRAINT fk_contracts_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  type ENUM('deposit','final','other') NOT NULL DEFAULT 'deposit',
  method ENUM('transfer','paynow') NOT NULL DEFAULT 'transfer',
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  paynow_payment_id VARCHAR(255) NULL,
  marked_by BIGINT UNSIGNED NULL COMMENT 'admin oznaczający wpłatę ręcznie',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_booking (booking_id),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_admin FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  old_status VARCHAR(30) NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_by BIGINT UNSIGNED NULL COMMENT 'NULL = system/cron',
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bsh_booking (booking_id),
  CONSTRAINT fk_bsh_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_bsh_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
