# SG-03 — porównanie ETA przed/po H-4 (05.10.2026)

## Kontekst
Decyzja właściciela A→B→C. H-4: czas pracy kierowcy z GPS naczepy, **bez tachografu na stałe** (D-85).

## ETA przed H-4 (raport etykiet 05.10, proporcjonalny odpoczynek)
Źródło: `RAPORT_SG03_ETA_ETYKIETY_05_10.md` / produkcja przed 0185.

| Moment | ETA (Boden) | Składniki (przybliżone) | Uwagi |
|---|---|---|---|
| Wcześniej | 06.10 ~07:03 | jazda + odpoczynek/przerwy **proporcjonalnie** do trasy | skok później |
| Tuż przed H-4 | 06.10 ~01:02–01:17 | jazda ~3,93 h · odpoczynek ~2,54 h · przerwy ~0,46 h (~201 km) | odpoczynek = frakcja × 11 h, **nie** reguła UE |

## H-4 — reguła na tym samym dystansie (~3–4 h jazdy)
Przy **założeniu ostrożnym** (brak pełnej historii GPS od odpoczynku): driven≈8,5 h → w ETA wchodzi **odpoczynek 11 h** + pozostała jazda, nie proporcja.
Test jednostkowy bazy: `h4_schedule_remaining(3.0, 8.5, 0, 8.5)` → total ≈ **14,0 h** (0,5 + 11 + 2,5), rest_h = 11.

## Po wdrożeniu 0185
- `compute_load_eta` method: `ETA v2 (OSM) + H-4 UE/GPS`
- `basis.tachograph`: `none — GPS only (D-85 05.10)`
- Znaczniki B: przed terminem / w oknie / po terminie / przyjazd nocą

## Przyjazd rzeczywisty do Boden
Gdy SG-03 ustawi `actual_delivery_at`, trigger `trg_h4_eta_observation` zapisze obserwację II-7b (`eta_segment_observations`) z błędem ETA vs fakt — do kalibracji tempa/przerw/odpoczynku.

## SMS / e-mail
Bez zmian: SG-03 tylko do właściciela.
