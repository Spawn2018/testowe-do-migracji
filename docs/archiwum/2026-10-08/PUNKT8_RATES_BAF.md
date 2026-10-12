# PUNKT 8 — Cennik SCX + BAF / SEFS

## Zakres

- HHL → **Opcje** w języku polskim, bez zmiany chrome Claude v2 / Economy.
- Dodano dwa zwarte panele do szybkiej edycji: **SCX · cennik bazowy** oraz **BAF / SEFS · paliwo**.
- Cennik pokazuje trzy linie kosztu SCX i trzy linie przychodu HHL; każda linia ma zakres L/W/H/masa i jedną edytowalną kwotę bazową w PLN.
- Panel paliwowy dzieli parametry na odczyt indeksu i zasady naliczania: źródło, ceny bazowe/bieżące, daty, udział paliwa, próg, zaokrąglenie, minimum/maksimum oraz URL źródła.
- Pola zapisują się natychmiast przez istniejący Zustand `persist`: `rateCost`, `rateRev` i `baf`. Zmiany dotyczą kolejnych snapshotów wyceny; istniejące snapshoty transportów pozostają niezmienione.

## QA

- `npm run build` — **PASS**
- `npm run lint` — **PASS** (istniejące ostrzeżenia poza zakresem P8)
- Runtime smoke: 6 pól cennika + 11 pól BAF/SEFS; edycja `rateCost[0]` i `baf.currentValue` przeżywa reload z localStorage — **PASS**
- Screenshot: `/tmp/wt-p8-opcje-cennik.png`
