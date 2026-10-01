# I-29 — Budżety darmowych planów dla 140 transportów

Stan: **2026-10-02**. Skala ze zlecenia: **140 transportów ponadnormatywnych**
w ok. **13 tygodni** (~11/tydzień, ~1,6/dobę średnio). Szczyt roboczy (założenie):
**do 8 aut jednocześnie** na korytarzu PL→SE (załadunek + prom + E4).

Bez serwisu tras HERE/TomTom (D-28 / II-7 OSM). Trafikverket = klucz już w sekretach.

## Tabela: szczyt dobowy vs limit

| Zasób | Limit darmowy | Szacunek szczytu (140 / 13 tyg.) | Zapas | Uwagi |
|---|---|---|---|---|
| **Resend** e-mail | **100 / dobę** (UTC), 3 000 / mies. | ~25–40 / dobę (decyzje, ryzyka HIGH, Auth) | OK (~40%) | Auth magic/hasło + DEC-3; bez burst powitalnego 20 kont |
| **SMS bramka** | **150 / dobę** (DEC-5) | ~8–24 / dobę (2+2 osoby × strefy Śrem/Boden) | OK | Tylko listy §5; bez SMS do kierowców |
| **Baza Postgres** | **500 MB** | stan ustalony GPS ≈ **40–70 MB** (PR5, 8 aut, retencja 30 d) | OK (~14%) | Najgorzej 8×720×34 d ≈ **80 MB** pozycji; + dokumenty |
| **Storage** | **1 GB** | CMR/POD/zdjęcia ≈ **50–150 MB** / 140 | OK | kompresja PR7; archiwum od 70% |
| **Edge Functions** | **500 000 / mies.** | ~**25–35 tys.** / mies. (patrz niżej) | OK (~7%) | bez traffic-flow TomTom |
| **Trafikverket** | Open API, klucz | `road-se` co 10 min = **144 / dobę** | OK | RoadCondition + WeatherMeasurepoint |
| **FMI / DMI / SMHI** | fair use, bez klucza | `ferry-weather` **4 / dobę** (+ retry DMI) | OK | II-8; DMI 429 → FMI |
| **Digitraffic AIS** | bez klucza | `ferry-ais` co 10 min = **144 / dobę** | OK | |
| **Vercel Hobby** | bandwidth / build | build przy push; transfer frontu niski | OK | |
| **R2 kopia** | 10 GB, Class A/B free | 1 kopia / dobę | OK | I-33 strażnik RUNNING |

### Szacunek Edge / miesiąc (szczyt)

| Funkcja | Częstotliwość | ≈ wywołań / mies. |
|---|---|---|
| ferry-ais | */10 min | 4 320 |
| ferry-status | */15 min | 2 880 |
| ferry-schedule | 1 / h | 720 |
| ferry-weather | 4 / dobę | 120 |
| road-se | */10 min | 4 320 |
| send-notifications | */5 min | 8 640 |
| usage-check / backup / keep-alive / inne | niski | ~1 000 |
| driver-photo + ręczne | zależnie od 140 | ~500–2 000 |
| **Suma** | | **≈ 22–25 tys.** (<< 500 tys.) |

`traffic-flow` (TomTom) **wyłączony / DEMO** — nie w budżecie. Po CLEAN-TT-HERE usuwany.

## Werdykt

Przy 140 transportach w 13 tygodniach **wszystkie darmowe limity mieszczą się
z zapasem**. Najbliższy względnie: Resend przy day-of (wiele decyzji + Auth) —
pilnować ≤ 100/dobę; usage-check już alarmuje przy 70%/85% bazy i Edge.

**Nie blokuje pilotażu.** TomTom/KPD nadal opcjonalne (klucz/cert).

## Źródła liczb

- PR4/PR5: `LIMITY_PLANU_DARMOWEGO.md`
- GPS: migracja 0025 + pomiar 387 B/punkt
- Harmonogram cron: `supabase/sql/cron_*.sql` + II-8 `cron_ferry_weather.sql`
- Resend Free / Supabase Free — dokumentacja dostawców (sprawdzić przy zmianie planu)
