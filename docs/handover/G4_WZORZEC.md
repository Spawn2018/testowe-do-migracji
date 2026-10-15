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

## wyglad/P4-a (14.10.2026) — E28 pasek etapów, E27 Mapa, L7 oznaczenia

Odświeżone 15 migawek Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38500750044, gałąź `wyglad/P4`, commit `fe090d0`). Wszystkie ekrany: pod paskiem górnym pasek 10 kafelków z liczbą w grupach Przygotowanie · W trasie · Po dostawie (zamiast 9 kafelków bez cyfr). Harmonogram: filtry stanu Opóźnione N · Bez dokumentów · Bez kierowcy · Bez ciągnika i licznik „N z M” (bez przycisków etapów). Mapa: chipy W trasie · Opóźnione · Brak GPS, oznaczenia obok statusu, „Najbliższe włączenia śledzenia”. Matrycy 280 ujęć nie ruszano.

## wyglad/P3-c (14.10.2026) — E11, E12 Opcje i Ustawienia (E37, E6 Moje konto)

`visual.yml` z `update=true` po rebase na `main` `cb14008` (run 38504703136, gałąź `wyglad/P3-c`, commit `61fbfd2`) i po poprawkach z niezależnego sprawdzenia (run 38514652438, commit `26716b6`): 15 migawek Playwright identycznych bajt w bajt z `tests/__screenshots__/` — nic nie podmieniono. Migawki nie obejmują Opcji ani Ustawień; ekrany P3-c sprawdza brama E8 (blok „wyglad/P3-c”, 360/390/430 px) i dowód `docs/handover/odbior/P3/wyglad-P3-c/`. Matrycy 280 ujęć nie ruszano.

## P4 (14.10.2026) — E25 statusy, stan-zablokowany (nodocs)

Odświeżone migawki Playwright (`tests/__screenshots__/`) z przebiegu `visual.yml` `update=true` (run 38503841814, gałąź `pakiet/P4-statusy-sledzenie`, commit `26d8b9c5`). Ekrany: Harmonogram — filtr „Bez dokumentów” przez `[data-quick="nodocs"]` (E25 / D-20261014-0315-01 H2.4) zamiast `.chipbtn`).nth(3). Matrycy 280 ujęć nie ruszano.

## AUD-03 (06.10.2026) — Harmonogram KSH bez „Zmień ciągnik”

Zamierzona zmiana UI (polecenie AUD-03: „Zmień ciągnik” niewidoczny dla roli KSH; baza i tak odmawia — `tests/db/aud03.sh`). gate:visual na `b52dcc5`: 274/280, zmienione wyłącznie `harmonogram__ksh__pl__{1280,1440,1920}__{dark,light-default}` (6). Odświeżono te 6 ujęć z przebiegu bramy (kolejność pełnej matrycy). Innych ujęć nie ruszano.
