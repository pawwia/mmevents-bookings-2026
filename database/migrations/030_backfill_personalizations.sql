-- 030 — uzupełnienie brakujących wierszy personalizacji dla rezerwacji
-- zaimportowanych ze starego systemu (wstawiane prosto do bazy, bez wiersza
-- w booking_personalizations). Bez tego zapis personalizacji „znikał" (UPDATE w 0 wierszy).
SET NAMES utf8mb4;

INSERT INTO booking_personalizations (booking_id)
SELECT b.id
FROM bookings b
LEFT JOIN booking_personalizations p ON p.booking_id = b.id
WHERE p.id IS NULL;
