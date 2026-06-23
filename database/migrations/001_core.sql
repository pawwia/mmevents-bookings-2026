-- 001_core.sql — użytkownicy, profile klientów, atrakcje, pakiety, cennik roczny
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS migrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(64) NULL,
  role ENUM('client','admin') NOT NULL DEFAULT 'client',
  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  phone VARCHAR(30) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google (google_id),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('private','company') NOT NULL DEFAULT 'private',
  street VARCHAR(150) NULL,
  house_no VARCHAR(20) NULL,
  apartment_no VARCHAR(20) NULL,
  postal_code VARCHAR(10) NULL,
  city VARCHAR(120) NULL,
  country VARCHAR(60) NOT NULL DEFAULT 'Polska',
  company_name VARCHAR(255) NULL,
  nip VARCHAR(15) NULL,
  company_address VARCHAR(255) NULL,
  representative VARCHAR(150) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profile_user (user_id),
  KEY idx_profile_nip (nip),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Typy atrakcji (fotolustro, budka telefoniczna, telefon życzeń, ...)
CREATE TABLE attraction_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_attraction_types_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Konkretne egzemplarze (firma ma obecnie 1 fotolustro)
CREATE TABLE attractions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attraction_type_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_attractions_type (attraction_type_id),
  CONSTRAINT fk_attractions_type FOREIGN KEY (attraction_type_id) REFERENCES attraction_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE packages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attraction_type_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  duration_hours DECIMAL(4,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_packages_type (attraction_type_id),
  CONSTRAINT fk_packages_type FOREIGN KEY (attraction_type_id) REFERENCES attraction_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cennik per rok: każdy rok ma własną cenę, limit km, opis i zawartość
CREATE TABLE package_prices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  package_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  free_km INT UNSIGNED NOT NULL DEFAULT 0,
  description TEXT NULL,
  features JSON NULL COMMENT '{"included":[...],"excluded":[...]}',
  guestbook_standard_price DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  guestbook_personalized_price DECIMAL(10,2) NOT NULL DEFAULT 150.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_package_year (package_id, year),
  KEY idx_prices_year (year),
  CONSTRAINT fk_prices_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
