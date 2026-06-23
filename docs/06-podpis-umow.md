# Podpisywanie umów (SMS OTP + Brevo)

Własny moduł podpisu elektronicznego — zastąpił integrację z Pergamin. Wykorzystuje istniejące
integracje: **SMSAPI** (kody OTP i powiadomienia), **Brevo** (e-maile z załącznikiem).
Generowanie PDF działa **lokalnie na serwerze** (Dompdf) lub z **szablonu Google Docs**
(Apps Script). Brak zewnętrznego dostawcy podpisu.

## Jak to działa

Podpis jest **dwuetapowy**: najpierw właściciel firmy, potem klient. Każda strona potwierdza
tożsamość jednorazowym kodem SMS (OTP). Przed startem procesu liczony jest **hash SHA-256**
dokumentu PDF, który nie zmienia się do końca podpisywania i trafia na stronę potwierdzenia.

### Generowanie umowy (CRM → karta rezerwacji → „Podpisywanie umowy")

- **Generuj umowę** — buduje PDF z danymi rezerwacji i pokazuje go w podglądzie (PDF.js).
  Operator musi przewinąć do końca, aby aktywował się przycisk „Zapoznałem się z treścią umowy",
  który rozpoczyna proces podpisywania (liczy hash). Źródło treści zależy od konfiguracji:
  - **Google Docs (Apps Script)** — jeśli ustawiony jest adres web-app (Ustawienia → Podpis umów):
    kopia szablonu Google Docs na Dysku właściciela z podstawionymi znacznikami → PDF.
    Konfiguracja: [docs/12-google-apps-script-umowy.md](12-google-apps-script-umowy.md).
    Bonus: link „Otwórz dokument w Google Docs" pozwala ręcznie poprawić umowę i wygenerować ją od nowa.
  - **Lokalnie (Dompdf)** — gdy web-app nie jest ustawiony: render z szablonu HTML
    (Ustawienia → Podpis umów → Szablon umowy), bez żadnej zależności od Google.
- **Wgraj umowę niestandardową** — wskaż gotowy PDF; uruchamia ten sam proces podpisywania.

### ETAP 1 — podpis właściciela (CRM)

„Wyślij do podpisu" → system generuje OTP, wysyła SMS na numer właściciela (Ustawienia →
Podpis umów) i zapisuje wyłącznie hash kodu. Po wpisaniu poprawnego kodu status → **OWNER_SIGNED**
(zapis: data, godzina, IP, user agent, telefon, identyfikator OTP).

### ETAP 2 — podpis klienta (panel klienta)

Po podpisie właściciela „Powiadom klienta" wysyła SMS i e-mail („Umowa oczekuje na Twój podpis").
Klient w panelu: przewija umowę do końca → „Zapoznałem się z treścią umowy" → „Wyślij kod SMS"
→ wpisuje OTP. Status → **CLIENT_SIGNED → FULLY_SIGNED**.

### Finalizacja

Po podpisie obu stron system:
1. generuje **końcowy PDF** = umowa + strona potwierdzenia (numer umowy, hash SHA-256, daty i
   godziny podpisów, IP obu stron, telefony, identyfikatory OTP, data wygenerowania),
2. zapisuje PDF na Google Drive (folder podpisanych umów — `drive.signed_contracts_folder_id`
   lub folder umów),
3. wysyła podpisany PDF e-mailem do klienta i do właściciela (Brevo, załącznik),
4. ustawia rezerwację na „Oczekuje na zadatek".

Wszystkie kroki widoczne są w **historii podpisu** (timeline) na karcie rezerwacji.

## Konfiguracja (CRM → Ustawienia)

**Podpis umów:**
| Pole | Opis |
|---|---|
| Imię i nazwisko właściciela | na e-mailu z podpisaną umową |
| Telefon właściciela do podpisu SMS | numer, na który idzie OTP etapu 1 (format +48…) |
| Miejscowość zawarcia umowy | używana w treści, jeśli szablon ma `{{miejscowosc}}` |

**Google Drive:**
| Pole | Opis |
|---|---|
| Domyślny folder na podpisane umowy | ID folderu Drive na końcowe PDF (opcjonalnie — w razie braku użyty zostanie folder umów) |

Wymagane też wcześniej skonfigurowane: szablon umowy Google Docs + foldery Drive (docs/05),
Brevo (docs/07), SMSAPI (docs/08).

## Bezpieczeństwo

- OTP: 6 cyfr, ważność 10 minut, maks. 5 prób, przechowywany wyłącznie **hash** kodu,
  po użyciu oznaczany jako zużyty; każdy nowy kod unieważnia poprzedni.
- Przy każdym podpisie zapisywane: IP, User Agent, data/godzina, telefon, identyfikator OTP,
  identyfikator i hash dokumentu.
- Pliki PDF umów leżą poza katalogiem publicznym (`backend/storage/contracts/`) i są dostępne
  wyłącznie przez autoryzowane endpointy (admin / właściciel rezerwacji).
- Hash SHA-256 liczony przed startem podpisu jest niezmienny — gwarantuje integralność treści.

## Tabele

`contracts` (rozszerzona: typ, signing_status, document_hash, ścieżki PDF, dane podpisów),
`contract_signatures` (dowód podpisu strony), `contract_sms_codes` (kody OTP — hash),
`contract_events` (timeline). Migracja: `database/migrations/009_contract_signing.sql`.

## Zależności techniczne

PDF generowane są biblioteką **Dompdf** (HTML→PDF, pełna obsługa polskich znaków, czcionka
DejaVu Sans) — w `backend/vendor/` (Composer). Strona potwierdzenia jest renderowana tym samym
silnikiem (poprawne PL). Składanie końcowego dokumentu:

- **umowa z szablonu HTML / Google Docs** — treść + strona potwierdzenia renderowane razem (Dompdf);
- **umowa wgrana jako zewnętrzny PDF** — stronę potwierdzenia (Dompdf) dokleja **FPDI**. Gdy wgrany
  PDF jest w wersji nieobsługiwanej przez FPDI (1.5+ z kompresją xref), strona potwierdzenia
  trafia jako osobny dokument, a oryginał dołączany jest do e-maila — proces podpisu pozostaje ważny.

Wymagane rozszerzenia PHP: `mbstring`, `dom` (Dompdf), `curl`, `openssl` — standardowo dostępne
na LH.pl (PHP 8.x). Google Drive jest **opcjonalnym archiwum** podpisanych PDF (pomijane, gdy
niepołączone).
