-- 008 — wzory ksiąg gości (katalog jak szablony wydruków, z hashtagami)
--       + pola nadruku (imiona, data) w personalizacji
SET NAMES utf8mb4;

CREATE TABLE guestbook_designs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guestbook_design_hashtag (
  guestbook_design_id INT UNSIGNED NOT NULL,
  hashtag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (guestbook_design_id, hashtag_id),
  CONSTRAINT fk_gdh_design FOREIGN KEY (guestbook_design_id) REFERENCES guestbook_designs(id) ON DELETE CASCADE,
  CONSTRAINT fk_gdh_hashtag FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Personalizacja: wzór księgi (tylko dla księgi personalizowanej) + treść nadruku
ALTER TABLE booking_personalizations
  ADD COLUMN guestbook_design_id INT UNSIGNED NULL AFTER print_text,
  ADD COLUMN guestbook_names VARCHAR(255) NULL COMMENT 'dobrze odmienione imię/imiona na okładce' AFTER guestbook_design_id,
  ADD COLUMN guestbook_date VARCHAR(60) NULL COMMENT 'data nadrukowana na księdze' AFTER guestbook_names,
  ADD CONSTRAINT fk_pers_guestbook_design FOREIGN KEY (guestbook_design_id) REFERENCES guestbook_designs(id) ON DELETE SET NULL;

-- Hashtag "rocznica" + startowe wzory (placeholdery do podmiany)
INSERT IGNORE INTO hashtags (name) VALUES ('rocznica');

INSERT INTO guestbook_designs (name, image_url, sort_order) VALUES
('Klasyczna elegancja',  '/images/placeholder-background.png', 1),
('Kwiatowy motyw',       '/images/placeholder-background.png', 2),
('Złote serca',          '/images/placeholder-background.png', 3);

INSERT INTO guestbook_design_hashtag (guestbook_design_id, hashtag_id)
SELECT d.id, h.id FROM guestbook_designs d, hashtags h
WHERE (d.name = 'Klasyczna elegancja' AND h.name IN ('wesele', 'rocznica'))
   OR (d.name = 'Kwiatowy motyw'      AND h.name IN ('wesele', 'urodziny'))
   OR (d.name = 'Złote serca'         AND h.name IN ('wesele'));
