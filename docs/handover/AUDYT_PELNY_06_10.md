# AUDYT PEŁNY WATCH TOWER — 06.10.2026 (noc 05/06.10)

**Jak sprawdzałem.** Zalogowałem się kontem testowym (rola Administrator HHL) w przeglądarce sterowanej programem (Playwright, Chromium), na ekranie komputera 1366×768 oraz telefonu 390×844. Przeszedłem wszystkie 10 widoków menu w trzech rolach (HHL, KSH, Scandinavian Express — przez przełącznik „Widok”), panel zlecenia SG-03 z każdą zakładką, dzwonek powiadomień, Centrum decyzji, Rejsy, wszystkie sekcje Opcji. Mierzyłem czasy ładowania i liczbę zapytań do serwera. Równolegle czytałem bazę produkcyjną (tylko odczyt) i kod, który aplikacja wysyła do przeglądarki. Niczego nie zapisałem, nie wysłałem i nie zmieniłem.

**Czego nie mogłem sprawdzić.** Ról KSH i przewoźnika oglądałem przez przełącznik „Widok”, nie przez prawdziwe konta tych firm — pełne ograniczenia dostępu (RLS) działają na prawdziwych kontach i mogą dawać inny obraz. Nie testowałem zapisu (awizacja, edycja dat, dokumenty, dopłaty), bo działałem tylko do odczytu. Nie widziałem aplikacji na prawdziwym telefonie, tylko w emulacji.

---

## CZĘŚĆ A — BŁĘDY KRYTYCZNE (blokują sensowne użycie)

### A1. Mapa ładuje się ponad 20 sekund — przyczyna znaleziona

**Co widać.** Po wejściu w „Mapa” na komputerze przez 15–22 sekundy widać szare tło z kilkoma kropkami, bez podkładu. Pierwszy kafelek mapy pojawia się dopiero między 22. a 30. sekundą. Na telefonie pierwszy kafelek po ok. 15 s. To dokładnie to, co zgłaszałeś jako „bardzo wolno ładujące się podkłady”.

**Dlaczego.** Przy otwarciu widoku Mapa aplikacja wysyła do bazy **188 osobnych zapytań `load_track`** — po jednym (a właściwie po dwa) na każdy z 94 transportów — żeby narysować ślady i trasy. Zmierzyłem: 29 zapytań w 9. sekundzie, 144 w 10. sekundzie. Przeglądarka ma limit ok. 6 równoległych połączeń do jednego serwera, a **kafelki mapy też idą przez ten sam serwer** (funkcja `here-raster` w Supabase, która pośredniczy między aplikacją a HERE). Kafelki czekają więc w kolejce za 188 zapytaniami o ślady. Dodatkowo każdy kafelek to osobne wywołanie funkcji na serwerze, a nie plik z szybkiej sieci dystrybucji, więc nawet bez kolejki jest wolniejszy, niż mógłby być.

**Skutki uboczne.** Te same 188 zapytań idzie także przy otwarciu kokpitu (mały podgląd mapy) i panelu zlecenia (mapa w szczegółach). Każde wejście na mapę to 188 zapytań, choć tylko 1 transport ma dziś jakiekolwiek pozycje.

**Co zmienić.**
1. Ślady i trasy pobierać **jednym zapytaniem** dla wszystkich widocznych transportów, albo tylko dla transportów, które mają pozycje GPS (dziś: 1 z 94). Transporty bez pozycji nie potrzebują `load_track`.
2. Kafelki mapy serwować inną drogą niż dane: bezpośrednio z HERE (klucz ograniczony do domeny tower.log-mar.pl) albo przez pamięć podręczną na brzegu sieci (Vercel/Cloudflare), która trzyma gotowe kafelki. Wtedy podkład pojawia się w 1–2 s niezależnie od danych.
3. Najpierw rysować podkład, potem dane — a nie odwrotnie.

### A2. Dzwonek powiadomień pokazuje kody zamiast treści

**Co widać.** Po kliknięciu dzwonka lista 40 pozycji wygląda tak: „RISK_OPEN 15m”, „RISK_RESOLVED 15m”, „RISK_OPEN 30m”… Bez nazwy transportu, bez treści ryzyka, bez tego, co się stało. Użytkownik nie wie, czego dotyczy żadna pozycja. Zgodnie z Twoim zeszytem (pytanie 13) dzwonek miał znikać po kliknięciu i prowadzić do celu — ale najpierw musi mówić, o co chodzi.

**Dlaczego.** Powiadomienie ma w bazie pole szablonu (`template`) i ładunek (`payload`) z danymi, a lista wyświetla nazwę szablonu zamiast zbudowanego tytułu. Tytuł istnieje dla e-maili, dla dzwonka go nie złożono.

**Co zmienić.** Każda pozycja: tytuł po polsku (np. „SG-11 · zdarzenie drogowe na trasie: E4 Örnsköldsvik”), kto/co, czas względny („15 min temu”), a nie „15m”. Przycisk „Oznacz wszystkie” zostaje, bo nie łamie zasady „bez przeczytane” — ale do sprawdzenia, czy go chcesz.

### A3. Panel zlecenia w widoku KSH — potwierdzone zrzutem

Po kliknięciu w transport w roli KSH otwiera się panel z gołym tekstem „SG-03 / Edytuj / ✕” i czarnym przyciskiem „Edytuj”, bez stylów, zakładek i danych. Przyczyna w kodzie: `if (rola === KSH) return <KshSideMenu/>`. Pełna treść polecenia „KSH — PANEL ZLECENIA” jest w załączniku na końcu tego pliku. Tu tylko potwierdzam i dodaję: KSH w swoim harmonogramie widzi też kolumnę „Zmień ciągnik” — przycisk zmiany ciągnika nie powinien być dostępny dla KSH.

### A4. Sytuacje drogowe w Szwecji wyświetlają się po szwedzku

**Co widać.** W panelu zlecenia (SG-11, zakładka Przegląd) widać wpisy: „SE E4: från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)”, „SE E4: från Backen till Gärde båda riktningarna i Gävleborgs län (X)”. To szwedzki. Pozycja PL-DATA (wszystko po polsku) została zgłoszona jako zrobiona ze zużyciem DeepL 4 157 znaków — a tytuły zdarzeń nadal są po szwedzku.

**Dlaczego (prawdopodobnie).** Tłumaczony jest opis zdarzenia, a tytuł budowany z pól „od – do – kierunek – województwo” składa się z surowych fraz szwedzkich („från… till… båda riktningarna i… län”). To są stałe słowa, które powinny być w słowniku, bez DeepL.

**Co zmienić.** Tytuł zdarzenia składany po polsku: „E4: od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten”. Nazwy miejscowości zostają oryginalne.

### A5. ETA przed załadunkiem nadal widoczne w tabelach i liczone do statystyk

**Co widać.** W Harmonogramie i na liście przy Mapie kolumna „ETA Boden” pokazuje 07.10 18:00, 04.10 18:00 itd. dla transportów, które jeszcze nie wyjechały. Kreska „–” działa tylko w panelu szczegółów. Na kokpicie z tych dat liczą się „Terminowe 88 / Spóźnione 6” i „6 dostaw poza oknem”.

**Dlaczego.** 93 transporty mają w bazie stare ETA policzone 01.10 z planu (sprzed migracji 0146). Decyzja ETA-PRE-LOAD ukryła je tylko w jednym miejscu.

**Co zmienić.** Wyczyścić stare wartości w bazie (nie czekać na R-0) i zastosować regułę „kreska przed wyjazdem ze Śremu” we wszystkich miejscach: tabela harmonogramu, lista przy mapie, eksport PDF/XLSX, kokpit (liczniki terminowości tylko z transportów w drodze).

### A6. Finanse pokazują trzy różne prawdy

**Co widać.** W widoku Finanse górna sekcja „Od przychodu do marży” pokazuje 0,00 PLN we wszystkich wierszach (w tym „Marża prognozowana · 86”), tabela niżej pokazuje ok. 3,03 mln PLN przychodu i 144 277 PLN marży, a kokpit „Marża narastająco 144 277,00 PLN · 4,4%”. Z bazy wychodzi: koszt 657 293,90 EUR, przychód 690 158,82 EUR, marża 32 864,92 EUR = **4,76%**, nie 4,4%. Komunikat „Bez zatwierdzonych parametrów i odczytów — brak dopłaty” jest nieaktualny — dopłata jest liczona (mnożnik 1,14 i 1,13).

**Co zmienić.** Jedno źródło liczb dla kokpitu i Finansów, usunięcie nieaktualnego komunikatu, poprawne liczenie procentu marży (marża/przychód).

### A7. Waluta: wszędzie PLN, a ustalenie mówi EUR

Kokpit, Harmonogram (Koszt/Przychód/Marża), Finanse i Ceny pokazują PLN; Faktury pokazują €. Twoje ustalenie z 24.09: wszędzie EUR, użytkownik może sam przełączyć na PLN w ustawieniach. Nie sprawdzałem ustawienia waluty konta testowego — jeśli ktoś ustawił PLN dla tego konta, to zachowanie jest poprawne, ale domyślną wartością dla nowych kont ma być EUR. Dodatkowo w zakładce Ceny widać „Kurs NBP · 0.0000 ·” — zepsuty wiersz (brak kursu albo brak formatowania).

---

## CZĘŚĆ B — BŁĘDY WAŻNE (logika, dane, bezpieczeństwo)

### B1. Panel „Ustalenia” jest sprzeczny z Twoimi decyzjami

W zakładce Ustalenia (HHL i przewoźnik) są:
- „Link dla kierowcy · Wygeneruj nowy link · Wyślij link SMS-em · Odwołaj link” — przy zasadzie **zero aplikacji dla kierowców** (D-79) i zamkniętym linku (DRV-CLOSE). Guziki nadal są, choć nic nie mogą zrobić.
- U przewoźnika formularz **„Wymiary zestawu — Zestaw L×W×H, Masa zestawu, Zapisz zasoby”** — przy decyzji D-83: wymiary podajesz Ty, przewoźnik nie wprowadza żadnych wymiarów.
- Przyciski „Przypisz SCX · Oznacz jako gotowy · Wyjazd · Oznacz rozładowany · Wyślij” — ręczne statusy są zgodne z ustaleniem (dyspozytor ustawia ręcznie bez telematyki), ale według zeszytu (10g) zakładka Ustalenia miała być **tylko czatem**. Statusy ręczne powinny być w zakładce Status.

### B2. Zakładki Status i Historia pokazują to samo

Obie zakładki mają identyczną treść. Według zeszytu Status ma pokazywać statusy i kamienie milowe, a Historia — wszystkie zmiany. Dodatkowo wpisy historii są w surowej formie: „GEOFENCE_EXIT”, „SAILING_ASSIGNED · rejs usunięty”, „RESOURCES_UPDATED”, „STATUS_READY · Zasoby uzupełnione — cover OK” (angielskie „cover OK”), „ORDER_NO_UPDATED” dwa razy pod rząd, „Zmiana automatyczna READY → READY” (zmiana z tego samego na to samo). Autor wpisu: „— // HHL” zamiast imienia i nazwiska, choć decyzja z poczekalni mówi „imię nazwisko // firma”.

### B3. Centrum decyzji: kody, identyfikatory, liczniki się nie zgadzają

- Pozycje mają surowy kod typu „NO_AWIZACJA” i nazwę transportu w postaci numeru zlecenia SCX („15048/2026/OSL/GDA/P”) albo fragmentu identyfikatora („5c77d4d7: brak awizacji”) zamiast kodu transportu (SG-03).
- Liczniki: kokpit „Wymaga decyzji 185”, Centrum decyzji „31”, baner „+128 ryzyk”, a dzwonek „40”. Cztery różne liczby o tym samym.
- Większość pozycji to „brak numeru zlecenia HHL/przewoźnika” na danych testowych — to szum, który zniknie po R-0, ale pokazuje, że brak numeru generuje dwie decyzje na transport (HHL i przewoźnik osobno), czyli 188 pozycji z jednego problemu.
- Kliknięcie w decyzję prowadzi do panelu transportu (dobrze), ale do zakładki Przegląd, nie do miejsca, gdzie decyzję się podejmuje.

### B4. Przełączniki SMS przy strefach niewidoczne dla nikogo

Zapytanie o `security_flags` (SMS przy zbliżaniu / przy wjeździe) zwraca **403** przy każdym wejściu do Opcji, w każdej roli. Tabela nie ma żadnych uprawnień dla zalogowanych użytkowników — ma je tylko serwer. Przełączniki w Opcjach nigdy nie pokażą prawdziwego stanu. To jedyny błąd w konsoli przeglądarki, powtarza się przy każdym załadowaniu Opcji.

### B5. Sekcje Opcji nie ładują danych, dopóki nie klikniesz „Odśwież”

Po rozwinięciu „Stan systemu” widać: Bramka SMS „Brak”, Poczta „—”, Kopia „—”, Integracje „Brak wpisów”, HERE „0/100 · kafelki 0/0 · podkład zapas”, DeepL „0”. Po kliknięciu „Odśwież” pojawiają się prawdziwe dane (bramka działa, ostatni kontakt 07:15; kopia udana 00:30; integracje 13 z 14 OK; HERE kafelki 3 803/30 000; DeepL 4 157). To samo z Dziennikiem logowań: „Brak wpisów”, a po odświeżeniu lista. Użytkownik, który nie kliknie „Odśwież”, zobaczy fałszywy obraz: „podkład zapas”, „brak urządzeń”. Sekcje mają ładować dane przy rozwinięciu i pokazywać „ładowanie…”, nie „brak”.

### B6. „Czas wykrycia odchylenia” pokazuje bzdury

Kokpit: „Czas wykrycia odchylenia — 0 min · mediana n = 1 (30 dni)”, wcześniej „— · brak zdarzeń z czasem”. Zero minut z jednej próbki to nie jest informacja. Do czasu zebrania sensownej liczby zdarzeń (np. ≥ 5) pokazywać „za mało danych”.

### B7. Kokpit przewoźnika: „Pogoda i stan morza: brak źródła danych”

Pole „Ryzyko promowe” u przewoźnika mówi, że nie ma źródła pogody morskiej, a pogoda (FMI/DMI/SMHI, II-8) jest pobierana i w bazie są odczyty. Kafelek nie jest podłączony do danych. „Przychód tygodnia 0,00 PLN · tydzień 41, do zafakturowania” — choć SG-03 ma koszt 7 866 EUR w tygodniu 40; kafelek liczy coś innego niż tabela.

### B8. Profil trasy (H-8) nie działa

W panelu SG-03: „Profil trasy — Nie udało się pobrać profilu” (HHL) i „Liczenie profilu…” bez końca (SCX). H-8 zgłoszono jako zrobione. Albo profil nie liczy się dla transportu w trasie, albo błąd po stronie HERE/pul. Do sprawdzenia w logach funkcji.

### B9. Rejsy: lista do stycznia 2027, bez filtra „Przyszłe” jako domyślnego widoku

Zakładka Rejsy pokazuje wszystkie rejsy do 08.01.2027, każdy z przyciskami „Opóźnienie / Odwołaj”. Twoje ustalenie: podział na przyszłe i minione, filtr „Przyszłe”, rok w datach. Rok jest. Filtra „Przyszłe” jako domyślnego nie widziałem — lista zaczyna się od 30.12.2026 na dole strony. Przyciski „Opóźnienie / Odwołaj” przy każdym z setek rejsów — przy ustaleniu „rejsy edytuje tylko administrator” — są OK dla admina, ale lista powinna domyślnie pokazywać najbliższe 2–3 tygodnie.

### B10. Dane testowe poza zakresem R-0 (powtórzenie z poprzedniego audytu)

Polisa „Test OCP (auto-attach 3.2)” na 5 mln EUR zatwierdzona (stąd „Polisa OCP 94/94”), testowa faktura WT-TEST-P6-20261005 (widok Faktury pokazuje przez to „tydzień 38”), 3 urządzenia bramki SMS (jedno działa, dwa prawdopodobnie testowe). R-0 kasuje tylko transporty — te rzeczy trzeba dopisać do planu czyszczenia albo usunąć osobno.

### B11. Błąd JavaScript w wielu widokach

„Cannot read properties of undefined (reading 'appendChild')” pojawia się w konsoli przy wejściu do Finansów, Faktur, Harmonogramu, Ryzyk i Kokpitu w różnych rolach (łącznie kilkanaście razy w przebiegu). Nie blokuje widoków, ale to nieobsłużony błąd — prawdopodobnie w kodzie mapy albo wykresu, który próbuje rysować przed zamontowaniem elementu. Do naprawy, bo w innych warunkach (wolniejszy telefon) może wysypać widok.

### B12. Bezpieczeństwo (z raportu Supabase, powtórzenie)

- Trzy widoki finansowe działają z uprawnieniami twórcy (SECURITY DEFINER); filtry ról w nich są, ale konstrukcja jest krucha.
- `driver_post_event` i `driver_get_instructions` nadal wywoływalne bez logowania (wymagają tokenu, nowych tokenów nie da się wydać).
- Ochrona haseł z wycieków wyłączona (do sprawdzenia dostępność w planie).

---

## CZĘŚĆ C — WYGLĄD, UKŁAD, TEKSTY

### C1. Telefon (390 px)

- **Kokpit:** kafelki KPI w trzech kolumnach nie mieszczą się — trzecia kolumna (Terminowość, Czas wykrycia) jest obcięta poza prawą krawędzią (element sięga 471 px przy ekranie 390). „Wymaga decyzji” i „0 / 94” łamią się na trzy linie w wąskiej kolumnie, cyfry 42 px przy etykietach 11 px.
- **Mapa:** legenda „w drodze · załadunek · opóźniony · na placu · brak sygnału” zasłania dolną część mapy; nagłówek mówi „0 pojazdów w ruchu”, a na komputerze w tym samym momencie „1 pojazdów w ruchu” (i gramatyka: „1 pojazdów”). Tabela pod mapą jest szersza niż ekran (803 px).
- **Ryzyka:** tabela ryzyk pod listą ma 1 781 px szerokości — przewija się w poziomie.
- **Dokumenty, Finanse, Faktury, Strefy, Opcje:** tabele szersze niż ekran (660–810 px). Zeszyt, pytanie 11: „nic się nie rozjeżdża na telefonie”. Rozjeżdża się w 6 z 10 widoków.
- **Dzwonek:** czerwona plakietka „40” wystaje poza nagłówek.
- **Opcje na telefonie:** 120 przycisków mniejszych niż 32 px (minimalny wygodny cel dotyku to 44 px). Na komputerze w Harmonogramie 134 takie elementy (głównie „Zmień ciągnik” w każdym wierszu i chipy).

### C2. Komputer

- **Harmonogram 1280–1366 px:** przyklejona kolumna „Marża” nakłada się na kolumnę „Status” (sprawdzone pozycjami komórek: komórka Marży na 1146 px, nagłówek na 2181 px). Widać to na zrzucie: wartości „1726,59 PLN 4,8%” w miejscu statusu. Tabela ma 17 kolumn na 2 200 px szerokości; bez przewinięcia widać 8.
- **Logo w nagłówku:** napis „WATCH TOWER” łamie się na dwie linie („WATCH / TOWER”) przy 1366 px; przy 1280 px nie. Nagłówek ma za dużo elementów w jednym rzędzie (logo, nazwa, Widok, 3 role, 4 ikony, t41, dwa promy, data).
- **Pasek etapów** („Przygotowanie … Dostarczone”) jest pusty — same nazwy bez liczb i bez podświetlenia aktywnego etapu; w każdej roli wygląda tak samo. Jeśli nie niesie informacji, zabiera 40 px wysokości na każdym ekranie.
- **Ekran logowania:** tytuł „Watch Tower” pod logo prawie niewidoczny (kontrast ~1:1), na komputerze i telefonie.
- **Czcionki:** Barlow i Barlow Condensed wszędzie (dobrze, spójnie); 48 elementów w „Lucida Console” (surowy JSON w Automatyzacjach i kody). Rozmiary: 18 różnych wielkości czcionki w aplikacji, od 9,5 px (1 128 elementów!) do 42 px. 9,5 px to za mało na telefonie — to etykiety pod liczbami i opisy w tabelach.

### C3. Teksty i spójność

- Mapa: podkład HERE z napisami w językach lokalnych i cyrylicą („Мурманск”, „SVERIGE”, „ČESKO”). Parametr języka kafelków ma być polski (PL-DATA).
- Automatyzacje: surowy JSON w opisie reguł (`{"==":[{"var":"payload.geofence_kind"},"PRE_ARRIVAL"]}`); reguła „Rozładunek — wgraj POD” sprzeczna z rezygnacją z POD (D-38, B-4b).
- Dokumenty: „Pobierz paczkę ZIPWgraj dokument” — dwa przyciski zlane bez odstępu.
- Ceny: „×1.1400” (kropka zamiast przecinka, 4 miejsca po przecinku), „4.8%” obok „4,8%” w tabeli.
- Panel SG-03: „przerwa z GPS · przerwa z GPS” — zdublowany fragment pod ETA.
- Daty: „1.10.2026” obok „28.09.2026” (bez zera wiodącego) w Centrum decyzji i historii; „5.10.2026” w Stanie systemu.
- Strefy: kolumna „Powiadamia” = „—” we wszystkich 10 strefach, choć strefy mają odbiorców SMS.
- Brak wyceny (8 KR) pokazany jako „0,00 PLN” — powinno być „—” albo „brak wyceny”.
- Nagłówek „Centrum decyzji” w widoku, do którego menu prowadzi jako „Ryzyka”.
- Przewoźnik w kokpicie widzi te same „Wymaga decyzji 185” co HHL, w tym decyzje przypisane HHL.

---

## CZĘŚĆ D — TWOJE USTALENIA: CO JEST, CZEGO NIE MA

Sprawdziłem na produkcji te ustalenia, które da się sprawdzić bez zapisu.

| Ustalenie | Stan | Uwagi |
|---|---|---|
| Tylko język polski, bez wyboru języka (Q-8) | ✅ w interfejsie | w kodzie mechanizm zmiany języka nadal istnieje; dane Trafikverket częściowo po szwedzku (A4); mapa w językach lokalnych |
| Bez zegara w prawym górnym rogu (Q-10) | ✅ | jest tylko data |
| Ekran logowania wyśrodkowany (P15) | ⚠️ | układ tak, tytuł niewidoczny |
| Stena w górnym pasku obok Polferries (P7) | ✅ | |
| Promy na mapie wg reguły (Q-18) | ✅ | widać Stena Estelle/Spirit, Wawel; Ebba ukryta (płynie do PL) |
| Podkład HERE (B-MAPA) | ✅ ale A1 | ładuje się 15–30 s |
| Separator „ / ” i „\|” przy przepięciu (C-SEP) | ⚠️ | w SG-03 kierowcy „A\|B” i telefony „1\|2” — zapis z „\|” oznacza przepięcie; czy to jest przepięcie, czy dwóch kierowców? Jeśli to dwóch kierowców, separator ma być „ / ” |
| Nr zlecenia HHL-KSH i HHL-SCAN w tabeli (8.2) | ✅ | |
| Daty z rokiem (8.11) | ✅ w tabeli | w Centrum decyzji daty bez zera wiodącego |
| Linie pionowe w tabeli (8.5) | ✅ | |
| Zmień ciągnik (8.4) | ✅ | ale dostępny też w widoku KSH |
| Filtry zakres dat, bez kierowcy/ciągnika (B-8) | ✅ | |
| Kafelki bez cyfr etapu, filtr z „×”, kafelek Prom (B-9, L-11) | ✅ | |
| Przycisk „Nowa automatyzacja” (B-5) | ✅ | |
| Historia „imię nazwisko // firma” | ❌ | „— // HHL” |
| Status osobno od Historii (10d) | ❌ | identyczne |
| Ustalenia = tylko czat (10g.1) | ❌ | formularze, statusy, link kierowcy |
| Przewoźnik nie wprowadza wymiarów (D-83) | ❌ | formularz „Wymiary zestawu” u przewoźnika |
| Zero aplikacji dla kierowców (D-79) | ⚠️ | link zamknięty, ale przyciski linku zostały |
| ETA „–” przed załadunkiem | ⚠️ | tylko w panelu; tabele i kokpit pokazują stare ETA |
| Waluta domyślnie EUR | ❌ (do potwierdzenia) | PLN w kokpicie, harmonogramie, finansach, cenach |
| Dzwonek: bez „przeczytane”, znika po kliknięciu, cel z L-4 | ❌ | pozycje to kody RISK_OPEN bez treści; kliknięcia nie testowałem (brak klikalnych pozycji) |
| KSH widzi to co inni + Edytuj dat (K.1 poprawione) | ❌ | zlecone, czeka |
| Rejsy: przyszłe/minione, tylko admin (R.1–R.4) | ⚠️ | rok jest; domyślnie pełna lista do 2027 |
| Powiadomienia na telefon (Q-11b) | nie testowałem | wymaga instalacji PWA |
| Tryb jasny wg systemu (Q-9) | ✅ | jasny motyw w emulacji |

---

## CZĘŚĆ E — WYDAJNOŚĆ (liczby)

| Pomiar | Wynik |
|---|---|
| Pierwszy kafelek mapy po wejściu w Mapa, komputer | między 22 a 30 s |
| Pierwszy kafelek mapy, telefon | ok. 15 s |
| Zapytania do bazy przy otwarciu Mapy | 218 w 12 s, z czego 188 `load_track` |
| Zapytania przy otwarciu kokpitu | 42 |
| Zapytania przy otwarciu panelu SG-03 | 39 |
| Przełączanie widoków po załadowaniu (hash) | natychmiast (0,01–0,04 s) — aplikacja sama w sobie jest szybka |
| Błędy JS w konsoli | `appendChild` × kilkanaście; 403 `security_flags` przy każdym wejściu w Opcje |

Wniosek: aplikacja nie jest wolna. Wolna jest **mapa**, z jednego powodu (A1). Po naprawie A1 wszystkie mapy w programie (kokpit, Mapa, panel zlecenia) przyspieszą jednocześnie.

---

## CZĘŚĆ F — CO ULEPSZYĆ (propozycje, nie błędy)

1. **Nagłówek:** na 1366 px za ciasno. Dwa promy z czasami do wypłynięcia przenieść do jednego rozwijanego elementu „Najbliższe rejsy”, przełącznik ról do menu bocznego (jest tam już nazwa użytkownika i rola). Pasek etapów usunąć albo zamienić na pasek postępu z liczbami.
2. **Kokpit na telefonie:** kafelki w dwóch kolumnach albo jednej, cyfry 32 px zamiast 42.
3. **Tabele na telefonie:** widok kart zamiast tabel (jeden transport = jedna karta), tak jak lista pod mapą.
4. **Dzwonek:** grupować („3 nowe zdarzenia drogowe na trasie SG-03”) zamiast 40 wpisów.
5. **Centrum decyzji:** grupować po transporcie i typie; „brak numeru HHL i SCX” jako jedna pozycja z dwoma odpowiedzialnymi.
6. **Minimalna czcionka 12 px** na telefonie; etykiety 9,5 px podnieść.
7. **Jeden format liczb i dat** w całej aplikacji: przecinek dziesiętny, 2 miejsca, zero wiodące w dacie.
8. **Sekcje Opcji:** dane ładują się przy rozwinięciu, z napisem „ładowanie…”.
9. **Centrum decyzji → cel kliknięcia:** do konkretnej karty decyzji, nie do Przeglądu.

---

## CZĘŚĆ G — WĄTPLIWOŚCI

1. Role KSH i przewoźnika sprawdzałem przełącznikiem „Widok” na koncie administratora. Prawdziwe konta mogą widzieć więcej albo mniej (RLS). Na przykład komunikat „Ta cena nie jest widoczna w Twojej roli” pojawił się u przewoźnika przy cenie KSH, ale sama kwota była obok w tej samej zakładce.
2. Separator „|” przy kierowcach SG-03: nie wiem, czy to prawdziwe przepięcie, czy dane testowe z dwoma kierowcami.
3. Waluta PLN: nie sprawdziłem ustawienia tego konta.
4. „Profil trasy — nie udało się pobrać”: nie wiem, czy to błąd stały, czy chwilowy (pula HERE jest daleka od wyczerpania).
5. 403 na `security_flags` dotyczy na pewno konta testowego; przypuszczam, że każdego, bo tabela nie ma uprawnień dla zalogowanych — ale konta właściciela nie sprawdziłem.
6. Nie testowałem żadnego zapisu, więc nie wiem, czy formularze (awizacja, dopłaty, dokumenty, zmiana dat) działają poprawnie.

---

# PROMPT DLA GROKA

```
AUDYT PEŁNY KOORDYNATORA 06.10 — POPRAWKI (plik AUDYT_PELNY_06_10.md
w załączniku; każdy punkt ma tam opis, zrzut i pomiar).
Kolejność jak niżej. Przy każdym punkcie: przyczyna, poprawka, test,
dowód (zrzut z produkcji / pomiar / zapytanie). Zapisz plik
w docs/handover/.

1. MAPA — CZAS ŁADOWANIA (A1, pomiar: pierwszy kafelek po 22–30 s)
   Przyczyna: przy otwarciu Mapy 188 wywołań rpc load_track (po 2 na
   transport), kafelki przez ten sam host (funkcja here-raster) czekają
   w kolejce połączeń przeglądarki.
   - ślady/trasy: JEDNO zapytanie dla widocznych transportów, i tylko
     dla transportów z pozycjami GPS (dziś 1 z 94); bez pozycji — zero
     zapytań
   - kafelki inną drogą niż dane: bezpośrednio z HERE z kluczem
     ograniczonym do domeny ALBO przez cache na brzegu (Vercel/Cloudflare);
     licznik D-78 nadal liczy kafelki
   - podkład rysowany przed danymi
   - to samo dla mapy w kokpicie i w panelu zlecenia
   Test (pomiar Playwright, świeże otwarcie, 1366 px i 390 px): pierwszy
   kafelek ≤ 2 s, komplet ≤ 5 s, zapytań do bazy przy otwarciu Mapy ≤ 20.

2. DZWONEK (A2): pozycje z tytułem po polsku (transport · co się stało),
   czas „15 min temu", klik → cel z L-4; bez kodów szablonów.
   Grupowanie wielu zdarzeń tego samego typu dla jednego transportu.

3. PANEL KSH (A3) — według załącznika „KSH — PANEL ZLECENIA" na końcu pliku;
   dodatkowo: „Zmień ciągnik" niewidoczny dla KSH.

4. PL-DATA (A4): tytuły sytuacji Trafikverket po polsku („E4: od X do Y,
   oba kierunki, region Z") — stałe słowa ze słownika, nie DeepL;
   kafelki HERE z parametrem języka polskiego.

5. STARE ETA (A5): wyczyść eta_site/eta_basis dla transportów przed
   wyjazdem ze Śremu (93 szt.), zamknij ryzyka z nich wynikające;
   reguła „–" we WSZYSTKICH miejscach (tabela, lista przy mapie,
   eksporty, liczniki kokpitu — terminowość tylko z transportów w drodze).

6. FINANSE (A6): jedno źródło liczb dla kokpitu i Finansów; sekcja
   „Od przychodu do marży" liczona z load_cost/load_revenue; procent
   marży = marża/przychód (dziś 4,76%, kokpit pokazuje 4,4%); usuń
   nieaktualny komunikat „brak dopłaty"; „Kurs NBP · 0.0000 ·" → kurs
   z datą albo „kurs po rozładunku".

7. WALUTA (A7): domyślnie EUR dla każdego konta (U-5); PLN tylko gdy
   użytkownik przełączy w ustawieniach; sprawdź ustawienie konta
   testowego i raport, skąd PLN.

8. USTALENIA / STATUS / HISTORIA (B1, B2):
   - Ustalenia = tylko czat (10g.1); ręczne statusy → zakładka Status;
     usuń przyciski linku kierowcy (D-79, DRV-CLOSE); usuń formularz
     „Wymiary zestawu" u przewoźnika (D-83)
   - Status: lista statusów i kamieni milowych z czasem; Historia:
     wszystkie zmiany; nie identyczne
   - wpisy po polsku, bez kodów (GEOFENCE_EXIT, RESOURCES_UPDATED,
     „cover OK"), bez duplikatów, bez „READY → READY"; autor „imię
     nazwisko // firma", automat „System // Watch Tower"

9. CENTRUM DECYZJI (B3): kod transportu zamiast numeru SCX/identyfikatora;
   nazwy typów po polsku; JEDEN licznik tej samej liczby w kokpicie,
   Centrum i banerze; brak numeru HHL i SCX = jedna decyzja z dwoma
   odpowiedzialnymi; klik → karta decyzji, nie Przegląd.

10. SECURITY_FLAGS 403 (B4): uprawnienia odczytu dla zalogowanych
    (RLS: tylko HHL_ADMIN) — przełączniki SMS w Opcjach pokazują stan.

11. OPCJE — ŁADOWANIE SEKCJI (B5): dane przy rozwinięciu, napis
    „ładowanie…" zamiast „Brak"/„—"/„podkład zapas" przed danymi.

12. DROBNE Z LOGIKI (B6–B9): „Czas wykrycia odchylenia" → „za mało
    danych" poniżej 5 zdarzeń; kafelek „Ryzyko promowe" u przewoźnika
    podłączony do II-8; „Przychód tygodnia" liczony jak tabela; H-8
    profil trasy — przyczyna „nie udało się pobrać" i naprawa; Rejsy
    domyślnie „Przyszłe", najbliższe 3 tygodnie, reszta po rozwinięciu.

13. DANE TESTOWE POZA R-0 (B10): dopisz do planu R-0: polisa „Test OCP",
    faktura WT-TEST-P6, testowe urządzenia bramki, konta testowe —
    lista do akceptacji właściciela.

14. BŁĄD JS appendChild (B11): znajdź i napraw; test: zero błędów
    w konsoli w 10 widokach × 3 role × 2 szerokości.

15. TELEFON 390 px (C1): kokpit — kafelki w 1–2 kolumnach, bez obcięcia;
    tabele w Ryzykach, Dokumentach, Finansach, Fakturach, Strefach,
    Opcjach — widok kart albo przewijanie w obrębie sekcji (bez
    przewijania całej strony w poziomie); legenda mapy nie zasłania
    mapy; plakietka dzwonka w nagłówku; cele dotyku ≥ 44 px;
    czcionka minimum 12 px. Test: 10 widoków × 3 role, scrollWidth
    = szerokość ekranu, zero elementów poza prawą krawędzią.

16. KOMPUTER (C2): Harmonogram — przyklejona Marża nie zakrywa Statusu
    (1280 i 1366 px); logo w jednej linii przy 1366 px; pasek etapów —
    z liczbami i aktywnym etapem albo usunąć; tytuł na ekranie logowania
    kontrast ≥ 4,5:1.

17. TEKSTY (C3): JSON w Automatyzacjach → opis po polsku; reguła
    „wgraj POD" usunięta (B-4b); „Pobierz paczkę ZIP" / „Wgraj dokument"
    rozdzielone; „×1,14" i „4,8 %" jednolicie (przecinek, 2 miejsca);
    daty z zerem wiodącym wszędzie; „przerwa z GPS" bez duplikatu;
    „1 pojazdów" → odmiana (PL-PLURAL); Strefy — kolumna „Powiadamia"
    z prawdziwymi odbiorcami; brak wyceny → „—"; nagłówek widoku
    „Ryzyka" = nazwa w menu; liczniki mapy spójne (komputer 1, telefon 0).

18. SEPARATOR (D): SG-03 „ROBERT PREIHS|MICHAŁ MADEJ" — potwierdź, czy
    to przepięcie (wtedy „|" poprawne) czy dwóch kierowców (wtedy „ / ").

Zasady: migracje przez lokalną bramę, obie domeny 200, raport po każdym
punkcie ze zrzutem. Zapisz w PLAN.md i POLECENIA_KOORDYNATORA.md.
```


---

# ZAŁĄCZNIK — POLECENIE „KSH — PANEL ZLECENIA” (pełna treść)

```
KSH — PANEL ZLECENIA (decyzja właściciela 05.10; zastępuje dosłowne
odczytanie B-KSH / punktu K.1 listy kontrolnej).

Słowa właściciela: „KSH powinno widzieć to, co każdy. W zakładce
Przegląd powinien być przycisk Edytuj — taki sam jak dla SCX.
Po kliknięciu powinno otwierać się okienko pop-up — jak SCX. Jedyne
dane do edycji to data + godzina załadunku oraz rozładunku."

1. Usuń osobny panel KshSideMenu. KSH widzi TEN SAM panel zlecenia co
   pozostali: wszystkie zakładki i dane — w granicach zasad widoczności
   KSH (bez kosztu przewoźnika i marży; faktura SCX niewidoczna — U-8;
   dane kierowcy widoczne — U-29; dopłaty: tylko akceptacja — 10f.4).
2. W Przeglądzie przycisk „Edytuj" — wygląd i miejsce jak u SCX.
3. „Edytuj" otwiera pop-up jak u SCX; do edycji WYŁĄCZNIE data i godzina
   załadunku oraz rozładunku (okna od–do). Blokada także w bazie.
4. Zapis: wpis w Historii („imię nazwisko // KSH"), powiadomienia wg
   DEC-4, przeliczenie ETA i opłaty paliwowej, alarm zmiany daty (I-10).
   Zapis do SharePoint dopiero w II-10-E2.
5. „Zmień ciągnik" i inne przyciski przewoźnika/HHL niewidoczne dla KSH,
   z blokadą w bazie.
6. Testy (konto testowe, nie konto właściciela): wszystkie zakładki
   i dane; brak kosztu i marży; Edytuj w Przeglądzie; okno z datami
   i godzinami; zapis + wpis w Historii; odmowa innych pól przez API.
   ~~Zrzuty: komputer i 390 px.~~ Zmiana 06.10 (zasada dowodów właściciela): testy Playwright w roli KSH z asercjami, komputer i 390 px (`tests/aud03-ksh-panel.spec.ts`), + odmowa przez API (`tests/db/aud03.sh`).
Popraw B-KSH / K.1 w LISTA_KONTROLNA_ZESZYT.md i WERYFIKACJA_ZESZYT_05_10.md.

E-MAILE (do punktu 8): teksty jak w dzwonku — „SG-xx · co się stało",
po polsku, bez kodów, z linkiem do celu z L-4.
```
