# Konfiguracja Google Login (logowanie klientów)

Klienci mogą logować się e-mailem/hasłem lub kontem Google (Google Identity Services).
Konto nieistniejące jest tworzone automatycznie przy pierwszym logowaniu Google.

## 1. Ekran zgody OAuth

1. https://console.cloud.google.com → ten sam projekt co Maps.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**,
   - App name: `MMEvent`, support e-mail, logo (opcjonalnie),
   - Scopes: wystarczą domyślne (`openid`, `email`, `profile`),
   - Status: **In production** (publish app), aby logować mogli się wszyscy.

## 2. Client ID

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**, nazwa np. `mmevent-frontend`.
3. **Authorized JavaScript origins**:
   - `https://rezerwacje.twojadomena.pl`
   - `http://localhost:5173` (development)
4. Zapisz — otrzymasz **Client ID** (`xxxx.apps.googleusercontent.com`) i Client Secret.

## 3. Konfiguracja w systemie

1. **Frontend:** w `frontend/.env` ustaw `VITE_GOOGLE_CLIENT_ID=<Client ID>` i przebuduj (`npm run build`).
2. **CRM → Ustawienia → Aplikacja:**
   - `Google OAuth Client ID (logowanie)` = ten sam Client ID — backend weryfikuje, że token
     został wydany dla Twojej aplikacji (pole `aud`),
   - Client Secret — zapisz (rezerwowo; flow ID-token go nie wymaga).

## 4. Test

Na stronie logowania pojawi się przycisk „Zaloguj się przez Google". Po zalogowaniu nowym kontem
w CRM → Klienci zobaczysz nowego użytkownika. Jeśli przycisk się nie pokazuje — brak
`VITE_GOOGLE_CLIENT_ID` w buildzie; jeśli „Weryfikacja Google nie powiodła się" — Client ID
w CRM różni się od tego we frontendzie.
