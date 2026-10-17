# wyglad/W-konta — Operacje HHL i Użytkownik SCX w demo; Pomoc i SMS przy miejscach bez fałszywych napisów i przycisków — 17.10.2026

Podstawa: audyt 17.10, §7 „Co nie zostało sprawdzone”: role „HHL Operacje” i „SCX Użytkownik” w demo nie istnieją w przełączniku — sprawdzone tylko z kodu uprawnień. Także raport F7 do #282: widok „tylko do odczytu” Kalibracji ETA dało się sprawdzić tylko testem, nie na ekranie.

Dopisek: D-20261017-1220-01 (z uzupełnieniem po F7, 13:05). Wygląd, teksty i obliczenia widoku (F8). Na produkcji zmieniają się tylko: Pomoc (Kontakt, „Co nowego”), SMS przy miejscach i stare formularze Opcji u Operacji HHL. Skąd bierze się rodzaj konta — na produkcji bez zmian (z profilu).

| Miejsce | Było | Jest |
|---|---|---|
| Menu konta (demo) | „Konto pokazowe · HHL · Administrator”, bez wyboru rodzaju konta | „Rodzaj konta (demo)”: **Administrator / Operacje** (HHL), **Dyspozytor / Użytkownik** (SCX); KSH ma jeden rodzaj — bez przełącznika |
| Kokpit HHL · Operacje | nie do obejrzenia | nagłówek „H&H Logistics · Operacje”, „Do zrobienia” tylko sprawy HHL (10 zamiast 23), ta sama liczba w menu |
| Opcje | Operacje tylko z kodu | „Tylko podgląd · zmienia Administrator HHL” na ekranach Administratora, Kalibracja ETA bez „Zatwierdź nowe czasy” |
| Panel transportu | — | Operacje HHL bez „Zmień status” i bez „Popraw awizację” (E9) |
| Strefy, Automatyzacje, Rejsy | — | Operacje HHL oglądają bez zmian (jak dotąd w kodzie, teraz widać w demo) |
| Adres | — | `#/…?konto=operacje` albo `?konto=uzytkownik` — od razu wybrany rodzaj (testy, zrzuty) |
| Opcje › SMS przy miejscach na produkcji, do czasu P8 (audyt 03 N7) | Operacje HHL widzą „Zapisz”, przełączniki i „Wyślij SMS testowy”; wybór „PL / SE” wygląda jak język | Operacje HHL: napis „Tylko podgląd · zmienia Administrator HHL”, pola tylko do odczytu, bez przycisków; wybór „PL +48 / SE +46 (jak w ekranie P8)” z opisem „Numer kierunkowy” |
| Stare formularze Opcji na produkcji u Operacji HHL, do czasu P3-d (audyt 07 N2) | Progi, Postój, Opłata paliwowa, Bramka SMS, Komunikat, Wymóg zezwoleń — Operacje widzą aktywne pola i „Zapisz” (baza i tak odmawia) | pola nieaktywne (`fieldset disabled`), przyciski zmian ukryte; nagłówek ekranu „Tylko podgląd · zmienia Administrator HHL” jak dotąd |
| Cennik (Koszt i Przychód) na produkcji u Operacji HHL (F7) | jak wyżej — aktywne pola i „Zapisz” | **„Strona” i „Firma” do przełączania** — każdą kartę stawek można obejrzeć; „Od kiedy”, wiersze stawek i „Powód” nieaktywne; bez „Dodaj wiersz”, „Usuń” i „Zapisz”; napis „Tylko podgląd · zmienia Administrator HHL” |
| „Moje konto” w demo u Użytkownika SCX (F7) | „Anna Wiśniewska · Scandinavian Express · Użytkownik” — to Administrator HHL | „Tomasz Wrona” — osoba z rodzajem konta Użytkownik SCX (dane wymyślone, G-09); też na liście Użytkowników |
| Opcje › SMS przy miejscach (ekran P8, demo) | „Operacje HHL: podgląd (E9)” — z kodem etapu, widoczne też dla Operacji obok „Tylko podgląd” | Administrator: „Operacje HHL: tylko podgląd”; Operacje: tylko „Tylko podgląd · zmienia Administrator HHL” |
| Pomoc › Kontakt i „Co nowego” na produkcji (audyt 06 N11) | „Brak konta Operacji HHL z telefonem.”, „Brak zmian do pokazania.” — nieprawda, bo dane nie są jeszcze podłączone | „Kontakt do Operacji HHL pojawi się tutaj po włączeniu danych.”, „Lista zmian pojawi się tutaj po włączeniu danych.”; po podłączeniu pusta lista dalej mówi „Brak konta…” |

Jak działa:
- `src/lib/accountRole.ts` — jedno miejsce, w którym ekrany czytają rodzaj konta: produkcja — `getAuthProfile()?.role` (bez zmian); demo — `null` (konto domyślne firmy, jak dotąd) albo wybrany drugi rodzaj, tylko w tej samej firmie (w Podglądzie KSH Operacje HHL nie mają znaczenia).
- 14 wywołań `getAuthProfile()?.role` w 13 plikach zamienionych na `accountRole(role)`: Kokpit, Ryzyka, menu, Pomoc, panel transportu, okno „Zmień status” (2), Do zrobienia, Opcje, Ustawienia, Strefy, Automatyzacje, Rejsy (demo), awizacja (P7). Menu konta też czyta przez `accountRole` — razem 15 wywołań w 14 plikach.
- Wybór zapisuje się w karcie przeglądarki (sessionStorage) **i w adresie** (`konto=operacje` / `konto=uzytkownik`; konto domyślne usuwa parametr) — `konto=` z adresu nie nadpisuje już wyboru z menu, a w trybie prywatnym wybór działa po przeładowaniu (F7). Zmiana przeładowuje stronę, bo prawa konta każdy ekran czyta przy rysowaniu. Wybór z adresu zostaje w karcie po przejściu na ekran bez `konto=`.
- Wybór jest jeden dla wszystkich firm: Użytkownik w SCX oznacza konto domyślne (Administrator) w HHL i odwrotnie. Do oglądania jednej firmy naraz wystarcza.
- Automatyzacje › „Działa samo” — wbudowane automaty są tylko do odczytu dla wszystkich (zmiany na ekranach ustawień), dlatego bez osobnego napisu „Tylko podgląd”; napis jest w „Własnych regułach”.

Obrazy (`now=2026-09-23T14:32Z`):
- `po-menu-admin`, `po-menu-ops` — menu konta z przełącznikiem;
- `po-kokpit-ops` — Kokpit Operacji HHL;
- `po-opcje-calib-ops` — Kalibracja ETA u Operacji: bez przycisku, napis „Tylko podgląd”;
- `po-panel-ops` — panel T-17 u Operacji: bez „Zmień status”.

**Testy:**
- `tests/w-konta.test.ts` (12) — domyślnie bez zmian; Operacje tylko w HHL; Użytkownik tylko w SCX; prawa (status, awizacja, decyzje); przełącznik tylko poza produkcją; ekrany czytają `accountRole(role)`; Cennik u Operacji (Strona i Firma aktywne); wybór w adresie; „Moje konto” Użytkownika SCX;
- e2e `e8-phone-gate` — „W-konta”: przełącznik w menu, Operacje — Kalibracja i Progi tylko do odczytu, KSH bez przełącznika, powrót do Administratora; Użytkownik SCX z adresu;
- zmienione pod nowe wywołanie: `audyt-af`, `l8-cockpit-tiles`, `p7-awiz`;
- build produkcyjny: bez kodu przełącznika i klucza `wt-demo-account` (jest tylko tekst słownika).
