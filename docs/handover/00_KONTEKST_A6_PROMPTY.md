# A6 — Prompty źródłowe (częściowe / sampled)

## Meta / paging ReadTranscript

| Pole | Wartość |
|---|---|
| Agent | `8f0d9d27-789e-4b31-bed8-10c6e4900c24` („watch tower - koordynator”) |
| Narzędzie | Parent (koordynator) **uruchomił** `ReadTranscript` |
| Zakres znany | Najnowsze strony: pozycje ~**1897–1928**, ~**1879–1896**, ~**1496–1554** z ~**1941+** |
| Paging `before=` | Kontynuowany wstecz przez erę popołudniowego deployu; **nie** dociągnięty do pozycji **0** w jednym przebiegu |
| Ten plik | **sampled major user turns** z ReadTranscript + eksport Claude — **nie** pełny dump wszystkich user turns |

**Uczciwie:** pełny chronologiczny dump A6 do `before=0` nadal **otwarty**, jeśli parent nie domknie paginacji.

---

## 1. ROZMOWA_CLAUDE.txt — wiadomości [HUMAN] (dosłownie)

Źródło: `/workspace/watch-tower/ROZMOWA_CLAUDE.txt` · eksport Claude 2026-09-22 ~23:56 Europe/Warsaw


### HUMAN #1

```
(Sep 22, 2026, 11:14 PM):
```


### HUMAN #2

```
(Sep 22, 2026, 11:33 PM):
mam wyniki od gemini i deep seek zrób z tego pozytek i ponownie daj mi outpoot oraz koda dla cursor. W outpoot napisz mi o co musze zapytac się przewoźnika. juto mam z nim spotkanie
```


### HUMAN #3

```
(Sep 22, 2026, 11:48 PM):
pokaż mi makiete html jak bedzie to wygladalo. Plik ma byc klikalny i wstępnie wypełniony 50 różnymi transportami. Chcę zobaczyć jak zaprojektowałeś i pokazać na spotkaniu
```


---

## 2. CURSOR_PROMPT (pełny tekst)

Zobacz: [`CURSOR_PROMPT_ZRODLOWY.md`](./CURSOR_PROMPT_ZRODLOWY.md) (= kopia `/workspace/watch-tower/CURSOR_PROMPT.md`).

To **nie** jest wiadomość Sebastiana w Cursorze — to prompt wygenerowany przez Claude do wklejenia w Cursor Plan Mode (Next/Supabase). Makieta Vite zbudowana później odbiega stackiem.


---

## 3. Rekonstrukcja wymagań z AUDIT_CHAT_REQUIREMENTS (NIE dosłowny transcript)

Plik: `/workspace/watch-tower/AUDIT_CHAT_REQUIREMENTS.md` — statusy DONE/PARTIAL/GAP zmapowane z „wiadomości Sebastiana (cały czat)”. Sekcje A1–A9, B1–B10, C1–C18, D1–D4, E1–E2. **Brak gwarancji dosłowności sformułowań użytkownika.**


---

## 4. Wskaźnik luk A6 (aktualizacja po ReadTranscript)

- Pełny dump **wszystkich** user turns do pozycji 0: **nadal niekompletny** (paging nie doszedł do 0).
- Poniżej §5 = **potwierdzone major turns** z próbek ReadTranscript (Europe/Warsaw, czasy przybliżone).
- „Final prompt” t110u: pełny tekst w transkrypcie; na dysku w `docs/handover/` **brak** osobnej kopii poza skrótem poniżej + `CURSOR_PROMPT_ZRODLOWY.md` (inny dokument — Plan Mode Claude→Cursor).


---

## 5. Cursor — wiadomości użytkownika (ReadTranscript, dosłownie gdzie możliwe)

Źródło: ReadTranscript agent `8f0d9d27-789e-4b31-bed8-10c6e4900c24` (parent). Czasy **przybliżone** Europe/Warsaw (UTC+2). Identyfikatory turnów jak w próbce parenta.

### 5.1 ~12:47 — t95u

```
nie dziala link ktory udostepniles. napraw to
```

### 5.2 ~12:48 — t96u

```
dlaczego przestal działać? Ten link musi działać jeszze przez kilka dni, na tym samym linku co dales mi pierwotnie
```

### 5.3 ~12:51 — widget answer t96s2 → hosting

Użytkownik (przez widget): `Ustaw stały hosting i daj mi nowy URL na kilka dni`.

**Skutek (z docs / QA):** Vercel **https://watch-tower-makieta.vercel.app/** · projekt `watch-tower-makieta` · konto / kontekst `sebastianbozekq-7781s` (per prompt parenta + `docs/qa-start/batch-pm/VISUAL.md`).

### 5.4 ~21:05 — t110u · PROMPT FINALNY handover

Pełny tekst w transkrypcie **t110u**; skrót struktury:

> Pełny tekst w transkrypcie t110u; skrót struktury: KONTEKST + ZASADY + ETAP 0/A/B/C/D + D1–D17 + CZEGO NIE WOLNO + kolejność STOP.

Na dysku w `docs/handover/`: **brak** osobnego pliku z pełnym t110u. `CURSOR_PROMPT_ZRODLOWY.md` to **inny** prompt (Claude Plan Mode). **SoT pełnego tekstu = transcript t110u u parenta** — parent musi trzymać / domknąć paging.

### 5.5 ~21:10 — t111u · POTWIERDZENIE ETAPU 0 + ETAP 0.5

Potwierdzenie odpowiedzi Etapu 0 oraz **ETAP 0.5** (git freeze) z m.in.:

- A6/A7: używać **ReadTranscript**
- A8: sibling boty (UX / Visual / Research / QA)
- C2: kolejność zegara
- C3: i18n
- D18: demo rates
- 6-punktowy prompt dla UX / Visual / Research / QA

Baseline po 0.5: commit **`305da3e`** · tag annotated **`baseline-2026-09-23`** (`docs/ETAP_0_5_GIT.md`).


---

## 6. Mandaty z Durable Memory / epizodów (nie dosłowny transcript — etykieta MEMORY)

Parafrazy oznaczone **MEMORY** — nie cytować jako dosłowne user turns:

| # | Mandat (MEMORY) | Uwagi |
|---|---|---|
| M1 | Claude v2.0 jako visual SoT + **optical eye gate** | Ścieżka SoT / squint; nie mylić z anti-slop-only |
| M2 | **Polish UI hard rule** | Domyślny locale PL; QA wymaga PL |
| M3 | Sekwencja rebuild ~**11 punktów** (p1 finish mockup … p10–11 public link) | Mandat z memory/todos; dokładny string „11-point” może **nie** wystąpić w jednej wiadomości |
| M4 | **Economy mode** — krótkie odpowiedzi | Styl komunikacji bota |
| M5 | **Freeze chrome**, potem wire functions | Najpierw wygląd Claude v2, funkcje pod spodem |

---

*Koniec A6 pliku. Uzupełniać po dalszym `before=` pagingu.*
