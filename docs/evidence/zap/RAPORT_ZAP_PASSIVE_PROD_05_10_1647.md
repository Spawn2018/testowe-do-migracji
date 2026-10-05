# ZAP Baseline PASYWNY — produkcja (05.10.2026 ~16:47 Europe/Warsaw)

| Pole | Wartość |
|------|---------|
| Cel | `https://tower.log-mar.pl` |
| Narzędzie | ZAP **2.16.0** + OpenJDK 21, skrypt `scripts/zap-baseline-passive.sh` |
| Tryb | **wyłącznie pasywny** (spider + passive; bez Active Scan) |
| Raport HTML | `docs/evidence/zap/baseline-passive-2026-10-05_1647.html` |

## Alerty

| Risk | Liczba |
|------|--------|
| High | **0** |
| Medium | **2** |
| Low | **1** |
| Informational | **5** |

### Medium (do akceptacji właściciela — nie high/critical)
1. **CSP Header Not Set** (4 inst.) — ZAP oczekuje *enforce*; na prod jest **Report-Only** do **12.10** (decyzja właściciela). Info alert: „CSP Report-Only Header Found”.
2. **Cross-Domain Misconfiguration** (17) — `Access-Control-Allow-Origin: *` na statycznych odpowiedziach Vercel. SPA auth = JWT Supabase (nie cookie sesji API). Zmiana CORS bez potrzeby = ryzyko regresji hostingu.

### Low
- **ZAP is Out of Date** — narzędzie skanera, nie aplika.

### Informational (wybrane)
- CSP Report-Only Found; Modern Web Application; Cache-control; Suspicious Comments.

## Active Scan
**Nie uruchamiany na prod.** Pełny Active tylko na TEST — GATE-WEEKLY **11.10**.
