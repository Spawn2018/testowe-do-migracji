# Decyzje właściciela 08.10.2026 — 12:14, 12:50, 12:58 i 13:26 (zapis Claude 12:45, 12:55, 13:01, 14:00, 14:20) oraz 09.10.2026 — 10:34–11:19, 12:33, 13:09

> **Numery paczek (08.10, po 14:43):** obowiązuje `docs/handover/PLAN.md` §4. W tym pliku odwołania do paczek zostały poprawione według PLAN (E31, E16, E40 → P5; E18 → P1 `paczki/P1_E18.md`; E18 P12 → P7, P14 → P10a, P15 → P2, P16 → P6).

Wiadomość 12:14 z załącznikiem „SCRAP_transporty_2026.09.23_REV.01_3.xlsx” (plik Excel z SharePoint), wiadomość 12:50 (E38, Supabase) i 12:58 (E16). Zapisane w raporcie (v58–v62: pole „Twoje decyzje” w każdej sekcji, nawigacja „zdecydowane”) i planie (v57–v60: wiersze ✅). Ten plik jest nadrzędny wobec linii „Stan: do akceptacji” w plikach E<nr>.md sprzed 12:14 (zaktualizowane: E41.md, E38.md).

## 09.10.2026, 13:09 — rozstrzygnięcia i aktualizacje (zapis Claude 14:11; dopisek `../dopiski/D-20261009-1309-01.md`)
> Najświeższe postanowienia są nadrzędne (08.10 13:26, 14:43). Ta część zastępuje wcześniejsze zapisy w sprawach niżej.

- **Konwój KR (2–3 auta):** „ci sami piloci prowadzą cały konwój” (odpowiedź na pytanie 1 z D-20261009-1233-01).
- **W20 (e-mail do armatora, D-18):** „mamy wszystkie zgody każdego z armatorów” — zamknięte, nic nie wysyłamy.
- **W22:** „usunąć z odpięciem 11 wpisów dziennika” — wiersze 6 kont „+tower-*” usuwa P1, 11 wpisów `audit_log` zostaje, odpięte (zastępuje „wiersze zostają nieaktywne” z 13:26 / 14:20 niżej).
- **1.** Zmiana jakiejkolwiek daty lub godziny załadunku albo rozładunku po sprawdzeniu pliku KSH z SharePoint → informacja u HHL i SCX; ustalona logika biznesowa i workflow zostają.
- **2.** Więcej niż 1 auto w danej lokalizacji → grupowanie na mapie tak samo jak przy promach.
- **3.** Tylko KSH i plik KSH z SharePoint zmieniają i potwierdzają daty oraz godziny załadunków i rozładunków. Zmiana KSH w Watch Tower automatycznie zmienia plik na SharePoint; zmiana w pliku automatycznie zmienia Watch Tower (zastępuje 12:50 / E38 „planu w pliku nie nadpisuje”).
- **4.** Polisy SCX i HHL dodaje się raz i podpinają się same pod dokumenty każdego transportu.
- **5.** Wszystkie dopłaty liczą się automatycznie, ale nie są wprowadzane automatycznie; czy zostaną dodane, decyduje wyłącznie HHL i SCX; dopłata SCX nadal wymaga akceptacji HHL (zastępuje E33 „HHL dodaje i zatwierdza”).

## 09.10.2026, 12:33 — piloci (dopisek `../dopiski/D-20261009-1233-01.md`)
- „Awizację pilotów podaje SCX. W awizacji podaje numer rejestracyjny oraz imię i nazwisko. Nic więcej. Awizacja pilotów ma być widoczna tylko w przypadku gdy pilotaż jest wymagany. […] »BRAK« = pilot niewymagany i nie może pojawiać się w transporcie. […] »PL + SE« = pilot w SE i PL jest wymagany i musi pojawić się w transporcie.” Zastępuje E32 pkt 7 „wpisuje HHL (E9)” i pola „firma, rejestracja, kierowca, telefon” oraz E9 „wymiary i piloci dla HHL” w części „piloci”.

## 09.10.2026, 10:34–11:19 — E44, link RIO (etap `etapy/E44.md`)
- 10:34: od podwykonawcy SCX jest link RIO (`public.position-sharing.rio.cloud`); innych linków ani dostępów nie będzie; opracować śledzenie w Watch Tower.
- 10:54: dane z linku mają trafiać do Watch Tower automatycznie.
- 11:19: zgoda SCX i przewoźnika (podwykonawcy) na automatyczny odczyt — jest, na piśmie; na każdy przejazd nowy link RIO; system sam rozpoznaje, czy lokalizator jest w ciągniku, czy w naczepie.

## 13:26 — polecenie „Zatem wykonaj tą pracę” i dane (zapis 14:00, zakres P1 14:20)
- **Zasada nadrzędna:** „Najświeższe ustalenia poczynione w tym czacie od samego początku są obowiązujące i nadpisują wszelkie starsze decyzje i rozwiązania.” Skutek: `UZGODNIENIE_08_10.md` (32 wpisy rejestru zastąpione albo zamknięte, 110 pozycji PLAN rozpisanych, R-0 nieaktualne, paczki P0–P10).
- **Zezwolenie „na firmę” jest:** GDDKiA, kategoria IV, nr 13/GD/2026, ważne 25.01.2026–25.01.2028, dla Scandinavian Express Poland Sp. z o.o. Wgrywa SCX po paczce P5 (E31).
- **Polisa SCX jest w systemie** (436000430439, 500 000 EUR, 30.03.2026–29.03.2027). Ubezpieczyciel „Hstia” → „ERGO Hestia” (paczka P1).
- **Polisa HHL:** PZU, nr 1106707356, OC przewoźnika drogowego, 23.04.2026–22.04.2027, 300 000 EUR na zdarzenie, klauzula 30 (ładunki ponadgabarytowe) podlimit 100 000 EUR, franszyza 500 EUR. Wgrywa HHL po paczce P5; nazwa w aplikacji według dokumentu („OC przewoźnika — PZU”, `ROZSTRZYGNIECIA_LUK.md` E9-5).
- **Użytkownicy (D-16) i numery SMS:** właściciel wprowadza sam w działającym programie.
- **Limity (D-15):** potwierdzone tabelą wymiarów 07.10. **KPD GDDKiA (D-17):** rezygnacja.
- **Adresy księgowości (E40):** HHL `ksiegowosc@hhlogistics.pl`, KSH `faktury@ksh.pl` — wartości startowe w paczce P5.
- **E18 „jeżeli trzeba — wykonaj”:** paczka P1 (`paczki/P1_E18.md`) sposobem z decyzji 32. Zakres P1: E18 P2, P3, P6–P11, P13, token kierowcy SG-01 + „ERGO Hestia”; E18 P12 z P7, P14 z P10a, P15 z P2, P16 z P6. Konta „+tower-*” tracą logowanie, zaproszenia, powiadomienia i „Działaj jako”, a ich wiersze zostają nieaktywne, bo wskazuje je dziennik bezpieczeństwa (11 wpisów, klucz bez kaskady).
- **Spoza audytu:** E46 test wydajności, E47 monitoring błędów aplikacji, E48 testy OWASP po budowie — opisane w `UZGODNIENIE_08_10.md` punkt 5; zaakceptowane przekazaniem kompletu Cursorowi (progi: `ROZSTRZYGNIECIA_LUK.md` L58).
- **Akceptacja:** `UZGODNIENIE_08_10.md` punkt 7 — rozstrzygnięty poleceniem właściciela 14:43 i przekazaniem kompletu (zob. tam).

## 12:58
- **E16: próg zbyt niskiej marży = 4 %.** Marża poniżej 4 % → lista „Poniżej progu marży” i kolor czerwony (jeden próg, Opcje › Cennik i opłaty, zmienia Administrator HHL z wpisem w Historii zmian). Stan 12:59 (SELECT): 86 transportów z ceną, marża 4,76–4,77 %, poniżej progu 0.

## 12:50
- **E38 aktualizacja:** KR-03 — „nie odrzucaj”. Import nie odrzuca transportu z dostawą przed załadunkiem; transport wchodzi ze sprawą „Daty KSH do sprawdzenia”.
- **E38 pytanie 1 — A:** Harmonogram domyślnie w układzie pliku; 8 kolumn E30 jako „Widok skrócony”.
- **E38 pytanie 2 — A:** Watch Tower wpisuje numery zleceń SCX i HHL do pliku, jak są tam dziś.
- **E38 całość — akceptuję.**
- **Dostęp do pliku na SharePoint nada dział IT KSH — czekamy.** Automatyczna synchronizacja startuje po dostępie; mapowanie, reguły w ręcznym wgraniu i układ Harmonogramu mogą iść wcześniej.
- **Supabase: plan zmieniony na Pro** (sprawdzone przez Claude 12:50: organizacja „OmniRoute”, plan „pro”). Ochrona przed wyciekniętymi hasłami i minimum 12 znaków — włączane w ustawieniach logowania przy wdrożeniu E19.
- **Po 12:58 w raporcie nie ma etapu z otwartym pytaniem** (sprawdzone: żadna sekcja nie ma pola „Do Twojej decyzji”). Czekają dane: dostęp do pliku SharePoint od działu IT KSH (E38), linki podwykonawców (E44) *[09.10: nieaktualne — link RIO jest, E44 w P4 (`ROZSTRZYGNIECIA_LUK.md` G-24)]*.

## 12:14 — aktualizacja
- **E41:** w nazwie transportu zamiast „●” zwykła kropka wyśrodkowana pionowo „·” (np. „SG-03 · 0005/09/S/2026”). Makieta E41 poprawiona (raport v58); tytuł sprawy oddziela „—” („SG-03 · 0005/09/S/2026 — Nowa wiadomość w czacie”). SMS nadal sam kod („·” spoza alfabetu GSM).

## 12:14 — decyzje (numeracja właściciela)
1. E41 — KSH widzi numer zlecenia HHL? **A**: nie; KSH tylko kod, bez pól z numerami, baza nie wysyła KSH żadnego numeru.
2. E41 — SCX widzi numer zlecenia HHL? **B**: tak, pole tylko do odczytu w panelu.
3. E41 — czyj numer w kolumnie „Nr zlecenia”? Wstrzymane do mapowania → rozstrzygnięte mapowaniem 12:14 (E38): „Nr zlecenia HHL-Scan” = numer SCX, „Nr zlecenia HHL-KSH” = numer HHL; stara kolumna zawierała numery SCX (10/10).
4. E41 całość — **akceptuję** (+ kropka „·”).
5. E29 — tabela pod mapą? **A**: tylko transporty w oknie śledzenia; kafelek zmienia zakres.
6. E29 całość — **akceptuję**.
7. E30 całość — **akceptuję** (układ kolumn: E38 1A — domyślnie układ pliku, 8 kolumn jako „Widok skrócony”).
8. E31 — CMR jeden czy dwa wymogi? **B**: „nie chcemy i nie będziemy wprowadzać CMR z załadunku. Ma być tylko i wyłącznie z rozładunku.”
9. E31 — paczka tygodnia na stronie Dokumenty? **A**: zostaje dla każdej firmy, tylko jej dokumenty, tydzień „t41 · 05.10–11.10”, foldery kodem.
10. E31 — kto widzi polisy? **B**: KSH tylko polisę HHL, SCX tylko swoją, HHL obie.
11. E31 całość — **akceptuję**, z doprecyzowaniem: „zezwolenie na SE wymagane jako obowiązkowe tylko w przypadku gdy zezwolenie wydawane jest per trasa. W każdym innym wypadku, czyli jeżeli wymagane jest zezwolenie per firma to podpina się automatycznie do każdego transportu i nie ma już dalszych wymagań co do zezwoleń w dokumentach.”
12. E32 — wysokość zestawu PL-1, PL-10.1, PL-17.1? **B**: 3,75 m, jak w tabeli.
13. E32 całość — **akceptuję**.
14. E33 — anulowanie 2 dni przed załadunkiem? **A**: 25 %, jak 3 dni.
15. E33 — prognoza Kratownic bez daty? **A**: stawka dla 1 auta (12 745 / 13 382 EUR); po dacie prawdziwy konwój.
16. E33 całość — **akceptuję**.
17. E34 — co po zmianie strefy? **B**: od razu sprawdzenie ostatniej pozycji transportów w oknie śledzenia, wpis „zmiana strefy”, bez SMS.
18. E34 całość — **akceptuję**.
19. E35 — SMS w kreatorze reguł? **B**: kreator wysyła SMS z zasadami E42 (cisza nocna, raz na numer, tryb testowy, limit dzienny).
20. E35 całość — **akceptuję**.
21. E37 — weryfikacja dwuetapowa? **C**: dobrowolna, jak dziś.
22. E37 — komunikat HHL do firm? **A**: tylko baner w aplikacji.
23. E37 całość — **akceptuję**.
24. E20 — **akceptuję**; „widok harmonogramu ma mieć układ tabeli z pliku excel na share point - zmapujemy.” → E38 (12:50: 1A).
25. E21 — **akceptuję**.
26. E22 — **akceptuję**.
27. E23 — kto dostaje alarm o niedziałającym źródle? **A**: Administratorzy HHL, e-mail + push przy otwarciu, przypomnienie po 2 h, „Wróciło” przy zamknięciu.
28. E23 całość — **akceptuję**.
29. E19 — hasła i plan Supabase? **A**: plan Pro + ochrona przed wyciekniętymi hasłami, min. 12 znaków z literami i cyframi. Plan zmieniony przez właściciela 12:50.
30. E19 całość — **akceptuję**.
31. E18 lista — P1 tak (konto testowe Claude usuwa właściciel po pracach), P2 tak, P3 **A** (usunąć konta „+tower-test-…” z zaproszeniami), P4 tak (zostają), P5 **A** (3 konta Administratora zostają), P6 tak, P7 tak, P8 tak, P9 **A** (SG-24 test — wyczyścić numer i tablice), P10–P16 tak, P17 tak (odwołane urządzenia zostają).
32. E18 sposób — **akceptuję** (kopia poza repozytorium, jeden skrypt, pełna brama lokalna, TEST, produkcja przy wdrożeniu, Historia zmian, raport „ile przed, ile po”).
33. E12 — co może Operacje HHL w Opcjach? **A**: ustawienia tylko do odczytu, zmienia „Dla mnie”, pobiera eksport; nie widzi Użytkowników, Logowań, Historii zmian.
34. E12 całość — **akceptuję**.
35. E10 — **akceptuję** (biała liczba w dzwonku, `--amber-ink`, test kontrastu w bramie).

## Mapowanie pliku SharePoint (słowa właściciela, 12:14)
Nagłówki: Lp. · Typ · Wysyłka · Rozmiar L x W x H · Waga elementu · Ilość elementów · Waga transport [t] · Data załadunku · Dzień (załadunek) · Przewoźnik · Godzina (załadunek) · Imię i nazwisko kierowcy · Nr tel. kierowcy · Nr rej. ciągnika · Nr rej. naczepy · Nr zlecenia HHL-Scan · Data dostawy na budowę · Dzień (rozładunek) · Godzina (rozładunek) · Nr zlecenia HHL-KSH · Komentarz.
Znaczenie: Lp. — pomijamy; Typ = Typ; Wysyłka — np. SG-03; Rozmiar, Waga elementu, Ilość elementów, Waga transport [t], Data załadunku — bez zmian; Dzień (załadunek) — dzień tygodnia słownie po angielsku; Przewoźnik — HH = HHL, NTG; Godzina (załadunek) — godzina załadunku wymagana przez KSH; kierowca, telefon, ciągnik, naczepa — bez zmian; Nr zlecenia HHL-Scan = nr zlecenia SCX; Data dostawy na budowę; Dzień (rozładunek) — po angielsku; Godzina (rozładunek) — godzina dostawy wymagana przez KSH; Nr zlecenia HHL-KSH = nr zlecenia HHL; Komentarz — pomijamy. „Różni się od tego, co zaimportowałem na potrzeby testu.”

## Do zrobienia wynikające z decyzji
- E38: mapowanie + reguły (KR-03 nie odrzucać) w ręcznym wgraniu + układ Harmonogramu — do budowy; synchronizacja po dostępie od działu IT KSH.
- E16: próg 4 % w Opcjach — wartość startowa w paczce P5 (dziś w bazie nie ma na nią miejsca).
- E18 P3 A: skrypty testów używają `TEST_USER_*_EMAIL` — w paczce P1 testy na żywo przechodzą na bazę TEST, a skrypty `scripts/auth/*` dostają blokadę adresu produkcji.
- E19: plan Pro jest; włączenie ochrony haseł i minimum 12 znaków przy wdrożeniu.
- E31: usunąć wymóg CMR z załadunku (2 h) i jego alarmy; zezwolenie SE obowiązkowe tylko „na trasę”.
- Plan dla Cursora: `docs/handover/PLAN.md` (paczki P0a–P11); po wdrożeniu każdej paczki niezależne sprawdzenie na produkcji i jeden dopisek koordynatora.
