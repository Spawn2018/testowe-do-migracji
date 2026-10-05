# SEC-OWASP — ASVS poziom 2 (05.10.2026)

Cel: ASVS L2 + ZAP pasywny prod + zależności + przegląd RLS. **Ostatnia pozycja przed pilotażem.**

Stan: **PARTIAL+** — audit, HSTS, bezpieczne nagłówki XFO/XCTO/Referrer/Permissions; ZAP **niedostępny** (brak Docker w boxie); CSP **nie włączone** (ryzyko mapy HERE — propozycja poniżej).

## 1. Zależności (npm) — 13:32 / 13:40 PL

```
npm audit --omit=dev --audit-level=high
```

Wynik: **0 high/critical**.  
2× **moderate**: `exceljs` → `uuid` <11.1.1 (GHSA-w5hq-g745-h8pq).  
`npm audit fix --force` obniża exceljs do 3.4.0 (**breaking**) — **nie robione**.  
**Decyzja właściciela:** akceptacja moderate do kolejnego cyklu OR pin `uuid@11` w overrides (bez upgrade płatnych usług).

## 2. Baza (Top 10 / RLS)

- RLS włączone; `security_flags`: `TELM_EMTRACK_WEB=true`; H1/H3/H6 **false**.
- Pilot redirect SMS/e-mail (0176) — aktywny.
- 0178: dopłaty PENDING/ACCEPTED z RLS (KSH nie widzi propozycji SCX).

## 3. Nagłówki HTTP

| Host | HTTP | HSTS | XFO / XCTO / Referrer / Permissions |
|---|---|---|---|
| `tower.log-mar.pl` | 200 | tak | **dodane** w `vercel.json` + `public/_headers` (deploy tej paczki) |
| `watch-tower-makieta.vercel.app` | 200 | tak (+ preload) | j.w. |

**CSP:** **nie włączone**. Propozycja (do testu na preview):  
`default-src 'self'; img-src 'self' data: blob: https://*.hereapi.com https://*.base.maps.ls.hereapi.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.hereapi.com; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-ancestors 'none'.`  
Wymaga przebiegu na preview przed prod — mapa/Leaflet/HERE łatwo się wyłoży.

## 4. ZAP

- **Pasywny** na prod: **nie uruchomiony** — brak `docker` / ZAP w środowisku agenta (05.10).
- **Aktywny** tylko na TEST — nigdy na prod.
- Domknięcie: `docker run --rm -t zaproxy/zap-stable zap-baseline.py -t https://tower.log-mar.pl` (gdy Docker dostępny, bez kosztów API).

## 5. ASVS L2 — skrót

| Obszar | Stan | Notatka |
|---|---|---|
| V2 Auth | OK | Supabase Auth; MFA flaga |
| V3 Session | OK | JWT |
| V4 Access | OK | RLS + role; dopłaty 0178 |
| V5 Validation | OK | |
| V7 Errors | OK | |
| V8 Data | czeka | D-3 |
| V9 Communications | OK | HTTPS; EXTERNAL_MESSAGING; redirect |
| V10 Malicious | OK | gitleaks |
| V14 Config | OK | sekrety poza repo; nagłówki XFO… |

## 6. Następny krok

1. ZAP Baseline (Docker) gdy dostępny.  
2. Decyzja CSP na preview.  
3. Decyzja exceljs/uuid (accept vs overrides).  

**Nie ruszane:** D-83 / H1/H3/H6 flags, R-0, D-3/7/14/16/17/21, II-10-E1. TELM true.
