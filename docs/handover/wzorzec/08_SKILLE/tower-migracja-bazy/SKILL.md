---
name: tower-migracja-bazy
description: Nakłada zmianę bazy danych TOWER bezpiecznie: numer, test w wycofanej transakcji, nałożenie, weryfikacja, testy. Użyj przy każdej zmianie schematu, funkcji, reguł dostępu lub zadań cyklicznych.
---

# tower-migracja-bazy

1. Sprawdź ostatni numer: lista migracji lokalnie **i na produkcji** — muszą być równe
2. Utwórz `supabase/migrations/NNNN_nazwa.sql` z kolejnym numerem
3. Nowa tabela → RLS, reguły, brak uprawnień `anon`; nowa funkcja → `is not true`,
   `search_path`, dziennik audytu
4. Uruchom migrację na produkcji w transakcji zakończonej `ROLLBACK` — sprawdź,
   czy przechodzi i czy nie narusza danych
5. `supabase db push`; powtórny `db push` musi zgłosić „aktualna"
6. Wszystkie zestawy testów bazy — wynik liczbami
7. Commit, push; w POSTEP.md: numer migracji, co zmienia, wynik testów
**Nigdy:** edycja nałożonej migracji, kwoty cennika w SQL, dane osobowe w testach
