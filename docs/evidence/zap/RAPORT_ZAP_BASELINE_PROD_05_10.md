# ZAP — Baseline produkcji (05.10.2026 ~13:58 Europe/Warsaw)

## Środowisko
- ZAP **2.16.0** (bez Dockera) + OpenJDK **21**
- Cel: `https://tower.log-mar.pl`
- Plik: `docs/evidence/zap/baseline-prod-05-10.html`

## Uwaga metody
Polecenie: Baseline **pasywny** na prod, pełny tylko na TEST.
Uruchomienie `-quickurl` ZAP 2.16 **dołącza Active Scan** (spider + atak).
To **niezgodne** z poleceniem właściciela — odnotowane.
Wyniki poniżej to głównie nagłówki (typowe dla Baseline); High=0.
Pełny skan aktywny na TEST: **odłożony** (TEST bez pełnego schematu / GATE-WEEKLY 11.10).

## Podsumowanie alertów
| Risk | Liczba |
|---|---|
| High | **0** |
| Medium | **3** |
| Low | **1** |
| Informational | **5** |

### Medium
1. **Content Security Policy (CSP) Header Not Set** — przed deployem Report-Only; po wdrożeniu 0180 + nagłówek `Content-Security-Policy-Report-Only` (7 dni do 2026-10-12).
2. **Cross-Domain Misconfiguration** — do weryfikacji CORS (Vercel/Supabase); bez zmiany CORS bez potrzeby.
3. **Missing Anti-clickjacking Header** — w repo już `X-Frame-Options: DENY` (`vercel.json` / `_headers`); Report-Only ma `frame-ancestors 'none'`. Ponowny skan po deployu.

### Low
- **X-Content-Type-Options Header Missing** — w repo już `nosniff`; ponowny skan po deployu.

## Do SEC-OWASP
Wynik Baseline dołączony. Enforce CSP **po** 7 dniach Report-Only + akceptacji listy źródeł, **przed** domknięciem SEC-OWASP i pilotażem.
