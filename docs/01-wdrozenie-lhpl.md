# Instrukcja wdrożenia na LH.pl

Backend (PHP 8.3 + MySQL 8) działa na hostingu współdzielonym LH.pl, wgrywany przez FTP.
Frontend (statyczny build Vite) możesz hostować razem z backendem na **jednej domenie**
(zalecane: `bookings.mmevents.pl`) albo osobno.

> **Wariant jedna domena (bookings.mmevents.pl):** backend i frontend dzielą webroot.
> Wgraj backend wg punktu 4, a potem zawartość `frontend/dist/` do tego samego katalogu
> `public/` (obok `index.php`). Dołączony `.htaccess` kieruje `/api/*` do PHP, a pozostałe
> ścieżki do `index.html` (React Router). W `frontend/.env` ustaw
> `VITE_API_URL=https://bookings.mmevents.pl`, w `backend/.env` —
> `FRONTEND_URL=https://bookings.mmevents.pl`. Punkt 6 (.htaccess SPA) wtedy pomijasz.

## 1. Przygotowanie w panelu LH.pl

1. **Domeny:** dodaj domenę/subdomenę `bookings.mmevents.pl` (lub dwie osobne, jeśli wolisz rozdzielić API i frontend).
2. **PHP:** w panelu → *Strony WWW → ustawienia domeny* ustaw **PHP 8.3** dla `api.twojadomena.pl`.
3. **Baza danych:** utwórz bazę MySQL (panel → *Bazy danych*). Zanotuj: host (zwykle `localhost`), nazwę bazy, użytkownika, hasło.

## 2. Import bazy danych

W panelu LH.pl otwórz **phpMyAdmin** i zaimportuj kolejno:

1. `database/migrations/001_core.sql` … `005_settings.sql` (w kolejności numerów),
2. `database/seeds/001_admin_and_attractions.sql` … `006_demo_catalog.sql`.

Po imporcie w tabeli `users` jest konto `kontakt@mmevents.pl` / `Admin123!` — **zmień hasło po pierwszym logowaniu**.

## 3. Przygotowanie backendu lokalnie

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
```

Uzupełnij `.env`:

```
APP_ENV=production
APP_DEBUG=0
DB_HOST=localhost
DB_NAME=nazwa_bazy
DB_USER=uzytkownik
DB_PASS=haslo
JWT_SECRET=  ← wygeneruj: openssl rand -hex 32
FRONTEND_URL=https://rezerwacje.twojadomena.pl
CRON_SECRET= ← wygeneruj: openssl rand -hex 16
```

## 4. Wgranie backendu przez FTP

Struktura na serwerze (katalog domeny `api.twojadomena.pl`):

```
api.twojadomena.pl/          ← document root wskazuje na backend/public
├── public/                  ← zawartość jako webroot (index.php, .htaccess, uploads/)
├── src/
├── vendor/                  ← wgraj cały katalog po composer install
├── bin/
├── storage/logs/            ← nadaj prawa zapisu (755/775)
├── cron/                    ← skopiuj katalog cron/ z repozytorium
└── .env
```

**Ważne:** jeśli panel LH.pl pozwala ustawić *document root* — wskaż katalog `public/`.
Jeśli nie, wgraj zawartość `public/` do `public_html/`, a `src/`, `vendor/`, `cron/`, `.env`
katalog wyżej, i w `public_html/index.php` popraw ścieżki `dirname(__DIR__)` na właściwe.

Sprawdź działanie: `https://api.twojadomena.pl/api/health` → JSON z ustawieniami publicznymi.

## 5. Cron w panelu LH.pl

Panel → *Cron*. Dodaj zadania (typ: URL albo PHP CLI, jeśli dostępny):

```
*/5 * * * *  https://api.twojadomena.pl/cron/send_email_queue.php?secret=CRON_SECRET
*/5 * * * *  https://api.twojadomena.pl/cron/send_sms_queue.php?secret=CRON_SECRET
0 8 * * *    https://api.twojadomena.pl/cron/send_reminders.php?secret=CRON_SECRET
5 8 * * *    https://api.twojadomena.pl/cron/lock_personalization.php?secret=CRON_SECRET
*/15 * * * * https://api.twojadomena.pl/cron/sync_google_calendar.php?secret=CRON_SECRET
30 3 * * *   https://api.twojadomena.pl/cron/cleanup.php?secret=CRON_SECRET
```

(Jeżeli cron ma być dostępny przez URL, katalog `cron/` musi znajdować się w webroot —
wtedy wgraj go do `public/cron/` i w `bootstrap.php` zaktualizuj ścieżkę do `vendor/autoload.php`.)

## 6. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=https://api.twojadomena.pl
# VITE_GOOGLE_CLIENT_ID=...
npm install
npm run build
```

Wgraj zawartość `dist/` przez FTP do webroot `rezerwacje.twojadomena.pl`.
Dodaj plik `.htaccess` (SPA fallback dla React Router):

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

## 7. Konfiguracja po wdrożeniu (CRM)

Zaloguj się na `https://rezerwacje.twojadomena.pl/logowanie` jako admin i w **Ustawieniach systemu** uzupełnij:

1. Dane firmy (NIP, REGON, adres, telefon, stopka mailowa),
2. Finanse (numer konta, zadatek %, stawka/km),
3. Klucze API: Google Maps (docs 02), Calendar (03), Drive (05), Brevo (07), SMSAPI (08),
4. `app.frontend_url` → adres frontendu (linki w mailach),
5. Podpis umów (06): telefon właściciela; PayNow (09) — opcjonalnie.

## 8. SSL i bezpieczeństwo

- Włącz **Let's Encrypt** dla obu subdomen (panel LH.pl → SSL).
- Upewnij się, że `.env` nie jest dostępny z przeglądarki (`.htaccess` już to blokuje).
- Zmień hasło administratora i usuń konto demo, jeśli nie jest potrzebne.
