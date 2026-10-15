# Odbiór P5-b — wygląd Opcje › Pieniądze (koordynator, `wyglad/P5-b`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
Zakres: D-20261015-0300-01 D, „Ekrany — wygląd” P5 — Opcje › Opłata paliwowa (`img/e3-opcje-desk`, `img/e3-opcje-phone`), Opcje › Dopłaty (E33), pole „Próg marży (%)” (E16), Opcje › „Terminy płatności i adresy” (E40, `img/e40-after`, E12). Kokpit „Marża”, linia faktury „Opłata paliwowa t41 · ×1,13” i panel Ceny — następny PR (`wyglad/P5-c`).

Ten PR zmienia tylko wygląd, teksty i nawigację (F8). Nie zmienia migracji, zapytań, uprawnień ani zapisów. Nowe dane biorą się z `src/lib/p5bSource.ts`:
- w demo przykłady są w `src/lib/p5bDemo.ts`, wywoływane tylko przy warunku trybu demo wpisanym wprost (strażnik I-0, test `tests/p5b-money.test.ts`);
- w produkcji każda funkcja zwraca `null`, dopóki wykonawca jej nie podłączy. Do tego czasu zostaje dzisiejszy formularz (Opłata paliwowa — `BafForm`, Dopłaty — `DwellOptionsForm`), a nowych sekcji nie ma (procenty za anulowanie, próg marży, Terminy płatności i adresy).

Co podłącza wykonawca — dopisek D-20261015-1805-01 (`docs/handover/dopiski/`, w tym PR).

Zrzuty z podglądu demo, „teraz” = 14.10.2026, 12:00 czasu polskiego, folder `zrzuty/`; obrazy porównawcze `porownanie-*.png` (lewa strona — raport, prawa — aplikacja). Adresy e-mail zmyślone (G-09).

## Z3 — element po elemencie

### Opłata paliwowa (E3, E39) — `porownanie-e3-komputer.png`, `porownanie-e3-telefon.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| tytuł | „Opłata paliwowa (SEFS)” | „Opłata paliwowa” | tak | E39 (nowsza): jedna nazwa, bez „SEFS” |
| wersja umowy | „Załącznik 1 do umowy · wersja 3 od 28.09.2026”, „UZGODNIONE Z PRZEWOŹNIKIEM” | to samo, pod tytułem ekranu Opcji | tak | tytuł ekranu, okruszki i „Zmienia tylko Administrator HHL” — wspólny nagłówek ekranów Opcji (P3-c) |
| alarm braku ceny | czerwony: „Brak ceny Orlen z …”, godzina próby, cena opublikowana, wpływ na tydzień, „Uzupełnij z Orlen”, „Następna automatyczna próba: dziś 13:15” | to samo | tak | daty demo przesunięte do tygodnia 14.10 (brak z 13.10 wpływa na 19–25.10); na telefonie tytuł alarmu w osobnym wierszu jak na obrazie |
| ten tydzień | zielona karta: „+13 % ×1,13”, „Ostateczny · z cen …”, „Dotyczy załadunków od pon. … do niedz. …, koszt i przychód.” | to samo | tak | — |
| przyszły tydzień | „+13 % prognoza”, „Ostateczna wartość w poniedziałek … rano, ze średniej …” | to samo | tak | — |
| pobieranie cen | „codziennie 07:15”, dziś / wczoraj ze znakami ✓ ✕, ponowienia 09:15 i 13:15 | to samo | tak | — |
| jak liczymy | 4 kroki: średnia, mnożnik, niższy, opłata (6 900 EUR × 13 % = 897 EUR) | to samo; telefon 2 × 2 | tak | — |
| ceny 2 tygodni | grupy tygodni, „liczy przyszły tydzień”, „średnia … → ×1,13”, wiersz braku na czerwono, „publ. …”, kolumna „Pobrane” | to samo; na telefonie bez kolumny „Pobrane” i dalej tabela (nie karty) | tak | obraz telefonu pokazuje tabelę — reguła E8 „tabela → karty” wyłączona tylko dla tego ekranu (`money.css`); E12: „Opłata paliwowa (E39) … już zaprojektowana” |
| tabela mnożników | 5 wierszy wokół ceny, trafiony na zielono i pogrubiony z „◀ 22,63”, osobno OKQ8 i Orlen | to samo; „Pokaż całą tabelę” pokazuje wszystkie wiersze (demo 23 i 33) | tak | wiersz trafiony liczony jak mnożnik w bazie (`lookupMult`): średnia do grosza, poza tabelą — skrajny wiersz |
| przyciski | „Pokaż całą tabelę”, „Nowa wersja umowy” | to samo | tak | „Nowa wersja umowy” i „Uzupełnij z Orlen” — tylko Administrator HHL; Operacje HHL bez przycisków (E12 pkt 1 A) |
| źródła | „Źródła: OKQ8 GoEasy Diesel, cena listowa firmowa · Orlen ONEkodiesel, hurt, netto. Ceny bez VAT, tak jak publikuje źródło.” | to samo | tak | — |
| szerokość | dwie kolumny (ceny | mnożniki) przy panelu ok. 1500 px | dwie kolumny od 1680 px okna; przy 1440 px jedna pod drugą | częściowo | przy 1440 px panel Opcji ma ok. 950 px — dwie kolumny nie mieszczą liczb bez łamania |

### Dopłaty — postój (E33, E12) — `zrzuty/opcje-1440-surch.png`, `zrzuty/opcje-1440-surch-pytanie.png`

Makiety ekranu nie ma (E12: „Pieniądze › Dopłaty — Czas wolny i przestój — E33, bez »WSTĘPNE«, wybory przyciskami”). Treść z E33 („Zasady z cennika”) i decyzji 07.10 12:35.

| element | decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| wartości | czas wolny 6 h / 4 h, 75 EUR za rozpoczętą godzinę, powyżej 24 h 750 EUR za rozpoczętą dobę | 5 wierszy z wartością i zdaniem o skutku, „Zmień” | tak | bez „(WSTĘPNE)” i bez kodów |
| wybory | „od późniejszego z: wjazd do strefy, plan”; „każda rozpoczęta godzina” (dziś „1 = cała godzina, 2 = ułamek”) | przyciski w dwóch rzędach | tak | — |
| zmiana | „Zmiana z potwierdzeniem i wpisem w historii” (E12) | „Zmień” → pole → „Zapisz” → „Zmienić: … było → jest?” → „Tak, zmień”; przy wyborach to samo pytanie | tak | wzór: Progi alarmów (P3-c) |
| przykład | postój 8 h 10 min, czas wolny 6 h → 3 rozpoczęte godziny × 75 EUR = 225,00 EUR (E33, okno „Dopłata”) | „Przykład: postój 8 h 10 min na załadunku → 225,00 EUR, tyle samo po stronie kosztu i przychodu.” — liczony z bieżących wartości | tak | — |
| zasada dopłat | 09.10 13:09: system podpowiada, nic nie wchodzi samo | zdanie pod przykładem | tak | — |
| ostatnia zmiana | Historia zmian (E12) | „Ostatnia zmiana: 07.10, 12:35 · Administrator HHL” | tak | z bazy — wykonawca |

### Cennik i opłaty — procenty za anulowanie (E33) i próg marży (E16)

| element | decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| miejsce | E12: „Pieniądze › Cennik — E33 (wersje, procenty anulowania)”; E16: „Próg marży w Opcjach › Cennik i opłaty” | dwie sekcje nad cennikiem przewoźnika i KSH | tak | — |
| procenty | ≥ 5 dni 0, 4 dni 15, 3 dni 25, 2 dni 25, 1 dzień 50, dzień załadunku 100; ten sam procent dla kosztu i przychodu | 6 wierszy z „Zmień”; przy każdym kwoty „koszt / przychód” dla frachtu z cennika (demo SG: 15 % → 1 035,00 / 1 086,75 EUR — jak w oknie E33) | tak | 2 dni = 25 % (pytanie 1, 08.10 12:14, wariant A); fracht przykładu podaje źródło danych (`example`), bez niego kwot nie ma |
| próg marży | jeden próg, tylko Administrator HHL, bez progu flaga wyłączona | wiersz „Próg marży”, pole może być puste („nie ustawiony”) | tak | odczyt i zapis razem (`marginSettingOf`) — „niepodłączone” ≠ „nie ustawione” |

### Terminy płatności i adresy (E40, E12) — `porownanie-e40-adresy.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| adresy | dwie listy jedna pod drugą: „Księgowość KSH (faktury przychodowe HHL)”, „Księgowość HHL (faktury kosztowe SCX)”, przy adresie „usuń” | to samo | tak | — |
| przyciski | „+ Dodaj adres”, „Wyślij próbny e-mail na ten adres” | to samo; dodawanie: wybór listy, pole, „Dodaj” (zły adres i powtórka bez względu na wielkość liter — komunikat); próbny e-mail: wybór adresu, „Wyślij”; „usuń” z pytaniem „Usunąć adres … z listy …?” (E12: zmiana z potwierdzeniem) | tak | gdy wysyłka poza HHL jest wyłączona przełącznikiem, ekran mówi to wprost (nie „spróbuj ponownie”) |
| dopisek | „Zmiana adresu trafia do Historii zmian. Pusta lista = przycisk »Wyślij« niedostępny …” | to samo | tak | pusta lista: „Brak adresu — wysyłka paczki tygodnia niedostępna.” |
| terminy płatności | E12 „terminy”; 03_REJESTR: 30 dni (KSH → HHL), 35 dni (SCX → HHL) od daty wystawienia | 2 wiersze z „Zmień” | tak | makiety terminów nie ma — wzór wierszy z Progów |
| nazwa w menu | E12 „Pieniądze › Terminy płatności i adresy” | to samo | tak | — |

### Teksty (E39 — jedna nazwa)

Polskie teksty: „Dodatek paliwowy”, „Mnożnik paliwowy”, „BAF / SEFS”, „SEFS” → „Opłata paliwowa” (`d19Extra.ts`, `decisions.ts`, `etap4.ts`, `i2.ts`, `ui6.ts`, `messages.ts`). Test: żaden polski tekst słownika nie zawiera „SEFS”, „BAF”, „dodatek/dopłata paliwowa”, „mnożnik paliwowy” (`tests/p5b-money.test.ts`). Teksty angielskie i szwedzkie bez zmian (E43: interfejs tylko po polsku).

## Z4 — role

| konto | co widzi | sprawdzenie |
|---|---|---|
| Administrator HHL | 4 ekrany, wszystkie „Zmień”, „Uzupełnij z Orlen”, „Nowa wersja umowy”, dodawanie i usuwanie adresów, próbny e-mail | podgląd demo, przebieg zmian w przeglądarce (narzędzie koordynatora poza repozytorium): pytanie „było → jest”, zapis, zły adres, powtórka, usunięcie z pytaniem, strzałki w wyborze |
| Operacje HHL | te same ekrany tylko do odczytu (E12 pkt 1 A): bez „Zmień”, wybory nieaktywne, bez „Uzupełnij”, „Nowa wersja umowy”, adresów i próbnego e-maila | test `tests/p5b-money.test.ts` (`readOnly`) |
| KSH, SCX | ekranów Pieniądze nie ma w menu (komputer i telefon) | podgląd demo „Widok KSH” / „Widok SCX” — 0 ekranów |

## Z10 — telefon i szerokości

- 360 px, 390 px, 768 px: 0 px przewijania strony w poziomie na 4 ekranach; przyciski ≥ 44 px; pola ≥ 16 px (pomiar w przeglądarce, narzędzie koordynatora).
- 1440 px i 1920 px: bez przewijania w poziomie.

## Z11 — dostępność

axe (wcag2a, wcag2aa), 4 ekrany, motyw jasny i ciemny: 0 błędów w nowych elementach. Komunikaty po zapisie w stałym obszarze `role="status"`; wybory przyciskami jako grupa z obsługą strzałek; po „Zapisz” fokus na „Tak, zmień”; błędny adres z `aria-invalid`. Jedyny wynik — `.panel-mark` („DEMONSTRACYJNE”, 4,22 : 1) — znacznik demo istniejący przed tym PR, tylko w wersji pokazowej (w produkcji go nie ma). Poprawione w trakcie: tekst drugorzędny na czerwonym tle alarmu i w wierszu braku ceny oraz nagłówek zielonej karty w motywie ciemnym (4,31–4,34 → ≥ 4,5).

## Testy

- `tests/p5b-money.test.ts` — 25 testów: czyste funkcje (procent, opłata, wiersz tabeli jak `lookupMult`, „wokół obecnych cen”), przykład demo zgodny z raportem, HTML 4 ekranów (Administrator i tylko odczyt), cennik bez przykładu (nic na stałe), E39 w słowniku głównym i w słownikach `decisions`, `p5`, `p5b`, bez „WSTĘPNE” przy postoju, I-0 na dwa sposoby (warunek wpisany wprost i moduł wczytany z `VITE_AUTH_MODE=supabase` — 11 funkcji zwraca `null`), podłączenie w `OptionsView`.
- Cały zestaw (po rebase na `main` z #218): 141 plików, 1115 testów zielonych; `tsc -p tsconfig.app.json`, `lint:css`, `oxlint` bez nowych uwag.

## Niezależne sprawdzenie (F7)

Osobny agent (nie budował tego wyglądu) przejrzał zmiany 15.10, ok. 17:55: F8 i I-0 bez naruszeń, wygląd zgodny z raportem; 12 uwag. Poprawione w tym PR: przykład kwot anulowania z danych (nie na stałe), dopisek dla wykonawcy, błędy zapisu (bez zawieszonego przycisku, jedna zmiana naraz, wpisany adres zostaje po błędzie), godzina „Ostatnia zmiana” w czasie polskim, próg marży — odczyt i zapis razem, pogrubiony wiersz trafiony i wiersz liczony jak w bazie, teksty bez kodów etapów i godzin decyzji, „WSTĘPNE” i „computeSefs” usunięte, zdanie „bez parametrów … opłaty nie ma” przywrócone, dostępność (komunikaty, strzałki, fokus, `aria-invalid`), oznaczenie `data-deur-exempt="fuel-index"`, adresy (wielkość liter, usunięcie z pytaniem), testy (I-0 z wczytaniem modułu, słowniki osobne, tylko odczyt cennika). Bez zmian: testy klikania w Vitest (środowisko `node` bez DOM) — przebieg sprawdzony w przeglądarce (Z4).
- Migawki Playwright (15): ekrany Opcji › Pieniądze nie są w migawkach — bez odświeżania.
