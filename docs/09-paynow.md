# Konfiguracja PayNow (płatności online)

PayNow (mBank) jest **przygotowany technicznie i domyślnie wyłączony**. Dopóki nie włączysz
go w CRM, klienci widzą wyłącznie przelew tradycyjny z numerem konta i tytułem przelewu.

## 1. Umowa i klucze

1. Podpisz umowę na PayNow (https://www.paynow.pl — wymaga firmowego rachunku w mBanku
   lub umowy z operatorem).
2. W panelu PayNow (https://panel.paynow.pl): **Ustawienia → Sklepy i punkty płatności** →
   skopiuj **API Key** i **Signature Key**. Środowisko testowe ma osobne klucze
   (https://panel.sandbox.paynow.pl).

## 2. Powiadomienia (webhook)

W panelu PayNow ustaw adres powiadomień:

```
https://api.twojadomena.pl/api/webhooks/paynow
```

System weryfikuje nagłówek `Signature` (HMAC-SHA256, Signature Key). Po statusie `CONFIRMED`
płatność jest oznaczana jako opłacona, a rezerwacja przechodzi w **„Rezerwacja potwierdzona"**
(z automatycznym e-mailem i SMS-em do klienta).

## 3. Wpisanie w CRM

CRM → **Ustawienia systemu → PayNow**:

| Pole | Wartość |
|---|---|
| API Key | z panelu PayNow |
| Signature Key | z panelu PayNow |
| Tryb sandbox | ✔ podczas testów, ✘ na produkcji |
| PayNow włączony | ✘ domyślnie — włącz dopiero po testach |

## 4. Test (sandbox)

1. Włącz PayNow + sandbox, użyj kluczy sandboxowych.
2. Utwórz rezerwację, doprowadź ją do statusu „Oczekuje na zadatek".
3. W panelu klienta pojawi się przycisk **„Zapłać online (PayNow)"** → przekierowanie do
   bramki testowej (płatność testowa BLIK/karta wg dokumentacji sandbox).
4. Po powrocie status rezerwacji powinien zmienić się na „Rezerwacja potwierdzona".

## 5. Produkcja

Podmień klucze na produkcyjne, wyłącz sandbox, wykonaj jedną realną płatność testową
na niską kwotę. Pamiętaj, że przelew tradycyjny pozostaje zawsze dostępny — PayNow
jest opcją dodatkową.
