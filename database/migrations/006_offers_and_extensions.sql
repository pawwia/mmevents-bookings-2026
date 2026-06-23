-- 006 — typ imprezy + wycena indywidualna + zgody + oferty + transport od granicy Szczecina
-- (Na serwerze z działającą bazą: zaimportuj ten plik w phpMyAdmin.)
SET NAMES utf8mb4;

-- Rezerwacja: typ imprezy, liczba osób, wycena indywidualna, zgody, powiązanie z ofertą
ALTER TABLE bookings
  ADD COLUMN event_type VARCHAR(40) NULL AFTER duration_hours,
  ADD COLUMN guests_count INT UNSIGNED NULL AFTER event_type,
  ADD COLUMN requires_individual_quote TINYINT(1) NOT NULL DEFAULT 0 AFTER requires_manual_confirmation,
  ADD COLUMN terms_accepted_at DATETIME NULL AFTER client_notes,
  ADD COLUMN offer_id BIGINT UNSIGNED NULL AFTER attraction_id;

-- Oferty przygotowywane ręcznie w CRM (interaktywna strona z wariantami cenowymi)
CREATE TABLE offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token CHAR(32) NOT NULL,
  status ENUM('draft','sent','accepted','cancelled') NOT NULL DEFAULT 'draft',
  client_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  nip VARCHAR(15) NULL,
  company_name VARCHAR(255) NULL,
  event_type VARCHAR(40) NULL,
  guests_count INT UNSIGNED NULL,
  event_date DATE NULL,
  start_time TIME NULL,
  venue_name VARCHAR(255) NULL,
  venue_address VARCHAR(500) NULL,
  distance_km DECIMAL(7,1) NOT NULL DEFAULT 0,
  travel_time_min INT UNSIGNED NOT NULL DEFAULT 0,
  intro TEXT NULL COMMENT 'wiadomość powitalna na stronie oferty',
  valid_until DATE NULL,
  accepted_variant_id INT UNSIGNED NULL,
  booking_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_offers_token (token),
  KEY idx_offers_status (status),
  CONSTRAINT fk_offers_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_offers_admin FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE offer_variants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  package_id INT UNSIGNED NULL COMMENT 'pakiet bazowy (czas trwania, elementy stockowe)',
  name VARCHAR(150) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_hours DECIMAL(4,2) NULL,
  items JSON NULL COMMENT 'lista pozycji oferty (stockowe + własne udogodnienia)',
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_variants_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  CONSTRAINT fk_variants_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;

-- Nowe ustawienia: transport od granicy Szczecina, zasięg, regulaminy, limit osób
INSERT INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('maps', 'maps.billing_origin', 'Szczecin, Polska', 'string', 'Punkt rozliczania km (centrum miasta)', 0, 5),
('maps', 'maps.city_free_km', '9', 'float', 'Promień miasta odejmowany od trasy (km od centrum do granicy)', 0, 6),
('maps', 'maps.free_city', 'Szczecin', 'string', 'Miasto z darmowym dojazdem (każdy pakiet)', 1, 7),
('maps', 'maps.allowed_provinces', 'zachodniopomorskie,lubuskie', 'string', 'Obsługiwane województwa (po przecinku)', 1, 8),
('booking', 'booking.max_guests_standard', '200', 'int', 'Limit osób dla cennika standardowego', 1, 8),
('app', 'app.privacy_url', 'https://mmevents.pl/polityka-prywatnosci', 'string', 'Link do polityki prywatności', 1, 30),
('app', 'app.terms_url', 'https://mmevents.pl/regulamin', 'string', 'Link do regulaminu', 1, 31);

-- Nowe szablony e-mail
INSERT INTO email_templates (code, name, subject, body, variables) VALUES
('individual_quote', 'Zapytanie — wycena indywidualna', 'Otrzymaliśmy Twoje zapytanie — przygotujemy indywidualną ofertę',
'<p>Dzień dobry {{imie}},</p><p>dziękujemy za zapytanie dotyczące imprezy <strong>{{typ_imprezy}}</strong> w terminie <strong>{{data_imprezy}}</strong> ({{liczba_osob}} osób).</p><p>Tego typu realizacje wyceniamy indywidualnie — w ciągu <strong>24 godzin</strong> otrzymasz od nas spersonalizowaną ofertę. Możesz też napisać bezpośrednio: <a href="mailto:kontakt@mmevents.pl">kontakt@mmevents.pl</a>.</p><p>{{stopka}}</p>',
'["imie","typ_imprezy","data_imprezy","liczba_osob","stopka"]'),
('offer_ready', 'Oferta dla klienta', 'Twoja oferta od MMEvent jest gotowa ✨',
'<p>Dzień dobry {{imie}},</p><p>przygotowaliśmy dla Ciebie ofertę na <strong>{{data_imprezy}}</strong>. Zobacz warianty i wybierz ten, który najbardziej Ci odpowiada:</p><p><a href="{{link_oferty}}">{{link_oferty}}</a></p><p>Oferta ważna do: <strong>{{wazna_do}}</strong>.</p><p>{{stopka}}</p>',
'["imie","data_imprezy","link_oferty","wazna_do","stopka"]');

-- Zmienne kwot wpłat w szablonie potwierdzenia zadatku
UPDATE email_templates
SET variables = '["imie","data_imprezy","dni_blokady","link_panelu","wplacono","pozostalo","stopka"]'
WHERE code = 'deposit_received';
