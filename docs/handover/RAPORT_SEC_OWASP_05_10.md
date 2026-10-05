# SEC-OWASP — skrót 05.10.2026 (aktualizacja ~16:50)

**Pełna lista ASVS L2:** [`SEC_OWASP_ASVS_L2.md`](./SEC_OWASP_ASVS_L2.md)

Stan: **W TOKU / PARTIAL** — pasywny ZAP prod High=0; CSP Report-Only do **12.10**; Active = TEST 11.10; high/critical do naprawy teraz: **0**.

| Obszar | Stan |
|--------|------|
| npm audit high/critical | 0 (2 moderate exceljs/uuid) |
| ZAP pasywny prod 16:47 | High 0 / Medium 2 / Low 1 — `docs/evidence/zap/RAPORT_ZAP_PASSIVE_PROD_05_10_1647.md` |
| Nagłówki | HSTS, XFO, XCTO, Referrer, Permissions, CSP-RO |
| CSP enforce | **NIE** do 12.10 |
| csp_violations | 0 wierszy |
| RLS | OK (poza PostGIS `spatial_ref_sys`) |

---

## Aktualizacja 05.10 ~17:00 — decyzje C/D/PKCE/deps

| Punkt | Wynik |
|-------|-------|
| C hasło min 12 | pass — UI + config.toml + `password_min_length=12` API; bez force change |
| D CORS Edge | pass — tylko `https://tower.log-mar.pl`; SMS przez PostgREST (`sms_devices` 200) |
| PKCE | pass — `flowType: pkce`; e2e 8/8 bez wysyłki maili |
| exceljs/uuid | pass — overrides uuid@11.1.1; audit prod 0; testy XLSX/PDF/import |
| B CSP enforce | bez zmian — Report-Only do 12.10 |

ASVS L2: **82 pass / 12 partial / 0 fail / 18 N/A**.
