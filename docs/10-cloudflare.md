# Cloudflare — zabezpieczenie strony (CDN, WAF, CAPTCHA Turnstile)

Cloudflare stoi „przed" Twoim serwerem LH.pl: przyspiesza stronę (CDN), ukrywa IP serwera,
filtruje boty i ataki (WAF, ochrona DDoS) oraz dostarcza **Turnstile** — CAPTCHA używaną w aplikacji
przy **logowaniu** i **sprawdzaniu terminu**.

> Aplikacja ma też własne, niezależne limity (poniżej) — Turnstile to dodatkowa warstwa.

---

## 1. Dodanie domeny do Cloudflare

1. Załóż darmowe konto na <https://dash.cloudflare.com>.
2. **Add a site** → wpisz `mmevents.pl` → wybierz plan **Free**.
3. Cloudflare zeskanuje obecne rekordy DNS i wyświetli **dwa nameservery**, np.:
   ```
   dana.ns.cloudflare.com
   greg.ns.cloudflare.com
   ```

## 2. Zmiana nameserverów u rejestratora domeny

W panelu, gdzie **kupiłeś domenę** (np. home.pl, OVH, nazwa.pl), zmień nameservery (NS)
na te dwa podane przez Cloudflare. Propagacja trwa od kilku minut do ~24 h.
Gdy status w Cloudflare zmieni się na **Active**, domena działa przez Cloudflare.

## 3. Rekordy DNS (DNS → Records)

Przepisz rekordy z LH.pl. Kluczowa zasada **pomarańczowej/szarej chmurki**:

| Typ   | Nazwa      | Wartość (przykład)            | Proxy            | Uwagi                          |
|-------|------------|-------------------------------|------------------|--------------------------------|
| A     | `@`        | IP serwera LH.pl              | 🟠 Proxied       | strona główna                  |
| CNAME | `www`      | `mmevents.pl`                 | 🟠 Proxied       | przekierowanie www             |
| CNAME | `bookings` | adres serwera aplikacji       | 🟠 Proxied       | panel/onboarding (API + front) |
| MX    | `@`        | serwer pocztowy LH.pl         | ⚪ **DNS only**  | **poczta — nigdy proxied!**    |
| TXT   | `@`        | `v=spf1 ...` (SPF)            | ⚪ **DNS only**  | poczta                         |
| TXT   | (DKIM)     | klucz DKIM                    | ⚪ **DNS only**  | poczta                         |

> ⚠️ Rekordy poczty (MX, SPF, DKIM, autodiscover) **muszą być „DNS only"** (szara chmurka),
> inaczej wysyłka/odbiór e-maili przestanie działać. Proxied (🟠) dotyczy tylko ruchu WWW/HTTP.

## 4. SSL/TLS

- **SSL/TLS → Overview → tryb `Full (strict)`** (LH.pl ma własny certyfikat SSL).
- **Edge Certificates → Always Use HTTPS: ON**.
- Nie używaj „Flexible" — powoduje pętle przekierowań i jest niebezpieczny.

## 5. Turnstile (CAPTCHA do aplikacji)

1. W panelu Cloudflare: **Turnstile → Add widget**.
2. Nazwa: `mmevents`; **Hostnames**: `mmevents.pl` (dodaj też `bookings.mmevents.pl`, jeśli na tej subdomenie działa aplikacja).
3. **Widget Mode: Managed** (zalecane).
4. Po zapisaniu dostajesz dwa klucze:
   - **Site Key** (publiczny),
   - **Secret Key** (tajny).

## 6. Wklejenie kluczy w CRM

CRM → **Ustawienia → Bezpieczeństwo**:

- `Cloudflare Turnstile — Site Key (publiczny)` → wklej **Site Key**,
- `Cloudflare Turnstile — Secret Key` → wklej **Secret Key**,
- **Zapisz**.

Od tej chwili CAPTCHA pojawia się przy **logowaniu** i **sprawdzaniu terminu**.
Dopóki pola są puste, funkcja jest nieaktywna (aplikacja działa normalnie, bez CAPTCHA).

## 7. (Opcjonalnie) Dodatkowa ochrona w Cloudflare

- **Security → Bots → Bot Fight Mode: ON** (blokuje proste boty).
- **Security → WAF** — włącz reguły zarządzane (Managed Rules).
- **Security → WAF → Rate limiting rules** — np. limit żądań na `/api/auth/login`.
- **Under Attack Mode** — włącz tylko na czas realnego ataku (pokazuje interstitial wszystkim).

---

## Wbudowane limity aplikacji (działają niezależnie od Cloudflare)

- **Logowanie**: po 10 nieudanych próbach z jednego IP — blokada 15 min, kolejne naruszenia — 1 h.
  Udane logowanie zeruje licznik.
- **Sprawdzanie terminu**: 10 sprawdzeń, potem blokada **20 min**; kolejne 10 → blokada **5 h**.
  Gdy zostaje ≤ 5 sprawdzeń, klient widzi komunikat „Zostało tylko X…".

Limity są per adres IP (tabela `rate_limits`). Stare wpisy można czyścić ręcznie w bazie,
jeśli zajdzie potrzeba odblokowania konkretnego IP wcześniej.
