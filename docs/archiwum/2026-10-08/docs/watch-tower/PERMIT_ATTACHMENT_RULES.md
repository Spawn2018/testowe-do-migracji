# Reguły podpinania plików zezwoleń (PL / SE)

## Model w makiecie — dwa typy dokumentu

| Typ w systemie | Znaczenie | Podpinanie |
|---|---|---|
| `PERIOD` | Zezwolenie na okres (1–24 mies. / SE recurring) | **Jednorazowy upload** z `valid_from` / `valid_to` (+ opcjonalnie nr rej., trasa, limity L/W/H/masa). Auto-pokrywa transporty, których **data załadunku** ∈ okresu i parametry zestawu ≤ limity dokumentu. |
| `TRIP` | Okno przejazdowe / jednorazowy przejazd | **Plik obowiązkowy na każdym transporcie** (lub na oknie 14/30 dni kat. V wielokrotnym — wtedy jeden plik może pokryć N przejazdów tylko w tym oknie i na tej trasie/nr rej.). |
| `REGULATION` | Ścieżka bez decyzji (TSFS 2023:36/37) | **Brak pliku zezwolenia** — checklista zgodności (oznakowanie, varningsbil…). |

---

## POLSKA (źródła: MI gov.pl; PoRD art. 64b–64d; tabela GDDKiA)

### Okresowe = `PERIOD` (nie per każdy transport)

| Kat. | Ważność | Uwagi |
|---|---|---|
| **I** | **12 miesięcy** | Tylko pojazdy wolnobieżne / ciągniki rolnicze (+ przyczepa specjalna) — **nie dotyczy** korytarza Stegra stal. Wskazuje podmiot + pojazd. |
| **II** | **1 / 6 / 12 / 24 miesiące** (wybór we wniosku) | Okresowe. Art. 64c. |
| **III** | **1 / 6 / 12 / 24 miesiące** | Okresowe. Drogi krajowe. |
| **IV** | **1 / 6 / 12 / 24 miesiące** | Okresowe. Masa ≤60 t, limity szer. zależne od typu drogi. |

**UX:** SCX/HHL wgrywa PDF raz → status „aktywne do daty”. Transport w okresie + mieszczący się w limicie dokumentu dostaje status DOCS: zezwolenie PL = OK bez ponownego uploadu. Alert T-48 jeśli brak aktywnego PERIOD pokrywającego parametry.

### Przejazdowe / okno trasowe = `TRIP` (podpinać pod transport / okno)

| Kat. | Ważność | Reguła pliku |
|---|---|---|
| **V jednokrotny** | **14 dni** od daty ze wniosku | **Jeden przejazd** na wyznaczonej trasie; we wniosku konkretne nr rej. ciągnika + naczepy. **Powrót = nowe zezwolenie** (GDDKiA). → **plik per transport (per kierunek)**. |
| **V wielokrotny** | **30 dni** | Wiele przejazdów w oknie, ta sama trasa / warunki decyzji. → jeden plik może pokryć kilka transportów **tylko** jeśli data ∈ 30 dni, trasa i nr rej. zgodne z decyzją; inaczej nowy plik. |

---

## SZWECJA

### Bez decyzji = `REGULATION`
- **TSFS 2023:36** (szer. odelbar ≤3,50 m, tylko szerokość)  
- **TSFS 2023:37** (dł. odelbar ≤30 m, tylko długość)  
→ brak PDF „dispens”; w systemie: flaga ścieżki + checklista.

### Dispens Trafikverket / gmina = zależnie od decyzji

Źródło: [Trafikverket — Giltighetstid](https://bransch.trafikverket.se/for-dig-i-branschen/vag/Transportdispens/infor-ansokan/Giltighetstid/) (akt. 2025-06-17):

| Rodzaj dispensy (praxis TV) | Typowa ważność | Typ w makiecie |
|---|---|---|
| **Enstaka transport** (jedna jazda) | zwykle **≤ 30 dni**, jedna färd | `TRIP` — plik **per transport** |
| **Återkommande** na konkretnej trasie | zwykle **30–360 dni**; przy wadze max **90 lub 180 dni** | `PERIOD` — jeden plik + daty; auto-pokrycie w oknie |
| **Generell vägnätsdispens** (ciężkie / wybrane przypadki) | do **360 dni** (ciężkie na BK1/BK4 E4–499 w regionie) | `PERIOD` |
| **Szerokie pojazdy** (określone przypadki recurring) | do **1 800 dni** (~5 lat) przy max szer. zwykle ≤310 cm (wyjątki) | `PERIOD` (rzadkie dla ładunku stalowego 3,6 m — raczej nie ten tryb) |

Ogólna rada Transportstyrelsen: wiele jazd — ważność raczej **nie > 5 lat**.

---

## Mapowanie na pozycje SCX (Stegra)

| Pozycja | PL (z klasyfikacji) | Plik PL | SE | Plik SE |
|---|---|---|---|---|
| Płatwie, belki, tężnik (normatywne*) | brak zezwolenia nienorm. | — | w normie* | — |
| Słupy główne, element ref., stężenia, słupy skrajne | kat. **II–IV okresowe** | **`PERIOD`** raz na okres | TSFS 36 lub w normie | `REGULATION` / — |
| **Kratownice W=3,6** | **IV tylko A/S** albo **V** | jeśli **V** → **`TRIP`** (14/30 dni); jeśli uda się **IV okresowe** na całą trasę A/S → `PERIOD` | **dispens** obowiązkowy | zwykle start jako **`TRIP`** (enstaka ≤30 dni); jeśli TV wyda recurring na trasę Nynäshamn→Boden → `PERIOD` 30–360 dni |

\* naciski/masa w limicie.

---

## Reguła produktowa (do kodu M6)

```
IF doc.kind == PERIOD:
  cover(load) = load.load_date in [valid_from, valid_to]
             AND load.set_LWH_mass within doc.limits
             AND (doc.plates empty OR load.plates match)
             AND (doc.route empty OR load.route compatible)
IF doc.kind == TRIP:
  require explicit load_id link (or window_id for V-multi / SE recurring short)
IF path == TSFS_36|TSFS_37:
  no permit file; require checklist complete before READY
```

Alerty: brak pokrycia PERIOD/TRIP na T-48; PERIOD wygasa w ≤14 dni.
