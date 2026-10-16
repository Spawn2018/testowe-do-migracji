# wyglad/P9-d — E1: kadr całej trasy w Kokpicie i na Mapie, Przegląd na pojeździe (16.10.2026, 06:35)

Podstawa:
- E1 „Do wykonania”, zdecydowane 07.10: Kokpit i Mapa — kadr całej trasy (fitBounds, margines 24 px, krok 0,25), przy każdym wejściu i zmianie rozmiaru, bez zapamiętywania przesunięcia, bez „Cała trasa”; Przegląd — przybliżenie 11 na ostatniej pozycji, podążanie co 60 s, póki użytkownik nie ruszy mapy; bez pozycji — cała trasa i „Brak pozycji GPS”;
- E29 pkt 10 (każda firma — ta sama mapa);
- PLAN §4 P9 („E1 Kokpit i Mapa: kadr całej trasy…”).

Wygląd i zachowanie widoku (F8), bez danych. **Złożone na #248 (`wyglad/P9-c`).** E1 jest w całości w tym PR — Cursor nie robi E1 osobno (D-20261016-0635-01).

| Miejsce | Było | Jest |
|---|---|---|
| Mapa | stały środek 58,5 N 18,5 E, przybliżenie 4,2; przesunięcie zapamiętane | cała trasa (Śrem → Boden, promy) z marginesem 24 px przy każdym wejściu i zmianie rozmiaru; przesunięcie nie jest pamiętane |
| Kokpit (kafelek mapy) | jak wyżej; na 360 px Boden ucięty | cała trasa w kafelku na każdej szerokości |
| Kokpit — zakres | wszystkie transporty z danych (także innych firm w podglądzie) | te same co Mapa: swoja firma, w oknie śledzenia |
| Przegląd w panelu | kadr jak ostatnio w panelu | przybliżenie 11, pojazd na środku, podążanie co 60 s; po przesunięciu albo „+/−” mapa zostaje tam, gdzie użytkownik ją zostawił |
| Przegląd bez pozycji | „Brak danych — pozycji pojazdów” | cała trasa i „Brak pozycji GPS” |

Wspólna mapa na sesję (AUD-01e) zostaje: powrót na Mapę bez zmiany rozmiaru — zero nowych kafelków (porównanie widoku co do piksela).

**Sprawdzone:**
- e2e blok P9-d — 3/3: trasa w kadrze z marginesem na Mapie i w Kokpicie, po przesunięciu i powrocie znów cała; Przegląd — kafelki 11, pojazd na środku (±3 px); Kokpit = Mapa (KSH);
- regresja: AUD-01e (zero nowych kafelków przy powrocie, powrót ≤ 0,3 s), brama E8 telefon, P9-c, P9-a, P3-b Kokpit, P4, P4-b;
- unit — cały zestaw zielony;
- pierwsze wczytanie 395,8 kB gzip.

**Zrzuty:** `mapa-1440.webp`, `kokpit-1440.webp`, `kokpit-390.webp`, `panel-1440.webp`.
