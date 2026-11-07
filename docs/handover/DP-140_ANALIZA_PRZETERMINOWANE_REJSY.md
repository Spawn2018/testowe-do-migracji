# DP-140 — analiza przeterminowanych rejsów (07.11.2026)

Źródło: #713 (odbiór 01.11 22:50), doprecyzowanie F7 #719. Bez wdrożenia zasady — tylko analiza i propozycja dla decyzji właściciela / BN8a.

## Zapytanie kontrolne (prod, 07.11.2026 ~21:55 UTC+1)

```sql
select s.route, s.status, count(*) n, min(coalesce(s.delayed_arrival_at, s.arrival_at)) oldest_arr
from sailings s
where coalesce(s.delayed_arrival_at, s.arrival_at) < now() - interval '6 hours'
  and s.status::text in ('ZAPLANOWANY','OPOZNIONY','W_REJSIE')
  and s.departure_at > now() - interval '14 days'
group by 1,2 order by 1;
```

**Wynik grupowy:** 10 rejsów (01.11 było 28 — starsze GDY-KAA / KAA-GDY / GDN-NYN / NYN-GDN z 19–21.10 wypadły z okna 14 dni).

| route | status | n | oldest_arr (UTC) |
| --- | --- | ---: | --- |
| GDY-KAA | W_REJSIE | 1 | 2026-11-02 06:00 |
| KPS-PLD | OPOZNIONY | 1 | 2026-10-31 06:23 |
| MUU-VUO | ZAPLANOWANY | 2 | 2026-10-30 10:15 |
| PLD-KPS | ZAPLANOWANY | 1 | 2026-10-30 18:00 |
| TLL-STO | ZAPLANOWANY | 1 | 2026-11-01 09:30 |
| TLLA-HEL | ZAPLANOWANY | 1 | 2026-11-06 04:45 |
| VUO-MUU | ZAPLANOWANY | 3 | 2026-10-30 06:45 |

## Klasyfikacja (brak potwierdzenia vs odbyte)

Wszystkie 10 mają **późniejszy rejs tego samego statku z ATD** (dowód, że flota poszła dalej). Żaden nie ma otwartego ładunku (`loads.sailing_id`).

### A. Brak potwierdzenia ATD/ATA (9) — status nadal planowy/opóźniony

| statek | trasa | status | dep (UTC) | wniosek |
| --- | --- | --- | --- | --- |
| Finbo Cargo | VUO-MUU / MUU-VUO (5×) | ZAPLANOWANY | 30.10 | brak ATD; ten sam statek ma późniejsze DOPLYNAL z ATD+ATA (01.11) |
| Sirena Seaways | PLD-KPS | ZAPLANOWANY | 30.10 08:30 | brak ATD; późniejszy KPS-PLD z ATD 01.11 |
| Sirena Seaways | KPS-PLD | OPOZNIONY | 30.10 20:00 | delayed ±23 min, brak ATD; późniejszy KPS-PLD z ATD 01.11 |
| Baltic Queen | TLL-STO | ZAPLANOWANY | 31.10 16:00 | przykład z #713: ten sam statek wypłynął STO→TLL 01.11 16:33 (ATD jest) |
| Viking XPRS | TLLA-HEL | ZAPLANOWANY | 06.11 02:00 | brak ATD; późniejszy HELA-TLL z ATD 06.11 05:30; wiszące ryzyko `AIS_DEP_DELAY` (~4 min) |

To nie są „nadal w trasie” — to dziury w potwierdzeniu (Portnet/AIS/UMG nie domknęły statusu), a rozkład poszedł dalej.

### B. Odbyty wyjazd, brak ATA (1)

| statek | trasa | status | ATD | wniosek |
| --- | --- | --- | --- | --- |
| Stena Estelle | GDY-KAA | W_REJSIE | 01.11 18:37 | wypłynął; ATA null; arrival+6 h minęło; ten sam statek ma KAA-GDY DOPLYNAL z ATD 02.11 19:03 |

## Wpływ na „najbliższy prom” / ETA / mapę

1. **Najbliższy prom (pasek, Kokpit, BN9):** `nextDbSailing` / `nearestCrossingByOperator` biorą tylko `effDeparture >= now` i pomijają `ODWOLANY`. Przeterminowane odejścia **nie wchodzą** do „najbliższego”.
2. **Mapa AIS (`ferry_sailings_map`):** okno `arrival >= now()-6 h` — przy progu DP-140 overlap = **0**. `voyageOfVessel` i tak pomija rejs bez `departed_at` po planowym `arrival`. **Brak wpływu na mapę.**
3. **ETA / awizacja ładunku:** 0 ładunków na tych `sailing_id`. Ryzyko teoretyczne tylko gdy transport wisi na starym rejsie (dziś nie występuje).
4. **Szum:** otwarte `AIS_DEP_DELAY` na Viking XPRS po „martwym” rejsie — niepotrzebne MEDIUM.

## Co już zamyka (i czego nie)

- `closeStaleFiToEeWithoutAta`: tylko **W_REJSIE** na HEL-TLL / HELA-TLL / VUO-MUU / STO-TLL / KPS-PLD (+2 h). Nie rusza ZAPLANOWANY; nie obejmuje MUU-VUO, PLD-KPS, TLL-STO, TLLA-HEL, GDY-KAA.
- DP-222 (`shouldCloseGdnNynWithoutAtd` / `statusAfterGdnNynAtd`): tylko **GDN-NYN**; jawnie **bez** domknięcia samym `arrival+6 h` przy braku ATD (zgodne z 61b).
- Decyzja **61b**: dotyczy podejrzenia odwołania (ryzyko), nie statusu rejsu; sam upływ czasu nie domyka bez dowodu.

## Propozycja zasady (bez wdrożenia — do decyzji)

**Cel:** czyścić „martwe” statusy bez sprzeczności z 61b (bez auto-zamykania na samym zegarze / bez gaszenia podejrzenia odwołania czasem).

1. **Dowód floty (rozszerzenie wzorca DP-222 na wszystkie trasy):** gdy status ∈ {ZAPLANOWANY, OPOZNIONY}, ATD i ATA null, a **ten sam `vessel_id` ma późniejszy rejs z ATD** → ustaw `DOPLYNAL` **bez** wymyślania `actual_*`. To nie jest „auto po 6 h”, tylko dowód że rozkład poszedł dalej (jak GDN-NYN / Wawel).
2. **W_REJSIE z ATD, bez ATA:** gdy ten sam statek ma późniejszy ATD **albo** (dla tras już objętych) istniejące okno arrival+Nh — `DOPLYNAL` bez ATA. Dziś brakuje m.in. **GDY-KAA / KAA-GDY** (przypadek Estelle).
3. **Zakaz:** nie domykać ZAPLANOWANY/OPOZNIONY samym `arrival+6 h` bez ATD i bez późniejszego ATD siostrzanego (61b / komentarz DP-222).
4. **Podejrzenie odwołania (61b):** bez zmian — nie zamykać ryzykiem samym upływem okna; `closeStale*` nadal nie rusza rejsu z otwartym cancel-suspect.
5. **Porządek ryzyka:** przy domknięciu rejsu (pkt 1–2) resolve otwartych `AIS_DEP_DELAY:` / podobnych dedupów tego `sailing_id`.

**Rekomendacja dla właściciela:** przyjąć pkt 1–2+5 jako osobne DP po decyzji (mała zmiana w jobie ferry-status, testy jak DP-222). Nie blokuje BN8a — „najbliższy prom” już filtruje po czasie; BN8 może założyć, że statusy historyczne zostaną domknięte regułą dowodu floty.

## POSTEP — liczby kontrolne

- Grupy: 7 wierszy / **10** rejsów (prod 07.11).
- Z ładunkiem: **0**.
- W oknie `ferry_sailings_map`: **0**.
- Z późniejszym ATD tego samego statku: **10/10**.
