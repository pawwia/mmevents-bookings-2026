# Konfiguracja Google Maps (Places + Distance Matrix)

System używa Google Maps do:
- podpowiedzi lokalizacji podczas rezerwacji (Places Autocomplete + Details),
- obliczania odległości i czasu dojazdu od siedziby (Wiejska 4A, Szczecin) — Distance Matrix.

## 1. Projekt w Google Cloud

1. Wejdź na https://console.cloud.google.com → **Create project** (np. `mmevent-booking`).
2. Menu → **APIs & Services → Library** i włącz:
   - **Places API**
   - **Distance Matrix API**
   - (opcjonalnie) **Maps JavaScript API** — jeśli kiedyś dodasz mapę na stronie.
3. **APIs & Services → Credentials → Create credentials → API key.**

## 2. Zabezpieczenie klucza

Klucz jest używany **wyłącznie po stronie backendu** (serwer → Google), więc:

1. Edytuj klucz → **Application restrictions → IP addresses** i dodaj adres IP serwera LH.pl
   (znajdziesz go w panelu LH.pl lub przez `ping api.twojadomena.pl`).
2. **API restrictions → Restrict key** → zaznacz tylko Places API i Distance Matrix API.

## 3. Rozliczenia

Google wymaga podpięcia karty (Billing). Miesięczny darmowy kredyt ($200) zwykle w zupełności
wystarcza przy skali kilkudziesięciu rezerwacji/mies. Ustaw **Budgets & alerts** np. na $10.

## 4. Wpisanie kluczy w CRM

CRM → **Ustawienia systemu → Google Maps**:

| Pole | Wartość |
|---|---|
| Google Maps API Key | klucz z kroku 1 |
| Places API Key | ten sam klucz (lub osobny, jeśli chcesz rozdzielić limity) |
| Distance Matrix API Key | jw. |
| Adres siedziby | `Wiejska 4A, Szczecin, Polska` (punkt startowy obliczeń) |

## 5. Test

W onboardingu rezerwacji (krok 4) wpisz min. 3 znaki nazwy obiektu — powinny pojawić się
podpowiedzi, a po wyborze: odległość w km i czas dojazdu. Jeśli widzisz błąd
„Brak klucza Places API" — klucz nie został zapisany; jeśli `REQUEST_DENIED` — sprawdź
restrykcje klucza i status rozliczeń.
