# Propozycja H-10 — wydłużanie ETA przez wiatr (WYŁĄCZONE)

Data: **2026-10-05** · Europe/Warsaw  
Status: **propozycja — nie włączona**. Ostrzeżenie porywów ≥ **15 m/s** (D-84) działa w `route-hazards`.

## Zasada (ZLECENIE_HERE)
- Liczy się prognoza na odcinkach **przed** pojazdem, w godzinie przejazdu.
- Porywy ≥ 15 m/s → niższa prędkość zestawu na tych odcinkach.
- Przy wietrze blokującym przejazd (mosty / wysokie pojazdy) → postój do spadku poniżej progu.
- ETA tylko z GPS (D-80); bez GPS brak ETA i korekty.

## Wartości wstępne (do akceptacji właściciela)
| Parametr | Wartość | Uwagi |
|---|---|---|
| `H10_ETA_WIND_ENABLED` | **0** (wył.) | W `app_parameters` |
| Mnożnik prędkości przy ≥15 m/s | **0,70** | `H10_ETA_WIND_SPEED_FACTOR` |
| Próg postoju | **25 m/s** | `H10_ETA_WIND_STOP_MS` — postój do spadku &lt;15 |
| Próg ostrzeżenia (działa) | **15 m/s** | D-84, bez zmiany ETA |

## Źródła (do potwierdzenia)
- Trafikverket — ograniczenia dla wysokich / ponadnormatywnych przy silnym wietrze (mosty E4).
- Ogólne zasady dla zestawów wysokich: obniżenie prędkości przy porywach; zamknięcie mostu przy ekstremum.
- Po akceptacji: wpisać linki i cytaty do `LOGIKA_SYSTEMU.md`.

## Test po włączeniu
Ten sam przejazd z wiatrem poniżej / powyżej progu → różne ETA; różnica z odcinków i godzin.
