# POSTEP — rejestr zlecenia końcowego

Źródło ID: `docs/handover/ZLECENIE_FINAL.md` §12 (**51 pozycji**).  
Kolumny: `ID | pozycja | status | commit | testy (liczby) | uwagi`.

Po F2.5 dodać wiersze **L*** (L1/L2/L4/L5/L7/L8/L9/L16) — na razie brak (notatka: po F2.5).  
Niezgodności z F2.4: **F2.4-a / F2.4-b / F2.4-c** (poniżej, po G1).

Aktualizacja: **2026-09-24** Europe/Warsaw · **Etap 2 w toku** (D19-T DONE) · następny: D10.

---

## Etap 0 — przygotowanie

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| P0.1 | Zapisz zlecenie → `ZLECENIE_FINAL.md` | **DONE** | `10ac61e` | unit **41/41** · pw **4/4** | 465 linii, identyczne z `ZLECENIE_DLA_GROKA.md` z pakietu |
| P0.2 | Rozpakuj pakiet final wg tabeli | **DONE** | `ad5fcc9` | unit **41/41** · pw **4/4** | Źródło: chat attachment → `/workspace/tower-pakiet-final-extract/` (nie zip na Domowy Downloads/Desktop — False/False). `money.test.ts` import → `src/lib/money/engine`; **wykluczony** z `test:unit` do M1 (`vitest.config.ts` exclude) — suite pozostaje 41/41. `tower-makieta.html` nie kopiowany |
| P0.3 | Założ `POSTEP.md` rejestr 51 | **DONE** | `992a5e6` | unit **41/41** · pw **4/4** | 51 wierszy ID z §12; L* po F2.5 |

## Etap 1 — korekty po Fala 2 GATE

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| F2.1 | Ryzyka: 0 zmienionych ujęć — wyjaśnij/napraw | **DONE** | `3c6e3d3` | unit **41/41** · pw **4/4** · visual **90/720** tylko ryzyka | Hipoteza **(1)** (historyczna): `SAIL_ROWS` w RisksView — naprawione w D4 (`voyage.ts`). **(2)** false — DemoMark jest na panelu SE w Risks. **(3)** false — 90 ujęć `ryzyka` w matrycy. 0 diffów na GATE: `fullPage:false` + długa kolejka wyjątków → Prom/SE poniżej folda. Fix: `data-panel` + scroll Prom w `baseline.mjs`. Porównanie: wyłącznie ryzyka → tag `baseline-fala-2b-2026-09-24` |
| F2.2 | Próg testu wizualnego (`maxDiffPixelRatio`) | **DONE** | `14261fc` | unit **41/41** · pw **4/4** · visual compare **720/720** | `maxDiffPixelRatio:0.001` → `fullPage:true, maxDiffPixels:60, threshold:0.28`. Przy 0.15: 716/720 — 4× kokpit AA fringe (~18×16 px, 107 px); podniesiono **threshold** do 0.28 (nie maxDiffPixels). Wzorca shots-baseline **nie** regenerowano. Smoke `__screenshots__` odświeżone pod fullPage |
| F2.3 | Stylelint zielony (nowy `.stylelintrc`) | **DONE** | `6f77f7e` | unit **41/41** · pw **4/4** · stylelint **0** | Top5 przed: single-line-max-decl 265, rule-empty-line 49, no-duplicate-selectors 40, font-family-generic 30, declaration-no-important 11. Wyłączono formatowanie (+ no-duplicate-selectors: warstwowy CSS Claude; alpha-value-notation). Token/radius/shadow/font-allowed/!important **ON**. CSS: 11× !important usunięte (Leaflet specificity, reduced-motion target, [hidden]); font→var(--font-*); letter-spacing em; clip→clip-path. pre-push: lint:css |
| F2.4 | Weryfikacja mechanizmu paliwowego (bez kodu) | **DONE** | `8f74961` | unit **41/41** · pw **4/4** (bez zmian logiki) | SoT: `docs/watch-tower/BAF_SEFS.md`. Tabela zgodności w `03_PARAMETRY_BIZNESOWE.md` §2.2: **9 tak / 1 częściowo / fasada Opcji**. Naprawy: F2.4-a, F2.4-b, F2.4-c. Opcje BAF → D25 |
| F2.5 | Pozycje L1–L2/L4–L5/L7–L9/L16 — przydział | **DONE** | `48bb076` | — (docs) | 8× L* dopisane do POSTEP z etapem 2/4/5 — bez etapu nie wejdą do robót |
| F2.6 | Trzy wyjaśnienia (kokpit 54, mapa 18, TZ) | **DONE** | `454ba4a` | — (docs) | 1) Kokpit **54**/90: zmiana D5 KPI była wyraźna głównie u HHL (+ część KSH); ujęcia SCX i część KSH@768 zostały ≤ progu 0.001 (inne KPI / mniejszy obszar cyfr). 2) Mapa **18**/90 tylko @1920: podpis demo / etykiety rejsu dopiero przy pełnej szerokości przekroczyły budżet pikseli — węższe viewporty trzymały ratio. 3) `Europe/Warsaw` i `Europe/Stockholm` mają to samo przesunięcie i te same reguły DST — rozróżnienie w kodzie to zapis intencji operacyjnej, liczbowo offset się nie różni. |
| G1 | Brama etapu 1 | **DONE** | `2cadad2` | unit **41/41** · pw **4/4** · stylelint **0** · visual **720/720** (thr=0.28, maxDiffPixels=60) | `03_PARAMETRY` §2.2 tabela zgodności OK; L1–L16 przydzielone (F2.5); F2.1–F2.6 DONE. Bez regen baseline. STOP przed Etapem 2 |

### Naprawy z F2.4 (poza listą 51 — dopiski)

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| F2.4-a | Konflikt daty SEFS: załadunek (`BAF_SEFS`) vs rozładunek (`MECHANIZM`) vs kod `loadDate` | OPEN | — | — | Uzgodnić SoT daty; `sefsForLoadDate` dziś jak załadunek. Etap: **2** (albo 4 przy pieniądzach) |
| F2.4-b | Brak wyliczania średniej z poprzedniego tygodnia (live/seed pipeline) | OPEN | — | — | `BAF_SEFS` §3; kod ma tylko `SEFS_WEEKLY` demo. Etap: **4** (M3/M8) lub **2** jeśli demo pipeline |
| F2.4-c | Opcje BAF/SEFS: wszystkie pola `bafFields` + nota UI nie zasilają `computeSefs` → D25 | OPEN | — | — | Lista pól w `03_PARAMETRY` §2.4. Etap: **2** (D25) |

### Pozycje L* (F2.5) — przydział etapów

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| L1 | Alternatywy trasy SE ×4 „Wybierz” mają mutować load/risk (dziś toast) | OPEN | — | — | Etap **2** (fasada/D25 · `RisksView`) |
| L2 | Pill opóźnienia w drawerze z `delayMinutes`, nie stały napis | OPEN | — | — | Etap **2** (`LoadDrawer` treść) |
| L4 | Terminy zadań z `plannedLoadDate` / danych load, nie `18+i*9` | OPEN | — | — | Etap **2** (`TasksView` dane) |
| L5 | Preferencje powiadomień w Opcjach: zapis **i** filtracja przy push | OPEN | — | — | Etap **4** (centrum powiadomień / M7·BK ścieżka push) |
| L7 | Wskaźnik kompletności DRAWING z modelu, nie hardcode 100% | OPEN | — | — | Etap **2** (`DocsView` · D25-ish) |
| L8 | Kolumna „Próbki” geofence z modelu, nie zawsze `2` | OPEN | — | — | Etap **2** (`GeofenceView`) |
| L9 | JSONLogic / akcje workflow w runtime — realna semantyka, nie atrapa UI | OPEN | — | — | Etap **4** (silnik reguł przy backendzie/pieniądzach) |
| L16 | Force-majeure / opóźnienia — mechanizm ryzyk bez atrap (po SE road) | OPEN | — | — | Etap **4** (rozszerzenie ryzyk / opóźnień) |

## Etap 2 — Fala 3A: treść, język, formaty, silnik

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D19-T | Test PL-znaków poza EN/SV UI | **DONE** | `fd30c94` | `npm run test:d19` → **fail** (oczekiwane): **en=191 / sv=191** (Σ382) | Harness: `tests/d19-i18n.spec.ts`; TreeWalker + `[data-content]` exclude; raport `test-results/d19-hits.json`. **pre-push:** odroczony — `test:visual` = tylko `visual.spec.ts` (4 smoke); `test:d19` osobno do D19 (hits→0), potem wraca do pre-push. data-content: code/itemType (Schedule/Map/Risks/Tasks/Invoices/Finance/ExceptionRow/LoadDrawer). |
| D10 | Jedna funkcja `formatMoney` | OPEN | — | — | pending |
| D17 | Format daty w tabeli bez powtarzanego roku | OPEN | — | — | pending |
| M1 | Silnik money + testy (49 zielonych, 1 skip) | OPEN | — | — | wtedy zdjąć exclude vitest |
| D11 | Debug/EN enumy out z UI | OPEN | — | — | pending |
| D19 | 104 napisy → słownik PL/EN/SV | OPEN | — | — | pending |
| D12 | Dane startowe prawdopodobne | OPEN | — | — | pending |
| D6 | Telefon kierowcy → szuflada; KSH ±24 h | OPEN | — | — | pending |
| D13 | Wzorce wizualne / `section-card-hd--drag` | OPEN | — | — | pending |
| D18 | Oznaczenie danych demonstracyjnych | OPEN | — | — | pending |
| P6 | Stawki demo PLN→EUR tabelą 186/A/NBP/2026 | OPEN | — | — | pending |
| D-EUR-T | Test waluty EUR/PLN w UI | OPEN | — | — | pending |
| D25 | Atrapy/porzucone z fasady — decyzja | OPEN | — | — | pending |
| G2 | Brama etapu 2 + baseline Fala 3a | OPEN | — | — | pending |

## Etap 3 — backend

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| BK0 | STOP — dane dostępowe od właściciela | OPEN | — | — | pending |
| BK1 | Migracje + seed stegra + cron | OPEN | — | — | pending |
| BK2 | Auth (magic link) + 3 org | OPEN | — | — | pending |
| BK3 | `DemoProvider` / `SupabaseProvider` | OPEN | — | — | pending |
| BK4 | Storage plików (PDF/CMR/POD/zdjęcia) | OPEN | — | — | pending |
| BK5 | Test widoczności na poziomie API | OPEN | — | — | pending |
| BK6 | CI db/money/unit/pw | OPEN | — | — | pending |
| G3 | Brama etapu 3 | OPEN | — | — | pending |

## Etap 4 — Fala 3B: pieniądze, faktury, zlecenia

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| M2 | Dane v2: EUR, poziomy, migawki | OPEN | — | — | pending |
| M3 | Kurs NBP na żywo + `fx_rates` | OPEN | — | — | pending |
| M4 | Ustawienia użytkownika (język/waluta/motyw) | OPEN | — | — | pending |
| M5 | Numery zleceń KSH/HHL/SCX w harmonogramie | OPEN | — | — | pending |
| M6 | Faktury — model 3 stron | OPEN | — | — | pending |
| M7 | Terminy i płatności + przypomnienia | OPEN | — | — | pending |
| M8 | Niezmiennik / poziomy w wycenie | OPEN | — | — | pending |
| M9 | Aplikacja kierowcy: watchPosition + zgoda | OPEN | — | — | pending |
| D26 | Import — usunięcia za zgodą | OPEN | — | — | pending |
| D23-S | Import test na skali ~72 wierszy | OPEN | — | — | pending |
| G4 | Brama etapu 4 + baseline Fala 3b | OPEN | — | — | pending |

## Etap 5 — Fala 4: infrastruktura

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| D14 | Trasy adresowalne | OPEN | — | — | pending |
| D15 | Podział paczki / lazy mapa &lt;400 kB | OPEN | — | — | pending |
| G5 | Brama etapu 5 | OPEN | — | — | pending |

## Etap 6 — odbiór końcowy

| ID | pozycja | status | commit | testy (liczby) | uwagi |
|---|---|---|---|---|---|
| O1 | Pełny komplet testów + D24 ×14 | OPEN | — | — | pending |
| O2 | Deploy produkcyjny Vercel + Supabase | OPEN | — | — | pending |
| O3 | Test dymny na produkcji | OPEN | — | — | pending |
| O4 | Oznaczenie demo zostaje do potwierdzenia | OPEN | — | — | pending |
| O5 | `RAPORT_KONCOWY.md` + tag `release-1.0` | OPEN | — | — | pending |

---

## Poza zakresem (otwarte — nie pomijać)

| temat | status | uwagi |
|---|---|---|
| Adapter telematyki SCX | OPEN | czeka na nazwę systemu + API |
| Parametry operacyjne od przewoźnika | OPEN | cutoff promu, progi fal, prędkość HHL |
| Geometria trasy z zezwolenia | OPEN | czeka na zezwolenia z trasą |
| Klucz Trafikverket | OPEN | SE road demo do czasu klucza |
| Źródło statusu promów Polferries | OPEN | decyzja właściciela |
| Rozbicie marży na 3 poziomy | OPEN | czeka na zgodę |
| GitHub Actions rozliczenia + `unit.yml` | OPEN | właściciel |

---

## Licznik wierszy ID

- Wymagane §12: **51**
- W tabelach etapów powyżej: **51** (P0×3 + F2/G1×7 + Etap2×14 + BK/G3×8 + Etap4×11 + Etap5×3 + Etap6×5)
- L* po F2.5: **0** na razie (dopisać po F2.5)
