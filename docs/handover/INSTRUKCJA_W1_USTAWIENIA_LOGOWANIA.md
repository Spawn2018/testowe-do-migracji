# W1 — ustawienia logowania Supabase (produkcja)

**Projekt:** `nglnnrmzmhusvxslousq` (Watch Tower — produkcja).  
**Panel:** [Supabase Dashboard](https://supabase.com/dashboard/project/nglnnrmzmhusvxslousq) → **Authentication** → **Providers** / **Settings** (ścieżka może brzmieć „Sign In / Providers” albo „Auth Settings” — szukaj haseł i zasad hasła).  
**Bez sekretów i haseł w tym pliku.**

## Co włączyć (właściciel)

1. **Ochrona przed wyciekniętymi hasłami** (*Leaked password protection* / Have I Been Pwned) — **włączona**.
2. **Minimalna długość hasła** — **12** znaków.
3. **Wymagane znaki** — **litery i cyfry** (nie samo „tylko litery” ani „tylko cyfry”).

## Po zapisaniu

- W doradcy Security zgłoszenie `auth_leaked_password_protection` na produkcji powinno zniknąć (wyjątek w `tests/db/advisor-exceptions.txt` dotyczy tylko TEST / planu darmowego).
- Zmianę w panelu robi wyłącznie właściciel (W1 w `PLAN.md` §5).

Źródło: PLAN §4 P3 / §5 W1; dopisek D-20261014-0015-01 R4.
