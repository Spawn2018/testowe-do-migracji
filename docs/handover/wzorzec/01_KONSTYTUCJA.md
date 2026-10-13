# KONSTYTUCJA PROJEKTU TOWER

Zasady nadrzędne. Wygrywają z każdym dokumentem roboczym. Zmienić je może
tylko właściciel — nowym, datowanym zapisem.

## Zmiany z 08.10.2026 (właściciel)
Podstawa:
- polecenie właściciela 08.10.2026, 14:43: „nasze postanowienia i plik audyt watch tower są nadrzędne. Wszystko co jest starsze jest nieaktualne i nie może obowiązywać.”;
- zasada z 13:26: „Najświeższe ustalenia poczynione w tym czacie od samego początku są obowiązujące i nadpisują wszelkie starsze decyzje i rozwiązania.”;
- decyzje audytu 07–08.10.2026 (`docs/handover/audyt_claude_2026-10-08/`).

Zmienione punkty: II.5 (nowy), V, VI.5, VIII, IX.1, IX.3, X — poprzednie brzmienie zostaje niżej, oznaczone „do 08.10.2026”. Uzupełnienia o decyzje z 07–08.10 (III.5, IV.2, IV.3, IV.5, VI.4, VII.1) mają w tekście datę albo numer etapu.

## Zmiana z 09.10.2026 (właściciel, 13:09)
Zmieniony punkt: III.5 (opłaty dodatkowe) — decyzja właściciela 09.10.2026, 13:09, pkt 5: „Wszelkie dopłaty dodatkowe liczą się z automatu ale nie są wprowadzane automatycznie. To jest tylko i wyłącznie wola oraz decyzja biznesowa HHL i SCX czy będą dodane. Opłata dodatkowa SCX dalej wymaga akceptacji HHL.” Zapis: `docs/handover/dopiski/D-20261009-1309-01.md` R8. Poprzednie brzmienia — w tekście punktu.

## Zmiany z 13.10.2026 (właściciel)
Podstawa:
- polecenie właściciela 13.10.2026, 15:31: „to, co Cursor już zrobił i zrobi w przyszłości, ma zawsze być zgodne ze wzorcami z pliku audytowego”;
- polecenie właściciela 13.10.2026, 15:43: „Pytam o wszystko, co będzie budował, także na komputerze i komórce. Każda wizualizacja ma być zgodna z tymi stworzonymi w tym pliku. W końcu tam są moje wszystkie akceptacje, w tym także wyglądu całej aplikacji”;
- decyzja `WYGLAD-RAPORT` (`docs/handover/wzorzec/03_REJESTR_DECYZJI.md`; dopiski D-20261013-1535-01 i D-20261013-1550-01).

Zmienione punkty: VIII pkt 1 i 2. Poprzednie brzmienie zostaje pod VIII, oznaczone „do 13.10.2026”.

## I. Cel
TOWER to **jedno źródło prawdy o transportach** projektu KSH–Stegra Boden
(konstrukcje stalowe ponadnormatywne, Śrem → Gdańsk → prom → Nynäshamn → Boden)
dla czterech stron: HHL (spedytor, właściciel systemu), KSH (klient), przewoźnika
(Scandinavian Express) i kierowcy. Aplikację kierowcy zostawiamy bez zmian (właściciel, 07.10.2026).

## II. Władza
1. **Decyzję podejmuje właściciel.** Decyzja jest zapisana z datą i źródłem
2. Zmiana decyzji = nowy wpis. **Historia zostaje** — nic nie jest kasowane
3. Umowa handlowa podpisana z kontrahentem wygrywa z wcześniejszym ustaleniem
   roboczym — sprzeczność zgłasza się właścicielowi, nie rozstrzyga po cichu
4. Koordynator rekomenduje i sprawdza. Wykonawca buduje. Żaden z nich nie
   podejmuje decyzji za właściciela
5. **(08.10.2026)** Zaraz po tej konstytucji obowiązują decyzje audytu 07–08.10.2026 i rozstrzygnięcia luk (`docs/handover/audyt_claude_2026-10-08/`). Pełna kolejność przy sprzeczności: konstytucja → folder audytu → `PLAN.md` → rejestr decyzji → reszta. Dokumenty sprzed 08.10.2026, których nie potwierdza folder audytu ani plan, nie obowiązują.

## III. Uczciwość systemu
1. **Zero fasady.** Brak danych → „brak źródła danych". Nigdy wartości demo
   na produkcji
2. **Brak ceny → wyraźne ostrzeżenie.** Nigdy zero, nigdy „najbliższa"
3. Każda liczba pokazywana użytkownikowi ma źródło, które da się wskazać
4. Operacje nieodwracalne i kosztowne (usunięcie, anulowanie transportu)
   **nigdy automatycznie** — propozycja do decyzji człowieka
5. **Opłaty dodatkowe nigdy automatycznie** — system liczy i podpowiada kwotę;
   czy dopłata zostanie dodana, decyduje wyłącznie HHL (po swojej stronie) i SCX
   (po swojej stronie); dopłata SCX wymaga akceptacji HHL; część przychodową
   akceptuje KSH (09.10.2026 13:09, D-20261009-1309-01 R8; wcześniej: HHL dodaje
   i zatwierdza — E33, 08.10.2026; jeszcze wcześniej: dodaje ręcznie HHL po
   uzgodnieniu, 29.09)

## IV. Pieniądze
1. **Wszystko w EUR.** PLN jako widok w ustawieniach użytkownika; **faktura w EUR
   albo PLN** — wybór przy wystawieniu, osobny kurs dla każdego transportu (29.09)
2. Kurs: średni NBP, tabela A, z dnia roboczego przed rozładunkiem; każdy
   transport ma własny kurs. Przed rozładunkiem — ostatni kurs z dopiskiem
   „kurs bieżący” (E16)
3. Realizacja usługi = rozładunek. Faktury tygodniowe z transportów
   zrealizowanych w tygodniu. Termin: KSH 30 dni, przewoźnik 35 dni od wystawienia.
   VAT 23 % (07.10.2026)
4. Fakturę HHL → KSH widzi KSH i HHL. Fakturę przewoźnika widzi przewoźnik i HHL.
   Marżę widzi tylko HHL
5. Marża dla transportów niedostarczonych — z daty dostawy w harmonogramie;
   faktura nadpisuje i jest nadrzędna. Próg zbyt niskiej marży 4 % (08.10.2026)

## V. Koszt
**(08.10.2026)** Darmowe plany wszędzie, z wyjątkami zdecydowanymi przez
właściciela: **Supabase Pro** (08.10.2026 12:50) i **HERE do 100 USD miesięcznie**
(D-77, D-78, 04.10.2026). Każdy inny wydatek — tylko nową decyzją na piśmie.
Przed użyciem każdej usługi zewnętrznej: **sprawdzenie regulaminu** pod kątem
użytku komercyjnego i śledzenia pojazdów — zanim cokolwiek zostanie podpięte.
- do 08.10.2026: „Wszystko na darmowych planach (Supabase Free, Vercel Hobby,
  Cloudflare Free) — decyzja właściciela z 26.09: »Nigdy«.”

## VI. Bezpieczeństwo
1. **Ochrona w bazie, nie w interfejsie.** Reguły wierszy na każdej tabeli;
   rola anonimowa bez uprawnień do tabel; zapis przez funkcje
2. Warunki odporne na brak wartości: `if (warunek) is not true`
3. Sekrety nigdy w kodzie, commitach, logach ani czacie
4. Pliki poufne (ceny, dane osobowe, polisy, zezwolenia, plik KSH) poza
   repozytorium; strażnik paczki produkcyjnej blokuje ich wyciek do przeglądarki
5. **(08.10.2026)** Weryfikacja dwuetapowa **dobrowolna** dla wszystkich kont
   (E37 decyzja 1C). Administrator HHL **może wykonać każdą czynność za każde
   konto** — w dzienniku zawsze faktyczny wykonawca. „Podgląd” innej roli
   niczego nie zapisuje (E9, E37)
   - do 08.10.2026: „Administrator z weryfikacją dwuetapową i dwoma urządzeniami”
6. **Każda zmiana w systemie zapisana** — kto, kiedy, co, było → jest

## VII. Dane osobowe
1. KSH widzi **na stałe** pełne dane kierowcy i auta — właściciel ma zgody
   wszystkich stron, bezterminowe do wycofania (29.09). KSH nie widzi numerów
   zleceń (E41, 08.10.2026)
2. Temat RODO zamknięty przez właściciela (29.09) — zgody są, nowych funkcji nie budujemy
3. Pozycje GPS: 30 dni po rozładunku. Wyliczone czasy odcinków (bez danych
   osobowych) zostają na stałe dla kalibracji

## VIII. Wygląd
**(13.10.2026, decyzja WYGLAD-RAPORT)**
1. Wzorem wyglądu całej aplikacji, na komputerze i na telefonie, jest raport audytu 07–11.10.2026: `docs/handover/audyt_claude_2026-10-08/raport/index.html` i obrazy `raport/img/`. To ta sama treść co artefakt właściciela „Audyt Watch Tower”. Przy sprzeczności wygrywa najnowsza decyzja właściciela, potem obraz „po zmianie”, potem tekst propozycji. `makiety_html/` to źródła obrazów, tylko pomocniczo (decyzja WYGLAD-RAPORT, 13.10.2026).
2. Miejsca i stany bez własnego obrazu w raporcie mają wygląd według D-20261013-1550-01 Z10, czyli taki jak na obrazach raportu: te same kolory, czcionki, przyciski, karty i tabele (tokeny `design/claude-v2.0/`, z których zbudowano obrazy). Bez generycznego wyglądu „AI”. Element bez wzoru → STOP.
- Zmiana wyglądu wynikająca z etapu przypisanego do paczki w `PLAN.md` jest przewidziana i nie jest powodem do zatrzymania.
- Odstępstwa: decyzje właściciela (D-27 kontrast, D-31 pasek przy 390 px, D-47 okno awizacji) oraz etapy audytu. D-50 (pasek użytkownika w lewym menu) zastępuje E37: konto, „Moje konto” i „Wyloguj” po prawej w pasku górnym.
- **Aplikacja działa w pełni na telefonie** i instaluje się z Chrome (D-55). Na telefonie: dolny pasek, karty zamiast tabel (E8).
- do 13.10.2026: „Wzorem wyglądu jest makieta etapu audytu 07–08.10.2026: `docs/handover/audyt_claude_2026-10-08/makiety_html/` i `raport/img/`, tam, gdzie etap ją ma. W pozostałych miejscach obowiązuje makieta `design/claude-v2.0/` i tokeny systemu projektowego. Szerokości, motywy i stany niepokazane w makiecie wykonawca wyprowadza z makiety i tokenów — bez generycznego wyglądu „AI”.”
- do 08.10.2026: „Wygląd = makieta, dosłownie 100% (decyzja z 22.09) … Odstępstwa wyłącznie decyzją właściciela (D-27, D-31, D-47, D-50).”

## IX. Tryb pracy
1. **(08.10.2026)** **Plan jest jedyną listą pracy.** Każda zmiana, poprawka
   i nowe polecenie wchodzi do planu jako dopisek (`PLAN.md` §2). Poprawki
   nie zastępują realizacji planu. (do 08.10.2026: „Nowe pozycje wyłącznie dopisywane”)
2. **Wykonawca nie czeka.** Sprawa dla właściciela → „Czeka na właściciela” → następna pozycja
3. **(08.10.2026)** **STOP tylko gdy:**
   - zmiana prawdziwych danych na produkcji, której nie opisuje bieżąca paczka planu;
   - wydatek ponad decyzje;
   - wysyłka do prawdziwych odbiorców, której nie przewiduje etap;
   - zmiana wyglądu ekranu spoza listy bieżącej paczki;
   - dane, które zna tylko właściciel;
   - regulamin usługi wyklucza zastosowanie.

   do 08.10.2026: „zmiana prawdziwych danych poza planem · wydatek · wysyłka do użytkowników · nieprzewidziana zmiana wyglądu · dane, które zna tylko właściciel · regulamin usługi wyklucza zastosowanie”.
4. **Raport wykonawcy nie jest dowodem.** Koordynator sprawdza produkcję
   niezależnie
5. **Reguła zapisywana w pełnym warunku, z przykładem liczbowym** — skrót
   prowadzi do błędu (lekcja I-25)
6. **Każda paczka decyzji ma potwierdzenie odbioru** — wykonawca odpisuje listą
   identyfikatorów, które przyjął (lekcja z 29.09)

## X. Język
**(08.10.2026)** Dokumenty, raporty i interfejs po polsku, prostym językiem.
Interfejs, SMS i e-maile **tylko po polsku** (E43). Polskie SMS bez ogonków.
- do 08.10.2026: „Interfejs w PL, EN, SV.”
