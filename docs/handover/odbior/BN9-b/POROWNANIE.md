# BN9-b — ekrany Korytarza bałtyckiego zgodne z decyzjami

Polecenie właściciela z 30.10, 15:48, punkt (1). Zakres obejmuje tylko front: bez migracji i bez zmian w `supabase/`. Nie ruszałem wyboru rejsu w awizacji (`AwizacjaModal.tsx`, listy w `awizacjaState.ts`), bo to #666 / #668. Pomarańczowych linii drogowych też nie ruszałem — to zadanie Cursora.

Punkt odniesienia: Stena i Polferries wyglądają tak jak przedtem. Test `bn9b-baltic-screens` sprawdza, że dla GDN-NYN i GDY-KAA oś statusów ma te same etykiety co dotąd.

## Inwentarz luk i co zrobiono

| # | Ekran | Luka (przed) | Po |
|---|---|---|---|
| 1 | Harmonogram › Rejsy | Kolumna „Trasa” była pusta dla Terminalu A (TLLA-HEL / HELA-TLL) i dla kodów z bazy. `ROUTE_SHORT` znał tylko seed. | `ferryRouteShort` (z `routeEnds`) daje np. „TLLA → HEL”. Format jest taki sam jak `routeShortLabel` z #668. |
| 2 | Harmonogram › Rejsy | Nie było filtra armatora. | Lista „Wszyscy armatorzy / …”. Pokazuje się, gdy w rozkładzie jest więcej niż jeden armator. |
| 3 | Harmonogram › Rejsy | Przy ręcznym rejsie: lista statków miała tylko Polferries i Stena, trasy nie miały Terminalu A. Zapis w bazie znajdował tylko Wawel i Nova Star (przedrostek M/F). | Statki pogrupowane po armatorach: Tallink, Viking, Eckerö, DFDS. Doszły trasy Tallinn A ⇄ Helsinki. `vesselToDb` działa dla każdego statku. Rejs zapamiętuje armatora statku, więc Finlandia → Eckerö, a nie pierwszy armator trasy. |
| 4 | Harmonogram › Rejsy | Brakowało atrybucji Port of Tallinn (ts.ee) i Ports of Stockholm (decyzje 47, 49). | Obie atrybucje są dodane. Pokazują się, gdy rejs zaczyna się lub kończy w TLL albo STO/KPS. Atrybucja Digitraffic (CC BY 4.0) zostaje jak była. |
| 5 | Harmonogram › Rejsy | Podtytuł: „Gdańsk → Nynäshamn i Gdynia → Karlskrona”. | „Polska → Szwecja oraz Estonia → Finlandia i Szwecja”. Teksty „brak rejsów” obejmują teraz wszystkie przeprawy. |
| 6 | Kokpit, pasek górny, Ryzyka › Promy dziś | Rejsy z Terminalu A i trasy z RPC nie liczyły się jako „najbliższy prom” armatora (`lineDepartures` sprawdzało tylko seed). | Działa `isOperatorOutboundRoute` (słownik + alias + RPC). `outboundRoutesOf` zostawiłem bez zmian, bo należy do #666. |
| 7 | Kokpit (produkcja) | Trasa najbliższego rejsu była składana z portów seeda. | Kokpit używa `ferryRouteLabel(locale, kod)`, np. „Tallinn A → Helsinki”. |
| 8 | Ryzyka › Sytuacja na trasie | Wiersz promu i propozycja alternatywy znały tylko Polferries ⇄ Stena. | Porty wiersza są brane z `routeEnds`. Dla przepraw z Estonii proponowani są inni armatorzy płynący do tego samego kraju: „Najbliższe odejścia do Finlandii: …”. Komunikat „brak rejsów” obejmuje Szwecję i Finlandię. |
| 9 | Karta transportu › oś statusów, pigułka statusu, Harmonogram | Dla nowych przepraw „Port PL / Port SE” nie pasowało (decyzja 25A). | Dla tras spoza Polferries/Stena: „Port wypłynięcia — Tallinn A”, „Port przypłynięcia — Helsinki”, „Droga do portu”, „Droga do placu” (`routeStatusLabel`). Stena i Polferries bez zmian. |
| 10 | Mapa | Niebieskie tory miały tylko GDN–NYN i GDY–KAA. Tory nowych przepraw rysowały się tylko przy widocznym transporcie, a po przerysowaniu z HERE znikały. | Warstwa promu (`mapPool` → ferryLeg) zawsze rysuje tory TLL–HEL, MUU–VUO, TLL–STO i PLD–KPS ze słownika. Przerysowanie z HERE ich nie usuwa. Terminal A korzysta z toru TLL–HEL (`waterTrackOf`). Kadrowanie mapy zostało bez zmian. |
| 11 | Opcje › Stan systemu | Kody zadań były pokazane surowo, np. `ferry-portnet`, `safefleet-poll`, `emtrack-web`. | Każde zadanie z `integration_runs` ma polską nazwę. Etykiety z „Pozostałych zadań” są używane ponownie, a `emtrack-web` jest na liście znanych zadań. |
| 12 | Komunikaty armatora | Kody tras z bazy nie miały nazw. | Zostawione dla #668 (`routeLabelPl` w `ferryStatusPl.ts`). Moja zmiana w tym pliku została cofnięta, żeby nie było konfliktu. |

## Zrzuty (tryb demo, 1440 i 390 px, ten sam zamrożony zegar 23.09.2026 16:32)

W danych demo nie ma rejsów przez Bałtyk. Dlatego skrypt dodaje przez „Dodaj rejs” jeden rejs: Finlandia, Tallinn A → Helsinki. Na wersji „przed” takiej trasy i statku nie było na liście, więc rejs nie został dodany.

| Ekran | Przed | Po |
|---|---|---|
| Rejsy · HHL · 1440 | ![](rejsy-hhl-1440-przed.webp) | ![](rejsy-hhl-1440-po.webp) |
| Rejsy · HHL · 390 | ![](rejsy-hhl-390-przed.webp) | ![](rejsy-hhl-390-po.webp) |
| Rejsy · SCX · 1440 | ![](rejsy-scx-1440-przed.webp) | ![](rejsy-scx-1440-po.webp) |
| Rejsy · KSH · 1440 | ![](rejsy-ksh-1440-przed.webp) | ![](rejsy-ksh-1440-po.webp) |
| Rejsy · SCX / KSH · 390 | ![](rejsy-scx-390-przed.webp) ![](rejsy-ksh-390-przed.webp) | ![](rejsy-scx-390-po.webp) ![](rejsy-ksh-390-po.webp) |
| Mapa · HHL · 1440 | ![](mapa-hhl-1440-przed.webp) | ![](mapa-hhl-1440-po.webp) |
| Mapa · HHL · 390 | ![](mapa-hhl-390-przed.webp) | ![](mapa-hhl-390-po.webp) |
| Kokpit · HHL · 1440 | ![](kokpit-hhl-1440-przed.webp) | ![](kokpit-hhl-1440-po.webp) |
| Kokpit · HHL · 390 | ![](kokpit-hhl-390-przed.webp) | ![](kokpit-hhl-390-po.webp) |
| Kokpit · SCX / KSH · 1440 | ![](kokpit-scx-1440-przed.webp) ![](kokpit-ksh-1440-przed.webp) | ![](kokpit-scx-1440-po.webp) ![](kokpit-ksh-1440-po.webp) |
| Ryzyka · HHL · 1440 / 390 | ![](ryzyka-hhl-1440-przed.webp) ![](ryzyka-hhl-390-przed.webp) | ![](ryzyka-hhl-1440-po.webp) ![](ryzyka-hhl-390-po.webp) |

Pomiar ze skryptu, tylko wersja „po”:
- filtr armatora: „Wszyscy armatorzy, Polferries, Eckerö Line”;
- wiersz rejsu: „Finlandia · TLLA → HEL”;
- atrybucja: `port-tallinn`.

Kokpit w demo bierze najbliższy rejs z danych startowych (Polferries). Ścieżkę produkcyjną („Najbliższy prom” z Terminalu A) sprawdza test `bn9b-baltic-screens`.

## Czego nie da się pokazać w demo

- Stan systemu i SOURCE_DOWN (`rk_src_*`) czytają `integration_runs` i `ferry_source_status` z bazy, więc w demo są puste. Etykiety sprawdzają testy `w-opcje-live-2` i `b6`.
- Pogoda morska w Kokpicie dla Bałtyku: nie ma danych do pokazania. Decyzja BN5 jest późniejsza, a `LINE_CORRIDOR` dalej obejmuje tylko PL–SE.

## Zależności

- **#668 (Cursor, #666 krok 1)** zmienia `ferryCatalog.ts`, `sailView.ts`, `ferryStatusPl.ts` i `sailings.ts`. W tych plikach nie zmieniałem etykiet tras: `ROUTE_SHORT` i `ferryStatusPl` zostały cofnięte do stanu z main. Mój `ferryRouteShort` daje ten sam format co `routeShortLabel` z #668. Po scaleniu #668 można go zastąpić wywołaniem `routeShortLabel`.
- Mapa: w migawce `mapa-hhl-pl-1920-*` doszły niebieskie tory nowych przepraw (Sztokholm, Tallinn, Helsinki). Migawki odświeża workflow `visual` z `update=true`.
