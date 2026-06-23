-- 025 — czyszczenie liczników limitów (dane transient). Po zmianie logiki na reset po bezczynności
-- kasujemy stare, zakumulowane wpisy, by nikt nie pozostał błędnie zablokowany.
SET NAMES utf8mb4;

DELETE FROM rate_limits;
