# AUDYT — wymagania z wiadomości Sebastiana (cały czat) → status

**Zasada Sebastiana (2026-09-23):** nic nie odraczać, nie zawężać, zero wydmuszek. Wszystko z czatu ma działać w makiecie.
**Odświeżenie statusów:** 2026-09-23 03:10 Europe/Warsaw.

Full-chat audit + WF 7→12 (Claude names + 5 product rules under `.wf`). SoT: `/workspace/watch-tower-app/AUDIT_FULL_CHAT.md` · `FUNCTIONS_UNDER_CLAUDE.md`. FINAL_SQUINT PASS → C4 DONE. QA_RE_SHIP 10/10 SHIP. Build PASS · preview 4177.


Status: **DONE** | **PARTIAL** | **GAP** | **IN_PROGRESS**

---

## A. Brief otwierający (pliki Claude + makieta)

| # | Co kazał | Status | Uwagi |
|---|---|---|---|
| A1 | 100% funkcjonalności z plików Claude (nie węższy zakres) | DONE | M1–M12 + CTA pod Claude shell; FUNCTIONS_UNDER_CLAUDE.md |
| A2 | Można przeprojektować / rozszerzyć; zero AI-slop | PARTIAL | Cold steel + IBM Plex; glass po poprawce gęsty; anti-slop checklist w research |
| A3 | Inspiracje z internetu, stan na 2026 | DONE | research-2026/ pack |
| A4 | Logiczny zmapowany UX | DONE | UX_MAP.md |
| A5 | 100% klikalny workflow, zero wydmuszek | DONE | E2E §2 + READY←cover + Wave1 hollow fixes |
| A6 | Minimum 60 transportów | DONE | 62 loads |
| A7 | Każda funkcja i każdy moduł działa | DONE | READY←cover; ZIP/Eksport/factoring/SEFS/ETA/Ustalenia/WF run 02:55 |
| A8 | Zespół botów + koordynacja | DONE | WT UX/QA/Research/Visual |
| A9 | Użyć makiety HTML Claude jako ref | DONE | START_UI_SPEC / visual vs Claude |

## B. Motywy / adresy / BAF / zezwolenia / cennik / faktoring / KSH

| # | Co kazał | Status | Uwagi |
|---|---|---|---|
| B1 | KSH light, HHL dark (Stegra light → potem usunięte) | DONE | theme per role |
| B2 | Załadunek Grunwaldzka 27C Śrem; rozładunek Stalverket 20 Boden | DONE | SITES + geofences |
| B3 | BAF Word → SEFS hybrid OKQ8/ORLEN min | DONE | sefs.ts + tables |
| B4 | Precyzyjne limity PL/SE zezwoleń (research 100%) | DONE | PERMITS_PL_SE.md |
| B5 | PERIOD vs TRIP podpinanie plików | DONE | cover() + Docs GAP UI; READY blocked on TRIP/PERIOD gap |
| B6 | Cennik SCX Excel — tylko ceny bazowe + wymiary/wagi/ilości | DONE | scxRates + classification |
| B7 | Zaszeregować pozwolenia do pozycji cennika | DONE | PERMIT_BY_RATE_LINE.json |
| B8 | Faktoring SCX; HHL ustawia % i dni/godziny | DONE | InvoicesView HHL configure + SCX choose → store |
| B9 | Wprowadzić KSH_HARMONOGRAM.xlsx | DONE | loads.json from schedule |
| B10 | Pokazać makietę na komputerze | DONE | preview + desktop |

## C. START!!!! (elite upgrade)

| # | Co kazał | Status | Uwagi |
|---|---|---|---|
| C1 | Burza mózgów, podział zadań, rozszerzenie modułów | DONE | research-2026 + team orders |
| C2 | Więcej danych, predykcje, dokładność predykcji | DONE | M12 bands LOW/MED/HIGH + earliest–latest + chips; heurystyka labeled |
| C3 | Prawdziwe API (mapy, drogi SE) | PARTIAL | Leaflet+Esri; Trafikverket+AIS labeled live|seed w Map note; live needs key |
| C4 | Pozbyć się generycznego wyglądu; SOTA UX/UI wrzesień 2026 | DONE | FINAL_SQUINT_GATE_RESULT PASS; chrome frozen; anti-slop + Claude craft |
| C5 | Więcej workflow | DONE | 12 rules: 7 Claude PL names + 5 product (wf-8…12) same `.wf`/`.sw`; run→notification |
| C6 | Top-tier inżynieryjnie + elite business | PARTIAL | makieta Vite in-memory (nie Next/Supabase Claude stack) — **funkcje** muszą być pełne w makiecie |
| C7 | Real maps + trasy ponadgabarytowe | DONE | corridor_ref.json |
| C8 | Trafikverket API SE | PARTIAL | labeled live-or-seed w Map `.note`; live iff TRAFIKVERKET_API_KEY |
| C9 | Symulacja ruchu ciężarówek | DONE | fleet tick |
| C10 | Living/working program feel | PARTIAL | |
| C11 | Collapsible side menu | DONE | 186↔56 + sessionStorage.wtNavCollapsed |
| C12 | Loga firm na kontach | DONE | HHL/KSH/SCX |
| C13 | Glass OK jeśli trendy, nie AI-slop | DONE | dense 97/98.5 after feedback |
| C14 | Import harmonogramu button + DnD | DONE | ExcelJS dry-run→commit (KSH); Eksport XLSX wired (HHL chrome) |
| C15 | Usunąć widok/rolę Stegra (HHL/KSH/SCX only) | DONE | |
| C16 | Każdy tile/link klikalny, filtr, deep-link | DONE | spine 2nd-click clear; KPI navigateTo; bell deep-link |
| C17 | Bell + counter + mark read + clear/vanish | DONE | read:true + historia; badge z unread |
| C18 | Glass nie za przezroczysty (follow-up) | DONE | |

## D. Promy / AIS

| # | Co kazał | Status | Uwagi |
|---|---|---|---|
| D1 | Sprawdzić API przepraw | DONE | Polferries brak; Stena portal; Unity/TT brak |
| D2 | Wiedzieć jaki statek kiedy wypływa | DONE | ferry-sailings seed HTML pattern |
| D3 | Darmowe API lokalizacji + na mapę | PARTIAL | AIS proxy live mode verified; QA later AIS seed only / MapLibre worker |
| D4 | Wawel + Nova Star MMSI | DONE | |

## E. Meta (ten turn)

| # | Co kazał | Status |
|---|---|---|
| E1 | Głęboki audyt wiadomości | DONE | CLOSEOUT_STATUS.md |
| E2 | Nic nie odraczać; dosłownie wszystko | DONE | closeout sprint applied (see CLOSEOUT_STATUS); Re-QA remaining |

---

## Blokery do zamknięcia TERAZ (kolejność)

1. Real XLSX parse → dry-run → commit (no SG-99 hardcode) — DONE + Eksport XLSX
2. Spine second-click clears filter
3. Bell mark-read (keep history) + aria-haspopup
4. sessionStorage.wtNavCollapsed
5. Zero hollow: Plan B, camera→vault, ZIP real, Eksport, factoring UI — DONE 02:55
6. Permit cover gates READY; TRIP/REGULATION UI complete
7. MapLibre tiles/worker fix + AIS live stable with proxy
8. ETA confidence band LOW/MED/HIGH + earliest–latest + reason chips on every load
9. Full e2e click path UX_MAP §2 (import→assign→resources→permits→ferry→geofence events→POD→collective invoice→factoring)
10. Expand workflows beyond 7 with run log → notifications — DONE (12 rules 03:10)
11. Grow data diversity (ferry assignments, invoice weeks ≥3, permit stress)
12. Trafikverket live when key present; seed labeled honestly
13. Driver PWA: GPS share + 4 milestones + camera stores file in vault
14. Geofence editor fully mutates + notifies
15. Finance SEFS waterfall + below-threshold flag working
16. Re-QA until SHIP (not FIX)

**Świadomie NIE „odraczamy” research P2 jako produkt** — w makiecie realizujemy zachowanie; zewnętrzne API bez klucza = seed z etykietą, nie fake „live”.
Claude Next/Supabase = architektura docelowa w plikach; makieta Vite ma mieć **pełną funkcjonalność biznesową** 1:1 z UX_MAP + czat.
