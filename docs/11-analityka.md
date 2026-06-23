# Analityka i piksele — GTM, Google Analytics 4, Facebook Pixel

Wszystko konfigurujesz w **CRM → Ustawienia → Analityka / Piksele** — bez zmian w kodzie.
Puste pole = dane narzędzie nieaktywne. ID są publiczne (wstrzykiwane na froncie).

## Gdzie wkleić ID

| Pole w CRM | Skąd wziąć | Format |
|---|---|---|
| Google Tag Manager — ID kontenera | tagmanager.google.com → kontener | `GTM-XXXXXXX` |
| Google Analytics 4 — Measurement ID | GA4 → Administracja → Strumienie danych | `G-XXXXXXXXXX` |
| Facebook Pixel — ID piksela | Meta Events Manager → Źródła danych | ciąg cyfr |

Po zapisaniu skrypty ładują się **dopiero po wyrażeniu zgody** w banerze cookies (RODO).
Baner pojawia się tylko, gdy skonfigurowano choć jedno narzędzie i użytkownik nie podjął decyzji.
Bez zgody nic nie jest ładowane ani wysyłane.

## Jakie zdarzenia są wysyłane

Wysyłane do **wszystkich** aktywnych narzędzi (GTM `dataLayer`, GA4 `gtag`, FB `fbq`):

| Zdarzenie | Kiedy | Parametry |
|---|---|---|
| `page_view` | każda zmiana podstrony (SPA) | `page_path` |
| `CheckAvailability` | sprawdzenie terminu — **liczone raz na sesję** (nawet przy wielu sprawdzeniach) | `available` |
| `purchase` / FB `Purchase` | utworzenie rezerwacji (onboarding i akceptacja oferty) | `value`, `currency` (`PLN`), `transaction_id`/`id`, `source` |

### Wskazówki konfiguracji

- **GA4**: `purchase` to zdarzenie rekomendowane (z `value` + `currency`) — oznacz je jako **konwersję**.
  `CheckAvailability` znajdziesz w Raportach → Zdarzenia.
- **GTM**: w `dataLayer` dostajesz `event: 'purchase'`, `event: 'CheckAvailability'` itd. — twórz na nich tagi/triggery.
  Jeśli używasz GTM, GA4 i Pixel możesz podpiąć przez GTM zamiast wpisywać ich ID osobno.
- **Facebook Pixel**: `PageView` i `Purchase` to zdarzenia standardowe; `CheckAvailability` jest
  niestandardowe (custom) — w Meta Events Manager możesz zdefiniować na nich konwersje.

> Zgoda (RODO): narzędzia ładują się dopiero po akceptacji w banerze cookies. Treść zgód i lista
> partnerów (Google, Meta, TikTok, hosting, poczta) znajdują się w [Polityce prywatności](/polityka-prywatnosci).
