# Dokumentacja API — MMEvent

Base URL: `https://api.twojadomena.pl/api` (development: `http://localhost:8000/api`)

- Format: JSON (`Content-Type: application/json`), kodowanie UTF-8.
- Autoryzacja: nagłówek `Authorization: Bearer <JWT>` (token z endpointów logowania, ważny 24 h).
- Błędy: `{ "error": "komunikat", "details": { "pole": ["błąd"] } }` ze stosownym kodem HTTP
  (401 brak autoryzacji, 403 brak uprawnień, 404 nie znaleziono, 409 konflikt, 422 walidacja, 423 zablokowane, 500 błąd serwera).

## Publiczne

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/settings/public` | Publiczne ustawienia (kolory, logo, nazwa firmy, `paynow.enabled`) |
| GET | `/packages?date=RRRR-MM-DD` | Aktywne pakiety z cennikiem dla roku imprezy (cena, darmowe km, opis, `features.included/excluded`, ceny ksiąg) |
| GET | `/booking-years` | Lata, na które można rezerwować (mają cennik w CRM): `{years:[2026,...], max_date}` |
| GET | `/availability?date=RRRR-MM-DD` | Dostępność dnia: `{available, year_bookable, blackout, windows:[{from,to}], message}`. `blackout:true` + `message` = urlop/blokada (komentarz właściciela) |
| POST | `/availability/feasibility` | Analiza logistyki drugiej realizacji. Body: `{date, start_time, duration_hours, venue_address?}` → `{feasible, conflicts, details[]}` |
| GET | `/places/autocomplete?q=&session=` | Podpowiedzi Google Places (min. 3 znaki) |
| GET | `/places/details?place_id=` | Szczegóły miejsca + `distance_km`, `duration_min` od siedziby |
| POST | `/quote` | Wycena: `{package_id, event_date, distance_km, guestbook, discount_code?}` → rozbicie ceny + zadatek |
| GET | `/nip?nip=` | Dane firmy z Wykazu Podatników VAT (nazwa, adres, REGON, reprezentanci) |
| GET | `/catalog/animations` · `/catalog/backgrounds` · `/catalog/print-templates` · `/catalog/hashtags` | Katalogi personalizacji |

## Uwierzytelnianie

| Metoda | Endpoint | Opis |
|---|---|---|
| POST | `/auth/register` | `{email, password, first_name, last_name, phone?}` → `{token, user}` (201) |
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/auth/google` | `{credential}` (ID token z Google Identity Services) → `{token, user}`; konto tworzone automatycznie |
| GET | `/auth/me` 🔒 | Profil zalogowanego: `{user, profile}` |
| PUT | `/auth/profile` 🔒 | Aktualizacja danych użytkownika i profilu (adres / dane firmy / notatki) |
| PUT | `/auth/password` 🔒 | `{current_password?, password}` |

## Klient 🔒

| Metoda | Endpoint | Opis |
|---|---|---|
| POST | `/bookings` | Finalizacja onboardingu (krok 8). Body: termin, godzina, pakiet, lokalizacja (place_id, dystans), księga, kod rabatowy, dane klienta. Zwraca `{booking_id, status, requires_manual_confirmation, contract?, total_price, deposit_amount}` (201). W zajętym dniu rezerwacja powstaje jako **zapytanie** (`status=new`). |
| GET | `/bookings` | Lista rezerwacji klienta (`personalization_editable` per wiersz) |
| GET | `/bookings/{id}` | Szczegóły + personalizacja + umowa + dane do przelewu |
| PUT | `/bookings/{id}/personalization` | `{animation_id?, background_id?, print_template_id?, print_text?}`; 423 po blokadzie (N dni przed imprezą), chyba że admin odblokował |
| GET/POST | `/bookings/{id}/chat` | Wątki czatu rezerwacji / nowy temat (multipart: `subject, body, file?`) |
| GET/POST | `/chat/threads/{id}` · `/chat/threads/{id}/messages` | Wiadomości wątku (otwarcie = oznacz przeczytane) / odpowiedź (multipart: `body, file?`) |
| GET | `/chat/messages/{id}/attachment` | Pobranie załącznika (autoryzowane; znika po imprezie) |
| POST | `/auth/verify` · `/auth/resend-verification` | Aktywacja konta tokenem / ponowna wysyłka linku (resend wymaga logowania) |
| POST | `/bookings/{id}/paynow` | Inicjacja płatności zadatku PayNow → `{redirect_url}`; 409 gdy PayNow wyłączony |

## Webhooki

| Metoda | Endpoint | Opis |
|---|---|---|
| POST | `/webhooks/paynow` | Status płatności; `CONFIRMED` → zadatek `paid`, rezerwacja → `confirmed`. Sygnatura: `Signature`. |

## Podpisywanie umów (SMS OTP)

Klient 🔒 (właściciel rezerwacji), ETAP 2:

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/bookings/{id}/contract` | Stan umowy do podpisu + dowody + timeline |
| GET | `/bookings/{id}/contract/preview` | PDF umowy (strumień, do PDF.js) |
| POST | `/bookings/{id}/contract/confirm-read` | Potwierdzenie zapoznania (po przewinięciu) |
| POST | `/bookings/{id}/contract/send-code` | Wyślij OTP SMS do klienta |
| POST | `/bookings/{id}/contract/verify-code` | `{code}` → CLIENT_SIGNED → FULLY_SIGNED + finalizacja |

CRM 🔒👑, ETAP 1 (właściciel) + generowanie:

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/admin/bookings/{id}/contract` | Stan aktywnej umowy + dowody + timeline |
| POST | `/admin/bookings/{id}/contract/standard` | Generuj standardową umowę (Google Docs → PDF) |
| POST | `/admin/bookings/{id}/contract/editable` | Generuj edytowalną umowę (link do Google Docs) |
| POST | `/admin/bookings/{id}/contract/refresh-editable` | Odśwież PDF po ręcznej edycji |
| POST | `/admin/bookings/{id}/contract/upload` | Wgraj niestandardowy PDF (multipart `file`) |
| GET | `/admin/contracts/{id}/preview` | PDF umowy (strumień) |
| GET | `/admin/contracts/{id}/signed-pdf` | Podpisany PDF (strumień) |
| POST | `/admin/contracts/{id}/start-signing` | Hash SHA-256 + status `pending_owner` |
| POST | `/admin/contracts/{id}/owner/send-code` | Wyślij OTP SMS do właściciela |
| POST | `/admin/contracts/{id}/owner/verify-code` | `{code}` → OWNER_SIGNED |
| POST | `/admin/contracts/{id}/notify-client` | SMS + e-mail do klienta o oczekującym podpisie |

## CRM (admin) 🔒👑 — prefiks `/admin`

| Metoda | Endpoint | Opis |
|---|---|---|
| GET | `/admin/dashboard` | Statystyki, najbliższe realizacje, „wymaga uwagi", stan kolejek |
| GET | `/admin/clients?q=` | Lista klientów z liczbą rezerwacji |
| GET | `/admin/bookings?status=&from=&to=&q=&sort=asc\|desc` | Lista/kalendarz rezerwacji (`sort` po dacie) |
| GET | `/admin/bookings/statuses` | Słownik statusów (kod + etykieta PL) |
| GET | `/admin/bookings/{id}` | Pełna karta: klient, wycena, **checklista realizacji**, historia statusów, płatności, umowy |
| PATCH | `/admin/bookings/{id}` | Edycja (drag&drop: `{event_date, start_time}`), notatki, link galerii; auto-sync Google Calendar |
| DELETE | `/admin/bookings/{id}` | Usunięcie rezerwacji (kaskadowo) + e-mail do klienta o usunięciu |
| POST | `/admin/bookings/{id}/status` | `{status, note?}` — zmiana statusu z efektami (e-maile/SMS) |
| POST | `/admin/bookings/{id}/deposit-paid` | „Zadatek wpłacony" → płatność `paid`, status `confirmed`, automatyczny e-mail+SMS |
| POST | `/admin/bookings/{id}/gallery` | `{gallery_link, ask_review, review_link?}` — e-mail z galerią ± prośba o opinię |
| POST | `/admin/bookings/{id}/personalization-unlock` | `{unlocked: bool}` — ręczne odblokowanie personalizacji mimo blokady terminowej |
| GET/POST | `/admin/blackouts` | Urlopy/blokady: lista / dodanie `{start_date, end_date?, comment?}` (brak `end_date` = jeden dzień) |
| DELETE | `/admin/blackouts/{id}` | Usunięcie blokady |
| POST | `/admin/bookings/{id}/payment` | `{amount, type: deposit\|final\|other}` — dodatkowa wpłata (np. dopłata reszty) |
| DELETE | `/admin/bookings/{id}/payment/{paymentId}` | Usunięcie/odznaczenie wpłaty |
| GET | `/admin/chat?booking_id=` | Wątki czatu (wszystkie lub danej rezerwacji) + liczba nieprzeczytanych |
| POST | `/admin/bookings/{id}/chat` | Nowy temat od admina (multipart: `subject, body, file?`) |
| GET/POST | `/admin/chat/threads/{id}` · `/admin/chat/threads/{id}/messages` | Wiadomości / odpowiedź (multipart) |
| GET | `/admin/chat/messages/{id}/attachment` | Pobranie załącznika |
| GET/POST/PUT/DELETE | `/admin/catalog/{type}[/{id}]` | CRUD katalogów; `{type}`: `animations`, `backgrounds`, `print-templates` (z polem `hashtags: []`) |
| GET/POST/PUT/DELETE | `/admin/packages[/{id}]` | CRUD pakietów (pakiet z rezerwacjami jest dezaktywowany, nie usuwany) |
| POST | `/admin/packages/{id}/prices` | Upsert cennika roku: `{year, price, free_km, description, features, guestbook_*_price, is_active}`. Rok tylko z zakresu bieżący…+2 |
| DELETE | `/admin/packages/{id}/prices/{priceId}` | Usunięcie/dezaktywacja cennika roku |
| POST | `/admin/packages/copy-year` | `{from_year, to_year}` — kopiowanie całego cennika na nowy rok |
| GET/POST/PUT/DELETE | `/admin/discounts[/{id}]` | CRUD kodów rabatowych (kwotowe/procentowe, ważność, limit) |
| GET/PUT | `/admin/email-templates[/{id}]` | Treści e-mail (temat, HTML, zmienne `{{...}}`) |
| GET/PUT | `/admin/sms-templates[/{id}]` | Treści SMS |
| GET | `/admin/settings` | Ustawienia pogrupowane (sekrety maskowane: `••••••xxxx`) |
| PUT | `/admin/settings` | `{values: {"klucz": "wartość", ...}}` — batch zapis z audytem; maska sekretu = brak zmiany |
| GET | `/admin/settings/audit?key=&limit=` | Audyt: kto, kiedy, stara/nowa wartość |
| POST | `/admin/upload` | Multipart `file` (JPG/PNG/WEBP/GIF ≤ 8 MB) → `{url}` (201). Opcjonalnie `cut_strip=1` (przytnij do lewej połowy — pasek fotobudkowy), `to_webp=1` (zapis jako WebP) |

## Zmienne szablonów wiadomości

`{{imie}} {{nazwisko}} {{data_imprezy}} {{godzina_startu}} {{pakiet}} {{lokalizacja}} {{kwota}} {{zadatek}} {{numer_konta}} {{numer_umowy}} {{link_umowy}} {{link_panelu}} {{link_galerii}} {{dni_blokady}} {{data_blokady}} {{prosba_o_opinie}} {{stopka}}`
