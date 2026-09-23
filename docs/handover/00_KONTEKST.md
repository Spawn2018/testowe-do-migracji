# ETAP A — Knowledge handover · Watch Tower / TOWER · `00_KONTEKST`

## Meta

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw (UTC+2) · backfill A6–A8 + Etap B ~21:25 CEST |
| Baseline Git | commit **`305da3e`** · tag annotated **`baseline-2026-09-23`** (`baseline: wersja wdrożona 23.09.2026, wygląd zamrożony`) |
| App path | `/workspace/watch-tower-app` |
| Design / research SoT (poza app) | `/workspace/watch-tower/` |
| Preview lokalny | `http://127.0.0.1:4177/` |
| Vercel URL | **https://watch-tower-makieta.vercel.app/** (projekt `watch-tower-makieta`; potwierdzone w `docs/qa-start/batch-pm/VISUAL.md`) |
| Cloudflare quick tunnel (ephemeral) | `https://loaded-borders-leads-mba.trycloudflare.com` (`PUBLIC_ACCESS.md` / `PUBLIC_URL.txt`) — wymaga żywego `cloudflared` + preview |
| Koordynator agent_id | `8f0d9d27-789e-4b31-bed8-10c6e4900c24` („watch tower - koordynator”) |
| Ten plik | `/workspace/watch-tower-app/docs/handover/00_KONTEKST.md` |
| Prompty A6 (sampled RT + Claude) | [`00_KONTEKST_A6_PROMPTY.md`](./00_KONTEKST_A6_PROMPTY.md) · [`CURSOR_PROMPT_ZRODLOWY.md`](./CURSOR_PROMPT_ZRODLOWY.md) |
| Etap | **A backfill** (A6/A7/A8 z RT) + **B started** → [`08_MANIFEST.md`](./08_MANIFEST.md) |

### Zakres pagingu transcriptu (obowiązkowe)

| Cel | Wynik |
|---|---|
| `ReadTranscript` na rozmowie koordynatora `8f0d9d27-…` | **uruchomiony przez parenta** (koordynator); executor nie ma tool parity |
| Zakres znany (próbki) | pozycje ~**1897–1928**, ~**1879–1896**, ~**1496–1554** z ~**1941+** |
| Paging `before=` | kontynuowany wstecz przez erę popołudniowego deployu; **nie** dociągnięty do pozycji **0** w jednym przebiegu |
| Ten handover A6 | **sampled major user turns** + eksport Claude — pełny dump wszystkich user turns **nadal niekompletny** jeśli `before=0` nieosiągnięte |

**Wniosek:** A6/A7 poniżej oparte o **ReadTranscript (próbki parenta) + dokumenty w repo + eksport Claude**. Pełny chronologiczny dump do pozycji 0 = otwarta luka.

---

## A1 — Intencja i kierunek

**Źródła:** `CURSOR_PROMPT.md`, `ROZMOWA_CLAUDE.txt`, `UX_MAP.md`, `AUDIT_*`, `RESUME_STATUS.md`, `README.md`.

1. **Produkt:** TOWER / Watch Tower — multi-party **control tower** (nie TMS) dla korytarza ponadgabarytowego PL→SE: KSH Śrem (Grunwaldzka 27C) → Polferries Gdańsk → Nynäshamn → E4 → **Stegra · Stalverket 20, Boden**.
2. **Beyond Stegra Boden:** schemat ma być **wielo-projektowy** (`projects` w modelu Claude/CURSOR_PROMPT), ale **MVP/makieta** są zakotwiczone w jednym projekcie Stegra — reusable product *jako intencja architektury*, one-off *jako treść seedu*.
3. **Najpierw problemy ops:** management by exception, wspólny harmonogram zamiast Excela mailem, pozycja/geofence zamiast telefonów „gdzie auto”, dokumenty przy transporcie, rozdział koszt/przychód/marża (HHL).
4. **Core vs addon (z dokumentów):**
   - **Core makiety:** role HHL/KSH/SCX, M1–M12, seed ≥60 (faktycznie 62) loads, import XLSX, mapa korytarza, READY←cover, Plan B, factoring, SEFS, bell, spine, Driver PWA, 12 workflow, chrome Claude v2 freeze.
   - **Addon / poza MVP (CURSOR_PROMPT „POZA MVP”):** SharePoint Graph, ML ETA, AIS (później częściowo w makiecie jako seed/proxy), deck.gl replay, KSeF, e-CMR, CO₂ ISO 14083, app natywna.
5. **Stack faktyczny makiety ≠ stack docelowy Claude:** działa **Vite + React + TS + Zustand + Leaflet + HashRouter** (SPA). Docelowy plan Claude/CURSOR: Next + Supabase + MapLibre + Vercel Pro — **nie zbudowany** jako produkcja; świadomie PARTIAL w audytach.

---

## A2 — Pomysły omówione, niezbudowane / odrzucone

| Pomysł | Co | Dlaczego nie / stan | Odrzucenie finalne? |
|---|---|---|---|
| Publiczne API Polferries | Booking / rozkład API | Research: **brak publicznego API**; HTML seed / HITL (`FERRY_AIS.md`, `START_API_NOTES`, AUDIT D1) | **Tak** jako API — używamy seed HTML + AIS opcjonalnie |
| Netlify Drop jako trwały URL | Hosting drop | W docs app **nie znaleziono** wzmianki Netlify | **nie potwierdzone w docs/transkrypcie lokalnym** (lista z briefu parenta) |
| Cloudflare tunnel jako permanent | Public URL | `PUBLIC_ACCESS.md`: quick tunnel, keep-alive wymagany; ephemeral | **Tak** jako „permanent” — tylko tymczasowy dostęp |
| Redesign v3 glass / v4 Plex / anti-slop skin | Alternatywne skóry | v3 FAIL (eye Sebastiana); v4 brief istniał; potem **SoT flip → Claude 1:1** (`SOT_FLIP_*`, `VISUAL_ALIGN_CLAUDE`, `RESUME_STATUS`: no alternate Plex/v3/v4) | **Tak** względem freeze Claude v2 |
| IBM Plex jako primary | Typografia anti-slop | Nadpisane: Barlow = SoT Claude | **Tak** (Plex-as-primary FAIL) |
| Soft glass KPI / SaaS cards | Wygląd | Claude solid-first; glass tylko gęsty chrome | **Tak** jako domyślna osobowość |
| Logo / rola Stegra w chrome | Stegra jako login role / brand chip | Usunięte: tylko HHL\|KSH\|SCX; Stegra = SITE/POI (`UX_MAP`, AUDIT C15, `IDENTICAL_CLAUDE`) | **Tak** |
| Architektura Next/Supabase w makiecie | Pełny stack produkcyjny | Makieta Vite in-memory; SQL/adapters leżą w `/workspace/watch-tower/` jako materiał | **Odłożone** (nie „odrzucone na zawsze”) |
| Live klucze Trafikverket / AISStream | Live Situation + ferry AIS | Bez klucza = **seed labeled**; proxy AIS gotowy | **Częściowo** — live gdy key |
| Dwukierunkowy SharePoint↔Excel | Sync | CURSOR_PROMPT: **odrzucone**; tylko one-way SharePoint→app (P2 backlog) | **Tak** bidirectional |
| React Flow builder workflow | Canvas | Odrzucony w CURSOR_PROMPT (tygodnie); makieta: formularz / lista `.wf` | **Tak** jako canvas |
| Turso/libSQL, H3 geofence, Tesseract OCR, headless Chromium telematics scrape, Stripe Invoicing, Clerk/Axiom | Stack alternatives | Tabela „Stos ODRZUCONY” w `CURSOR_PROMPT.md` | **Tak** |
| KSeF, e-CMR, carbon/CO₂ | Compliance / ESG | „POZA MVP — zaprojektuj miejsce” | **Odłożone** |
| SMS | Kanał powiadomień | Brak implementacji w makiecie; Resend email w planie stack | **nie potwierdzone** jako świadoma decyzja vs brak czasu — w CURSOR jest Resend, nie SMS |
| Kalendarz ICS | Feed KSH | W CURSOR M8; w makiecie **nie** jako pełny ICS | PLANOWANE / poza makietą |
| Stena Plan B portal / Unity/TT API | Alternatywy promowe | Research D1: Polferries brak; Stena portal; Unity/TT brak API — w UI Plan B jako **ops data** (RisksView alts) | API **odrzucone/niedostępne**; Plan B UI **zrobione** |
| MapLibre jako aktywna mapa | Pierwotny plan START | Worker 404 → przełączenie na **Leaflet** (`MAP_TILES_FIX.md`); MapLibre leftovers w public/CSS | Decyzja implementacyjna (nie „odrzucone na zawsze”) |

---

## A3 — Integracje

| Integracja | Stan | Po co | Co blokuje | Kto ma dostęp |
|---|---|---|---|---|
| Telematyka SCX (rFMS / GENERIC_REST / Webfleet) | **ATRAPA** | Pozycje floty | Brak wyboru OEM / grantu od SCX; `adapter.ts` stub | Spotkanie SCX / Sebastian; plik `lib/telematics/adapter.ts` w `/workspace/watch-tower/` |
| SharePoint (Graph) | **OMÓWIONA I ODRZUCONA** (bi-dir) / **PLANOWANA** (one-way P2) | Import planu | Nie w makiecie; UI note „import z SharePoint” to copy seed | Sebastian / tenant M365 — **nie mam** potwierdzenia konta |
| Trafikverket Situation | **ZACZĘTA** | Ryzyka E4 / warstwa mapy | Klucz API; bez → seed labeled | Kto ma klucz: **nie mam** (env server); rejestracja publiczna TV |
| Pogoda morska (MET Norway / SMHI) | **PLANOWANA** | Ryzyko FERRY | Nie podpięta live w SPA; Open-Meteo świadomie unikane (non-commercial) | Research `03_APIS_VERIFIED` |
| Komunikaty armatora Polferries | **ATRAPA** / seed HTML | Godziny rejsów | Brak API | Ops HITL; seed `ferry-sailings` |
| AISStream (MMSI Wawel `311852000`, Nova Star `311000787`) | **ZACZĘTA** | Pozycja promu na mapie | `AISSTREAM_API_KEY` server-only + proxy `:4175`; bez → seed | Klucz: **nie mam** kto posiada |
| Kursy FX NBP | **PLANOWANA** | BAF / raporty | Opisane w research + engine Claude; brak live client w SPA | api.nbp.pl publiczne |
| Indeks paliwa SEFS (OKQ8/ORLEN) | **DZIAŁA** (seed hybrid) | BAF w Finance/Opcje | Live scrape prawnie wątpliwy — snapshoty w `sefs.ts` / tabele | HHL w UI; źródła URL w SEFS_SOURCES |
| Email (Resend) | **PLANOWANA** | Powiadomienia | Stack CURSOR; makieta = in-app bell | — |
| SMS | **nie potwierdzone** | — | Brak w makiecie i w zatwierdzonym stacku | — |
| Kalendarz ICS | **PLANOWANA** | KSH przyjazdy | CURSOR M8; nie w SPA | — |
| Factoring | **DZIAŁA** (makieta store) | HHL oferta %/dni; SCX wybór | Brak realnego banku/factora | HHL/SCX w UI |
| KSeF | **PLANOWANA** (poza MVP) | e-faktury PL | Poza makietą | — |
| e-CMR | **PLANOWANA** (poza MVP) | Cyfrowe CMR | Poza makietą | — |
| Carbon / CO₂ ISO 14083 | **PLANOWANA** (poza MVP) | Ślad | Poza makietą | — |
| Polferries booking API | **OMÓWIONA I ODRZUCONA** | Rezerwacje | Nie istnieje publicznie | — |
| Stena / Unity Line / TT | **OMÓWIONA** (brak API) | Alternatywy w Plan B | Brak API; alts jako dane ops | — |
| Map tiles Carto/OSM/Esri | **DZIAŁA** (Leaflet + Esri public gray) | Basemap | Carto CDN bez key = watermark; użyto Esri Canvas | Publiczne |
| MapTiler / OpenFreeMap | **PLANOWANA** / docs README częściowo stale | Style MapLibre | Aktywna mapa = Leaflet, nie MapLibre | Opcjonalny key |
| ORS HeiGIT driving-hgv | **PLANOWANA** (orientacyjnie) | Shadow route ≠ dispensa | Nie SoT trasy | ORS_API_KEY |
| Driver geolocation | **DZIAŁA** | PWA pozycja | Uprawnienia przeglądarki | Kierowca / token link |

---

## A4 — Decyzje projektowe

| Decyzja | Treść | Dowód |
|---|---|---|
| **Leaflet** | Po awarii MapLibre worker (`shared.mjs` 404) mapa przełączona na Leaflet + public basemap (Esri gray; Carto constants retained) | `MAP_TILES_FIX.md`, `CorridorMap.tsx` |
| Role **HHL / KSH / SCX** | Tylko trzy; Stegra = miejsce (SITE), nie login | `types/index.ts`, `permissions.ts`, AUDIT C15 |
| Widoczność pieniędzy | HHL: koszt+przychód+marża; KSH: przychód; SCX: koszt — **bez blur**, ukrycie w UI+permissions | `permissions.ts`, UX_MAP |
| Dane | Zustand + localStorage persist; seed JSON; Excel = plan, app = stan (zasada CURSOR) | store, seed |
| Widoki | Hash routes; shell Claude v2; M1–M12 + Opcje | `App.tsx` HashRouter |
| Moduły poza oryginałem Claude HTML | Opcje, factoring UI, notifications bell, DnD SectionCard, import DnD, Driver PWA, ZIP, SE road/FM | PUNKT4–8, CHAT_GAP |
| **Claude v2 freeze** | Look 1:1 `claude-v2.0/tower-makieta.html`; funkcje pod spodem | `FROM_CLAUDE_V2.md`, `VISUAL_ALIGN_CLAUDE.md` |
| **HashRouter** | SPA na static host (Vercel drop / preview) bez server rewrite | `App.tsx` |
| **Vite SPA** | Szybka makieta vs Next | AUDIT C6 PARTIAL |
| **UI PL hard** | Default `locale: 'pl'`; i18n pl/en/sv switcher jak makieta; QA wymaga PL | FUNCTIONAL_REQA gate 10; RESUME PL copy |
| Corridor SoT | `corridor_ref` z zezwolenia — **nie** ORS jako prawo trasy | START_API_NOTES |

**Uwaga sprzeczności docs:** `docs/README.md` nadal opisuje MapLibre GL — **stale** względem aktywnego Leaflet (`FUNCTIONAL_REQA_STATIC` gate 1).

---

## A5 — Mapa drogowa

### Sekwencja „punktów” w docs (makieta 23.09)

| Punkt | Temat | Doc |
|---|---|---|
| 1 | Closeout obecnej makiety | `CURRENT_MOCKUP_CLOSEOUT.md` |
| 3 | Shell Claude v2.0 | `FROM_CLAUDE_V2.md` |
| 4 | Ustalenia resources/awizacja | `PUNKT4_MANUAL_RESOURCES.md` |
| 5 | Pliki upload/preview/download | `PUNKT5_FILES.md` |
| 6 | Opcje + Automatyzacje | `PUNKT6_OPTIONS.md` |
| 7 | Loads / ryzyka Economy | `PUNKT7_LOADS_RISKS.md` |
| 8 | Cennik + BAF/SEFS | `PUNKT8_RATES_BAF.md` |
| 9 | Full QA functional+eye | `PUNKT9_FULL_QA.md` → SHIP |

**„11-point mandate”:** w plikach app **nie znaleziono** listy dokładnie 11 punktów o tej nazwie. Najbliższe mandaty udokumentowane:

- Scope mandate **#1–#14** (`FUNCTIONAL_REQA_STATIC_FN2.md`) — wire functions under Claude.
- Brief A/B/C/D z `AUDIT_CHAT_REQUIREMENTS.md` (A9+B10+C18+D4).
- Blokery 1–16 w tym samym audycie.

→ Etykieta **MEMORY**: sekwencja ~11 punktów z memory/todos (patrz A6 §6); dokładny string „11-point” może nie być w jednej wiadomości RT.

### Afternoon batches (po southern closeout)

Z `CHAT_GAP_AUDIT.md` / `BATCH-PM-SECTIONS.md` / `BATCH-SCROLL-SECTIONS.md` / `RESTORE-V2-CHROME.md`:

- Kokpit mapa 360, ferry arrows, Harmonogram cols / Zapisz widok, Ryzyka SE alts + FM, Faktury overlap, SectionCard grey headers + DnD, page scroll uncapping (wyjątek Strefy), truck arrows, live ferry countdown topbar, optical restore Claude v2, Vercel redeploy.

### Faza produkcyjna (intencja Cursor — **nie zbudowane**)

Z `CURSOR_PROMPT.md` / migracji `0001_core.sql` / `0002_geofence_engine.sql`:

- Next App Router + **Supabase** Postgres/PostGIS/Auth/RLS/Realtime/Storage  
- Prawdziwe permissions RLS (nie tylko UI)  
- Inngest crons, Resend, Vercel Pro  
- Telematics adapter fill po spotkaniu SCX  
- SharePoint one-way watcher (P2)  

**Etap 0.5 Git** (`ETAP_0_5_GIT.md`): baseline zamrożony; **brak remote/gh auth** — Sebastian ma założyć prywatne repo.

---

## A6 — Prompty źródłowe

**Rozszerzone w** [`00_KONTEKST_A6_PROMPTY.md`](./00_KONTEKST_A6_PROMPTY.md) (Claude HUMAN #1–3 + CURSOR_PROMPT + **§5 ReadTranscript sampled turns** + **§6 MEMORY**).

### Paging (skrót)

Parent uruchomił `ReadTranscript` na `8f0d9d27-…`: próbki ~1897–1928 / ~1879–1896 / ~1496–1554 z ~1941+; `before=` nie doszedł do 0 → A6 = **sampled major turns**, nie pełny dump.

### Indeks potwierdzonych turnów Cursor (Europe/Warsaw, ≈)

| Turn | Czas | Treść (skrót) |
|---|---|---|
| t95u | ~12:47 | `nie dziala link ktory udostepniles. napraw to` |
| t96u | ~12:48 | `dlaczego przestal działać? Ten link musi działać jeszze przez kilka dni, na tym samym linku co dales mi pierwotnie` |
| t96s2 widget | ~12:51 | `Ustaw stały hosting i daj mi nowy URL na kilka dni` → Vercel `watch-tower-makieta.vercel.app` / `sebastianbozekq-7781s` |
| t110u | ~21:05 | **PROMPT FINALNY** handover (Etap 0→A→B→C STOP→D + D1–D17); pełny tekst w RT |
| t111u | ~21:10 | **POTWIERDZENIE ETAPU 0** + **ETAP 0.5** + A6/A7 RT + A8 siblings + C2/C3/D18 + 6-punktówka |

### HUMAN z Claude (chronologicznie)

| # | Czas | Treść (skrót; pełna w A6 file) |
|---|---|---|
| 1 | 2026-09-22 23:14 | *(puste w eksporcie — prawdopodobnie tylko załączniki)* |
| 2 | 2026-09-22 23:33 | wyniki Gemini/DeepSeek → output + kod dla Cursor; pytania do przewoźnika |
| 3 | 2026-09-22 23:48 | makieta HTML klikalna, ~50 transportów, na spotkanie |

### Wykonanie niekompletne względem CURSOR_PROMPT

- Stack Next/Supabase/MapLibre **nie** jest produkcją — zastąpiony makietą Vite.
- next-intl PL/EN/SV: switcher jest; kompletność EN/SV **nie QA’d** (RESUME).
- Preview „za hasłem”: Vercel URL publiczny makiety — **rozjazd** z zasadą CURSOR o haśle.

## A7 — Historia rozmowy

Rekonstrukcja **chronologiczna z dowodów ReadTranscript (próbki) + docs**; nie zgadywanie dialogu. **Luka:** najwcześniejsze turny Cursor (przed popołudniem) wymagają dalszego `before=` pagingu.

1. **2026-09-22 wieczór** — rozmowa Claude (`ROZMOWA_CLAUDE.txt`) → `CURSOR_PROMPT` + HTML makieta (~50 transportów).
2. **2026-09-23 noc–ranek** — Vite SPA, research pack, UX/Visual SoT, START, MapLibre→Leaflet.
3. **Claude shell / FROM ZERO / squint gates / FN click QA** — cykle hollows + optical gates.
4. **Claude v2.0 + punkty 4–9 + morning fixes** — `FROM_CLAUDE_V2`, PUNKT4–9, `FIX_MORNING`.
5. **Popołudnie** — batche UI + Cloudflare die + **Vercel permanent URL** (t95–t96 → `watch-tower-makieta.vercel.app` / `sebastianbozekq-7781s`).
6. **Visual TAK/NIE audit** (era t109) — batch-pm / VISUAL.
7. **t110** PROMPT FINALNY handover → odpowiedzi Etap 0 → **t111** confirm → **Etap 0.5** baseline `305da3e` / tag `baseline-2026-09-23` → **Etap A** (ten dokument) → **Etap B** (`08_MANIFEST.md`).

## A8 — Pozostałe boty WT

Odpowiedzieli **Sebastianowi we własnych czatach** (6-punktówka); FYI do koordynatora. Poniżej **mapa + digest z ReadTranscript samples** (parent). Pełna proza 6-punktówek żyje w **ich** rozmowach z Sebastianem — A8 nie zastępuje SoT czatu siblinga.

### WT — UX · `bc46eae2-b0bd-4713-b957-e167843e5cc1`

| | |
|---|---|
| Digest (RT) | SoT: `UX_MAP` / `VISUAL_BRIEF` / `VISUAL_ALIGN_CLAUDE`; Claude **1:1 flip**; Stegra=POI; elite E1–E4; anti-slop→**clone override**; artefakty `/workspace/watch-tower/`; next=builder FROM ZERO + QA |
| Rola | Mapa UX + kierunek wizualny; bez kodu app |
| Artefakty | `UX_MAP.md`, `VISUAL_BRIEF.md`, `VISUAL_ALIGN_CLAUDE.md`, `VISUAL_BRIEF_ELITE.md` |
| Weszło do app | IA M1–M12, role, acceptance — **tak** (builder) |

### WT — Visual · `4d0aa860-3c25-4098-94e7-178bf89f5167`

| | |
|---|---|
| Digest (RT) | Squint gates `FINAL_SQUINT` PASS **96/0/6**; `visual-gate-from-zero` reports; anti-slop → v4 → Claude flip; logo w `public/logos`; standby Claude v2 **BY EYE**; **nie** modyfikował kodu app |
| Artefakty | `research-2026/visual-gate-*`, `ANTI_SLOP_*`, `START_UI_SPEC.md`, `VISUAL_V4_*`, `CLAUDE_SHELL_GATE.md`, shot packs |
| Weszło do app | Chrome Claude v1→v2 — **tak** (builder); skóry v3/v4 — **nie** |

### WT — Research · `cc5b26c6-458a-40d0-8cf9-307d9cca2c67`

| | |
|---|---|
| Digest (RT) | `research-2026` deep-dives + `START_API_NOTES`; **Polferries NO API**; AIS MMSI Wawel **311852000** / Nova Star **311000787** w §5.2; MapLibre/OpenFreeMap/Trafikverket notes; **no app code** |
| Artefakty | `research-2026/`, `START_API_NOTES.md`, `FERRY_AIS.md`, permits/BAF |
| Weszło do app | Seed SEFS/permits/ferry/TV/AIS wzorce — **częściowo** |

### WT — QA · `3dac78ee-da8f-41db-af6a-2f70efa97ed7`

| | |
|---|---|
| Digest (RT) | Adversarial click QA; artefakty `qa-start` `FINAL_*/P9_*`; cykle SHIP/NO_SHIP; P9 import wipe → READY hard-block SHIP; ryzyka: seed AIS/TV, localStorage vault, import regression |
| Artefakty | `/workspace/watch-tower/qa-start/` (+ kopia `docs/qa-start/`), `QA_RE_SHIP_FROZEN.md`, `FUNCTIONAL_REQA_*` |
| Weszło do app | Sterowanie fixami (hollows, tiles, READY) — **tak** |

## A9 — Spis `docs/` + `docs/qa-start/`

### `docs/*.md`

| Plik | Opis 1-linijkowy |
|---|---|
| `README.md` | Overview makiety; **uwaga: MapLibre stale** vs Leaflet |
| `ACCEPTANCE.md` | Kryteria PASS per shell/M1–M12 |
| `AUDIT_FULL_CHAT.md` | Pełny audyt wymagań czatu → DONE/PARTIAL/GAP (03:10) |
| `CURRENT_MOCKUP_CLOSEOUT.md` | Closeout punkt 1 przed nowymi plikami Claude |
| `ETAP_0_5_GIT.md` | Zamrożenie baseline git + tag |
| `FIX_FN2_HOLLOWS.md` | Fix click FAILs 1–4 pod Claude shell |
| `FIX_FN3B_HOLLOWS.md` | Fix hollows z FINAL_FN2_CLICK_CLAUDE |
| `FIX_MORNING.md` | Morning bugs Sebastiana (Ryzyka/Harmonogram/Mapa) |
| `FIX_READY_GATE.md` | Notatka READY gate / persist key |
| `FROM_CLAUDE_V2.md` | Punkt 3 — rebuild shell = Claude v2.0 |
| `FUNCTIONS_UNDER_CLAUDE.md` | Checklist funkcji pod chrome |
| `IDENTICAL_CLAUDE_FULL.md` | Full surface 1:1 vs Claude v1 ref |
| `PUBLIC_ACCESS.md` | Cloudflare quick tunnel URL |
| `PUNKT4_MANUAL_RESOURCES.md` | Ustalenia resources/awizacja/ferry |
| `PUNKT5_FILES.md` | Upload/podgląd/pobieranie dokumentów |
| `PUNKT6_OPTIONS.md` | Opcje + kreator reguł WF |
| `PUNKT7_LOADS_RISKS.md` | Loads + ryzyka (Economy/PL) |
| `PUNKT8_RATES_BAF.md` | Cennik SCX + BAF/SEFS w Opcjach |
| `PUNKT9_FULL_QA.md` | Full functional+eye QA → SHIP |
| `QA_RE_SHIP_FROZEN.md` | Adversarial re-QA przy frozen chrome 10/10 |
| `SE_ROAD_AND_FORCE_MAJEURE.md` | Ryzyka SE + force majeure |

### `docs/qa-start/*.md` + foldery PNG

| Plik / folder | Opis |
|---|---|
| `BATCH-PM-SECTIONS.md` | Poprawki UI batch-pm (mapa, ferry, sekcje) |
| `BATCH-SCROLL-SECTIONS.md` | Scroll/sekcje uncapping |
| `CHAT_GAP_AUDIT.md` | Strefy scroll + reconcile full chat gaps |
| `FINAL_FN2_CLICK.md` / `_CLAUDE.md` | Click Re-QA FN2 |
| `FINAL_FN3_CLICK.md` / `FINAL_FN4_CLICK.md` | Kolejne click Re-QA |
| `FINAL_SHIP.md` / `FINAL_START_SPRINT.md` | Ship / START sprint QA |
| `FUNCTIONAL_REQA_STATIC.md` / `_FN2.md` | Static adversarial functional gates |
| `HOLLOW_FIX.md` / `HOLLOW_VERIFY.md` | Hollow closeout + verify |
| `MAP_TILES_FIX.md` | Leaflet + basemap |
| `P9_*.md` | Punkt 9 reclick / eye / static chrome |
| `RESTORE-V2-CHROME.md` | Optical restore v2 |
| `SHIP_STATIC.md` / `STATIC_START_SPRINT.md` | Static ship / START |
| `batch-pm/` | Screenshot pack (+ `VISUAL.md`, `FIX-FOLLOWUP.md`) |
| `batch-scroll/` | Screenshot pack scroll batch |
| `fix-morning/` | Screenshot pack morning fixes |
| `restore-v2/` | Screenshot pack restore v2 |
| (root qa-start `*.png`, `fn*.png`, `ship*.png`, `p9*.png`) | Duże paczki zrzutów QA / ship / fn |

**Flagi stale / sprzeczne vs aktualna app:**

- `docs/README.md` → MapLibre (app: Leaflet).  
- Część early QA mówi MapLibre worker — supersede przez `MAP_TILES_FIX`.  
- `FROM_CLAUDE_V2` GAP „Nowa reguła bez buildera” vs późniejszy `PUNKT6` / CHAT_GAP (kreator istnieje) — **nowsze wygrywa**.  
- Cloudflare URL w `PUBLIC_ACCESS` może być martwy (ephemeral).  
- Liczba loads: early 62; P9 wspomina 72 — **sprawdzić seed** przed cytowaniem (spot-check loads.json = **62** w momencie handover).

---

## Honest gaps (lista)

1. ~~ReadTranscript niedostępny~~ → **RT uruchomiony przez parenta**; pełny dump A6 do pozycji **0** nadal otwarty.
2. ~~6-punktówki nie mam~~ → **digest A8 z RT samples**; pełna proza w czatach siblingów z Sebastianem.
3. **Netlify Drop** — nie potwierdzone w docs (status nieznany).
4. **Kto posiada** klucze AISSTREAM / TRAFIKVERKET / MapTiler / Vercel / domenę — **nie mam**.
5. Dokładny string „11-point mandate” w jednej wiadomości — **nie potwierdzony**; sekwencja MEMORY (A6 §6).
6. Pełny tekst **t110u PROMPT FINALNY** — SoT = transcript; brak kopii plikowej w `docs/handover/` (poza skrótem A6 §5.4).
7. Memory facts store — puste lokalnie; mandaty MEMORY z epizodów parenta (A6 §6).
8. Najwcześniejsze Cursor turns (przed afternoon) — wymaga dalszego `before=` (A7 gap).
9. Exact 64-line wording Etap B z t110 — zrekonstruowane w `08_MANIFEST.md` z struktury B1–B6 + FS spot-check; parent może skorygować brzmienie vs RT.

*Etap A backfill (A6/A7/A8) + Etap B (`08_MANIFEST.md`) started. C/D nie. Nie zmieniano `src/`. Brak commitów git (preferencja parenta).*
