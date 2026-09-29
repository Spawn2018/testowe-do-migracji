# ZLECENIE — CENNIK, DOPŁATA PALIWOWA SEFS, OPŁATY

> 30.09.2026. **Właściciel przekazał stawki (D-1) i mechanizm paliwowy (D-2).**
> Źródła: `CENY_PODSTAWOWE_-_SCANDINAVIAN_EXPRESS.xlsx` (koszt),
> `CENY_PODSTAWOWE_-_hhl.xlsx` (przychód), `SEFS_KSH_Stegra_v2.docx`
> (załącznik nr 1 do umowy z 28.09.2026).
> Koordynator przepisał je do **`CENNIK_STEGRA.json`** i zweryfikował.
> **Przepisz je niezależnie z oryginałów i porównaj z JSON** — dwie
> niezależne transkrypcje, każda różnica = STOP.
>
> **Dane poufne.** Nigdy we froncie ani w paczce publicznej. Wczytanie
> do bazy migracją albo skryptem spoza `src/` i `public/`.

---

## Weryfikacja koordynatora — ma się zgadzać z Twoją

- 12 pozycji, identyczne symbole, wymiary, masy i warianty konwoju po obu stronach
- przychód = koszt × 1,05 — **dokładnie 5,0000% na każdej pozycji**
- SEFS: po 51 progów SEK (17,4–32,4, krok 0,3) i PLN (5,0–10,0, krok 0,1);
  progi rosnące, mnożniki niemalejące; cena bazowa 19,47 SEK i 5,698 PLN
  → mnożnik 1,00

---

## I-30 · P0 — CENNIK WEDŁUG SYMBOLI (zastępuje model z I-12 i I-19)

**Zakres:** tylko transporty HH z wymiarami (reguła właściciela,
`ZLECENIE_SHAREPOINT.md` §1). Koordynator zmapował plik z 30.09:
**95 z 95 z ceną** — koszt 695 795 EUR, przychód 730 584,75 EUR, marża
34 789,75 EUR (bez SEFS i opłat).
- **Decyzja właściciela — PL-1, PL-10.1, PL-17.1** (14,70 × 3,40 × 2,60 m):
  **wycena tak, jakby miały wysokość 2,45 m → pozycja PL-B** (9 690 / 10 174,50 EUR).
  Reguła ogólna: gdy **jedyną** przyczyną braku ceny jest wysokość — cena
  z najmniejszej pozycji rodziny obejmującej pozostałe wymiary i masę;
  w interfejsie widoczne oznaczenie „wycena przy wysokości przyjętej
  z cennika (decyzja właściciela)", wpis w dzienniku. Przekroczenie
  długości, szerokości albo masy — nadal brak ceny i ostrzeżenie
- **Kratownice:** daty KR-01…07 w pliku KSH są błędne, KR-08…15 bez daty.
  **Decyzja właściciela: nie ruszamy** — KSH poprawi, a to będzie test
  wykrywania zmian (II-10). Do tego czasu kontrola jakości pokazuje ryzyka,
  a cena KR według dat z pliku

Prawdziwy cennik **nie jest macierzą wymiarów**. Cena zależy od:

1. **Rodziny elementu** — prefiks numeru wysyłki: `BS`, `KR`, `PL`, `SG`,
   `SS`, `T`, `TS`. Uwaga: `TS-` to nie `T-`, `SS-` to nie `SG-`
2. **Wariantu w rodzinie** (BS-A/B/C, PL-A/B) — **najmniejsza pozycja,
   której maksymalna długość, szerokość, wysokość i masa obejmują transport**
3. **Liczby aut w konwoju** — tylko KR: 1, 2 albo 3 auta = trzy różne ceny

Zasady:
- transport, którego wymiary lub masa przekraczają każdą pozycję rodziny
  → **brak ceny = wyraźne ostrzeżenie, nigdy zero ani „najbliższa"**
- **Konwój = liczba aut z kratownicami (KR) z tą samą datą załadunku**
  (definicja właściciela). Wyłącznie KR — inne towary się nie liczą.
  **Liczony automatycznie**, bez ręcznego atrybutu. Każda zmiana
  (nowy transport KR, anulowanie, przesunięcie daty) → przeliczenie cen
  wszystkich KR z tego dnia + wpis w dzienniku; faktura wystawiona
  zamraża cenę. Więcej niż 3 KR jednego dnia → cena dla 3 + ryzyko HHL
  „cennik nie przewiduje" (do wyjaśnienia z przewoźnikiem)
- **D-8 nieaktualne:** transporty „Standard" należą do innej firmy (NTG)
  i nie są importowane. Osobna stawka STANDARD niepotrzebna
- formularz z I-19 przebuduj: pozycje według symbolu, wariantu i konwoju,
  wersjonowanie i dziennik zmian jak dotąd
- **mapowanie harmonogramu:** dla wszystkich transportów z pliku KSH —
  rodzina, wariant, cena kosztu i przychodu. Lista transportów bez ceny
  z powodem. Wynik liczbami

Kryterium: testy dla każdej pozycji, graniczne wymiary, przekroczenie,
KR bez konwoju; mapowanie harmonogramu z listą wyjątków.

---

## I-31 · P0 — DOPŁATA PALIWOWA SEFS

1. **Pobieranie cen — ZASADA WŁAŚCICIELA: bierzemy cenę tak, jak podaje
   źródło z umowy; VAT nas nie interesuje.**
   - **SEK:** cena listowa **GoEasy Diesel** dla firm, taka jak na stronie
     `https://www.okq8.se/foretag/priser/` (28.09: 22,74 kr/l — z VAT, zgodnie
     z „cena listowa" w umowie). **Źródło danych: oficjalny plik historii
     OKQ8** podlinkowany na tej stronie (`prishistorik-foretag_<data>.xlsx`,
     arkusz roku, kolumna **„Diesel"** — nie „Nettopris Diesel"). Wartości
     dzienne, także w weekend
   - **PLN:** Orlen **Ekodiesel** hurtowo, strona
     `https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw`. **Źródło danych:
     API za tą stroną** `tool.orlen.pl/api/wholesalefuelprices/ByProduct`
     (produkt `ONEkodiesel`), wartości **w zł/m³ → ÷ 1000 = zł/l**
     (26.09: 7 442 zł/m³ = 7,442 zł/l). Publikacje w dni robocze
   - koordynator sprawdził: 5 698 zł/m³ (cena bazowa) = Orlen 04.06.2026 co do
     złotówki; mnożnik w tygodniu 28.09–04.10: SEK 23,05 → 1,14, PLN 7,41 → 1,17,
     **niższy = 1,14**. Użyj tego jako testu
   - **przewoźnik potwierdza jednym zdaniem, że liczy tak samo** (pytanie 9
     w programie spotkania). Do tego czasu: liczymy według zasady właściciela,
     bez blokady
   - każdy odczyt: źródło, adres, wartość surowa, jednostka, czas. Blokada
     lub zmiana formatu źródła = ryzyko HHL, nie cicha awaria
2. **Mnożnik tygodniowy:** średnia arytmetyczna z pełnego poprzedniego
   tygodnia kalendarzowego (pon–niedz), zaokrąglona do 2 miejsc; odczyt
   z tabeli (≤ próg); **niższy z dwóch mnożników**
3. **Stosowanie:** do transportów z **datą załadunku** w danym tygodniu
   (pon–niedz, Europe/Warsaw). Mnożnik dotyczy **tylko ceny z cennika** —
   nie opłat za anulowanie ani przestój
4. **Poza tabelą:** powyżej ostatniego progu → ostatni mnożnik + ryzyko
   HHL „uzgodnić rozszerzenie tabeli w 14 dni"; poniżej pierwszego →
   pierwszy wiersz
5. **Awaria źródła:** ostatni ustalony mnożnik + ryzyko HHL
6. **Porównanie z fakturą przewoźnika** — przewoźnik podaje kwotę dopłaty
   na fakturze; różnica z naszym wyliczeniem → ścieżka sporu
7. **Obie strony:** ten sam mnożnik dla kosztu i przychodu
   (`applies_to = BOTH`) — **właściciel potwierdził: KSH ma identyczną
   dopłatę paliwową**
8. **III-10 (EU Weekly Oil Bulletin)** — to nie jest źródło z umowy.
   Zostaje wyłączone; opisz je w dokumentacji jako niezgodne z umową

Kryterium: testy na tabelach — dokładnie na progu, tuż nad progiem,
poniżej pierwszego, powyżej ostatniego, awaria źródła, wybór niższego
mnożnika; tydzień przejściowy (załadunek w poniedziałek).

---

## I-32 · P1 — OPŁATY DODATKOWE

Takie same kwoty po obu stronach; **bez dopłaty paliwowej**.

- **Anulowanie** — procent frachtu według dni kalendarzowych przed
  załadunkiem: ≥ 5 dni 0%, 4 dni 15%, 3 dni 25%, 1 dzień 50%, dzień
  załadunku 100%. **2 dni przed — dokument nie określa**; do wyjaśnienia.
  Fracht = cena z cennika (bez dopłaty paliwowej)
- **Czas wolny:** załadunek 6 h, rozładunek 4 h; każda kolejna godzina
  75 EUR. System **wylicza czas postoju ze zdarzeń stref** (wjazd–wyjazd)
  jako dowód do sprawdzenia faktury przewoźnika
- **Przestój:** 750 EUR za dobę
- do wyjaśnienia z przewoźnikiem: od kiedy liczy się czas wolny,
  czy rozpoczęta godzina liczy się w całości, kiedy przestój dobowy
  zamiast godzinowego — **parametry w tabeli, domyślne oznaczone
  jako wstępne**

---

## STRAŻNIK

Test paczki produkcyjnej: **żadna kwota z cennika** (np. `5344.5`,
`12745`, `11949`) ani tabela SEFS w kodzie frontu.
