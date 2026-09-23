# PUNKT 7 — loads i ryzyka (Economy / PL)

## Zakres

- Rozszerzono seed z **62 do 72 transportów** (+10): `SG-31`, `SG-32`, `T-17`, `SG-33`, `SG-34`, `T-18`, `SG-35`, `SG-36`, `R-03`, `SS-08`.
- Zachowano istniejący chrome i układ v2; zmiana dotyczy danych seed oraz istniejącego mechanizmu kolejki wyjątków.
- Każdy nowy transport ma realistyczny status, daty, wymiary, zasoby, pricing, geolokalizację korytarza i dane promowe tam, gdzie potrzebne.

## Pokrycie ryzyk

Seed daje **28 ryzyk / 28 wyjątków** w kolejce `Wymaga decyzji`:

| Typ | Liczba | Przykłady P7 |
|---|---:|---|
| `DOC` | 6 | permit mismatch `SG-34`, brak `PERMIT_SE` `SG-36` |
| `OPS` | 12 | silent GPS `SG-33`, sekwencja `T-18 → SG-35`, wiatr `SG-35`, brak eskorty `R-03` |
| `FERRY` | 2 | anulowany `Nova Star` dla `SG-32`, Plan B |
| `ROAD_SE` | 3 | zamknięcie E4 Luleå dla `T-17`, objazd i ETA |
| `FORCE_MAJEURE` | 5 | oblodzenie E4 Gävle–Sundsvall dla `SG-31`, śnieżyca, sztorm, strajk |

`buildSeedExceptions(loads, risks)` nadal tworzy wyjątki bezpośrednio z ryzyk, więc nowe wpisy są widoczne w kolejce i mają kod operatora (np. `SG-34`, nie surowe `load-*`). Dodano także seeded `MISMATCH` dla permitu `SG-34`; logika uploadu traktuje `SG-07` i `SG-34` jako kontrolowane przypadki mismatch.

## QA

- `npm run build` — **PASS**
- Runtime smoke po wyczyszczeniu persisted state: **72 loads / 28 risks / 28 exceptions**
- Rozkład runtime: `DOC 6`, `OPS 12`, `FERRY 2`, `ROAD_SE 3`, `FORCE_MAJEURE 5`
- Screenshot: `/tmp/wt-p7-risks.png`
