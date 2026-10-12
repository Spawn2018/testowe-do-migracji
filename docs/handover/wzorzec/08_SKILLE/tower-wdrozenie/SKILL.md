---
name: tower-wdrozenie
description: Wdraża Watch Tower z main po scaleniu paczki i sprawdza, że produkcja działa. Użyj po każdym scaleniu paczki.
---

# tower-wdrozenie (wersja 08.10.2026)

1. Paczka scalona do `main` (merge commit, autor Sebastian Bożek); brama paczki zielona (`PLAN.md` §1 pkt 3).
2. `git checkout main && git pull`; `git status` czysty; build produkcyjny `VITE_AUTH_MODE=supabase` + strażnik paczki (bez kwot, danych osobowych, xlsx, demo, przykładów z seeda).
3. Wdrożenie wyłącznie z `main` (nigdy z gałęzi roboczej) — polecenia na Windows: `docs/handover/dopiski/D-20261012-0105-01.md` R7.
4. Migracja paczki według `tower-migracja-bazy` kroki 8–10.
5. `tower.log-mar.pl` i `watch-tower-makieta.vercel.app` → kod 200; po P9 (E24) `tower-hhl.pages.dev` → 301 na `tower.log-mar.pl` z tą samą ścieżką.
6. Lokalny HEAD = zdalny HEAD.
7. `POSTEP.md`: commit, wersja na Vercel, migracje, testy liczbami, czas na plan i na poprawki; status paczki w `PLAN.md` → „NA PRODUKCJI”.
