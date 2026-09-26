# G4 — regeneracja wzorca wizualnego (Fala 3B)

Tag: `baseline-fala-3b-2026-09-26` (poprzedni: `baseline-fala-3a-2026-09-25`, 720 ujęć).

## Matryca
`scripts/baseline.mjs` (`SCRIPT_VERSION=2026-09-26-g4-fala3b-views`), build demo z HEAD (`VITE_AUTH_MODE=demo`, podgląd :4181),
zamrożony czas 2026-09-23T14:32:00Z, 5 szerokości × 2 motywy × 3 języki.

Nowe ujęcia (+120 → **840**):
- **Faktury KSH** — `faktury__ksh__*` (30): moduł faktur HHL → KSH.
- **Faktury przychodowe HHL** — `faktury-przychodowe__hhl__*` (30): widok Faktury przewinięty do sekcji `[data-bill-section="PRZYCHOD"]` (poniżej sekcji kosztowej, poza pierwszym ekranem).
- **Ustawienia KSH i SCX** — `ustawienia__{ksh,scx}__*` (60).

Przebieg: 840/840 OK, 0 FAIL.

## Porównanie ze wzorcem 3A
Progi G2 (0.28 / 60 px / 0.001): 720 porównanych · **249 identycznych · 471 zmienionych** · 0 różnic rozmiaru · 120 nowych.

| Widok · rola | Zmienione | Przyczyna |
|---|---|---|
| wszystkie widoki KSH ≥ 768 px (dokumenty, kokpit, mapa, ryzyka, rozliczenia: 27/30 każdy) | 135 | nawigacja KSH: nowe pozycje **Faktury** (M6) i **Ustawienia** (M4); niezmienione tylko 390 px ciemny |
| wszystkie widoki SCX 1920/1440/1280 (dokumenty, mapa, ryzyka, moje-zadania: 18/30 każdy) | 72 | nawigacja SCX: nowa pozycja **Ustawienia**; 768/390 bez bocznej nawigacji — identyczne |
| harmonogram HHL/KSH/SCX | 90 | M5 — trzy kolumny numerów zleceń (KSH/HHL/SCX) przy kodzie; M10 — przełącznik Transporty / Rejsy |
| faktury HHL/SCX | 60 | M7 — faktury kosztowe / przychodowe (BillsPanel) nad dotychczasową treścią |
| finanse HHL | 30 | M8 — zestawienie poziomów + kurs tymczasowy; M11 — marża w trzech wierszach + łączna |
| rozliczenia KSH (27) / moje-stawki SCX (24) | 51 | M8 — zestawienie poziomów pewności i kursu tymczasowego (+ nawigacja) |
| kokpit HHL (30) / SCX (30) | 60 | **G4** — pill poziomu i kursu tymczasowego pod kwotą (marża HHL, tydzień SCX; odłożone z M8) — kafelki wyższe o jeden wiersz, treść niżej; SCX także nawigacja |
| **razem** | **471** | wszystkie zmiany przypisane do pozycji Etapu 4 |

Bez zmian: wszystkie widoki tylko-HHL poza kokpitem/finansami/fakturami/harmonogramem (automatyzacje, dokumenty, mapa, opcje, ryzyka, strefy — 0/30 każdy).

## Zestaw kontrolny PLN
`SET=pln node scripts/baseline.mjs` → `shots-baseline-pln/` (6 ujęć): kokpit i harmonogram × HHL/KSH/SCX × 1440 × motyw domyślny roli,
waluta wyświetlania PLN ustawiona w Opcjach (HHL) / Ustawieniach (KSH, SCX). 6/6 OK; kwoty w PLN (kokpit HHL: marża w PLN z pill poziomu i kursu tymczasowego).

## Migawki smoke Playwright
`tests/__screenshots__/kokpit-hhl-pl-1920-{light,dark-default}.png` zaktualizowane (ta sama przyczyna co kokpit powyżej); `mapa-*` bez zmian.
