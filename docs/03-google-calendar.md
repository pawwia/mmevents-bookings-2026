# Konfiguracja Google Calendar

Rezerwacje są automatycznie synchronizowane z kalendarzem firmowym: utworzenie/zmiana terminu
(także drag&drop w CRM) aktualizuje wydarzenie, anulowanie — usuwa je.

System używa **konta serwisowego (Service Account)** — tego samego co Google Drive
(docs/05-google-drive.md). Skonfiguruj najpierw Service Account, potem wróć tutaj.

## 1. Udostępnij kalendarz kontu serwisowemu

1. Otwórz https://calendar.google.com na firmowym koncie Google.
2. Utwórz dedykowany kalendarz, np. **„MMEvent — realizacje"** (Ustawienia → Dodaj kalendarz).
3. Ustawienia kalendarza → **Udostępnij wybranym osobom** → dodaj adres e-mail konta
   serwisowego (`...@...iam.gserviceaccount.com`) z uprawnieniem
   **„Wprowadzanie zmian w wydarzeniach"**.
4. W sekcji **Integracja kalendarza** skopiuj **Identyfikator kalendarza**
   (np. `abc123...@group.calendar.google.com`).

## 2. Włącz API

W projekcie Google Cloud (ten sam co Maps/Drive): **APIs & Services → Library → Google Calendar API → Enable**.

## 3. Wpisz dane w CRM

CRM → **Ustawienia systemu → Google Calendar**:

| Pole | Wartość |
|---|---|
| Calendar ID | identyfikator z kroku 1.4 |
| Client ID / Client Secret | pola rezerwowe pod przyszłe podłączanie wielu kalendarzy przez OAuth — przy Service Account zostaw puste |
| Synchronizacja włączona | ✔ |

Architektura przewiduje podłączenie wielu kalendarzy w przyszłości (np. osobny kalendarz
per atrakcja) — wystarczy rozszerzyć ustawienia o kolejne Calendar ID.

## 4. Test

Utwórz testową rezerwację lub przesuń istniejącą w CRM (kalendarz, drag&drop).
Wydarzenie powinno pojawić się/zaktualizować w Google Calendar w ciągu kilku sekund;
zaległe wpisy dosynchronizowuje cron `sync_google_calendar.php` (co 15 min).
