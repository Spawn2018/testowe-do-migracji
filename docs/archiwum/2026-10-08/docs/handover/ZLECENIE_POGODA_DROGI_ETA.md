# ZLECENIE — POGODA, PROM, DROGI SE, SILNIK OPÓŹNIEŃ

> **Aktualizacja 29.09 po spotkaniu:** progi 3,8 m / 40 kn **potwierdzone**; druga
> przeprawa **Stena Line Gdynia – Karlskrona** — pogoda, drogi, ETA i komunikaty także
> dla niej; tranzyt 4 dni (5 przy ciężkiej pogodzie). `ZLECENIE_PO_SPOTKANIU_SCX.md` §3, §6.
>
> **D-28 — DECYZJA KOŃCOWA (30.09): WŁASNY SILNIK, bez zewnętrznego serwisu tras.**
> Trasa jest stała i wyznaczona w zezwoleniu. HERE — nie. Do tego **automatyczna,
> ucząca się kalibracja** (II-7b).

**Skala:** właściciel ma **140 transportów ponadnormatywnych do końca roku**,
ta sama trasa Śrem – Gdańsk – prom – Nynäshamn – Boden. Harmonogram w bazie
ma dziś 50 — kolejne przyjdą importem.

---

## 0. CZEGO Z ROZMOWY Z GEMINI NIE UŻYWAMY — I DLACZEGO

| Gemini | Dlaczego nie | Zamiast |
|---|---|---|
| Open-Meteo Marine | darmowe API wyłącznie do użytku niekomercyjnego (regulamin open-meteo.com/en/terms) | FMI + DMI + SMHI, CC BY 4.0 |
| AISStream.io | odrzucone wcześniej — niejasne warunki komercyjne | Digitraffic (działa: ferry-ais) |
| adres `masto.digitraffic.fi/api/v1/vessels` | nie jest to endpoint Digitraffic Marine | obecna integracja ferry-ais |
| Nova Star MMSI 311000199 | niezweryfikowany | 311000787 (zweryfikowany) |
| „Polska Żegluga Bałtycka" | operator od 30.03.2026: POLSCA Baltic Ferries | — |

---

## II-5 · P1 — KOMUNIKATY ARMATORA: WŁĄCZ ODCZYT

**Decyzja właściciela: odczyt strony komunikatów rusza teraz**, bez czekania
na zgodę. E-mail do armatora (D-18) zostaje jako informacja i prośba
o oficjalny kanał.

- odczyt co 15 min; `robots.txt` armatora dopuszcza tę stronę
  (zabronione tylko `/core/`, `/manager/`)
- **strona stoi za Cloudflare.** Koordynator: z minimalnym nagłówkiem
  User-Agent — HTTP 403; z pełnym nagłówkiem przeglądarki — 200.
  Nagłówek User-Agent **uczciwy**, z nazwą systemu i kontaktem.
  Jeśli Cloudflare zablokuje odczyt z adresów Supabase — status
  `NIEZNANY` + ryzyko „źródło niedostępne", nigdy cicha awaria.
  Nie obchodź zabezpieczeń Cloudflare
- parser z 17 testami — sprawdź na aktualnej stronie; zmiana struktury
  = ostrzeżenie, jak dotąd
- słowa kluczowe: odwołany, opóźniony, zmiana godziny, zmiana portu →
  status rejsu w `sailings` → ryzyko FERRY dla transportów przypiętych
  do rejsu → powiadomienie

## II-8 · P1 — POGODA MORSKA

- **źródła:** FMI (główne), DMI (zapasowe), **SMHI** (wody szwedzkie,
  podejście do Nynäshamn) — licencje CC BY 4.0, źródło podane w interfejsie
- ostrzeżenia sztormowe IMGW dla Zatoki Gdańskiej — **sprawdź licencję
  danych IMGW na użytek komercyjny**; jeśli niejasna — pomiń
- punkty na trasie: Gdańsk, środek trasy (ok. 56,5° N, 18,5° E),
  podejście do Nynäshamn; okno: odejście rejsu ± 6 h
- zmienne: wysokość fali znaczącej, okres fali, porywy wiatru
- **progi — wstępne, z rozmowy z Gemini, niezweryfikowane:** fala znacząca
  > 3,8 m **lub** porywy > 40 węzłów → ryzyko „możliwe odwołanie rejsu".
  W tabeli parametrów ze źródłem „Gemini, niezweryfikowane — do potwierdzenia
  z przewoźnikiem i armatorem (II-3)"; w interfejsie oznaczenie „próg wstępny"

## II-9 · P1 — OPÓŹNIENIE WYPŁYNIĘCIA Z POZYCJI PROMU

Z pozycji AIS (Digitraffic): jeśli prom przypisany do rejsu nie może
zdążyć do portu odejścia przed planowaną godziną (odległość i prędkość),
→ ryzyko „opóźnienie wypłynięcia" dla transportów przypiętych do rejsu.
**Uwaga:** Digitraffic nie widzi okolic Gdańska (sprawdzone 25.09) —
tam decyduje rozkład i komunikaty armatora. Brak pozycji ≠ opóźnienie.

## II-6 · P1 — DROGI W SZWECJI: TRAFIKVERKET

Gotowe do włączenia, gdy właściciel poda klucz:
- **stan nawierzchni i pogoda drogowa** na stacjach wzdłuż E4 Nynäshamn –
  Boden: temperatura nawierzchni, śliskość, opady, wiatr. **Sprawdź aktualne
  nazwy obiektów i wersje schematu** w data.trafikverket.se — przykład
  z rozmowy z Gemini może być nieaktualny
- **utrudnienia i zamknięcia** (obiekty zdarzeń drogowych) na E4
- wynik: współczynnik spowolnienia odcinka SE do silnika II-7 —
  **wstępnie** +15% przy śniegu lub śliskości na stacjach na trasie
  (propozycja z rozmowy z Gemini, parametr do kalibracji III-1)

## II-7 · P1 — SILNIK TRAS I OPÓŹNIEŃ (ETA v2) — WŁASNY

1. **Korytarz jako linia**, zbudowany **jednorazowo z OpenStreetMap** (ODbL —
   użycie komercyjne dozwolone; w interfejsie „© OpenStreetMap contributors"):
   Śrem – terminal w Gdańsku oraz Nynäshamn – E4 – Boden, podzielony na
   **odcinki** (np. co 50 km i w miejscach zmiany charakteru drogi). Gdy
   przyjdzie trasa z zezwolenia (17.11) — podmiana linii
2. **Postęp z GPS:** rzut pozycji na korytarz → przejechane i pozostałe km.
   Dalej niż 2 km od korytarza → ryzyko „zjazd z trasy z zezwolenia"
3. **Czas pozostały** = suma po pozostałych odcinkach: km × tempo odcinka
   z parametrów uczonych w II-7b
4. **Okno promowe:** przyjazd po odprawie → następny rejs z `sailings`
5. **Odpoczynek kierowcy:** obsada jednoosobowa, prom = dobowy odpoczynek;
   na odcinku SE dobowy odpoczynek 11 h, gdy suma jazdy przekracza limit
6. **Korekta pogodowa i drogowa** z II-6 i II-8 (jako cechy w II-7b)
7. **Opóźnienie** wobec końca okna dostawy (I-25); > 30 min → ryzyko
   i powiadomienie; **rozbicie przyczyn** w interfejsie: jazda, odprawa,
   rejs, odpoczynek, pogoda
8. Zero zewnętrznych zapytań. Przeliczenie przy każdej nowej pozycji GPS

## II-7b · P1 — KALIBRACJA AUTOMATYCZNA, UCZĄCA SIĘ (decyzja właściciela)

Zastępuje III-1 (propozycja do zatwierdzenia). **Parametry poprawiają się
same, po każdym zakończonym transporcie** — w granicach zabezpieczeń.

**Dane uczące — zachowaj na stałe, zanim zniknie GPS:**
- po rozładunku z wejść i wyjść ze stref oraz z GPS wylicz **czasy
  i tempo każdego odcinka** i zapisz w tabeli kalibracji. Pozycje GPS
  kasowane są po 30 dniach — wyliczone czasy odcinków zostają
- cechy przy każdym pomiarze: dzień tygodnia, godzina wyjazdu, miesiąc,
  szerokość ładunku (≥ 3,1 m — pilot), rodzina elementu, konwój KR,
  warunki drogowe z II-6, pogoda z II-8, czy był odpoczynek dobowy
- **kody przyczyn nietypowych** (awaria, odwołany rejs, zamknięta droga) —
  taki pomiar nie uczy tempa normalnego, tylko statystykę przyczyny

**Jak się uczy:**
- start od wartości D-9 jako **wiedzy wstępnej**; nowa wartość = średnia
  ważona obserwacji i wiedzy wstępnej, gdzie waga obserwacji rośnie z ich
  liczbą (przy 1–2 transportach model prawie się nie rusza)
- nowsze transporty ważą więcej (zanikanie wagi — model nadąża za zimą)
- **poprawki kontekstowe** (weekend, noc, zima, szeroki ładunek, konwój)
  włączają się dopiero, gdy dany kontekst ma co najmniej 5 pomiarów
- **pasmo niepewności z danych:** kwantyle błędów; automatyczna korekta
  szerokości tak, żeby rzeczywiste przyjazdy mieściły się w paśmie
  w zadeklarowanym odsetku (np. 80%)
- umowny czas tranzytu 4–5 dni — punkt odniesienia w raporcie, nie wymuszenie

**Zabezpieczenia — warunek automatycznego stosowania:**
- **odrzucanie wartości odstających** (odporne statystyki, nie zwykła średnia)
- **limit zmiany:** parametr zmienia się najwyżej o 10% na tydzień
- **sprawdzenie wsteczne przed każdą zmianą:** nowe parametry muszą dać
  mniejszy błąd ETA na ostatnich zakończonych transportach niż obecne —
  jeśli nie, zmiana nie wchodzi
- **automatyczne wycofanie**, gdy dokładność na nowych transportach spadnie
- każda wersja parametrów zapisana: przed, po, liczba pomiarów, błąd przed
  i po; **HHL_ADMIN może zamrozić kalibrację albo wrócić do dowolnej wersji
  jednym kliknięciem**
- błędy danych (luki GPS, brak zdarzeń stref, podejrzane daty z pliku KSH)
  → pomiar wykluczony z nauki, z powodem

**Widok „Dokładność ETA" dla HHL:** błąd ETA w chwili załadunku, w Gdańsku,
w Nynäshamn i 24 h przed dostawą; trend w czasie; skuteczność pasma;
ostatnie zmiany parametrów z uzasadnieniem.

**Test przed uruchomieniem:** symulacja 30 transportów z wiedzą o „prawdziwym"
tempie innym niż D-9 → model zbliża się do prawdy, nie przekracza limitów
zmian, wartość odstająca go nie rozstraja, wycofanie działa.

## I-29 · P1 — BUDŻETY DARMOWYCH PLANÓW DLA 140 TRANSPORTÓW

Przelicz dla 140 transportów w ok. 13 tygodni: Resend (100 e-maili/dobę),
bramka SMS (150/dobę), baza 500 MB (GPS według PR5), funkcje Edge
500 000/mies., (bez serwisu tras — nie dotyczy), Trafikverket. Tabela: szczyt dobowy
wobec limitu.
