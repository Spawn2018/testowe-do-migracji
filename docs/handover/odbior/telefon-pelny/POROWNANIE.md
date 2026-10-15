# wyglad/telefon-pelny — pełne numery telefonów (decyzja właściciela 15.10.2026, 03:12)

Podstawa: „Tak samo muszą być wszędzie widoczne numery telefonów (bez ukrywania ich za gwiazdkami)” — dopisek D-20261015-0330-01 pkt 1; artefakt „Audyt Watch Tower”, „Zmiany 15.10” i ramka „Zmiana 15.10” przy E37.

| Miejsce | Było | Jest |
|---|---|---|
| Menu konta (pasek górny, E37) | „tel. +48 ••• ••• 123” | „tel. +48 000 000 123” — pełny numer w grupach po 3 cyfry |
| Opcje › Bramka SMS › numery testowe | „Etykieta · …123” | „Etykieta · +48 000 000 123” |
| Opcje › Bramka SMS › kolejka SMS | „… · …123” | „… · +48 000 000 123” |

Przeszukane miejsca z telefonem (kierowcy, piloci, „Kontakt”, osoba prowadząca sprawę, Użytkownicy, Harmonogram, PDF): nigdzie indziej numer nie jest skracany ani ukrywany. Baza nie maskuje (`load_driver_contacts`, 0169 — wszystkie role).

Wspólna funkcja: `src/lib/phoneDisplay.ts` (`groupPhone`). Test: `tests/phone-display.test.ts` (3/3; w kodzie menu konta i Bramki SMS nie ma „•••”, `maskPhone` ani `to_e164.slice(-…)`). Zrzutu nie ma: w trybie demo (wzorce wizualne) konto nie ma profilu z telefonem — oba miejsca widać tylko po zalogowaniu na produkcji (Bramka SMS — Administrator HHL). Numery w tym pliku są zmyślone (G-09).
