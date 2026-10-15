# wyglad/P8-b — Opcje › Powiadomienia › SMS przy miejscach (E42) — 15.10.2026, 23:20

| Element E42 (`img/e42-after`) | Przed (demo i produkcja) | P8-b |
|---|---|---|
| Kafelki | brak | „Wysyłka do odbiorców” (tryb testowy na pomarańczowo: „Wyłączona · tryb testowy: wszystko na …”), „Wyprzedzenie 60 min przed przyjazdem”, „„Auto czeka” 30 min bez ruchu, do 2 km od strefy”, „Cisza nocna 20:00–06:00” |
| Miejsca | 2 listy po 2 pola, wybór języka PL / SE | „Załadunek · KSH Śrem” i „Rozładunek · plac Stegra Boden”, licznik „1 z 2 osób” (zielony) / „0 z 2 osób” (czerwony); bez wyboru języka (E43, 22:42) — obok numeru kierunkowy „PL +48 / SE +46” |
| Osoba | imię i numer wpisywane ręcznie | „Wybierz z użytkowników” (imię i telefon z konta, E6; konto bez telefonu — nie do wyboru) albo „Wpisz numer ręcznie…”; numer w pełnej postaci (decyzja 15.10, 03:12); ta sama osoba ani numer drugi raz w miejscu — nie (E42: SMS raz na numer) |
| Rodzaje | brak | przy osobie A przyjazd, B wcześniej (w Śremie „B nie dotyczy”), C czeka, D wjazd; zapis od razu |
| Pusta lista | brak ostrzeżenia | „Brak odbiorców — SMS dla Boden nie wyjdą. Dziś to dotyczy też …” (transporty w oknie śledzenia: Śrem — przed wyjazdem z załadunku, Boden — od promu) |
| Bramka | osobny formularz | wiersz pod listami: stan bramki, ostatni sygnał, „dziś 0 / 150”, e-mail zastępczy „SMS do Boden (2 osoby) niewysłany: …” |
| Włączenie | brak w Opcjach | odnośnik „Włącz wysyłkę do odbiorców” z pytaniem „Włącza właściciel (lista STOP). Włączyć?” — widoczny tylko, gdy źródło na to pozwala (właściciel) |
| Prawa | Operacje HHL widziały pola z „Zapisz” | Administrator HHL zmienia; Operacje HHL — „Tylko podgląd · zmienia Administrator HHL” |
| Telefon | — | kafelki Wysyłka i Cisza nocna; miejsce bez odbiorców rozwinięte na górze (Osoba 1 z A–D, Osoba 2); miejsce z odbiorcami zwinięte do „imię · numer · A, C, D” |

Sprawdzone (demo, 1440 / 820 / 390 px, jasny i ciemny): axe WCAG 2 A/AA — 0 (także z otwartym pytaniem o włączenie i z błędem); tekst < 12 px — 0; cele ≥ 44 px i pola 16 px na telefonie; przewijanie strony w bok — 0; brama E8 telefonu „P3-c” 4 / 4; wybór osoby z konta, numer ręczny (zły — błąd przy polu, dobry +46 — kierunkowy SE), rodzaje A–D, usunięcie (fokus wraca na wybór osoby), ta sama osoba w drugim polu wyłączona, Enter w numerze osoby z konta nic nie zapisuje; pytanie o włączenie z fokusem na „Tak, włącz”, po decyzji fokus na przełączniku; KSH i SCX — ekranu brak. Produkcja: źródło `null` → zostają dzisiejsze formularze (odbiorcy, bramka) do podłączenia w P8.

Odstępstwa od obrazu (świadome, nowsze decyzje): bez wyboru języka przy osobie i pełne numery zamiast „+48 ••• ••• 907” (E43 22:42, decyzja 15.10 03:12); kierunkowy jako „PL +48 / SE +46”; przycisk „×” (telefon: „Usuń osobę”) przy zapisanej osobie.

Zrzuty: `p8b-1440-light.webp`, `p8b-1440-dark.webp`, `p8b-phone-390.webp` (przed zmianą i po włączeniu wysyłki w ciemnym motywie).
