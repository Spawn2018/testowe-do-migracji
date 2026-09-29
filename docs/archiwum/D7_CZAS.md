> **ARCHIWUM — nie wykonywać. Zastąpione 29.09.2026, patrz docs/handover/wzorzec/**

> **ZASTĄPIONE PRZEZ `MECHANIZM_PIENIEDZY.md`** tam, gdzie się pokrywają.
> Zostawione do historii decyzji.

# D7 — REGUŁA CZASU OPŁATY PALIWOWEJ (decyzja właściciela)

## Reguła

Faktura obejmuje transporty **zrealizowane w danym tygodniu**.
**Realizacja usługi = dostarczenie towaru.**

Mnożnik opłaty paliwowej dla transportu ustalany jest według daty,
a źródło tej daty zależy od etapu:

| Poziom | Kiedy | Data dla mnożnika | Charakter |
|---|---|---|---|
| **PROGNOZA** | transport niedostarczony | planowana data dostawy z harmonogramu | tymczasowy, zmienia się z harmonogramem |
| **REALIZACJA** | transport dostarczony | **rzeczywista data dostawy** | ustalony, migawka przy transporcie |
| **FAKTURA** | transport zafakturowany | — | **nadrzędny**, nadpisuje wszystko wyżej |

Ta sama data po obu stronach — koszt i przychód — więc ten sam mnożnik.
To zamyka pozycję 32.3.

---

# DO ZROBIENIA

## 1. Trzy wartości przy transporcie, nie jedna

Każda kwota ma nieść swoje **źródło**. Przy transporcie przechowywane są
osobno:

- wartość wyliczona mechanizmem (z mnożnikiem wg prognozy albo realizacji)
- wartość z faktury, gdy przyjdzie
- poziom: `PROGNOZA` / `REALIZACJA` / `FAKTURA`
- data, z której wzięto mnożnik, i sam mnożnik — jako migawka

To jest zmiana schematu magazynu, więc **podbicie `STORE_SCHEMA_VERSION`
na 2 z migracją**, zgodnie z mechanizmem z D22. Istniejące transporty
dostają poziom wyliczony z obecnego statusu.

## 2. PUŁAPKA: „faktura nadpisuje" nie może kasować różnicy

To jest najważniejszy punkt tego dokumentu.

„Nadrzędne jest to, co wychodzi z faktur" znaczy: **marża liczona jest
z kwoty fakturowanej**. Nie znaczy: **wartość wyliczona znika**.

Jeżeli implementacja nadpisze wartość wyliczoną kwotą z faktury i zapomni
poprzednią, to **dopasowanie trójstronne z D20 traci sens** — nie ma już
z czym porównać. Przewoźnik doliczy opłatę paliwową według złej daty
i nikt tego nie zobaczy, bo liczba wyliczona zostanie zastąpiona liczbą
z faktury.

Prawidłowo:
- obie wartości zostają zapisane
- marża i wszystkie sumy używają kwoty z faktury
- **różnica między wyliczoną a fakturowaną jest pokazywana i flagowana**
  przez D20, z rozbiciem: stawka bazowa, opłata paliwowa, dodatki

Sprawdź, czy `buildThreeWayMatch` z D20 działa w ten sposób. Jeżeli
porównuje fakturę z wartością, którą faktura wcześniej nadpisała —
porównuje fakturę samą ze sobą.

## 3. PUŁAPKA: tydzień liczony w czasie lokalnym, nie w UTC

Po D8 daty są przechowywane w UTC. Przypisanie dostawy do tygodnia
**musi** odbywać się po przeliczeniu na czas lokalny.

Przykład: dostawa w Boden w poniedziałek o 00:30 czasu lokalnego to
w lecie niedziela 22:30 UTC. Jeżeli tydzień liczony jest w UTC, transport
trafia na **fakturę poprzedniego tygodnia**. Przy zimie przesunięcie
jest o godzinę mniejsze, więc usterka pojawia się i znika z porą roku —
najgorszy rodzaj błędu do wykrycia.

`Europe/Warsaw` i `Europe/Stockholm` mają identyczne przesunięcie, więc
wybór jednej z nich nie ma znaczenia. Znaczenie ma tylko to, żeby
**nie liczyć w UTC**. Definicja tygodnia: ISO, poniedziałek–niedziela —
potwierdź, że tak jest w kodzie.

## 4. Który odczyt indeksu obowiązuje w danym dniu

„Patrzymy na datę realizacji i wiemy dokładnie" — pod warunkiem, że wiadomo,
**który odczyt indeksu obowiązuje w danej dacie**: ostatni opublikowany
przed tą datą, ten z tego samego dnia, czy średnia z okresu.

Dokumentacja mechanizmu zapewne to określa. Sprawdź i wpisz regułę
z cytatem do tabeli zgodności z `D7_DECYZJA.md`. Jeżeli dokumentacja
milczy — napisz to, zamiast zakładać.

## 5. Testy

Rozszerzenie testu niezmiennika z `D7_DECYZJA.md`:

- transport niedostarczony: mnożnik kosztu = mnożnik przychodu =
  mnożnik z **planowanej** daty dostawy
- transport dostarczony: oba = mnożnik z **rzeczywistej** daty dostawy;
  zmiana planowanej daty w harmonogramie **nie zmienia** już mnożnika
- transport zafakturowany: marża z kwoty fakturowanej; wartość wyliczona
  nadal zapisana; różnica niezerowa → flaga D20
- **granica tygodnia**: dostawa w poniedziałek 00:30 czasu lokalnego
  trafia do nowego tygodnia, w lecie i w zimie
- zmiana planowanej daty dostawy przesuwająca transport na inny tydzień
  zmienia mnożnik prognozy — i tylko prognozy

---

# PROPOZYCJA DLA PULPITU HHL — do potwierdzenia przez właściciela

Dziś kafelek pokazuje jedną liczbę: „Marża narastająco". Po tej regule
ta liczba miesza trzy rzeczy o różnej pewności — marżę zafakturowaną,
zrealizowaną i prognozowaną.

W widoku Finanse, w istniejącym bloku „Od przychodu do marży", trzy wiersze
w obecnym wzorcu `.mrow`:

- marża zafakturowana — pewna
- marża zrealizowana, niezafakturowana — ustalona, czeka na fakturę
- marża prognozowana — zmienia się z harmonogramem

Bez nowych komponentów, bez zmiany wyglądu poza treścią. **Nie wdrażaj
bez zgody** — to decyzja o tym, co właściciel chce widzieć, nie usterka.

---

# KOLEJNOŚĆ

Punkty 1–5 do fali 3, **po D10 i D17** — obie są funkcjami formatującymi,
z których ta logika będzie korzystać. Warunki startu fali 3 z
`FALA2_PRZEGLAD.md` bez zmian, przede wszystkim widok Ryzyka.
