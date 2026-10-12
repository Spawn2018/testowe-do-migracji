# G2 — raport grupowy baseline Fala 3a (2026-09-25 Europe/Warsaw)

## Przebieg

- Capture: `OUT=shots-g2-candidate node scripts/baseline.mjs` → **720/720** ok, 0 fail
- Compare: `node scripts/compare-baseline.mjs` (pixelmatch colorThr=0.28, maxDiffPixels=60; changed if ratio>0.001 lub >60 px)
- Wynik vs poprzedni `shots-baseline`: **711/720 zmienionych** · **9 identycznych** · 0 size/missing
- Decyzja: **REGEN + TAG** (brama etapu 2 — regeneracja wzorca dozwolona wyłącznie tu)

## Grupy (widok → liczba zmienionych)

| widok | zmienione | uzasadnienie Etap 2 |
|---|---:|---|
| dokumenty | 90 | D19 · D25 L7 DRAWING z vault |
| mapa | 90 | D19 legenda · D12 tablice/kierowca |
| ryzyka | 90 | D19 · D25 SE alts · D18 DemoMark |
| harmonogram | 89 | D19 · D12 · P6 money · D6 phone · D17 daty |
| kokpit | 87 | D19 i18n · D12 seed · P6 FX kwoty |
| faktury | 60 | D19 · P6 money · D25 weekSubtitle |
| automatyzacje | 30 | D19 · D25 nota wf_note |
| finanse | 30 | D19 · P6 formatAppMoney · D18 |
| moje-zadania | 30 | D19 · D25 L4 hoursUntilLoad |
| opcje | 30 | D19 · D18 · P6 FX note · D25 BAF fasada |
| strefy | 30 | D19 · D25 L8 samplesRequired |
| rozliczenia | 29 | D19 · P6 · KSH fin |
| moje-stawki | 26 | D19 · P6 · SCX fin |

## Werdykt

Brak niewyjaśnionych widoków — każda grupa mapuje się na pozycje Etap 2 (D19/D12/P6/D18/D25/D6/D17…).
Nie STOP.

Tag: `baseline-fala-3a-2026-09-25`

