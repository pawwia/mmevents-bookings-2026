-- 016 — ręczne odblokowanie personalizacji przez administratora (mimo blokady terminowej).
-- Gdy ustawione: klient może edytować personalizację nawet w okresie blokady N dni przed imprezą
-- (i mimo automatycznej blokady ustawionej przez cron).
SET NAMES utf8mb4;

ALTER TABLE bookings
  ADD COLUMN personalization_unlocked_at DATETIME NULL
    COMMENT 'ręczne odblokowanie personalizacji przez admina — pomija blokadę terminową'
    AFTER personalization_locked_at;
