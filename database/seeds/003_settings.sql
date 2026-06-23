-- 003 — ustawienia systemowe (wszystkie edytowalne w CRM → Ustawienia)
SET NAMES utf8mb4;

INSERT INTO settings (`group`, `key`, `value`, type, label, is_public, sort_order) VALUES
-- DANE FIRMY
('company', 'company.name',          'MMEvents',                       'string', 'Nazwa firmy', 1, 1),
('company', 'company.nip',           '',                              'string', 'NIP', 0, 2),
('company', 'company.regon',         '',                              'string', 'REGON', 0, 3),
('company', 'company.address',       'Wiejska 4A, Szczecin',          'string', 'Adres siedziby', 1, 4),
('company', 'company.phone',         '',                              'string', 'Telefon', 1, 5),
('company', 'company.email',         'kontakt@mmevents.pl',            'string', 'E-mail', 1, 6),
('company', 'company.website',       'https://mmevents.pl',            'string', 'Strona WWW', 1, 7),
('company', 'company.logo_url',      '/images/logo-placeholder.png',  'string', 'Logo (URL)', 1, 8),
('company', 'company.email_footer',  'MMEvents — fotolustro na Twoją imprezę\nWiejska 4A, Szczecin\nkontakt@mmevents.pl', 'text', 'Stopka mailowa', 0, 9),

-- FINANSE
('finance', 'finance.bank_account',   '',     'string', 'Numer konta bankowego', 0, 1),
('finance', 'finance.deposit_percent','30',   'float',  'Wysokość zadatku (%)', 0, 2),
('finance', 'finance.km_rate',        '1.60', 'float',  'Stawka za kilometr (zł)', 0, 3),
('finance', 'finance.currency',       'PLN',  'string', 'Waluta', 1, 4),

-- GOOGLE MAPS
('maps', 'maps.api_key',             '', 'secret', 'Google Maps API Key', 0, 1),
('maps', 'maps.places_api_key',      '', 'secret', 'Places API Key', 0, 2),
('maps', 'maps.distance_api_key',    '', 'secret', 'Distance Matrix API Key', 0, 3),
('maps', 'maps.origin_address',      'Wiejska 4A, Szczecin, Polska', 'string', 'Adres siedziby (punkt startowy)', 0, 4),

-- GOOGLE CALENDAR
('calendar', 'calendar.client_id',     '', 'string', 'Client ID', 0, 1),
('calendar', 'calendar.client_secret', '', 'secret', 'Client Secret', 0, 2),
('calendar', 'calendar.calendar_id',   '', 'string', 'Calendar ID', 0, 3),
('calendar', 'calendar.enabled',       '0','bool',   'Synchronizacja włączona', 0, 4),

-- GOOGLE DRIVE
('drive', 'drive.service_account_json', '', 'secret', 'Service Account (JSON)', 0, 1),
('drive', 'drive.contracts_folder_id',  '', 'string', 'ID folderu umów', 0, 2),
('drive', 'drive.gallery_folder_id',    '', 'string', 'ID folderu galerii', 0, 3),
('drive', 'drive.templates_folder_id',  '', 'string', 'ID folderu szablonów', 0, 4),
('drive', 'drive.contract_template_id', '', 'string', 'ID pliku szablonu umowy (Google Doc)', 0, 5),

-- GOOGLE LOGIN
('app', 'google.oauth_client_id',     '', 'string', 'Google OAuth Client ID (logowanie)', 1, 20),
('app', 'google.oauth_client_secret', '', 'secret', 'Google OAuth Client Secret', 0, 21),

-- BREVO
('brevo', 'brevo.api_key',      '',                    'secret', 'Brevo API Key', 0, 1),
('brevo', 'brevo.sender_email', 'rezerwacje@mmevents.pl','string', 'Nadawca e-mail', 0, 2),
('brevo', 'brevo.sender_name',  'MMEvents',             'string', 'Nazwa nadawcy', 0, 3),

-- SMSAPI
('smsapi', 'smsapi.token',  '',        'secret', 'Token API', 0, 1),
('smsapi', 'smsapi.sender', 'MMEvents', 'string', 'Nazwa nadawcy SMS', 0, 2),
('smsapi', 'smsapi.enabled','1',       'bool',   'Wysyłka SMS włączona', 0, 3),

-- PAYNOW (domyślnie wyłączony — klient widzi tylko przelew tradycyjny)
('paynow', 'paynow.enabled',       '0', 'bool',   'PayNow włączony', 1, 1),
('paynow', 'paynow.api_key',       '',  'secret', 'API Key', 0, 2),
('paynow', 'paynow.signature_key', '',  'secret', 'Signature Key', 0, 3),
('paynow', 'paynow.sandbox',       '1', 'bool',   'Tryb sandbox', 0, 4),

-- PODPIS UMÓW (własny moduł SMS OTP + Brevo; ustawienia signing.* dodaje migracja 009)

-- USTAWIENIA REZERWACJI
('booking', 'booking.personalization_lock_days', '3',     'int',  'Ile dni przed imprezą blokować personalizację', 1, 1),
('booking', 'booking.reminder_days',             '7',     'int',  'Ile dni przed imprezą wysłać przypomnienie', 0, 2),
('booking', 'booking.reminder_sms',              '1',     'bool', 'Przypomnienie SMS', 0, 3),
('booking', 'booking.reminder_email',            '1',     'bool', 'Przypomnienie e-mail', 0, 4),
('booking', 'booking.cron_hour',                 '08:00', 'string', 'Godzina wykonywania cronów dziennych', 0, 5),
('booking', 'booking.setup_minutes',             '60',    'int',  'Czas rozstawiania (min)', 0, 6),
('booking', 'booking.teardown_minutes',          '40',    'int',  'Czas zwijania (min)', 0, 7),

-- USTAWIENIA WYGLĄDU (rebranding bez zmian w kodzie)
('appearance', 'appearance.primary_color',   '#E8AEB7', 'string', 'Kolor główny', 1, 1),
('appearance', 'appearance.secondary_color', '#FDF3F5', 'string', 'Kolor dodatkowy', 1, 2),
('appearance', 'appearance.logo_url',        '/images/logo-placeholder.png', 'string', 'Logo', 1, 3),
('appearance', 'appearance.favicon_url',     '/images/favicon.png', 'string', 'Favicon', 1, 4),

-- APLIKACJA
('app', 'app.frontend_url', 'http://localhost:5173', 'string', 'Adres frontendu (CORS, linki w mailach)', 0, 1),
('app', 'app.jwt_secret',   '',                      'secret', 'Sekret JWT (generowany przy instalacji)', 0, 2);
