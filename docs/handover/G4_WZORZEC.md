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

## Bisect 26.09.2026 — 13 ujęć kokpitu różnych od wzorca (159–298 px w compare.mjs)
Ujęcia wykonane dla 15 commitów od `3153a78` (wzorzec) do `8755c82`, porównanie dokładne (piksele różne) i pixelmatch 0,28.
Wzorca **nie** aktualizowano.

| Commit | Ujęcia | Obszar | Różnica | Ocena |
|---|---|---|---|---|
| `ecb0632` feat(D15) | KSH EN 1280/1440/1920 dark, KSH SV 1280/1440/1920 dark (6) | znacznik ciężarówki na mapie kokpitu, przesunięcie ok. 2 px | 211–220 px (pixelmatch 8) | **zamierzone** — D15 wyłączył tick animacji (setInterval 1,5 s) przy zamrożonym czasie; wzorzec złapał pozycję po kilku tickach |
| `40eca8a` feat(PL-T) | KSH PL 390 dark/light, KSH PL 768 dark/light, SCX PL 390 light/dark-default (6) | polskie znaki w tekstach kokpitu („Najbliższa”, „sygnałów”, „transportów”) | 160–298 px (pixelmatch 1–50) | **zamierzone** — poprawka polskich znaków |
| — (już przy `3153a78`) | KSH SV 1280 light-default | znacznik ciężarówki (ten sam tick co D15) | 211 px | **zamierzone/niedeterminizm wzorca** — różni się od wzorca już na commicie wzorca |

SCX PL 390 dark-default różni się od wzorca także na `3153a78` (w środowisku bisectu, motyw systemowy);
zmiana wniesiona przez kod to tylko +40 px przy `40eca8a` (PL-T). Regresji: **0**.

Dlaczego przeszło: `compare.mjs` (próg koloru 0,28; zmiana liczona dopiero przy > 60 px albo ratio > 0,001)
nie liczył tych drobnych różnic, a hak pre-push robi 4 ujęcia. Od teraz: pełny przebieg 840 przed każdym tagiem
wzorca, wynik w opisie tagu (AGENTS.md, `.cursor/rules/tower.mdc`).

## III-13 (28.09.2026) — 36 ujęć wypisanych w D-25: commity, klasyfikacja, odświeżenie
Metoda jak przy 13 ujęciach kokpitu: build demo i ujęcia dla **każdego z 40 commitów** zmieniających `src/` od wzorca `ce094ad`
(27.09) do `6e9e2fb`, po 3 ujęcia reprezentatywne (Harmonogram HHL PL 1920 ciemny, Dokumenty HHL PL 1440 ciemny, Harmonogram HHL SV
768 ciemny), porównanie dokładne (piksele różne) commit do commitu; potem analiza pikseli poza strefą nowych elementów z uwzględnieniem
przesunięcia. Wzorzec odtwarza się na `ce094ad` z 0 px różnicy (determinizm potwierdzony, także ponowne ujęcie HEAD = 0 px).

| Grupa | Ujęcia | Commit(y) | Co się zmieniło poza strefą | Ocena |
|---|---|---|---|---|
| A | Harmonogram 1920: HHL i SCX × PL/EN/SV × 2 motywy (12) | `16638cb` feat(I-2a–h) | kolumna „Telefon”: numery demo `+48000000001…` / `+37000000001…` / `+46701740001…` zamiast realistycznych (I-2h: numery demo nieprzydzielalne, żeby demo nigdy nie wysłało SMS-a do prawdziwej osoby) — 16 031 px | **zamierzone** (KSH nie widzi telefonu — SEC-1, dlatego tylko HHL/SCX; kolumna widoczna tylko przy 1920) |
| A | jw. | `f7bda8b` III-2 (część) | wiersz filtrów: chipy za znakiem `/` przesunięte o 1 px w poziomie — naprawa dryfu `kbd` wobec makiety — 3 182 px | **zamierzone** (zgodność z makietą) |
| A/C | Harmonogram (strefa) | `db3d5e3` I-24 | przycisk „Eksport PDF” w nagłówku (w strefie) | zamierzone — strefa D-25 |
| B | Dokumenty HHL 1280/1440/1920 × PL/EN/SV × 2 motywy (18) | `bc31ac1` III-6 | nad listą „Pliki w vault” nowa tabela wymagalności i terminów → lista niżej o 133 px (lewa kolumna zgodna co do piksela po przesunięciu o 133 px); prawa kolumna (nazwy plików obok przycisku 26 px, wyrównanie do środka) pada na inny ułamek piksela → te same teksty, inne wygładzanie (5 660 px, x 1200–1427) | **zamierzone** — treść identyczna (sprawdzone na wycinkach), różnica wyłącznie z zaokrąglenia pozycji podpikselowej |
| B | jw. (strefa) | `e4b393d` I-2k | pasek „paczka tygodnia” (w strefie) | zamierzone — strefa D-25 |
| C | Harmonogram HHL SV 390/768/1280 × 2 motywy (6) | `db3d5e3` I-24 | szwedzka etykieta przycisku PDF zawija pasek narzędzi → tabela niżej o ~38 px (ułamkowo); co kilka wierszy wiersz pada na inny ułamek piksela (np. SG-05, SG-10) — ta sama treść, inne wygładzanie (10 309 px) | **zamierzone** — skutek nowego przycisku; zawijanie paska jak w makiecie (flex-wrap) |

Szum niezależny od kodu: 7–14 px w pasku górnym (y 10–11) zmienia się między przebiegami niezależnie od commitu — poniżej progu, nie
wpływa na wynik.

**Regresji: 0.** Wzorzec 36 ujęć odświeżony z buildu `6e9e2fb` (zmiany `6e9e2fb` względem `24dbbcf` są niewidoczne: `aria-label`, `tabIndex`).

## G-V a956ab6 (28.09.2026) — brama wizualna 839/840: 1 ujęcie, artefakt kolejności ujęć
Wynik `npm run gate:visual` na `a956ab6` (11:33): `FAIL matryca=839/840 zmienione=1` — `harmonogram__hhl__sv__390__dark-default.png`.

| Pytanie | Ustalenie |
|---|---|
| Commit | żaden — `6e9e2fb` i `a956ab6` mają identyczne `src/` (a956ab6 to dokumenty + wzorzec); ujęcie z buildu `6e9e2fb` i `a956ab6` = 0 px różnicy między sobą |
| Co się różni | cała klatka (98 276 px): dokument przewinięty w poziomie o ~370 px (pasek górny, liczniki i tabela przesunięte, pasek boczny poza kadrem) |
| Przyczyna | `scripts/baseline.mjs` → `setTheme()` przełącza motyw przez `page.click('#themeBtn')`; Puppeteer przewija element do widoku, a przy szerokości 390 px i szwedzkim pasku górnym przycisk motywu leży poza ekranem → okno przewija się w poziomie. Dzieje się to tylko, gdy poprzednie ujęcie było jasne (trzeba kliknąć). W pełnej matrycy `…__light` idzie przed `…__dark-default`, więc przewinięcie jest zawsze. Przy odświeżaniu w III-13 ujęcia robiono pojedynczo (`FILTER=<plik>`) — świeża strona, motyw domyślny, bez kliknięcia, bez przewinięcia |
| Dowód | `FILTER=harmonogram__hhl__sv__390__dark-default` (samo ujęcie) → 0 px względem wzorca III-13; `FILTER=harmonogram__hhl__sv__390` (jasne, potem ciemne) → 98 276 px, dwa przebiegi identyczne (0 px) — deterministyczne |
| Ocena | **artefakt narzędzia (kolejność ujęć), nie zmiana aplikacji; regresji 0** |
| Działanie | ujęcie wzorca zastąpione wersją z kolejności pełnej matrycy (tak jak robi je brama); pozostałe 839 bez zmian. Przyszłe odświeżenia pojedynczych ujęć: robić parami w kolejności matrycy (np. `FILTER=<widok>__<rola>__<język>__<szerokość>`), nie pojedynczym plikiem. Uodpornienie `baseline.mjs` (kliknięcie motywu bez przewijania albo zerowanie `scrollX` przed ujęciem) zmieni wszystkie ujęcia 390/768 przewinięte w ten sam sposób — osobna pozycja z pełnym przebiegiem, nie mieszana z tym wyjaśnieniem |

## G-V c90c062 (28.09.2026) — matryca 840/840 identyczna, a wynik FAIL: błąd bramy (katalog ujęć)
`gate:visual` na `c90c062` (12:33): `FAIL matryca=840/840 zmienione=0 powód=różnice-ponad-0,1%`. Raport: `identical 840, changed 0,
missingInBaseline 17` — w katalogu kandydata było 857 plików: 840 ujęć matrycy + 17 śledzonych w repo zrzutów `shots/01-cockpit.png…17-final-hhl-cockpit.png`
(wzorzec wdrożenia z 23.09, `af3ea61`). `gate.sh` rozpakowuje `git archive HEAD` do katalogu tymczasowego i zapisywał matrycę do
`$TMP/shots` — tego samego katalogu. `compare-baseline.mjs` kończy się kodem 2 przy plikach bez odpowiednika we wzorcu, więc
**brama zgłaszała FAIL przy każdym przebiegu**, także bez żadnej różnicy (tak samo w raportach `24dbbcf` i `a956ab6`: 857 plików).
Naprawa (narzędzie, nie aplikacja): matryca do `$TMP/gate-shots`. Ocena ujęć `c90c062`: **840/840 bez zmian, regresji 0**
(A11Y-2 i 10.8 bez wpływu na wygląd — potwierdzone). Wzorzec bez zmian.
