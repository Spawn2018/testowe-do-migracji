# SEC-OWASP — ASVS poziom 2 (05.10.2026)

Cel: ASVS L2 + ZAP pasywny prod + zależności + przegląd RLS. **Ostatnia pozycja przed pilotażem.**

Stan: **PARTIAL** — audit + nagłówki + skrót ASVS zrobione; pełny ZAP pasywny i punkt-po-punkcie ASVS do domknięcia (brak ZAP w boxie).

## 1. Zależności (npm) — 13:32 PL

```
npm audit --omit=dev --audit-level=high
```

Wynik: **0 high/critical**.  
2× **moderate** (łańcuch `exceljs` → `uuid` <11.1.1, GHSA-w5hq-g745-h8pq).  
`npm audit fix --force` obniża exceljs do 3.4.0 (breaking) — **nie robione** bez decyzji właściciela.

## 2. Baza (Top 10 / RLS)

- RLS włączone na tables biznesowych (0001+).
- `security_flags` (prod 05.10): `TELM_EMTRACK_WEB=true`; `H1_ROUTE_CHECK` / `H3_CORRIDOR_OBSTACLES` / `H6_MAP_OBSTACLES` = **false**.
- Funkcje `security definer` z `revoke` + grant selektywny.
- Pilot redirect SMS/e-mail (0176) — aktywny dla SG-03 / GD035YX (tylko właściciel).

## 3. Nagłówki HTTP (pasywny skan curl) — 13:32 PL

| Host | HTTP | HSTS | CSP / XFO / XCTO / Referrer / Permissions |
|---|---|---|---|
| `tower.log-mar.pl` | 200 | tak (`max-age=63072000`) | brak w odpowiedzi curl (CSP/XFO/…) |
| `watch-tower-makieta.vercel.app` | 200 | tak (+ includeSubDomains; preload) | brak w odpowiedzi curl |

**Uwaga:** brak CSP/X-Frame-Options w odpowiedziach CDN — do decyzji (Vercel headers / Cloudflare). Nie zmieniane bez akceptacji (może zepsuć mapę/iframe).

## 4. ZAP

- **Pasywny** na prod: **nie uruchomiony** (brak ZAP/Docker image w boxie 05.10).
- **Aktywny** tylko na TEST (`emkbykwenwrjmbprydml`) — nigdy na prod.

## 5. ASVS L2 — skrót

| Obszar | Stan | Notatka |
|---|---|---|
| V2 Auth | OK | Supabase Auth; MFA flaga |
| V3 Session | OK | JWT; sesja 365 / kierowca 14 |
| V4 Access | OK | RLS + role HHL/KSH/SCX |
| V5 Validation | OK | walidacja SQL/Edge |
| V7 Errors | OK | bez stacków w UI prod |
| V8 Data | czeka | retencja — D-3 |
| V9 Communications | OK | HTTPS; EXTERNAL_MESSAGING; redirect pilota |
| V10 Malicious | OK | gitleaks pre-push |
| V14 Config | OK | sekrety poza repo; audit moderate only |

## 6. Następny krok (domknięcie)

1. ZAP Baseline Docker na `tower.log-mar.pl` (pasywny) — raport HTML do `docs/handover/`.
2. Decyzja: CSP / X-Frame-Options na Vercel/CF.
3. Decyzja: upgrade `uuid`/`exceljs` vs.accept moderate.
4. Pełna checklista ASVS L2 punkt-po-punkcie.

**Nie ruszane:** D-83 / H1/H3/H6 flags, R-0, D-3/7/14/16/17/21, II-10-E1.
