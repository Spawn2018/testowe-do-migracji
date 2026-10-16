# wyglad/E6-tel — „Zadzwoń” do kierowcy, który teraz wiezie ładunek

Podstawa:
- właściciel 16.10.2026, 13:34: przy przepięciu naczepy kliknięcie numeru (ikonki) w Harmonogramie albo w panelu transportu wybierało pierwszy numer, czyli kierowcę, który odebrał ładunek. Ma działać automat: gdy transport wykonuje już kierowca dostarczający, dzwoni się do niego;
- E6 (07.10, 15:13): odcinek PL · Śrem → prom (pierwszy numer), odcinek SE · prom → Boden (drugi numer), wyróżniony odcinek, na którym jest ładunek;
- E29: kierowca i zestaw w podpisie znacznika — z odcinka, na którym auto jest teraz.

## Zasada (jedno miejsce: `src/lib/activeDriver.ts`)
- **Bez przepięcia:** jeden kierowca „odbiór i dostawa”. Gdy wpisano go tylko w polach odcinka SE, brane są te pola.
- **Z przepięciem — kierowca PL:** Przygotowanie, Załadunek, Droga PL, Port PL, Prom.
- **Z przepięciem — kierowca SE:** od „Port SE” do końca (Port SE, Droga SE, dojazd, rozładunek, Dostarczone, rozliczenie).
- **Opóźniony, cisza GPS, brak dokumentów, anulowany:** decyduje etap na pasku (Dojazd, Droga SE, Plac Boden, Dostarczone → SE).
- **Kierowca odcinka nie ma telefonu:** ekran mówi „brak” (z podpowiedzią „Kierowca odcinka SE nie ma telefonu w awizacji”), zamiast dzwonić do drugiego kierowcy.

## Co się zmienia na ekranie
| Miejsce | Było | Jest |
|---|---|---|
| Harmonogram, kolumna „Tel.” i karty na telefonie | przy przepięciu dwie ikonki „☎ → ☎”; łatwo kliknąć pierwszą | jedna ikonka „☎” do kierowcy, który teraz wiezie ładunek, z dopiskiem odcinka („SE”); opis: „Zadzwoń: Imię Nazwisko · kierowca odcinka SE (teraz wiezie ładunek)” |
| Panel transportu › Kierowcy i zestaw | odcinek „teraz” tylko przy jeździe; na promie i po dostawie żaden; kolejność zawsze PL, SE | wyróżniony (pełny przycisk „☎ Zadzwoń”) i pierwszy na liście jest kierowca, który teraz wykonuje transport; drugi odcinek niżej z przyciskiem w obrysie |
| Mapa, podpis znacznika | kierowca i ciągnik zawsze z odcinka PL | kierowca i ciągnik z odcinka, na którym auto jest teraz |
| PDF Harmonogramu, kolumna „Kierowca” | tylko kierowca PL | przy przepięciu „kierowca PL / kierowca SE”, jak w pliku KSH |

## Sprawdzone
- `tests/active-driver.test.ts` (7): bez przepięcia, PL do promu, SE od portu SE, statusy bez odcinka, brak telefonu kierowcy SE, kierowca tylko w polach SE;
- `tests/p7-awiz.test.ts` bez zmian zielony;
- cały zestaw unit (169 plików);
- tsc, stylelint, oxlint.

Dane: bez zmian. Odcinek wynika ze statusu i etapu, które już są w odczycie (`loads.status`, etap paska). Pola `driver_delivery_*` i `trailer_swap` są w bazie od migracji 0169.
