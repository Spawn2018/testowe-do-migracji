# USTALENIA WŁAŚCICIELA Z ROZMÓW (22.09–04.10.2026)

Źródło: pełne zapisy rozmów właściciela z koordynatorem (5 sesji). Wypisane
są wyłącznie słowa właściciela, nie propozycje koordynatora. Cytaty są
skrócone, a sens zostaje bez zmian. Kolumna „Stan” mówi, które ustalenie wygrywa,
gdy późniejsze zmienia wcześniejsze. Zasada jest stała: nowsza wypowiedź
właściciela wygrywa ze starszą.

Zadanie dla wykonawcy: dla każdego U-n znajdź zapis w repozytorium (plik
i sekcja). Jeśli go nie ma, dopisz U-n do `REJESTR_CALOSCI.md` w nowej
sekcji „5. USTALENIA Z ROZMÓW”. Jeśli zapis w repozytorium jest inny niż
tutaj, ustalenie trafia do sekcji 3 i wygrywa wersja z tej listy.

## Pieniądze i faktury

| ID | Data | Słowa właściciela | Stan |
|---|---|---|---|
| U-1 | 24.09 | Każda ze stron ma dokładnie ten sam mechanizm opłaty paliwowej, opisany w plikach. 28.09: „KSH ma identyczną opłatę paliwową” | obowiązuje |
| U-2 | 24.09 | Faktura jest wystawiana z transportów zrealizowanych w danym tygodniu. Realizacja usługi to dostarczenie, czyli rozładunek | obowiązuje (wg L-10: UNLOADED z wyjazdu ze strefy, bez telematyki ręcznie) |
| U-3 | 24.09 | Opłata paliwowa według daty realizacji usługi | **zastąpione** 29.09: „dzień opłaty paliwowej zgodny z mechanizmem BAF”, czyli D-34 (data załadunku) |
| U-4 | 24.09 | Marża transportów niedostarczonych liczona od daty dostawy z harmonogramu. Faktury są nadrzędne i nadpisują wyliczenie | obowiązuje |
| U-5 | 24.09 | Wszędzie EUR. Użytkownik może w swoich ustawieniach przełączyć walutę na PLN. Przy kursie podawać, z którego dnia jest | obowiązuje (wcześniejsze tego samego dnia „nigdzie PLN” zastąpione) |
| U-6 | 24.09 | Każdy zrealizowany transport ma swój indywidualny kurs. Kurs NBP, tabela A, z dnia roboczego poprzedzającego rozładunek | obowiązuje (zgodne z D-43) |
| U-7 | 24.09 | Termin płatności liczony od wystawienia: KSH 30 dni, SCX 35 dni | obowiązuje |
| U-8 | 24.09 | Fakturę HHL widzi tylko KSH (i HHL). Fakturę SCX widzi tylko HHL. HHL widzi wszystkie | doprecyzowane 04.10: fakturę SCX widzą HHL i SCX (wystawca); KSH nie widzi. Wcześniejsze „tylko HHL” nie obowiązuje. |
| U-9 | 24.09 | KSH ma moduł Faktury: tygodniowe faktury HHL z dokumentami potwierdzającymi transport, bez zdjęć i zezwoleń. KSH tam sprawdza faktury | obowiązuje |
| U-10 | 24.09 | System liczy termin płatności każdej faktury i wysyła przypomnienia o braku płatności. Opłaconą fakturę oznacza tylko HHL (powtórzone 02.10) | obowiązuje |
| U-11 | 24.09 | Faktury są wystawiane w systemach HHL i SCX i dołączane jako plik. HHL i SCX wybierają PLN albo EUR | obowiązuje |
| U-12 | 24.09 | „Tak, chcę rozbitą marżę” | obowiązuje. **Sprawdź**: SCOPE §36.6 podaje „czeka na zgodę”. Zgoda jest z 24.09 |
| U-13 | 24.09 | Rozliczenie GitHub Actions — zaparkowane | obowiązuje do odwołania |
| U-14 | 28.09 | Ceny paliwa: SE ze strony okq8.se/foretag/priser, PL z hurtowych cen Orlen. VAT nie ma znaczenia, cenę bierzemy wprost ze strony | obowiązuje |
| U-15 | 28.09 | Ładunki bez ceny wyceniamy tak, jakby miały wysokość 2,45 m | obowiązuje |
| U-16 | 04.10 | Mechanizm czasu wolnego na załadunku i rozładunku oraz dopłaty był już ustalony (cennik) | obowiązuje: DWELL 6 h / 4 h, 75 EUR/h, 750 EUR/doba (0147) |

## Transporty, harmonogram, SharePoint

| ID | Data | Słowa właściciela | Stan |
|---|---|---|---|
| U-17 | 28.09 | „Gdy w rozmiarze masz Standard, a w przewoźniku NTG, te ładunki ma inna firma i nie dotykamy tych transportów. Interesują nas tylko te z wymiarami oraz HH.” 02.10: import miał nie dodawać typu STANDARD. 04.10: Standard = transporty NTG | **obowiązuje**. Klasa STANDARD z importu (I-1b) i stawka STANDARD w cenniku (I-12) są sprzeczne z tym ustaleniem. Zgłoś listę miejsc |
| U-18 | 03.10 | Transporty Standard na produkcji właściciel zaimportował ręcznie, można je usunąć | obowiązuje (w ramach R-0) |
| U-19 | 27.09 | Datę załadunku i rozładunku finalnie podaje KSH | obowiązuje (D-12) |
| U-20 | 25.09 | Przewoźnik nie może zmieniać planowanych okien | obowiązuje |
| U-21 | 28.09 | Konwój to liczba aut z kratownicami jadących tego samego dnia, a nie kratownice z dowolnym innym towarem | obowiązuje |
| U-22 | 28.09 | Błędne daty kratownic od KSH zostają. Gdy KSH je poprawi, będzie to test, czy system wyłapuje zmianę i pokazuje, co się zmieniło | obowiązuje |
| U-23 | 28.09 | SharePoint w obie strony: każda zmiana KSH aktualizuje Watch Tower z informacją, co i kiedy zmieniono, a Watch Tower uzupełnia plik | obowiązuje (część D, D-SP) |
| U-24 | 27.09, 30.09 | Pliku SharePoint nie wolno zmieniać, bo to plik roboczy zespołów. Podczas testów nic nie może się z nim stać | obowiązuje |
| U-25 | 29.09 | „Nr zlecenia” = numer SCX, „Nr zlecenia HHL” = numer HHL. SCX wpisuje swój numer w awizacji. HHL, także administrator, sam dodaje i edytuje numer HHL | obowiązuje (D-44). Numer HHL to pole HHL, a nie awizacja |
| U-26 | 02.10 | Użytkownik HHL (nie administrator) nie może dodawać awizacji. Awizację dodaje Scandinavian Express | obowiązuje |
| U-27 | 02.10 | Separator „ / ”. Znak „\|” tylko w Watch Tower i tylko po zaznaczeniu „Przepięcie” w awizacji SCX. SharePoint zawsze „ / ”. Brak drugiej wartości: „Kierowca Odbierający / ...” | obowiązuje (część C zlecenia z 02.10, tabela potwierdzona) |
| U-28 | 01.10 | Numery telefonów zawsze bez kierunkowego | obowiązuje (D-60) |
| U-29 | 28.09 | KSH na stałe widzi wszystkie dane kierowcy, auta i jego numer. Zgody RODO są od wszystkich stron, bezterminowo do wycofania. 02.10: RODO i komplet zgód załatwione | obowiązuje |

## Statusy, ETA, trasa

| ID | Data | Słowa właściciela | Stan |
|---|---|---|---|
| U-30 | 24.09 | Statusy zmieniają się z pozycji. Porty w PL i SE mają strefy. Gdy auto jest w strefie portu i nadchodzi godzina wypłynięcia przypisanego rejsu z rozkładu armatora, system sam ustawia status PROM | obowiązuje |
| U-31 | 27.09 | Obsada jednoosobowa, odpoczynek na promie | obowiązuje (D-9, D-85) |
| U-32 | 27.09 | Plan: 5 dni od podjęcia do dostawy | **zastąpione** 29.09 przez D-41 (4 dni, 5 przy ciężkiej pogodzie w SE) |
| U-33 | 04.10 | ETA tylko z lokalizacji i GPS. Liczenie według planu porzucamy | obowiązuje (D-80) |
| U-34 | 28.09 → 04.10 | Kolejność decyzji o trasach: 28.09 HERE, potem własny silnik z kalibracją uczącą się (D-28), 04.10 HERE do 100 USD/mies. (D-77, D-78) | obowiązuje D-77/D-78; własny silnik jako zapas |
| U-35 | 04.10 | Wymiary zestawu dla każdego transportu podaje właściciel na etapie budowy. Kontrola trasy nie bierze niczego z dokumentów, a przewoźnik nie wprowadza wymiarów | obowiązuje (D-83). **Zastępuje** wcześniejsze z 04.10 „przewoźnik poda wymiary dla rodzaju transportu” oraz D-54 w tej części |
| U-36 | 04.10 | H-9 likwidujemy | obowiązuje — oznacz H-9 jako usunięte |
| U-37 | 04.10 | Opłaty drogowe nas nie interesują. Nic nie instalujemy, kierowcy nie mają żadnej aplikacji | obowiązuje (D-82, D-79) |
| U-38 | 03.10 | Pozycje na mapie pochodziły ze starego, nieużywanego linku kierowcy, na którym właściciel udostępnił swój telefon | **sprawdź i zgłoś**: czy stary link kierowcy nadal przyjmuje pozycje (D-38, D-79). Nic nie zmieniaj bez zlecenia |

## Narzędzia, koszty, sposób pracy

| ID | Data | Słowa właściciela | Stan |
|---|---|---|---|
| U-39 | 26.09 | Vercel tylko na planie darmowym, nigdy Pro. „Wszystko za darmo” | obowiązuje. Wyjątek: HERE do 100 USD (D-78) |
| U-40 | 04.10 | Resend bez płatnego planu | obowiązuje |
| U-41 | 26.09 | Autoryzacja urządzenia z linku: użytkownicy rok, kierowcy 14 dni | **sprawdź**: od 29.09 logowanie hasłem (D-49), a aplikacja kierowcy jest ukryta (D-38). Podaj, ile dziś trwa sesja użytkownika |
| U-42 | 27.09 | Domena tower.log-mar.pl | obowiązuje |
| U-43 | 03.10 | CodeRabbit nie jest używany. Aikido zdjęte. Po zbudowaniu aplikacji testy OWASP | obowiązuje (SEC-OWASP). **Zastępuje** część A2 zlecenia z 02.10 (CodeRabbit, Aikido) |
| U-44 | 04.10 | Na produkcję częściej niż raz dziennie | obowiązuje: wdrożenie po każdej zielonej bramie |
| U-45 | 04.10 | Grok pracuje samodzielnie, bez proszenia o akceptację | obowiązuje. Wyjątki ustalone osobno: R-0 i wydatki wymagają pisemnej zgody |
| U-46 | 02.10 | Poprawki dopisujemy do planu, bez skakania między zadaniami | obowiązuje |
| U-47 | 02.10 | Zdjąć numery etapów 1–9 z górnego paska. Kreator stref z mapą | zrobione (L-11, L-12) |

## Start produkcji

| ID | Data | Słowa właściciela | Stan |
|---|---|---|---|
| U-48 | 04.10 | R-1: po ukończeniu pracy import harmonogramu z SharePoint jest prawdziwym startem produkcji. Wcześniej, po akceptacji właściciela, program ma być czysty | obowiązuje |
| U-49 | 04.10 | R-0: znikają tylko transporty i to, co z nimi związane. Reszta zostaje | obowiązuje |
| U-50 | 02.10 | Użytkowników właściciel dodaje sam w programie | obowiązuje (R-2) |

## Uwaga o D-66–D-76

Numery D-66–D-76 to propozycje koordynatora z 02.10, wycofane tego samego
dnia na polecenie właściciela („bez domysłów i interpretacji”). Nie są
decyzjami. Obowiązują słowa właściciela z części B i C pliku
`ZLECENIE_POPRAWKI_02_10.md`. Status w rejestrze: „numery nieużyte”.
