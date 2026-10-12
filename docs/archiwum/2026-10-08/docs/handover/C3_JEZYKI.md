# C3 — Kompletność trzech języków (PL / EN / SV)

> Notatka robocza Etap C · wyłącznie C3 · **bez zmian w kodzie produktu**.  
> Data audytu: **2026-09-23** Europe/Warsaw (UTC+2).  
> App: `/workspace/watch-tower-app` · źródło słownika: `src/i18n/messages.ts` (jeden plik; brak osobnych JSON/YAML).  
> Metoda: parsowanie literałów `pl` / `en` / `sv`, `rg` po `t(` / `navLabel` / `docStatusLabel` / `severityLabel`, skan JSX/`label=`/`placeholder=`/`aria-label=`/`pushToast(` pod kątem literałów PL.

---

## 1. Architektura i18n (fakt)

| Fakt | Wartość |
|---|---|
| Plik | `src/i18n/messages.ts` |
| API | `t(locale, key)`, `navLabel`, `docStatusLabel`, `severityLabel` |
| Fallback w `t` | `ALL[locale][key] ?? ALL.en[key] ?? key` |
| Składanie słowników | `en = { ...pl, …nadpisania }`, `sv = { ...en, …nadpisania }` |
| `useTranslation` / react-i18next | **brak** — własny helper |

Wniosek: **liczba kluczy efektywnych jest wspólna**, bo EN/SV dziedziczą PL/EN przez spread. „Brak klucza” ≠ „brak tłumaczenia”: klucz może istnieć, a wartość nadal być polska (albo angielska w SV).

---

## 2. Liczby kluczy

| Zbiór | Liczba | Uwagi |
|---|---:|---|
| **PL** (explicite w `const pl`) | **124** | kanoniczna lista kluczy |
| **EN own** (klucze zapisane w literale `en`, bez `...pl`) | **122** | nadpisania + pełne tłumaczenia |
| **SV own** (klucze w literale `sv`, bez `...en`) | **113** | nadpisania szwedzkie |
| **EN efektywne** (`...pl` ∪ own) | **124** | = PL |
| **SV efektywne** (`...en` ∪ own) | **124** | = PL |
| Unia wszystkich kluczy | **124** | brak kluczy EN/SV-only |

Pełna lista PL (124):  
`accept, actualline, age, brand, cancel, clock, close, commit, cost, disabled, dispute, doc_EXPIRED, doc_MISMATCH, doc_MISSING, doc_UPLOADED, docs, driver, dry_run, enabled, eta, exceptions, factoring_admin_hint, factoring_admin_title, factoring_badge, factoring_delay, factoring_enabled, factoring_fee, factoring_fee_pct, factoring_gross, factoring_label, factoring_net, factoring_notes, factoring_option, factoring_option_hint, factoring_payment_mode, factoring_payout_eta, factoring_payout_scheduled, factoring_payout_status, factoring_preview, factoring_review_title, factoring_standard, factoring_standard_hint, factoring_unit_days, factoring_unit_hours, ferry_status, focus, import_drop, import_xlsx, inv_list_title, inv_unavailable, inv_wizard_title, lang, layers, loading_site, map_ais_live, map_events, margin, mark_all_read, mark_read, milestone_ferry, milestone_loaded, milestone_problem, milestone_unloaded, nav_dash, nav_docs, nav_fin, nav_fin_ksh, nav_fin_scx, nav_geo, nav_inv, nav_map, nav_options, nav_risk, nav_sched, nav_tasks, nav_wf, next_action, no_notifications, no_price, notifications, open, open_count, owner, plan_b, planline, plate, progress, progress_weeks, project, q_none, revenue, role, run_now, save, search, sev_CRITICAL, sev_HIGH, sev_LOW, sev_MEDIUM, share_pos, stage_APPROACH, stage_DELIVERED, stage_FERRY, stage_GDANSK, stage_LOADING, stage_PLAN, stage_SE_ROAD, stage_SITE, stage_TO_PORT, status, submit, tab_awizacja, tab_chat, tab_docs, tab_eta, tab_ferry, tab_overview, tab_pricing, tab_resources, tab_timeline, theme, today_mark, unload_site, upload`

---

## 3. Klucze PL „brakujące” w EN / SV

### 3.1 Brak klucza w efektywnych słownikach

**0.** Dzięki `...pl` / `...en` każdy klucz PL istnieje w EN i SV.  
`rg` / parser: żaden klucz PL nie wypada z `ALL.en` / `ALL.sv`.

### 3.2 Brak własnego tłumaczenia (ważniejsze)

| Problem | Klucze | Skutek |
|---|---|---|
| PL → EN **bez nadpisania** (wartość zostaje polska w locale `en`) | **`brand`**, **`clock`** (2) | UI EN pokazuje `TOWER` / `EU` — OK semantycznie (marki/kody), ale formalnie nieprzetłumaczone |
| Efektywne EN → SV **bez nadpisania**, wartość nadal **angielska** | **`age`, `cancel`, `close`, `eta`, `open`, `project`, `save`, `status`, `tab_eta`** (9) | locale `sv` pokazuje EN dla tych etykiet |
| Efektywne EN → SV **bez nadpisania**, wartość nadal **polska** | **`brand`, `clock`** (2) | jak wyżej — dziedziczone z PL przez EN |

**Podsumowanie luk tłumaczeniowych (nie luk kluczy):** 2 nieprzetłumaczone w EN; **11** bez własnego wpisu SV (9 EN + 2 PL).

---

## 4. Klucze nieużywane w `src` (poza `messages.ts`)

Skan referencji: `t(locale, '…')`, `t(locale, \`prefix${…}\`)`, `navLabel` → `nav_*`, dynamiczne `stage_*` / `milestone_*`.  
Pominięto sam katalog `src/i18n`.

| Metryka | Liczba |
|---|---:|
| Klucze **używane** | **77** |
| Klucze **nieużywane** | **47** |

**Nieużywane (47):**  
`accept, age, clock, disabled, dispute, doc_EXPIRED, doc_MISMATCH, doc_MISSING, doc_UPLOADED, docs, driver, enabled, factoring_notes, factoring_payout_eta, factoring_payout_scheduled, factoring_payout_status, factoring_preview, ferry_status, focus, import_xlsx, inv_list_title, inv_wizard_title, lang, layers, loading_site, map_events, next_action, open, open_count, owner, plan_b, plate, project, run_now, save, sev_CRITICAL, sev_HIGH, sev_LOW, sev_MEDIUM, status, submit, tab_awizacja, tab_eta, tab_ferry, tab_resources, unload_site, upload`

### Podział 47 nieużywanych (t120u — **nie usuwać teraz**)

Rozstrzygnięcie po zestawieniu z `UX_MAP.md` (M1–M12, E1–E4) w Etapie D. Do tego czasu klucze zostają w słowniku.

#### Kandydaci do usunięcia (martwy słownik / brak ścieżki w mapie)

`age`, `clock`, `focus`, `lang`, `layers`, `open`, `open_count`, `owner`, `project`, `status`

*(Topbar/map mają literały zamiast tych kluczy; brak modułu w UX_MAP, który by je „obiecał” jako osobne API.)*

#### Kandydaci na klucze przyszłych funkcji (M1–M12 / E1–E4 / drawer)

| Klucze | Mapowanie (UX_MAP) |
|---|---|
| `doc_EXPIRED`, `doc_MISMATCH`, `doc_MISSING`, `doc_UPLOADED`, `docs`, `upload` | **M5/M6 dokumenty** + E2 PERIOD/TRIP/REGULATION — podpiąć `docStatusLabel` |
| `sev_CRITICAL`, `sev_HIGH`, `sev_MEDIUM`, `sev_LOW` | **M10 ryzyka** — podpiąć `severityLabel` zamiast hardcode |
| `tab_awizacja`, `tab_resources`, `tab_ferry`, `tab_eta` | **M12 ETA** + P4 zasoby/awizacja + drawer elite — zakładki już w słowniku |
| `factoring_notes`, `factoring_preview`, `factoring_payout_eta`, `factoring_payout_scheduled`, `factoring_payout_status` | **M11 + E3 factoring** |
| `inv_list_title`, `inv_wizard_title`, `accept`, `dispute`, `submit` | **M11 faktura zbiorcza** (kreator / spór) |
| `import_xlsx`, `driver`, `plate`, `loading_site`, `unload_site` | Harmonogram / mapa / P4 zasoby |
| `ferry_status`, `map_events`, `plan_b`, `next_action`, `run_now`, `enabled`, `disabled`, `save` | **M10** Plan B · **M8/M9** automatyzacje · mapa AIS |

### Uwagi do nieużywanych (audyt C3 — bez zmian merytorycznych)

1. **`doc_*` i `sev_*`:** helpery `docStatusLabel` / `severityLabel` są **zdefiniowane** w `messages.ts`, ale **nigdzie nie importowane** poza tym plikiem → słownik statusów dokumentów / severity jest martwy; UI i tak hardcoduje polskie etykiety (np. `StatusPill`).
2. **`lang`, `clock`, `project`:** Topbar **nie** woła `t(locale, 'lang')` — ma literał `aria-label="Język"`; `project` nie jest renderowany z i18n.
3. **`tab_awizacja`, `tab_ferry`, `tab_resources`, `tab_eta`:** w słowniku są, ale `LoadDrawer` montuje tylko `overview | timeline | docs | pricing | chat` — zakładki awizacja/prom/zasoby/ETA w drawerze są osobnymi sekcjami z **hardcoded** polskim copy, nie kluczami `tab_*`.
4. **`docs`, `driver`, `plate`, `status`, `layers`, `focus`:** odpowiedniki UI istnieją jako literały w `MapView` / tabelach zamiast `t(...)`.
5. Część kluczy factoring (`factoring_notes`, `factoring_preview`, `factoring_payout_*`) wygląda na przygotowane pod UI, którego nie podpięto.


---

## 5. Hardcoded UI (najważniejsze) — literały zamiast i18n

### 5.1 Skala (dowód `rg`)

| Sygnał | Wynik |
|---|---|
| Linie w `src/views` + `src/components` z cudzysłowem zawierającym polskie znaki diakrytyczne | **~104** (`rg '[ąćęłńóśźż…]'`) |
| Szerszy skan kandydatów UI (atrybuty `label=` / JSX / toasty z PL) | **~180+** wystąpień w ~23 plikach |
| `pushToast('…')` z polskim tekstem (views + store) | **≥21** wywołań (w tym ≥7 z diakrytykami) |
| Widoki/komponenty z największą gęstością PL | `LoadDrawer`, `OptionsView`, `DashboardView`, `FinanceView`, `ScheduleView`, `WorkflowsView`, `DocsView`, `StatusPill`, `RisksView`, `MapView` |

**Skutek produktowy:** przełączenie locale na `en` / `sv` tłumaczy chrome (nav, część drawer tabs, factoring admin, spine stages), ale **większość treści ekranów zostaje po polsku**. To nie zgłasza się jako missing key — cicho psuje EN/SV.

### 5.2 Sample `plik:linia` (dowód `rg` / odczyt)

#### Shell / globalne

| Plik:linia | Literał | Zamiast |
|---|---|---|
| `src/components/shell/Topbar.tsx:109` | `aria-label="Język"` | `t(locale, 'lang')` (klucz **jest**, nieużywany) |
| `src/components/shell/Topbar.tsx:131` | `aria-label="Skróty klawiszowe"` | brak klucza |
| `src/components/shell/KeyboardHelp.tsx:29` | `aria-label="Skróty"` | brak klucza |
| `src/components/shell/CorridorSpine.tsx:46` | `'Kliknij ponownie, aby wyczyścić filtr'` | brak klucza (obok `t(…, stage_*)`) |

#### Statusy — osobny słownik PL poza i18n

| Plik:linia | Literał |
|---|---|
| `src/components/ui/StatusPill.tsx:9` | `PLANNED: 'Planowany'` |
| `src/components/ui/StatusPill.tsx:11` | `DOC_MISSING: 'Brak dokumentów'` |
| `src/components/ui/StatusPill.tsx:13–19` | `Załadunek`, `W drodze PL`, `Port Gdańsk`, `Na promie`, … |
| `src/components/ui/StatusPill.tsx:24–32` | mapowanie `BY_STAGE` po polsku |

Używane m.in. z `ScheduleView`, `MapView`, `LoadDrawer` → **każdy** locale widzi polskie statusy.

#### Kokpit (KPI)

| Plik:linia | Literał |
|---|---|
| `src/views/DashboardView.tsx:93` | `label="Elementy dostarczone"` |
| `src/views/DashboardView.tsx:99` | `label="Tonaż na placu"` |
| `src/views/DashboardView.tsx:108` | `label="Najbliższa dostawa"` |
| `src/views/DashboardView.tsx:116` | `label="Transporty w drodze"` |
| `src/views/DashboardView.tsx:122` | `label="Terminowość"` |
| `src/views/DashboardView.tsx:161` | `label="Przychód tygodnia"` |
| `src/views/DashboardView.tsx:172` | `label="Ryzyko promowe"` |
| `src/views/DashboardView.tsx:211` | `label="Marża narastająco"` |
| (+ alerty ~56–70) | np. `Rejs 24.09 zagrożony.`, `Dostawa 26.09…`, `7 pól bez uzupełnienia.` |

#### Mapa

| Plik:linia | Literał |
|---|---|
| `src/views/MapView.tsx:12` | `label: 'Pojazdy'` |
| `src/views/MapView.tsx:13` | `label: 'Strefy'` (klucz `nav_geo` / `layers` nieużyty tu) |
| `src/views/MapView.tsx:16` | `label: 'Ślad'` |
| `src/views/MapView.tsx:23–24` | `Ładunek`, `Kierowca` |
| `src/views/MapView.tsx:262` | `'Spóźnione' : 'Terminowe'` |

#### Harmonogram

| Plik:linia | Literał |
|---|---|
| `src/views/ScheduleView.tsx:177` | `label: 'Opóźnione'` |
| `src/views/ScheduleView.tsx:178` | `label: 'Bez dokumentów'` |
| `src/views/ScheduleView.tsx:238` | `'Zapisano' : 'Zapisz widok'` |
| `src/views/ScheduleView.tsx:315` | `'Odczyt XLSX…'` (obok `t(…, 'import_drop')`) |
| `src/views/ScheduleView.tsx:153/168/235` | toasty PL: `Akceptowane: .xlsx`, `Nie udało się odczytać XLSX`, `Widok kolumn zapisany` |

#### Automatyzacje / Opcje / Dokumenty / Faktury / Finanse / Drawer

| Plik:linia | Literał |
|---|---|
| `src/views/WorkflowsView.tsx:48` | `Nowa reguła` |
| `src/views/WorkflowsView.tsx:71` | `Zapisz regułę` / `Anuluj` |
| `src/views/WorkflowsView.tsx:6–10` | etykiety triggerów: `Wjazd w strefę`, `Brak pozycji`, `Rozładunek`, … |
| `src/views/OptionsView.tsx:71` | `Opcje są dostępne tylko dla HHL.` |
| `src/views/OptionsView.tsx:87` | `<h1>Opcje</h1>` (+ cały formularz BAF/preferencje PL) |
| `src/views/OptionsView.tsx:115` | `Preferencje interfejsu` |
| `src/views/OptionsView.tsx:7–17` | etykiety pól BAF: `Źródło indeksu`, `Cena bieżąca`, … |
| `src/views/DocsView.tsx:11–17` | kategorie docs PL (`Zezwolenie PL`, `Zdjęcia mocowania`, …) |
| `src/views/InvoicesView.tsx:115` | `Do wyjaśnienia` |
| `src/views/FinanceView.tsx` | sekcje `Należność narastająco`, `Od przychodu do marży`, nagłówki tabel `Przychód`/`Koszt`/`Marża` (duplikują klucze `revenue`/`cost`/`margin`, ale bez `t`) |
| `src/components/drawer/LoadDrawer.tsx:157+` | `Tydzień dostawy`, `Miejsce załadunku`, `Montaż`, zasoby `Kierowca`/`Ciągnik`, awizacja `tak`/`nie`, chat placeholder `Napisz do pozostałych stron…` |

#### Store (toasty poza React)

Przykłady `src/store/useTowerStore.ts`: `Zasoby zapisane`, `Awizacja zapisana`, `Zezwolenie nie pasuje do wymiarów — READY zablokowane`, `Oferta factoringu zaktualizowana`, `Geolokalizacja niedostępna…`, `Brak opcji Plan B…` — wszystkie **PL**, niezależne od `locale`.

### 5.3 Co *jest* podpięte pod i18n (dla kontrastu)

Działa `t` / `navLabel` m.in. w: `Topbar` (brand, role, theme), `Nav`, `NotificationBell`, tytuły widoków przez `nav_*`, spine `stage_*`, Driver PWA `milestone_*` + `share_pos`, część `LoadDrawer` tabs (`tab_overview`…), factoring admin w `InvoicesView`, `import_drop` / `dry_run` / `commit` / `cancel` / `close` / `search` w Schedule, `exceptions` / `progress` na Dashboard.

To **minority** UI surface względem hardcode’ów.

---

## 6. Werdykt C3 (jedno zdanie + liczby)

Słownik ma **124** klucze i **formalną parity PL=EN=SV** przez spread, ale **47/124 (~38%) kluczy jest martwych**, **9+2 etykiet SV/EN bez własnego tłumaczenia**, a **prawdziwa luka to hardcoded PL w komponentach (~100+ linii z diakrytykami, StatusPill, KPI Dashboard, Options, Workflows, toasty store)** — locale EN/SV nie przełącza większości ekranu.

Naprawy = **Etap D** (nie ten dokument).

---

## 7. Blok do wklejenia później → `01_HANDOVER` / `07_ZNANE_BLEDY`

> Parent: skopiuj poniższą sekcję do docelowych plików dziesiątki handoveru.

### → fragment pod `01_HANDOVER.md` (architektura i18n)

```markdown
## i18n (stan 2026-09-23)

- Jedyny moduł: `src/i18n/messages.ts` — `t(locale, key)`, `navLabel`, martwe `docStatusLabel` / `severityLabel`.
- Locale: `pl` | `en` | `sv`. EN = `{...pl,…}`, SV = `{...en,…}`. Fallback: locale → en → key.
- **124** klucze we wszystkich locale (efektywnie). EN own 122, SV own 113.
- Brak luk kluczy; luki tłumaczeń: EN bez override `brand`,`clock`; SV bez override `age,cancel,close,eta,open,project,save,status,tab_eta` (+ brand/clock z PL).
- **77** kluczy referencjonowanych w `src`; **47** nieużywanych (w tym cały `doc_*`/`sev_*` mimo helperów).
- UI w dużej części **hardcoded PL** (StatusPill, Dashboard KPI, Options, Workflows, Map layers, Finance, LoadDrawer sekcje, toasty w store) — przełączenie języka nie pokrywa tych powierzchni.
- Szczegóły i listy: `docs/handover/C3_JEZYKI.md`.
```

### → fragment pod `07_ZNANE_BLEDY.md` (znane braki językowe)

```markdown
## C3 — Kompletność języków (znane braki)

| ID | Problem | Dowód | Wpływ | Etap naprawy |
|---|---|---|---|---|
| C3-01 | Hardcoded PL w komponentach zamiast `t()` | m.in. `StatusPill.tsx:9–32`, `DashboardView.tsx:93+`, `Topbar.tsx:109`, `OptionsView.tsx:71+`, `WorkflowsView.tsx:48`, `MapView.tsx:12–16` | EN/SV cicho zepsute | D |
| C3-02 | 47 martwych kluczy w słowniku | lista w `C3_JEZYKI.md` §4 | fałszywe poczucie kompletności | D (cleanup lub podpięcie) |
| C3-03 | `docStatusLabel` / `severityLabel` nigdy nie wołane | tylko definicje w `messages.ts` | statusy docs/severity nie i18n | D |
| C3-04 | SV dziedziczy 9 etykiet EN + 2 PL | brak own: age,cancel,close,eta,open,project,save,status,tab_eta,brand,clock | niespójny SV | D |
| C3-05 | Toasty PL w `useTowerStore` niezależne od locale | `pushToast('…')` ×21+ | powiadomienia zawsze PL | D |
| C3-06 | Zakładki drawer `tab_awizacja/ferry/resources/eta` w dict, nie w UI tabs | LoadDrawer tabs = 5 bez tych id | dead keys + hardcoded sekcje | D |

**Priorytet:** C3-01 (hardcode) ≫ C3-05 ≫ C3-04 ≫ C3-02/03/06.
```

---

## 8. Metadane audytu

| Pole | Wartość |
|---|---|
| Zakres | **tylko C3** — nie C1/C2/C4… |
| Zmiany w `src/**` produktu | **brak** |
| Commit | **nie robiony** |
| Plik wynikowy | `docs/handover/C3_JEZYKI.md` |
