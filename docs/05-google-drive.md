# Konfiguracja Google Drive (umowy + galerie + szablony)

Umowy są generowane z **szablonu Google Doc**: system kopiuje szablon do folderu umów,
podstawia dane klienta (`{{imie}}`, `{{numer_umowy}}`…) i zapisuje link. Galerie i szablony
wydruków też mieszkają na Drive.

## 1. Service Account (konto serwisowe)

1. https://console.cloud.google.com → projekt → **IAM & Admin → Service Accounts → Create**.
   - Nazwa: `mmevent-backend`. Rola: nie jest wymagana (dostęp nadasz przez udostępnienie folderów).
2. Otwórz utworzone konto → zakładka **Keys → Add key → Create new key → JSON**.
   Pobierze się plik JSON — **to jest sekret**, przechowuj go bezpiecznie.
3. **APIs & Services → Library** → włącz:
   - **Google Drive API**
   - **Google Docs API**
   - **Google Calendar API** (używana przez synchronizację kalendarza)

## 2. Struktura folderów na Drive

Na firmowym koncie Google Drive utwórz foldery:

```
MMEvent/
├── Umowy/        ← tu trafiają wygenerowane umowy
├── Galerie/      ← galerie zdjęć z imprez
└── Szablony/     ← szablon umowy (Google Doc) i inne wzory
```

Każdy z folderów **udostępnij** adresowi e-mail konta serwisowego
(`mmevent-backend@...iam.gserviceaccount.com`) z uprawnieniem **Edytujący**.

ID folderu odczytasz z adresu URL: `https://drive.google.com/drive/folders/<ID_FOLDERU>`.

## 3. Szablon umowy (Google Doc)

W folderze `Szablony/` utwórz dokument Google Doc z treścią umowy. Dane klienta wstawiaj
jako znaczniki — system podstawi je automatycznie:

```
{{numer_umowy}} {{data_zawarcia}}
{{imie}} {{nazwisko}} {{email}} {{telefon}} {{adres_klienta}}
{{nazwa_firmy}} {{nip}} {{osoba_reprezentujaca}}
{{data_imprezy}} {{godzina_startu}} {{czas_trwania}} {{pakiet}} {{lokalizacja}}
{{kwota}} {{zadatek}} {{ksiega_gosci}}
{{nazwa_firmy_wykonawcy}} {{adres_wykonawcy}} {{nip_wykonawcy}} {{numer_konta}}
```

ID dokumentu z URL: `https://docs.google.com/document/d/<ID_PLIKU>/edit`.

## 4. Wpisanie w CRM

CRM → **Ustawienia systemu → Google Drive**:

| Pole | Wartość |
|---|---|
| Service Account (JSON) | wklej **całą zawartość** pobranego pliku JSON |
| ID folderu umów | ID folderu `Umowy/` |
| ID folderu galerii | ID folderu `Galerie/` |
| ID folderu szablonów | ID folderu `Szablony/` |
| ID pliku szablonu umowy | ID dokumentu z kroku 3 |

## 5. Tokeny — jak to działa

Backend sam generuje krótkotrwałe tokeny dostępowe: podpisuje JWT (RS256) kluczem prywatnym
z JSON-a konta serwisowego i wymienia go na `access_token` (ważny 1 h, odświeżany automatycznie).
Nie trzeba niczego odnawiać ręcznie.

## 6. Numeracja umów

Format: **MME/RRRR/MM/NN** — numeracja per miesiąc, **zaczyna się od 20**
(MME/2026/06/20, MME/2026/06/21, …). Pilnuje jej baza (unikalny indeks rok+miesiąc+numer).

## 7. Test

CRM → karta rezerwacji → **„Wygeneruj umowę"**. W folderze `Umowy/` powinien pojawić się
dokument `Umowa MME-RRRR-MM-NN` z podstawionymi danymi, a w karcie — link do Drive.
