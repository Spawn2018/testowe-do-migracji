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
