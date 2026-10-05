# B-SMOKE-LANG (06.10.2026) — CZĘŚCIOWO (stop: wzorzec poza zakresem + regresja)

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

## Checkpoint 02:02 CEST — STOP
- Matryca PL 280 wygenerowana (280/280 OK zrzutów): 279 ponad próg; po wyrównaniu przesunięcia 30 px (niższy pasek korytarza) 75 czystych, 205 z resztą: harmonogram 30, mapa 30, ryzyka 30, ustawienia 20, kokpit 16, dokumenty 12, faktury 12, opcje/rozliczenia/strefy 10, faktury-przych. 9, inne 4.
- Na KAŻDYM nowym ujęciu toast „stan uszkodzony” → B-PERSIST-TOAST (regresja 05.10 08:12–15:34). Wzorca 280 NIE odświeżono.
- Cofnięto odświeżenie kokpit×2, mapa×2, stan-zablokowany (przyczyny spoza listy koordynatora).
- Dryf funkcjonalny sprzed 8322d02 → B-SMOKE-DRIFT.
- Następny krok po decyzji: naprawa B-PERSIST-TOAST → zgoda na 7d2b26c/B-7c/B-10a → regeneracja 280 + smoke → `npm run gate:visual`.
