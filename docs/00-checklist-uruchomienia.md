# ✅ Checklist uruchomienia — bookings.mmevents.pl (krok po kroku)

Kompletna instrukcja: od wgrania plików, przez wszystkie klucze API, po testy końcowe.
Układ na serwerze: backend w `bookings.mmevents.pl/backend/`, frontend w katalogu głównym.

**Stan wyjściowy (zrobione):** baza zaimportowana ✓, `backend/.env` uzupełniony ✓,
pliki backendu na serwerze ✓ (wymagają dogrania poprawek — etap 1).

---

## ETAP 1 — Dogranie poprawionych plików backendu (FTP)

Wgraj z nadpisaniem (najprościej: cały katalog `backend/` poza `.env`):

```
backend/.htaccess                  (nowy — ochrona src/, bin/, storage/)
backend/src/                       (cały — zawiera autoload.php i poprawki)
backend/public/index.php
backend/public/.htaccess
backend/vendor/                    (cały — wygenerowany composerem)
```

Dodatkowo wgraj katalog **`cron/`** do `bookings.mmevents.pl/cron/` (obok `backend/`,
nie do środka!).

**Test:** otwórz `https://bookings.mmevents.pl/backend/public/api/health`
→ ma być JSON `{"company.name":"MMEvent",...}`, nie błąd PHP.

## ETAP 2 — Pierwsze logowanie i zmiana hasła

1. Lokalny frontend: `http://localhost:5173/logowanie`
2. Zaloguj się: `kontakt@mmevents.pl` / `Admin123!`
3. Wejdź w **Moje konto → Mój profil → Zmiana hasła** i ustaw własne silne hasło.

## ETAP 3 — Ustawienia podstawowe (CRM → Ustawienia systemu)

`http://localhost:5173/admin/ustawienia`

**Sekcja „Dane firmy":** nazwa (MMEvent), NIP, REGON, adres (Wiejska 4A, Szczecin),
telefon, e-mail, strona WWW, stopka mailowa (podpis w każdym e-mailu).

**Sekcja „Finanse":**
| Pole | Wartość |
|---|---|
| Numer konta bankowego | **ważne** — pokazywany klientom przy zadatku |
| Wysokość zadatku (%) | 30 |
| Stawka za kilometr | 1.60 |
| Waluta | PLN |

**Sekcja „Rezerwacje":** blokada personalizacji: 3 dni, przypomnienie: 7 dni,
przypomnienie SMS: ✔, e-mail: ✔, godzina cronów: 08:00.

**Sekcja „Aplikacja":** `Adres frontendu` = `https://bookings.mmevents.pl`
(z tego budowane są linki w e-mailach).

## ETAP 4 — Google Cloud (jeden projekt dla wszystkiego)

Wejdź na https://console.cloud.google.com → utwórz projekt `mmevent-booking`.
**Billing:** podepnij kartę (wymagane przez Google Maps; miesięczny kredyt $200 wystarcza).

### 4a. Google Maps (podpowiedzi adresów + dystans)

1. **APIs & Services → Library** → włącz: **Places API** oraz **Distance Matrix API**.
2. **Credentials → Create credentials → API key** → skopiuj klucz.
3. Edytuj klucz → *API restrictions* → ogranicz do Places API + Distance Matrix API.
   *Application restrictions* → IP addresses → dodaj IP serwera LH.pl.
4. **CRM → Ustawienia → Google Maps:** wklej ten sam klucz w 3 pola (Maps / Places /
   Distance Matrix), `Adres siedziby` = `Wiejska 4A, Szczecin, Polska`.

**Test:** onboarding, krok 4 — wpisz nazwę sali weselnej → podpowiedzi + dystans w km.

### 4b. Google Login (logowanie klientów)

1. **APIs & Services → OAuth consent screen:** External, nazwa `MMEvent`, e-mail
   kontaktowy → opublikuj (In production).
2. **Credentials → Create credentials → OAuth client ID:** typ *Web application*,
   **Authorized JavaScript origins:**
   - `https://bookings.mmevents.pl`
   - `http://localhost:5173`
3. Skopiuj **Client ID** (`xxx.apps.googleusercontent.com`) i wpisz go w **dwa miejsca**:
   - `frontend/.env` → `VITE_GOOGLE_CLIENT_ID=...` (potem `npm run build` przy wdrożeniu),
   - **CRM → Ustawienia → Aplikacja → Google OAuth Client ID**.

**Test:** strona logowania — przycisk „Zaloguj się przez Google".

### 4c. Service Account (wspólny dla Drive i Calendar)

1. **IAM & Admin → Service Accounts → Create:** nazwa `mmevent-backend` (rola zbędna).
2. Wejdź w konto → **Keys → Add key → JSON** → pobierze się plik (to sekret!).
3. **Library** → włącz: **Google Drive API**, **Google Docs API**, **Google Calendar API**.
4. Zanotuj e-mail konta: `mmevent-backend@....iam.gserviceaccount.com`.

### 4d. Google Drive (umowy, galerie, szablony)

1. Na firmowym Dysku utwórz foldery: `MMEvent/Umowy`, `MMEvent/Galerie`, `MMEvent/Szablony`.
2. Każdy folder → **Udostępnij** → e-mail konta serwisowego → uprawnienie **Edytujący**.
3. W `Szablony/` utwórz **Google Doc** z treścią umowy i znacznikami:
   `{{numer_umowy}} {{data_zawarcia}} {{imie}} {{nazwisko}} {{adres_klienta}} {{nip}}
   {{data_imprezy}} {{godzina_startu}} {{pakiet}} {{lokalizacja}} {{kwota}} {{zadatek}}
   {{ksiega_gosci}} {{numer_konta}}` (pełna lista: docs/05-google-drive.md).
4. ID folderu = końcówka adresu `drive.google.com/drive/folders/<ID>`;
   ID dokumentu = z adresu `docs.google.com/document/d/<ID>/edit`.
5. **CRM → Ustawienia → Google Drive:**
   - `Service Account (JSON)` → wklej **całą zawartość** pobranego pliku JSON,
   - ID folderu umów / galerii / szablonów,
   - ID pliku szablonu umowy.

**Test:** CRM → rezerwacja → „Wygeneruj umowę" → dokument pojawia się w `Umowy/`
z numerem `MME/RRRR/MM/20` i podstawionymi danymi.

### 4e. Google Calendar (synchronizacja rezerwacji)

1. https://calendar.google.com → utwórz kalendarz **„MMEvent — realizacje"**.
2. Ustawienia kalendarza → *Udostępnij wybranym osobom* → e-mail konta serwisowego →
   **„Wprowadzanie zmian w wydarzeniach"**.
3. Sekcja *Integracja kalendarza* → skopiuj **Identyfikator kalendarza**
   (`...@group.calendar.google.com`).
4. **CRM → Ustawienia → Google Calendar:** Calendar ID + `Synchronizacja włączona` ✔
   (Client ID/Secret zostaw puste — pola pod przyszłą rozbudowę).

**Test:** przeciągnij rezerwację w kalendarzu CRM → wydarzenie aktualizuje się w Google.

## ETAP 5 — Brevo (e-maile)

1. Konto: https://www.brevo.com (darmowo 300 maili/dzień).
2. Profil → **SMTP & API → API Keys → Generate** (v3) → klucz `xkeysib-…`.
3. **Senders, Domains → Domains → Add domain** `mmevents.pl` → dodaj rekordy DNS
   (DKIM/SPF) u rejestratora domeny → zweryfikuj.
4. **Senders → Add sender:** np. `rezerwacje@mmevents.pl`.
5. **CRM → Ustawienia → Brevo:** API Key, nadawca `rezerwacje@mmevents.pl`, nazwa `MMEvent`.

**Test (po etapie 7):** złóż testową rezerwację → w 5 min przyjdzie e-mail potwierdzenia.

## ETAP 6 — SMSAPI

1. Konto firmowe: https://www.smsapi.pl + doładowanie punktów.
2. **API → Tokeny API → Wygeneruj token** (OAuth2, zakres: wysyłka SMS).
3. **Ustawienia → Pola nadawcy → Dodaj** `MMEvent` → poczekaj na zatwierdzenie (~1 dzień).
4. **CRM → Ustawienia → SMSAPI:** token, nazwa nadawcy `MMEvent`, włączone ✔.

## ETAP 7 — Cron w panelu LH.pl

Panel LH.pl → **Cron** → dodaj 6 zadań typu URL (`CRON_SECRET` = wartość z `backend/.env`):

```
co 5 min:      https://bookings.mmevents.pl/cron/send_email_queue.php?secret=CRON_SECRET
co 5 min:      https://bookings.mmevents.pl/cron/send_sms_queue.php?secret=CRON_SECRET
codz. 08:00:   https://bookings.mmevents.pl/cron/send_reminders.php?secret=CRON_SECRET
codz. 08:05:   https://bookings.mmevents.pl/cron/lock_personalization.php?secret=CRON_SECRET
co 15 min:     https://bookings.mmevents.pl/cron/sync_google_calendar.php?secret=CRON_SECRET
codz. 03:30:   https://bookings.mmevents.pl/cron/cleanup.php?secret=CRON_SECRET
```

**Test:** otwórz pierwszy URL w przeglądarce → tekst `email_queue: do wysłania N`.

## ETAP 8 — Podpis umów (SMS OTP) — wbudowany

Bez zewnętrznego dostawcy. Wymaga działających: szablonu umowy Google Docs (ETAP 4d), Brevo
(ETAP 5), SMSAPI (ETAP 6) oraz biblioteki FPDF/FPDI w `backend/vendor/` (wgrywanej z FTP).

1. **CRM → Ustawienia → Podpis umów:** imię i nazwisko właściciela, **telefon właściciela**
   (na ten numer idzie kod SMS etapu 1, format `+48…`), miejscowość zawarcia umowy.
2. **CRM → Ustawienia → Google Drive:** opcjonalnie „Domyślny folder na podpisane umowy".
3. Upewnij się, że katalog `backend/storage/contracts/` ma prawa zapisu (755/775).

Przebieg: CRM generuje umowę → podgląd (przewiń do końca) → właściciel podpisuje kodem SMS →
„Powiadom klienta" → klient podpisuje w panelu kodem SMS → końcowy PDF ze stroną potwierdzenia
trafia na Drive i e-mailem do obu stron. Szczegóły: docs/06-podpis-umow.md.

## ETAP 9 — PayNow (płatności online — opcjonalnie, na później)

1. Umowa PayNow (mBank) → panel → API Key + Signature Key (sandbox i produkcja osobno).
2. Adres powiadomień: `https://bookings.mmevents.pl/backend/public/api/webhooks/paynow`.
3. **CRM → Ustawienia → PayNow:** klucze, sandbox ✔ na czas testów, **PayNow włączony**
   dopiero po udanych testach. Do tego czasu klienci widzą tylko przelew tradycyjny.

## ETAP 10 — Wgranie frontendu na serwer

Gdy wszystko działa lokalnie:

```bash
cd frontend
# sprawdź .env: VITE_API_URL=https://bookings.mmevents.pl/backend/public
#               VITE_GOOGLE_CLIENT_ID=<z etapu 4b>
npm run build
```

Wgraj **zawartość** `frontend/dist/` (razem z plikiem `.htaccess`, który build dołącza
automatycznie) do katalogu głównego `bookings.mmevents.pl/` (obok katalogu `backend/`).

**Test:** `https://bookings.mmevents.pl` → strona rezerwacji; `/admin` → CRM.

## ETAP 11 — Treści i katalog (CRM)

1. **Pakiety i cennik** — zweryfikuj ceny 2026; „Kopiuj 2026 → 2027" na kolejny sezon.
2. **Animacje** — nazwa + miniatura + link YouTube (realne materiały zamiast demo).
3. **Tła** — zdjęcia rzeczywistych tł (upload przyciskiem „Wgraj").
4. **Szablony wydruków** — zdjęcia + hashtagi (#wesele #urodziny #firmowe #studniówka).
5. **Treści e-mail/SMS** — przejrzyj i dostosuj wszystkie szablony.
6. **Ustawienia → Wygląd** — docelowe logo (zastąp placeholder), favicon, kolory.
7. Usuń wpisy demo z katalogów.

## Ściąga: wszystkie klucze i ich miejsca

| Klucz / wartość | Skąd | Gdzie wpisać |
|---|---|---|
| Dane MySQL | panel LH.pl | `backend/.env` (DB_*) ✓ |
| JWT_SECRET | `openssl rand -hex 32` | `backend/.env` ✓ |
| CRON_SECRET | `openssl rand -hex 16` | `backend/.env` + URL-e cronów |
| Google Maps API Key | Google Cloud → Credentials | CRM → Google Maps (3 pola) |
| OAuth Client ID | Google Cloud → OAuth client | `frontend/.env` **i** CRM → Aplikacja |
| Service Account JSON | Google Cloud → klucz JSON | CRM → Google Drive |
| ID folderów + szablonu umowy | adresy URL na Dysku | CRM → Google Drive |
| Calendar ID | ustawienia kalendarza Google | CRM → Google Calendar |
| Brevo API Key | Brevo → SMTP & API | CRM → Brevo |
| Token SMSAPI | SMSAPI → Tokeny API | CRM → SMSAPI |
| Telefon właściciela (podpis SMS) | — | CRM → Podpis umów |
| PayNow API + Signature Key | panel PayNow | CRM → PayNow |
| Numer konta bankowego | — | CRM → Finanse |
