> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

# Przejęcie mockupu i zbudowanie systemu — brief

Dokument mówi trzy rzeczy: **co dokładnie muszę dostać**, **jak zagwarantuję
identyczność wizualną mechanizmem, a nie obietnicą**, i **czego nie obiecam**.

Napisany tak, żeby dało się go wysłać w całości drugiej stronie.

---

# CZĘŚĆ I — Trzy zastrzeżenia, które muszą paść od razu

## Zastrzeżenie 1: to nie jest jedna sesja

System w opisanym zakresie — dwanaście modułów, ~25 tabel z politykami dostępu,
import harmonogramu, geofencing, telematyka, silnik reguł, cennik z indeksacją
paliwową, fakturowanie z dopasowaniem trójstronnym, moduł ryzyka, trzy role,
trzy języki, dostępność — to rząd wielkości **15–25 tysięcy linii kodu
produkcyjnego plus testy**.

W jednej rozmowie jestem w stanie wytworzyć i zweryfikować rzędu 3–5 tysięcy
linii w jakości nadającej się do wdrożenia. **To jest osiem do dziesięciu
sesji.** Każdy, kto mówi, że zrobi to w jednej, albo nie rozumie zakresu,
albo ścina go po cichu.

Dlatego częścią tego briefu jest `SCOPE.md` — rejestr, z którego **nic nie może
zostać usunięte**. Pozycja może zmienić status na „odłożona" z podanym powodem
i datą, ale nie może zniknąć. To jest cała odpowiedź na „zakres nie może zostać
zawężony".

**Rekomendacja narzędziowa:** przy projekcie tej wielkości Claude Code pracujący
bezpośrednio w repozytorium jest właściwszy niż czat. Czyta rzeczywiste pliki,
uruchamia testy, widzi wynik i nie wymaga wgrywania niczego na starcie każdej
sesji. Czat zostaje do projektowania, decyzji i przeglądów.

## Zastrzeżenie 2: nie przetestuję tego, do czego nie mam dostępu

Napiszę kod integracji z SharePointem KSH, telematyką Scandinavian Express,
Trafikverket, NBP i bramką pocztową. Napiszę do nich testy na atrapach.
**Nie zweryfikuję, że ich API zachowuje się tak, jak opisuje dokumentacja** —
to sprawdza się tylko na żywym kluczu, w ich środowisku.

Co z tym robię: każdy adapter dostaje tryb atrapy, zestaw nagranych odpowiedzi
i skrypt weryfikacyjny, który uruchamiasz u siebie jednym poleceniem i który
mówi wprost, co działa, a co nie.

## Zastrzeżenie 3: wierność wizualna to mechanizm, nie deklaracja

Mogę zagwarantować 100% identyczności, **pod warunkiem że ją wyegzekwujemy
technicznie**. Część II opisuje jak. Jeżeli ktokolwiek ominie ten mechanizm —
dopisze Tailwinda do komponentu, wstawi gotowy komponent z biblioteki,
poprawi ręcznie wartość w CSS — gwarancja przestaje obowiązywać w tym miejscu
i test to wykryje.

Jest też warunek po Twojej stronie: **każda zmiana w mockupie musi do mnie
trafić jako nowa wersja z informacją, co się zmieniło.** Jeśli wzorzec się
zmieni bez mojej wiedzy, aplikacja będzie wierna staremu wzorcowi.

---

# CZĘŚĆ II — Jak gwarantuję identyczność wizualną

Pięć warstw. Każda wyłapuje to, co przepuściła poprzednia.

## Warstwa 1: CSS przenoszony dosłownie, nie odtwarzany

Arkusz stylów z mockupu wchodzi do repozytorium **bez jednego znaku zmiany**.
Nie przepisuję go na Tailwind, nie „porządkuję", nie zamieniam na moduły CSS.
Plik dostaje nagłówek z zakazem edycji i trafia na listę wymagającą osobnej
akceptacji przy każdym pull requeście.

Odtwarzanie wyglądu z opisu zawsze daje przybliżenie. Przeniesienie pliku daje
tożsamość.

## Warstwa 2: zakaz konkurencyjnych systemów stylowania

- **Żadnego Tailwinda w komponentach aplikacji.** Jeśli jest potrzebny gdzie
  indziej, ma wyłączony preflight i ograniczony zasięg.
- **Żadnego motywu shadcn/ui, MUI, Chakra, Mantine, Ant, DaisyUI.** Ich zmienne
  (`--background`, `--card`, `--radius`, `--muted`) kolidują z tokenami systemu
  i dają hybrydę gorszą niż każdy z osobna.
- Dostępne prymitywy (dialog, select, tooltip) biorę z Radix **bez stylów**
  i ubieram w klasy z arkusza.

## Warstwa 3: konfiguracja, która nie przepuszcza wartości spoza systemu

Plik `.stylelintrc.json` w paczce blokuje:
- kolory wpisane wprost (hex, rgb, hsl) poza blokiem `:root`
- wartości `px` odstępów spoza dozwolonej skali
- `box-shadow`
- `border-radius` większy niż 2 px
- `!important`
- `font-family` inne niż Barlow i Barlow Condensed

To działa w edytorze i w CI. Nie da się wypchnąć zmiany, która łamie te reguły.

## Warstwa 4: test regresji wizualnej jako dowód

`tests/visual.spec.ts` robi zrzuty aplikacji i porównuje je ze zrzutami
wzorcowymi z mockupu, piksel po pikselu, z progiem 0,1%.

Zakres: **każdy widok × każda rola × każdy język × pięć szerokości × tryb jasny
i ciemny**. Przy obecnym zakresie to kilkaset zrzutów. Test jest częścią CI —
czerwony test blokuje wdrożenie.

**To jest jedyny sposób, w jaki mogę Ci udowodnić identyczność zamiast ją
deklarować.** Dlatego zrzuty wzorcowe są na liście rzeczy, których potrzebuję,
jako pozycja obowiązkowa.

## Warstwa 5: reguła rozszerzeń

Każdy nowy ekran, moduł i funkcja powstaje **wyłącznie z klas, które już
istnieją**. Nowa klasa CSS wymaga trzech rzeczy naraz:

1. wpisu do katalogu komponentów w `DESIGN_SYSTEM.md` z uzasadnieniem
2. użycia wyłącznie istniejących tokenów
3. nowego zrzutu wzorcowego

Odstępy, marginesy, wypełnienia, rozmiary tekstu, kolory i promienie pochodzą
z jednej, zamkniętej skali. Nie ma „prawie takiego samego odstępu".

---

# CZĘŚĆ III — Czego potrzebuję od Grok Bota

Lista jest wyczerpująca celowo. Każda brakująca pozycja to miejsce, w którym
będę musiał zgadywać — a zgadywanie kończy się utratą tych 100%.

## 1. Kod źródłowy w całości

- Jeżeli mockup to jeden plik HTML → **ten plik**, nie fragment, nie wklejka.
- Jeżeli to projekt → **cały katalog**: `package.json`, plik blokady wersji
  (`package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`), `app/` lub `pages/`,
  `components/`, `lib/`, `styles/`, `public/`, oraz konfiguracja:
  `next.config.*`, `tsconfig.json`, `tailwind.config.*`, `postcss.config.*`,
  `components.json`, `.env.example`.
- Jeżeli dane demonstracyjne są generowane w kodzie → **kod generatora**,
  nie sam wynik.

**Zrzuty ekranu nie są źródłem.** Z obrazka nie odtworzę odstępów co do piksela.

## 2. Identyfikacja wersji

- Hash commitu albo suma kontrolna pliku i data.
- Deklaracja: „to jest wersja wzorcowa, wygląd zamrożony na tym stanie".
- Zobowiązanie: każda późniejsza zmiana przychodzi jako nowa wersja **z listą
  zmian**.

## 3. Prompt źródłowy w całości, dosłownie

- Bez skracania, bez streszczania, bez „mniej więcej tak brzmiał".
- Jeżeli był iterowany — **wszystkie iteracje po kolei**. W poprawkach siedzą
  decyzje, których w kodzie nie widać.
- Wraz z tym, co Grok odmówił zrobić albo czego nie dokończył.

## 4. Deklaracja: co działa, a co jest fasadą

Tego **nie da się wyczytać z kodu z pewnością** i jest to najczęstsze źródło
nieporozumień przy przejmowaniu prototypu.

- Lista przycisków, pól i zakładek, które nic nie robią.
- Lista miejsc, gdzie dane są zaszyte na sztywno zamiast liczone.
- Lista funkcji zaczętych i porzuconych.
- Które liczby są prawdziwe, a które wymyślone na potrzeby demonstracji.

## 5. Zrzuty wzorcowe — pozycja obowiązkowa

Bez nich nie zbuduję testu z Warstwy 4 i będę mógł tylko *twierdzić*,
że jest identycznie.

- **Każdy widok** w każdym stanie, jaki mockup potrafi pokazać.
- **Każda rola** i **każdy język**.
- **Szerokości:** 1920, 1440, 1280, 768, 390 px.
- **Tryb jasny i ciemny.**
- **Stany interakcji:** spoczynek, najechanie, fokus klawiatury, wciśnięty,
  zablokowany, ładowanie, pusty, błąd, błąd walidacji formularza.
- Format: PNG, bez skalowania, bez kompresji stratnej, `deviceScaleFactor: 1`.

Jeżeli mockup działa — wystarczy, że dostanę kod i wygeneruję zrzuty sam.
Jeżeli dostanę tylko zrzuty, wygląd odtworzę z przybliżeniem i **trzeba to
powiedzieć wprost, zamiast obiecywać 100%**.

## 6. Zasoby wizualne i ich licencje

- **Czcionki:** nazwy, wagi, źródło, licencja, czy hostowane lokalnie.
- **Ikony:** nazwa biblioteki i wersja albo same pliki SVG.
- **Obrazy, logo, ilustracje:** źródło i podstawa prawa do użycia.

To nie jest formalność. Część popularnych zestawów ikon i krojów ma
ograniczenia przy wdrożeniu komercyjnym u klienta zewnętrznego. Lepiej
wychwycić to teraz niż po podpisaniu umowy z KSH.

## 7. Wersje zależności

Plik blokady, nie sama lista. `^1.2.0` i `1.2.7` to dwie różne aplikacje.

## 8. Spis zachowań i przejść

- Co się dzieje po kliknięciu **każdego** elementu interaktywnego.
- Animacje: co, jak długo, jakim przebiegiem.
- Zachowanie przy przewijaniu: elementy przyklejone, nagłówki, cienie.
- Kolejność fokusu klawiatury, jeśli była ustawiana ręcznie.

## 9. Schemat danych, jeżeli już istnieje

Piszesz, że **wstępna schema użytkowników ma pozostać** — potrzebuję jej
dokładnie, nie z opisu:

- Pliki SQL / Prisma / Drizzle / typy TypeScript.
- Tabele, kolumny, typy, wartości domyślne, ograniczenia, klucze obce, enumy.
- Polityki dostępu, jeśli są.
- Dane startowe (seed).
- Nazwy ról i ich uprawnienia w formie, w jakiej są zapisane w kodzie.

## 10. Siatka i skala

- Breakpointy i ich wartości.
- Jednostka rytmu odstępów (4 px? 8 px? inna?).
- Skala rozmiarów tekstu.

Rozszerzenia mają trafiać w ten sam rytm — bez znajomości siatki będą
„prawie" pasować, co widać.

## 11. Znane błędy i rzeczy niedokończone

Żebym nie odtworzył ich starannie jako funkcji.

---

# CZĘŚĆ IV — Czego potrzebuję od Ciebie

Decyzje, których nie wymyślę i których **nie wolno mi zgadnąć**, bo od nich
zależą pieniądze i odpowiedzialność.

## Uprawnienia
- Macierz rola × zasób × operacja (odczyt / zapis / brak), **na poziomie pola**
  wszędzie tam, gdzie chodzi o ceny.
- Kto zakłada konta, kto je odbiera, co się dzieje przy odejściu pracownika.

## Pieniądze
- Pełna macierz cennika: przedziały, stawki kosztowe i przychodowe, dodatki.
- BAF: indeks, wartość i data bazowa, udział paliwa, próg wyzwolenia,
  zaokrąglenie, cykl rewizji, dolne i górne ograniczenie.
- Waluty i **konwencja kursowa** — tabela, dzień, kto ją ustala.
- Cykl i warunki fakturowania, progi tolerancji przy dopasowaniu.

## Operacje
- Kody przyczyn opóźnień i **kto ponosi koszt przy każdym z nich**.
- Terminy uzupełnienia danych i ścieżki eskalacji z nazwiskami.
- Progi ryzyka: pogodowe, czasowe, dokumentowe.
- Limity wymiarowe per kraj — potwierdzone, nie przyjęte z mojej propozycji.

## Zgodność
- Retencja danych osobowych: ile dni, co się usuwa, co zostaje.
- Umowy powierzenia między trzema stronami.
- Czy i kiedy wchodzi KSeF, e-CMR, raportowanie CO₂.

## Dostępy techniczne
Repozytorium · Supabase (osobne środowisko testowe i produkcyjne) · Vercel
i domena · bramka pocztowa · bramka SMS · klucz Trafikverket · rejestracja
aplikacji w Entra ID, jeśli wchodzi SharePoint · endpoint i klucz telematyki
przewoźnika · konto błędów i logów.

---

# CZĘŚĆ V — Czego nie obiecam

Lista jest krótka, twarda i nie będzie się zmieniać w trakcie.

1. **Nie przetestuję integracji, do których nie mam dostępu.** Napiszę kod,
   atrapy i skrypt weryfikacyjny — uruchomienie na żywo jest po Twojej stronie.
2. **Nie odpowiadam za zachowanie cudzych API.** Jeśli dokumentacja kłamie,
   wyjdzie to dopiero na żywym kluczu.
3. **Nie zrobię tego w jednej sesji.** Patrz Zastrzeżenie 1.
4. **Nie utrzymam identyczności wizualnej, jeśli ktoś ominie mechanizm.**
   Test to wykryje i wskaże miejsce, ale nie cofnie zmiany.
5. **Nie podejmę decyzji biznesowych za Ciebie.** Stawki, progi, odpowiedzialność
   za opóźnienia — to są decyzje, nie parametry techniczne.
6. **Nie zagwarantuję zgodności prawnej.** Zbuduję mechanizmy retencji,
   rozdzielenia dostępu i audytu oraz wskażę wymogi. Potwierdzenie należy
   do prawnika.
7. **Nie odtworzę tego, czego nie dostanę.** Brakujący plik to zgadywanie,
   a zgadywanie to koniec stu procent.
8. **Nie zmieszczę wszystkiego w MVP.** Ale nic nie zniknie: pozycja przechodzi
   w `SCOPE.md` na status „odłożona" z powodem i datą, nie jest kasowana.

---

# CZĘŚĆ VI — Jak to prowadzimy

| Sesja | Zakres | Kryterium wyjścia |
|---|---|---|
| 0 | Przejęcie i inwentaryzacja | `SCOPE.md` wypełniony, zrzuty wzorcowe wygenerowane, test regresji uruchamialny |
| 1 | Szkielet projektu i port interfejsu na danych z mockupu | **Test regresji zielony na wszystkich zrzutach** |
| 2 | Baza, role, logowanie, rozdzielenie dostępu | Trzy role logują się i widzą dokładnie to, co powinny; test dostępu do cen zielony |
| 3 | Harmonogram: import, walidacja, różnica, wersjonowanie | Prawdziwy plik od KSH przechodzi import z podglądem zmian |
| 4 | Pozycje, geofencing, mapa, przewidywany czas przyjazdu | Zdarzenie wjazdu w strefę generuje powiadomienie, bez duplikatów |
| 5 | Dokumenty, zezwolenia, polisy, walidator wymiarów | Transport przekraczający zezwolenie jest blokowany |
| 6 | Cennik, indeksacja paliwowa, waluty, marża, faktury | Dopasowanie trójstronne wychwytuje rozbieżność na prawdziwej fakturze |
| 7 | Silnik reguł, powiadomienia, moduł ryzyka | Siedem reguł startowych działa; ryzyko promowe czyta prawdziwe źródła |
| 8 | Pulpity ról, trzy języki, dostępność, stany, wdrożenie | Wdrożenie na domenie, konta założone, test regresji nadal zielony |

**Każda sesja kończy się:**
- zaktualizowanym `SCOPE.md` (statusy, nic nie usunięte),
- wpisem w `DECISIONS.md` (co zdecydowano i dlaczego),
- plikiem `HANDOVER.md` (stan, co dalej, co blokuje),
- zielonym testem regresji wizualnej.

Jeżeli sesja kończy się czerwonym testem, następna zaczyna się od jego
naprawy, a nie od nowej funkcji.
