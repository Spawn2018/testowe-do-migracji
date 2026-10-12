# SG-03 — porównanie ETA przed/po H-4 (05.10.2026)

## Kontekst
Decyzja właściciela A→B→C. H-4: czas pracy kierowcy z GPS naczepy, **bez tachografu na stałe** (D-85).
Load: `963e19dd-fe83-4690-9306-5c7fc4b95468` · naczepa GD035YX · status `IN_TRANSIT_SE`.

## ETA przed H-4 (raport etykiet ~18:30 PL, proporcjonalny odpoczynek)
Źródło: `RAPORT_SG03_ETA_ETYKIETY_05_10.md`.

| Moment | ETA (Boden, Europe/Warsaw) | Składniki | Uwagi |
|---|---|---|---|
| Wcześniej | 06.10 ~07:03 | jazda + odpoczynek/przerwy **proporcjonalnie** | skok później |
| Tuż przed H-4 | 06.10 ~01:02–01:17 | jazda ~3,93 h · odpoczynek ~2,54 h · przerwy ~0,46 h (~201 km) | odpoczynek = frakcja × 11 h, **nie** reguła UE |

## ETA po 0185 (prod, ~19:51 PL, refresh_load_eta)
| Pole | Wartość |
|---|---|
| ETA | **05.10 23:47** |
| method | ETA v2 (OSM) (H-4 w `causes`) |
| causes.h4 | true · h4_source=`gps` · h4_cautious=`false` · tachograph=`none` |
| drive_h / rest_h / breaks_h | 3,93 / **0** / **0** |
| remaining_km | 201,3 · confidence ±47 min · delay_minutes=0 |
| flags | pozycja GPS — postęp na korytarzu OSM; przerwa z GPS ×2 |

**Dlaczego bez 11 h odpoczynku:** stan kierowcy z GPS (`h4_source=gps`) — przerwy już wykryte z postojów; pozostała jazda ~3,9 h mieści się w limicie dnia bez dobowego odpoczynku. To zgodne z H-4 (nie proporcja do trasy).

**Znaczniki B (UI):** ETA 23:47 → **przyjazd nocą** (22–06) + **przed terminem** (plan dostawy 07.10) — bez decyzji w Centrum / bez SMS.

## Przyjazd rzeczywisty do Boden
`actual_delivery_at` nadal null. Po rozładunku `trg_h4_eta_observation` zapisze II-7b.

## Wdrożenie
- PR **#120** (H-4+B) · Hobby **#121** · deploy `dpl_G5p1pkMgtKMjaX8o6Sx6U2pWfrsb`
- Migracja **0185** apply-prod + verify OK
- Obie domeny **200**
- Brama: i2 535 · h4 12 · nullguard 593 · security 88

## SMS / e-mail
Bez zmian: SG-03 tylko do właściciela.
