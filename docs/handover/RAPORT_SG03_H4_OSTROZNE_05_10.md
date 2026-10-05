# SG-03 — H-4 poprawka ostrożna + niepewność (05.10.2026)

## Kontekst
Load `963e19dd-fe83-4690-9306-5c7fc4b95468` · GD035YX · `IN_TRANSIT_SE`.
Historia GPS w Tower od **05.10 13:25** (włączenie emtrack). Decyzja właściciela: brak znanego odpoczynku dobowego → **założenie ostrożne** (nie „świeży kierowca”).

## Emtrack — historia sprzed podłączenia (pkt 2)
| Pytanie | Wynik |
|---|---|
| Czy klient WEB daje historię trasy naczepy sprzed 13:25? | **NIE** (w obecnym protokole) |
| Dowód | `RAPORT_TELM_EMTRACK_WEB_05_10.md`: tylko `GET_TRACKING_OBJECTS` + `currentSnapshot`; `GET_TRACKING_OBJECTS_SNAPSHOTS` → **ERROR_403** |
| Skutek | Przy podłączeniu transportu w trasie **nie** da się odtworzyć ostatniego odpoczynku z emtrack WEB. Zostaje założenie ostrożne (0186) do czasu oficjalnego API / innej warstwy z historią. |

## ETA porównanie (Europe/Warsaw)

| Moment | ETA Boden | rest_h | cautious | Uwagi |
|---|---|---|---|---|
| Przed H-4 (~18:30) | 06.10 ~01:02–01:17 | ~2,54 (proporcja) | n/a | odpoczynek ≠ UE |
| Po 0185 (~19:51) | **05.10 23:47** | **0** | false | jak świeży kierowca — **błędne** |
| Po 0186 (~20:46 PL, refresh_load_eta) | **06.10 ~10:27** | **11** (+ breaks 0,75) | **true** | h4_source=cautious · conf ±**184** min (H4_EU_REST 165 + H4_CAUTIOUS 61) — nie „Wysoka” |

Liczby z prod po apply **0186** + `refresh_load_eta` (load SG-03). Przed refresh tego wieczoru ETA ~05.10 22:34 (nadal rest_h=0).

## Przyjazd rzeczywisty / SMS
- `actual_delivery_at`: **czekamy na wjazd** (null w raporcie po 0185).
- SMS „1 h przed”: **jeszcze nie** (albo tylko właściciel — bez zmiany polityki).
- Po wjeździe: `trg_h4_eta_observation` → II-7b.

## II-7b — wnioski do kalibracji
1. Mid-trip GPS bez `last_rest` **musi** być ostrożne — inaczej ETA zbyt optymistyczne (SG-03: 23:47 vs realny odpoczynek).
2. Pasmo: rest z GPS ≠ ±0% (I-15 dotyczyło stałego odcinka proporcjonalnego); „Wysoka” tylko ≤60 min.
3. Brak historii emtrack przed podłączeniem → nie kalibrować rest z „dziury” przed 13:25.

## Wdrożenie
- Branch `feat/h4-ostrozne-niepewnosc-05-10` · migracja **0186** (apply-prod + verify OK)
- Testy `tests/db/h4.sh`: **19/19** (w tym 0186 a/b/c); brama EXIT:0 (session/l13 soft-skip)
- PR **#123** → main · Hobby **#124** · domeny: po READY deploy
