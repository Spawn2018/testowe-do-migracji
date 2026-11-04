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

## G-V 0efa871 (28.09.2026) — narzędzie odporne na przewinięcie w poziomie: 162 ujęcia, wszystkie artefakt starego narzędzia
Zmiana narzędzia (commit `0efa871`, `scripts/baseline.mjs`): motyw przełączany kliknięciem w DOM (`clickThemeBtn`, bez przewijania przez
Puppeteer) i przed każdym ujęciem `resetHorizontalScroll()` (`window.scrollTo(0, scrollY)`, `scrollLeft = 0` dokumentu). Pełny przebieg
`gate:visual` na `0efa871` (14:26): `FAIL matryca=678/840 zmienione=162` (próg 0,1%). Ten sam HEAD zawiera 9.4 (`0163949`) — w trybie demo
bez wpływu na wygląd (Automatyzacje i Opcje 1920/1440 identyczne).

| Grupa | Ujęcia | Commit | Przyczyna | Ocena |
|---|---|---|---|---|
| wszystkie widoki, 390 px (HHL pl/en/sv × ciemny/jasny, KSH pl/en/sv ciemny, SCX pl/en/sv × ciemny/jasny) | 144 | `0efa871` (narzędzie) | stary wzorzec był robiony z oknem przewiniętym w poziomie o 111–349 px: `page.click('#themeBtn')` przewijał okno do przycisku motywu (poza ekranem przy 390 px), a przewinięcie przechodziło na kolejne ujęcia tej szerokości (strona nie jest przeładowywana między zadaniami tej samej szerokości). Nowe ujęcie = to, co widzi użytkownik po wejściu (x = 0: pasek boczny, logo TOWER, lewa część mapy). Analiza przesunięcia (`/tmp/bis/hshift.mjs`): cała klatka przesunięta w poziomie, zgodność 0,59–0,99 (mapa niżej — kafelki i widoczny wycinek mapy zależą od przesunięcia) | **zamierzona (poprawka narzędzia), regresji 0** |
| SCX 768 px pl (ciemny/jasny) — kokpit, mapa, harmonogram, ryzyka, dokumenty, faktury, moje stawki, moje zadania, ustawienia | 18 | `0efa871` (narzędzie) | ten sam mechanizm: przy 768 px kliknięcie motywu przewijało okno o 4 px; teraz x = 0 — przesunięcie o dokładnie 4 px, zgodność 1,0000 | **zamierzona, regresji 0** |
| KSH 390 px pl/en/sv jasny (domyślny) — harmonogram | 3 (poniżej progu, 263–318 px) | `0efa871` (narzędzie) | pasek filtrów (przewijany poziomo) przesunięty o ~1 px (y 206–233); nowe narzędzie daje ten sam wynik niezależnie od kolejności (ujęcie pojedyncze = ujęcie w podzbiorze 390/768, 0 px) | **zamierzona, regresji 0** |

Deterministyczność nowego narzędzia: `harmonogram__ksh__pl__390` zrobione osobno i w podzbiorze wszystkich ujęć 390/768 (336, inna kolejność
poprzedników) — 0 px różnicy. Zauważone przy okazji (bez zmiany, stan sprzed commitów): przy 390 px dokument jest szerszy niż okno
(pasek górny z przełącznikami języka/motywu wychodzi poza ekran) — to cecha makiety, nie regresja; ewentualna zmiana = decyzja o wyglądzie.

**Regresji: 0.** Wzorzec odświeżony po klasyfikacji: 165 ujęć (144 + 18 + 3) z buildu `0efa871` nowym narzędziem (podzbiory
`FILTER=__390__`, `FILTER=__768__`); pozostałe 675 bez zmian.

## G4-D27-D31 (02.10.2026) — zgoda koordynatora: odświeżyć TYLKO ujęcia z przyczyną

Zgoda: odświeżenie wzorca **wyłącznie** dla ujęć, których różnica wynika z:
**D-27** (kontrast tekstu), **D-31** (pasek ≤430), **BRAND-15** (logo/nazwa), **RESP-14** (telefon/PWA layout), **UI-12** (user/rola/Wyloguj w Nav; bez POD/mocowania).

| Grupa przyczyny | Oczekiwane ujęcia | Przyczyna |
|---|---|---|
| D-27 | wszystkie motywy / widoki z `--ink-3`, amber, badge, kursor thead | kolory tekstu ≥ 4,5:1; zero przesunięć layoutu |
| D-31 | ujęcia **390** (pasek górny) | ukryty lang+roleswitch, brand ściśnięty, overflow-x clip |
| BRAND-15 | splash / login / favicon / Nav brand | Watch Tower branding |
| RESP-14 | **390** i **768** — Nav menu, drawer, karty harmonogramu | menu ☰, full drawer, touch targets |
| UI-12 | Nav (wszystkie szerokości) + Docs/Schedule bez POD/LASHING | sesja w menu; usunięte typy dokumentów z UI |

**Procedura:** po `gate:visual` — lista zmienionych; każde ujęcie z przyczyną z tabeli → odświeżyć; ujęcie bez przyczyny → **wypisać, nie odświeżać**.

### Wynik 02.10 — Playwright `visual-states` + smoke (nie matryca 840)

Przyczyna `stan-najechanie` (i pozostałych stanów): **zamierzona**, nie regresja.

| Ujęcia | Przyczyna | Decyzja |
|---|---|---|
| `stan-najechanie__{dark,light}`, `stan-fokus__{dark,light}`, `stan-pusty__{dark,light}`, `stan-wcisniety__dark`, `stan-zablokowany__dark`, `stan-ladowanie__dark`, `stan-blad__dark`, `stan-walidacja__dark` (11) | **BRAND-15** (TOWER→Watch Tower + symbol) + **D-27** (kontrast `--ink-3` / badge w treści tabeli ~3% px) | **odświeżone** w `tests/__screenshots__/` |
| `tryb systemowy` | bez różnicy | bez zmian |
| smoke `kokpit__hhl__pl__1920__{light,dark-default}`, `mapa__hhl__pl__1920__{light,dark-default}` (4) | te same: BRAND-15 + D-27 | **odświeżone** |

D-31 / RESP-14: nie dotyczą ujęć 1440/1920 (pasek/menu telefonu). UI-12: marginalny wpływ na te kadry.

**Matryca 840 (`shots-baseline/`):** porównanie SHA-256 kandydat (Windows Chrome) vs wzorzec:
**840/840 zmienione**, 0 bez przyczyny. Odświeżone wszystkie.

| Szerokość | Ujęcia | Przyczyny |
|---|---|---|
| 390 | 168 | BRAND-15, D-27, D-31, RESP-14, UI-12 |
| 768 | 168 | BRAND-15, D-27, RESP-14, UI-12 |
| 1280 / 1440 / 1920 | 168×3 | BRAND-15, D-27, UI-12 |

Ujęcia bez przyczyny: **brak** (lista pusta).

## B-MAPA / B-7a / B-7b (05.10.2026) — odświeżenie 90 ujęć mapy

Zgoda właściciela 05.10 07:57 (czas warszawski): odświeżyć wzorce 90 ujęć `mapa__*` oraz 2 smoke w `tests/__screenshots__/`, bo różnica jest zamierzona.

| Przyczyna | Co widać |
|---|---|
| **B-MAPA** | podkład z etykietami (HERE na produkcji; w demo / bez auth — zapas z etykietami, nie szary Esri); podpis HERE / zapas |
| **B-7a** | stały rozmiar mapy z wysokości okna, niezależny od tabeli obok |
| **B-7b** | na ekranie ≤ 768 px checkboxy warstw w osobnym pasie nad mapą |

| Zestaw | Liczba | Działanie |
|---|---|---|
| `shots-baseline/mapa__*` | 90 | **odświeżone** z buildu demo HEAD (FILTER=mapa, port 4189) |
| `shots-baseline/kokpit__*` | 78 zmienionych (z 90) | **odświeżone** — wbudowana mapa (B-MAPA); 12 bez różnicy ponad próg / hash |
| `tests/__screenshots__/mapa-hhl-pl-1920-{light,dark-default}.png` | 2 | **odświeżone** |
| `tests/__screenshots__/kokpit-hhl-pl-1920-{light,dark-default}.png` | 2 | **odświeżone** (ten sam powód: mapa na kokpicie) |
| strefy, opcje, harmonogram, stany | — | **bez odświeżenia** — różnice stref/stanów nie wynikają z B-MAPA/B-7a/B-7b (strefy: kolumny tabeli, nie mapa) |

**Regresji: 0.** Po odświeżeniu: kandydat mapa 90/90 i kokpit 90/90 identyczne ze wzorcem; smoke visual 4/4 zielone.

## B-4a (05.10.2026) — Finanse bez pilotażu w przychodzie

Zamierzona zmiana UI: usunięte wiersze „Pilotaż i dodatki” / „Przychód — pilotaż i dodatki” w Finanse (KSH, HHL). Odświeżono 30× `shots-baseline/finanse__*`. Innych ujęć nie ruszano.

## B-4b (05.10.2026) — Faktury: załącznik tylko CMR

Zamierzona zmiana: bez POD w załącznikach faktury. Odświeżone zmienione ujęcia `faktury__*` / `faktury-przychodowe__*`.

## P2 (13.10.2026) — E41, E21, E10, E8

Odświeżone 15 migawek Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38379829847, gałąź `pakiet/P2-fundament`). Ekrany: Kokpit i Mapa (nazwa transportu, biała liczba dzwonka) oraz stany przycisków. Matrycy 280 ujęć nie ruszano.

## P2-wyglad (13.10.2026) — E8, E38 1A

Odświeżone 8 migawek stanów Harmonogramu z `visual.yml` `update=true` (run 38421964162, gałąź `pakiet/P2-wyglad`). Ekrany: Harmonogram — kolumna „Wysyłka” to sam kod. Kokpit i Mapa bez zmiany pikseli. Matrycy 280 ujęć nie ruszano.

## wyglad/P3-a (13.10.2026) — E37 pasek górny, E13

Odświeżone 15 migawek Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38466075360, gałąź `wyglad/P3`, commit `73e98ef`; ponownie run 38471591003, commit `e82c5e2` — ramka konta po poprawce nazwiska). Wszystkie ekrany: nowy pasek górny (konto po prawej, „Podgląd” HHL / KSH / SCX, rejsy z pełnymi nazwami portów, bez przycisku motywu), lewe menu bez e-maila i „Wyloguj”. Matrycy 280 ujęć nie ruszano.

## wyglad/C-reszta (15.10.2026) — E41 nazwy w Kokpicie, E20 pasek poniżej 1440 px

`visual.yml` z `update=true` (run 38678112902, gałąź `wyglad/C-reszta` złożona na `wyglad/C-dzwonek`, commit `c7f1f54`): zmienione 2 migawki — `kokpit-hhl-pl-1920-light` i `kokpit-hhl-pl-1920-dark-default` (kafelki Kokpitu z nazwą transportu według firmy, E41: „T-12 · HHL/2026/1276”). Pozostałe 13 bez zmian. Matrycy 280 ujęć nie ruszano.

## wyglad/C-dzwonek (15.10.2026) — E5 dzwonek w grupach, E10 liczba na stałym tle

`visual.yml` z `update=true` (run 38675408793, gałąź `wyglad/C-dzwonek`, commit `465d260`): zmienione 2 migawki — `kokpit-hhl-pl-1920-light` i `kokpit-hhl-pl-1920-dark-default` (liczba przy dzwonku bez sytuacji ogólnej, E5 decyzja 07.10 13:21; tło liczby `--alarm`, E10). Pozostałe 13 bez zmian. Matrycy 280 ujęć nie ruszano.

## wyglad/P3-b (14.10.2026) — E9 Kokpit i liczby w menu (V5, E8 pkt 6)

Odświeżone 14 migawek Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38487793951, gałąź `wyglad/P3-b`, commit `a54f1da`). Ekrany: Kokpit — 6 kafelków E9 w 2 kolumnach, stopka czasu wykrycia, „Najpilniejsze” zamiast czerwonego banera; wszystkie ekrany — lewe menu z liczbami tylko przy „Ryzyka” i „Faktury” (bez Harmonogramu, Stref, Automatyzacji). Matrycy 280 ujęć nie ruszano.

## wyglad/P7-a (15.10.2026) — E32 panel transportu: Przegląd i okno Awizacja

Odświeżona 1 migawka Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38660778186, gałąź `wyglad/P7-a`, commit `bd24514`): „stan-zablokowany” — Przegląd w kolejności E32 (Plan i ETA, Awizacja / Kierowcy, Ładunek i zestaw, Numery, Dokumenty), bez „Kontroli trasy”, „Przeszkód” i czerwonego baneru zezwolenia. Pozostałe 14 migawek bez zmian (bajt w bajt). Matrycy 280 ujęć nie ruszano.

## wyglad/P6-b (14.10.2026) — E17 panel transportu: Historia i Czat

Odświeżona 1 migawka Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38639213705, gałąź `wyglad/P6-b`, commit `6e734fa`): „stan-zablokowany” — zakładka „Czat” zamiast „Ustalenia” (E17, 20:57) i liczba przy „Ryzyka” liczona kartami (E7-2, wyglad/P6-a). Pozostałe 14 migawek bez zmian (bajt w bajt). Matrycy 280 ujęć nie ruszano.

## wyglad/P4-c (14.10.2026) — E44 pole „Link śledzenia”, „Gotowy” L6/L9, E26 sprawa L14, E35 „Działa samo”

Odświeżona 1 migawka Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38554118466, gałąź `wyglad/P4-c`, commit `6318360`): „stan-zablokowany” — w zakładce Status pod „Gotowy” zdanie „Brakuje: zezwolenie” (L6, L9). Pozostałe 14 migawek bez zmian. Matrycy 280 ujęć nie ruszano.

## wyglad/P4-b (14.10.2026) — E25 zakładka Status, E27 pasek śledzenia, E15 blok ETA, słownik nazw E25

Odświeżone 10 migawek Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38512437080, gałąź `wyglad/P4-b`, commit `3c5f0bf`, na PR #181 `2902bc5`). Mapa: pigułki statusów z nazwami E25 („Droga SE”, „Droga PL”, „Port PL”, „Port SE”). Stany (III-2): panel transportu z paskiem śledzenia nad zakładkami; „stan-zablokowany” — zakładka Status z osią i „Zmień status”. Matrycy 280 ujęć nie ruszano.

## wyglad/P5-c (15.10.2026) — E16 Kokpit „Marża”, E39, E33, W41

Odświeżone 2 z 15 migawek Playwright (`tests/__screenshots__/kokpit-hhl-pl-1920-light.png`, `kokpit-hhl-pl-1920-dark-default.png`) z przebiegu `visual.yml` `update=true` (run 38775952897, gałąź `wyglad/P5-c`, commit `9e08cce`). Zmiana tylko w kafelku „Marża”: opis „… · ważona przychodem · 72 z ceną” (E16 — liczba transportów z ceną i bez ceny) i kwota liczona jak w Finansach. Pozostałe 13 migawek identyczne bajt w bajt. Matrycy 280 ujęć nie ruszano.

## wyglad/P6-c (15.10.2026) — E17 panel › Status

Odświeżona 1 z 15 migawek Playwright (`tests/__screenshots__/stan-zablokowany-dark.png`) z przebiegu `visual.yml` `update=true` (run 38787568990, gałąź `wyglad/P6-c`, commit `349283a`). Zmiana tylko w zakładce „Status” panelu: znacznik „IMPORT” przy „Zaplanowany”, „plan zał. 05.10” przy „Załadunku” i „plan 09.10” przy „Na placu” (E17). Pozostałe 14 migawek identyczne bajt w bajt. Matrycy 280 ujęć nie ruszano.

## wyglad/P4-a (14.10.2026) — E28 pasek etapów, E27 Mapa, L7 oznaczenia

Odświeżone 15 migawek Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38500750044, gałąź `wyglad/P4`, commit `fe090d0`). Wszystkie ekrany: pod paskiem górnym pasek 10 kafelków z liczbą w grupach Przygotowanie · W trasie · Po dostawie (zamiast 9 kafelków bez cyfr). Harmonogram: filtry stanu Opóźnione N · Bez dokumentów · Bez kierowcy · Bez ciągnika i licznik „N z M” (bez przycisków etapów). Mapa: chipy W trasie · Opóźnione · Brak GPS, oznaczenia obok statusu, „Najbliższe włączenia śledzenia”. Matrycy 280 ujęć nie ruszano.

## wyglad/P3-c (14.10.2026) — E11, E12 Opcje i Ustawienia (E37, E6 Moje konto)

`visual.yml` z `update=true` po rebase na `main` `cb14008` (run 38504703136, gałąź `wyglad/P3-c`, commit `61fbfd2`) i po poprawkach z niezależnego sprawdzenia (run 38514652438, commit `26716b6`): 15 migawek Playwright identycznych bajt w bajt z `tests/__screenshots__/` — nic nie podmieniono. Migawki nie obejmują Opcji ani Ustawień; ekrany P3-c sprawdza brama E8 (blok „wyglad/P3-c”, 360/390/430 px) i dowód `docs/handover/odbior/P3/wyglad-P3-c/`. Matrycy 280 ujęć nie ruszano.

## P4 (14.10.2026) — E25 statusy, stan-zablokowany (nodocs)

Odświeżone migawki Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38503841814, gałąź `pakiet/P4-statusy-sledzenie`, commit `26d8b9c5`). Ekrany: Harmonogram — filtr „Bez dokumentów” przez `[data-quick="nodocs"]` (E25 / D-20261014-0315-01 H2.4) zamiast `.chipbtn`).nth(3). Matrycy 280 ujęć nie ruszano.

## AUD-03 (06.10.2026) — Harmonogram KSH bez „Zmień ciągnik”

Zamierzona zmiana UI (polecenie AUD-03: „Zmień ciągnik” niewidoczny dla roli KSH; baza i tak odmawia — `tests/db/aud03.sh`). gate:visual na `b52dcc5`: 274/280, zmienione wyłącznie `harmonogram__ksh__pl__{1280,1440,1920}__{dark,light-default}` (6). Odświeżono te 6 ujęć z przebiegu bramy (kolejność pełnej matrycy). Innych ujęć nie ruszano.

## A6 #555 (25.10.2026) — kreator mapowania importu (bez loadDay/delivDay)

Odświeżona 1 migawka Playwright (`tests/__screenshots__/stan-walidacja-dark.png`) z przebiegu `visual.yml` `update=true` (run 40194670197, gałąź `pakiet/a6-ksh-sharepoint`, commit `7dc0b52d`). F7 #555: kreator bez pól `loadDay`/`delivDay` (import ich nie czyta); nowe pola E38 (przewoźnik, tablice, numery, komentarz) zostają. Matrycy 280 ujęć nie ruszano.

## wyglad/W-1118 (20.10.2026) — oś Status: „Przygotowanie” i „Rozliczenie” zwinięte

Zamierzona zmiana UI (D-20261020-1118-01, decyzja właściciela 20.10.2026, 11:18). Migawka odświeżona z przebiegu `visual.yml` `update=true` (run 39404184157, gałąź `wyglad/W-1118`). Zmieniona wyłącznie `stan-zablokowany-dark.png`: na osi Status sekcje „Przygotowanie” i „Rozliczenie” są zwinięte i pokazują bieżący status, a legenda zawiera źródła A10. Innych migawek ani matrycy 280 ujęć nie ruszano.

## #594 B4 (27.10.2026) — rozmycie tła za paskiem transportu

Zamierzona zmiana UI (polecenie właściciela 27.10.2026, 14:55, #594 pkt 3: „gdy widoczny jest prawy pasek transportu to tło ulega rozmyciu”). Migawka odświeżona z przebiegu `visual.yml` `update=true` (run 40583817432, gałąź `wyglad/W-594-gesty-rozmycie`, commit `22e4746`). Zmieniona wyłącznie `stan-zablokowany-dark.png`: reszta ekranu za otwartym paskiem jest rozmyta (`backdrop-filter: blur(3px)`, od 769 px). Pozostałe migawki identyczne bajt w bajt. Matrycy 280 ujęć nie ruszano.

## BN9-b (30.10.2026) — migawki smoke mapy: tory Korytarza bałtyckiego
Odświeżone tylko `tests/__screenshots__/mapa-hhl-pl-1920-{light,dark-default}.png`, z workflowu `visual` (`update=true`,
gałąź `wyglad/BN9-b`, przebieg 41083266249, artefakt `visual-artifacts`). Pozostałe migawki w artefakcie są identyczne co do bajtu.
Przyczyna: warstwa promu (`mapPool` → ferryLeg) rysuje teraz zawsze niebieskie tory TLL–HEL, MUU–VUO, TLL–STO i PLD–KPS.
W kadrze widać je przy Sztokholmie, Tallinnie i Helsinkach: 791 px (jasny) i 953 px (ciemny), zmierzone na PR #670 i lokalnie.
Kadrowanie, linie drogowe i markery bez zmian. Zamierzone, **regresji 0**. Wzorca `shots-baseline` nie zmieniano.

## DP-76 (31.10.2026) — migawki smoke mapy: tory promów przerywane
Odświeżone tylko `tests/__screenshots__/mapa-hhl-pl-1920-{light,dark-default}.png`, z workflowu `visual` (`update=true`,
gałąź `wyglad/DP-76`, przebieg 41187141430, commit `7c44f9d`, artefakt `visual-artifacts`). Pozostałe 13 migawek w artefakcie jest identycznych co do bajtu (Kokpit też).
Przyczyna: decyzja właściciela 31.10.2026, tory promów na wszystkich mapach są jasnoniebieskie przerywane (`FERRY_LANE_STYLE.dashArray = '6 6'`).
Różnice tylko w obszarze torów (Gdańsk/Gdynia–Nynäshamn/Karlskrona, Sztokholm–Tallinn–Helsinki): 1827 px (jasny) i 1851 px (ciemny), prostokąt x 583–846, y 569–845.
Kadrowanie, linie drogowe i markery bez zmian. Zmiana zamierzona, **regresji 0**. Wzorca `shots-baseline` nie zmieniano.

## DP-76 r2 (31.10.2026) — jasny motyw: tory promów `#3A82BA` (kontrast)
`visual.yml` z `update=true` (gałąź `wyglad/DP-76`, przebieg 41191028969, commit `50bbee8`, artefakt `visual-artifacts`): wszystkie 15 migawek jest identycznych co do bajtu z `tests/__screenshots__/`, więc nic nie podmieniono.
Przyczyna: w jasnym motywie tor ma teraz `#3A82BA` z kryciem 1 (wcześniej `#6BA8D6` z kryciem 0,9), w ciemnym bez zmian.
Różnica koloru w mierze pixelmatch (YIQ) wynosi ok. 1242 przy progu 2761 (`threshold: 0.28`), więc piksele toru mieszczą się w tolerancji.
`--update-snapshots` (tryb „changed”) przepisuje tylko migawki niezgodne, więc wzorzec zostaje. Kształt i przerywanie torów są bez zmian (DP-76 r1).
Styl jasny sprawdza test zachowania `tests/dp-76-ferry-style.jsdom.test.ts`. Wzorca `shots-baseline` nie zmieniano.

## BN9-c1 (01.11.2026) — nowe migawki: ekran „Wczytaj rozkład Vikinga z pliku”
Dodane `tests/__screenshots__/rejsy-viking-import-hhl-pl-{1440,390}-light.png` z workflowu `visual` (`update=true`,
gałąź `wyglad/BN9-c1`, przebieg 41258516039, commit `92f5e60`, artefakt `visual-artifacts`). Pozostałe 15 migawek w artefakcie jest identycznych co do bajtu.
Migawka samego ekranu importu (Harmonogram › Rejsy, Administrator HHL, demo): podgląd przykładowy (wymyślone rejsy, G-09), zapis nieaktywny z wyjaśnieniem, historia przykładowa.
Okno wyższe (1440×2200, 390×3400), żeby cały ekran był w kadrze; dolny pasek telefonu ukryty na czas migawki. Wzorca `shots-baseline` nie zmieniano.

## BN9-c2 (01.11.2026) — nowe migawki: pasek śledzenia „Na promie”
Dodane `tests/__screenshots__/pasek-na-promie-hhl-pl-{1440,390}-light.png` z workflowu `visual` (`update=true`,
gałąź `wyglad/BN9-c2`, przebieg 41353182007, commit `5b95c69`, artefakt `visual-artifacts`). Pozostałe 17 migawek w artefakcie jest identycznych co do bajtu.
Migawka samego paska śledzenia w karcie transportu SG-03 (demo, Prom, Nova Star): „Na promie · Nova Star” i „brak pozycji statku · lokalizator naczepy na promie zwykle milknie”
(w demo pozycje przykładowe nie są pozycją statku). Wzorca `shots-baseline` nie zmieniano.

## BN9-c3 (02.11.2026) — nowe migawki: Ryzyka › „Pogoda na przeprawach”
Dodane `tests/__screenshots__/pogoda-przeprawy-hhl-pl-{1440,390}-light.png` z workflowu `visual` (`update=true`,
gałąź `wyglad/BN9-c3`, przebieg 41375312301, commit `d5b462a`, artefakt `visual-artifacts`). Pozostałe 19 migawek w artefakcie jest identycznych co do bajtu (Kokpit też — demo nie ma transportów bałtyckich, więc kart pogody w Kokpicie nie ma).
Migawka samej sekcji (Administrator HHL, demo, telefon — zakładka „Na trasie”): pięć przepraw z wartościami przykładowymi (G-09), najpierw ryzyko wyższe, atrybucja, dopisek NAVTEX i link „Mapa lodowa FMI”.
Dolny pasek telefonu ukryty, okno wyższe (1440×2200, 390×3400), żeby cała sekcja była w kadrze; test sprawdza też brak poziomego przewijania. Wzorca `shots-baseline` nie zmieniano.

## BN9-c3 r2 (02.11.2026) — nowa migawka: Ryzyka KSH na komputerze
Dodana `tests/__screenshots__/ryzyka-ksh-pl-1440-light.png` z workflowu `visual` (`update=true`, gałąź `wyglad/BN9-c3`,
przebieg 41379235273, commit `e58ac97`, artefakt `visual-artifacts`). Pozostałe 21 migawek w artefakcie jest identycznych co do bajtu (także `pogoda-przeprawy-*` i Kokpit).
Przegląd #723 pkt 3: u KSH „Pogoda na przeprawach” stoi w siatce `.rk-ksh .rk-route-parts` na pełną szerokość pod promami i drogami; „Drogi PL” i „Drogi SE” zostają w prawej kolumnie obok promów. Migawka całej strony Ryzyk KSH (demo, okno 1440×2200). Wzorca `shots-baseline` nie zmieniano.

## BN9-c4 (02.11.2026) — nowe migawki: Ryzyka › Drogi LT / LV / EE / FI; odświeżona Ryzyka KSH
Dodane `tests/__screenshots__/drogi-baltyckie-hhl-pl-{1440,390}-light.png` i odświeżona `ryzyka-ksh-pl-1440-light.png` z workflowu `visual`
(`update=true`, gałąź `wyglad/BN9-c4`, przebieg 41395377997, commit `72fbac1`, artefakt `visual-artifacts`). Pozostałe 21 migawek w artefakcie są identyczne co do bajtu (Kokpit, pogoda na przeprawach, Drogi PL i SE bez zmian).
- `drogi-baltyckie-*` (Administrator HHL, demo, przykładowa trasa transportu Tallinn – Helsinki): sekcje rozwinięte kliknięciem (domyślnie zwinięte z licznikiem „Finlandia · 3 utrudnienia · 1 wysokie”). Telefon 390: obszar czterech sekcji (LT i FI z limitem masy i dopiskiem „Sprawdź zezwolenie / trasę.”, EE „Brak utrudnień na korytarzu.”, atrybucja „Źródło: Fintraffic / digitraffic.fi, licencja CC BY 4.0 (przykład)”), bez ucięć i bez poziomego przewijania. Komputer 1440: sama sekcja „Drogi FI”. Kolumna „Sytuacja na trasie” w tym ujęciu ma ~318 px i nachodzi na nią treść „Do zrobienia” — tak samo jak we wzorcu `pogoda-przeprawy-hhl-pl-1440-light.png` (BN9-c3); to stan układu HHL 1440 w środowisku testów, nie zmiana z BN9-c4 (do osobnego sprawdzenia).
- `ryzyka-ksh-pl-1440-light.png` (1230×1390 → 1230×1607): pod promami i Drogami PL/SE nowa siatka 2 × 2 — „Drogi LT”, „Drogi LV”, „Drogi EE”, „Drogi FI”, zwinięte z licznikiem i znacznikiem „demonstracyjne” (EE: „Brak utrudnień na korytarzu.”); „Pogoda na przeprawach” dalej na pełną szerokość na końcu. Promy, Drogi PL i Drogi SE bez zmian. Wzorca `shots-baseline` nie zmieniano.

## BN9-c4 F7 r1 (02.11.2026) — odświeżone: drogi-baltyckie 390, Ryzyka KSH; usunięta drogi-baltyckie 1440
Z workflowu `visual` (`update=true`, przebieg 41399919530, commit `8796680`, artefakt `visual-artifacts`); pozostałe migawki identyczne co do bajtu.
- Usunięta `drogi-baltyckie-hhl-pl-1440-light.png` (F7 r1 B1): utrwalała rozbity układ HHL 1440 (kolumna ~318 px, nachodzący tekst „Do zrobienia”) — to osobne DP-161 (BN9-c5). Komputer pokrywa `ryzyka-ksh-pl-1440-light.png`.
- `drogi-baltyckie-hhl-pl-390-light.png`: dopisek „Źródło LT (Via Lietuva) nie podaje wypadków.”, w nagłówku FI „spowolnienie +15%” (demo `corridor_conditions`), kolejność FI wg czasu przy równym wpływie, EE „Brak utrudnień na korytarzu.” (świeży odczyt demo); tytuły bez ucięć (telefon — do 2 linii).
- `ryzyka-ksh-pl-1440-light.png` (1230×1635): te same zmiany w siatce 2 × 2 (dopisek LT, spowolnienie FI); promy, Drogi PL/SE i pogoda bez zmian.

## DP-161 (02.11.2026) — Ryzyka HHL 1440: odświeżona pogoda na przeprawach, przywrócona drogi-baltyckie 1440
Z workflowu `visual` (`update=true`, gałąź `wyglad/DP-161`, przebieg 41409362417, commit `32733f6`, artefakt `visual-artifacts`). Pozostałe 22 migawki w artefakcie są identyczne co do bajtu (także `ryzyka-ksh-pl-1440-light.png`, telefon 390 i Kokpit).
Przyczyna rozbitego układu z BN9-c3/BN9-c4: test ukrywał `nav.tower-nav` także na komputerze, gdzie to menu boczne — `main` wpadał wtedy do kolumny menu (186 px), siatka `.rk-grid` dawała „Do zrobienia” 0 px i trasie 320 px, a wzorzec utrwalał ten stan. W aplikacji przy 1440 kolumna trasy ma 478 px. Teraz pasek ukrywany tylko na telefonie, a przed migawką komputera test sprawdza dwie kolumny obok siebie (trasa ≥ 360 px, „Do zrobienia” szersza, bez nakładania i przewijania w bok).
- `pogoda-przeprawy-hhl-pl-1440-light.png` (318×910 → 476×662): cała sekcja w prawej kolumnie, pięć przepraw, atrybucja, NAVTEX i „Mapa lodowa FMI” bez ucięć i bez nachodzącego tekstu.
- `drogi-baltyckie-hhl-pl-1440-light.png` (nowa, 476×978): obszar „Drogi LT” – „Drogi FI” w prawej kolumnie, sekcje rozwinięte; limity masy LT i FI z dopiskiem „Sprawdź zezwolenie / trasę.”, EE „Brak utrudnień na korytarzu.”, atrybucja Fintraffic.
Wzorca `shots-baseline` nie zmieniano.

## BN9-c4b (02.11.2026) — Drogi LT / LV / EE / FI otwarte od razu jak Drogi SE (decyzja 89): odświeżone 3 migawki
Z workflowu `visual` (`update=true`, gałąź `wyglad/BN9-c4b`, przebieg 41539029574, commit `dfbb342`, artefakt `visual-artifacts`). Pozostałe 21 migawek w artefakcie są identyczne co do bajtu (Kokpit, pogoda na przeprawach, Drogi PL i SE bez zmian).
- `drogi-baltyckie-hhl-pl-1440-light.png` (476×978 → 476×893): sekcje otwarte bez klikania — bez linków „Zwiń” pod nagłówkami; FI w kolejności wpływ, potem najświeższy początek (Wypadek E75 Kemi, Kelirikko 4 Oulu z limitem 12 t, Roboty E75 Vuosaari – Kerava); opis „ograniczenie prędkości 50 km/h” z liczbą przy jednostce. LT z limitem 40 t i dopiskiem o braku wypadków, EE „Brak utrudnień na korytarzu.”, atrybucja Fintraffic.
- `drogi-baltyckie-hhl-pl-390-light.png` (372×1078 → 372×922): te same sekcje bez „Zwiń”, bez opisów (telefon), tytuły do 2 linii, bez poziomego przewijania.
- `ryzyka-ksh-pl-1440-light.png` (1230×1635 → 1230×1987): siatka 2 × 2 „Drogi LT/LV/EE/FI” od razu z wierszami (wcześniej zwinięta z licznikiem), w tym samym kształcie co Drogi SE; promy, Drogi PL/SE i pogoda bez zmian.
Poprawki w tym kroku: `RoadRow` wiąże liczbę z jednostką spacją nierozdzielającą (test `etap6-ui.spec.ts:219` — „50 km” łamało się przy 1280 dla HHL i SCX); test migawki dróg przewija obszar LT–FI do widoku (bez kliknięć przełączników `main` zostawał na górze i wycinek 1440 kończył się na „Drogi LV”, 476×429). Wzorca `shots-baseline` nie zmieniano.
## BN9-c5 (02.11.2026) — linie tras BN7: karta transportu Tallinn – Helsinki, Mapa z transportem bałtyckim
Z workflowu `visual` (`update=true`, gałąź `wyglad/BN9-c5`, przebieg 41512448969, commit `58f8992`, artefakt `visual-artifacts`). Pozostałe migawki w artefakcie są identyczne co do bajtu (Kokpit 1920, Ryzyka, telefon 390). Demo: trasa przykładowa z adresu (`demoRoute=SG-11:TLL-HEL,SG-17:TLL-HEL`, tylko demo) i przykładowe linie dróg BN7 (`src/data/roadLinesDemo.ts`, „przykład”).
- `karta-tll-hel-hhl-pl-1440-light.png` (nowa, 529×341): Przegląd SG-11 przed oknem śledzenia — cała trasa w kadrze: tylko legi PL-TLL (Śrem – Warszawa – Kowno – Ryga – Tallinn) i FI-HEL (Helsinki – Oulu – Tornio – Boden), tor Tallinn – Helsinki; bez linii PL–SE i torów GDN-NYN / GDY-KAA. W dopisku Przeglądu trzecia linia „Trasa orientacyjna (HERE, bez wymiarów ładunku) — nie zastępuje trasy z zezwolenia.”; kadr nad dopiskiem.
- `karta-tll-hel-hhl-pl-390-light.png` (nowa, 360×301): to samo na telefonie, dopisek u góry w jednym ciągu, trasa pod nim (kadr liczy margines górny — wcześniej dopisek u góry dawał szarą mapę w najmniejszym przybliżeniu).
- `mapa-baltyk-hhl-pl-1440-light.png` (nowa, 682×866): Mapa — rdzeń Polska–Szwecja (drogi i oba tory) oraz korytarz aktywnego transportu SG-17 (PL-TLL, FI-HEL, tor TLL-HEL), kadr z Bałtykiem; dopisek u góry z prawej obok „+ / −” (z lewej warstwy).
- `mapa-hhl-pl-1920-light.png`, `mapa-hhl-pl-1920-dark-default.png` (odświeżone, 1920×1080): bez czterech torów bałtyckich (BN7 §4 pkt 1 — tory bałtyckie już nie „zawsze”; w demo żaden aktywny transport nie jedzie trasą bałtycką). Drogi, tory PL–SE, znaczniki i tabela bez zmian.
Wzorca `shots-baseline` nie zmieniano.

## BN9-c5 F7 r1 #740 (02.11.2026) — karta Gdańsk – Nynäshamn i Mapa bałtycka na telefonie
Z workflowu `visual` (`update=true`, gałąź `wyglad/BN9-c5`, przebieg 41523063920, commit `e835f31`, artefakt `visual-artifacts`). Pozostałe migawki w artefakcie są identyczne co do bajtu (także karta TLL-HEL 1440/390, Mapa bałtycka 1440, Mapa i Kokpit 1920).
- `karta-gdn-nyn-hhl-pl-1440-light.png` (nowa, 529×341): Przegląd SG-11 (statek Polferries → GDN-NYN, przed oknem śledzenia) — tylko drogi PL-GDN i SE-NYN i tor Gdańsk – Nynäshamn; bez drogi Karlskrona – Sztokholm, toru Gdynia – Karlskrona i dopisku bałtyckiego.
- `mapa-baltyk-hhl-pl-390-light.png` (nowa, 364×541): Mapa na telefonie z aktywnym SG-17 na TLL-HEL — rdzeń PL–SE i korytarz Tallinn – Helsinki; dopisek „Trasa orientacyjna…” na pełną szerokość pod przyciskiem „Warstwy”, obok „+ / −”, kadr pod dopiskiem.
Wzorca `shots-baseline` nie zmieniano.

## BN9-c5 r3 (02.11.2026) — decyzja 88: cała sieć tras zawsze na Mapie i w Kokpicie
Z workflowu `visual` (`update=true`, gałąź `wyglad/BN9-c5`, przebieg 41534912840, commit `2d66338`, artefakt `visual-artifacts`). Pozostałe 23 migawki w artefakcie są identyczne co do bajtu (karty TLL-HEL 1440/390 i GDN-NYN 1440, Ryzyka, Drogi bałtyckie, pogoda, Rejsy, pasek promu).
Przyczyna: decyzja właściciela 88 (02.11 22:32) — pomarańczowe linie przez Litwę, Łotwę, Estonię i Finlandię oraz Sztokholm/Kapellskär → Boden są na Mapie i w Kokpicie zawsze (jak PL–SE), z torami przepraw bałtyckich i dopiskiem „Trasa orientacyjna…”; kadr domyślny = cała sieć. Karta transportu i mapy stref bez zmian. Demo: legi BN7 to przykład (`roadLinesDemo.ts`).
- `mapa-hhl-pl-1920-light.png`, `mapa-hhl-pl-1920-dark-default.png` (1920×1080): rdzeń PL–SE i obie drogi bałtyckie (Śrem – Warszawa – Kowno – Ryga – Tallinn/Muuga/Paldiski; Helsinki/Vuosaari – Oulu – Tornio – Boden; Sztokholm/Kapellskär – E4 – Boden), tory Gdańsk/Gdynia – Szwecja i Tallinn – Helsinki/Sztokholm, Paldiski – Kapellskär; kadr od Śremu po Boden z Bałtykiem i Finlandią. Dopisek u góry z prawej obok „+ / −”, nie zasłania tras ani warstw. Znaczniki i tabela bez zmian.
- `kokpit-hhl-pl-1920-light.png`, `kokpit-hhl-pl-1920-dark-default.png` (1920×1080): mini-mapa (w kadrze migawki tylko jej górny pas) — dopisek „Trasa orientacyjna…” u góry z prawej, kadr całej sieci z marginesem górnym na dopisek (mniejsze przybliżenie, Boden niżej); reszta Kokpitu bez zmian.
- `mapa-baltyk-hhl-pl-1440-light.png` (682×866): cała sieć (wcześniej tylko korytarz aktywnego SG-17 TLL-HEL) — dodatkowo drogi PL-MUU/PL-PLD, FI-VUO, SE-STO/SE-KPS i tory MUU-VUO, TLL-STO, PLD-KPS; kadr i dopisek jak wcześniej.
- `mapa-baltyk-hhl-pl-390-light.png` (364×541): to samo na telefonie — cała sieć mieści się pod dopiskiem (12 px, 2 linie pod „Warstwy”), Boden pod dopiskiem, „+ / −” wolne.
Dopisek na telefonie 11,5 → 12 px (brama E8: tekst ≥ 12 px — dopisek jest teraz zawsze na Mapie i w Kokpicie). Wzorca `shots-baseline` nie zmieniano.

## BN9-c6 (03.11.2026) — ekrany po BN8: migawki bez zmian
Z workflowu `visual` (`update=true`, gałąź `wyglad/BN9-c6`, przebieg 41569802196, commit `88d7ad1`, artefakt `visual-artifacts`): wszystkie 29 migawek identyczne co do bajtu — Kokpit 1920 (w demo nie ma rejsów armatorów bałtyckich, więc sekcja „Najbliższy prom — przeprawy bałtyckie” się nie rysuje; kafelek „Najbliższy prom” w demo bez zmian), Mapa, karty TLL-HEL / GDN-NYN, Ryzyka, Drogi bałtyckie (DP-177 — w danych demo tytuły bez liczby z jednostką), pogoda, Rejsy, pasek promu (migawki bez `ferries=all`).
Migawka `karta-tll-hel-rejs-hhl-pl-1440-light.png` (przebieg 41571946540) usunięta decyzją koordynatora (#750): w demo pokazywała statek Polferries „Wawel” na trasie Tallinn – Helsinki (`demoRoute`), co jest mylące. Wiersz „Rejs” z trasą bałtycką, stan ETA „brak danych” przed BN8b, Kokpit z promem bałtyckim (kafelek tylko Polferries / Stena) i pasek TLLA-HEL — pokrycie testami jsdom (`tests/bn9-c6-screens.jsdom.test.ts`).
Wzorca `shots-baseline` nie zmieniano.

## DP-176/182 (03.11.2026) — Kokpit: ciaśniejszy kadr mini-mapy całej sieci
Odświeżone tylko `tests/__screenshots__/kokpit-hhl-pl-1920-{light,dark-default}.png`, z workflowu `visual` (`update=true`, gałąź `wyglad/DP-176-182`,
przebieg 41579509837, commit `da98169`, artefakt `visual-artifacts`). Pozostałe 27 migawek w artefakcie jest identycznych co do bajtu (Mapa 1920, Mapa bałtycka 1440/390, karty TLL-HEL / GDN-NYN, Ryzyka, Drogi bałtyckie, pogoda, Rejsy, pasek promu, stany).
Przyczyna: DP-176 — w Kokpicie kadr całej sieci z marginesem 12 px (zamiast 24 px), a dopisek „Trasa orientacyjna…” u góry z prawej liczony jako margines prawy (sieć obok dopisku, nie pod nim). Mini-mapa 727 × 360: przybliżenie ok. 3 → 4; w kadrze bez Islandii, sieć (Śrem – Boden, Bałtyk, Finlandia) w lewej części mapy, dopisek nie zasłania tras.
Różnice tylko w obszarze mini-mapy (w kadrze migawki jej górny pas, prostokąt x 1180–1907, y 932–1080): 91 469 px (jasny) i 90 952 px (ciemny) — Boden i znacznik „3” wyżej i bliżej lewej krawędzi, widoczne Szwecja i Finlandia w większej skali zamiast morza od Islandii. Dopisek w tym samym miejscu; reszta Kokpitu bez zmian.
DP-182 (awizacja) nie zmienia migawek — pokrycie testem jsdom `tests/dp-176-182.jsdom.test.ts`. Kokpitu na telefonie nie ma w migawkach smoke (kadr telefonu: margines górny na dopisek jak dotąd — test jsdom). Wzorca `shots-baseline` nie zmieniano.

## DP-191 (03.11.2026) — bez dopisku „Trasa orientacyjna (HERE…)” na mapach
Z workflowu `visual` (`update=true`, gałąź `wyglad/dp-191-bez-dopisku-here`, przebieg 41599495465, commit `2007ee2`, artefakt `visual-artifacts`). Pozostałe 21 migawek w artefakcie jest identycznych co do bajtu (karta GDN-NYN, Ryzyka, Drogi bałtyckie, pogoda, Rejsy, pasek promu, stany).
Przyczyna: polecenie właściciela 03.11 08:46 — usunąć z map dymek „Trasa orientacyjna (HERE, bez wymiarów ładunku) — nie zastępuje trasy z zezwolenia.” (Mapa, Kokpit, Przegląd karty transportu).
- `mapa-hhl-pl-1920-{light,dark-default}.png`: bez dopisku u góry z prawej; trasy, warstwy, znaczniki i tabela bez zmian.
- `kokpit-hhl-pl-1920-{light,dark-default}.png`: mini-mapa bez dopisku; kadr całej sieci z marginesem 12 px (DP-176) bez marginesu na dopisek — sieć na środku mini-mapy, przybliżenie jak na Mapie; reszta Kokpitu bez zmian.
- `mapa-baltyk-hhl-pl-{1440,390}-light.png`: bez dopisku (na telefonie pas pod „Warstwy” wolny).
- `karta-tll-hel-hhl-pl-{1440,390}-light.png`: Przegląd karty — pole na dole mapy bez linii z dopiskiem.
Wzorca `shots-baseline` nie zmieniano.

## DP-189 (03.11.2026) — Ryzyka › Drogi LT/LV/EE/FI zawsze (jak SE)
Bez odświeżenia migawek: `drogi-baltyckie-*` już pokazują 4 sekcje w demo (trasa TLL–HEL). Zmiana behawioru bez transportu bałtyckiego — jsdom `tests/bn9-c4-roads.jsdom.test.ts` (DP-189).

## Pakiet DP-A (03.11.2026) — mapy: linie demo PL-GDY i SE-KAA-INLAND, tor Gdynia–Karlskrona, znaczniki
Odświeżone tylko `tests/__screenshots__/mapa-hhl-pl-1920-{light,dark-default}.png` i `mapa-baltyk-hhl-pl-1440-light.png`, z workflowu `visual` (`update=true`, gałąź `wyglad/pakiet-dp-a`,
przebieg 41608489947, commit `39e201e`, artefakt `visual-artifacts`). Pozostałe 26 migawek w artefakcie jest identycznych co do bajtu (Kokpit 1920 też — różnice w mini-mapie w tolerancji).
Przyczyna: DP-72 — w demo osobne linie Śrem–Gdynia (PL-GDY, Obwodnica Trójmiasta) i śródlądowa Karlskrona–Boden (SE-KAA-INLAND: Emmaboda – Linköping – Norrköping – Västerås – Gävle → E4), jak legi w produkcji; DP-71 — SE-KAA z Karlskrony przez Lyckeby, Jämjö i Brömsebro (bez prostej przez ląd); DP-78 — tor Gdynia–Karlskrona dochodzi do Karlskrony od południa (bez poziomego odcinka nad szkierami); DP-77 — znaczniki miejsc przy przybliżeniu < 5,5 mniejsze (na migawkach przykryte znacznikami transportów).
- `mapa-hhl-pl-1920-{light,dark-default}.png`: nowa pomarańczowa linia przez środek Szwecji (Karlskrona – Linköping – Västerås – Gävle), linia E22 z Karlskrony wzdłuż wybrzeża; koniec toru przy Karlskronie od południa. Kadr, tory bałtyckie, znaczniki i tabela bez zmian.
- `mapa-baltyk-hhl-pl-1440-light.png`: to samo w kadrze Mapy 1440.
DP-113: jasna migawka Mapy jest teraz zapisana od nowa, więc pokazuje bieżący kolor torów `#3A82BA` (DP-76 r2 — wcześniej różnica koloru mieściła się w tolerancji i wzorzec został ze starym kolorem). Wzorca `shots-baseline` nie zmieniano.

## Pakiet DP-C (03.11.2026) — DP-67: okno Awizacja z rejsem przed planowanym załadunkiem (DP-48)
Z workflowu `visual` (`update=true`, gałąź `wyglad/pakiet-dp-c`, przebieg 41626626647, commit `2575c64`, artefakt `visual-artifacts`). Pozostałe 29 migawek w artefakcie jest identycznych co do bajtu (Kokpit 1920 jasny i ciemny — zegar demo DP-79 przy `?now=2026-09-23T14:32:00Z` daje tę samą datę „dziś 23.09.2026”; Mapa, karty, Ryzyka, Drogi bałtyckie, pogoda, Rejsy, pasek promu, stany).
- `awizacja-rejs-przed-zaladunkiem-hhl-pl-1440-light.png` (nowa, 560×960): Administrator HHL, SG-11 (Zaplanowany, załadunek 07.10.2026), w polu „Rejs promem” pierwszy rejs z dopiskiem „przed planowanym załadunkiem” (GDN → NYN · Nova Star · 23.09.2026); w zamkniętym polu dopisek ucięty, pod polem osobna linia „Wybrany rejs odpływa przed planowanym załadunkiem.”, niżej „Rejs można dodać później…”.
- `awizacja-rejs-przed-zaladunkiem-hhl-pl-390-light.png` (nowa, 390×3400): to samo na telefonie — pola w jednej kolumnie, linia DP-48 pod polem „Rejs promem”; okno pełnoekranowe (wysokość okna testu 3400 px, dół pusty).
Uwaga do wyglądu (bez zmiany w tym pakiecie): na 1440 pole „Armator” w siatce `.am-2` rozciąga się na wysokość kolumny rejsu (dwie linie podpowiedzi) — wysokie pole wyboru.
Wzorca `shots-baseline` nie zmieniano.

## DP-196 (03.11.2026) — awizacja: pole „Armator” wyrównane do góry (1440)
Z workflowu `visual` (`update=true`, gałąź `wyglad/dp-196-awizacja-armator`, przebieg 41697051075, commit `cc821f0`, artefakt `visual-artifacts`). Pozostałe 30 migawek w artefakcie jest identycznych co do bajtu (także `awizacja-rejs-przed-zaladunkiem-hhl-pl-390-light.png` — na telefonie `.am-2` ma jedną kolumnę, więc wyrównanie nic nie zmienia; Kokpit, Mapa, karty, Ryzyka, Drogi bałtyckie, pogoda, Rejsy, pasek promu, stany).
Przyczyna: uwaga z Pakietu DP-C — siatka `.am-2` rozciągała pola na wysokość wiersza, więc „Armator” dostawał wysokość kolumny „Rejs promem” (pole + dwie linie podpowiedzi). Teraz `align-items: start` na `.am-2` (`src/components/drawer/p7.css`); `.am-lock` zostaje `align-self: end`.
- `awizacja-rejs-przed-zaladunkiem-hhl-pl-1440-light.png` (560×960, bez zmiany rozmiaru): pole „Armator” (Polferries) ma zwykłą wysokość i stoi w jednej linii z polem „Rejs promem”; pod nim pusto, podpowiedzi rejsu („Wybrany rejs odpływa przed planowanym załadunkiem.”, „Rejs można dodać później…”) bez zmian w prawej kolumnie. Reszta okna bez zmian.
Wzorca `shots-baseline` nie zmieniano.

## DP-215 (04.11.2026) — E28 / StageBar: neutralne nazwy etapów
Odświeżone `tests/__screenshots__/kokpit-hhl-pl-1920-{light,dark-default}.png` z artefaktów `visual-artifacts` po failach zrzutów (light: 41906263605; dark: 41915265123 @ `3ef8c0d0`, gałąź `pakiet/c2-dp-215-neutral-stage-names`). Telefon i bramy zielone bez zmian migawek.
Przyczyna: DP-215 (#798) — kafelki paska E28: Droga do portu / Port wyjścia / Port docelowy / Droga do placu (zamiast Droga PL / Port PL / Port SE / Droga SE). Light 399 px, dark 366 px (ratio 0,01) w pasku statusów u góry Kokpitu. Statusy Polferries/Stena (Port wypłynięcia/przypłynięcia) — poza tymi 15 migawkami (brak osobnego failu zrzutów statusów).
Wzorca `shots-baseline` nie zmieniano.
