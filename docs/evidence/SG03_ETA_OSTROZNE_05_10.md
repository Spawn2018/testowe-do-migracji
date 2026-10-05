# Evidence — ETA SG-03 po 0186 (05.10.2026)

## Zrzut UI
Plik: `docs/evidence/zeszyt/SG03-eta-ostrozne-05-10.png`  
Odczyt z UI (~**21:42** Europe/Warsaw):
- ETA Boden **06.10.2026 13:16** (live — później niż poranny refresh SQL ~10:27; postęp GPS)
- znaczniki: **przed terminem** + pewność **Średnia** (nie Wysoka)
- pasmo **± 184 min** · flaga **przerwa z GPS**

## Dane z prod SQL (~20:46, refresh po 0186)
| Pole | Wartość |
|---|---|
| ETA Boden | **06.10 ~10:27** Europe/Warsaw |
| drive_h / rest_h / breaks_h | 3,93 / **11** / **0,75** |
| h4_cautious | **true** · h4_source=`cautious` |
| conf_min | **184** (>60 → „Wysoka” niedostępna) |
| band | SE_ROAD 47 · SE_BREAKS 23 · H4_EU_REST **165** · H4_CAUTIOUS **61** |
| remaining_km | 201,3 |
| flagi | brak wykrytego odpoczynku dobowego — założenie ostrożne |

Przed H-4: 06.10 ~01:02 · Po 0185: 05.10 ~23:47 (rest 0) · Wjazd: czekamy · SMS 1h: jeszcze nie.

„Jak działa” — bez zmian. SMS/e-mail nadal tylko właściciel.  
PR **#123–#126** · migracja **0186** OK · domeny **200** · h4 **19/19**.
