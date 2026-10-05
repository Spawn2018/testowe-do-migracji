# SG-03 — H-4 poprawka ostrożna + niepewność (05.10.2026)

Źródło liczb: prod po apply **0186** + `refresh_load_eta` (~20:46 Europe/Warsaw) · `WIP_H4_OSTROZNE_05_10.md`.

## Kontekst
Load `963e19dd-fe83-4690-9306-5c7fc4b95468` · GD035YX · `IN_TRANSIT_SE`.
Historia GPS w Tower od **05.10 13:25** (włączenie emtrack). Decyzja właściciela: brak znanego odpoczynku dobowego → **założenie ostrożne** (nie „świeży kierowca”).

## Emtrack — historia sprzed podłączenia (pkt 2)
| Pytanie | Wynik |
|---|---|
| Czy klient WEB daje historię trasy naczepy sprzed 13:25? | **NIE** |
| Dowód | `GET_TRACKING_OBJECTS_SNAPSHOTS` → **ERROR_403**; tylko `currentSnapshot` (`RAPORT_TELM_EMTRACK_WEB_05_10.md`, `EMTRACK_HISTORIA_SPRZED_05_10.md`) |
| Skutek | Mid-trip attach → założenie ostrożne (0186), bez odtworzenia last_rest z emtrack WEB |

## ETA porównanie (Europe/Warsaw)

| Moment | ETA Boden | rest_h | cautious | conf / uwagi |
|---|---|---|---|---|
| Przed H-4 (~18:30) | **06.10 ~01:02** | ~2,54 (proporcja) | n/a | odpoczynek ≠ UE |
| Po 0185 (~19:51) | **05.10 ~23:47** | **0** | false | jak świeży kierowca — **błędne** |
| **Po 0186** (~20:46) | **06.10 ~10:27** | **11** (+ breaks **0,75**) | **true** | ±**184** min · „Wysoka” **niedostępna** (H4_EU_REST 165 + H4_CAUTIOUS 61) |

## Przyjazd rzeczywisty / SMS
- Wjazd na plac Boden (`actual_delivery_at`): **czekamy**
- SMS „1 h przed”: **jeszcze nie** (brak kind KSH/1H w `sms_outbox`; polityka: tylko właściciel)
- Po wjeździe: `trg_h4_eta_observation` → II-7b

## II-7b — wnioski do kalibracji
1. Mid-trip GPS bez `last_rest` **musi** być ostrożne — inaczej ETA zbyt optymistyczne (0185: 23:47 vs rest 11 h).
2. Pasmo: rest z GPS ≠ ±0%; „Wysoka” tylko gdy cały rozrzut ≤ 60 min.
3. Brak historii emtrack przed 13:25 → nie kalibrować rest z „dziury” przed podłączeniem.

## Wdrożenie (zweryfikowane)
| Element | Stan |
|---|---|
| Migracja **0186** | apply-prod + verify **OK** |
| PR | **#123** (kod) · **#124** (Hobby) · **#125** (liczby) · **#126** (DONE) |
| Brama | h4 **19/19** · nullguard 593 · i2 535 · EXIT:0 (session/l13 soft-skip) |
| Domeny | `tower.log-mar.pl` **200** · `watch-tower-makieta.vercel.app` **200** |
| Evidence | `docs/evidence/SG03_ETA_OSTROZNE_05_10.md` · PNG: `docs/evidence/zeszyt/SG03-eta-ostrozne-05-10.png` |
