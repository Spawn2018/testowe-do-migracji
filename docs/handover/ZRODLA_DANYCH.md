> **CZĘŚCIOWO ZASTĄPIONY 29.09 — przy sprzeczności wygrywa wzorzec/03_REJESTR_DECYZJI.md i zlecenia z 29.09.**
# ŹRÓDŁA DANYCH ZEWNĘTRZNYCH — jedyne źródło prawdy

> Wszystko poniżej sprawdzone **25.09.2026** — na żywych danych albo
> w dokumentacji dostawcy. Warunki darmowych usług się zmieniają:
> **przy rejestracji każdej usługi sprawdź warunki jeszcze raz.**

---

# 1. STATUS PROMU GDAŃSK – NYNÄSHAMN

Żadne pojedyncze darmowe źródło nie pokrywa całej linii. Warstwy:

| # | Warstwa | Źródło | Co daje | Koszt, licencja | Stan w kodzie |
|---|---|---|---|---|---|
| 1 | **Rozkład** | rozkład cargo armatora `polferries.pl/cargo/rozklad.html?code=gn` | rejsy na miesiące naprzód, oznaczenie statku (NS — Nova Star, WAW — Wawel) | strona publiczna | **M12: funkcja `ferry-schedule`** (`parsePolferriesSchedule`, test na prawdziwej stronie z 26.09.2026) |
| 2 | **Status rejsu** | strona komunikatów armatora `polferries.pl/faq/komunikaty-kursowania-promow.html` | każdy rejs ok. tydzień naprzód: statek, godzina planowa, status, godzina oczekiwana | strona publiczna, **bez API** | **`lib/ferry/polferries.ts` — gotowe, 9 testów na prawdziwej stronie; M12: funkcja `ferry-status`** |
| 3 | **Fizyczny ruch statku — strona szwedzka** | Digitraffic, Fintraffic (Finlandia) | pozycja, prędkość, kurs promu przy Nynäshamn | **bez klucza, CC BY 4.0** | **`lib/ferry/digitraffic.ts` — gotowe, 4 testy na prawdziwej odpowiedzi; M12: funkcja `ferry-ais`** |
| 4 | **Nasze auta** | GPS w strefie portu | auto fizycznie w porcie | własne | **migracja 0004 — gotowe, 44 testy** |

## 1.1 Warstwa 2 — komunikaty armatora

- strona generowana po stronie serwera, **publicznego API nie ma**
- `robots.txt` blokuje wyłącznie `/core/` i `/manager/` — strona komunikatów
  jest dopuszczona dla robotów
- **nie znaleziono regulaminu serwisu zakazującego odczytu** — to jednak nie
  jest zgoda na piśmie
- status zakodowany w klasie CSS elementu rejsu i w odznace tekstowej;
  na dzień budowy strona pokazywała **wyłącznie „Planowo"**
- **oznaczenia opóźnienia i odwołania nie są znane** — parser rozpoznaje je
  po słowach kluczowych, a każdy nieznany status zwraca jako NIEZNANY
  z ostrzeżeniem, bez automatycznej zmiany
- zmiana struktury strony → ostrzeżenie, nigdy cicha pusta lista

**Zasady odczytu:** nie częściej niż **co 15 minut**, z identyfikującym
nagłówkiem User-Agent. Bez obchodzenia zabezpieczeń.

**Rekomendacja:** HHL i przewoźnik są klientami cargo armatora. **Poprosić
dział cargo POLSCA Baltic Ferries o zgodę na odczyt albo o oficjalne
powiadomienia o zmianach rejsów** (e-mail, API). To zamienia rozwiązanie
techniczne w uzgodnione.

## 1.2 Warstwa 3 — AIS przez Digitraffic

Zasięg zmierzony na żywo 25.09.2026:

| Obszar | Statków w obszarze | Z pozycją z ostatniej godziny |
|---|---|---|
| Zatoka Gdańska | **0** | 0 |
| środek trasy | 1 | 0 |
| podejście do Nynäshamn | 6 | 2 |
| Zatoka Fińska (kontrola) | 62 | 57 |

**Wniosek: Digitraffic potwierdza wyłącznie stronę szwedzką** — przypłynięcie
do Nynäshamn i odejście stamtąd. **Nie służy do potwierdzania odejścia
z Gdańska.**

- **Nova Star: MMSI 311000787, IMO 9462067** — w rejestrze Digitraffic,
  pozycja odczytana (100 km na S od Nynäshamn, 17 węzłów, kurs na Gdańsk)
- **Wawel: nieobecny w rejestrze** w dniu sprawdzenia — MMSI do potwierdzenia
- zapytanie o jeden statek: `GET https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=…`
  (ok. 0,5 kB zamiast 43 kB całego strumienia)
- wymagany nagłówek `Accept-Encoding: gzip`, zalecany `Digitraffic-User`
- **licencja CC BY 4.0 — w interfejsie obowiązkowy dopisek:**
  „Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0"
- **sygnał starszy niż godzina to informacja o zasięgu odbiorników,
  nie o statku** — `interpretFix` zwraca wtedy BRAK_ŚWIEŻEGO_SYGNAŁU

## 1.3 Rozważone i odrzucone — z dowodem

| Źródło | Powód odrzucenia |
|---|---|
| Urząd Morski w Gdyni — „Ruch statków" | obejmuje Gdynię i oba porty Gdańska, ale **promów linii regularnej na liście nie ma** — sprawdzone na żywo |
| Sjöfartsverket — dane AIS (RAIS) | wyłącznie historyczne, wydawane na zamówienie |
| AISStream.io | darmowy, ale zasięg zależy od odbiorników wolontariuszy, a **warunki użycia komercyjnego nie są jasno opublikowane** (otwarte zgłoszenie w repozytorium projektu, kwiecień 2026). Można przetestować zasięg przy Gdańsku darmowym kluczem — **nie jako źródło krytyczne** |

## 1.4 Do rozważenia — wymaga wniosku

**Sjöfartsverket, API przyjść i odejść** (repozytorium `Sjofartsverket/AAA`
na GitHubie): oficjalne dane o wizytach statków w portach szwedzkich
ze zgłoszeń do Maritime Single Window i planowania pilotażu, w tym wizyty
odwołane. Poświadczenia wydaje urząd na wniosek. **Czy linia regularna
składa tam zgłoszenia — do sprawdzenia.**

## 1.5 Jak źródła łączą się z automatem PROM (migracja 0004)

| Zdarzenie | Skutek |
|---|---|
| komunikat: inna godzina odejścia | `sailings.delayed_departure_at` — automat PROM czeka do nowej godziny |
| komunikat: odwołanie | `sailings.status = ODWOLANY` — automat wystawia ryzyko |
| komunikat: status nieznany | **bez zmiany**, ryzyko dla HHL do weryfikacji |
| źródło niedostępne albo zmieniona struktura strony | ryzyko „źródło statusu promów niedostępne", HHL ręcznie |
| Digitraffic: Nova Star w Nynäshamn, prędkość bliska zera | potwierdzenie przypłynięcia — informacja, nie zmiana statusu aut |

**Pierwszeństwo źródeł:** `RECZNIE` > `POLFERRIES` > `DANE_STARTOWE`.
Rejsu zmienionego ręcznie przez HHL odczyt automatyczny **nie nadpisuje**.

---

## 1.6 Stan wdrożenia (M12, 26.09.2026)

- kod wspólny: `supabase/functions/_shared/ferry/*` (parsery) i `_shared/integrations/*` (zadania, magazyn, reguły);
  funkcje Edge: `ferry-schedule`, `ferry-status`, `ferry-ais`, `road-se`, `road-pl`, `traffic-flow`
- baza (0018): `raise_integration_risk()`, `latest_vehicle_positions()` (tylko service_role), dziennik
  `integration_runs` (odczyt HHL), wyzwalacz: zapis rejsu przez użytkownika = źródło `RECZNIE`
- test offline: `tests/integrations.test.ts` (Polferries — prawdziwe strony; Trafikverket / DATEX II —
  przykłady z dokumentacji; TomTom Flow — wycofany CLEAN-TT-HERE)
- ręczne uruchomienie do czasu wdrożenia funkcji: `npx tsx scripts/ferry/run-job.ts ferry-status`
- **krok właściciela W-M12-1:** wdrożenie funkcji + pg_net + Vault + harmonogram (`scripts/ferry/cron-edge.sql`)

# 2. RUCH DROGOWY

## 2.1 Szwecja — Trafikverket Open API

- **bezpłatny klucz** po rejestracji i akceptacji licencji
- dane na licencji **CC0**
- endpoint `POST https://api.trafikinfo.trafikverket.se/v2/data.json`,
  zapytanie w XML, odpowiedź w JSON
- obiekty: **RoadCondition** — stan nawierzchni; **WeatherMeasurepoint** —
  stacje pogodowe przy drodze (zastąpiły **WeatherStation** od 2024);
  **Situation** — **usunięty z Open API** (stan 01.10.2026: `ObjectType does not exists`)
  — utrudnienia/roboty: czekać na zamiennik dostawcy albo DATEX
- Edge `road-se` (II-6): RoadCondition + WeatherMeasurepoint → ryzyka ROAD_SE
  + `corridor_conditions.SE_E4.slowdown_mult` (+15% przy śniegu/śliskości → II-7)
- **II-7 (DONE 0122):** korytarz `corridor_polylines` (PL_ROAD, SE_E4) z punktów
  OSM/ODbL — rzut GPS (`corridor_progress`), tempo z `eta_segment_params`,
  attribution „© OpenStreetMap contributors”; zero zapytań HERE/TomTom
- **ograniczenie:** pomiary prędkości i czasów przejazdu (TrafficFlow,
  TravelTimeRoute) wyłącznie w dużych miastach — nie na E4 na północy
- panel SE: dane żywe przez ryzyka z Edge (klucz w sekretach); Vite `/api/trafikverket`
  tylko dev/podgląd
## 2.2 Polska — Krajowy Punkt Dostępowy GDDKiA

- **bezpłatny**, standard **DATEX II**
- dostęp **po rejestracji i uwierzytelnieniu certyfikatem klienta** —
  najdłuższy czas uzyskania ze wszystkich źródeł
- zbiory: bieżące utrudnienia; znaki o zmiennej treści; **przepisy ruchu,
  w tym ograniczenia dla pojazdów** — istotne przy ponadgabarycie;
  parkingi z bieżącą dostępnością; **pomiary stanu ruchu: natężenie,
  prędkość, czas przejazdu**
- zakres: drogi krajowe w zarządzie GDDKiA — trasa do Gdańska

## 2.3 Cała trasa — TomTom Flow (WYCOFANE — CLEAN-TT-HERE / D-28)

- **Status 02.10.2026:** usunięte z kodu aktywnego. Job Edge `traffic-flow`
  zawsze zwraca DEMO. ETA = własny silnik OSM (II-7). Klucz `TOMTOM_API_KEY`
  nie jest używany.
- Historycznie: Freemium Flow Segment Data przy pozycji auta; zastąpione
  korytarzem OSM + Trafikverket RoadCondition (SE).

## 2.4 Kolejność

1. **Trafikverket** — klucz w sekretach Edge (II-6 LIVE)
2. **KPD GDDKiA** — rejestracja z certyfikatem (D-17) — DEMO do czasu certu
3. ~~TomTom Freemium~~ — **wycofane** (CLEAN-TT-HERE); ETA = II-7 OSM

---

# 3. DZIAŁANIA WŁAŚCICIELA — WSZYSTKIE BEZPŁATNE

| # | Działanie | Czas |
|---|---|---|
| 1 | klucz Trafikverket | **DONE** (II-6) |
| 2 | ~~konto TomTom Freemium~~ | **NIEPOTRZEBNE** (CLEAN-TT-HERE) |
| 3 | rejestracja w KPD GDDKiA jako odbiorca danych, certyfikat klienta | **najdłużej — zacząć teraz** |
| 4 | POLSCA Baltic Ferries, dział cargo: zgoda na odczyt komunikatów albo oficjalne powiadomienia; MMSI promu Wawel | pismo |
| 5 | opcjonalnie: poświadczenia Sjöfartsverket AAA; darmowy klucz AISStream do testu zasięgu przy Gdańsku | wniosek, od ręki |

**Klucze wyłącznie w zmiennych środowiskowych i sekretach funkcji. Nigdy
w repozytorium ani w rozmowie.**

---

# 4. ATRYBUCJE W INTERFEJSIE

| Źródło | Wymóg |
|---|---|
| Digitraffic | **obowiązkowo:** „Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0" |
| Trafikverket | CC0 — bez wymogu; dobra praktyka: „Źródło: Trafikverket" |
| FMI / DMI / SMHI | **obowiązkowo CC BY 4.0** przy pogodzie morskiej (II-8) |
| OpenStreetMap | ODbL — „© OpenStreetMap contributors” przy ETA (II-7) |
| ~~TomTom~~ | wycofane (CLEAN-TT-HERE) |
| KPD GDDKiA | zgodnie z warunkami udostępnienia po rejestracji |
| komunikaty armatora | „Status rejsów: POLSCA Baltic Ferries (Polferries)" /
  „Status rejsów: Stena Line" |
