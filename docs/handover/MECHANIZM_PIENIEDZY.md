> **CZĘŚCIOWO ZASTĄPIONY 29.09 — przy sprzeczności wygrywa wzorzec/03_REJESTR_DECYZJI.md i zlecenia z 29.09.**
# MECHANIZM PIENIĘDZY — wersja 2.2 — jedyne źródło prawdy

> **Zastępuje w całości wersję 1** oraz `D7_DECYZJA.md` i `D7_CZAS.md`.
> Obejmuje: walutę, kurs, opłatę paliwową, poziomy wyceny, faktury trzech
> stron, numery zleceń, terminy płatności, przypomnienia, ustawienia
> użytkownika. Jeżeli cokolwiek innego w projekcie temu przeczy —
> obowiązuje ten dokument.

---

# 1. DECYZJE WŁAŚCICIELA

| # | Decyzja | Status |
|---|---|---|
| **W1** | **Wszystkie ceny w EUR.** Każdy użytkownik może w swoich ustawieniach przełączyć walutę wyświetlania na **PLN** — wtedy przeliczenie działa **wszędzie** | zastępuje wcześniejsze „PLN tylko na kokpicie" |
| **W3** | Kurs przewoźnika na fakturze: **NBP, tabela A, kurs średni z dnia roboczego poprzedzającego dzień rozładunku** | bez zmian |
| **W4** | Opłata paliwowa: **ten sam mechanizm dla każdej strony**, opisany w dokumentacji projektu (SEFS hybrid_min) | bez zmian |
| **W5** | Faktura obejmuje transporty **zrealizowane w danym tygodniu**. **Realizacja = rozładunek** | P1 potwierdzone |
| **W6** | Mnożnik paliwowy wg daty realizacji; dla niedostarczonych wg planu z harmonogramu; **kwoty z faktur nadrzędne** | bez zmian |
| **W7** | Fakturę **HHL dla KSH** widzą **HHL i KSH**. Fakturę **SCX dla HHL** widzą **HHL i SCX**. **HHL widzi wszystkie** | nowe |
| **W8** | **HHL i SCX wybierają walutę faktury: EUR albo PLN** | nowe |
| **W9** | Faktury powstają w **systemach zewnętrznych** HHL i SCX i są tu **rejestrowane z plikiem** | nowe |
| **W10** | System **liczy termin płatności** każdej faktury wszystkich stron i **wysyła przypomnienia** o nieopłaconych | nowe |
| **W11** | **Status „Opłacona" ustawia ręcznie wyłącznie HHL** — dla faktur kosztowych i przychodowych | nowe |
| **W12** | **Numer zlecenia HHL i numer zlecenia SCX — obowiązkowe**, wpisuje je każda strona, **widoczne w tabeli Harmonogramu** | nowe |
| **W13** | **KSH ma własny moduł Faktury**: faktury tygodniowe HHL **z dokumentami potwierdzającymi transport — bez zdjęć, bez zezwoleń, bez niczego innego**. KSH sprawdza i kontroluje | nowe |

**Odpowiedzi na pytania z wersji 1:**

| # | Pytanie | Decyzja |
|---|---|---|
| P1 | Które zdarzenie jest realizacją | **rozładunek** |
| P2 | Faktura HHL dla KSH | **tak**, z widocznością wg W7 |
| P3 | Kokpit w PLN — dla kogo | **zastąpione przez W1**: waluta to ustawienie każdego użytkownika |
| P4 | Dane indeksu paliwowego | **zostają w walutach bazowych** (SEK/l, PLN/l) |
| P5 | Format kwot | **kod waluty** (`EUR`, `PLN`), liczba wg języka interfejsu |
| P6 | Stawki demonstracyjne w PLN | **przeliczone raz** tabelą 186/A/NBP/2026 (4,3900), oznaczenie D18 zostaje |
| P7 | Kurs na fakturze | **pokazywać numer tabeli, kurs i datę kursu** |
| P8 | Suma gwarancyjna polisy | **w walucie polisy** |

---

# 2. WALUTA — CO GDZIE WIDAĆ

**Źródłem jest zawsze EUR.** PLN jest wyłącznie przeliczeniem wyświetlania,
nigdy wartością przechowywaną jako źródło.

| Co | Użytkownik z EUR | Użytkownik z PLN |
|---|---|---|
| Ceny, stawki, marże, sumy, kokpit | EUR | PLN, przeliczone per transport |
| Kwoty na fakturze | **w walucie faktury** — dokument jest nadrzędny | **w walucie faktury** |
| Kurs na fakturze (numer tabeli, kurs, data) | pokazywany | pokazywany |
| Dane wejściowe indeksu paliwowego | SEK/l i PLN/l — waluta źródłowa | bez zmian |
| Suma gwarancyjna polisy | waluta polisy | bez zmian |
| **SEK jako waluta ceny** | **nigdzie** | **nigdzie** |

## Reguła przeliczenia na PLN

Per transport, każda strona swoim kursem, zaokrąglenie do grosza per
transport, potem suma. Kurs według poziomu wyceny (sekcja 4).

## Gdzie użytkownik przełącza walutę

**Propozycja do potwierdzenia (Q12):** rozszerzyć istniejący panel
„Preferencje interfejsu" z ekranu Opcje na **ustawienia każdego
użytkownika**, dostępne we wszystkich rolach. Zawiera: język, walutę
wyświetlania, motyw. Dla KSH i SCX — pozycja „Ustawienia" w nawigacji.
Żadnego nowego komponentu: panel już istnieje we wzorcu systemu.

---

# 3. KURS NBP — ZWERYFIKOWANY NA ŻYWYM API

```
1. dzień rozładunku = data LOKALNA (Europe/Warsaw), nigdy UTC
2. pobierz tabele A dla EUR z przedziału [dzień − 14, dzień − 1]
3. weź ostatnią tabelę z datą ŚCIŚLE WCZEŚNIEJSZĄ niż dzień rozładunku
4. brak tabeli → błąd, nigdy zgadywanie
```

„Dzień roboczy" = dzień publikacji tabeli przez NBP. Weekendy i święta
obsługują się same, bez kalendarza.

**Fakty sprawdzone 24.09.2026:**
- `GET https://api.nbp.pl/api/exchangerates/rates/a/eur/{od}/{do}/?format=json`
- pojedynczy dzień bez publikacji → **404 „Brak danych"** → zawsze przedział
- **24–28.12.2025 bez tabel** (Wigilia wolna od 2025): rozładunek 29.12.2025
  → tabela **248/A/NBP/2025 z 23.12**
- **2.01.2026 to tabela 001/A/NBP/2026** (pierwsza w roku), 5.01 — 002/A
- klucz API niepotrzebny; maksymalnie 93 dni w zapytaniu

**Pułapka UTC — dowód:** rozładunek `2025-12-29T23:30:00Z` to wtorek 30.12,
00:30 czasu polskiego. Lokalnie → tabela **249/A**. W UTC → 248/A, sześć
dni wcześniej. Przewoźnik policzyłby dobrze, system oflagowałby go jako błąd.

---

# 4. POZIOMY WYCENY

| Poziom | Stan transportu | Data opłaty paliwowej | Kurs do przeliczenia |
|---|---|---|---|
| **PROGNOZA** | nierozładowany | planowana dostawa | ostatnia tabela przed planowaną datą — **prowizoryczny**, gdy data w przyszłości |
| **REALIZACJA** | rozładowany | dzień rozładunku (migawka) | ostatnia tabela przed dniem rozładunku (migawka) |
| **FAKTURA** | zafakturowany | z faktury | **z faktury** |

**Dwie różne daty:** opłata paliwowa bierze **dzień rozładunku**, kurs —
**dzień roboczy przed nim**.

**Poziom transportu = poziom mniej pewnej strony.**

---

# 5. TRZY ZASADY NIENARUSZALNE

**Z1. Faktura nadpisuje wynik, nie kasuje wyliczenia.** Obie wartości
zostają. Marża liczy się z fakturowanej, różnica jest flagowana.
Bez tego dopasowanie porównuje fakturę samą ze sobą.

**Z2. Dzień i tydzień zawsze lokalnie.** UTC w bazie, `Europe/Warsaw`
w obliczeniach dnia rozładunku i tygodnia faktury.

**Z3. PLN nigdy nie jest źródłem.** Wyłącznie przeliczenie wyświetlania
albo waluta dokumentu faktury.

**Z4. Data rozładunku zamrożona po zafakturowaniu.** Od niej zależy kurs
NBP, opłata paliwowa i tydzień faktury — cofnięcie jej o dzień zmienia
kurs na korzyść wystawcy. Po umieszczeniu transportu na fakturze zmienia
ją wyłącznie HHL; każda zmiana, także przed fakturą, trafia do dziennika
audytu. Wymuszone w bazie (migracja 0004), sprawdzone testem.

---

# 6. FAKTURY — MODEL TRZECH STRON

## 6.1 Kierunki i widoczność (W7)

| Kierunek | Wystawca | Odbiorca | Płatnik | Widzą | Nie widzi |
|---|---|---|---|---|---|
| **KOSZT** | SCX | HHL | HHL | HHL, SCX | **KSH nigdy** |
| **PRZYCHÓD** | HHL | KSH | KSH | HHL, KSH | **SCX nigdy** |

**Egzekwuje baza, nie interfejs** — migracja 0003, polityki na fakturach,
pozycjach i dokumentach faktur. Sprawdzone testem: 39/39.

**Potwierdzone (Q1):** SCX widzi własną fakturę. „Tylko HHL" znaczy
„spośród pozostałych stron tylko HHL".

## 6.2 Rejestracja faktury (W9)

Faktura powstaje w systemie wystawcy. W aplikacji wystawca **rejestruje** ją:

| Pole | Wymagane | Uwaga |
|---|---|---|
| numer faktury | tak | unikalny u wystawcy |
| data wystawienia | tak | |
| data doręczenia | gdy termin od doręczenia | patrz Q3 |
| tydzień | tak | ISO, liczony lokalnie |
| waluta | tak | **EUR albo PLN — wybór wystawcy (W8)**, domyślna z ustawień firmy |
| kwota netto | tak | do dopasowania i marży |
| VAT, brutto | tak | **przepisane z dokumentu, system nie liczy VAT**; brutto do płatności |
| termin płatności | wyliczany | z dokumentu ma pierwszeństwo |
| plik PDF | tak | |
| pozycje | tak | transporty zrealizowane w tygodniu |
| kurs per pozycja | **tak, gdy PLN** | numer tabeli, kurs, data |

**Kurs per pozycja przy fakturze PLN.** Wystawca nie wpisuje kursów ręcznie —
**system podpowiada je z reguły W3**, wystawca potwierdza albo poprawia
według swojego dokumentu. Każda różnica jest flagowana.

## 6.3 Kontrole przy rejestracji

| Kontrola | Flaga |
|---|---|
| transport z innego tygodnia | ZŁY_TYDZIEŃ |
| transport nierozładowany | NIEZREALIZOWANY |
| transport już na innej fakturze tego kierunku | **blokada w bazie** |
| transport z tygodnia pominięty | BRAK_NA_FAKTURZE |
| kwota poza tolerancją | KWOTA |
| opłata paliwowa innym mnożnikiem | OPŁATA_PALIWOWA |
| inny numer tabeli NBP | TABELA_NBP |
| inny kurs | KURS_NBP |
| inna data kursu | DATA_KURSU |
| faktura PLN bez kursu na pozycji | BRAK_KURSU |

## 6.4 Dwa niezależne statusy

Faktura może być jednocześnie sporna i po terminie.

- **weryfikacja:** DO_WERYFIKACJI → ZGODNA / SPORNA → ZAAKCEPTOWANA —
  ustawia **odbiorca**
- **płatność:** NIEOPŁACONA → PO_TERMINIE → OPŁACONA — ustawia **wyłącznie HHL**

Egzekwowane w bazie:
- odbiorca weryfikuje, **nie może zmienić treści faktury**
- wystawca poprawia treść, **nie może weryfikować własnej**
- status płatności **wyłącznie przez funkcję dostępną tylko dla HHL**,
  z datą zapłaty i wpisem w dzienniku audytu
- cofnięcie „Opłacona" — tylko HHL i **tylko z podanym powodem**

## 6.5 Moduł Faktury KSH (W13)

- lista faktur tygodniowych HHL — **wyłącznie faktur wystawionych dla KSH**
- przy każdej: PDF faktury + **CMR i POD** transportów z faktury
- **nic więcej**: bez zdjęć, zezwoleń, polis, specyfikacji, rezerwacji promu —
  wymuszone w bazie
- kontrola: kwota faktury wobec cen KSH (przychód HHL, **nigdy koszt**),
  opłata paliwowa, kursy, tydzień, kompletność
- akcje: ZGODNA, SPORNA z uzasadnieniem, ZAAKCEPTOWANA (patrz Q7)
- termin płatności i status płatności

## 6.6 Moduł Faktury HHL

Dwie sekcje w istniejącym widoku Faktury:
- **kosztowe** — od SCX: weryfikacja, spór, oznaczenie „Opłacona"
- **przychodowe** — dla KSH: rejestracja (kreator jak dla SCX: tydzień,
  transporty, waluta, kursy, plik), status weryfikacji KSH, oznaczenie
  „Opłacona" po wpływie
- warunki płatności per relacja — w Opcjach

## 6.7 Moduł Faktury SCX

- rejestracja własnych faktur z wyborem waluty
- status weryfikacji HHL i spory
- termin płatności i status płatności — **bez możliwości oznaczenia „Opłacona"**

---

# 7. TERMINY I PRZYPOMNIENIA (W10, W11)

**Termin = data wystawienia + liczba dni z warunków relacji** (Q3):

| Faktura | Płatnik | Termin |
|---|---|---|
| HHL → KSH | KSH | **30 dni od wystawienia** |
| SCX → HHL | HHL | **35 dni od wystawienia** |

Wpisane w `supabase/seed/stegra.sql`, zmienialne wyłącznie przez
administratora HHL. **Termin z dokumentu faktury ma pierwszeństwo.**

**Status „po terminie"** odświeżany codziennie przez **zadanie systemowe**,
w obie strony — przesunięcie terminu przywraca NIEOPŁACONA. Użytkownicy
**nie mogą** wywołać odświeżenia: z parametrem daty dałoby się oznaczyć
wszystkie faktury jako przeterminowane.

**Przypomnienia** — kadencja względem terminu (Q5): 3 dni przed, w dniu,
1, 7 i 14 dni po. Odbiorcy: **płatnik i wierzyciel tej faktury, nigdy
strona trzecia** — KSH nie dostaje przypomnień o fakturach SCX. Kanały:
e-mail i centrum powiadomień. **Opłacona → cisza.** Realizacja: reguły
w silniku automatyzacji, dopisane do reguł startowych.

---

# 8. NUMERY ZLECEŃ (W12)

| Numer | Kto wpisuje | Obowiązkowy przed | Unikalny w |
|---|---|---|---|
| KSH | import harmonogramu (dzisiejsza kolumna „Nr zlecenia") | — | — |
| **HHL** | HHL | statusem GOTOWY | projekcie |
| **SCX** | SCX | załadunkiem | przewoźniku |

Obowiązkowość **wymuszona w bazie** przy przejściu statusu — transport
powstaje z importu, zanim ktokolwiek nada numer. Każda strona zmienia
wyłącznie swój numer. Brak numeru przed terminem → pozycja w kolejce
wyjątków i przypomnienie.

**Widoczność w Harmonogramie:** trzy kolumny obok kodu wysyłki.
**Uwaga do wyglądu:** tabela już dziś ledwo mieści się na 1440 px —
trzy kolumny więcej oznaczają przewijanie w poziomie. Ostatnia kolumna
finansowa jest przyklejona do prawej krawędzi, więc najważniejsza liczba
zostaje na ekranie. Żadnego nowego wzorca.

Numery zleceń pojawiają się także na pozycjach faktur — ułatwiają
dopasowanie z dokumentem wystawcy.

---

# 9. PYTANIA — WSZYSTKIE ROZSTRZYGNIĘTE (24.09.2026)

| # | Pytanie | Decyzja |
|---|---|---|
| Q1 | Czy SCX widzi własną fakturę | **tak** |
| Q2 | Kurs na fakturze tygodniowej PLN | **każdy zrealizowany transport ma swój indywidualny kurs** — kurs per pozycja |
| Q3 | Podstawa terminu | **od wystawienia** |
| Q4 | Liczba dni | **KSH: 30 dni** (faktury HHL), **HHL wobec SCX: 35 dni** (faktury SCX) |
| Q5 | Kadencja przypomnień | **−3, 0, +1, +7, +14 dni** względem terminu |
| Q6 | Płatności częściowe | **nie** — status binarny |
| Q7 | KSH może oznaczyć fakturę jako sporną | **tak, uzasadnienie obowiązkowe** — wymuszone w bazie |
| Q8 | Dokumenty potwierdzające transport | **CMR i POD** |
| Q9 | Numery zleceń widoczne dla wszystkich ról | **tak** |
| Q10 | Kiedy numer obowiązkowy | **HHL przed GOTOWY, SCX przed załadunkiem** — wymuszone w bazie |
| Q11 | Obecna kolumna „Nr zlecenia" | **numer KSH** — trzeci numer |
| Q12 | Przełącznik waluty | **ustawienia każdego użytkownika**, panel „Preferencje interfejsu" we wszystkich rolach, pozycja „Ustawienia" w nawigacji KSH i SCX |
| Q13 | Powiadomienie KSH o nowej fakturze HHL | **tak** |
| Q14 | HHL zmienia status sporu KSH na własnej fakturze | **nie** — wymuszone w bazie |

**Rozbicie marży — ZATWIERDZONE (24.09.2026).** W widoku Finanse marża
w trzech wierszach: **zafakturowana** (pewna), **zrealizowana,
niezafakturowana** (ustalona, czeka na fakturę), **prognozowana** (zmienia
się z harmonogramem). Istniejący wzorzec `.mrow` w bloku „Od przychodu
do marży", bez nowych komponentów. Sumy: `totalsByTier` z silnika,
w walucie wyświetlania użytkownika.

---

# 10. PEŁNY ZAKRES ZMIAN

## 10.1 Dane — migracje

| Migracja | Zawartość | Stan |
|---|---|---|
| 0001 | waluta EUR z ograniczeniem; faktury EUR lub PLN; kolumny poziomu i migawek; **poprawka: rozszerzenie `citext`** | wykonana na Postgres 16 |
| 0002 | silnik geofencingu | wykonana |
| **0003** | numery zleceń z wymuszeniem; faktury trzech stron; kurs per pozycja; blokada podwójnego fakturowania; dokumenty faktur z zakresem dla KSH; strażnik wystawca/odbiorca; płatność tylko HHL z audytem; terminy per relacja; zadanie systemowe terminów; ustawienia użytkownika; odczyt dziennika audytu | wykonana |

Magazyn aplikacji: `STORE_SCHEMA_VERSION` → **2**, jedna migracja obejmująca
wszystko powyżej.

## 10.2 Interfejs

| Widok | Rola | Zmiana |
|---|---|---|
| Wszystkie z kwotami | wszystkie | waluta wyświetlania z ustawień użytkownika |
| Harmonogram | wszystkie | **kolumny numerów zleceń KSH, HHL, SCX** |
| Szuflada transportu | HHL, SCX | edycja własnego numeru zlecenia; poziom wyceny i data mnożnika w zakładce Ceny |
| Kokpit | wszystkie | waluta z ustawień, oznaczenie kursu prowizorycznego |
| **Faktury — nowy moduł** | **KSH** | sekcja 6.5 |
| Faktury | HHL | kosztowe i przychodowe, sekcja 6.6 |
| Faktury | SCX | sekcja 6.7 |
| **Ustawienia** | wszystkie | język, waluta, motyw (Q12) |
| Opcje | HHL | warunki płatności per relacja; cennik w EUR |
| Opcje — indeks paliwowy | HHL | **bez zmian** — waluty bazowe (P4) |
| Kolejka ryzyk | wszystkie | brak numeru zlecenia; faktura po terminie; faktura sporna — wg widoczności |
| Centrum powiadomień | wszystkie | przypomnienia o płatności wg sekcji 7 |
| Eksport XLSX | HHL | kolumny numerów zleceń, waluta |

## 10.3 Logika — silnik referencyjny

`lib/pricing/engine.ts` — przetestowany, przenieść do `src/lib/`:
reguła NBP, czas lokalny, tydzień, poziomy, migawka paliwa, niezmiennik,
marża w obu walutach, dopasowanie faktury EUR i PLN z kursem per pozycja,
kontrole tygodnia i podwójnego fakturowania, termin, stan płatności,
przypomnienia, widoczność, formatowanie kodem waluty.

**Nie zmieniaj logiki reguły kursowej ani niezmiennika.** Jeżeli nie
pasuje do aplikacji — napisz.

---

# 11. TESTY

| Zestaw | Co pilnuje | Wynik po mojej stronie |
|---|---|---|
| `tests/money.test.ts` | reguła NBP na prawdziwych tabelach, pułapka UTC, tydzień, poziomy, niezmiennik, marża, faktury EUR i PLN, kontrole, termin, przypomnienia, widoczność, format | **49 zielonych**, 1 pominięty celowo (żywe API za `NBP_LIVE=1`) |
| `tests/db/run.sh` | migracje od zera + **podszywanie się pod HHL, KSH, SCX** | **39/39** na Postgres 16 + PostGIS |
| D-EUR-T (do napisania w aplikacji) | brak PLN i SEK w interfejsie przy walucie EUR; brak SEK przy PLN; wyjątki jawnie wyłączone | — |
| API faktur (do dopisania w `tests/visual.spec.ts`) | KSH nie dostaje w odpowiedzi API żadnej faktury kosztowej; SCX żadnej przychodowej | — |

**Test bazy uruchamiaj po każdej zmianie migracji.** Znalazł trzy usterki,
których parser SQL nie widział: brak rozszerzenia `citext`, nieczytelny
dziennik audytu i funkcję terminów wywoływalną przez użytkowników.

---

# 12. POZA APLIKACJĄ

- **W3 do umowy z przewoźnikiem** — dla podmiotu niebędącego polskim
  podatnikiem to warunek umowny, nie ustawowy
- **Q2 do sprawdzenia w systemach fakturowych** HHL i SCX
- zastosowanie reguły kursowej do tego rodzaju usługi — **potwierdza księgowość**
- VAT: system go **nie liczy**, przepisuje z dokumentu

---

# 13. MIEJSCE W FALI 3

```
D19-T  test tłumaczeń
D10    formatowanie kwot — kod waluty, waluta z ustawień
D17    format daty
M1     przeniesienie engine.ts i money.test.ts
M2     magazyn v2 + migracja 0003
M3     reguła kursowa NBP na żywo, utrwalanie tabel
M4     ustawienia użytkownika i waluta wyświetlania
M5     numery zleceń: pola, wymuszenie, kolumny
M6     faktury: rejestracja, kontrole, dwa statusy, KSH, HHL, SCX
M7     terminy, przypomnienia, oznaczenie „Opłacona"
M8     D-EUR-T i test API faktur
       … dalej D11, D19, D12, D6, D26, D18, D13, D25
```

Warunek startu fali 3 bez zmian: **wyjaśnienie zera zmian w widoku Ryzyka.**
