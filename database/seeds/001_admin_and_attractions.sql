-- 001 — konto administratora + typy atrakcji + pierwsze fotolustro
SET NAMES utf8mb4;

INSERT INTO users (email, password_hash, role, first_name, last_name, phone) VALUES
('kontakt@mmevents.pl', '$2y$10$ugOCz4ycnR7xGbWvVJCAC.AH9iYRCWCaNDevsAeCcDkTWAFzBsREG', 'admin', 'Administrator', 'MMEvent', '+48000000000');

INSERT INTO attraction_types (name, slug, description, is_active, sort_order) VALUES
('Fotolustro', 'fotolustro', 'Interaktywne fotolustro z drukiem zdjęć na miejscu', 1, 1),
('Budka telefoniczna', 'budka-telefoniczna', 'Retro budka telefoniczna — przygotowane na przyszłość', 0, 2),
('Telefon życzeń', 'telefon-zyczen', 'Telefon do nagrywania życzeń audio — przygotowane na przyszłość', 0, 3);

INSERT INTO attractions (attraction_type_id, name, description, is_active) VALUES
(1, 'Fotolustro #1', 'Główne fotolustro MMEvent', 1);
