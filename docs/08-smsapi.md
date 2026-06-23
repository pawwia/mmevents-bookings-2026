# Konfiguracja SMSAPI

SMS-y (przypomnienia przed imprezą, potwierdzenie zadatku, informacja o umowie) wysyłane są
z kolejki (`sms_queue`) przez **SMSAPI.pl** — cron co 5 minut, 3 próby.

## 1. Konto i token

1. Załóż konto firmowe na https://www.smsapi.pl i doładuj punkty.
2. Panel SMSAPI → **API → Tokeny API → Wygeneruj token** (OAuth2).
   Zakres: wysyłka SMS. Skopiuj token.

## 2. Pole nadawcy (nazwa zamiast numeru)

1. Panel SMSAPI → **Ustawienia → Pola nadawcy → Dodaj pole nadawcy** → np. `MMEvent`.
2. Poczekaj na zatwierdzenie przez SMSAPI (zwykle 1 dzień roboczy).

## 3. Wpisanie w CRM

CRM → **Ustawienia systemu → SMSAPI**:

| Pole | Wartość |
|---|---|
| Token API | token OAuth2 z kroku 1 |
| Nazwa nadawcy SMS | `MMEvent` (zatwierdzone pole nadawcy) |
| Wysyłka SMS włączona | ✔ |

## 4. Ustawienia przypomnień

CRM → **Ustawienia systemu → Rezerwacje**:
- *Ile dni przed imprezą wysłać przypomnienie* (domyślnie 7),
- *Przypomnienie SMS* — włącz/wyłącz niezależnie od e-maila,
- *Godzina wykonywania cronów* (musi odpowiadać harmonogramowi w panelu LH.pl).

## 5. Treści SMS

CRM → **Treści e-mail / SMS → zakładka SMS** — edytowalne szablony ze zmiennymi.
Wskazówka: unikaj polskich znaków diakrytycznych w SMS — wiadomość bez nich mieści
160 znaków zamiast 70 (niższy koszt).
