# P3-c — Opcje i Ustawienia: porównanie z raportem audytu (Z3, Z4, Z11)

Gałąź `wyglad/P3-c` (koordynator, FRONT-KOORDYNATOR, D-20261013-1835-01 F2). Tylko wygląd i nawigacja między ekranami — bez bazy, migracji, uprawnień i zapisów (F8).
Osobny plik, bo `POROWNANIE.md` zmienia równolegle `wyglad/P3-b` (#185).

Wzorzec (Z1): `raport/img/e11-desk.webp`, `e11-phone.webp`, `e12-after.webp`, `e6-desk.webp`, `e37-after.webp`; etapy E11, E12 (w `E1-E6_E11-E14.md` i `E12.md`), E37, E6, E14; `ROZSTRZYGNIECIA_LUK.md` G-11, G-18, E12-1…E12-4, E9-4, E4b-1, E3-1; `DECYZJE_08_10.md` pkt 21–23.
Zrzuty: tryb demo, `#/?now=2026-10-08T10:32:00Z`, `docs/handover/odbior/P3/wyglad-P3-c/` (39 zrzutów + 8 porównań `porownanie-*.png`).

## Z3 — ekrany

| ekran | etap | obraz z `raport/img` | decyzje z datą | co robi ta paczka | co zostaje innej paczce (której) |
|---|---|---|---|---|---|
| Opcje — układ (komputer) | E11, E12 pkt 1 | `e11-desk`, `e12-after` (menu boczne) | 07.10 13:21: 6 grup z menu bocznym; G-11: nazwy ekranów | menu boczne 6 grup, ekran z nagłówkiem „Opcje › grupa”, „kto zmienia” po prawej, zdanie o ekranie | — |
| Opcje — telefon | E11, E12 pkt 7, E8 | `e12-after` „Telefon”, `e11-phone` | E12 (08.10) nowszy od E11 → kafelki grup | kafelki grup ze stanem → lista ekranów → ekran z „‹” | — |
| Ludzie i dostęp › Użytkownicy | E6, E37, E14 | `e6-desk` (Opcje › Użytkownicy), `e37-after` („Zaproś osobę”, „Konta i zaproszenia”) | 08.10: E37 całość akceptuję (pkt 23); E14 | 4 liczniki (0 z telefonem na czerwono), tabela według firm z „Zadzwoń”, „⋯” przy osobie (rodzaj konta E14, włącz/wyłącz, wyloguj wszędzie, Działaj jako), zaproszenie z 5 rodzajami kont, lista ze stanem | dane i zapisy — wykonawca (dopisek G2) |
| Ludzie i dostęp › Logowania | E37 | brak obrazu → wzór tabel z `e12-after` | — | tabela: kiedy, osoba, wynik, urządzenie | dane — wykonawca |
| Powiadomienia › Kto co dostaje | E11, E5, G-18 | `e11-desk`, `e11-phone` | 07.10 13:21; 09.10 R4 (G-18: wiersz zmiany dat — dzwonek stały) | 3 karty, legenda, macierz zdarzenie × 5 rodzajów × 3 kanały, podgląd wiersza, zasady; telefon: karty zdarzeń | dane i zapis — wykonawca (P3, `notification_matrix`) |
| Powiadomienia › SMS przy miejscach | E42 | — | G-11: nazwa „SMS przy miejscach” | dzisiejsza treść przeniesiona do ekranu | **P8** (E42) |
| Powiadomienia › Komunikat dla wszystkich | E37 | `e37-after` („Opcje › Komunikat HHL”) | 08.10 pkt 22 A: tylko baner w aplikacji | treść z licznikiem, „Dla”, „Widoczny do”, wysyłka „baner w aplikacji”, Podgląd/Opublikuj, historia | dane i zapis — wykonawca |
| Powiadomienia › Treści wiadomości (Szablony) | E43 | `e12-after` (pozycja menu) | G-11 | ekranu nie ma (brak treści do pokazania) | **P8** (E43) |
| Pieniądze › Cennik i opłaty | E33, E16 | — | G-11, E3-1 | dzisiejsza treść przeniesiona | **P5** (E33, E16; próg marży — E12-2) |
| Pieniądze › Dopłaty | E33 | — | — | dzisiejsza treść przeniesiona | **P5** |
| Pieniądze › Opłata paliwowa | E39, E3 | — | — | dzisiejsza treść przeniesiona | **P5** (E39) |
| Pieniądze › Faktoring | E4b | `e11-desk` (pozycja menu) | E4b-1 | dzisiejsza treść (tylko demo — na produkcji ukryta jak dziś, `shows('factoringOffer')`) | **P5** |
| Pieniądze › Terminy płatności i adresy | E40 | `e12-after` (pozycja menu) | G-11 | ekranu nie ma | **P5** (E40) |
| Zasady transportu › Progi alarmów | E12 pkt 6, E15, E23 | `e12-after` | E12-3 (cisza GPS) | lista: wartość + zdanie o skutku, „Zmień” → pole → potwierdzenie „było → jest” | dane i zapis — wykonawca; progi źródeł (E23) — **P10a** |
| Zasady transportu › Zezwolenia i dokumenty | E31 | — | — | dzisiejsza treść przeniesiona | **P5** (E31) |
| System › Stan systemu | E23, E19 | — | — | dzisiejsza treść przeniesiona | **P10a** (E23); kafelek „Bezpieczeństwo” — **P10b** |
| System › Przełączniki bezpieczeństwa | E12 pkt 3, E19 | `e12-after` | 08.10 E12 1A | tabela 13 przełączników (nazwa, stan, co robi, ostatnia zmiana), okno „Wyłączyć…? Skutek: … / Tak, zmień” | dane i zapis — wykonawca (`admin_security_flag_set` z P3) |
| System › Historia zmian | E12 pkt 4, E17, E37 | `e12-after` | E12-1: bez Operacji | filtry (od, do, kto, co), „Pokaż zmiany techniczne (n)”, wpisy zdaniem z „było → jest”, CSV/XLSX | dane — wykonawca |
| System › Eksport danych | E12 pkt 5 | `e12-after` | E12-1 | wybór (Transporty, Historia zmian, Sprawy, Faktury i finanse), zakres dat, kolumny, plik bez limitu | dane — wykonawca |
| Dla mnie › Moje konto | E37, E6, E11 | `e37-after` (menu konta: „imię, nazwisko, telefon, hasło, 2FA, urządzenia”; krok 3 „Twoje dane”) | 08.10 pkt 21 C: 2FA dobrowolna; E12-2 | karta osoby, Moje dane (telefon wymagany), Hasło, 2FA, Urządzenia | dane i zapis — wykonawca (G4 pkt 2 z D-20261013-2255-01) |
| Dla mnie › Co dostaję | E11, E37 | `e37-after` (menu konta „Dla mnie — co dostaję”) | — | lista zdarzeń z kanałami dla rodzaju konta osoby + przełączniki „na tym urządzeniu” | dane — wykonawca |
| Dla mnie › Wygląd i waluta | E11, E16 | `e11-desk` (pozycja menu) | — | dzisiejszy panel preferencji | — |
| Dla mnie › Instrukcja | E11 | `e11-desk` (pozycja menu) | — | dzisiejsza instrukcja (tylko produkcja) | „Pomoc” — **P10b** (E37 pkt 3) |
| Ustawienia (KSH, SCX) | E12 pkt 1 | `e12-after` (tabela „Dla mnie”) | — | tylko „Dla mnie” (Moje konto, Co dostaję, Wygląd i waluta, Instrukcja); na produkcji też Pieniądze › Opłata paliwowa tylko do odczytu (dzisiejsza) | Opłata paliwowa dla KSH i SCX — **P5** (E39) |

## Różnice, które zostają (Z4)

1. **Nowsza decyzja wygrywa (Z2):**
   - „Moje konto”: obraz E11 ma je w „Ludzie i dostęp”, E12-2 — w menu konta, obraz E12 — „Dla mnie › Moje dane, 2FA, urządzenia”. Jest w „Dla mnie”, a menu konta otwiera ten ekran.
   - Telefon: obraz E11 ma kafelki ekranów, nowszy E12 — kafelki grup. Są kafelki grup, a po dotknięciu lista ekranów grupy jak w E11.
   - Nazwy G-11 zamiast nazw z obrazu E12: „Cennik i opłaty”, „SMS przy miejscach”.
2. **Adnotacje audytu, nie tekst aplikacji:** oznaczenia etapów przy pozycjach menu (E6, E37, E12…), „UKŁAD ZAAKCEPTOWANY…”, „ZAZNACZENIA PRZYKŁADOWE” — dane przykładowe ma oznaczenie „DEMONSTRACYJNE”, jak w całej aplikacji.
3. **Progi alarmów:** obraz łączy pary „48 h · 12 h” i „24 h · 6 h” w jeden wiersz. Ekran ma wiersz na każdą wartość z `ops_thresholds`, bo każda zmienia się osobno (`admin_ops_threshold_set` dla jednego klucza).
4. **Kto co dostaje:** wiersze w trybie demo to zdarzenia z obrazu E11. Na produkcji wiersze są z `notification_matrix` (dziś 5 grup × 5 rodzajów kont, D-20261014-0015-01) — ich liczba zależy od bazy.
5. **Telefon, Kto co dostaje:** jak na obrazie E11 — od razu lista zdarzeń, bez kart i legendy (te są na komputerze).
6. **Ekrany bez treści do czasu swojej paczki:** Treści wiadomości (P8), Terminy płatności i adresy (P5) — nie ma ich w menu, dopóki paczka ich nie doda.
7. **Na produkcji do podłączenia danych przez wykonawcę** ekrany Użytkownicy, Logowania, Kto co dostaje, Komunikat, Progi, Historia zmian, Eksport, Moje konto pokazują dzisiejsze formularze w nowym układzie, a Przełączniki — „Brak źródła danych.” (F1). Nowy wygląd tych ekranów widać w trybie demo i po podłączeniu (dopisek G2).
8. **„Automatyzacje” (lista reguł) zniknęły z Opcji** — mają własną stronę w menu.
9. **Ocena przewoźnika** (dziś w preferencjach) zostaje w „Wygląd i waluta” do czasu Kokpitu E9 (`wyglad/P3-b`), który ją przejmuje.
10. **Motyw ciemny:** wybrane segmenty i przyciski główne są jasne na ciemnym tle — jak `.btn` w całej aplikacji.
11. **Pola daty** (`type="date"`) mają format przeglądarki.

## Sprawdzenia (lokalnie, tryb demo, `vite build` jak w `fresh-smoke.sh`)

- `npm run test:unit`: 915 ✓ (2 przypadki `pl-t` zależą od języka systemu; z `LANG=C.UTF-8` — 4 ✓).
- `npm run lint:css` ✓; `tsc -b` ✓; pierwsze wczytanie 390,2 kB gzip (budżet 400 kB; `main` 380,9 kB).
- Playwright: `e8-phone-gate` 14 ✓ — w tym nowe „wyglad/P3-c Opcje i Ustawienia” (każdy ekran HHL, KSH i SCX przy 360/390/430 px, także edycja progu i działania przy osobie: 0 w każdej kolumnie; komputer: 6 grup, 1440 i 1280 px bez przewijania w bok); `etap4-ui`, `etap6-ui`, `d-eur-t`, `persist-toast`, `etap5-ui`, `aud03` ✓.
- Migawki `tests/__screenshots__/` bez zmian (Opcje nie mają migawek). `visual.spec`: 2 różnice ~68 px w `stan-*` — te same na `main` w tym środowisku (czcionki), nie od tej zmiany.
- Build produkcyjny (`VITE_AUTH_MODE=supabase`): brak modułu `demo` i danych przykładowych w `dist/` (sprawdzone grep), `i0-prod-guard` ✓, `i2-demo-no-send` ✓.

## Niezależne sprawdzenie

Wynik osobnego agenta kontrolnego — niżej, po jego przebiegu.
