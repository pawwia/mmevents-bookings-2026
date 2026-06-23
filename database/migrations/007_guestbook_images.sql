-- 007 — zdjęcia ksiąg gości (podmienialne w CRM → Ustawienia → Rezerwacje)
SET NAMES utf8mb4;

INSERT INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('booking', 'booking.guestbook_standard_image',     '/images/placeholder-background.png', 'string', 'Zdjęcie księgi standardowej', 1, 9),
('booking', 'booking.guestbook_personalized_image', '/images/placeholder-background.png', 'string', 'Zdjęcie księgi personalizowanej', 1, 10);
