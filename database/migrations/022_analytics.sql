-- 022 — analityka/piksele: Google Tag Manager, Google Analytics 4, Facebook Pixel.
-- ID są publiczne (wstrzykiwane na froncie). Konfiguracja w CRM → Ustawienia → Analityka.
SET NAMES utf8mb4;

INSERT IGNORE INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
('analytics', 'analytics.gtm_id',            '', 'string', 'Google Tag Manager — ID kontenera (GTM-XXXXXXX)',       1, 1),
('analytics', 'analytics.ga_measurement_id', '', 'string', 'Google Analytics 4 — Measurement ID (G-XXXXXXXXXX)',    1, 2),
('analytics', 'analytics.fb_pixel_id',       '', 'string', 'Facebook Pixel — ID piksela',                           1, 3);
