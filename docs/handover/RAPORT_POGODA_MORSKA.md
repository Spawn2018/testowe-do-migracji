# III-11 — źródło pogody morskiej dla trasy Gdańsk–Nynäshamn (raport, bez zmian w UI)

Stan na 28.09.2026. Źródła sprawdzone na stronach dostawców (odnośniki niżej). Trasa promu: Gdańsk (≈54,4° N, 18,7° E) → Nynäshamn
(≈58,9° N, 17,9° E), ok. 250 Mm przez otwarty Bałtyk Środkowy. Potrzeba TOWER: prognoza wysokości fali znacznej (i wiatru) na trasie
na 0–72 h — do sygnalizacji ryzyka opóźnienia/odwołania rejsu przy ładunkach ponadgabarytowych. Tylko raport — nic nie wdrożono.

## Porównanie

| Źródło | Co daje dla trasy | Licencja / użycie komercyjne | Zasięg i rozdzielczość | Częstotliwość | Format / dostęp | Koszt, konto |
|---|---|---|---|---|---|---|
| **DMI** (Dania) — model falowania WAM, obszar `wam_nsb` | prognoza: wysokość fali znacznej, okres, kierunek; w tej samej usłudze wiatr HARMONIE | **CC BY 4.0** — komercyjnie dozwolone z podaniem źródła; „fair use” (bez zbędnego odpytywania) | Morze Północne–Bałtyk 47–66° N, 13° W–30° E — **cała trasa**, ok. 5 km | przebiegi co 6 h (00/06/12/18 UTC), krok godzinowy; w API ostatnie 24 h przebiegów | **EDR API** (`/v1/forecastedr/collections/wam_nsb/position`, GeoJSON/CoverageJSON) — zapytanie o punkt lub prostokąt, małe odpowiedzi; także STAC (GRIB) | bezpłatnie, **bez rejestracji**; **test 28.09 ok. 10:00: dwukrotnie HTTP 429 „Server is busy”** |
| **FMI** (Finlandia) — WAM Bałtyk + boje | prognoza fali (`fmi::forecast::wam::point::timevaluepair`, SigWaveHeight), obserwacje z boi (`fmi::observations::wave`) | **CC BY 4.0** — komercyjnie z podaniem źródła | Bałtyk (model WAM FMI) — **sprawdzone 28.09 dla punktu w połowie trasy (56,5° N, 18,5° E): odpowiedź w ~1 s** (fala 0,86 → 1,23 m, 09–15 UTC); boje głównie na północnym Bałtyku, daleko od trasy | kilka przebiegów na dobę | WFS 2.0 (XML/GML), siatka w GRIB2 | bezpłatnie, bez klucza |
| **SMHI** (Szwecja) | **obserwacje** fali z boi (np. na podejściu do Sztokholmu), poziom morza; prognozy meteorologiczne punktowe (wiatr) | **CC BY 4.0 SE** — wprost: „dozwolone także w celach komercyjnych”, podać SMHI; tylko udokumentowane API | Szwecja i przyległe wody; **prognozy fali nie ma w otwartym API** (prognoza fal SMHI trafia do Copernicus Marine) | obserwacje co godzinę; prognoza meteo co godzinę | REST JSON/CSV (`opendata-download-ocobs.smhi.se`, `…metfcst…`) | bezpłatnie, bez klucza |
| **Copernicus Marine** — `BALTICSEA_ANALYSISFORECAST_WAV_003_010` | prognoza i analiza fal (wysokość, okres, kierunek, fala wiatrowa/martwa) | licencja Copernicus Marine — **dowolny zgodny z prawem cel, także komercyjny**, bezpłatnie, z podaniem źródła | cały Bałtyk, **1 Mm**, wartości godzinowe | aktualizacja 2× na dobę (10:00 i 22:00 UTC) | NetCDF/Zarr przez Copernicus Marine Toolbox (subset po obszarze i czasie) | bezpłatnie, **wymaga darmowego konta** (login/hasło w funkcji = sekret) |
| **ECMWF open data** — IFS wave | prognoza globalna: `swh` (fala znaczna), okres, kierunek | **CC BY 4.0** | globalnie, 0,25° (~28 km — przy wybrzeżu zgrubnie) | 00/12 UTC (do 10–15 dni) | GRIB2 z `data.ecmwf.int` (duże pliki, trzeba wycinać) | bezpłatnie, bez konta |
| **DWD** — EWAM (europejski model falowania) | prognoza fali dla wód europejskich | otwarte dane DWD — **CC BY 4.0**, komercyjnie z podaniem DWD | Europa, w tym Bałtyk | kilka przebiegów na dobę | GRIB2 z `opendata.dwd.de/weather/maritime/wave_models/ewam/` | bezpłatnie, bez konta, bez gwarancji dostępności |
| **Open-Meteo** — Marine API | wygodne API punktowe (fala, fala martwa, prądy) z modeli ECMWF/DWD/Météo-France | dane CC BY 4.0, ale **darmowe API tylko do użytku niekomercyjnego**; komercyjnie — płatny abonament (`customer-api`) albo własny serwer | globalnie | godzinowo | JSON, bardzo proste | **płatne dla TOWER** (użycie komercyjne) — odpada wg zasady „bez nowych płatnych zasobów” |
| **IMGW-PIB** (Polska) | prognozy falowania Bałtyku na baltyk.imgw.pl (strona), obserwacje stacji | regulamin danepubliczne.imgw.pl: bezpłatnie do celów prywatnych i dla „danych o wysokiej wartości”; **działalność gospodarcza i osłona żeglugi morskiej wymagają umowy (odpłatnej)** (§ 3, § 5) | polska strefa Bałtyku | — | publiczne API `danepubliczne.imgw.pl` nie zawiera prognoz morskich; stały dostęp — wniosek (`biznes@imgw.pl`) | umowa, opłata |

## Wniosek (propozycja do decyzji właściciela — nic nie wdrożono)

1. **Pierwszy wybór: FMI WAM (WFS, punktowo) + DMI WAM `wam_nsb` (EDR) jako drugie źródło.** Oba obejmują trasę, mają licencję
   CC BY 4.0 (komercyjnie), nie wymagają konta ani klucza (brak nowego sekretu) i zwracają małe odpowiedzi dla kilku punktów trasy.
   FMI odpowiedział w teście od razu; DMI ma lepszą rozdzielczość (~5 km), ale w teście zwrócił 429 (przeciążenie) — więc funkcja
   musiałaby mieć ponawianie i przełączenie na drugie źródło. Jedno zapytanie co 6 h (po przebiegu modelu) mieści się w limitach
   funkcji Edge planu darmowego.
2. **Zapas: Copernicus Marine BAL WAV** (1 Mm, 2× na dobę) — najlepsza rozdzielczość, ale wymaga darmowego konta (nowy sekret) i
   ciężkiego formatu (NetCDF/Zarr); sensowny, gdyby FMI/DMI ograniczyły usługi.
3. **Obserwacje do weryfikacji prognozy:** SMHI (boje po stronie szwedzkiej), FMI (boje) — CC BY 4.0, bez klucza.
4. **Odrzucone dla TOWER:** Open-Meteo (darmowe API tylko niekomercyjnie — wymagałoby abonamentu), IMGW (użycie gospodarcze
   i osłona żeglugi wymagają odpłatnej umowy).
5. Wymóg każdej opcji: w interfejsie podpis źródła (np. „Dane: DMI, CC BY 4.0”) — do dodania przy ewentualnym wdrożeniu.

## Źródła

- DMI: https://www.dmi.dk/friedata/dokumentation/forecast-data-edr-api · https://www.dmi.dk/friedata/dokumentation/data/forecast-data-wave-model-wam · https://www.dmi.dk/friedata/dokumentation/terms-of-use
- FMI: https://en.ilmatieteenlaitos.fi/open-data-manual-forecast-models · https://en.ilmatieteenlaitos.fi/open-data-manual-wfs-examples-and-guidelines
- SMHI: https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning · https://www.smhi.se/vader/vader-till-havs/vattenstand-och-vagor
- Copernicus Marine: https://data.marine.copernicus.eu/product/BALTICSEA_ANALYSISFORECAST_WAV_003_010/description
- ECMWF: https://www.ecmwf.int/en/forecasts/datasets/open-data
- DWD: https://opendata.dwd.de/weather/maritime/wave_models/ewam/ · https://www.dwd.de/DE/leistungen/opendata/faqs_opendata.html
- Open-Meteo: https://open-meteo.com/en/terms · https://open-meteo.com/en/pricing
- IMGW-PIB: https://danepubliczne.imgw.pl/regulations
