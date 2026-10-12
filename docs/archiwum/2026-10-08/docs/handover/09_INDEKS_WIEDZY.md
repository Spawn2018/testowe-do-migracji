# ETAP C4 — Indeks wiedzy · `09_INDEKS_WIEDZY.md`

| Pole | Wartość |
|---|---|
| Data | **2026-09-23** Europe/Warsaw (UTC+2) · ~22:00 CEST |
| App | `/workspace/watch-tower-app` |
| Canon w app | `docs/watch-tower/` (kopia) |
| Canon poza app | `/workspace/watch-tower/` (oryginały) |
| Zakres | C4 **tylko** — bez C1/C3/C5; bez zmian kodu produktu; **bez commit** |
| Wiersze tabeli | **156** |
| Aktualny? = TAK | 102 |
| NIEAKTUALNE | **32** (nagłówki wstawione w `docs/watch-tower/` gdzie następca jasny) |
| CZĘŚCIOWO | 4 |
| ARCHIWUM-HISTORIA | 18 |

Legenda **Aktualny?**:
- **TAK** — wolno czytać jako obowiązujące (z regułą konfliktów poniżej).
- **NIEAKTUALNE** — tożsamość wizualna / decyzja nadpisana (zwłaszcza anti-slop / **IBM Plex** / skóry v3–v4). Na górze pliku w `docs/watch-tower/` jest nagłówek `NIEAKTUALNE — zastąpione przez …` (preferowane vs `docs/archiwum/`).
- **CZĘŚCIOWO** — treść częściowo żywa, ścieżki SoT lub fragmenty stale.
- **ARCHIWUM-HISTORIA** — raport przebiegu / status punktowy; nie usuwać; nie traktować jako SoT.

---

## Reguła rozstrzygania sprzeczności

**Potwierdzenie (C4, 2026-09-23):**

1. **Produkt / moduły / workflow / role / seed / acceptance funkcjonalne / pricing / permits / ETA (treść biznesowa):** wygrywają **`UX_MAP.md`**, **`VISUAL_BRIEF.md`** (warstwa visual/FAIL gate) oraz **`CURSOR_PROMPT.md`** (architektura docelowa / poza-MVP). Reguła z `research-2026/README.md` **nadal obowiązuje** i obejmuje **oba tory** w `research-2026/` (pack `0N_*.md` **oraz** deep-dive `0N-*.md`). Research = **evidence**, nie SoT produktu.
2. **Wygląd / shell / typografia / tokeny / layout chrome:** wygrywa **Claude v2.0** (`design/claude-v2.0/` ≡ `docs/watch-tower/claude-v2.0/` ≡ `/workspace/watch-tower/claude-v2.0/`) — **per koordynator**. Barlow + Barlow Condensed **wymagane**. **IBM Plex jako primary = FAIL**. Dokumenty anti-slop / v3 / v4 / „Claude = quality bar only” = **NIEAKTUALNE**.
3. **`VISUAL_BRIEF.md` / `UX_MAP.md` / `VISUAL_ALIGN_CLAUDE.md`** nadal opisują politykę **Claude 1:1 + Barlow**, ale część linków wskazuje jeszcze `claude-makieta.html` / `claude-visual-ref/` (v1). **Formalne domknięcie „który HTML jest kanoniczny” = C5** (`06_WYGLAD.md`). Do czasu C5: **mierzyć vs `claude-v2.0/tower-makieta.html`**, a briefy produktowe czytać łącznie z `CLAUDE_V2_SOT.md`.
4. **QA `qa-start/`:** ostatni chronologicznie raport wygrywa przy sprzecznych PASS/FAIL; status residual w raporcie ≠ zamknięcie w produkcie.
5. **Kopie:** `docs/qa-start/` ≈ `docs/watch-tower/qa-start/`; root `/*.md` ≈ `docs/*.md`; `/workspace/watch-tower/` ≈ `docs/watch-tower/`. Przy rozjeździe — **canon poza app** dla SoT design/research; w app preferuj `docs/watch-tower/` + `design/claude-v2.0/`.

### Skrót wygranych

| Konflikt | Wygrywa |
|---|---|
| Research vs produkt | `UX_MAP` / `VISUAL_BRIEF` / `CURSOR_PROMPT` |
| Anti-slop / Plex / v3 / v4 vs shell | Claude **v2.0** + `VISUAL_BRIEF` (Barlow) |
| `claude-makieta.html` / `claude-visual-ref` vs `claude-v2.0` | **`claude-v2.0`** (koordynator; C5 spisze różnice) |
| Raporty QA sprzeczne | Najpóźniejszy po dacie w pliku |

---

## Tabela indeksu

| Plik | Katalog | Autor | Co zawiera | Aktualny? | Zastąpiony przez |
|---|---|---|---|---|---|
| UX_MAP.md | docs/watch-tower/ | WT — UX | Mapa UX: M1–M12, workflow, role HHL/KSH/SCX, seed, acceptance funkcjonalne; split SoT (shell→Claude) | **TAK** | — |
| VISUAL_BRIEF.md | docs/watch-tower/ | WT — UX / Visual | Brief wizualny Claude 1:1: Barlow, tokeny, FAIL gate; HARD override anti-slop/Plex | **TAK** | — |
| VISUAL_ALIGN_CLAUDE.md | docs/watch-tower/ | WT — UX | Polityka clone-target: Claude = 1:1 SoT wizualny (nie „quality bar”) | **TAK** | — |
| VISUAL_BRIEF_ELITE.md | docs/watch-tower/ | WT — UX | Pointer: shell→VISUAL_BRIEF; elite functional→UX_MAP §6.5 | **TAK** | — |
| ADDRESSES.md | docs/watch-tower/ | Sebastian | SoT adresów WGS84: KSH Śrem + Stegra Boden + korytarz | **TAK** | — |
| START_API_NOTES.md | docs/watch-tower/ | WT — Research | Notatki API P0 dla buildera: kotwice, Polferries NO API, AIS MMSI, TV | **TAK** | — |
| CURSOR_PROMPT.md | docs/watch-tower/ | Sebastian / Claude | Prompt planowania TOWER v2 (stack docelowy, MVP, poza MVP) — nie runtime makiety | **TAK** | — (kopia w handover/CURSOR_PROMPT_ZRODLOWY.md) |
| ROZMOWA_CLAUDE.txt | docs/watch-tower/ | Sebastian + Claude | Eksport czatu HUMAN#1–3: architektura, moduły, prompt Cursor | **TAK** | — |
| PYTANIA_SCANDINAVIAN_EXPRESS.md | docs/watch-tower/ | Sebastian / ops | Checklista spotkania SCX | **TAK** | — |
| PERMITS_PL_SE.md | docs/watch-tower/ | WT — Research | Limity/zezwolenia PL/SE ze źródeł urzędowych | **TAK** | — |
| PERMIT_ATTACHMENT_RULES.md | docs/watch-tower/ | WT — Research / UX | Reguły podpinania plików zezwoleń (PERIOD/TRIP/REGULATION) | **TAK** | — |
| PERMIT_CLASSIFICATION.md | docs/watch-tower/ | WT — Research | Klasyfikacja zezwoleń wg cennika SCX + wymiary zestawu | **TAK** | — |
| FERRY_AIS.md | docs/watch-tower/ | WT — Research | Prom Gdańsk–Nynäshamn + AIS MMSI; Polferries bez API | **TAK** | — |
| BAF_SEFS.md | docs/watch-tower/ | Sebastian / Research | SEFS hybrid SoT z umowy (mnożniki SEK/PLN) | **TAK** | — |
| BAF_SPEC.txt | docs/watch-tower/ | Sebastian (załącznik umowy) | Tekst załącznika SEFS do umowy | **TAK** | — |
| QA_ELITE_UPGRADE_CHECKLIST.md | docs/watch-tower/ | WT — QA | Checklista elite upgrade (adversarial gate) — STANDBY | **TAK** | — |
| AUDIT_CHAT_REQUIREMENTS.md | docs/watch-tower/ | Builder / QA | Audyt wymagań z czatu → statusy (odświeżany) | **TAK** | — |
| SPACING_FONT_FIX.md | docs/watch-tower/ | Builder | Fix spacing/font vs Claude SoT (Barlow, extracted.css) | **CZĘŚCIOWO** | Ścieżka SoT CSS: preferuj claude-v2.0; treść fixów historyczna |
| CLOSEOUT_STATUS.md | docs/watch-tower/ | Builder | Status closeout ~01:05 (przed pełnym Claude flip) | **ARCHIWUM-HISTORIA** | RESUME_STATUS.md / FINAL_SQUINT |
| RESUME_STATUS.md | docs/watch-tower/ | Builder | Resume po Claude shell ~01:43 | **ARCHIWUM-HISTORIA** | IDENTICAL_CLAUDE.md / FROM_CLAUDE_V2.md |
| FROM_CLAUDE_ZERO.md | docs/watch-tower/ | Builder / Visual | Mandat FROM ZERO — shell z makiety Claude | **ARCHIWUM-HISTORIA** | claude-v2.0 + FINAL_SQUINT (SoT HTML w treści = v1) |
| IDENTICAL_CLAUDE.md | docs/watch-tower/ | Builder | Lock chrome 1:1 vs makieta ~02:15 | **ARCHIWUM-HISTORIA** | CLAUDE_V2_SOT.md (następca optyczny v2.0) |
| tower-makieta.html / index.html | docs/watch-tower/claude-v2.0/ | Claude (ZIP Sebastian) | Makieta HTML v2.0 — kanoniczny visual SoT (koordynator) | **TAK** | — |
| CLAUDE_V2_SOT.md | docs/watch-tower/claude-v2.0/ | Koordynator / Visual | Deklaracja Claude v2.0 jako visual SoT | **TAK** | — |
| README.txt | docs/watch-tower/claude-v2.0/ | Claude | Instrukcja otwarcia makiety v2.0 (Barlow) | **TAK** | — |
| tower-makieta.html / index.html | design/claude-v2.0/ | Claude (kopia w app) | Zamrożona kopia SoT v2.0 w repo app (diff OK vs canon) | **TAK** | — |
| CLAUDE_V2_SOT.md | design/claude-v2.0/ | Koordynator | Mirror CLAUDE_V2_SOT w design/ | **TAK** | — |
| README.txt | design/claude-v2.0/ | Claude | Mirror README v2.0 | **TAK** | — |
| claude-makieta.html | docs/watch-tower/ | Claude (v1) | Makieta HTML v1 — poprzedni SoT wizualny | **NIEAKTUALNE** | claude-v2.0/tower-makieta.html (nagłówek w pliku) |
| tower-makieta.html | docs/watch-tower/claude-visual-ref/ | Claude (v1) | Makieta HTML v1 (claude-visual-ref) | **NIEAKTUALNE** | claude-v2.0/tower-makieta.html |
| extracted.css | docs/watch-tower/claude-visual-ref/ | Visual (extract v1) | CSS wyciągnięty z makiety v1 | **NIEAKTUALNE** | claude-v2.0 (CSS wbudowany w HTML) |
| README.md | docs/watch-tower/claude-visual-ref/ | Visual | Opis pakietu visual-ref v1 | **NIEAKTUALNE** | claude-v2.0/CLAUDE_V2_SOT.md |
| CURSOR_PROMPT.md | docs/watch-tower/claude-visual-ref/ | Claude | Kopia CURSOR_PROMPT w visual-ref | **NIEAKTUALNE** | docs/watch-tower/CURSOR_PROMPT.md |
| PYTANIA_SCANDINAVIAN_EXPRESS.md | docs/watch-tower/claude-visual-ref/ | ops | Kopia checklisty SCX | **CZĘŚCIOWO** | docs/watch-tower/PYTANIA_SCANDINAVIAN_EXPRESS.md (kanon) |
| README.md | docs/watch-tower/research-2026/ | WT — Research | Indeks dwóch torów researchu + reguła konfliktu UX_MAP/VISUAL_BRIEF/CURSOR | **TAK** | — |
| 00_EXEC_SUMMARY.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Executive summary research Sept 2026 | **TAK** | — (evidence; konflikt→UX_MAP/VISUAL_BRIEF/CURSOR) |
| 01_COMPETITORS.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Skrót konkurencji control tower | **TAK** | — |
| 01-competitors-control-tower.md | docs/watch-tower/research-2026/ | WT — Research (deep) | Deep-dive konkurencja RTTV/peers | **TAK** | — |
| 02_UX_UI_2026.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Trendy UX/UI — zawiera wzmianki IBM Plex | **NIEAKTUALNE** | UX_MAP.md + VISUAL_BRIEF.md |
| 02_VISUAL_REFS_2026.md | docs/watch-tower/research-2026/ | WT — Visual | Refs wizualne ery anti-slop/Plex | **NIEAKTUALNE** | VISUAL_BRIEF.md + claude-v2.0 |
| 02-corridor-pl-se-apis.md | docs/watch-tower/research-2026/ | WT — Research (deep) | Katalog API korytarza PL–SE | **TAK** | — |
| 03_APIS_VERIFIED.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Zweryfikowane API (bez wymyślonych endpointów) | **TAK** | — |
| 03-eta-predictions.md | docs/watch-tower/research-2026/ | WT — Research (deep) | ETA segmentowe MVP + czego nie obiecywać | **TAK** | — |
| 04_ETA_PREDICTION.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Predykcja/ETA corridor-aware | **TAK** | — |
| 04-ux-ops-trends-2026.md | docs/watch-tower/research-2026/ | WT — Research (deep) | Trendy UX ops — nagłówek align IBM Plex | **NIEAKTUALNE** | UX_MAP.md + VISUAL_BRIEF.md |
| 05_WORKFLOWS.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Wzorce workflow/automatyzacji | **TAK** | — |
| 06_BACKLOG_MODULES.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Backlog modułów elite | **TAK** | — |
| 07_TEAM_ORDERS.md | docs/watch-tower/research-2026/ | WT — Research (pack) | Propozycja podziału ról zespołu (przed GO) | **ARCHIWUM-HISTORIA** | — (historyczne orders; decyzje SoT później) |
| START_UI_SPEC.md | docs/watch-tower/research-2026/ | WT — Visual | Spec UI pass 2 zsynchronizowany z Claude 1:1 / Barlow | **TAK** | — |
| SOT_FLIP_CLAUDE_SHELL_2026-09-23.md | docs/watch-tower/research-2026/ | WT — UX (Sebastian) | Decyzja SoT flip: Claude shell = prawda wizualna | **TAK** | — (akt decyzji) |
| CLAUDE_SHELL_GATE.md | docs/watch-tower/research-2026/ | WT — Visual | Checklista akceptacji Claude shell (Barlow, no Plex-primary) | **TAK** | — |
| FROM_ZERO_CLAUDE_HANDOFF.md | docs/watch-tower/research-2026/ | WT — Visual | Handoff FROM ZERO → builder | **TAK** | — (procedura; HTML SoT uaktualnij do v2.0) |
| FROM_CLAUDE_ZERO_RESULT.md | docs/watch-tower/research-2026/ | Builder / Visual | Wynik resetu shell FROM ZERO | **ARCHIWUM-HISTORIA** | FINAL_SQUINT_GATE_RESULT.md |
| logos/README.md | docs/watch-tower/research-2026/logos/ | Visual | Notatki o logotypach HHL/KSH/SCX | **TAK** | — |
| ANTI_SLOP_CHECKLIST.md | docs/watch-tower/research-2026/ | WT — Visual | 30s FAIL gate ery Plex/anti-slop | **NIEAKTUALNE** | VISUAL_BRIEF.md §0 + CLAUDE_SHELL_GATE.md |
| ANTI_SLOP_CSS_TOKENS.md | docs/watch-tower/research-2026/ | WT — Visual | Tokeny CSS IBM Plex / cold steel | **NIEAKTUALNE** | VISUAL_BRIEF.md + claude-v2.0 |
| ANTI_SLOP_HANDOFF.md | docs/watch-tower/research-2026/ | WT — Visual | Handoff anti-slop → builder (Plex identity) | **NIEAKTUALNE** | SOT_FLIP + VISUAL_BRIEF.md |
| ANTI_SLOP_REFS_2026-09-23.md | docs/watch-tower/research-2026/ | WT — Visual | Screenshot refs anti-slop; Claude=bar only | **NIEAKTUALNE** | VISUAL_BRIEF.md + claude-v2.0 |
| ANTI_SLOP_RESET.md | docs/watch-tower/research-2026/anti-slop-2026-09-23/ | WT — Visual | Reset anti-slop | **NIEAKTUALNE** | VISUAL_BRIEF.md + SOT_FLIP |
| BRIEF_HARD_RESET.md | docs/watch-tower/research-2026/anti-slop-2026-09-23/ | WT — Visual | Hard reset brief (przed Claude 1:1) | **NIEAKTUALNE** | VISUAL_BRIEF.md §0 |
| V4_EYE_RESET.md | docs/watch-tower/research-2026/anti-slop-2026-09-23/ | WT — Visual | Eye reset pod v4 | **NIEAKTUALNE** | claude-v2.0 + VISUAL_BRIEF.md |
| TRENDS_SEPT_2026.md | docs/watch-tower/research-2026/anti-slop-2026-09-23/ | WT — Visual | Trendy Sept 2026 (pack anti-slop/v4) | **NIEAKTUALNE** | VISUAL_BRIEF.md (trendy≠tożsamość) |
| VISUAL_V4_BRIEF.md | docs/watch-tower/research-2026/ | WT — Visual | Brief skóry v4 (Claude=bar) | **NIEAKTUALNE** | VISUAL_BRIEF.md + claude-v2.0 |
| VISUAL_V4_HANDOFF.md | docs/watch-tower/research-2026/ | WT — Visual | Handoff v4 → builder | **NIEAKTUALNE** | FROM_ZERO_CLAUDE_HANDOFF.md |
| CLAUDE_CRAFT_EXTRACT.md | docs/watch-tower/research-2026/ | WT — Visual | Extract craft „inspired not cloned” | **NIEAKTUALNE** | VISUAL_BRIEF.md + claude-v2.0 (1:1) |
| CLAUDE_CRAFT_HANDOFF.md | docs/watch-tower/research-2026/ | WT — Visual | Handoff craft + Plex | **NIEAKTUALNE** | SOT_FLIP + START_UI_SPEC.md |
| VISUAL_BRIEF_ELITE.md | docs/watch-tower/research-2026/ | WT — Visual | Elite brief research (era anti-slop) | **NIEAKTUALNE** | docs/watch-tower/VISUAL_BRIEF_ELITE.md + UX_MAP |
| VISUAL_BRIEF_ELITE_DELTA.md | docs/watch-tower/research-2026/ | WT — Visual | Delty merge do VISUAL_BRIEF (Plex) | **NIEAKTUALNE** | VISUAL_BRIEF.md |
| VISUAL_REFS_2026.md | docs/watch-tower/research-2026/ | WT — Visual | Refs craft 2026 (brand lock Plex-era) | **NIEAKTUALNE** | VISUAL_BRIEF.md + claude-v2.0 |
| ELITE_GAPS.md | docs/watch-tower/research-2026/ | WT — Visual | Luki elite vs SPA (sprzed flip) | **NIEAKTUALNE** | QA_ELITE_UPGRADE_CHECKLIST.md |
| FIX_P0_GLASS_PATHS.md | docs/watch-tower/research-2026/ | WT — Visual | Fix dense glass P0 | **NIEAKTUALNE** | VISUAL_BRIEF solid-first + SPACING_FONT_FIX |
| VISUAL_GATE_V2.md | docs/watch-tower/research-2026/visual-gate-v2/ | WT — Visual | Wynik gate v2 | **NIEAKTUALNE** | visual-gate-from-zero/FINAL_SQUINT |
| MUSTFIX_DONE.md | docs/watch-tower/research-2026/visual-gate-v2/ | WT — Visual | Mustfix v2 done | **NIEAKTUALNE** | visual-gate-from-zero/* |
| VISUAL_GATE_V3_EYE.md | docs/watch-tower/research-2026/visual-gate-v3/ | WT — Visual | Eye gate v3 (FAIL Sebastian) | **NIEAKTUALNE** | claude-v2.0 + FINAL_SQUINT |
| VISUAL_GATE_V4_EYE.md | docs/watch-tower/research-2026/visual-gate-v4/ | WT — Visual | Eye gate v4 | **NIEAKTUALNE** | claude-v2.0 + FINAL_SQUINT |
| VISUAL_GATE_P0_FIX.md | docs/watch-tower/research-2026/visual-gate-2026-09-23/ | WT — Visual | P0 fix gate (pre-Claude-1:1 era) | **NIEAKTUALNE** | CLAUDE_SHELL_GATE.md |
| CLAUDE_SHELL_GATE_RESULT.md | docs/watch-tower/research-2026/visual-gate-claude-shell/ | WT — Visual | Wynik gate Claude shell | **TAK** | — |
| FINAL_SQUINT_GATE_RESULT.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | FINAL_SQUINT PASS 96/0/6 — aktualna brama optyczna | **TAK** | — |
| FROM_ZERO_GATE_RESULT.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | Wynik gate FROM ZERO | **ARCHIWUM-HISTORIA** | FINAL_SQUINT_GATE_RESULT.md |
| RE_SQUINT_GATE_RESULT.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | Re-squint gate | **ARCHIWUM-HISTORIA** | FINAL_SQUINT_GATE_RESULT.md |
| START_SQUINT_GATE_RESULT.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | Start squint gate | **ARCHIWUM-HISTORIA** | FINAL_SQUINT_GATE_RESULT.md |
| IDENTICAL_CLAUDE_GATE_RESULT.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | Identical Claude gate | **ARCHIWUM-HISTORIA** | FINAL_SQUINT_GATE_RESULT.md |
| FIX_A_C.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | Fix A/C przy gate from-zero | **ARCHIWUM-HISTORIA** | FINAL_SQUINT |
| FULL_1TO1_SURFACE_CHECKLIST.md | docs/watch-tower/research-2026/visual-gate-from-zero/ | WT — Visual | Checklista powierzchni 1:1 | **TAK** | — (użyteczna vs Claude; SoT HTML→v2.0) |
| gddkia-en.pdf | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | GDDKiA EN — źródło zezwoleń PL | **TAK** | — |
| gddkia-kat.pdf | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | GDDKiA katalog PDF | **TAK** | — |
| gddkia-kat.txt | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | GDDKiA katalog TXT extract | **TAK** | — |
| pilot-pl.pdf | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | Pilot PL PDF | **TAK** | — |
| pilot-pl.txt | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | Pilot PL TXT | **TAK** | — |
| tsfs-2023-36.pdf | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | TSFS 2023:36 PDF (SE) | **TAK** | — |
| tsfs-2023-37.pdf | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | TSFS 2023:37 PDF (SE) | **TAK** | — |
| tsfs-36.txt | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | TSFS 36 TXT extract | **TAK** | — |
| tsfs-37.txt | docs/watch-tower/permits-research/ | Źródło urzędowe / Research | TSFS 37 TXT extract | **TAK** | — |
| CHAT_GAP_AUDIT.md | docs/watch-tower/qa-start/ | WT — QA | Audyt luk czatu t106/t107 vs Claude v2 | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| STATIC_START_SPRINT.md | docs/watch-tower/qa-start/ | WT — QA | Sprint start static QA | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| P9_RECLICK.md | docs/watch-tower/qa-start/ | WT — QA | Punkt 9 reclick | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| P9_RECLICK2_READY.md | docs/watch-tower/qa-start/ | WT — QA | P9 reclick2 READY | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| P9_V2_EYE_CLICK.md | docs/watch-tower/qa-start/ | WT — QA | P9 v2 eye click | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| P9_V2_STATIC_CHROME.md | docs/watch-tower/qa-start/ | WT — QA | P9 v2 static chrome | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FINAL_FN2_CLICK.md | docs/watch-tower/qa-start/ | WT — QA | FINAL FN2 click QA | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FINAL_FN2_CLICK_CLAUDE.md | docs/watch-tower/qa-start/ | WT — QA | FINAL FN2 click pod Claude shell | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FINAL_FN3_CLICK.md | docs/watch-tower/qa-start/ | WT — QA | FINAL FN3 click | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FINAL_FN4_CLICK.md | docs/watch-tower/qa-start/ | WT — QA | FINAL FN4 click | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FINAL_SHIP.md | docs/watch-tower/qa-start/ | WT — QA | FINAL_SHIP functional Re-QA | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FINAL_START_SPRINT.md | docs/watch-tower/qa-start/ | WT — QA | Final start sprint | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FUNCTIONAL_REQA_STATIC.md | docs/watch-tower/qa-start/ | WT — QA | Functional ReQA static 12/12 | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| FUNCTIONAL_REQA_STATIC_FN2.md | docs/watch-tower/qa-start/ | WT — QA | Functional ReQA FN2 | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| HOLLOW_FIX.md | docs/watch-tower/qa-start/ | WT — QA | Eliminacja hollow CTA | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| HOLLOW_VERIFY.md | docs/watch-tower/qa-start/ | WT — QA | Weryfikacja hollow | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| MAP_TILES_FIX.md | docs/watch-tower/qa-start/ | WT — QA | Fix kafelków mapy (Leaflet) | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| RESTORE-V2-CHROME.md | docs/watch-tower/qa-start/ | WT — QA | Restore chrome v2 | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| SHIP_STATIC.md | docs/watch-tower/qa-start/ | WT — QA | Ship static checklist | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| BATCH-PM-SECTIONS.md | docs/watch-tower/qa-start/ | WT — QA | Batch PM sections | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| BATCH-SCROLL-SECTIONS.md | docs/watch-tower/qa-start/ | WT — QA | Batch scroll sections | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| batch-pm/FIX-FOLLOWUP.md | docs/watch-tower/qa-start/ | WT — QA | Batch-pm fix followup | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| batch-pm/VISUAL.md | docs/watch-tower/qa-start/ | WT — QA | Batch-pm Visual TAK/NIE (t109) + Vercel URL | **TAK** | — (raport historyczny; ostatni status liczy się chronologicznie) |
| (lustro całego katalogu) | docs/qa-start/ | WT — QA (kopia) | Lustro docs/watch-tower/qa-start/ — te same pliki md | **TAK** | Preferuj docs/watch-tower/qa-start/ jako ścieżkę w indeksie |
| README.md | docs/ | Builder / QA / Research | Indeks docs app (część ścieżek MapLibre stale) | **CZĘŚCIOWO** | Leaflet aktywny; zaktualizuj wzmianki MapLibre |
| ACCEPTANCE.md | docs/ | Builder / QA / Research | Kryteria akceptacji makiety | **TAK** | — |
| AUDIT_FULL_CHAT.md | docs/ | Builder / QA / Research | Pełny audyt wymagań z czatu | **TAK** | — |
| CURRENT_MOCKUP_CLOSEOUT.md | docs/ | Builder / QA / Research | Closeout bieżącej makiety | **ARCHIWUM-HISTORIA** | QA_RE_SHIP_FROZEN / FINAL_SHIP |
| ETAP_0_5_GIT.md | docs/ | Builder / QA / Research | Etap 0.5: baseline git, lockfile, diff SoT | **TAK** | — |
| FIX_FN2_HOLLOWS.md | docs/ | Builder / QA / Research | Fix hollow FN2 | **ARCHIWUM-HISTORIA** | qa-start/HOLLOW_* |
| FIX_FN3B_HOLLOWS.md | docs/ | Builder / QA / Research | Fix hollow FN3b | **ARCHIWUM-HISTORIA** | qa-start/HOLLOW_* |
| FIX_MORNING.md | docs/ | Builder / QA / Research | Fix morning batch | **ARCHIWUM-HISTORIA** | — |
| FIX_READY_GATE.md | docs/ | Builder / QA / Research | Fix READY gate | **TAK** | — |
| FROM_CLAUDE_V2.md | docs/ | Builder / QA / Research | Przejście na Claude v2 chrome | **TAK** | — |
| FUNCTIONS_UNDER_CLAUDE.md | docs/ | Builder / QA / Research | Funkcje pod zamrożonym chrome Claude | **TAK** | — |
| IDENTICAL_CLAUDE_FULL.md | docs/ | Builder / QA / Research | Pełny lock identical Claude | **ARCHIWUM-HISTORIA** | CLAUDE_V2_SOT + FINAL_SQUINT |
| PUBLIC_ACCESS.md | docs/ | Builder / QA / Research | Dostęp publiczny (Vercel / cloudflare tunnel) | **TAK** | — |
| PUNKT4_MANUAL_RESOURCES.md | docs/ | Builder / QA / Research | Punkt 4 — zasoby manual | **TAK** | — |
| PUNKT5_FILES.md | docs/ | Builder / QA / Research | Punkt 5 — pliki | **TAK** | — |
| PUNKT6_OPTIONS.md | docs/ | Builder / QA / Research | Punkt 6 — opcje | **TAK** | — |
| PUNKT7_LOADS_RISKS.md | docs/ | Builder / QA / Research | Punkt 7 — ładunki/ryzyka | **TAK** | — |
| PUNKT8_RATES_BAF.md | docs/ | Builder / QA / Research | Punkt 8 — stawki/BAF | **TAK** | — |
| PUNKT9_FULL_QA.md | docs/ | Builder / QA / Research | Punkt 9 — full QA | **TAK** | — |
| QA_RE_SHIP_FROZEN.md | docs/ | Builder / QA / Research | QA re-ship; chrome frozen | **TAK** | — |
| SE_ROAD_AND_FORCE_MAJEURE.md | docs/ | Builder / QA / Research | SE road + force majeure | **TAK** | — |
| (kopie lustro) | app root (*.md) | Builder | Wiele plików z docs/ ma kopię w root app (ACCEPTANCE, PUNKT*, FIX_*) | **CZĘŚCIOWO** | Preferuj docs/ — root = duplikat roboczy |
| README.md | docs/evidence/ | Handover C6 | Indeks dowodów QA w repo | **TAK** | — |
| UTRACONE.md | docs/evidence/ | Handover C6 | Dowody utracone (/tmp) — nie odtwarzać | **TAK** | — |
| 00_KONTEKST.md | docs/handover/ | Koordynator / Etap A | Kontekst A1–A9 knowledge handover | **TAK** | — |
| 00_KONTEKST_A6_PROMPTY.md | docs/handover/ | Etap A | Prompty A6 (Claude #1–3 + RT) | **TAK** | — |
| 08_MANIFEST.md | docs/handover/ | Etap B | Manifest kompletności 64 pozycji | **TAK** | — |
| CURSOR_PROMPT_ZRODLOWY.md | docs/handover/ | Sebastian / Claude | Źródłowy CURSOR_PROMPT (nie t110) | **TAK** | — |
| ETAP_C_PROMPT.md | docs/handover/ | Sebastian (koordynator) | Prompt Etap C rozszerzony (C1–C6) | **TAK** | — |
| C3_JEZYKI.md | docs/handover/ | Etap C3 | Kompletność i18n PL/EN/SV (jeśli wypełniony przez C3) | **TAK** | — (C4 nie weryfikuje treści C3) |
| 09_INDEKS_WIEDZY.md | docs/handover/ | Etap C4 | Ten indeks | **TAK** | — |
| CLAUDE_SHELL_GATE_SUMMARY.md | shots-start/ | Builder / Visual | Podsumowanie gate Claude shell | **TAK** | — |
| DEMO.md | shots-start/ | Builder / Visual | Demo shots notes | **TAK** | — |
| FROM_ZERO_CLAUDE_BUILDER_SUMMARY.md | shots-start/ | Builder / Visual | Builder summary FROM ZERO | **ARCHIWUM-HISTORIA** | CLAUDE_SHELL_GATE / FINAL_SQUINT |
| FROM_ZERO_VISUAL_REGATE_SUMMARY.md | shots-start/ | Builder / Visual | Visual re-gate FROM ZERO | **ARCHIWUM-HISTORIA** | CLAUDE_SHELL_GATE / FINAL_SQUINT |
| GLASS_DENSE.md | shots-start/ | Builder / Visual | Notatki dense glass | **NIEAKTUALNE** | CLAUDE_SHELL_GATE / FINAL_SQUINT |
| SOT_FLIP_SHELL_SUMMARY.md | shots-start/ | Builder / Visual | Summary SoT flip shell | **TAK** | — (summary decyzji) |
| VISUAL_V4_BUILDER_SUMMARY.md | shots-start/ | Builder / Visual | Builder summary v4 (era odrzucona) | **NIEAKTUALNE** | CLAUDE_SHELL_GATE / FINAL_SQUINT |
| (oryginały SoT) | /workspace/watch-tower/ | Canon poza app | Oryginały równoległe do docs/watch-tower/ (ETAP 0.5 diff OK). Indeks ścieżek w app = docs/watch-tower/. | **TAK** | Nie edytować oryginałów bez sync; C4 headery tylko w docs/watch-tower/ |

---

## Nagłówki NIEAKTUALNE wstawione (C4)

W katalogu `docs/watch-tower/` (nie w oryginałach `/workspace/watch-tower/`, o ile nie zsynchronizowano) dodano widoczny nagłówek / banner dla m.in.:

- `research-2026/ANTI_SLOP_*`, `research-2026/anti-slop-2026-09-23/*`
- `research-2026/VISUAL_V4_*`, `CLAUDE_CRAFT_*`, `VISUAL_BRIEF_ELITE*.md` (research), `02_VISUAL_REFS*`, `VISUAL_REFS_2026`, `ELITE_GAPS`, `FIX_P0_GLASS_PATHS`
- `research-2026/02_UX_UI_2026.md`, `04-ux-ops-trends-2026.md`
- `research-2026/visual-gate-v2|v3|v4|2026-09-23/*`
- `claude-makieta.html`, `claude-visual-ref/tower-makieta.html`, `extracted.css`, `claude-visual-ref/README.md`, `claude-visual-ref/CURSOR_PROMPT.md`

**Nie usuwano plików. Nie przenoszono do `docs/archiwum/`** (nagłówek in-place wystarcza).

## Uwagi dla buildera

1. Zanim zmienisz typografię / tokeny — sprawdź kolumnę **Aktualny?**; anti-slop z Plex **przegrywa** z Barlow/Claude v2.0.
2. `CURSOR_PROMPT` opisuje stack **docelowy** (Next/Supabase) — makieta działa na Vite/React; nie „naprawiaj” makiety pod Next bez osobnej decyzji.
3. Pełne rozstrzygnięcie trzech HTML referencji = **C5**, nie ten plik.

