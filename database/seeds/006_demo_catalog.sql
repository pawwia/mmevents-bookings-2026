-- 006 — startowy katalog: animacje, tła, szablony wydruków, hashtagi (placeholdery do podmiany)
SET NAMES utf8mb4;

-- Realne animacje (te same nazwy co w starym systemie, miniatury z YouTube).
-- Idempotentne (klucz: youtube_url) — bez duplikatów względem migracji 017.
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

INSERT INTO backgrounds (name, image_url, sort_order) VALUES
('Złote bokeh',      '/images/placeholder-background.png', 1),
('Pastelowy róż',    '/images/placeholder-background.png', 2),
('Kwiatowa ściana',  '/images/placeholder-background.png', 3);

INSERT INTO print_templates (name, image_url, sort_order) VALUES
('Eleganckie wesele',   '/images/placeholder-template.png', 1),
('Urodzinowy banger',   '/images/placeholder-template.png', 2),
('Firmowa klasyka',     '/images/placeholder-template.png', 3),
('Studniówkowy szyk',   '/images/placeholder-template.png', 4);

INSERT INTO hashtags (name) VALUES ('wesele'), ('urodziny'), ('firmowe'), ('studniówka');

INSERT INTO print_template_hashtag (print_template_id, hashtag_id) VALUES
(1, 1), (2, 2), (3, 3), (4, 4);
