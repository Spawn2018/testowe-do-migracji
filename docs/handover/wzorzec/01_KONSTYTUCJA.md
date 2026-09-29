# KONSTYTUCJA PROJEKTU TOWER

Zasady nadrzędne. Wygrywają z każdym dokumentem roboczym. Zmienić je może
tylko właściciel — nowym, datowanym zapisem.

## I. Cel
TOWER to **jedno źródło prawdy o transportach** projektu KSH–Stegra Boden
(konstrukcje stalowe ponadnormatywne, Śrem → Gdańsk → prom → Nynäshamn → Boden)
dla czterech stron: HHL (spedytor, właściciel systemu), KSH (klient),
przewoźnika (Scandinavian Express) i kierowcy.

## II. Władza
1. **Decyzję podejmuje właściciel.** Decyzja jest zapisana z datą i źródłem
2. Zmiana decyzji = nowy wpis. **Historia zostaje** — nic nie jest kasowane
3. Umowa handlowa podpisana z kontrahentem wygrywa z wcześniejszym ustaleniem
   roboczym — sprzeczność zgłasza się właścicielowi, nie rozstrzyga po cichu
4. Koordynator rekomenduje i sprawdza. Wykonawca buduje. Żaden z nich nie
   podejmuje decyzji za właściciela

## III. Uczciwość systemu
1. **Zero fasady.** Brak danych → „brak źródła danych". Nigdy wartości demo
   na produkcji
2. **Brak ceny → wyraźne ostrzeżenie.** Nigdy zero, nigdy „najbliższa"
3. Każda liczba pokazywana użytkownikowi ma źródło, które da się wskazać
4. Operacje nieodwracalne i kosztowne (usunięcie, anulowanie transportu)
   **nigdy automatycznie** — propozycja do decyzji człowieka
5. **Opłaty dodatkowe nigdy automatycznie** — postojowe, anulowanie i inne
   dodaje ręcznie HHL po uzgodnieniu (podejście partnerskie, 29.09)

## IV. Pieniądze
1. **Wszystko w EUR.** PLN jako widok w ustawieniach użytkownika; **faktura w EUR
   albo PLN** — wybór przy wystawieniu, osobny kurs dla każdego transportu (29.09)
2. Kurs: średni NBP, tabela A, z dnia roboczego przed rozładunkiem; każdy
   transport ma własny kurs
3. Realizacja usługi = rozładunek. Faktury tygodniowe z transportów
   zrealizowanych w tygodniu. Termin: KSH 30 dni, przewoźnik 35 dni od wystawienia
4. Fakturę HHL → KSH widzi KSH i HHL. Fakturę przewoźnika widzi przewoźnik i HHL.
   Marżę widzi tylko HHL
5. Marża dla transportów niedostarczonych — z daty dostawy w harmonogramie;
   faktura nadpisuje i jest nadrzędna

## V. Koszt
**Wszystko na darmowych planach** (Supabase Free, Vercel Hobby, Cloudflare Free)
— decyzja właściciela z 26.09: „Nigdy". Wyjątek tylko nową decyzją na piśmie.
Przed użyciem każdej usługi zewnętrznej: **sprawdzenie regulaminu** pod kątem
użytku komercyjnego i śledzenia pojazdów — zanim cokolwiek zostanie podpięte.

## VI. Bezpieczeństwo
1. **Ochrona w bazie, nie w interfejsie.** Reguły wierszy na każdej tabeli;
   rola anonimowa bez uprawnień do tabel; zapis przez funkcje
2. Warunki odporne na brak wartości: `if (warunek) is not true`
3. Sekrety nigdy w kodzie, commitach, logach ani czacie
4. Pliki poufne (ceny, dane osobowe) poza repozytorium; strażnik paczki
   produkcyjnej blokuje ich wyciek do przeglądarki
5. Administrator z weryfikacją dwuetapową i dwoma urządzeniami; **może wykonać
   każdą czynność za każde konto** — w dzienniku zawsze faktyczny wykonawca
6. **Każda zmiana w systemie zapisana** — kto, kiedy, co, było → jest

## VII. Dane osobowe
1. KSH widzi **na stałe** pełne dane kierowcy i auta — właściciel ma zgody
   wszystkich stron, bezterminowe do wycofania (29.09)
2. Temat RODO zamknięty przez właściciela (29.09) — zgody są, nowych funkcji nie budujemy
3. Pozycje GPS: 30 dni po rozładunku. Wyliczone czasy odcinków (bez danych
   osobowych) zostają na stałe dla kalibracji

## VIII. Wygląd
Wygląd = makieta, **dosłownie 100%** (decyzja z 22.09), bez generycznego
wyglądu „AI". Odstępstwa wyłącznie decyzją właściciela (D-27 kontrast,
D-31 pasek przy 390 px, D-47 okno awizacji, D-50 pasek użytkownika).
**Aplikacja działa w pełni na telefonie** i instaluje się z Chrome (D-55) —
układ na telefon wyprowadzony z makiety, ten sam styl.

## IX. Tryb pracy
1. **Plan jest jedyną listą pracy.** Nowe pozycje wyłącznie dopisywane
2. **Wykonawca nie czeka.** Pytanie → „Decyzje oczekujące" → następna pozycja
3. **STOP tylko gdy:** zmiana prawdziwych danych poza planem · wydatek ·
   wysyłka do użytkowników · nieprzewidziana zmiana wyglądu · dane, które zna
   tylko właściciel · regulamin usługi wyklucza zastosowanie
4. **Raport wykonawcy nie jest dowodem.** Koordynator sprawdza produkcję
   niezależnie
5. **Reguła zapisywana w pełnym warunku, z przykładem liczbowym** — skrót
   prowadzi do błędu (lekcja I-25)
6. **Każda paczka decyzji ma potwierdzenie odbioru** — wykonawca odpisuje listą
   identyfikatorów, które przyjął (lekcja z 29.09)

## X. Język
Dokumenty i raporty po polsku, prostym językiem. Interfejs w PL, EN, SV.
Polskie SMS bez ogonków.
