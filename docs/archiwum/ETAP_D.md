> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# ETAP D — NAPRAWY

Etap C przyjęty. 720/720, zero nieudanych, jeden przebieg, skrypt
`2026-09-23-data-view`, suma paczki `138c2120…`. Nawigacja po atrybutach
zamiast po etykietach — właściwe rozwiązanie, nie obejście.

Masz teraz coś, czego nie miałeś przez cały projekt: **dowód, jak aplikacja
wygląda dzisiaj**. Od tej chwili każda zmiana wyglądu jest albo zamierzona
i udokumentowana, albo jest usterką. Trzeciej możliwości nie ma.

---

# ZASADY ETAPU D

## 1. Jedna naprawa, jeden commit

`fix(D7): wzór dopłaty paliwowej liczony z udziału paliwa`

Bez łączenia. Jeżeli naprawa wymaga zmian w pięciu plikach, to nadal
jeden commit — ale nie dwie naprawy w jednym.

## 2. Wzorzec regenerujemy tylko na końcu fali, nigdy częściowo

Część napraw **celowo zmienia to, co widać** — inne kwoty, inne teksty,
mniej kolumn. Test różnicy pikseli pójdzie wtedy na czerwono i to jest
poprawne zachowanie, nie usterka.

Zasada: **nie regeneruj wzorca po pojedynczej naprawie.** Czerwony test
w trakcie fali jest normalny. Na końcu fali:

1. pełny przebieg 720 jednym skryptem, bez dogrywek
2. raport: **ile z 720 ujęć się zmieniło i dlaczego** — grupami, jedno
   zdanie na grupę
3. commit wzorca + tag `baseline-fala-<numer>-<data>`
4. dopiero wtedy test znowu zielony i można iść dalej

Jeżeli po fali zmieniło się więcej ujęć, niż potrafisz uzasadnić —
zatrzymaj się i napisz. To znaczy, że naprawa ruszyła coś, czego nie miała.

## 3. Naprawa, która nie miała nic zmienić, a zmieniła — to usterka

Fala 1 to sprzątanie. Test **musi** zostać zielony przez całą falę.
Czerwony w fali 1 oznacza, że usunięcie czegoś zepsuło coś innego —
zatrzymaj się i zgłoś, nie regeneruj wzorca.

## 4. Nie zgaduj, pytaj

Tak jak w etapach A–C. Gdzie nie wiesz — napisz i czekaj.

---

# KOLEJNOŚĆ — CZTERY FALE

## FALA 0 — siatka bezpieczeństwa

**Zanim dotkniesz czegokolwiek innego.** Naprawiasz kod, który potrafi
skasować harmonogram klienta, a nie masz testu, który by to wyłapał.
Najpierw siatka, potem skoki.

- **D23** — testy regresji importu harmonogramu.
  Minimum pięć wariantów pliku: poprawny, pusty, z inną kolejnością kolumn,
  ze zmienionymi nagłówkami, z wierszami niespełniającymi walidacji.
  Każdy test sprawdza, że **istniejące dane przetrwały**. Uruchamiane w CI.
- **D24** — pełny przebieg czternastu prób na obecnej paczce.
  To jest punkt odniesienia funkcjonalny, tak jak 720 ujęć jest punktem
  odniesienia wizualnym. Raport z sumą kontrolną paczki.

*Brama: test wizualny zielony, testy importu zielone, raport 14 prób zapisany.*

## FALA 1 — fundament wizualny

Usuwanie, nie dodawanie. Nic nie powinno zmienić się na ekranie.

- **D1** — Tailwind out z warstwy komponentów
- **D2** — systemowy stack czcionek out
- **D9** — cienie, promienie powyżej 2 px, `!important`
- **D21** — martwy MapLibre z drzewa
- **D16** — `data-theme` z dokumentu; motyw domyślny ustala **rola w kodzie**,
  zgodnie z akceptacją #12: HHL i SCX ciemny, KSH jasny. Użytkownik może
  nadpisać, wybór zapamiętany. To nie jest sprzeczne — sprzeczne było
  zaszycie w HTML

*Brama: test wizualny **zielony bez regeneracji wzorca**. Podaj nowy rozmiar
paczki po D1 i D21 — powinien spaść zauważalnie.*

## FALA 2 — prawda danych

Tu liczby na ekranie się zmienią i tak ma być.

- **D7** — **najpierw odpowiedz, dopiero potem naprawiaj.** Jaki dokładnie
  wzór liczy dopłatę paliwową: plik, linia, postać wzoru. Bez tej odpowiedzi
  naprawa mogłaby zepsuć coś, co działa inaczej, niż zakładam
- **D22** — wersjonowanie i migracja magazynu trwałego
- **D3** — endpoint Trafikverket: wdrożyć albo widocznie oznaczyć jako dane
  demonstracyjne. Napisz, co wybrałeś
- **D4** — jedno źródło prawdy o rejsie; trzy komponenty czytają z niego
- **D5** — jedna funkcja licząca podział na etapy; KPI i pasek korytarza
  wywołują tę samą
- **D8** — strefy czasowe; napisz, którą przyjąłeś dla dostaw w Szwecji
- **D20** — dopasowanie trójstronne liczone naprawdę, nie zaszyte

*Brama: pełny przebieg 720, raport zmienionych ujęć, tag `baseline-fala-2`.*

## FALA 3 — treść i język

- **D19** — sto cztery napisy do słownika, w trzech językach.
  **Najważniejsza pozycja całego etapu.** Bez niej wersja szwedzka jest
  pozorna, a to wersja dla Scandinavian Express
- **D11** — ciągi debugowe i angielskie wartości wyliczeniowe out z interfejsu
- **D12** — dane zastępcze na prawdopodobne: nazwiska polskie, litewskie
  i szwedzkie, numery w formacie E.164, rejestracje w formatach PL, SE, LT
- **D6** — telefon kierowcy z tabeli do szuflady; dla roli klienta widoczny
  tylko w oknie ±24 h wokół dostawy
- **D10** — jedna funkcja formatująca kwoty, `pl-PL`, dwa miejsca po przecinku
- **D17** — format daty w tabeli bez powtarzanego roku
- **D13** — wzorce wizualne poza katalogiem: opisać w dokumentacji systemu
  albo usunąć; `section-card-hd--drag` ujednolicić z konwencją nazw
- **D18** — widoczne oznaczenie danych demonstracyjnych: stawki, parametry
  dopłaty paliwowej, panel warunków drogowych jeśli D3 poszło w oznaczenie.
  Wyłączalne jednym przełącznikiem
- **D25** — *nowa pozycja*: zamknij pozostałe pozycje z `02_FASADA.md`.
  Osiem atrap i sześć porzuconych, w tym wybór przewoźnika „Wybierz".
  Każda z trzech dróg: zaimplementować, usunąć z interfejsu, albo widocznie
  oznaczyć jako nieaktywną. **Martwy przycisk pokazany klientowi jest gorszy
  niż brak przycisku**

*Brama: pełny przebieg 720, raport zmienionych ujęć, tag `baseline-fala-3`.*

## FALA 4 — infrastruktura

- **D14** — trasy adresowalne: `/harmonogram`, `/mapa`, `/transport/SG-32`,
  rola i język w adresie albo w trwałym ustawieniu
- **D15** — podział paczki, mapa ładowana leniwie. Cel: pierwsze wczytanie
  poniżej 400 kB. Po D1 i D21 część drogi masz już za sobą

*Brama: test zielony, raport rozmiaru paczki przed i po.*

---

# RAPORT

`NAPRAWY.md`, tabela narastająco:

| Pozycja | Commit | Pliki | Co zmieniono | Jak sprawdzić | Ujęć zmienionych |
|---|---|---|---|---|---|

Na końcu każdej fali dopisz sekcję: co zostało otwarte i dlaczego.

---

# CZEGO NIE WOLNO ZMIENIAĆ

Bez zmian względem poprzednich etapów.

1. **Wyglądu poza tym, co wynika z konkretnej naprawy.** Jeżeli naprawa
   D10 zmienia format kwot, zmienia się format kwot — nie odstępy w tabeli
   przy okazji
2. **Nazw klas CSS.** Kontrakt warstwy testów
3. **Struktury ról.** HHL koszt, przychód, marża. KSH swoja cena.
   SCX swoja stawka
4. **Trzech języków**
5. **Zakresu.** Nie usuwaj funkcji dlatego, że nie działa — D25 mówi,
   co z nią zrobić

---

# PIERWSZY KROK

Fala 0, pozycja D23. Napisz testy, uruchom, pokaż wynik.
Nie zaczynaj od D1 — najpierw siatka.
