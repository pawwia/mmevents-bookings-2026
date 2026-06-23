-- 013 — zmiana e-maila konta administratora CRM na kontakt@mmevents.pl.
-- Bezpieczne: aktualizuje istniejące konto admina, nie tworzy nowego.
SET NAMES utf8mb4;

UPDATE users
SET email = 'kontakt@mmevents.pl'
WHERE email = 'admin@mmevent.pl' AND role = 'admin';
