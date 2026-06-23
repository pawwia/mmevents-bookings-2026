# Architektura systemu MMEvent

## 1. Przegląd

System składa się z trzech niezależnie wdrażanych części:

```
┌──────────────────────┐         ┌───────────────────────┐
│  FRONTEND (React 18) │  HTTPS  │  BACKEND (PHP 8.3)    │
│  Vite + MUI          │ ──────► │  REST API + JWT       │
│  hosting statyczny   │  JSON   │  LH.pl (FTP)          │
└──────────────────────┘         └─────────┬─────────────┘
                                           │ PDO
                                 ┌─────────▼─────────────┐
                                 │  MySQL 8              │
                                 └─────────▲─────────────┘
                                           │
                                 ┌─────────┴─────────────┐
                                 │  CRON (PHP CLI)       │
                                 │  kolejki, przypomnienia│
                                 └───────────────────────┘
```

Integracje zewnętrzne (wszystkie konfigurowane w CRM → Ustawienia, klucze w bazie):

- **Google Maps / Places / Distance Matrix** — autouzupełnianie adresów, dystans od siedziby (Wiejska 4A, Szczecin), czas dojazdu.
- **Google Calendar** — synchronizacja rezerwacji z kalendarzem firmowym.
- **Google Drive** — generowanie umów z szablonu Doc, przechowywanie umów i galerii.
- **Google OAuth** — logowanie klientów.
- **Podpis umów (własny moduł SMS OTP)** — dwuetapowy podpis (właściciel + klient) kodami SMS,
  hash SHA-256 dokumentu, końcowy PDF ze stroną potwierdzenia, archiwizacja na Drive.
- **Brevo** — wysyłka e-mail (przez kolejkę w bazie, cron; podpisany PDF jako załącznik).
- **SMSAPI** — wysyłka SMS (kolejka powiadomień + synchroniczne kody OTP).
- **PayNow** — płatności online (przygotowane technicznie, domyślnie wyłączone).
- **Wykaz Podatników VAT (MF)** — automatyczne pobieranie danych firmy po NIP.

## 2. Zasady projektowe

1. **Multi-atrakcja od pierwszego dnia.** Rezerwacja wskazuje `attraction_id` (konkretny egzemplarz) należący do `attraction_types` (fotolustro, budka telefoniczna…). Pakiety są przypięte do typu atrakcji. Dodanie nowej atrakcji = wiersze w bazie, zero zmian w kodzie.
2. **Cennik per rok.** Tabela `package_prices` (pakiet × rok): cena, darmowe km, opis, zawartość (JSON). Administrator zarządza cennikiem 2026/2027/2028… w CRM.
3. **Konfiguracja w bazie.** Tabela `settings` (klucz/wartość/typ/grupa) + audyt zmian (`settings_audit`). 95% konfiguracji biznesowej bez programisty: dane firmy, finanse, klucze API, treści e-mail/SMS, parametry rezerwacji, wygląd (kolory, logo).
4. **Snapshot cen w rezerwacji.** Booking przechowuje skopiowaną cenę pakietu, koszt transportu, cenę księgi i rabat — późniejsze zmiany cennika nie zmieniają zawartych umów.
5. **Komunikacja przez kolejki.** Żaden e-mail/SMS nie jest wysyłany w trakcie żądania HTTP — trafia do `email_queue` / `sms_queue`, wysyłany cronem (retry, log błędów).
6. **Bez frameworka backendowego.** Lekki własny rdzeń (router, request/response, kontener PDO) — łatwy deploy przez FTP na hosting współdzielony LH.pl, brak wymagań CLI na serwerze.

## 3. Backend — warstwy

```
public/index.php      → front controller (CORS, routing)
src/Core/             → App, Router, Request, Response, Database, Config, Validator
src/Middleware/       → Auth (JWT), Admin (rola), RateLimit
src/Controllers/      → cienkie kontrolery REST (walidacja wejścia → serwis → JSON)
src/Services/         → logika domenowa i integracje:
   PricingService        — wycena: pakiet(rok) + transport + księga − rabat, zadatek 30%
   AvailabilityService   — analiza terminu: imprezy + dojazd + 1h montaż + 40min demontaż
   ContractService       — numeracja MME/RRRR/MM/NN (od 20), generowanie z szablonu Drive
   SettingsService       — cache ustawień, audyt zmian
   JwtService            — HS256, access token
   GoogleAuthService     — OAuth (login) + Service Account (Drive/Calendar, RS256)
   GoogleMapsService     — Places, Distance Matrix
   GoogleCalendarService — push/update/delete wydarzeń
   GoogleDriveService    — kopiowanie szablonu, podstawianie zmiennych, upload
   SigningService        — podpis SMS OTP: hash, statusy, finalizacja PDF
   OtpService            — kody OTP (6 cyfr, 10 min, 5 prób, hash)
   PdfService            — strona potwierdzenia (FPDF) + scalenie PDF (FPDI)
   BrevoService          — REST wysyłka e-maili (z kolejki)
   SmsApiService         — REST wysyłka SMS (z kolejki)
   PayNowService         — inicjacja płatności + weryfikacja sygnatur (domyślnie OFF)
   NipService            — Wykaz Podatników VAT (MF) — dane firmy po NIP
   MailerService         — render szablonów ({{zmienne}}), kolejkowanie
```

## 4. Statusy rezerwacji (maszyna stanów)

| Kod              | Nazwa PL                          | Przejście                                   |
|------------------|-----------------------------------|---------------------------------------------|
| `new`            | Nowe zapytanie                    | utworzenie rezerwacji wymagającej decyzji   |
| `awaiting_contract` | Oczekuje na umowę i potwierdzenie | rezerwacja w wolnym terminie / akceptacja admina |
| `awaiting_deposit`  | Oczekuje na zadatek            | umowa podpisana przez obie strony (SMS OTP) |
| `confirmed`      | Rezerwacja potwierdzona           | admin oznacza „zadatek wpłacony" → e-mail   |
| `last_call`      | Last call personalizacji          | cron, X dni przed imprezą (domyślnie 7)     |
| `ready`          | Gotowe do realizacji              | cron, po blokadzie personalizacji (3 dni)   |
| `completed`      | Zrealizowane                      | admin (po imprezie)                         |
| `cancelled`      | Anulowane                         | admin / klient                              |

Każda zmiana trafia do `booking_status_history`.

## 5. Analiza dostępności terminu

Dla wybranej daty system zwraca zajęte okna. Jeśli istnieje rezerwacja, klient widzi:

> „W tym terminie mamy realizację od godziny X do godziny Y. Jeżeli planowana godzina rozpoczęcia jest inna, możesz złożyć zapytanie. Każdą taką rezerwację potwierdzamy ręcznie."

Algorytm wykonalności drugiej realizacji tego samego dnia:

```
koniec_A = start_A + czas_imprezy_A + 40 min (demontaż)
dojazd   = DistanceMatrix(lokalizacja_A → lokalizacja_B)
start_B_możliwy = koniec_A + dojazd + 60 min (montaż)
wykonalne ⇔ start_B_możliwy ≤ start_B   (analogicznie w drugą stronę)
```

Wynik jest **podpowiedzią** — rezerwacja kolidująca zawsze powstaje ze statusem `new`
(zapytanie) i wymaga ręcznego potwierdzenia administratora.

## 6. Wycena

```
cena = cena_pakietu(rok imprezy)
     + max(0, dystans_km − darmowe_km) × stawka_za_km        (ustawienie, domyślnie 1,60 zł)
     + księga gości (wg pakietu: 0 / 75 / 100 / 150 zł)
     − rabat (kod kwotowy lub procentowy)
zadatek = cena × procent_zadatku (ustawienie, domyślnie 30%)
```

## 7. Frontend — moduły

- **Onboarding rezerwacji (publiczny)** — 8 kroków: termin → pakiet → godzina → lokalizacja (Google Places) → dane klienta (osoba/firma + NIP) → księga gości → podsumowanie → umowa. Konto klienta tworzone automatycznie.
- **Panel klienta** — logowanie (e-mail/hasło, Google), lista rezerwacji, personalizacja (animacja, tło, szablon wydruku z filtrowaniem po hashtagach, tekst na wydruku) edytowalna do N dni przed imprezą, dane do przelewu, galeria.
- **CRM administratora** — dashboard, kalendarz FullCalendar (dzień/tydzień/miesiąc, drag&drop, sync Google Calendar), lista rezerwacji, karta rezerwacji z checklistą realizacji, katalogi (animacje/tła/szablony), kody rabatowe, szablony e-mail/SMS, **Ustawienia systemu** (12 sekcji + audyt zmian).

Motyw: jasny, inspirowany Stripe Dashboard — biel, bardzo jasny i pastelowy róż, delikatne szarości. Kolory, logo i favicon są edytowalne w CRM (rebranding bez zmian w kodzie).

## 8. Cron (oddzielne pliki, `cron/`)

| Plik                       | Częstotliwość   | Zadanie                                          |
|----------------------------|-----------------|--------------------------------------------------|
| `send_email_queue.php`     | co 5 min        | wysyłka e-maili z kolejki (Brevo, retry ×3)      |
| `send_sms_queue.php`       | co 5 min        | wysyłka SMS z kolejki (SMSAPI, retry ×3)         |
| `send_reminders.php`       | raz dziennie    | przypomnienie e-mail+SMS X dni przed imprezą     |
| `lock_personalization.php` | raz dziennie    | blokada personalizacji N dni przed imprezą       |
| `sync_google_calendar.php` | co 15 min       | dosynchronizowanie zaległych zmian do kalendarza |
| `cleanup.php`              | raz dziennie    | porządki: stare wpisy kolejek, logi              |

## 9. Bezpieczeństwo

- JWT (HS256) — access token 24 h; hasła `password_hash()` (bcrypt).
- Wszystkie zapytania SQL przez PDO prepared statements.
- Role: `client` / `admin`; middleware na trasach `/api/admin/*`.
- Klucze API typu `secret` w ustawieniach — maskowane w odpowiedziach API.
- Webhooki (PayNow) weryfikowane sygnaturą; podpis umów: kody OTP tylko jako hash, PDF poza public/.
- CORS ograniczony do domeny frontendu (ustawienie `app.frontend_url`).
