# TOWER — system projektowy

Ten dokument istnieje po to, żeby aplikacja produkcyjna wyglądała **dokładnie**
jak makieta, i żeby każda funkcja dodana za pół roku dalej wyglądała jak część
tego samego narzędzia.

Źródłem prawdy jest `app/tower.css`. Ten plik wyjaśnia **dlaczego** tak jest,
żeby zmiany nie rozjechały całości.

---

## 1. Kierunek

Nie jest to dashboard SaaS. Jest to **konsola dyspozytorska** dla jednej trasy,
jednego promu i jednego placu budowy, używana przez trzy firmy, które sobie nie
do końca ufają. Wszystkie decyzje wizualne wynikają z trzech rzeczy:

1. **Gęstość ponad przestronność.** Dyspozytor patrzy na to osiem godzin dziennie
   i chce widzieć 40 wierszy bez przewijania, nie 6 kart z dużym oddechem.
2. **Hierarchia przez linie i stopnie tła, nie przez cienie i zaokrąglenia.**
   Włos linii `--rule` i trzy poziomy powierzchni. Zero `box-shadow`.
   Promień 2 px na kontrolkach, 0 na panelach i tabelach.
3. **Kolor jest sygnałem, nigdy dekoracją.** Bursztyn to jedyna ciepła rzecz
   na ekranie i znaczy „zwróć uwagę". Jeśli coś jest bursztynowe bez powodu,
   bursztyn przestaje działać.

Odniesienie wizualne: oznakowanie transportowe i dokumenty przewozowe —
Barlow ma rodowód w krojach sygnaturowych transportu publicznego, cyfry są
tabelaryczne, a układ nagłówka szuflady transportu naśladuje nagłówek listu
przewozowego.

---

## 2. Tokeny

Wszystkie w `:root`. **Nigdy nie podmieniaj wartości istniejącego tokenu** —
nowa potrzeba to nowy token dopisany na końcu bloku.

### Powierzchnie i tekst

| Token | Jasny | Ciemny | Do czego |
|---|---|---|---|
| `--page` | `#E3E9ED` | `#080F15` | tło całej strony, nigdy panelu |
| `--surface` | `#FFFFFF` | `#101C25` | panel, pasek, szuflada |
| `--surface-2` | `#F4F7F9` | `#16242F` | nagłówek panelu, pasek filtrów, hover wiersza |
| `--surface-3` | `#EAEFF3` | `#1D2E3A` | aktywny etap korytarza, tło mapy |
| `--ink` | `#0E1A24` | `#DCE7EE` | tekst główny, liczby KPI |
| `--ink-2` | `#3C4E5C` | `#A4B6C2` | etykiety, nagłówki tabel |
| `--ink-3` | `#6C7D8A` | `#748896` | metadane, jednostki, tekst wyszarzony |
| `--rule` | `#C9D5DD` | `#263A48` | granica panelu, ramka kontrolki |
| `--rule-2` | `#DEE6EB` | `#1C2B36` | granica wiersza tabeli, separator wewnętrzny |

`--ink` to celowo **granatowy tusz**, nie czerń. `#0E1A24` ma wyraźny niebieski
podkład. Czysta czerń czyta się jako domyślna paleta generatora.

### Sygnały

| Token | Jasny | Ciemny | Znaczenie — jedyne dopuszczalne |
|---|---|---|---|
| `--amber` / `--amber-bg` | `#C97E12` / `#FBEFD9` | `#E5A544` / `#3A2C12` | **wymaga uwagi**: ryzyko średnie, podświetlenie, wskaźnik „dziś" |
| `--red` / `--red-bg` | `#B32639` / `#F8DEE2` | `#E8687C` / `#3B1720` | **blokada lub strata**: brak dokumentu, opóźnienie, marża pod progiem |
| `--go` / `--go-bg` | `#1B6E5D` / `#DCEDE8` | `#4FB79E` / `#0F2B27` | **zamknięte poprawnie**: dostarczone, dokument kompletny |
| `--sea` / `--sea-bg` | `#245C87` / `#DCE8F1` | `#6BA8D6` / `#12283A` | **w ruchu**: transport w trasie, prom, trasa na mapie |
| `--plan` / `--plan-bg` | `#6C7D8A` / `#E6ECF0` | `#7E93A1` / `#1A272F` | **nic się jeszcze nie dzieje**: planowany, archiwalny |
| `--focus` | `#1D6FB8` | `#5AA6E8` | wyłącznie obrys fokusu klawiatury |

Zieleń jest **zimna i przygaszona** (`#1B6E5D`), nie `#22C55E`. Czerwień jest
ceglana (`#B32639`), nie `#EF4444`. To odróżnia od domyślnych palet Tailwinda,
które każdy rozpoznaje na pierwszy rzut oka.

### Tryb ciemny — trzy deklaracje, wszystkie obowiązkowe

```css
:root { /* jasny */ }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* ciemny */ } }
:root[data-theme="dark"] { /* ciemny */ }
```

Pierwsza to domyślna. Druga honoruje ustawienie systemu, ale ustępuje, gdy
użytkownik wymusił jasny. Trzecia obsługuje przełącznik w nagłówku.
**Usunięcie którejkolwiek psuje jeden z trzech przypadków.**

---

## 3. Typografia

Dwa kroje, oba z rodziny Barlow. Nic więcej.

| Zastosowanie | Krój | Waga | Rozmiar |
|---|---|---|---|
| Logo | Barlow Condensed | 700 | 23 px / `letter-spacing:.06em` |
| Liczba w kafelku KPI | Barlow Condensed | 700 | 42 px |
| Licznik etapu korytarza | Barlow Condensed | 700 | 30 px |
| Kod wysyłki w nagłówku szuflady | Barlow Condensed | 700 | 31 px |
| Numer tygodnia i odliczanie w pasku operacyjnym | Barlow Condensed | 700 | 15–17 px |
| Nagłówek panelu `h2` | Barlow Condensed | 600 | 17 px |
| Nagłówek sekcji `h4.sec` | Barlow Condensed | 600 | 15 px |
| Nagłówek kolumny tabeli | Barlow Condensed | 600 | 13 px |
| Kod wysyłki, nr rejestracyjny, pigułka statusu | Barlow Condensed | 600–700 | dziedziczy |
| Tekst interfejsu | Barlow | 400/500 | 14 px |
| Komórka tabeli | Barlow | 400 | 13,2 px |
| Metadane, jednostki, podpisy | Barlow | 400 | 11,5–12,5 px |

Skok między 42 px a 11 px jest celowy. Liczbę KPI czytasz z drugiego końca
sali, etykietę z czterdziestu centymetrów. Równa skala to układ generatora,
nie układ narzędzia.

**Barlow Condensed = wszystko, co jest identyfikatorem albo liczbą.**
Barlow zwykły = wszystko, co jest zdaniem. Ta jedna reguła trzyma cały rytm.

`font-variant-numeric: tabular-nums` na `body`. Nie usuwaj — bez tego kolumny
z kwotami drgają przy odświeżeniu.

Polskie formatowanie liczb w wymiarach i masach: przecinek dziesiętny
(`18,21`, `20,74 t`).

**Kwoty: wyłącznie EUR.** PLN wyłącznie na kokpicie, jako przeliczenie.
SEK nigdzie. Jedna funkcja formatująca dla całej aplikacji. Symbol czy kod
waluty i format liczby według języka — decyzja P5 w `MECHANIZM_PIENIEDZY.md`.
Makieta pokazuje „PLN" — to jest **treść sprzed decyzji**, nie forma;
forma makiety obowiązuje nadal.

**Nigdy:** Inter, systemowy stack, wersaliki w etykietach, kursywa.

---

## 4. Gęstość — dwa różne tryby, celowo

To nie jest niekonsekwencja. Narzędzie, na które patrzysz rano przez minutę,
i tabela, w której pracujesz godzinę, mają inne potrzeby.

**Tryb konsoli** — kokpit, kolejka wyjątków, szuflada:
padding `9–13 px`, tekst 13,2–14 px, odstęp między blokami 13 px.

**Tryb tabeli** — harmonogram, faktury, dokumenty:
padding komórki `6px 9px`, tekst 13,2 px, nagłówek `7px 9px`, wiersz ~27 px.
`position: sticky` na `thead th`, `max-height: calc(100vh - 260px)` na `.tablewrap`.

---

## 5. Katalog komponentów

Klasy są **stabilnym kontraktem**. Zmiana nazwy klasy = zmiana w `tower.css`.

| Klasa | Co to jest | Reguły |
|---|---|---|
| `.topbar` | pasek górny, 52 px | brand, przełącznik roli, język, motyw, zegar |
| `.corridor` / `.stage` | pasek dziewięciu etapów trasy | zawsze widoczny; klik filtruje; `aria-pressed` |
| `nav button` | pozycja nawigacji | lewy pasek 3 px `--amber` przy `aria-current="page"` |
| `.panel` | kontener treści | `border: 1px solid --rule`, margines 12 px, **bez cienia, bez promienia** |
| `.panel-hd` | nagłówek panelu | tło `--surface-2`, `h2` w Condensed, `.sub` w `--ink-3` |
| `.kpis` / `.kpi` | pasek sześciu wskaźników | siatka 3 kolumny, granice `--rule-2`, liczba w Condensed 29 px |
| `.exq` | kolejka wyjątków | **pas wagi 3 px po lewej** (`.gut`), nigdy kolorowe tło wiersza |
| `.pill` + `.p-*` | status | Condensed 600, 11,5 px, promień 2 px, tło `*-bg`, tekst `*` |
| `.flagrow` / `.flag` | komplet dokumentów | kwadrat 16 px, litera Z/C/P/M, `.ok` lub `.miss` |
| `.filters` | pasek filtrów nad tabelą | tło `--surface-2`, `.chipbtn` z `aria-pressed` |
| `.mapsplit` | mapa i lista | 1,25 fr / 1 fr, poniżej 1000 px jedna kolumna |
| `.maplayers` / `.mapkey` | nakładki mapy | biały panel z ramką, bez przezroczystości |
| `.drawer` / `.scrim` | szuflada transportu | 560 px, wysuwana z prawej, `Esc` zamyka |
| `.dtabs` | zakładki szuflady | aktywna: dolny pas 2 px `--amber`, tło `--surface` |
| `.kv` | lista pola–wartość | siatka `150px 1fr`, `dt` w `--ink-3` |
| `.tl` | oś przebiegu | pionowa linia 1 px, znacznik 9 px, `.future` wyszarzony |
| `.mrow` / `.mrow.total` | wiersz kwoty | podkreślenie `--rule-2`, suma z górną linią `--rule` |
| `.locked` | zablokowana cena | ramka przerywana, tło `--surface-2`, tekst `--ink-3` |
| `.wf` / `.sw` | reguła automatyzacji z przełącznikiem | przełącznik 32×18, `aria-pressed` |
| `.banner` / `.banner.red` | komunikat kontekstowy | **lewy pas 3 px**, tło `*-bg`, nigdy gradient |
| `.note` | wyjaśnienie pod panelem | 12,5 px, `--ink-3`, tło `--surface-2` |
| `.code` / `.mono` | identyfikator | Barlow Condensed 600, `letter-spacing:.03em` |
| `.ops` | pasek operacyjny w nagłówku | numer tygodnia, odliczanie do rejsu, godzina — nie sam zegar |
| `.wb-code` / `.wb-fields` / `.perf` | nagłówek szuflady w formie listu przewozowego | rubryki rozdzielone włosem linii, perforacja pod spodem |
| `td.over` / `.board` / `.banner.red::before` | tablica wyróżniająca | ukośne pasy czerwono-białe, **dokładnie trzy miejsca** |
| `th.stick` / `td.stick` | ostatnia kolumna finansowa | `position:sticky; right:0` — liczba, dla której otwierasz tabelę, zostaje na ekranie |
| `.skel` | szkielet ładowania | wiersze w rytmie tabeli, nigdy spinner |
| `.empty` | stan pusty | nagłówek, zdanie wyjaśnienia, przycisk wyjścia z filtra |
| `kbd` / `.kbdhint` / `.kbdpanel` | skróty klawiszowe | podpowiedzi widoczne w interfejsie, pełna lista pod `?` |
| `.minimap` | podgląd mapy na kokpicie | 360 px wysokości, `place-items:center`, svg `height:100%` |

---

## 6. Antywzorce — lista rzeczy, które psują ten interfejs

Każda z nich to moment, w którym narzędzie zaczyna wyglądać na wygenerowane.

1. **`box-shadow` gdziekolwiek.** Hierarchia idzie przez linie i stopnie tła.
2. **`border-radius` większy niż 2 px.** Panele i tabele mają 0.
3. **Gradienty.** Żadnych. Nawet subtelnych.
4. **Kolorowe tło całego wiersza dla oznaczenia wagi.** Waga idzie na pas 3 px
   po lewej stronie. Kolorowe tła na liście sprawiają, że nic nie wyróżnia się
   po pięciu minutach.
5. **Ikony emoji.** Nigdy.
6. **Motyw shadcn/ui.** Jego zmienne kolidują z tokenami tego systemu.
7. **Klasy Tailwinda w komponentach aplikacji.** `class="panel"` obok
   `className="p-4 rounded-lg"` to najszybsza droga do rozjazdu.
8. **Nowy kolor spoza palety sygnałów.** Jeśli potrzebujesz nowego znaczenia,
   najpierw zapytaj, czy naprawdę nie mieści się w pięciu istniejących.
9. **Wersaliki w etykietach.** Nagłówki tabel są w Condensed 600, nie w caps.
10. **Karty o równej wysokości w siatce 2×3.** To jest układ generatora, nie
    układ narzędzia. Gęstość ma wynikać z funkcji.
11. **Spinner jako stan ładowania tabeli.** Szkielet wierszy w tym samym
    rytmie co dane. Użytkownik ma widzieć, że coś przyjdzie, i gdzie.
12. **Pusty stan bez instrukcji.** „Brak danych" to nie komunikat.
    „Brak transportów w tym etapie — zmień filtr albo zaimportuj harmonogram" to jest.
13. **Tekst zastępczy typu „Lorem" albo „Przykładowy klient".** Wszystkie nazwy
    w interfejsie mają być prawdziwe albo puste.
14. **Zaokrąglanie kwot w tabeli.** Kwota z faktury i kwota z cennika muszą
    zgadzać się co do złotówki, inaczej moduł dopasowania jest bez sensu.

---

## 7. Dodawanie nowego widoku

1. Zacznij od `.panel` z `.panel-hd`. Nigdy od pustego `div`.
2. Jeśli to lista rzeczy do zrobienia → wzorzec `.exq` z pasem wagi.
3. Jeśli to dane tabelaryczne → `.tablewrap > table` z `thead` sticky.
4. Jeśli to kwoty → `.mrow`, suma jako `.mrow.total`.
5. Jeśli widok jest ograniczony rolą → nie ukrywaj kolumny w JSX.
   Zapytanie ma nie zwracać tych danych. Blokada jest w bazie (patrz `0001_core.sql`),
   a `.locked` tylko tłumaczy użytkownikowi, dlaczego pola nie ma.
6. Każdy panel kończy się `.note`, jeśli jest coś, czego użytkownik może nie
   zrozumieć. To jest miejsce na jedno zdanie wyjaśnienia, nie na instrukcję.
7. Dodaj stan pusty, stan ładowania i stan błędu. Zanim dodasz stan wypełniony.

---

## 8. Ikony

Dwanaście ikon rysowanych dla tej dziedziny, w obiekcie `ICONS`. Inline SVG,
viewBox 20×20, `stroke-width: 1.5`, **`stroke-linecap: square`**, `currentColor`,
bez wypełnień poza jednym półkolem w przełączniku motywu.

kokpit (profil korytarza) · mapa (strefa z pojazdem) · harmonogram (naczepa
niskopodwoziowa z ładunkiem wystającym poza obrys) · ryzyka (tablica
ostrzegawcza) · dokumenty (zezwolenie z pieczęcią) · finanse (przychód, koszt,
reszta) · faktury · automatyzacje (wyzwalacz i dwie akcje) · strefy · zadania
(lista z niedokończoną pozycją) · prom · motyw.

Kwadratowe zakończenia kresek odróżniają ten zestaw od każdego popularnego —
Lucide, Heroicons, Phosphor i Feather mają zaokrąglone. Naczepy z ładunkiem
wystającym poza obrys nie ma w żadnej bibliotece, bo poza ciężkim transportem
nikt jej nie potrzebuje. Dlatego działa.

**Nie dokładaj ikon z bibliotek.** Nowa potrzeba to nowy rysunek w `ICONS`,
w tej samej konwencji. Jedna ikona z innego zestawu psuje cały pasek.

## 9. Tablica wyróżniająca — motyw dziedzinowy

Ładunek ponadnormatywny oznacza się tablicą w czerwono-białe ukośne pasy.
Interfejs cytuje ten wzór `repeating-linear-gradient(45deg, …)` w **dokładnie
trzech miejscach**:

1. górna krawędź alertu krytycznego (`.banner.red::before`)
2. lewa krawędź komórki z wymiarami ponadnormatywnymi w tabeli (`td.over`)
3. miniatura tablicy przy wymiarach zestawu w szufladzie (`.board`)

**Czwarte użycie zabiłoby efekt.** Motyw dziedzinowy działa, dopóki jest rzadki
i zawsze znaczy to samo. Jeśli potrzebujesz oznaczyć coś innego, użyj koloru
sygnałowego, nie pasów.

## 10. Skróty klawiszowe

Narzędzie, w którym ktoś siedzi osiem godzin, ma klawiaturę. To jest element,
którego wygenerowane pulpity nie mają nigdy.

| Klawisz | Działanie |
|---|---|
| `/` | fokus na szukajkę harmonogramu |
| `1`–`9` | przełącz etap korytarza |
| `K` `M` `H` `R` `D` `F` | kokpit, mapa, harmonogram, ryzyka, dokumenty, finanse |
| `Shift + R` | następna rola |
| `T` | jasny / ciemny |
| `Esc` | zamknij szufladę, potem wyczyść filtry |
| `?` | lista skrótów |

**Podpowiedzi muszą być widoczne w interfejsie**, nie tylko w dokumentacji:
cyfry w rogu każdego etapu korytarza, `kbd` z ukośnikiem przy szukajce,
pełna lista pod znakiem zapytania w nagłówku. Skrót, o którym nikt nie wie,
nie istnieje.
