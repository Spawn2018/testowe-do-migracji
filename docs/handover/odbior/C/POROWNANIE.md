# wyglad/C-dzwonek — dzwonek E5, „Dla mnie › Ten telefon / komputer”, kontrast liczby (E10)

Część wyglądu do pozycji „Poprawki P2–P3 (audyt 15.10)” (D-20261015-0300-01, sekcja G i C1–C2; D-20261015-0330-01). Punkt kontrolny: piątek 16.10, 20:00.

Źródła: artefakt „Audyt Watch Tower” — E5 (img/e5-desk, img/e5-phone; decyzje 07.10 12:52 i 13:21), E11 (img/e11-desk: menu „Dla mnie” z pozycją „Ten telefon / komputer”, grupy „Do zrobienia · wymaga działania”, „Transport”, „Ryzyka”, „Sytuacja ogólna: tylko strona Ryzyka”), E10 (zaakceptowane 08.10: biała liczba w dzwonku), E41 (nazwa transportu według firmy), E17 (zakładka „Czat” zamiast „Ustalenia” — nowsza od makiety E5).

## 1. Dzwonek (E5)

| Makieta | Jest |
|---|---|
| Nagłówek „Powiadomienia” i łącze „Oznacz wszystkie jako przeczytane” | tak |
| Grupa „DO ZROBIENIA” z liczbą: decyzje, braki, wiadomości z czatu, faktury, numery zleceń | tak — `bellSection()` w `src/lib/bellList.ts` (te same rodzaje co w E11 „Do zrobienia · wymaga działania” i „Pieniądze”) |
| Grupa „MOJE TRANSPORTY” z liczbą: strefy, statusy, ryzyka przed pojazdem, zgrupowane na transport | tak — grupowanie bez zmian (transport + rodzaj zdarzenia = jedna pozycja z licznikiem) |
| Sytuacja ogólna (promy, drogi, pogoda bez transportu) poza dzwonkiem, zdanie pod listą z łączem „Ryzyka” | tak — wpis bez transportu nie wchodzi do listy ani do liczby; zdanie z liczbą wpisów z ostatniej doby, gdy są |
| Pasek po lewej: czerwony / bursztynowy według wagi w „Do zrobienia”, niebieski w „Moje transporty” | tak |
| Kropka przed tytułem pozycji „Do zrobienia” | tak |
| Miejsce po prawej „DECYZJA ›”, „DOKUMENTY ›”, „USTALENIA ›”, „TRANSPORT ›” | tak — z celu kliknięcia L-4 (`bellPlace()`); „USTALENIA” → „CZAT” (E17, decyzja 07.10 20:57) |
| Druga linia „Do zrobienia”: nazwa transportu · szczegół | tak — nazwa według firmy (E41) |
| „Moje transporty”: „nazwa · co się stało”, druga linia „07.10, 08:36 · szczegół” | tak — „nazwa — co się stało” (E41 P2: pauza oddziela nazwę zawierającą „·”), data i godzina w formacie E21 |
| Przycisk „☎ Dyspozytor SCX” przy decyzji | **nie w tej paczce** — potrzebna osoba prowadząca sprawę z telefonem (P6 „Biorę / Oddaj / Przejmij”, E6); dołożę po podłączeniu danych |
| Telefon: lista na całą szerokość pod paskiem, przewijana w środku (E13) | bez zmian — test `e8-phone-gate` E13 zielony |

Liczba przy dzwonku = liczba pozycji w obu grupach (bez sytuacji ogólnej). Liczba „Do zrobienia” z kolejki spraw (D-20261014-0215-01 H3) — przy P6.

Obrazy: `porownanie-dzwonek-komputer.png` (makieta, jasny, ciemny), `porownanie-dzwonek-telefon.png` (makieta, HHL 390, SCX 390), `telefon-i-ksh.png`.

## 2. Dla mnie › Ten telefon / komputer (E5 prawa część, E11 menu)

| Makieta | Jest |
|---|---|
| Pozycja „Ten telefon / komputer” w „Dla mnie” po „Wygląd i waluta” | tak — w Opcjach HHL i w Ustawieniach KSH/SCX |
| „Powiadomienia na telefonie”, iPhone 1–4 „tylko z aplikacji na ekranie początkowym”, Android 1 | tak — krok 4 i Android wskazują nowe miejsce („Dla mnie → Ten telefon / komputer → Włącz powiadomienia”) zamiast „Opcje → Preferencje” |
| Na telefon trafia tylko pilna sprawa „Do zrobienia” (E5 „Telefon tylko pilne”) | tak — zdanie na górze ekranu |
| „Włącz powiadomienia” na iPhonie aktywny tylko w aplikacji z ekranu początkowego | tak — ta sama logika co dotąd w „Wygląd i waluta” (przeniesiona, bez nowych zapytań); przełącznik zniknął z „Wygląd i waluta” |
| „Twoje urządzenia”: „Android · Chrome · od 05.10”, „aktywne”, „Wyślij powiadomienie testowe”, „Usuń urządzenie” | tak — dane z `src/lib/pushDeviceSource.ts`: demo przykład; **produkcja `null` — sekcja ukryta**, listę z `push_subscriptions`, powiadomienie testowe i usunięcie podłącza wykonawca w C2 |

Obrazy: `porownanie-ten-telefon-komputer.png`, `telefon-i-ksh.png`.

## 3. Kontrast liczby (E10)

Token `--alarm:#B32639` w obu motywach: biała liczba w dzwonku i na dolnym pasku telefonu 6,46 : 1 (było w ciemnym 3,13 : 1 — `#FFFFFF` na `#E8687C`). Liczba w lewym menu (komputer) bez zmian: `#E8687C` na `#3B1720`, ok. 5 : 1.

## Sprawdzenie (lokalnie, build demo)

- axe `wcag2a/aa`: otwarty dzwonek i pasek górny — 1440 i 390 px, jasny i ciemny: 0 naruszeń; ekran „Ten telefon / komputer” — 0 naruszeń; na 390 px wszystkie przyciski ≥ 44 px.
- Brak przewijania strony w bok: ekran „Ten telefon / komputer” 1440 i 390 px (HHL, SCX).
- Testy jednostkowe 1066 / 1066 (nowy `tests/e5-bell.test.ts` 9/9); Playwright `e2e-core` i `e8-phone-gate` (w tym E13 i ekrany Opcji/Ustawień) zielone; `tests/e8-phone-gate.spec.ts` — lista ekranów „Dla mnie” uzupełniona o „Ten telefon / komputer”.
- Tylko wygląd (F8): bez zmian w bazie, uprawnieniach i zapisach; jedyne wywołania to dotychczasowe `enableWebPush` / `disableWebPush`, ładowane tylko w buildzie produkcyjnym (strażnik I-2).
