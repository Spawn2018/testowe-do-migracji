# wyglad/P8-c — Strefy (E34) — 16.10.2026, 01:15

| Element E34 (`img/e34-after`) | Przed (demo i produkcja) | P8-c |
|---|---|---|
| Lista | tabela 10 stref w przypadkowej kolejności, kolumny Histereza / Próbki / Postój, „0.8 km”, menu „Strefy 10” | „Strefy · 10 · według trasy”: grupy Śrem · załadunek, Gdańsk · Polferries → Nynäshamn, Gdynia · Stena → Karlskrona, Porty w Szwecji, Boden · rozładunek; w grupie bufor przed miejscem; przy strefie promień („1 000 m”, „50 km”), co uruchamia i ostatnie zdarzenie („SG-03 wyjazd 07.10”); menu bez liczby (E9) |
| Mapa trasy | brak | mapa nad listą: koła stref i miejsca z liczbą stref (Śrem 2, Gdańsk i Gdynia 4, Nynäshamn 1, Karlskrona 1, Boden 2) |
| Karta strefy | edytor z polami technicznymi | mapa z kołem „teraz · 1 000 m” i ostatnimi pozycjami („SG-03 · postój 06.10, 12:35”); „Szwecja · koło 1 000 m · teraz w strefie: 0 · ostatnie zdarzenie: …”; parametry słowami: Margines granicy, Potwierdzenie „2 pozycje”, Pobyt „10 min” z dawną nazwą w nawiasie |
| Co robi | brak | „Co robi ta strefa”: statusy E25, koniec śledzenia E26/E27, dopłata E33, SMS E42, porty według rejsu (Polferries / Stena); powiadomienia w Opcjach › „Kto co dostaje” (E11) |
| Historia | niewidoczna (`audit_log`) | „Historia zmian”: kto, kiedy, przesunięcie środka, promień przed → po, powód; dawne wpisy „powód: — (wtedy pola nie było)”; kliknięcie pokazuje poprzedni kształt na mapie (szare koło przerywane) |
| Zmiana | edytor dla Operacji HHL, bez powodu, „Usuń strefę” | „Zmień strefę”: środek (pole albo kliknięcie mapy), promień, margines, potwierdzenie, pobyt, **powód (wymagany)**, podgląd wpływu na transporty w oknie śledzenia („SG-03 · rozładunek 07.10, 08:35: przed zmianą 29 m w strefie · po zmianie 129 m w strefie → status bez zmian”, pytanie 1 B); błędy przy polach |
| Wyłączenie | „Usuń strefę” | „Wyłącz” i „Włącz” z powodem (strefy ze zdarzeniami się nie usuwa); wpis w historii |
| Nowa strefa | 8 rodzajów, kraje PL / SE / LT / DE | „+ Strefa”: 6 rodzajów, które działają; kraj Polska / Szwecja (sam ze środka, dopóki się go nie wybierze); trasa promowa tylko przy portach (domyślnie Polferries) |
| Prawa | Operacje HHL widziały edytor | Administrator HHL zmienia; Operacje HHL — „Tylko podgląd · strefy zmienia Administrator HHL” |
| Telefon | 3 z 8 kolumn | mapa trasy, karty według miejsca z ostatnim zdarzeniem; stuknięcie otwiera kartę strefy na cały ekran (mapa, parametry, co robi, historia, „Zmień strefę”, „Wyłącz”) |

Sprawdzone (demo, 1440 / 1024 / 768 / 390 / 360 px, jasny i ciemny):
- axe WCAG 2 A/AA — 0 (lista, karta, formularz z błędami, pytanie o powód);
- tekst < 12 px — 0, przewijanie strony w bok — 0;
- brama E8 telefonu: blok „wyglad/P8-c” 2 / 2 (lista, karta, wyłączenie, zmiana — 360, 390, 430, 768) i cała brama 64 / 64 przed dodaniem bloku;
- fokus:
  - tytuł formularza po „Zmień strefę”;
  - pierwsze błędne pole po „Zapisz zmianę”;
  - „Zmień strefę” po zapisie;
  - pole powodu po „Wyłącz”;
  - „Włącz” po wyłączeniu;
  - „+ Strefa” po „Anuluj”;
  - tytuł nowej strefy po dodaniu;
- jeden obszar komunikatów: „Zapisano…”, „Strefa wyłączona.”, „Dodano strefę…”;
- 1024 px: wybór strefy przewija do karty pod listą;
- testy `p8c-zones` 15 / 15, cały `test:unit` 145 plików zielony, pierwsze wczytanie 390,8 kB gzip (budżet 400).

Produkcja: źródło `null`, więc zostaje dzisiejsza strona Strefy (`GeofenceView`) do podłączenia w P8 (dopisek D-20261016-0115-01).

Odstępstwa od obrazu (świadome):
- etykiety pozycji na telefonie nad i pod punktem, a „teraz · 1 000 m” pod kołem — w prawo i w lewo nie mieszczą się na 390 px;
- „Włącz” też pyta o powód (historia zmian ma powód przy każdym wpisie).

Zrzuty: `p8c-1440-light.webp` (lista i karta placu Boden), `p8c-form-1440-dark.webp` (zmiana z błędami i podglądem wpływu), `p8c-phone-390-lista.webp`, `p8c-phone-390-karta.webp`.
