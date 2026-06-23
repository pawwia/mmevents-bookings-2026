-- 017 — animacje przeniesione ze starego systemu (te same nazwy, linki YouTube).
-- Usuwa demonstracyjne placeholdery i dodaje realne animacje. Idempotentne (klucz: youtube_url).
SET NAMES utf8mb4;

-- Usuń testowe/demo animacje (placeholdery z seeda 006)
DELETE FROM animations WHERE name IN ('Konfetti', 'Serca', 'Boomerang');

-- Realne animacje (miniatury generowane z YouTube). Wstawiane tylko, jeśli jeszcze nie istnieją.
INSERT INTO animations (name, thumbnail_url, youtube_url, sort_order)
SELECT t.name, t.thumbnail_url, t.youtube_url, t.sort_order FROM (
  SELECT 'Party01' AS name, 'https://img.youtube.com/vi/Lc-QrdEQct4/hqdefault.jpg' AS thumbnail_url, 'https://www.youtube.com/watch?v=Lc-QrdEQct4' AS youtube_url, 1 AS sort_order
  UNION ALL SELECT 'party02', 'https://img.youtube.com/vi/oZfMuoYVBq8/hqdefault.jpg', 'https://www.youtube.com/watch?v=oZfMuoYVBq8', 2
  UNION ALL SELECT 'WED01',   'https://img.youtube.com/vi/GuhL0OZtZYw/hqdefault.jpg', 'https://www.youtube.com/watch?v=GuhL0OZtZYw', 3
  UNION ALL SELECT 'WED02',   'https://img.youtube.com/vi/RUU6HRsbMhM/hqdefault.jpg', 'https://www.youtube.com/watch?v=RUU6HRsbMhM', 4
  UNION ALL SELECT 'UNI01',   'https://img.youtube.com/vi/62119gN29xw/hqdefault.jpg', 'https://www.youtube.com/watch?v=62119gN29xw', 5
  UNION ALL SELECT 'KID01',   'https://img.youtube.com/vi/UQEJgIkOeSc/hqdefault.jpg', 'https://www.youtube.com/watch?v=UQEJgIkOeSc', 6
) AS t
WHERE NOT EXISTS (SELECT 1 FROM animations a WHERE a.youtube_url = t.youtube_url);
