# wyglad/W-konta — Operacje HHL i Użytkownik SCX w demo; Pomoc i SMS przy miejscach bez fałszywych napisów i przycisków — 17.10.2026

Podstawa: audyt 17.10, §7 „Co nie zostało sprawdzone”: role „HHL Operacje” i „SCX Użytkownik” w demo nie istnieją w przełączniku — sprawdzone tylko z kodu uprawnień. Także raport F7 do #282: widok „tylko do odczytu” Kalibracji ETA dało się sprawdzić tylko testem, nie na ekranie.

Dopisek: D-20261017-1220-01. Tylko demo i obliczenia widoku (F8); produkcja bez zmian — rodzaj konta dalej z profilu.

| Miejsce | Było | Jest |
|---|---|---|
| Menu konta (demo) | „Konto pokazowe · HHL · Administrator”, bez wyboru rodzaju konta | „Rodzaj konta (demo)”: **Administrator / Operacje** (HHL), **Dyspozytor / Użytkownik** (SCX); KSH ma jeden rodzaj — bez przełącznika |
| Kokpit HHL · Operacje | nie do obejrzenia | nagłówek „H&H Logistics · Operacje”, „Do zrobienia” tylko sprawy HHL (10 zamiast 23), ta sama liczba w menu |
| Opcje | Operacje tylko z kodu | „Tylko podgląd · zmienia Administrator HHL” na ekranach Administratora, Kalibracja ETA bez „Zatwierdź nowe czasy” |
| Panel transportu | — | Operacje HHL bez „Zmień status” i bez „Popraw awizację” (E9) |
| Strefy, Automatyzacje, Rejsy | — | Operacje HHL oglądają bez zmian (jak dotąd w kodzie, teraz widać w demo) |
| Adres | — | `#/…?konto=operacje` albo `?konto=uzytkownik` — od razu wybrany rodzaj (testy, zrzuty) |
| Opcje › SMS przy miejscach na produkcji, do czasu P8 (audyt 03 N7) | Operacje HHL widzą „Zapisz”, przełączniki i „Wyślij SMS testowy”; wybór „PL / SE” wygląda jak język | Operacje HHL: napis „Tylko podgląd · zmienia Administrator HHL”, pola tylko do odczytu, bez przycisków; wybór „+48 PL / +46 SE” z opisem „Numer kierunkowy” |
| Stare formularze Opcji na produkcji u Operacji HHL, do czasu P3-d (audyt 07 N2) | Progi, Postój, Cennik, Opłata paliwowa, Bramka SMS, Komunikat, Wymóg zezwoleń — Operacje widzą aktywne pola i „Zapisz” (baza i tak odmawia) | pola nieaktywne (`fieldset disabled`), przyciski zmian ukryte; nagłówek ekranu „Tylko podgląd · zmienia Administrator HHL” jak dotąd |
| Pomoc › Kontakt i „Co nowego” na produkcji (audyt 06 N11) | „Brak konta Operacji HHL z telefonem.”, „Brak zmian do pokazania.” — nieprawda, bo dane nie są jeszcze podłączone | „Kontakt do Operacji HHL pojawi się tutaj po włączeniu danych.”, „Lista zmian pojawi się tutaj po włączeniu danych.”; po podłączeniu pusta lista dalej mówi „Brak konta…” |

Jak działa:
- `src/lib/accountRole.ts` — jedno miejsce, w którym ekrany czytają rodzaj konta: produkcja — `getAuthProfile()?.role` (bez zmian); demo — `null` (konto domyślne firmy, jak dotąd) albo wybrany drugi rodzaj, tylko w tej samej firmie (w Podglądzie KSH Operacje HHL nie mają znaczenia).
- 13 miejsc zamiast `getAuthProfile()?.role`: Kokpit, Ryzyka, menu, Pomoc, panel transportu, okno „Zmień status”, Do zrobienia, Opcje, Ustawienia, Strefy, Automatyzacje, Rejsy (demo), awizacja (P7).
- Wybór zapisuje się w karcie przeglądarki (sessionStorage, z obsługą trybu prywatnego); zmiana przeładowuje stronę, bo prawa konta każdy ekran czyta przy rysowaniu.

Obrazy (`now=2026-09-23T14:32Z`):
- `po-menu-admin`, `po-menu-ops` — menu konta z przełącznikiem;
- `po-kokpit-ops` — Kokpit Operacji HHL;
- `po-opcje-calib-ops` — Kalibracja ETA u Operacji: bez przycisku, napis „Tylko podgląd”;
- `po-panel-ops` — panel T-17 u Operacji: bez „Zmień status”.

**Testy:**
- `tests/w-konta.test.ts` (8) — domyślnie bez zmian; Operacje tylko w HHL; Użytkownik tylko w SCX; prawa (status, awizacja, decyzje); przełącznik tylko poza produkcją; ekrany czytają `accountRole(role)`;
- e2e `e8-phone-gate` — „W-konta”: przełącznik w menu, Operacje — Kalibracja i Progi tylko do odczytu, KSH bez przełącznika, powrót do Administratora; Użytkownik SCX z adresu;
- zmienione pod nowe wywołanie: `audyt-af`, `l8-cockpit-tiles`, `p7-awiz`;
- build produkcyjny: bez kodu przełącznika i klucza `wt-demo-account` (jest tylko tekst słownika).
