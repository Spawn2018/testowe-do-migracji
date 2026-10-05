# SEC-OWASP — ASVS poziom 2 (05.10.2026)

Cel: ASVS L2 + ZAP pasywny prod + zależności + przegląd RLS. **Ostatnia pozycja przed pilotażem.**

Stan: **PARTIAL++** — audit, HSTS, XFO/XCTO/Referrer/Permissions; **CSP Report-Only** (0180, 7 dni do 2026-10-12); **ZAP Baseline** prod 05.10 (High=0); D-3 retencja dokumentów wdrożona.

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

**CSP:** **Report-Only** od 05.10 (~13:53), do **2026-10-12** Europe/Warsaw.  
Nagłówek w `vercel.json` + `public/_headers`. Naruszenia → `csp_violations` + kafelek w Stanie systemu (`csp_status_view`).  
Po 7 dniach: lista źródeł do akceptacji właściciela → **enforce przed SEC-OWASP i pilotażem**.

## 4. ZAP

- **Baseline prod** 05.10: ZAP 2.16 + Java 21 **bez Dockera**. Raport: `docs/evidence/zap/RAPORT_ZAP_BASELINE_PROD_05_10.md` (+ HTML).
- High **0** / Medium **3** (CSP przed deployem Report-Only; CORS; clickjacking — XFO już w repo).
- **Incydent:** `-quickurl` dołączył **Active Scan** na prod (~13:58 Europe/Warsaw). Audyt: `docs/evidence/zap/AUDYT_ZAP_ACTIVE_PROD_05_10.md` — **0 śmieci DB**, 0 e-mail/SMS/push/banów z ZAP; aktywność = cron TELM/AIS + migracja 0180.
- **Naprawa skryptów:** `scripts/zap-baseline-passive.sh` (prod TYLKO pasywny); `scripts/zap-full-active.sh` (Active tylko TEST); guard `scripts/zap/prodGuard.mjs` + test `tests/zap-prod-guard.test.ts` (prod odrzuca Active). **Nie używać** `-quickurl` na prod.
- Pełny Active na TEST: GATE-WEEKLY **11.10**.

## 5. ASVS L2 — skrót

| Obszar | Stan | Notatka |
|---|---|---|
| V2 Auth | OK | Supabase Auth; MFA flaga |
| V3 Session | OK | JWT |
| V4 Access | OK | RLS + role; dopłaty 0178 |
| V5 Validation | OK | |
| V7 Errors | OK | |
| V8 Data | OK | D-3: CMR/POD/zdjęcia 3 lata, PDF faktur 5 lat (0180); I-7 bez zmian |
| V9 Communications | OK | HTTPS; EXTERNAL_MESSAGING; redirect |
| V10 Malicious | OK | gitleaks |
| V14 Config | OK | sekrety poza repo; nagłówki XFO… |

## 6. Następny krok

1. Po 7 dniach Report-Only: lista naruszeń CSP → akceptacja źródeł → enforce.  
2. Pełny ZAP na TEST (11.10 / GATE-WEEKLY).  
3. Decyzja exceljs/uuid (accept vs overrides).  

**Nie ruszane:** D-83 / H1/H3/H6 flags, R-0, D-7/14/16/17/21, II-10-E1. TELM true. D-3 **wdrożone**.
