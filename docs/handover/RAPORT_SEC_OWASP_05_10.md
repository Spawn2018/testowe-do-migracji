# SEC-OWASP — ASVS poziom 2 (start 05.10)

Cel: lista ASVS L2 + ZAP pasywny prod + zależności + przegląd RLS. **Ostatnia pozycja przed pilotażem.**

## 1. Zależności (npm)
Uruchomienie: `npm audit --omit=dev --audit-level=high` (blokuje high/critical w prod).  
Wynik z przebiegu 05.10: do uzupełnienia w CI przy tym PR.

## 2. Baza (Top 10 / RLS)
- RLS włączone na tables biznesowych (0001+).
- `security_flags`: EXTERNAL_MESSAGING, MFA, TELM, H1/H3/H6.
- Funkcje `security definer` z `revoke` + grant selektywny.
- Pilot redirect SMS/e-mail (0176) — test na prod.

## 3. ZAP
- **Pasywny** na `https://tower.log-mar.pl` — zaplanowany przy domknięciu SEC.
- **Aktywny** tylko na TEST (`emkbykwenwrjmbprydml`) — nigdy na prod.

## 4. ASVS L2 — skrót (do rozbudowy)
| Obszar | Stan |
|---|---|
| V2 Auth | Supabase Auth; MFA flaga |
| V3 Session | JWT; sesja 365 / kierowca 14 |
| V4 Access | RLS + role HHL/KSH/SCX |
| V5 Validation | walidacja SQL/Edge |
| V7 Errors | bez stacków w UI prod |
| V8 Data | retencja — D-3 czeka |
| V9 Communications | HTTPS; EXTERNAL_MESSAGING |
| V10 Malicious | gitleaks pre-push |
| V14 Config | sekrety poza repo |

**Następny krok:** pełna lista ASVS punkt-po-punkcie + ZAP pasywny raport.
