-- Rezerwacja testowa do sprawdzenia modułu podpisywania umowy.
-- Import w phpMyAdmin (zakładka Import / SQL). Tworzy klienta + rezerwację w statusie
-- „Oczekuje na umowę i potwierdzenie" — gotową do wygenerowania umowy w CRM.
--
-- Logowanie do panelu klienta (ETAP 2 podpisu): test.klient@example.com / Admin123!
SET NAMES utf8mb4;

-- 1. Klient testowy (hash hasła = Admin123!). Jeśli już istnieje — pomijamy duplikat.
INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
SELECT 'test.klient@example.com', '$2y$10$ugOCz4ycnR7xGbWvVJCAC.AH9iYRCWCaNDevsAeCcDkTWAFzBsREG',
       'client', 'Jan', 'Testowy', '+48500600700'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'test.klient@example.com');

SET @uid := (SELECT id FROM users WHERE email = 'test.klient@example.com' LIMIT 1);

-- 2. Profil klienta (osoba prywatna z pełnym adresem — potrzebny do umowy)
INSERT INTO client_profiles (user_id, type, street, house_no, postal_code, city, country)
SELECT @uid, 'private', 'Testowa', '4A', '70-001', 'Szczecin', 'Polska'
WHERE NOT EXISTS (SELECT 1 FROM client_profiles WHERE user_id = @uid);

-- 3. Pakiet, cennik i atrakcja (Pakiet 3H, rok 2026, pierwsze fotolustro)
SET @pid    := (SELECT id FROM packages WHERE name = 'Pakiet 3H' LIMIT 1);
SET @ppid   := (SELECT id FROM package_prices WHERE package_id = @pid AND year = 2026 LIMIT 1);
SET @pprice := (SELECT price FROM package_prices WHERE id = @ppid);
SET @freekm := (SELECT free_km FROM package_prices WHERE id = @ppid);
SET @aid    := (SELECT id FROM attractions WHERE is_active = 1 ORDER BY id LIMIT 1);

-- 4. Rezerwacja — status awaiting_contract (gotowa do generowania umowy)
INSERT INTO bookings
(user_id, attraction_id, package_id, package_price_id, event_date, start_time, duration_hours,
 event_type, guests_count, status, requires_manual_confirmation, requires_individual_quote,
 venue_name, venue_address, distance_km, travel_time_min,
 package_price, free_km, km_rate, transport_cost, guestbook, guestbook_price,
 discount_amount, total_price, deposit_percent, deposit_amount, terms_accepted_at)
VALUES
(@uid, @aid, @pid, @ppid, DATE_ADD(CURDATE(), INTERVAL 45 DAY), '18:00:00', 3.00,
 'wesele', 120, 'awaiting_contract', 0, 0,
 'Sala Testowa', 'Wiejska 4A, 70-001 Szczecin', 0, 0,
 @pprice, @freekm, 1.60, 0, 'none', 0,
 0, @pprice, 30.00, ROUND(@pprice * 0.30, 2), NOW());

SET @bid := LAST_INSERT_ID();

-- 5. Pusta personalizacja + wpis w historii statusów
INSERT INTO booking_personalizations (booking_id) VALUES (@bid);
INSERT INTO booking_status_history (booking_id, old_status, new_status, note)
VALUES (@bid, NULL, 'awaiting_contract', 'Rezerwacja testowa (skrypt)');

SELECT @bid AS utworzono_rezerwacje_id;
