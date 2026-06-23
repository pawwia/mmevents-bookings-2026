-- 002 — pakiety fotolustra + cennik 2026 (administrator dodaje kolejne lata w CRM)
SET NAMES utf8mb4;

INSERT INTO packages (attraction_type_id, name, duration_hours, sort_order, is_active) VALUES
(1, 'Pakiet 1H', 1.00, 1, 1),
(1, 'Pakiet 2H', 2.00, 2, 1),
(1, 'Pakiet 3H', 3.00, 3, 1),
(1, 'Pakiet 4H', 4.00, 4, 1),
(1, 'Pakiet 5H', 5.00, 5, 1);

-- Księga gości: pakiety 1-3H standardowa 100 zł / personalizowana 150 zł;
-- pakiety 4-5H standardowa gratis / personalizowana 75 zł.
INSERT INTO package_prices
(package_id, year, price, free_km, description, features, guestbook_standard_price, guestbook_personalized_price, is_active)
VALUES
(1, 2026,  999.00,   0, 'Godzina zabawy z fotolustrem — idealny na krótkie przyjęcia.',
 '{"included":["Opieka asystenta","Nielimitowane wydruki","Gadżety imprezowe","2 szablony wydruków","Personalizacja wydruku","Personalizowane tło","Galeria online"],"excluded":["Czerwony dywan","Eleganckie słupki","Księga gości"]}',
 100.00, 150.00, 1),
(2, 2026, 1099.00,   0, 'Dwie godziny atrakcji — sprawdza się na urodzinach i imprezach firmowych.',
 '{"included":["Opieka asystenta","Nielimitowane wydruki","Gadżety imprezowe","2 szablony wydruków","Personalizacja wydruku","Personalizowane tło","Galeria online"],"excluded":["Czerwony dywan","Eleganckie słupki","Księga gości"]}',
 100.00, 150.00, 1),
(3, 2026, 1299.00,  20, 'Trzy godziny z czerwonym dywanem i eleganckimi słupkami.',
 '{"included":["Opieka asystenta","Nielimitowane wydruki","Gadżety imprezowe","2 szablony wydruków","Personalizacja wydruku","Personalizowane tło","Galeria online","Czerwony dywan","Eleganckie słupki"],"excluded":["Księga gości"]}',
 100.00, 150.00, 1),
(4, 2026, 1499.00,  50, 'Cztery godziny — komplet dodatków i standardowa księga gości w cenie.',
 '{"included":["Opieka asystenta","Nielimitowane wydruki","Gadżety imprezowe","2 szablony wydruków","Personalizacja wydruku","Personalizowane tło","Galeria online","Czerwony dywan","Eleganckie słupki","Standardowa księga gości"],"excluded":[]}',
 0.00, 75.00, 1),
(5, 2026, 1699.00, 100, 'Pięć godzin — pełen pakiet na wesela i duże imprezy, 100 km transportu gratis.',
 '{"included":["Opieka asystenta","Nielimitowane wydruki","Gadżety imprezowe","2 szablony wydruków","Personalizacja wydruku","Personalizowane tło","Galeria online","Czerwony dywan","Eleganckie słupki","Standardowa księga gości"],"excluded":[]}',
 0.00, 75.00, 1);
