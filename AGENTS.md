# TOWER — zasady dla agentów (Cursor, Grok, Claude Code)

Control tower transportu konstrukcji stalowych ponadnormatywnych
PL → Boden (Szwecja) dla projektu Stegra. Trzy firmy: **HHL** (spedytor,
właściciel systemu), **KSH** (klient), **SCX** — Scandinavian Express
(przewoźnik). Frontend: Vite + React. Backend: Supabase (Postgres z RLS,
Auth, Storage, Edge Functions, pg_cron).

## Zanim cokolwiek zrobisz

1. Przeczytaj `docs/handover/POSTEP.md` — co zrobione, co otwarte
2. Przeczytaj sekcję 1 `docs/handover/ZLECENIE_FINAL.md` — zasady pracy
3. Przeczytaj dokument źródłowy dziedziny, której dotyczy zadanie (niżej)

**Nie wznawiaj pracy z pamięci rozmowy. Pamięcią projektu są pliki.**

## Źródła prawdy — przy sprzeczności wygrywa wyższy

| # | Dokument | Dziedzina |
|---|---|---|
| 1 | `docs/handover/MECHANIZM_PIENIEDZY.md` | waluta, kurs NBP, opłata paliwowa, poziomy wyceny, faktury trzech stron, numery zleceń, terminy, przypomnienia |
| 2 | `docs/handover/STATUSY_AUTOMATYCZNE.md` | statusy z pozycji, rejsy, PROM, strefy, kto zmienia co w transporcie |
| 3 | `supabase/migrations/` + `tests/db/` | kontrakt bazy i bezpieczeństwa |
| 4 | `design/claude-v2.0/` + `docs/handover/DESIGN_SYSTEM.md` | wygląd |
| 5 | `docs/handover/ZLECENIE_FINAL.md` + `POSTEP.md` | zakres i postęp |
| 6 | `docs/handover/SCOPE.md` | rejestr zakresu — nic z niego nie może zniknąć |

`docs/claude/archiwum/` — historia decyzji. **Nie wykonuj.**

## Nienaruszalne

**Bezpieczeństwo egzekwuje baza, nie interfejs.** RLS i wyzwalacze
strażnicze. KSH nigdy nie dostaje w odpowiedzi API kosztu HHL ani faktur
przewoźnika; SCX nigdy przychodu HHL ani faktur dla KSH. Ukrycie
w interfejsie nie jest zabezpieczeniem.

**Pieniądze.** Źródłem jest EUR. PLN wyłącznie jako przeliczenie
wyświetlania (ustawienie użytkownika) albo waluta dokumentu faktury.
Kurs: NBP tabela A z dnia roboczego poprzedzającego dzień rozładunku,
dzień liczony lokalnie, nigdy w UTC. Faktura nadpisuje wynik, nie kasuje
wyliczenia. Data rozładunku zamrożona po zafakturowaniu.

**Statusy.** Tylko do przodu. **Rozładunek nigdy automatycznie** — to data
realizacji usługi. Jedno źródło prawdy o rejsie: `sailings` przez
`loads.sailing_id`.

**Wygląd.** Wyłącznie istniejące komponenty i wzorce z kanonu. Tokeny
`var(--…)`, kroje Barlow i Barlow Condensed, promień 0 lub 2 px, bez
cieni, bez gradientów, bez Tailwinda. Nowy wzorzec wizualny — tylko za
zgodą właściciela. Pilnuje `stylelint`.

**Języki.** Każdy napis interfejsu w słowniku, w trzech językach: PL, EN,
SV. Pilnuje test D19-T.

**Wzorzec wizualny** regenerujesz wyłącznie na końcu etapu, jednym
przebiegiem jednego skryptu, z raportem zmienionych ujęć. Więcej zmian,
niż umiesz uzasadnić — zatrzymaj się.

**Nie zgaduj.** Sprzeczność wymagająca decyzji biznesowej — zatrzymaj się
i zapytaj właściciela.

**Sekrety** wyłącznie w zmiennych środowiskowych. Nigdy w repozytorium
ani w rozmowie.

## Praca

- jedna pozycja — jeden commit: `fix(D19): …`, `feat(M6): …`
- po każdej pozycji wiersz w `docs/handover/POSTEP.md`: ID, commit,
  testy liczbami
- raportuj liczbami, nie słowami

## Testy

```
npm run test:unit                  # testy jednostkowe
npx vitest run tests/money.test.ts # mechanizm pieniędzy
bash tests/db/run.sh               # baza: bezpieczeństwo + automatyka statusów
npx playwright test                # interfejs, D19-T, D-EUR-T
npx stylelint "src/**/*.css"       # system projektowy
node scripts/baseline.mjs          # wzorzec wizualny — tylko na końcu etapu
```

`tests/db/supabase_stub.sql` służy wyłącznie do testu na czystym
Postgresie. **Nigdy nie uruchamiaj go na Supabase** — nadpisałby schemat `auth`.
