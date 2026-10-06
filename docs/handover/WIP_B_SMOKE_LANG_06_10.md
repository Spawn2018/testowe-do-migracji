# B-SMOKE-LANG (06.10.2026) — ZAMKNIĘTE (PR #134)

## Cel
Smoke + gate:visual zielone po usunięciu `#langSeg` (8322d02). Tylko testy/wzorzec — bez przywracania UI języka.

## Zakres
1. 8 specyfikacji: boot bez klikania `#langSeg`
2. `d19-i18n` wyłączony (PL-first / Q-9); usunięty z `fresh-smoke.sh`
3. Matryca baseline: LANGS = tylko `pl` (280 zamiast 840); usunąć `__en__`/`__sv__` ze `shots-baseline`
4. Odświeżyć wzorce smoke/stanów tylko z przyczyną (brak przełącznika języka / zegara)
5. Pełny `fresh-smoke` + lokalny `gate:visual`

## Status
- START 06.10 ~01:14 CEST
- Następny: poprawki testów → smoke → baseline PL → gate


## Checkpoint 01:35 CEST
- Gałąź `fix/b-smoke-lang-06-10` (+ cherry-pick wiersza G-V z #133 `3e3bc5c`)
- Testy bez `#langSeg`: visual, visual-states, e2e-core, etap4/5/6, d-eur-t; d19 → `describe.skip`; fresh-smoke bez d19
- baseline.mjs LANGS=[pl] → 280; usunięto 560 ujęć en/sv z `shots-baseline`
- Na świeżym buildzie HEAD (:4179): visual 4/4 (po odświeżeniu), stany 12/12 (po odświeżeniu; fokus przez focus() — pola dat B-8 między szukajką a chipami; 17.9 → Q-9 B motyw systemu), etap5 5/5
- Pod `#langSeg` ukryte awarie funkcjonalne: d-eur-t 1 fail (nota FX w Opcjach), etap6 0/1 (data-demo-mark w Opcjach = 0), e2e-core 3/5 (powiadomienie→klik, 390 px #roleSeg ukryty), etap4 6/12 (szuflada: nr HHL, plan-readonly, Ceny, marża, zgoda kierowcy, formularz rejsu)
- Odświeżone wzorce zawierają też zmiany SPOZA listy koordynatora: kokpit „E4 CLOSED→zamknięta” (`7d2b26c`), mapa chipy „Bez GPS/Ryzyko” (`e5ccb96`/`f456153`), stan-zablokowany szuflada (`80a7ad2` B-10a i kolejne) → do decyzji, NIE scalać bez zgody
- W toku: przypisanie awarii (build `8322d02^` :4181), matryca PL 280 kandydat

## Checkpoint 01:36 CEST — STOP
- Matryca PL 280 wygenerowana (280/280 OK zrzutów): 279 ponad próg; po wyrównaniu przesunięcia 30 px (niższy pasek korytarza) 75 czystych, 205 z resztą: harmonogram 30, mapa 30, ryzyka 30, ustawienia 20, kokpit 16, dokumenty 12, faktury 12, opcje/rozliczenia/strefy 10, faktury-przych. 9, inne 4.
- Na KAŻDYM nowym ujęciu toast „stan uszkodzony” → B-PERSIST-TOAST (regresja 05.10 08:12–15:34). Wzorca 280 NIE odświeżono.
- Cofnięto odświeżenie kokpit×2, mapa×2, stan-zablokowany (przyczyny spoza listy koordynatora).
- Dryf funkcjonalny sprzed 8322d02 → B-SMOKE-DRIFT.
- Następny krok po decyzji: naprawa B-PERSIST-TOAST → zgoda na 7d2b26c/B-7c/B-10a → regeneracja 280 + smoke → `npm run gate:visual`.

## Checkpoint 09:25 CEST — wznowienie (nowy executor)
- Zabite stare podglądy (4178/4179/4182/4183/4191 z 03–06.10); usunięte tmp-cand-pl*, /tmp/wt-dbg-dist, /tmp/wt-smoke-dist
- Świeży build demo HEAD `55eccc4` → :4179; persist-toast **3/3**; na buildzie `c1d23e2^` test „system light” **FAIL** (toast) → test wykrywa regresję, poprawka działa
- Prod (świeży kontekst, light/dark, obie domeny): ekran logowania bez toastu, bez pageerror; zalogowany użytkownik — niesprawdzone (brak konta testowego w tym przebiegu), wadliwa ścieżka jest w paczce prod → poprawka idzie na prod
- W toku: matryca PL 280 → tmp-cand-pl, klasyfikacja z wyrównaniem przesunięcia 30 px

## Checkpoint 10:02 CEST — matryca PL 280 odświeżona (wszystkie różnice z przyczyną)
- Świeży build demo `55eccc4` (:4179) → `tmp-cand-pl` 280/280 OK; deterministyczne (14 ujęć kontrolnych z osobnego buildu = 0 px różnicy)
- Klasyfikacja: 42 identyczne surowo; po wyrównaniu przesunięcia 30 px (niższy pasek korytarza) reszta poza nagłówkiem i dolnym pasem 30 px tylko w: harmonogram, mapa, ryzyka, strefy, opcje, ustawienia, rozliczenia, faktury-przychodowe
- Bisekcja (14 ujęć × 41 buildów, od `fd5f8e2` = ostatnia zielona brama 04.10 840/840 do HEAD) — przyczyna każdej grupy:
  - wszystkie widoki: `8322d02` (bez PL/EN/SV i zegara) + `6fc3037` B-9.2 (kafelki korytarza bez cyfr → pasek niższy o 30 px)
  - harmonogram: `e5ccb96` B-8 (pola dat), `50ba5d6` B-8 (kolumny HHL-KSH/SCAN, daty z rokiem), `f456153` „Jak działa”; (`fec7387` pusty harmonogram — brak importu, naprawione `9e17008`, bez zmiany netto)
  - mapa: `e5ccb96` B-7c (chipy „Bez GPS”/„Ryzyko”)
  - ustawienia: `8322d02` (bez wyboru języka) + `e5ccb96` Q-9 B („Domyślnie według ustawień systemu”)
  - opcje: `43e41fb` (04.10, L-4: sekcja „Czas wolny i przestój”, DWELL_OVER_FREE)
  - strefy: `4126b39` (04.10, L-12 kreator stref: kolumna „Kraj”, powiązania HHL/SCX)
  - ryzyka: `3a48097` (05.10 02:34, FERRY-STATUS: „Warunki drogowe SE · E4 i E22”, Karlskrona → Boden; na 390 px przesunięcie treści)
  - rozliczenia (KSH): `bfc7ed9` B-4a (bez „Fracht — stawka bazowa”/„Pilotaż i dodatki”)
  - faktury-przychodowe, faktury, dokumenty, finanse, kokpit, automatyzacje, moje-*: tylko `8322d02` + `6fc3037`
  - toast „stan uszkodzony”: pojawia się w `e5ccb96`, znika w `c1d23e2` (~0,2 % ujęcia; 390 px ~1,7 %)
- Grupy poza listą koordynatora, ale z jednoznaczną zamierzoną przyczyną: `43e41fb` (opcje), `4126b39` (strefy), `3a48097` (ryzyka), `bfc7ed9` (rozliczenia) — odświeżone z wpisem; różnic bez przyczyny: 0

## Checkpoint 10:20 CEST — ZAMKNIĘCIE
- Wzorce smoke bez zmian (visual 4/4, stany 12/12 na świeżym buildzie)
- `fresh-smoke.sh` OK (HEAD `1505ce2`): visual 4/4, stany 12/12, persist-toast 3/3, d-eur-t 2/2, etap4 12/12, etap5 5/5, etap6 1/1; e2e-core 5/5
- `gate:visual` 10:18: OK HEAD=1505ce2 smoke+stany=ok matryca=280/280 zmienione=0 czas=744s kod=0
- vitest 836 passed / 35 skip; gitleaks historia 0 (dopisane 4 fałszywe alarmy: nazwy flag H3_CORRIDOR_OBSTACLES/H10_… w m0170/m0176/m0177 i 0170 — z main 05.10, nie z tej gałęzi); katalog: tylko `.env.local` (nieśledzony, lokalne sekrety); `npm audit --omit=dev --audit-level=high` 0
- Posprzątane: stare podglądy, /tmp/wt-dbg-dist, /tmp/wt-smoke-dist, buildy bisekcji; `tmp-cand-pl` usunięty po odświeżeniu
- Następny: PR #134 ready → scalenie → zamknięcie #133 → Vercel prod → obie domeny 200
