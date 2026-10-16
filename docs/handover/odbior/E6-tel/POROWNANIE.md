# wyglad/E6-tel — „Zadzwoń” do kierowcy, który teraz wiezie ładunek

Podstawa:
- właściciel 16.10.2026, 13:34: przy przepięciu naczepy kliknięcie numeru (ikonki) w Harmonogramie albo w panelu transportu wybierało pierwszy numer, czyli kierowcę, który odebrał ładunek. Ma działać automat: gdy transport wykonuje już kierowca dostarczający, dzwoni się do niego;
- właściciel 16.10.2026, 13:58: w trakcie promu dzwoni do kierowcy SE; w Harmonogramie na komputerze (widok pełny i skrócony) zamiast ikonki numer telefonu w osobnej kolumnie; na telefonie w karcie kierowca, który teraz wykonuje transport, i przycisk z ikoną telefonu;
- E6 (07.10, 15:13): odcinek PL · Śrem → prom (pierwszy numer), odcinek SE · prom → Boden (drugi numer), wyróżniony odcinek, na którym jest ładunek;
- E29: kierowca i zestaw w podpisie znacznika — z odcinka, na którym auto jest teraz.

## Zasada (jedno miejsce: `src/lib/activeDriver.ts`)
- **Bez przepięcia:** jeden kierowca „odbiór i dostawa”. Gdy wpisano go tylko w polach odcinka SE, brane są te pola.
- **Z przepięciem — kierowca PL:** Przygotowanie, Załadunek, Droga PL, Port PL.
- **Z przepięciem — kierowca SE:** od „Prom” do końca (Prom, Port SE, Droga SE, dojazd, rozładunek, Dostarczone, rozliczenie) — 13:58.
- **Opóźniony, cisza GPS, brak dokumentów, anulowany:** decyduje etap na pasku (Prom, Dojazd, Droga SE, Plac Boden, Dostarczone → SE).
- **Kierowca odcinka nie ma telefonu:** ekran mówi „brak” (z podpowiedzią „Kierowca odcinka SE nie ma telefonu w awizacji”), zamiast dzwonić do drugiego kierowcy.

## Co się zmienia na ekranie
| Miejsce | Było | Jest |
|---|---|---|
| Harmonogram na komputerze — widok pełny | kolumna „Tel.” z ikonką „☎” (przy przepięciu dwie: „☎ → ☎”) | kolumna „Telefon kierowcy” z numerem („+48 501 111 222”), kliknięcie dzwoni; przy przepięciu pod numerem „kierowca SE · teraz” |
| Harmonogram na komputerze — widok skrócony | ikonka „☎” w kolumnie „Kierowca i zestaw”, telefon tylko jako dodatkowa kolumna z „Kolumny” | osobna kolumna „Telefon kierowcy” na stałe (9 kolumn), w „Kierowca i zestaw” bez ikonki |
| Harmonogram na telefonie (karta) | kierowcy „PL → SE” bez przycisku | kierowca, który teraz wykonuje transport (przy przepięciu „kierowca SE · teraz”), i przycisk „☎ Zadzwoń” (44 px) do niego |
| Panel transportu › Kierowcy i zestaw | odcinek „teraz” tylko przy jeździe; na promie i po dostawie żaden; kolejność zawsze PL, SE | wyróżniony (pełny przycisk „☎ Zadzwoń”) i pierwszy na liście jest kierowca, który teraz wykonuje transport; drugi odcinek niżej z przyciskiem w obrysie |
| Mapa, podpis znacznika | kierowca i ciągnik zawsze z odcinka PL | kierowca i ciągnik z odcinka, na którym auto jest teraz |
| PDF Harmonogramu, kolumna „Kierowca” | tylko kierowca PL | przy przepięciu „kierowca PL / kierowca SE”, jak w pliku KSH |

## Sprawdzone
- `tests/active-driver.test.ts` (8): bez przepięcia, PL do portu w Polsce, SE od promu, statusy bez odcinka, numer międzynarodowy do wyświetlenia i do „tel:”, brak telefonu kierowcy SE, kierowca tylko w polach SE;
- `tests/sched-layout.test.ts`: „Telefon kierowcy” w obu widokach (9 kolumn skróconego); `tests/e8-phone-gate.spec.ts` — nagłówki pliku;
- zrzuty 1440 (widok pełny i skrócony) i 390 (karty: 67 przycisków „Zadzwoń”, każdy ≥ 44 px, nic poza ekranem);
- `tests/p7-awiz.test.ts` bez zmian zielony;
- cały zestaw unit (169 plików);
- tsc, stylelint, oxlint.

Dane: bez zmian. Odcinek wynika ze statusu i etapu, które już są w odczycie (`loads.status`, etap paska). Pola `driver_delivery_*` i `trailer_swap` są w bazie od migracji 0169.
