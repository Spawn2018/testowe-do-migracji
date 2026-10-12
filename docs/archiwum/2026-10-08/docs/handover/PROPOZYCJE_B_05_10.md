# Propozycje na piśmie — część B (05.10.2026)

Polecenie właściciela 05.10.2026 07:16, punkt 4. Te pozycje **czekają na decyzję właściciela**. Nic z poniższego nie jest zbudowane. Każda propozycja ma warianty do wyboru, bez zgadywania wymiarów i bez nowych kosztów.

Źródło słów właściciela: `ZLECENIE_POPRAWKI_02_10.md`, część B (7c, 8, 9, pytanie 9).

---

## B-7c — filtry mapy i tabeli obok mapy

### Jak działa dziś

Lista w widoku MAPA przechodzi przez trzy filtry, po kolei:

1. **Rola** — filtr w kodzie istnieje, ale dziś przepuszcza wszystko (`filterLoadsForRole`); zakres danych konta ogranicza baza (RLS).
2. **Kafelek górnego paska** (etap korytarza, np. „Prom”) — jeśli jest wybrany, mapa i tabela pokazują tylko transporty z tego etapu. Ten sam wybór działa w kokpicie (Harmonogram go celowo pomija).
3. **Szukaj** — kod transportu, kierowca, nr rejestracyjny, nr zleceń KSH / HHL / SCX.

Potem przyciski nad tabelą:

- **Wszystkie · N** — bez dodatkowego filtra.
- **Terminowe · N** — transporty bez flagi opóźnienia (`delayed = false`).
- **Spóźnione · N** — transporty z flagą opóźnienia (`delayed`, ustawiana z ETA i statusu „opóźniony”).

Checkboxy na mapie (**Pojazdy, Strefy, Trasa, Ryzyka, Ślad**) nie filtrują tabeli — włączają tylko warstwy rysunku. Promy pokazują się według Q-18 (port PL, rejs do Szwecji, port SE).

### Propozycja nowych filtrów (do wyboru)

| # | Filtr | Co pokazuje | Po co |
|---|---|---|---|
| 1 | **Bez sygnału GPS** | transporty w drodze bez pozycji od ponad 30 min | szybkie wyłapanie auta, do którego trzeba zadzwonić |
| 2 | **Dziś załadunek / Dziś dostawa** | załadunek albo okno dostawy w bieżącym dniu (czas warszawski / sztokholmski) | plan dnia dyspozytora |
| 3 | **Na najbliższym promie** | transporty przypisane do najbliższego wypłynięcia (Polferries i Stena) | kontrola, czy auto zdąży do portu |
| 4 | **Z otwartym ryzykiem** | transporty z nierozwiązanym ryzykiem (pogoda, droga SE, dokumenty) | jeden klik do problemów zamiast przeglądania listy |
| 5 | **Brak dokumentów** | jak w Harmonogramie | spójność z Harmonogramem |

Wariant A: dodać 1 i 4 (najmniej przycisków). Wariant B: 1–5 jako rozwijana lista „Więcej filtrów”. Wariant C: bez nowych, tylko opis w pomocy.

---

## B-8 — statusy i filtry tabeli Harmonogramu

### Jak działa dziś

Harmonogram ma **własne** filtry (kafelek górnego paska go nie zawęża):

- **Szukaj** — jak na mapie.
- **Aktywne** — status: w drodze PL, w porcie, na promie, w drodze SE, dojazd do placu, załadunek.
- **Spóźnione** — flaga opóźnienia albo status „opóźniony”.
- **Brak dokumentów** — brak wymaganego dokumentu.
- **Dostarczone** — status albo etap „dostarczone”.
- **Etapy** (Załadunek, Droga PL, Gdańsk, Prom, Dojazd, Droga SE, Plac) — dokładnie jeden etap korytarza.
- Licznik „N / M” — ile wierszy po filtrze z ilu wszystkich.

Statusy w kolumnie Status to etap korytarza z podpisem po polsku (ta sama funkcja co w kokpicie i PDF).

### Propozycja (do wyboru)

| # | Zmiana | Uzasadnienie |
|---|---|---|
| 1 | **Przyszłe** (załadunek po dziś) — słowa właściciela z części B, pkt 4 | planowanie tygodnia |
| 2 | **Zakres dat załadunku i rozładunku** (od–do) — słowa właściciela z B-8 | to jest w B-8 jako wymóg; propozycja: dwa pola daty nad tabelą, puste = bez filtra |
| 3 | **Bez kierowcy / bez ciągnika** | braki do uzupełnienia przed załadunkiem |
| 4 | **Bez rezerwacji promu** | to blokuje wyjazd |
| 5 | Połączyć „Aktywne” i etapy w jedną rozwijaną listę „Etap” | mniej przycisków w jednym rzędzie, na telefonie się mieści |

Zmiana ciągnika (B-8) nie ma specyfikacji. Propozycja: w panelu transportu przycisk „Zmień ciągnik” (nr rejestracyjny + od kiedy), historia w zakładce Status, SMS kierowcy bez zmian. Czeka na decyzję.

---

## B-9 — górny pasek filtrów (kafelki etapów)

### Jak działa dziś

Dziewięć kafelków: Przygotowanie, Załadunek, Droga PL, Gdańsk, Prom, Nynäshamn, Droga SE, Boden, Dostarczone. Duża liczba to liczba transportów w danym etapie. Klik w kafelek ustawia filtr etapu w kokpicie i na mapie (Harmonogram go pomija). Drugi klik zdejmuje filtr.

### Propozycja (do wyboru)

- Wariant A (słowa właściciela: „usunąć cyfry”): zostaje nazwa etapu i pasek udziału, bez dużej liczby. Liczba w podpowiedzi po najechaniu.
- Wariant B: zamiast liczby — tylko liczba spóźnionych w etapie (czerwona), pusta gdy 0.
- Wariant C: pasek pokazuje także, że filtr jest włączony (obramowanie + „×” do zdjęcia), i ten sam filtr działa w Harmonogramie.
- Dodatkowo: kafelek „Prom” z najbliższym wypłynięciem Polferries i Steny (pytanie 7 z części B).

---

## Q-9 — tryb jasny

### Jak działa dziś

Przełącznik ◐ w górnym pasku. Domyślny motyw zależy od roli (HHL — ciemny). Podkład mapy HERE ma wersję jasną i ciemną zgodną z motywem (B-MAPA).

### Propozycja (do wyboru)

- Wariant A: jasny domyślnie dla wszystkich ról, ciemny na żądanie (wybór zapamiętany na urządzeniu).
- Wariant B: motyw jak w systemie telefonu/komputera (`prefers-color-scheme`), z przełącznikiem.
- Wariant C: bez zmian w działaniu, tylko poprawki kontrastu trybu jasnego (lista miejsc po przeglądzie 5 rozmiarów ekranu, Q-11a).

---

## B-3a — czeka na wymiary (D-83)

Automatyczne podpięcie zezwolenia do trasy według wymiarów wymaga wymiarów od właściciela. Nie budowane, wymiarów nie wymyślam.
