# MMEvent — System Rezerwacji Fotolustra

Produkcyjny system rezerwacji atrakcji eventowych (fotolustro, w przyszłości: budki telefoniczne, telefon życzeń i inne) dla firmy **MMEvent** (Wiejska 4A, Szczecin).

## Struktura repozytorium

| Katalog     | Zawartość                                                        |
|-------------|------------------------------------------------------------------|
| `frontend/` | React 18 + Vite — panel klienta, onboarding rezerwacji, CRM      |
| `backend/`  | PHP 8.3 REST API (PDO, JWT, Composer) — wdrożenie na LH.pl (FTP) |
| `database/` | Migracje SQL (MySQL 8) + seedery                                 |
| `cron/`     | Zadania cykliczne (kolejka e-mail/SMS, przypomnienia, blokady)   |
| `docs/`     | Architektura, dokumentacja API, instrukcje konfiguracji          |

## Szybki start (development)

### Backend
```bash
cd backend
composer install
cp .env.example .env        # uzupełnij dane bazy MySQL
php bin/migrate.php          # migracje + seedery
php -S localhost:8000 -t public
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env         # VITE_API_URL=http://localhost:8000
npm run dev
```

Domyślny administrator (po seedach): `kontakt@mmevents.pl` / `Admin123!` — **zmień hasło po pierwszym logowaniu**.

## Dokumentacja

- [Architektura systemu](docs/architektura.md)
- [Dokumentacja API](docs/api.md)
- [Wdrożenie na LH.pl](docs/01-wdrozenie-lhpl.md)
- Instrukcje integracji: [Google Maps](docs/02-google-maps.md), [Google Calendar](docs/03-google-calendar.md), [Google Login](docs/04-google-login.md), [Google Drive](docs/05-google-drive.md), [Podpis umów (SMS OTP)](docs/06-podpis-umow.md), [Brevo](docs/07-brevo.md), [SMSAPI](docs/08-smsapi.md), [PayNow](docs/09-paynow.md), [Cloudflare (CDN/WAF/Turnstile)](docs/10-cloudflare.md), [Analityka (GTM/GA4/Pixel)](docs/11-analityka.md)
- [Umowy z szablonu Google Docs (Apps Script)](docs/12-google-apps-script-umowy.md)
- [Prompty AI do grafik](docs/ai-images-prompts.md)
