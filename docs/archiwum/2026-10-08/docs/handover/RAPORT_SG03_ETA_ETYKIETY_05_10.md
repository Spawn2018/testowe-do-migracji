# SG-03 — etykiety ETA, przyjazd przed terminem, rozbicie ETA, C-SEP vs U-31 (05.10.2026 ~18:30 PL)

Poczekalnia koordynatora (wpis w `POLECENIA_KOORDYNATORA.md`, 05.10 ~18:23). Odczyt produkcji
`nglnnrmzmhusvxslousq` (tylko SELECT), czasy w Europe/Warsaw.

Stan SG-03 (load `963e19dd…`) o 18:22 PL: `IN_TRANSIT_SE`, ostatni GPS 18:20 PL (EMTRACK_WEB,
64,19 N 21,00 E, okolice Robertsfors), `eta_site` **06.10 01:17**, pasmo **±49 min**, `delay_minutes` 0,
plan dostawy **07.10** bez godzin (`plan_delivery_from/to` = null), kierowcy: ROBERT PREIHS | MICHAŁ MADEJ,
`trailer_swap` = true (przepięcie).

## 1. Definicje

| Etykieta | Znaczenie (kod) |
|---|---|
| **Wysoka / Średnia / Niska** | Pewność prognozy = szerokość pasma `eta_confidence_min`: **≤60 min → Wysoka**, ≤240 min → Średnia, >240 lub brak → Niska (`src/data/mappers.ts` `etaConfidenceFromMinutes`). Pasmo = RSS odcinków (jazda ±20%, przerwy ±50%, odpoczynek 0%). SG-03: ±49 min → Wysoka. **Dotyczy rozrzutu modelu, nie poprawności założeń** (np. odpoczynku). |
| **w oknie** | ETA istnieje i `delay_minutes = 0`, tj. ETA ≤ koniec terminu dostawy (`load_delivery_deadline`: `plan_delivery_to`, a bez niego **koniec dnia dostawy 24:00** Europe/Stockholm). **Brak dolnej granicy** — każdy wcześniejszy przyjazd = „w oknie” (`LoadDrawer.tsx`, `refresh_load_eta`). SG-03: termin 08.10 00:00 PL. |

„Jak działa” przy ETA nie było → dodane w szufladzie transportu (wiersz ETA), PL/EN/SV, 6 punktów
(ETA, „w oknie”, opóźnienie, Wysoka/Średnia/Niska z progami, pasmo, „–”). Test `tests/eta-howto-sg03.test.ts`.

## 2. Przyjazd wyraźnie przed terminem

**Nie ma** osobnego znacznika ani ostrzeżenia. SG-03: ETA 06.10 01:17 (noc, dzień przed dniem dostawy),
≈ 22,7 h przed początkiem 07.10 i ≈ 46,7 h przed końcem terminu — UI pokazuje zielone „w oknie”.

Propozycja (bez wdrożenia, do decyzji):
- a) znacznik **„przed terminem”** (bursztyn) zamiast „w oknie”, gdy ETA < początek okna dostawy:
  `plan_delivery_from`, a bez niego 00:00 dnia dostawy (czas szwedzki) — minus tolerancja (propozycja 60 min);
- b) dopisek **„przyjazd nocą”**, gdy ETA lokalnie SE w godzinach 22:00–06:00 (godziny pracy placu
  jako parametr w Opcjach — do podania przez właściciela/Stegra);
- c) kolumna `early_minutes` liczona w `refresh_load_eta` obok `delay_minutes`; opcjonalnie ryzyko
  `EARLY_ARRIVAL` w Centrum decyzji (bez SMS) — do decyzji, czy w ogóle alarmować.
Decyzje: tolerancja, godziny nocne / placu, czy alarm i do kogo.

## 3. Rozbicie ETA i werdykt C-SEP vs U-31

Model SE (`compute_load_eta`, live md5 `7da64bcf…` = migracja 0160): pozostały ułamek korytarza OSM
`SE_E4` (f) × (SE_ROAD 17 h + SE_DAILY_REST 11 h + SE_BREAKS 2 h). Postoje = tylko SE_BREAKS (brak osobnej
pozycji „postój”), w Szwecji brak check-inu.

Rekonstrukcja z pozycji GPS (`corridor_progress` na historycznych próbkach, te same parametry):

| GPS (PL) | km do placu | f | jazda h | odpoczynek h | przerwy h | ETA (PL) |
|---|---|---|---|---|---|---|
| 13:28 | 501 | 0,575 | 9,78 | 6,33 | 1,15 | 06.10 06:43 |
| 14:58 | 403 | 0,463 | 7,87 | 5,09 | 0,93 | 06.10 04:52 |
| 16:27 | 285 | 0,328 | 5,57 | 3,60 | 0,65 | 06.10 02:17 |
| 16:57 | 285 (postój 30 min) | 0,328 | 5,57 | 3,60 | 0,65 | 06.10 02:47 |
| 17:59 | 209 | 0,240 | 4,08 | 2,64 | 0,48 | 06.10 01:12 |
| 18:20 | 201 | 0,231 | 3,93 | 2,54 | 0,46 | 06.10 01:17 (prod) |

07:03 = wartość z chwili przepięcia (~13:21 PL, f≈0,59); 01:02 = jedna z próbek ~17:30–18:00.
Przez 4,9 h realnego czasu składniki spadły o 10,3 h: jazda −5,85 h (ciężarówka ~20% szybciej niż 17 h
w modelu), **odpoczynek −3,8 h bez realnego odpoczynku**, przerwy −0,7 h → ETA wcześniej o ~5,5 h.

**Werdykt C-SEP vs U-31: to NIE jest traktowanie jako obsady dwuosobowej.** Dowód:
`compute_load_eta` i `refresh_load_eta` (live) nie odwołują się do `driver_name`, `driver_delivery_name`,
`trailer_swap`, `tractor_delivery_plate`; odpoczynek dobowy 11 h jest zawsze w sumie
(`h_se := h_road_eff + h_rest + h_brk`); obecne ETA zawiera 2,54 h odpoczynku. Przy obsadzie
dwuosobowej (bez odpoczynku) ETA byłoby ~22:46 PL. Zapis „A|B” to wyłącznie wyświetlanie (`src/lib/cSep.ts`).
Strażnik regresji: `tests/eta-howto-sg03.test.ts`.

Rzeczywista przyczyna skoku: **odpoczynek i przerwy liczone proporcjonalnie do pozostałej trasy** (I-15/D-9),
a nie według godzin kierowcy z D-85 (przerwa 45 min po 4,5 h, licznik od nowa po promie, osobno przy zmianie
kierowcy). To zakres **H-4** (NIEZACZĘTE, propozycja czeka na akceptację właściciela) — bez zmian w kodzie.
Dla SG-03 wg D-85 (Madej od przepięcia ~13:21, ok. 4,5 h jazdy do 18:20): przerwa 45 min + ~3,3–3,9 h jazdy,
razem ≤ 9 h → **~22:20–23:00 PL 05.10** bez odpoczynku dobowego; jeśli jechał wcześniej tego dnia
(brak danych tachografu) → odpoczynek 11 h → **~10:00–11:00 PL 06.10**. Model (01:17) leży pomiędzy.

Uboczne: odchylenie od korytarza 18,8–21,8 km na ostatnich próbkach (E4 koło Robertsfors) — polilinia OSM
`SE_E4` może być tam uproszczona; do sprawdzenia przy H-4 / ryzyku zjazdu.
