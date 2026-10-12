# INWENTARZ PLIKÓW PROJEKTU (stan 08.10.2026)

> Zastępuje inwentarz z 29.09.2026. **Wykonawca stosuje jako polecenia wyłącznie pliki z części 1.** Część 2 to dzienniki (dopisujesz, nie wykonujesz). Część 3 to wiedza techniczna o istniejącym kodzie: pomaga zrozumieć stan, ale nie jest wzorem docelowym; tam, gdzie jest sprzeczna z częścią 1, nie obowiązuje. Część 4 — nigdy jako polecenie.

## 1. Aktualne — polecenia (w tej kolejności przy sprzeczności)
1. `docs/handover/wzorzec/01_KONSTYTUCJA.md` (ze zmianami z 08.10.2026)
2. `docs/handover/audyt_claude_2026-10-08/` — cały folder:
   - `README.md`
   - `DECYZJE_08_10.md`
   - `ROZSTRZYGNIECIA_LUK.md`
   - `UZGODNIENIE_08_10.md` (pkt 6 historyczny — kolejność paczek w `PLAN.md`)
   - `PLAN_OTWARTE_08_10.md`
   - `WYMIARY_PILOT_ZEZWOLENIA.md`
   - `etapy/`, `makiety_html/`, `raport/`, `paczki/`
3. `docs/handover/PLAN.md` (08.10.2026) i `docs/handover/dopiski/`
4. `docs/handover/wzorzec/03_REJESTR_DECYZJI.md` — wpisy bez znaku „🔁 zastąpione 08.10.2026”
5. `AGENTS.md`, `.cursor/rules/*.mdc` (08.10.2026)
6. `docs/handover/wzorzec/08_SKILLE/` — procedury (08.10.2026)
7. `docs/handover/wzorzec/00_INDEKS.md`, ten plik

## 2. Dzienniki (dopisujesz)
- `docs/handover/POSTEP.md` — co zrobione (starsze wpisy cytują stare zlecenia — to historia, nie polecenie)
- `docs/handover/G4_WZORZEC.md` — odświeżenia wzorców zrzutów

## 3. Wiedza techniczna i instrukcje obsługi (nie polecenia)
| Plik | Do czego | Uwaga |
|---|---|---|
| `docs/handover/KOPIE_ZAPASOWE.md` | kopie R2, odtwarzanie | aktualny |
| `docs/handover/INSTRUKCJA_BRAMKA_SMS_ANDROID.md` | bramka SMS Android | aktualny; ścieżkę cytuje aplikacja (`src/i18n/i2.ts`) — nie przenosić |
| `docs/handover/PRZELACZENIE_HOSTINGU.md` | Vercel ↔ Cloudflare Pages | aktualny |
| `docs/handover/NARZEDZIA_CURSOR.md` | wtyczki MCP | aktualny w zakresie zgodnym z `AGENTS.md` §6 |
| `docs/handover/CI.md` | hak i testy bazy | częściowo nieaktualny — obowiązuje `AGENTS.md` §3 |
| `docs/handover/DESIGN_SYSTEM.md` | tokeny, kroje | wzorem jest makieta etapu audytu; kontrast według E10 |
| `docs/handover/CELE_KLIKNIEC.md` | cele kliknięć L-4 | zmiany według E5 i E7 |
| `docs/handover/SECURITY.md` | zabezpieczenia bazy | §1 „zakaz security_invoker” i §3 zastępuje E19 |
| `docs/handover/LIMITY_PLANU_DARMOWEGO.md` | usage-check | od 08.10 plan Supabase Pro |
| `docs/handover/RAPORT_HERE_REGULAMIN.md` | cytaty regulaminu HERE | wniosek „Base Plan nie pozwala” zastąpiony przez D-77, D-78 |
| `docs/handover/RAPORT_KALIBRACJI_ETA.md` | szablon raportu kalibracji | kalibracja według E15 |
| `docs/handover/RAPORT_POGODA_MORSKA.md`, `RAPORT_TELM_EMTRACK_WEB_05_10.md`, `EMTRACK_HISTORIA_SPRZED_05_10.md`, `PROPOZYCJA_H10_WIATR_ETA.md` | źródła danych, protokoły | wiedza |
| `docs/handover/SEC_OWASP_ASVS_L2.md`, `docs/evidence/zap/*` | stan bezpieczeństwa 05.10 | punkt wyjścia E48 |
| `docs/handover/wzorzec/04_KONEKTORY.md` | katalog usług | wpisy „Supabase Free”, „jeden projekt” i „HERE odrzucone” nie obowiązują (Pro, TEST, D-77/D-78) |
| `docs/watch-tower/ADDRESSES.md`, `docs/watch-tower/permits-research/*` | adresy, źródła prawne | dane referencyjne |
| `design/claude-v2.0/*` | makieta v2.0 | wzór wyglądu tylko tam, gdzie etap audytu nie ma makiety |
| `docs/claude/referencje/tower.css` | arkusz referencyjny testu `stylesheet-mockup` | nie zmieniać; odstępstwa w `ODSTEPSTWA` |
| `public/download/tower-makieta.html` i inne makiety w `public/` | wymagane przez test `o2-prod-strip` w buildzie demo | nie są wzorem wyglądu |
| `README.md` | odsyłacz | — |

## 4. Archiwum — nigdy jako polecenie
- `docs/archiwum/` — archiwum sprzed 29.09.2026.
- `docs/archiwum/2026-10-08/` — 279 plików przeniesionych 08.10.2026 z zachowaniem ścieżek (lista 279 pozycji) oraz `stare-instrukcje/` (poprzednie `AGENTS.md` i reguły `.mdc` jako `.txt`). Lista: `docs/handover/audyt_claude_2026-10-08/paczki/P0a_lista_archiwum.txt`. Są tam m.in.:
  - stary `PLAN.md`, `SCOPE.md`, wszystkie `ZLECENIE_*.md`, `PACZKA_DECYZJI_*.md`;
  - `POLECENIA_KOORDYNATORA.md`, `PRZEKAZANIE_CURSOR.md`, `LOGIKA_SYSTEMU.md`, `REJESTR_CALOSCI.md`, `TRIAGE_REJESTRU.md`;
  - `wzorzec/02_AUDYT.md`, `05_KONTRAKTY_HANDLOWE.md`, `06_KONTRAKTY_TECHNICZNE.md`, `07_ZASADY_CURSOR/`, `09_WIZUALIZACJE.*`, `10_WZOR_NOWEGO_PROJEKTU.md`, `STAN/`;
  - `docs/watch-tower/**` (poza adresami i źródłami prawnymi), `docs/qa-start/**`;
  - pliki z katalogu głównego: `ACCEPTANCE.md`, `AUDIT_FULL_CHAT.md`, `FIX_*.md`, `PUNKT*.md`, `IDENTICAL_CLAUDE_FULL.md`, `FROM_CLAUDE_V2.md`, `FUNCTIONS_UNDER_CLAUDE.md`, `CURRENT_MOCKUP_CLOSEOUT.md`, `QA_RE_SHIP_FROZEN.md`, `SE_ROAD_AND_FORCE_MAJEURE.md` i ich kopie w `docs/`.
- Pliki z kwotami cenników (`RAPORT_BAF_CENY_94_05_10.md`, `WIP_BAF_CENY_05_10.md`, `BAF_SPEC.txt`) usunięte z repozytorium do `D:\Watch Tower\dane\archiwum-2026-10-08\` (folder `dane` obok folderu repozytorium) (zasada: pliki poufne poza repozytorium). Historia git ich nie usuwa — decyzja o czyszczeniu historii należy do właściciela.
- Komentarze w kodzie i w nałożonych migracjach, które cytują przeniesione pliki, zostają (migracji nałożonych nie zmieniamy). Nie są poleceniem.
