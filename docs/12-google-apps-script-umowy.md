# Generowanie umowy z szablonu Google Docs (Google Apps Script)

Umowa powstaje jako **kopia jednego dokumentu-szablonu Google Docs** z podstawionymi danymi.
Całą pracę po stronie Google wykonuje mały skrypt **Google Apps Script** opublikowany jako
adres internetowy (web-app). Skrypt działa **jako Twoje konto Google**, więc kopie umów lądują
na Twoim Dysku (Twój limit miejsca) — bez kont serwisowych i bez ograniczeń.

Backend wysyła tylko POST z danymi; skrypt kopiuje szablon, podstawia znaczniki, eksportuje PDF
i odsyła go z powrotem. PDF trafia do procesu podpisu (hash, podgląd, strona potwierdzenia).

---

## CZĘŚĆ A — przygotowanie po stronie Google (klik po kliku)

### 1. Dokument-szablon umowy
1. Wejdź na https://docs.google.com i utwórz dokument, np. **„Szablon umowy MMEvent"**.
2. Wpisz treść umowy. W miejscach do uzupełnienia wstaw **znaczniki w podwójnych klamrach**
   (lista poniżej), np.: `Umowa nr {{NR_UMOWY}} z dnia {{DATA_UMOWY}} ... {{IMIE_NAZWISKO}}`.
3. Skopiuj **ID szablonu** z adresu dokumentu:
   `https://docs.google.com/document/d/`**`TO_JEST_ID`**`/edit`.

### 2. Skrypt Apps Script
1. Wejdź na https://script.google.com → **Nowy projekt**.
2. Usuń przykładowy kod i wklej kod z **CZĘŚCI B** poniżej.
3. Na górze skryptu ustaw dwie wartości:
   - `TEMPLATE_ID` — ID szablonu z kroku 1.3,
   - `SECRET` — dowolne własne hasło (np. `mme-7Gx9-prod`), zapamiętaj je.
   - (opcjonalnie) `TARGET_FOLDER_ID` — ID folderu na Dysku, gdzie mają trafiać gotowe umowy
     (z adresu `https://drive.google.com/drive/folders/`**`ID_FOLDERU`**). Zostaw puste, by
     zapisywać w głównym „Mój Dysk".
4. Zapisz projekt (ikona dyskietki).

### 3. Publikacja jako web-app
1. Prawy górny róg → **Wdróż → Nowe wdrożenie**.
2. Ikona koła zębatego → typ **Aplikacja internetowa**.
3. Ustaw:
   - **Wykonaj jako:** *Ja* (Twoje konto),
   - **Kto ma dostęp:** *Wszyscy* (Anyone).
4. **Wdróż** → Google poprosi o autoryzację → **Zezwól** (zaakceptuj dostęp do Dysku/Dokumentów;
   przy ostrzeżeniu „aplikacja niezweryfikowana" kliknij **Zaawansowane → Przejdź do projektu**).
5. Skopiuj **adres aplikacji internetowej** kończący się na **`/exec`**.

### 4. Wpisanie w CRM
CRM → **Ustawienia → Podpis umów**:
| Pole | Wartość |
|---|---|
| Google Apps Script — adres web-app (.../exec) | adres z kroku 3.5 |
| Google Apps Script — wspólne hasło (secret) | to samo `SECRET` co w skrypcie |
| Google Docs — ID szablonu (informacyjnie) | ID z kroku 1.3 |

Gdy adres web-app jest wpisany — „Generuj umowę" tworzy kopię z Google Docs. Gdy puste —
umowa generuje się lokalnie z szablonu HTML (awaryjnie, bez Google).

> Po każdej zmianie **kodu** skryptu zrób **Wdróż → Zarządzaj wdrożeniami → edytuj → Nowa wersja**,
> aby zmiany weszły pod tym samym adresem `/exec`.

---

## CZĘŚĆ B — kod Google Apps Script (wklej w całości)

```javascript
// === USTAWIENIA ===
const TEMPLATE_ID = 'WKLEJ_ID_SZABLONU';   // ID dokumentu-szablonu Google Docs
const SECRET = 'WKLEJ_WLASNE_HASLO';       // to samo hasło wpiszesz w CRM
const TARGET_FOLDER_ID = '';               // opcjonalnie: ID folderu na gotowe umowy

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (!data.secret || data.secret !== SECRET) {
      return json({ error: 'Nieprawidłowe hasło (secret).' });
    }

    const name = data.name || 'Umowa';
    const replacements = data.replacements || {};

    // 1. Kopia szablonu (oryginał nietknięty)
    const templateFile = DriveApp.getFileById(TEMPLATE_ID);
    const copy = TARGET_FOLDER_ID
      ? templateFile.makeCopy(name, DriveApp.getFolderById(TARGET_FOLDER_ID))
      : templateFile.makeCopy(name);

    // 2. Podstawienie znaczników {{KLUCZ}} → wartość (wszystkie wystąpienia,
    //    także w nagłówku i stopce dokumentu)
    const doc = DocumentApp.openById(copy.getId());
    const sections = [doc.getBody(), doc.getHeader(), doc.getFooter()];
    sections.forEach(function (section) {
      if (!section) return;
      Object.keys(replacements).forEach(function (key) {
        section.replaceText('\\{\\{' + key + '\\}\\}', String(replacements[key]));
      });
    });
    doc.saveAndClose();

    // 3. Eksport do PDF (base64) — backend zapisuje go jako umowę
    const pdfBlob = DriveApp.getFileById(copy.getId()).getAs('application/pdf');
    const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    return json({
      url: 'https://docs.google.com/document/d/' + copy.getId() + '/edit',
      doc_id: copy.getId(),
      name: name,
      pdf_base64: pdfBase64
    });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## CZĘŚĆ C — lista znaczników do wstawienia w szablonie

W szablonie Google Docs używaj DOKŁADNIE tych nazw w podwójnych klamrach (wielkość liter ma
znaczenie). Backend podstawia je z danych rezerwacji; brakujące dane wstawia jako `—`.

| Znacznik w szablonie | Co podstawia |
|---|---|
| `{{NR_UMOWY}}` | numer umowy (MME/RRRR/MM/NN) |
| `{{DATA_UMOWY}}` | data zawarcia (dd.mm.rrrr) |
| `{{MIEJSCOWOSC}}` | miejscowość zawarcia umowy |
| `{{IMIE_NAZWISKO}}` | imię i nazwisko klienta |
| `{{ADRES_KLIENTA}}` | adres klienta (lub adres firmy) |
| `{{TELEFON}}` | telefon klienta |
| `{{EMAIL}}` | e-mail klienta |
| `{{NIP}}` | NIP (dla firmy) |
| `{{NAZWA_FIRMY}}` | nazwa firmy (dla firmy) |
| `{{OSOBA_REPREZENTUJACA}}` | osoba reprezentująca firmę |
| `{{DATA_IMPREZY}}` | data imprezy |
| `{{GODZINA_STARTU}}` | godzina rozpoczęcia |
| `{{CZAS_TRWANIA}}` | czas trwania (np. „3 h") |
| `{{PAKIET}}` | nazwa pakietu |
| `{{LOKALIZACJA}}` | miejsce imprezy |
| `{{KSIEGA_GOSCI}}` | rodzaj księgi gości |
| `{{CENA_BRUTTO}}` | cena całkowita (np. „1 299,00 zł") |
| `{{ZADATEK}}` | kwota zadatku |
| `{{NUMER_KONTA}}` | numer konta do wpłaty |
| `{{WYKONAWCA_NAZWA}}` | nazwa Twojej firmy |
| `{{WYKONAWCA_ADRES}}` | adres Twojej firmy |
| `{{WYKONAWCA_NIP}}` | NIP Twojej firmy |

---

## Jak to działa w całości

1. CRM → karta rezerwacji → **„Generuj umowę"**.
2. Backend buduje słownik `replacements` (powyższe znaczniki → dane), numer umowy i nazwę pliku,
   wysyła POST na adres `/exec` z `secret`.
3. Apps Script kopiuje szablon na Twój Dysk, podstawia znaczniki, eksportuje PDF i odsyła go
   (oraz link do dokumentu Google Docs — możesz go otworzyć i ręcznie poprawić, a potem
   „Wygeneruj umowę od nowa").
4. Backend zapisuje PDF, liczy hash i prowadzi proces podpisu (SMS OTP właściciela i klienta),
   a na końcu dokłada stronę potwierdzenia i wysyła podpisaną umowę e-mailem.

## Najczęstsze problemy

- **„nie-JSON (HTTP 403) … Odmowa dostępu"** → wdrożenie nie jest w pełni publiczne. W
  **Zarządzaj wdrożeniami → Edytuj** ustaw oba pola: **Wykonaj jako: Ja** oraz
  **Kto ma dostęp: Wszyscy** (NIE „Wszyscy z kontem Google"), zapisz **Nową wersję** i użyj
  świeżego adresu `/exec`. Szybki test: otwórz `/exec` w incognito — nie może prosić o logowanie.
- **„Apps Script zwrócił nieoczekiwaną odpowiedź"** → zły adres web-app albo wdrożenie nie jest
  publiczne. Sprawdź, że adres kończy się na `/exec` i dostęp to „Wszyscy".
- **„Nieprawidłowe hasło (secret)"** → `SECRET` w skrypcie różni się od pola w CRM.
- **Po zmianie kodu skryptu nic się nie zmienia** → trzeba opublikować **nową wersję** wdrożenia.
- **Brak danych w umowie** → nazwa znacznika w szablonie różni się od tej z listy (np. literówka,
  małe litery).
