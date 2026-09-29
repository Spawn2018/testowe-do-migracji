> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# POTWIERDZENIE ETAPU 0 — do wklejenia Grok Botowi

---

Odpowiedź przyjęta. Dobrze, że napisałeś, czego nie masz, zamiast to odtwarzać.
Trzy Twoje ustalenia zmieniają plan, więc przed etapem A wchodzi jeden nowy
etap, a dwa punkty etapu C zmieniają kolejność.

# ODPOWIEDZI NA TWOJE PYTANIA

**Kanoniczne repozytorium nie istnieje.** Nie ma go ani na GitHubie, ani nigdzie
poza tym dyskiem. Lokalna kopia jest jedynym egzemplarzem. Tworzymy repozytorium
teraz — to jest etap 0.5 poniżej.

**Licencje fontów, ikon i kafelków.** Nie potwierdzę ich za Ciebie, ale też tego
nie oczekuję. Twoje zadanie: **wypisz, co dokładnie jest używane** — nazwy
krojów i wag, nazwę i wersję biblioteki ikon albo informację, że są rysowane
ręcznie, dostawcę kafelków mapy wraz z wymogiem atrybucji. Ocenę prawną zrobi
właściciel projektu na podstawie Twojej listy.

**Prawdziwe stawki, progi i warunki umowne.** Jeszcze nie istnieją — negocjacje
z przewoźnikiem są w toku. Do czasu ich ustalenia **wszystkie liczby w ekranie
Opcje są demonstracyjne** i muszą być tak oznaczone w interfejsie. Patrz punkt
D18 na końcu.

**Pełna historia rozmów.** Dostarczy ją właściciel projektu. Twoje zadanie
w A6 i A7 jest węższe i opisane niżej.

---

# ETAP 0.5 — ZAMROŻENIE W GIT (blokujące, wykonaj przed etapem A)

Brak repozytorium to w tej chwili największe ryzyko całego projektu.
Jedno nadpisanie pliku i praca przepada bez śladu. Bez historii nie da się
też wykonać etapu D w formie, jakiej wymaga — każda naprawa osobnym commitem.

Wykonaj, zanim dotkniesz czegokolwiek innego:

1. **Zbierz wszystko pod jeden katalog.** `/workspace/watch-tower-app` zostaje
   korzeniem repozytorium. **Skopiuj** do niego, nie przenoś:
   - `/workspace/watch-tower/claude-v2.0/` → `design/claude-v2.0/`
   - `/workspace/watch-tower/qa-start/` → `docs/qa-start/`
   - wszystkie pliki `*.md` z katalogu aplikacji, jeśli leżą luzem → `docs/`

   Kopiuj, nie przenoś. Oryginały zostają na miejscu do czasu potwierdzenia,
   że kopia jest kompletna.

2. **`git init`** i `.gitignore` obejmujący `node_modules`, `dist`, `.env*`,
   `.vercel`, `*.log`.

3. **Commit bazowy** obejmujący wszystko pozostałe, z opisem:
   „baseline: wersja wdrożona 23.09.2026, wygląd zamrożony".
   Otaguj: `baseline-2026-09-23`.

4. **Repozytorium zdalne, prywatne.** Jeżeli masz działające `gh` — załóż je
   i wypchnij. Jeżeli nie — napisz to, a właściciel założy je i poda adres.

5. **Plik blokady wersji.** Sprawdź, czy istnieje. Jeżeli nie — wygeneruj
   przez `npm install --package-lock-only` i **oznacz w manifeście jako
   odtworzony, nie oryginalny**. To nie jest to samo: pinuje wersje, które
   rozwiążą się dziś, a nie te, na których budowano aplikację. Różnica może
   się kiedyś ujawnić i lepiej, żeby była zapisana.

Po tych pięciu punktach napisz jednym zdaniem, że zamrożenie jest zrobione,
i **przejdź od razu do etapu A** — tu nie czekaj na potwierdzenie.

---

# ZMIANY W ETAPIE A

## A6 i A7 — użyj transkryptu, nie pamięci

Napisałeś, że masz `ReadTranscript` z możliwością stronicowania wstecz, także
po kompresji. **Użyj tego.** Przewiń do początku sesji i odtwórz prompty
z rzeczywistego tekstu, nie z pamięci o nich. Pamięć skraca i wygładza, a mnie
interesuje dokładnie to, co zostało wygładzone.

Jeżeli stronicowanie urwie się w którymś miejscu — napisz, dokąd sięgnąłeś
i gdzie przestało działać. Luka opisana jest użyteczna, luka niezauważona nie.

## A8 — nowy punkt: pozostałe boty WT

Wymieniłeś WT — UX, Visual, Research i QA. Dla każdego napisz:

- co robił w tym projekcie
- jakie artefakty zostawił i gdzie leżą
- co z jego ustaleń weszło do aplikacji, a co nie
- czy jego wyniki są w `qa-start/` albo w plikach `*.md`, czy tylko w rozmowie

Nie odtwarzaj treści ich rozmów. Wystarczy mapa: kto, co, gdzie leży.
Rozmowy wyeksportuje właściciel.

## A9 — nowy punkt: co jest w `qa-start/`

Spis dokumentów z jednozdaniowym opisem każdego. Jeżeli któryś jest nieaktualny
albo sprzeczny z obecnym stanem aplikacji — zaznacz to.

---

# ZMIANY W ETAPIE C

## C2 — kolejność odwrócona

Napisałeś, że pełna matryca zrzutów to długa praca. **Bo robisz ją w złej
kolejności.** Najpierw narzędzie, potem przebieg:

1. **Mechanizm zamrożenia zegara** — `?now=2026-09-23T14:32:00Z`
   albo `VITE_FROZEN_NOW`. Bez tego cała reszta jest bezwartościowa,
   bo nagłówek odlicza czas i każdy zrzut jest inny.
2. **Skrypt generujący matrycę** — `scripts/baseline.mjs`, Playwright albo
   Puppeteer, pętla po widokach, rolach, językach, szerokościach i motywach,
   nazewnictwo `widok__rola__jezyk__szerokosc__motyw.png`.
3. **Uruchomienie skryptu.**

Punkty 1 i 2 to Twoja praca. Punkt 3 to czas maszyny, nie Twój.
Kilkaset zrzutów wygenerowanych skryptem to jedno polecenie.

Skrypt jest ważniejszy niż same zrzuty, bo trzeba go będzie uruchamiać
po każdej zmianie do końca projektu.

## C3 — potwierdź, co naprawdę jest w `src/i18n`

Nie zakładaj kompletności trzech języków. Wypisz liczbę kluczy w każdym
i listę tych, które istnieją w polskim, a brakuje w angielskim albo szwedzkim.

---

# NOWA NAPRAWA W ETAPIE D

## D18 — oznacz dane demonstracyjne w interfejsie

Ekran Opcje pokazuje stawki 16 500 / 19 200 / 22 800 po stronie kosztu
i 20 500 / 23 800 / 27 900 po stronie przychodu, oraz parametry dopłaty
paliwowej. **Żadna z tych liczb nie jest ustaleniem umownym.**

Aplikacja będzie pokazywana klientowi i przewoźnikowi. Liczba pokazana
na ekranie bez oznaczenia zostanie odebrana jako oferta.

Oznacz widocznie — w ekranie Opcje, w kolumnach finansowych harmonogramu
i w module faktur — że wartości są demonstracyjne do czasu potwierdzenia.
Zrób to tak, żeby dało się wyłączyć jednym przełącznikiem, gdy stawki zostaną
ustalone.

To samo dotyczy panelu warunków drogowych, jeżeli w D3 wybierzesz oznaczenie
zamiast wdrożenia endpointu.

---

# KOLEJNOŚĆ PO ZMIANACH

```
ETAP 0.5  zamrożenie w Git              → bez czekania, od razu etap A
ETAP A    A1–A9, transkrypt zamiast pamięci   → 00_KONTEKST.md
ETAP B    manifest, 64 pozycje + 14.x        → 08_MANIFEST.md
ETAP C    zegar → skrypt → matryca zrzutów   → STOP, czekaj
ETAP D    D1–D18                              → NAPRAWY.md
```

Reszta promptu obowiązuje bez zmian. Zaczynaj od etapu 0.5.

---
---

# PROMPT DLA POZOSTAŁYCH BOTÓW — WT UX / Visual / Research / QA

> Wyślij osobno do każdego z nich. Krótki, bo od każdego potrzeba tylko
> tego, czego nie ma nigdzie indziej.

---

Pracowałeś nad projektem **TOWER / Watch Tower** — control tower dla transportu
konstrukcji stalowych ponadnormatywnych z Polski do Boden w Szwecji
(klient KSH, przewoźnik Scandinavian Express, spedytor H&H Logistics).

Projekt przechodzi do fazy produkcyjnej i zbieram wszystko, co o nim wiadomo.
Z Twojej strony potrzebuję **wyłącznie wiedzy, której nie ma w kodzie**.
Nie buduj niczego, nie poprawiaj, nie streszczaj tego polecenia.

Odpowiedz na sześć punktów:

1. **Co robiłeś w tym projekcie.** Jeden akapit, konkretnie.

2. **Co zostawiłeś i gdzie.** Lista plików, katalogów, dokumentów
   z lokalizacjami. Jeżeli coś istnieje tylko w rozmowie i nigdzie nie
   zostało zapisane — napisz to.

3. **Co z Twoich ustaleń weszło do aplikacji, a co nie.** Tabela:
   ustalenie · weszło TAK/NIE/CZĘŚCIOWO · dlaczego nie, jeśli nie.

4. **Pomysły omówione i odrzucone.** Wszystkie, nawet te porzucone
   po jednym zdaniu. Dla każdego: na czym polegał i dlaczego odpadł.
   To jest materiał, którego nie ma nigdzie indziej.

5. **Co uważasz za niedokończone, ryzykowne albo zrobione tymczasowo.**
   Bez owijania. Lepiej usłyszeć to teraz niż odkryć za trzy tygodnie.

6. **Co miało być następne.** Kolejność, jaką miałeś w głowie.

Jeżeli czegoś nie pamiętasz albo nie masz — **napisz „nie mam" i wskaż,
kto to ma.** Nie odtwarzaj z domysłów. Wymyślona odpowiedź wygląda
wiarygodnie i kosztuje potem tygodnie.

Jeżeli możesz odczytać transkrypt swojej sesji — zrób to i oprzyj odpowiedź
na rzeczywistym tekście, nie na pamięci o nim. Napisz, dokąd sięgnąłeś.
