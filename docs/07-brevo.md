# Konfiguracja Brevo (e-mail)

Wszystkie e-maile (potwierdzenia, umowy, zadatki, przypomnienia, galerie) trafiają do kolejki
w bazie (`email_queue`) i są wysyłane cronem przez **Brevo** (dawniej Sendinblue) —
z automatycznym ponawianiem (3 próby) i logiem błędów.

## 1. Konto i klucz API

1. Załóż konto na https://www.brevo.com (darmowy plan: 300 e-maili/dzień).
2. Panel → ikona profilu → **SMTP & API → API Keys → Generate a new API key**
   (typ: API v3). Skopiuj klucz (`xkeysib-…`).

## 2. Uwierzytelnienie domeny nadawcy

Aby maile nie wpadały do spamu:

1. **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `twojadomena.pl`.
2. Dodaj u rejestratora domeny rekordy DNS, które pokaże Brevo (**DKIM**, **SPF**, opcjonalnie DMARC).
3. Po weryfikacji dodaj nadawcę: **Senders → Add a sender** → np. `rezerwacje@twojadomena.pl`.

## 3. Wpisanie w CRM

CRM → **Ustawienia systemu → Brevo**:

| Pole | Wartość |
|---|---|
| Brevo API Key | klucz `xkeysib-…` |
| Nadawca e-mail | `rezerwacje@twojadomena.pl` (zweryfikowany w Brevo) |
| Nazwa nadawcy | `MMEvent` |

## 4. Treści wiadomości

CRM → **Treści e-mail / SMS** — wszystkie szablony są edytowalne (temat + HTML), z obsługą
zmiennych `{{imie}}`, `{{data_imprezy}}`, `{{kwota}}`, `{{link_galerii}}` itd.
Stopkę mailową ustawisz w **Ustawienia → Dane firmy** (`{{stopka}}`).

## 5. Cron i monitoring

- Wysyłką zajmuje się `cron/send_email_queue.php` (co 5 min) — patrz docs/01.
- Dashboard CRM pokazuje liczbę oczekujących i nieudanych wysyłek.
- Szczegóły błędów: kolumna `last_error` w tabeli `email_queue` oraz log `storage/logs/cron.log`.
