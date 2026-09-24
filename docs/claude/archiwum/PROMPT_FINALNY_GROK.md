# PROMPT FINALNY DLA GROK BOT — pełne przekazanie projektu TOWER

> Wklej w całości. Nie skracaj. Każdy punkt ma powód i będzie weryfikowany.

---

# KONTEKST

Zbudowałeś **TOWER** — control tower dla transportu konstrukcji stalowych
ponadnormatywnych z Polski do Boden w Szwecji. Projekt: KSH dla Stegra.
Trzy strony: H&H Logistics (spedytor), KSH (klient), Scandinavian Express
(przewoźnik). Wdrożenie: `watch-tower-makieta.vercel.app`.

Projekt wchodzi w fazę produkcyjną: baza danych z rozdzieleniem uprawnień,
import harmonogramu, geofencing, telematyka, silnik reguł, obieg dokumentów,
cennik z indeksacją paliwową, fakturowanie z dopasowaniem trójstronnym,
moduł ryzyka. Dokończenie odbywa się w Cursor, celem jest wdrożenie
produkcyjne u trzech firm.

**Twoim zadaniem nie jest budowanie tej logiki.** Twoim zadaniem jest
przekazanie wszystkiego, co wiesz o tym projekcie, w formie, którą da się
wczytać do bazy wiedzy — oraz naprawa konkretnych defektów.

---

# ZASADY

1. **Najpierw przekazanie, potem naprawy.** Etap A i B wykonujesz
   **nie zmieniając ani jednej linii kodu**. Wersja, którą przekazujesz,
   musi być tą samą, którą przeanalizowano. Naprawy to etap D.

2. **Nie wolno zawężać zakresu.** Jeżeli czegoś nie da się zrobić, wpisujesz
   to do manifestu z powodem. Nie usuwasz pozycji, nie łączysz jej z inną,
   nie uznajesz za nieistotną.

3. **Nie improwizuj.** Jeżeli czegoś nie wiesz, nie masz albo nie pamiętasz —
   napisz „nie mam" i **wskaż, kto to ma**. Wymyślona odpowiedź kosztuje
   potem dni pracy. „Nie mam dostępu do repozytorium" jest odpowiedzią
   przydatną. Opisany z pamięci plik, którego nie widzisz, nie jest.

4. **Nie streszczaj tego promptu w odpowiedzi.** Wykonuj go.

---

# ETAP 0 — SPRAWDZENIE DOSTĘPU (odpowiedz przed rozpoczęciem)

Odpowiedz krótko, punkt po punkcie. Od tych odpowiedzi zależy, co ma sens
wykonywać dalej.

1. **Masz dostęp do pełnego kodu źródłowego tego wdrożenia?**
   Jeśli tak — skąd (repozytorium, kod wygenerowany w tej rozmowie, inne).
   Jeśli nie — do czego masz dostęp i kto ma resztę.

2. **Możesz odtworzyć pełną historię naszych rozmów o tym projekcie?**
   Jeśli nie — powiedz to wprost i napisz, ile z niej pamiętasz
   w bieżącym kontekście. **Nie udawaj, że pamiętasz więcej.**

3. **Możesz uruchomić kod, zrobić zrzuty ekranu, wykonać polecenia?**
   Jeśli nie — napisz, które punkty etapu C i D odpadają z tego powodu.

4. **Których punktów manifestu (etap B) nie jesteś w stanie wypełnić
   i dlaczego?**

Po tych czterech odpowiedziach **zatrzymaj się i poczekaj na potwierdzenie.**

---

# ETAP A — WIEDZA, KTÓRĄ MASZ TYLKO TY

To jest najważniejsza część i nie da się jej odtworzyć z kodu.
Kod pokazuje, **co** jest. Ta część pokazuje, **dlaczego** i **dokąd zmierza**.

Wynik: plik `00_KONTEKST.md`.

## A1. Intencja i kierunek

- Do czego ten system ma docelowo służyć, poza obsługą jednego projektu Stegra
- Czy ma być produktem wielokrotnego użytku dla kolejnych projektów
  ponadgabarytowych, czy narzędziem jednorazowym
- Jakie problemy operacyjne miał rozwiązać w pierwszej kolejności
- Co było uznane za najważniejsze, a co za dodatek

## A2. Pomysły omówione, ale niezbudowane

**Wypisz wszystkie**, nawet te odrzucone. Dla każdego: na czym polegał,
dlaczego nie wszedł, czy odrzucenie było ostateczne.

To jest materiał, którego nie ma nigdzie indziej. Odrzucony pomysł
z uzasadnieniem jest wart więcej niż zbudowana funkcja bez kontekstu.

## A3. Integracje: zbudowane, zaczęte, planowane, omówione

Tabela:

| Integracja | Stan | Po co | Co blokuje | Kto ma dostęp |
|---|---|---|---|---|

Stany: `DZIAŁA` · `ZACZĘTA` · `ATRAPA` · `PLANOWANA` · `OMÓWIONA I ODRZUCONA`

Obejmij wszystko, co kiedykolwiek padło: telematyka przewoźnika,
SharePoint klienta, Trafikverket, pogoda morska, komunikaty armatora,
AIS, kursy walut, indeksy paliwowe, poczta, SMS, kalendarz, faktoring,
KSeF, e-CMR, ślad węglowy, cokolwiek innego.

## A4. Decyzje projektowe i ich uzasadnienia

Dlaczego tak, a nie inaczej. Szczególnie:
- dlaczego Leaflet zamiast innego silnika mapy
- dlaczego taki podział ról i uprawnień
- dlaczego taka struktura danych
- dlaczego taki zestaw widoków
- skąd wzięły się moduły dodane poza pierwotnym zakresem
  (Opcje, faktoring, powiadomienia, przeciągane karty)

## A5. Mapa drogowa, jaka była w głowie

Co miało być następne. W jakiej kolejności. Co było odkładane i na kiedy.

## A6. Prompty źródłowe

Wszystkie, po kolei, **dosłownie**, bez streszczania. Łącznie z tymi,
których nie wykonałeś w całości — z informacją, czego nie wykonałeś.

## A7. Historia rozmowy

Jeżeli **możesz** odtworzyć przebieg rozmów o tym projekcie — zrób to,
chronologicznie, z zachowaniem tego, co proponowałem, co odrzucałem
i jak zmieniał się kierunek.

Jeżeli **nie możesz** — napisz to jednym zdaniem i przejdź dalej.
Historię dostarczy właściciel projektu ze swojej strony.
**Nie odtwarzaj jej z domysłów.**

---

# ETAP B — MANIFEST KOMPLETNOŚCI

Wynik: plik `08_MANIFEST.md`.

To jest zabezpieczenie przed cichym zawężeniem zakresu. Wypełnij **każdą**
linię. Puste pole oznacza pominięcie.

Kolumny: `Pozycja` · `Mam` (TAK / NIE / NIE DOTYCZY) · `Gdzie jest` ·
`Kto ma, jeśli nie ja` · `Uwaga`

## B1. Kod i konfiguracja
1. Pełne drzewo źródeł
2. `package.json`
3. Plik blokady wersji
4. Konfiguracja budowania (Vite / bundler)
5. Konfiguracja TypeScript
6. Konfiguracja CSS / PostCSS / Tailwind
7. Konfiguracja lintera i formatowania
8. `.env.example` — nazwy zmiennych bez wartości
9. Konfiguracja wdrożenia (`vercel.json`, ustawienia projektu)
10. Funkcje serwerowe (`api/`) — kod i konfiguracja
11. Konfiguracja CI, jeśli istnieje
12. Polecenia uruchomienia lokalnego od czystego katalogu
13. Wersja Node i menedżera pakietów

## B2. Wygląd
14. Arkusz stylów w wersji źródłowej, nie zbudowanej
15. Pełna lista zmiennych CSS z wartościami dla obu trybów
16. Jednostka rytmu odstępów
17. Skala rozmiarów tekstu
18. Breakpointy
19. Konwencja nazw klas
20. Które klasy są własne, a które z frameworka
21. Kroje: nazwy, wagi, źródło, licencja, sposób hostowania
22. Ikony: pliki źródłowe albo nazwa i wersja biblioteki, licencja
23. Kafelki mapy: dostawca, warunki, klucz, limity, atrybucja
24. Pozostałe zasoby graficzne i podstawa prawa do użycia
25. Mechanizm zamrożenia zegara do powtarzalnych zrzutów
26. Zrzuty wzorcowe (specyfikacja w etapie C)
27. Skrypt generujący zrzuty

## B3. Dane i logika
28. Typy wszystkich encji
29. Generator danych demonstracyjnych — kod, nie wynik
30. Role: nazwy w kodzie i pełna macierz uprawnień
31. Gdzie żyje stan i co ginie po odświeżeniu strony
32. Warstwa trwała, jeśli istnieje — schemat i migracje
33. Logika cen: gdzie liczona, jakim wzorem
34. **Dokładny wzór dopłaty paliwowej: plik, linia, postać wzoru**
35. Logika ETA: gdzie liczona, jakim modelem
36. Logika stref geofencingu, jeśli jest
37. Logika ryzyk: skąd pochodzą wpisy w kolejce
38. Logika statusów i przejść między nimi
39. Słowniki tłumaczeń w trzech językach
40. Formatowanie liczb, dat i stref czasowych

## B4. Parametry biznesowe
41. Stawki cennika — **czy są prawdziwe, czy wymyślone**
42. Indeks paliwowy: definicja, źródło, jednostka, okres bazowy
43. Kursy walut: źródło, konwencja, dzień odczytu
44. Warunki faktoringu
45. Kody przyczyn opóźnień i kto ponosi koszt przy każdym
46. Terminy uzupełnienia danych i ścieżki eskalacji
47. Progi ryzyka: pogodowe, czasowe, dokumentowe
48. Limity wymiarowe per kraj i ich źródło
49. Cykl fakturowania i progi tolerancji dopasowania

## B5. Stan działania
50. Tabela „co działa, a co jest fasadą" (etap C)
51. Znane błędy i rzeczy niedokończone
52. Testy, które istnieją, i ich pokrycie
53. Stan dostępności: klawiatura, kontrast, czytniki ekranu
54. Obsługa błędów i logowanie
55. Monitoring i analityka, jeśli są
56. Obsługiwane przeglądarki i urządzenia
57. Wyniki pomiarów wydajności, jeśli były robione

## B6. Wiedza nieudokumentowana
58. Intencja i kierunek (A1)
59. Pomysły niezbudowane (A2)
60. Integracje: pełna tabela (A3)
61. Decyzje i uzasadnienia (A4)
62. Mapa drogowa (A5)
63. Prompty źródłowe (A6)
64. Historia rozmowy (A7)

---

# ETAP C — PAKIET PRZEKAZANIA

Osiem plików tekstowych plus repozytorium. **Pliki tekstowe idą do bazy
wiedzy projektu, kod i zrzuty do repozytorium.** Nie pakuj wszystkiego
w jedno archiwum binarne — bazy wiedzy nie da się nakarmić dwumegabajtowym
bundlem JavaScriptu.

| Plik | Zawartość |
|---|---|
| `00_KONTEKST.md` | etap A w całości |
| `01_HANDOVER.md` | architektura, drzewo plików z opisem, przepływ danych, uruchomienie |
| `02_FASADA.md` | tabela: co działa, co jest fasadą |
| `03_PARAMETRY_BIZNESOWE.md` | punkty 41–49 manifestu |
| `04_INTEGRACJE.md` | punkty B1.10, B5.54–55, tabela A3 |
| `05_DANE_I_LOGIKA.md` | punkty 28–40 manifestu |
| `06_WYGLAD.md` | punkty 14–24 manifestu |
| `07_ZNANE_BLEDY.md` | punkty 51–57 manifestu |
| `08_MANIFEST.md` | etap B wypełniony w całości |

## C1. Tabela „co działa, a co jest fasadą"

Najważniejsza pojedyncza tabela w całym przekazaniu. Nie da się jej wyczytać
z kodu z pewnością.

| Element | Plik : linia | Stan | Uwaga |
|---|---|---|---|

Stany: `DZIAŁA` · `ATRAPA` (wygląda, nic nie robi) · `CZĘŚCIOWO` ·
`ZAKOMENTOWANE` · `PORZUCONE`

Obejmij: każdy przycisk, pole formularza, zakładkę, filtr, przełącznik,
element mapy, akcję w szufladzie, eksport, powiadomienie.

Osobno wypisz:
- wartości **zaszyte na sztywno zamiast liczonych**
- liczby **wymyślone** w odróżnieniu od liczonych z danych
- funkcje zaczęte i porzucone

## C2. Zrzuty wzorcowe

Najpierw dodaj **mechanizm zamrożenia zegara** — parametr adresu
`?now=2026-09-23T14:32:00Z` albo zmienną `VITE_FROZEN_NOW`. Bez tego żaden
zrzut nie jest powtarzalny, bo nagłówek pokazuje bieżący czas i odliczanie
do rejsu.

Zakres: **każdy widok × każda rola × każdy język × szerokości 1920, 1440,
1280, 768, 390 × tryb jasny i ciemny**, plus stany: spoczynek, najechanie
na wiersz, fokus klawiatury, przycisk zablokowany, ładowanie, lista pusta,
błąd, błąd walidacji, oraz każda zakładka szuflady transportu osobno.

Parametry: PNG, `deviceScaleFactor: 1`, `prefers-reduced-motion: reduce`,
oczekiwanie na `document.fonts.ready`, bez kompresji stratnej.
Nazwy: `widok__rola__jezyk__szerokosc__motyw.png`.

Dołącz skrypt, który je generuje, żeby dało się je odtworzyć po każdej zmianie.

---

# ETAP D — NAPRAWY

Dopiero po zatwierdzeniu etapów A–C. Każdy punkt to **osobny commit
z opisem**. Na koniec raport `NAPRAWY.md`: punkt, plik, co zmieniono,
jak sprawdzić.

Kolejność obowiązkowa: D1–D8 przed resztą.

## Wysoki priorytet

**D1. Usuń Tailwind z warstwy komponentów.**
Dowód: w zbudowanym arkuszu są zmienne `--tw-rotate-x`, `--tw-shadow`,
`--tw-ring-offset-color`, `--tw-backdrop-blur` oraz klasy `.flex`, `.grid`,
`.absolute`, `.relative`, `.hidden`, `.p-0`, `.p-2`, `.p-3`, `.p-4`.
Dwa konkurujące systemy stylowania rozjeżdżają wygląd tam, gdzie klasa
użytkowa nadpisze regułę systemową. Wygląd ma żyć w jednym arkuszu.
Gdzie potrzebujesz układu, dopisz nazwaną klasę opisującą **rolę** elementu,
nie jego wygląd.
*Akceptacja:* zero ciągów `--tw-` i klas użytkowych w zbudowanym arkuszu,
zrzuty wzorcowe bez różnic.

**D2. Usuń systemowy stack czcionek z preflight.**
Dowód: `--default-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
Roboto, …`. W miejscach nieobjętych regułą systemową tekst renderuje się
poza Barlow, inaczej na każdym systemie operacyjnym.
*Akceptacja:* jedyne kroje to Barlow i Barlow Condensed z jawnym łańcuchem
zastępczym.

**D3. `POST /api/trafikverket` zwraca 405.**
Dowód: cztery żądania przy wejściu na widok, wszystkie 405 — endpoint nie
istnieje. Tymczasem kolejka ryzyk pokazuje „T-17 · E4 zamknięta — Luleå
północ · objazd +120 min · E4 CLOSED · źródło: Trafikverket". Interfejs
twierdzi, że ma dane od szwedzkiego zarządcy dróg, a ich nie ma. To nie jest
brakująca funkcja, to fałszywa informacja na ekranie operacyjnym.
*Wybierz i napisz co wybrałeś:* wdrożyć prawdziwą funkcję serwerową albo
widocznie oznaczyć panel i wpisy jako dane demonstracyjne.
*Akceptacja:* zero żądań z błędem przy przejściu wszystkich widoków.

**D4. Trzy sprzeczne stany jednego rejsu.**
Dowód, jeden ekran, kokpit, rola H&H: nagłówek odlicza 22 h 59 min do
„Nova Star · 24.09 17:00 · fala 1,1 m"; baner mówi „Rejs 24.09 zagrożony,
fala 2,9 m"; kolejka ryzyk mówi „SG-32 · Prom anulowany — M/F Nova Star ·
24.09 · status armatora: CANCELLED".
*Naprawa:* jedno źródło prawdy o rejsie, czytane przez wszystkie trzy
komponenty. Rejs odwołany nie jest odliczany w nagłówku.
*Akceptacja:* nie da się wskazać dwóch miejsc mówiących co innego o tym
samym rejsie.

**D5. KPI nie zgadza się z paskiem korytarza.**
Dowód: KPI „Transporty w drodze 21", podpis „7 dostarczonych,
44 w przygotowaniu". Korytarz w tym samym momencie: Przygotowanie 21,
Załadunek 3, Droga PL 3, Gdańsk 4, Prom 6, Nynäshamn 4, Droga SE 19,
Boden 5, Dostarczone 7 — czyli 39 w trasie i 21 w przygotowaniu.
*Naprawa:* jedna funkcja licząca podział na etapy, używana przez oba
komponenty.
*Akceptacja:* liczby zgadzają się w każdej roli i przy każdym filtrze.

**D6. Telefon kierowcy w tabeli dla wszystkich ról.**
Dowód: kolumna „Telefon" widoczna dla KSH i dla przewoźnika, dla wszystkich
72 transportów, niezależnie od statusu. Imię, nazwisko i numer telefonu
to dane osobowe; klient nie potrzebuje numeru do transportu dostarczonego
trzy tygodnie temu.
*Naprawa:* kolumna znika z tabeli, numer zostaje w szufladzie, a dla roli
klienta jest widoczny tylko w oknie ±24 h wokół dostawy.

**D7. Udział paliwa ustawiony na 0%.**
Dowód: ekran Opcje, panel „BAF / SEFS · paliwo". Indeks
`SEFS_HYBRID_OKQ8_ORLEN`, cena bazowa 19,47 SEK/l, bieżąca 19,68 SEK/l,
maksimum dopłaty 2%, udział paliwa 0%. Przy wzorze
`((bieżąca − bazowa) / bazowa) × udział` dopłata zawsze wychodzi zero.
*Najpierw odpowiedz, dopiero potem naprawiaj:* jaki dokładnie wzór liczy
dopłatę w Twoim kodzie, plik i linia. Jeżeli wzór jest inny, niż zakładam,
naprawa bez tej odpowiedzi byłaby zepsuciem.

**D8. Godzina załadunku 02:00 w każdym wierszu.**
Dowód: „30.09.2026, 02:00" jako załadunek i „05.10.2026, 02:00" jako dostawa,
powtarzalnie. Podejrzenie: data bez godziny zapisana jako północ UTC
i przeliczona na strefę lokalną, albo godzina nie istnieje w danych.
*Naprawa:* rozstrzygnij, gdzie to powstaje. Daty w UTC, wyświetlanie
w `Europe/Warsaw`, dla dostaw w Szwecji rozważ `Europe/Stockholm` —
napisz, którą przyjąłeś.

## Średni priorytet

**D9. Cienie, promienie, `!important`.** `box-shadow` użyty 10 razy,
`border-radius` powyżej 2 px w 5 miejscach, `!important` raz. Reguła systemu:
zero cieni, zero gradientów poza motywem tablicy wyróżniającej i linią
perforacji, promień 2 px na kontrolkach i 0 na panelach i tabelach.

**D10. Niespójne formatowanie kwot.** W jednym wierszu koszt „8739"
i przychód „10 402,18". Jedna funkcja formatująca, `pl-PL`, dwa miejsca
po przecinku, spacja nierozdzielająca, stosowana wszędzie.

**D11. Ciągi debugowe w interfejsie.** Dowód: „permitFits=false",
„status armatora: CANCELLED", „E4 CLOSED · źródło: Trafikverket".
Identyfikatory z kodu i angielskie wartości wyliczeniowe na ekranie
polskiego interfejsu. Każda wartość wyliczeniowa dostaje tłumaczenie
w trzech językach; nazwy pól z kodu nie pojawiają się nigdy.

**D12. Dane zastępcze.** Dowód: „Driver 1", „+48 600 000 000", „PSE 1000".
Aplikacja będzie pokazywana klientowi i przewoźnikowi — widać natychmiast,
że to wypełniacz. Nazwiska polskie, litewskie i szwedzkie w proporcji
odpowiadającej flocie przewoźnika bałtyckiego, numery w formacie E.164
z realnymi prefiksami, rejestracje w formatach PL, SE i LT.

**D13. Wzorce wizualne poza katalogiem.** Nagłówek wersalikami
„HHL · ADMINISTRACJA", duży tytuł strony „Opcje", etykieta po prawej
w nagłówku panelu („CENNIK", „PALIWO"), karty przeciągane (`section-card`,
`section-grip`, `section-card-hd--drag`). Nie są złe — są nieudokumentowane,
więc następna osoba zrobi je inaczej. Dla każdego wpis w dokumentacji:
nazwa klasy, kiedy się stosuje, jakich tokenów używa, jak wygląda w obu
trybach. `section-card-hd--drag` łamie konwencję nazw — ujednolicić.

**D14. Adresowalne widoki.** Nawigacja zmienia stan, ale adres zostaje na `/`.
Nie da się wysłać odnośnika do widoku ani do transportu, ani zaadresować
stanu w teście. W pracy operacyjnej wkleja się linki, nie instrukcje
klikania. Potrzebne trasy `/harmonogram`, `/mapa`, `/ryzyka`,
`/transport/SG-32` oraz rola i język w adresie albo w trwałym ustawieniu.

**D15. Rozmiar paczki.** 2,0 MB JavaScriptu. Podział na części, mapa
ładowana leniwie. Docelowo pierwsze wczytanie poniżej 400 kB — kierowca
otwiera to na telefonie przy bramie terminalu.

## Niski priorytet

**D16. `data-theme="dark"` zaszyte w `<html>`.** Blokuje
`prefers-color-scheme`; ustawienie systemu jest ignorowane. Usuń atrybut
z dokumentu, przełącznik ustawia go dopiero po kliknięciu i zapamiętuje wybór.

**D17. Format daty w tabeli.** W każdym z 72 wierszy powtarza się ten sam rok.
Skróć do `30.09 06:00`, rok tylko tam, gdzie się zmienia. Pełna data zostaje
w szufladzie.

---

# CZEGO NIE WOLNO ZMIENIAĆ

1. **Wyglądu.** Kolory, odstępy, marginesy, wypełnienia, rozmiary tekstu,
   kroje, promienie, układ sekcji. Naprawy mają być niewidoczne na zrzutach —
   z wyjątkiem D6, D10, D11, D12, D13 i D17, gdzie zmienia się treść, nie forma.
2. **Nazw klas CSS.** To jest kontrakt warstwy testów.
3. **Struktury ról i uprawnień.** H&H widzi koszt, przychód i marżę.
   KSH widzi swoją cenę. Scandinavian Express widzi swoją stawkę.
4. **Trzech języków.** Polski, angielski, szwedzki. Żadnego nie usuwaj.
5. **Zakresu.** Nie usuwaj funkcji dlatego, że nie działa. Zgłoś ją w `02_FASADA.md`.

---

# KOLEJNOŚĆ I WSTRZYMANIA

```
ETAP 0  cztery odpowiedzi o dostępie    → STOP, czekaj na potwierdzenie
ETAP A  wiedza, którą masz tylko ty     → 00_KONTEKST.md
ETAP B  manifest kompletności           → 08_MANIFEST.md
ETAP C  pakiet przekazania + zrzuty     → STOP, czekaj na potwierdzenie
ETAP D  siedemnaście napraw             → NAPRAWY.md
```

Nie zaczynaj od kodu. Nie pomijaj punktów, które wydają Ci się oczywiste.
Jeżeli pozycji nie da się dostarczyć — wpisz to do manifestu z powodem
i wskaż, kto ją ma.
