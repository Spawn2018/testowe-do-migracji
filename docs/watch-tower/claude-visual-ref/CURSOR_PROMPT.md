> **NIEAKTUALNE — zastąpione przez CURSOR_PROMPT.md (root) / docs/handover/CURSOR_PROMPT_ZRODLOWY.md**
>
> Indeks: `docs/handover/09_INDEKS_WIEDZY.md` · Etap C4 · 2026-09-23. Pliku nie usuwać.

# PROMPT DO CURSORA — TOWER v2 (tryb planowania)

> Wklej całość do Cursora w Plan Mode. Uzupełnij `[...]` przed wysłaniem.
> W repo są już pliki: `supabase/migrations/0001_core.sql`,
> `supabase/migrations/0002_geofence_engine.sql`, `lib/telematics/adapter.ts`,
> `lib/pricing/engine.ts`, `lib/schedule/parse.ts`. **Nie pisz ich od nowa —
> przeczytaj je i buduj na nich.**

---

Jesteś starszym architektem full-stack. **NIE pisz jeszcze kodu aplikacji.**
Twoim zadaniem jest przeczytać istniejące pliki w repo, a następnie wytworzyć
`PLAN.md` — szczegółowy plan implementacji. Kod piszemy dopiero po mojej akceptacji.

## KONTEKST

Buduję **TOWER** — control tower dla jednego projektu transportowego, dla trzech stron:

- **H&H Logistics (HHL)** — spedytor, ja. Widzę wszystko, w tym marżę.
- **KSH** — klient, właściciel harmonogramu i konstrukcji. Widzi swoją cenę (mój przychód).
- **Scandinavian Express (SCX)** — przewoźnik. Widzi swoją cenę (mój koszt).

Korytarz: załadunek w PL → port Gdańsk → prom Gdańsk–Nynäshamn (jedno odejście
dziennie, M/F Wawel i M/F Nova Star) → E4 na północ ~900 km → Boden Industrial
Park, plac budowy Stegra (~65,8054 N, 21,7591 E).

Ładunek: elementy konstrukcji stalowej, np. 18,21 × 2,45 × 2,45 m, masa
transportu ~20 t. Ponadnormatywne — zezwolenia w PL i SE, często pilotaż.

12–15 użytkowników, 3 organizacje. **MVP w 5 dni.** Prostota przed kompletnością.

## STACK — ZATWIERDZONY, NIE ZMIENIAJ BEZ UZASADNIENIA

- Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui
- **Supabase: Postgres 16 + PostGIS + Auth (magic link) + Storage + Realtime + RLS**
- MapLibre GL JS + react-map-gl + Terra Draw + Turf.js; kafelki MapTiler
- TanStack Table v8 + TanStack Query; Recharts + ECharts
- ExcelJS, Zod, Resend + React Email, Inngest, json-rules-engine
- next-intl (**PL / EN / SV od pierwszego dnia**), Sentry
- Deploy: **Vercel Pro** (plan Hobby dopuszcza cron tylko raz dziennie —
  polling telematyki co 5–10 min jest na nim niemożliwy)

### Stos ODRZUCONY i dlaczego — nie proponuj tego ponownie

| Odrzucone | Powód |
|---|---|
| Turso / libSQL | To SQLite. **Nie ma PostGIS.** Dwie bazy dla 15 użytkowników to absurd |
| H3 prefilter geofence | Przy ~15 pojazdach indeks GiST odpowiada w mikrosekundach |
| React Flow jako wizualny builder workflow | Osobny projekt na tygodnie. W MVP formularz trigger→warunek→akcja |
| Tesseract.js OCR dokumentów | Słaba skuteczność na skanach CMR, strata dnia |
| Headless Chromium do scrapowania linku telematyki | Kruche, limity funkcji serverless, ToS dostawcy |
| Dwukierunkowa synchronizacja z Excelem na SharePoint | Plik edytowany równolegle przez ludzi, brak blokad wierszowych. **Jednokierunkowo: SharePoint → aplikacja** |
| Stripe Invoicing | Zły instrument dla faktur przewoźnika w PL |
| Clerk / Axiom / osobny stos obserwowalności | Supabase Auth + Sentry wystarczą, ~$45/mies. zamiast ~$200 |

## ZASADY ARCHITEKTONICZNE — BEZWZGLĘDNE

1. **Excel = źródło PLANU. Aplikacja = źródło STANU.** Nigdy odwrotnie.
2. **Stan transportu to projekcja ze strumienia `load_events`** (append-only,
   trigger blokuje UPDATE/DELETE). Historia jest niezmienna.
3. **RLS w Postgresie jest wierszowa, nie kolumnowa.** Rozdzielenie widoczności
   cen działa przez: osobne tabele `load_cost`/`load_revenue` + `REVOKE ALL`
   dla ról API + widoki `security_invoker` + `GRANT UPDATE (kolumny)`.
   **Nigdy nie ukrywaj ceny tylko w UI.**
4. Funkcje pomocnicze ról to `SECURITY DEFINER` + `STABLE` + ustawiony
   `search_path`. Bez tego polityka RLS odpytująca `app_users` wpada w rekurencję.
5. **Klucz naturalny elementu to kolumna `Wysyłka` (SG-01), NIE `Lp.`**
6. **Model dwupoziomowy:** `shipment_items` (element) N:1 `loads` (transport).
   Jeden zestaw może wieźć SG-01 i SG-02 razem.
7. Geofence: **histereza + dwell + debounce N próbek**, maszyna stanów
   OUTSIDE → PENDING_IN → INSIDE → PENDING_OUT. Już zaimplementowane w `0002`.
8. **Surowy GPS nigdy nie jest nadpisywany** współrzędną po snapowaniu
   (`geom_raw` i `geom_snapped` to dwie kolumny).
9. Wszystkie handlery cron/webhook **idempotentne** — Vercel Cron jest best-effort.
10. **Management by exception** — ekran główny pokazuje odchylenia, nie wszystko.
11. Dane kierowcy (imię, telefon, pozycja GPS) = dane osobowe. Retencja przez
    `purge_personal_data()`, minimalizacja widoczności, audit log.
12. **Nie wymyślaj API, których nie zweryfikowałeś.** Nie znasz endpointu →
    oznacz `[DO WERYFIKACJI]` i napisz, jak to sprawdzić. To dotyczy zwłaszcza
    telematyki przewoźnika — jej dokumentacji jeszcze nie mam.
13. **Nie cytuj statystyk rynkowych ani „badań" bez źródła.** Żadnych
    „redukcja WISMO o 60%" czy „accuracy 85–92%".

## MODUŁY — priorytet malejąco

**M1 Import harmonogramu.** Użyj `lib/schedule/parse.ts` (gotowy parser,
walidator przesuniętych kolumn, diff). Zbuduj: upload XLSX → kreator
mapowania kolumn z zapisem szablonu → **ekran dry-run diff**
(dodane / zmienione / usunięte / odrzucone z powodem) → commit z wersją →
archiwum surowego pliku. **Nic nie zapisuje się przed zatwierdzeniem.**
Zmiana daty na transporcie już awizowanym (`criticalDateChanges`) generuje
osobne powiadomienie do SCX z diffem przed/po.

**M2 Lista i panel transportu.** TanStack Table, filtry, wirtualizacja,
timeline zdarzeń z `load_events`. Formularz zasobów dla SCX (kierowca,
telefon E.164, ciągnik, naczepa, pilotaż, wymiary ZESTAWU). Awizacja jako
**okno czasowe**, nie punkt. Czat per transport (`load_messages`).

**M3 Mapa.** MapLibre, split view 60/40 mapa+lista z dwukierunkowym hoverem,
focus mode, clustering, breadcrumb 24 h, kolory statusu. Warstwy: pojazdy,
ślad, trasa planowana (geometria z zezwolenia, nie z routera), geofence,
prom, zdarzenia drogowe SE, POI.

**M4 Geofence.** Backend gotowy w `0002_geofence_engine.sql` — zbuduj UI:
edytor rysowania (Terra Draw), formularz strefy, podgląd, seed 12 stref
korytarza. Wywołuj `process_position()` z webhooka i z crona.

**M5 Pozycje.** Użyj `lib/telematics/adapter.ts`.
**Zbuduj PWA kierowcy JAKO PIERWSZE** — nie wiem jeszcze, czy dostanę API
przewoźnika, a to jest jedyna ścieżka niezależna od niego. PWA: link z tokenem
per transport, 3 języki, przycisk „Udostępniaj pozycję" (`watchPosition`),
cztery duże przyciski milestone (ZAŁADOWANY / NA PROMIE / ROZŁADOWANY /
PROBLEM), aparat do CMR/POD/zdjęć mocowania. Adapter rFMS i GENERIC_REST
zostają jako stuby do wypełnienia po spotkaniu z przewoźnikiem.

**M6 Dokumenty.** Kategorie z deadline'ami, wersjonowanie, widoczność per
`org_kind`, signed URL TTL 15 min, ZIP per transport/tydzień.
**Walidator `permit_fits()` już jest w SQL — podepnij go: przy wgraniu
zezwolenia porównaj wymiary zestawu i zablokuj transport przy przekroczeniu.**

**M7 Cennik i BAF.** Użyj `lib/pricing/engine.ts`. Macierz przedziałów,
osobne cenniki koszt/przychód, BAF z pełną parametryzacją, **kursy NBP
(api.nbp.pl, tabela A) z zapisem konwencji kursowej**, marża z flagą poniżej
progu. `matchRate()` przy braku dopasowania **nie zwraca zera** — wyrzuca
transport na listę wyjątków.

**M8 Dashboardy.**
- HHL: 6 KPI + kolejka wyjątków + marża (waterfall) + S-curve postępu +
  carrier scorecard + `exception_detection_lag`
- KSH: postęp elementów, **timeline montażowy z flagą rozjazdu kolejności**
  (`detect_sequence_risk()`), kalendarz przyjazdów, dokumenty, feed ICS
- SCX: lista zadań z deadline'ami, moje transporty, rejsy, fakturowanie, mój OTIF

**M9 Workflow.** Trigger (typ z `load_events` lub CRON) → warunek (JSONLogic)
→ akcje. Wykonanie na Inngest. Seed 7 workflow (opiszę osobno).
**Formularz, nie canvas.**

**M10 Ryzyka.**
- FERRY: pogoda morska + **parsing strony komunikatów o kursowaniu promów
  Polferries** (publikuje planowaną i rzeczywistą godzinę wyjazdu/przyjazdu
  per jednostka ze statusem) + opcjonalnie AIS. **Progi sztormowe są
  KONFIGUROWALNE i nigdzie nie prezentujemy ich jako faktu o decyzjach armatora.**
  Do pogody użyj MET Norway / SMHI (CC BY 4.0, dozwolone komercyjnie),
  nie darmowego tieru Open-Meteo, który jest niekomercyjny.
- ROAD_SE: Trafikverket Open API (`api.trafikinfo.trafikverket.se/v2/data.json`,
  POST z zapytaniem XML, obiekty `Situation`, `RoadCondition`, `WeatherStation`),
  bufor 30 km wokół trasy, tylko punkty jeszcze nieminięte.
- DOC / OPERATIONS: braki, mismatch zezwolenia, wygasanie polisy,
  `detect_silent_vehicles()`, ETA breach, brak awizacji.

**M11 Faktura zbiorcza.** Kreator wyboru transportów z tygodnia, kwota
oczekiwana z cennika, upload PDF, `matchInvoice()` → MATCHED / DISPUTED
z rozbiciem różnic linia po linii.

**M12 ETA — segmentowe, deterministyczne w MVP.**
`ETA = czas_do_Gdańska + oczekiwanie_na_rejs + rejs + odprawa + Nynäshamn→Boden`
z uwzględnieniem przerw kierowcy (561/2006). Architektura ma dopuszczać
podmianę pojedynczego segmentu na model ML bez przepisywania reszty —
badania nad ETA w sieciach intermodalnych (Balster i in. 2020, BISE 62,
403–416) wskazują model per odcinek, nie jeden model end-to-end.

## POZA MVP — zaprojektuj miejsce, nie implementuj

SharePoint przez Microsoft Graph (`Sites.Selected`), ML dla ETA, AIS,
replay (deck.gl TripsLayer), KSeF, e-CMR, ślad CO₂ wg ISO 14083,
aplikacja natywna.

## CZEGO OCZEKUJĘ W `PLAN.md`

1. Struktura katalogów z komentarzem
2. **Audyt istniejących migracji** — czy widzisz w nich błąd lub lukę
   bezpieczeństwa. Jeśli tak, napisz to wprost przed planem
3. Maszyna stanów transportu (diagram Mermaid) + zamknięty katalog
   typów zdarzeń
4. Kontrakty Server Actions / API per moduł: sygnatury + schematy Zod
5. Plan podpięcia `process_position()` — webhook i cron, z dowodem idempotentności
6. Specyfikacja PWA kierowcy: ekrany, tokeny, offline, 3 języki
7. Specyfikacja każdego dashboardu: widgety, źródło danych, zapytanie
8. Lista cronów: ścieżka, częstotliwość, działanie, sposób zapewnienia idempotentności
9. Plan dzień-po-dniu (5 dni) z kryteriami akceptacji
10. Zmienne środowiskowe
11. Ryzyka techniczne z mitygacją
12. Seed: 12 geofence korytarza, 7 workflow, 3 organizacje × 5 użytkowników,
    przykładowy cennik, 20 elementów harmonogramu

## ZASADY PRACY

- **Zapytaj mnie, zamiast założyć.** Szczególnie: lokalizacje załadunku,
  struktura cennika, progi ryzyka, limity wymiarowe per kraj, konwencja kursowa.
- Preferuj rozwiązanie, które dowiozę w 5 dni, nad eleganckie na 3 tygodnie.
- TypeScript strict, zero `any`, Zod na każdej granicy, komentarze po polsku.
- Interfejs trójjęzyczny od początku.
- Preview deployments za hasłem — dane klienta nie mogą wisieć na publicznym URL-u.

**Zacznij od zadania mi pytań, na które musisz znać odpowiedź, zanim napiszesz plan.**
