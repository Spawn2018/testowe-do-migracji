# P3-c — Opcje i Ustawienia: porównanie z raportem audytu (Z3, Z4, Z11)

Gałąź `wyglad/P3-c` (koordynator, FRONT-KOORDYNATOR, D-20261013-1835-01 F2). Tylko wygląd i nawigacja między ekranami — bez bazy, migracji, uprawnień i nowych zapisów (F8). Przeniesione formularze mają te same zapisy co na `main`. Nowe ekrany zmieniają stan tylko na ekranie (tryb demo); dane i zapisy podłącza wykonawca według dopisku D-20261014-0700-01.
Osobny plik obok `POROWNANIE.md` (P3-a, P3-b). Gałąź po rebase na `main` `cb14008` (wygląd P4-a, PR #188) — zrzuty z nowym paskiem etapów `StageBar`.

Wzorzec (Z1): `raport/img/e11-desk.webp`, `e11-phone.webp`, `e12-after.webp`, `e6-desk.webp`, `e37-after.webp`; etapy E11, E12 (w `E1-E6_E11-E14.md` i `E12.md`), E37, E6, E14; `ROZSTRZYGNIECIA_LUK.md` G-11, G-18, E12-1…E12-4, E9-4, E4b-1, E3-1; `DECYZJE_08_10.md` pkt 21–23.
Zrzuty: tryb demo, `#/?now=2026-10-08T10:32:00Z`, `docs/handover/odbior/P3/wyglad-P3-c/` (39 zrzutów + 8 porównań `porownanie-*.png`).

## Z3 — ekrany

| ekran | etap | obraz z `raport/img` | decyzje z datą | co robi ta paczka | co zostaje innej paczce (której) |
|---|---|---|---|---|---|
| Opcje — układ (komputer) | E11, E12 pkt 1 | `e11-desk`, `e12-after` (menu boczne) | 07.10 13:21: 6 grup z menu bocznym; G-11: nazwy ekranów | menu boczne 6 grup, ekran z nagłówkiem „Opcje › grupa”, „kto zmienia” po prawej, zdanie o ekranie | — |
| Opcje — telefon | E11, E12 pkt 7, E8 | `e12-after` „Telefon”, `e11-phone` | E12 (08.10) nowszy od E11 → kafelki grup | kafelki grup ze stanem → lista ekranów → ekran z „‹” | — |
| Ludzie i dostęp › Użytkownicy | E6, E37, E14 | `e6-desk` (Opcje › Użytkownicy), `e37-after` („Zaproś osobę”, „Konta i zaproszenia”) | 08.10: E37 całość akceptuję (pkt 23); E14 | 4 liczniki (0 z telefonem na czerwono), tabela według firm z „Zadzwoń”, „⋯” przy osobie (rodzaj konta E14, włącz/wyłącz, wyloguj wszędzie, Działaj jako), zaproszenie z 5 rodzajami kont, lista ze stanem | dane i zapisy — wykonawca (dopisek G2) |
| Ludzie i dostęp › Logowania | E37 | brak obrazu → wzór tabel z `e12-after` | — | tabela: kiedy, osoba, wynik, urządzenie | dane — wykonawca |
| Powiadomienia › Kto co dostaje | E11, E5, G-18 | `e11-desk`, `e11-phone` | 07.10 13:21; 09.10 R4 (G-18: wiersz zmiany dat — dzwonek stały) | 3 karty (e-maile i telefon z przełącznikiem), legenda, macierz zdarzenie × 5 rodzajów × 3 kanały, podgląd wiersza z prognozą e-maili wobec limitu 90, zasady z historią zmian; telefon: karty zdarzeń | dane i zapis — wykonawca (`notification_matrix`, dopisek J3 pkt 4) |
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
| Dla mnie › Moje konto | E37, E6, E11 | `e37-after` (menu konta: „imię, nazwisko, telefon, hasło, 2FA, urządzenia”; krok 3 „Twoje dane”) | 08.10 pkt 21 C: 2FA dobrowolna; E12-2 | karta osoby, Moje dane (telefon wymagany), Hasło, 2FA, Urządzenia (demo). Produkcja: HHL — dzisiejsze formularze (`MyAccount`, `Mfa`, `MyDevices`, jak na `main`); KSH i SCX — „Brak źródła danych.” (F8) | dane i zapis — wykonawca (G4 pkt 2 z D-20261013-2255-01; dopisek J3 pkt 1) |
| Dla mnie › Co dostaję | E11, E37 | `e37-after` (menu konta „Dla mnie — co dostaję”) | — | lista zdarzeń z kanałami dla rodzaju konta osoby + przełączniki „na tym urządzeniu” | dane — wykonawca |
| Dla mnie › Wygląd i waluta | E11, E16 | `e11-desk` (pozycja menu) | — | dzisiejszy panel preferencji | — |
| Dla mnie › Instrukcja | E11 | `e11-desk` (pozycja menu) | — | dzisiejsza instrukcja (tylko produkcja) | „Pomoc” — **P10b** (E37 pkt 3) |
| Ustawienia (KSH, SCX) | E12 pkt 1 | `e12-after` (tabela „Dla mnie”) | — | tylko „Dla mnie” (Moje konto, Co dostaję, Wygląd i waluta, Instrukcja); na telefonie przy jednej grupie od razu lista ekranów; na produkcji też Pieniądze › Opłata paliwowa tylko do odczytu (dzisiejsza) | Opłata paliwowa dla KSH i SCX — **P5** (E39) |

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
7. **Na produkcji do podłączenia danych przez wykonawcę** ekrany Użytkownicy, Logowania, Kto co dostaje, Komunikat, Progi, Historia zmian, Eksport i Moje konto (HHL) pokazują dzisiejsze formularze w nowym układzie. Przełączniki oraz Moje konto KSH i SCX pokazują „Brak źródła danych.” (F1, F8). Nowy wygląd tych ekranów widać w trybie demo i po podłączeniu (dopisek D-20261014-0700-01, J3).
8. **„Automatyzacje” (lista reguł) zniknęły z Opcji** — mają własną stronę w menu.
9. **Ocena przewoźnika** (dziś w preferencjach) zostaje w „Wygląd i waluta”. Tabela E12 przenosi ją do Kokpitu (E9), ale Kokpit z `wyglad/P3-b` jej nie ma — zostaje tu do dopisku (pytanie w dopisku do wykonawcy, G5).
10. **Motyw ciemny:** wybrane segmenty i przyciski główne są jasne na ciemnym tle — jak `.btn` w całej aplikacji.
11. **Pola daty** (`type="date"`) mają format przeglądarki.
12. **Kto co dostaje przy 1440 i 1280 px:** „Podgląd wiersza” i „Zasady” są pod macierzą, obok siebie; w prawej kolumnie dopiero od 1681 px. Obraz E11 nie ma lewego menu aplikacji, więc przy 1440 px obok macierzy (ok. 820 px) nie mieści się kolumna 300 px bez przewijania w bok.
13. **„Ten telefon / komputer”** (obraz E11, „Dla mnie”) nie jest osobnym ekranem. Przełączniki przeglądarki są w „Co dostaję › Na tym urządzeniu”, a powiadomienia na telefon w „Wygląd i waluta” (dzisiejszy panel `UiPrefsPanel` bez zmian).
14. **Historia zmian:** filtry to 4 pola z etykietami (od, do, kto, co), a nie zwarta linia „01.10 – 08.10 · Kto: wszyscy · Co: …” z obrazu E12. Na telefonie każde pole ma 44 px (E8).
15. **„Jak to działa”** (dzisiejsza pomoc B6, `OptionsHowTo`) zostaje na ekranach Kto co dostaje, SMS przy miejscach, Opłata paliwowa i Progi. Na obrazach jej nie ma; treść bez zmian.
16. **Zmiany tekstów według nowszych decyzji (Z2):** „Ustaleniach” → „czacie” (G-01b), „Centrum decyzji” → „Ryzyka” w celach kliknięć, nowy wiersz „Zmiana dat planu” z dzwonkiem, którego nie da się wyłączyć (G-18).
17. **KSH i SCX na produkcji** mają obok „Dla mnie” także „Pieniądze › Opłata paliwowa” tylko do odczytu (dzisiejsze `SefsReadOnly`, I-13). E12 pkt 1 mówi „tylko Dla mnie”, ale zabranie ekranu to zmiana dostępu — zostaje do P5 (E39).
18. **Komunikat:** nagłówek historii „Historia” (na obrazie „Historia · z bazy” — adnotacja audytu, jak w pkt 2).
19. **Przełączniki w kartach „E-maile o zdarzeniach” i „Powiadomienia na telefon”** zmieniają stan tylko na ekranie, dopóki wykonawca ich nie podłączy. Wysyłkę zmienia tylko właściciel (AGENTS §6) — dopisek J3 pkt 4.
20. **SMS przy miejscach:** przełącznik strefy jest aktywny także dla Operacji HHL, jak na `main` (baza odmawia, `geofences_write`). Wyłączenie go dla Operacji (E12 1A) to logika uprawnień — wykonawca (dopisek J3 pkt 12).

## Sprawdzenia (lokalnie po rebase na `cb14008`, tryb demo, `vite build` jak w `fresh-smoke.sh`)

Po poprawkach z niezależnego sprawdzenia, lokalnie:
- `tsc -b` ✓; `npm run lint:css` ✓; `npm run test:unit`: 949 ✓ (2 przypadki `pl-t` zależą od hunspella w systemie — w CI go nie ma; z `LANG=C.UTF-8` jedyne zgłoszenie to „elem” w `p3b_delivered_ksh` z P3-b, nie z P3-c).
- Pierwsze wczytanie: produkcja 390,2 kB gzip, demo 391,4 kB (budżet 400 kB; `main` `cb14008` 387,7 kB). Opcje i Ustawienia ładują się osobno (`src/views/optionsLazy.tsx`), bo z nimi w pierwszym wczytaniu było 399,1 kB.
- Playwright, cała brama `e8-phone-gate` (P2, P3-a, P3-b, P4-a, P3-c): 27 ✓. Blok „wyglad/P3-c Opcje i Ustawienia”: każdy ekran HHL, KSH i SCX przy 360/390/430 px, także edycja progu i działania przy osobie — 0 w każdej kolumnie; KSH i SCX na telefonie od razu lista 3 ekranów; komputer: 6 grup, 1440 i 1280 px bez przewijania w bok. Test menu konta sprawdza też, że po „Moje konto” → „Wygląd i waluta” zmiana waluty nie wraca do „Moje konto”.
- `etap4-ui`, `etap6-ui`, `d-eur-t`, `persist-toast`, `etap5-ui`, `aud03-ksh-panel`: 27 ✓.
- Migawki `tests/__screenshots__/`: `visual.yml` z `update=true` po rebase (run 38504703136, commit `61fbfd2`) i po poprawkach (wpis w `G4_WZORZEC.md` pod „wyglad/P4-a”). 15 migawek bez zmiany pikseli — migawki nie obejmują Opcji ani Ustawień, więc nic nie podmieniono. Ekrany P3-c sprawdza brama E8 i ten dowód.
- Build produkcyjny (`VITE_AUTH_MODE=supabase`): brak modułu `demo` i danych przykładowych w `dist/` (grep: osoby, domeny, „Stena Estelle 09.10”, `perDay`), `i0-prod-guard` ✓, `i2-demo-no-send` ✓.

## Niezależne sprawdzenie

Osobny agent kontrolny (bez udziału w budowie, kopia w `/tmp`, build produkcyjny i demo, `vitest`, blok P3-c bramy E8, próby w przeglądarce, porównanie `porownanie-*.png` z wycinkami `raport/img/`). Werdykt pierwszego przebiegu: „nie scalać” — 2 blokery. Co z tym zrobiłem:

| nr | waga | uwaga | co zrobione |
|---|---|---|---|
| 1 | BLOKER | Ustawienia KSH i SCX montowały `MyAccount`, `Mfa`, `MyDevices` — nowe zapisy (F8; G4 pkt 2 z D-20261013-2255-01) | produkcja: „Moje konto” w Ustawieniach = „Brak źródła danych.”; podłączenie — dopisek J3 pkt 1 |
| 4 | BLOKER | po wejściu z menu konta lub adresu każdy zapis wracał na wskazany ekran (`OptionsShell` reagował na każde odświeżenie) | wskazanie obsłużone raz (numer `seq` w `useRef`); test w bramie E8 |
| 2 | POPRAWKA | `disabled` na przełączniku strefy dla Operacji HHL — logika uprawnień | cofnięte; do wykonawcy (J3 pkt 12), „Różnice” pkt 20 |
| 5 | POPRAWKA | nowy ekran otwierał się w połowie strony (`window.scrollTo`, a przewija się `main`) | przewijanie `main` na górę (próba: nagłówek ekranu 162 px od góry okna, `main.scrollTop` = 0) |
| 6 | POPRAWKA | karty bez przełączników wł./wył. | przełączniki w kartach e-maili i telefonu; „Różnice” pkt 19 |
| 7 | POPRAWKA | brak prognozy e-maili w podglądzie i „Historia: 4 zmiany…” w „Zasadach” | prognoza (zdarzenia na dobę × konta z e-mailem, „przekroczy limit 90”) i linia historii |
| 21 | POPRAWKA | karty tabel na telefonie przesunięte w prawo (globalne `.app tr{margin:8px}`) | `margin:0 0 10px` w kartach P3-c |
| 23 | POPRAWKA | zdania w tym pliku sprzeczne z kodem (F8, Moje konto) | poprawione (wstęp, Z3, „Różnice” pkt 7) |
| 11 | UWAGA | „Ostatnia zmiana” w Przełącznikach w 2 liniach | `nowrap` |
| 12 | UWAGA | Konta i zaproszenia: podtytuł, domena, przyciski w pionie | podtytuł „14 kont · 12 aktywnych · 8 bez hasła”, domena przy koncie bez imienia, lista na całą szerokość do 1680 px (stan i przyciski w jednym rzędzie) |
| 13 | UWAGA | Komunikat: brak „próbny” | znacznik „próbny” przy wpisie; nagłówek — „Różnice” pkt 18 |
| 15 | UWAGA | lista SMS w ramce 360 px ucięta w połowie wiersza | w ekranie bez wewnętrznego przewijania |
| 19 | UWAGA | KSH i SCX na telefonie: zbędny kafelek jedynej grupy | przy jednej grupie od razu lista ekranów |
| 22 | UWAGA | etykieta „Zadzwoń” nad przyciskami karty | bez etykiety w kolumnie działań |
| 8, 9, 10, 14, 16, 18 | UWAGA | różnice bez wpisu | „Różnice” pkt 12–17 |
| 24 | UWAGA | zdanie o migawkach wprowadzało w błąd | przeredagowane (migawki bez zmiany pikseli) |
| 25 | UWAGA | brak dopisku z listą podłączeń | `docs/handover/dopiski/D-20261014-0700-01.md` |
| 27 | UWAGA | testy `*.local.spec.ts` nie znają menu bocznego | lista w dopisku J5 (środowisko wykonawcy) |

Bez zastrzeżeń w przeglądzie: brak migracji i zmian w `supabase/`; nowy kod w `src/components/options/` bez `.rpc` i `from(`; przeniesione formularze z tymi samymi zapisami; Operacje HHL widzą ten sam zestaw formularzy co na `cb14008`; build produkcyjny bez danych przykładowych; menu 6 grup i nazwy G-11; telefon bez przewijania w bok.
