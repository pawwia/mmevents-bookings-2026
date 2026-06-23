-- 027 — ustaw produkcyjny adres frontendu dla linków w mailach (weryfikacja, umowy, oferty…).
-- Aktualizujemy tylko, gdy ustawienie wciąż trzyma domyślny localhost lub jest puste —
-- świadomie ustawionej wartości nie nadpisujemy.
SET NAMES utf8mb4;

UPDATE settings
SET value = 'https://bookings.mmevents.pl'
WHERE `key` = 'app.frontend_url'
  AND (
    value IS NULL
    OR value = ''
    OR value REGEXP '^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?/?$'
  );
