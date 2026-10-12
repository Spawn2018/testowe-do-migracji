> **CZĘŚCIOWO ZASTĄPIONY 29.09 — przy sprzeczności wygrywa wzorzec/03_REJESTR_DECYZJI.md i zlecenia z 29.09.**
# ZLECENIE KOŃCOWE — TOWER / STEGRA BODEN

> Jedno zlecenie, całość. Zastępuje wszystkie wcześniejsze polecenia
> od chwili zamknięcia fali 2. **Nie dostałeś** dokumentów
> `FALA2_PRZEGLAD.md`, `D7_DECYZJA.md`, `D7_CZAS.md` ani
> `MECHANIZM_PIENIEDZY.md` — ich treść jest tutaj albo w pakiecie plików.

---

# ETAP 0 — PRZYGOTOWANIE. ZRÓB TO, ZANIM PRZECZYTASZ RESZTĘ DO KOŃCA

To zlecenie jest długie i będzie realizowane przez wiele sesji. Twoja
pamięć rozmowy się skończy. **Pamięcią projektu są pliki w repozytorium,
nie rozmowa.**

**P0.1 — Zapisz to zlecenie.** Cała treść, bez skrótów, do
`docs/handover/ZLECENIE_FINAL.md`. Commit: `docs: zlecenie końcowe`.
Od tej chwili **przed każdym etapem otwierasz ten plik i czytasz sekcję
etapu z pliku, nie z pamięci.**

**P0.2 — Rozpakuj pakiet.** Właściciel umieścił `TOWER-pakiet-final.zip`
w `~/Downloads`. Jeżeli go tam nie ma — szukaj w `~/Desktop` i `/workspace`.
Jeżeli nie znajdziesz — **STOP**, poproś właściciela. Rozmieszczenie:

| Z pakietu | Do repozytorium | Uwaga |
|---|---|---|
| `MECHANIZM_PIENIEDZY.md` | `docs/handover/` | **jedyne źródło prawdy o pieniądzach**, wersja 2.1 |
| `SCOPE.md` | `docs/handover/` | rejestr zakresu, 35 sekcji — nic z niego nie może zniknąć |
| `DESIGN_SYSTEM.md` | `docs/handover/` | zastępuje poprzednią wersję |
| `PYTANIA_SCANDINAVIAN_EXPRESS.md` | `docs/handover/` | |
| `lib/pricing/engine.ts` | `src/lib/money/engine.ts` | ścieżki importów dopasuj |
| `tests/money.test.ts` | `tests/money.test.ts` | ścieżka importu silnika dopasuj |
| `tests/fixtures/nbp-eur-2025-12.json` | `tests/fixtures/` | prawdziwe tabele NBP |
| `supabase/migrations/0001…0003` | `supabase/migrations/` | kontrakt bazy |
| `supabase/seed/stegra.sql` | `supabase/seed/` | dane startowe produkcji |
| `tests/db/*` | `tests/db/` | test bezpieczeństwa bazy |
| `.stylelintrc.json` | korzeń repo | **zastępuje** obecny — poprzednia wersja miała błędy |
| `ZLECENIE_DLA_GROKA.md` | — | to samo zlecenie; **jeżeli wklejony tekst był ucięty, źródłem jest ten plik** |
| `tower-makieta.html` | — | **nie kopiuj** — kanon jest już w `design/claude-v2.0/` |
| `lib/schedule/parse.ts`, `lib/telematics/adapter.ts`, `tests/visual.spec.ts`, `app/tower.css` | `docs/claude/referencje/` | wzorce do wglądu; aplikacja ma własne odpowiedniki — nie podmieniaj |
| `docs_przekazanie_agenci_WT.txt` | `docs/claude/archiwum/` | |
| `README.md` | `docs/claude/` | opis pakietu |
| pozostałe `.md` | `docs/claude/archiwum/` | historia decyzji, **nie wykonuj ich** — obowiązuje wyłącznie to zlecenie |

**P0.3 — Założ `docs/handover/POSTEP.md`.** Tabela wszystkich pozycji
z tego zlecenia — kolumny: `ID | pozycja | status | commit | testy (liczby) | uwagi`.
Lista kontrolna wszystkich identyfikatorów jest w sekcji 9 na końcu.
**Jeżeli w Twojej tabeli jest mniej pozycji niż na liście kontrolnej —
przeczytaj zlecenie jeszcze raz.** Po każdej pozycji aktualizujesz wiersz.

**Gdy zaczynasz nową sesję:** najpierw `POSTEP.md`, potem sekcja 1 tego
zlecenia, potem sekcja bieżącego etapu. Nigdy nie wznawiasz z pamięci.

---

# 1. ZASADY — OBOWIĄZUJĄ W KAŻDYM ETAPIE

1. **Jedna pozycja, jeden commit.** `fix(D19): …`, `feat(M6): …`
2. **Nie zgaduj.** Gdzie kod przeczy temu zleceniu, a rozstrzygnięcie
   wymaga decyzji biznesowej — STOP i pytanie. Gdzie wymaga tylko
   rozsądku technicznego — zdecyduj, zapisz w `POSTEP.md` dlaczego
3. **Nie zawężaj.** Nie usuwaj funkcji, bo nie działa — napraw,
   usuń z interfejsu albo oznacz jako nieaktywną, i zapisz którą drogą.
   Nie łącz pozycji, nie pomijaj „oczywistych"
4. **Wygląd: kanon to `design/claude-v2.0/`.** Nowe widoki budujesz
   **wyłącznie z istniejących komponentów i wzorców**. Żadnego nowego
   wzorca wizualnego bez zgody właściciela. Stylelint pilnuje tokenów
5. **Każdy nowy napis w interfejsie — do słownika, w trzech językach.**
   Test D19-T to wymusza od etapu 2 do końca
6. **Wzorzec wizualny regenerujesz tylko na końcu etapu, jednym przebiegiem
   jednego skryptu, z raportem:** ile ujęć się zmieniło i dlaczego, grupami.
   Więcej zmian niż potrafisz uzasadnić → STOP, nie regeneracja
7. **Test pikselowy pilnuje wyglądu, nie treści.** Poprawność kwot, dat,
   kursów i uprawnień pilnują asercje. Nie uznawaj zielonego zrzutu
   za dowód poprawnej liczby
8. **Raportuj liczbami**, nie słowami: `unit 49/49`, `db 39/39`, `visual 720/720`
9. **Bezpieczeństwo egzekwuje baza, nie interfejs.** Ukrycie w interfejsie
   nie jest zabezpieczeniem
10. **Sekrety nigdy w repozytorium ani w rozmowie.** Tylko zmienne środowiskowe

**STOP wyłącznie w tych sytuacjach:** brak pakietu (P0.2); dane dostępowe
backendu (BK0); czerwona brama, której nie da się naprawić bez regeneracji
wzorca poza punktem przewidzianym; sprzeczność wymagająca decyzji
biznesowej; koniec etapu 6. **Poza tym realizujesz dalej bez czekania.**

---

# 2. STAN NA WEJŚCIU

- Fala 2 zamknięta: tag `baseline-fala-2-2026-09-24` na `27fe0dd`,
  unit 41/41, Playwright 4/4, 249/720 ujęć zmienionych i zregenerowanych
- Etap C: 720 ujęć, skrypt `baseline.mjs` z nawigacją po `data-view`
- Fala 0 i 1 zamknięte; D9 domknięte (cienie 0, promienie 0, `!important` 11)
- Hak `pre-push`: unit + Playwright
- `unit.yml` z `lfs: true` **nie wypchnięty** — brak uprawnienia `workflow`
  (sprawa właściciela)

---

# 3. DECYZJE WŁAŚCICIELA — WIĄŻĄCE

Pełny opis: `docs/handover/MECHANIZM_PIENIEDZY.md`. W razie sprzeczności
**plik ma pierwszeństwo przed tym streszczeniem.**

## 3.1 Waluta i kurs

| # | Decyzja |
|---|---|
| W1 | **Wszystkie ceny w EUR.** Każdy użytkownik może w **swoich ustawieniach** przełączyć walutę wyświetlania na **PLN** — przeliczenie działa **wszędzie**. SEK nigdzie jako waluta ceny |
| W3 | Kurs: **NBP, tabela A, kurs średni z dnia roboczego poprzedzającego dzień rozładunku** |
| P4 | Dane wejściowe indeksu paliwowego zostają w walutach bazowych (SEK/l, PLN/l) |
| P5 | **Kod waluty** (`EUR`, `PLN`), nie symbol; format liczby według języka interfejsu |
| P6 | Stawki demonstracyjne przeliczone raz tabelą **186/A/NBP/2026 z 24.09.2026, kurs 4,3900** — kurs zapisany w metadanych, oznaczenie danych demonstracyjnych zostaje |
| P7 | Na fakturze pokazywać **numer tabeli, kurs i datę kursu** |
| P8 | Suma gwarancyjna polisy — w walucie polisy |

**Reguła kursu — sprawdzona na żywym API NBP:**
```
1. dzień rozładunku = data LOKALNA (Europe/Warsaw), nigdy UTC
2. pobierz tabele A dla EUR z przedziału [dzień − 14, dzień − 1]
3. weź ostatnią z datą ŚCIŚLE WCZEŚNIEJSZĄ niż dzień rozładunku
4. brak tabeli → błąd, nigdy zgadywanie
```
Zapytanie o pojedynczy dzień bez publikacji zwraca **404** — zawsze przedział.
24–28.12.2025 NBP nie publikował (Wigilia wolna od 2025): rozładunek 29.12
→ tabela **248/A z 23.12**. 2.01.2026 to tabela **001/A**, nie 002/A.

**Pułapka UTC:** rozładunek `2025-12-29T23:30:00Z` = wtorek 30.12, 00:30
czasu polskiego → tabela **249/A**. Liczone w UTC → 248/A, błędnie.

## 3.2 Opłata paliwowa i czas

| # | Decyzja |
|---|---|
| W4 | **Ten sam mechanizm po obu stronach** — koszt i przychód. SEFS hybrid_min: `appliedMult = Math.min(multSek, multPln)`, tylko na stawkę drogową (`src/lib/sefs.ts`) |
| W5 | Faktura obejmuje transporty **zrealizowane w danym tygodniu**. **Realizacja = rozładunek** |
| W6 | Mnożnik wg dnia rozładunku; dla nierozładowanych wg planu z harmonogramu; **kwoty z faktur nadrzędne** |

| Poziom | Stan | Data opłaty paliwowej | Kurs do przeliczenia |
|---|---|---|---|
| PROGNOZA | nierozładowany | planowana dostawa | ostatnia tabela przed planem — prowizoryczny, gdy przyszłość |
| REALIZACJA | rozładowany | dzień rozładunku (migawka) | ostatnia tabela przed rozładunkiem (migawka) |
| FAKTURA | zafakturowany | z faktury | z faktury |

**Dwie różne daty:** paliwo — dzień rozładunku; kurs — dzień roboczy przed nim.
**Poziom transportu = poziom mniej pewnej strony.**

**Trzy zasady nienaruszalne:**
- **Z1** faktura nadpisuje wynik, **nie kasuje wyliczenia** — obie wartości
  zostają, marża z fakturowanej, różnica flagowana. Inaczej dopasowanie
  porównuje fakturę samą ze sobą
- **Z2** dzień i tydzień zawsze lokalnie, nigdy w UTC
- **Z3** PLN nigdy nie jest wartością źródłową

**Niezmiennik:** mnożnik i data opłaty paliwowej **równe po stronie kosztu
i przychodu** dla każdego transportu. **Nie** testuj stałości marży
procentowej — ta się zmienia, bo mechanizm obejmuje tylko stawkę drogową,
a prom i pilotaż nie.

## 3.3 Faktury, zlecenia, terminy

| # | Decyzja |
|---|---|
| W7 | Fakturę **HHL→KSH widzą HHL i KSH**. Fakturę **SCX→HHL widzą HHL i SCX**. **HHL widzi wszystkie**. KSH nigdy nie widzi faktur SCX; SCX nigdy faktur HHL |
| W8 | **HHL i SCX wybierają walutę faktury: EUR albo PLN** |
| W9 | Faktury powstają w **systemach zewnętrznych**, tu są **rejestrowane z plikiem PDF** |
| W10 | System **liczy termin płatności** każdej faktury i **wysyła przypomnienia** o nieopłaconych |
| W11 | **„Opłacona" ustawia ręcznie wyłącznie HHL** — koszt i przychód |
| W12 | **Numer zlecenia HHL i numer zlecenia SCX — obowiązkowe**, każda strona wpisuje swój, **widoczne w tabeli Harmonogramu** |
| W13 | **KSH ma moduł Faktury**: faktury tygodniowe HHL **z CMR i POD — bez zdjęć, bez zezwoleń, bez niczego innego**. KSH sprawdza i kontroluje |
| Q1 | SCX widzi własną fakturę |
| Q2 | **Każdy zrealizowany transport ma swój indywidualny kurs** — faktura PLN ma kurs per pozycja |
| Q3 | Termin liczony **od wystawienia** |
| Q4 | **KSH płaci HHL w 30 dni. HHL płaci SCX w 35 dni** |
| Q5 | Przypomnienia: **−3, 0, +1, +7, +14 dni** względem terminu |
| Q6 | Płatności częściowe — **nie** |
| Q7 | KSH może oznaczyć fakturę jako sporną — **uzasadnienie obowiązkowe** |
| Q8 | Dokumenty potwierdzające transport = **CMR i POD** |
| Q9 | Numery zleceń widoczne dla **wszystkich trzech ról** |
| Q10 | Numer HHL obowiązkowy **przed statusem GOTOWY**, numer SCX **przed załadunkiem** |
| Q11 | Obecna kolumna „Nr zlecenia" z importu = **numer KSH** — trzeci numer |
| Q12 | Waluta w **ustawieniach każdego użytkownika**: panel „Preferencje interfejsu" we wszystkich rolach; pozycja „Ustawienia" w nawigacji KSH i SCX |
| Q13 | KSH dostaje **powiadomienie o nowej fakturze HHL** |
| Q14 | HHL **nie może** zmienić statusu weryfikacji ustawionego przez KSH na fakturze HHL |

**Nie wdrażać bez zgody właściciela:** rozbicie marży w Finansach na
zafakturowaną / zrealizowaną / prognozowaną. Sumy są w silniku
(`totalsByTier`), interfejs czeka.

---

# 4. ARCHITEKTURA — PRAWDA, BEZ KTÓREJ RESZTA BYŁABY WYDMUSZKĄ

Obecna aplikacja: Vite + React + Zustand z zapisem w `localStorage`.
**Każda przeglądarka ma własną kopię danych.** Przełącznik ról jest pokazem.
Konsekwencje:

- faktura zarejestrowana przez SCX w jego przeglądarce **nie dociera do HHL**
- oznaczenie „Opłacona" u HHL **nie jest widoczne u KSH**
- przypomnienia nie mają skąd wiedzieć o fakturach
- **ceny, koszty i marże są w paczce i pamięci przeglądarki każdego użytkownika** —
  ukrycie ich w interfejsie niczego nie chroni

Decyzje W7–W13 i rozdzielenie cen **wymagają wspólnego backendu.**
Zbudowanie ich na `localStorage` dałoby interfejs, który wygląda na gotowy,
a nie łączy trzech firm — czyli wydmuszkę. Dlatego:

**Backend: Supabase** — Postgres z RLS, Auth, Storage, Edge Functions,
pg_cron. Migracje `0001`–`0003` są gotowym kontraktem, wykonanym na
Postgres 16 + PostGIS i sprawdzonym testem bezpieczeństwa **39/39**
z podszywaniem się pod każdą z trzech firm.

**Warstwa danych:** wszystkie odczyty i zapisy przez jeden moduł
`src/data/`, z dwoma dostawcami:
- `DemoProvider` — obecne dane startowe; **używa go `baseline.mjs`**,
  dzięki czemu wzorzec wizualny zostaje deterministyczny
- `SupabaseProvider` — produkcja

**Do zamknięcia etapu 3 aplikacja nie jest udostępniana stronom
z prawdziwymi danymi.** Oznaczenie danych demonstracyjnych obowiązuje.

---

# 5. ETAP 1 — DOMKNIĘCIE FALI 2

**F2.1 — Widok Ryzyka: 0 zmienionych ujęć. To jest niemożliwe.**
D3 dodało etykietę demonstracyjną na panelu warunków drogowych SE w widoku
Ryzyka, a D4 zmieniło źródło rejsów — tabela promowa pokazywała na 24/25.09
odwrócone statki. Oba zmieniają ten widok widocznie. Hipotezy:
(1) tabela promowa w Ryzykach ma **trzecią kopię danych rejsów**, niezależną
od `voyage.ts`; (2) etykieta D3 trafiła gdzie indziej; (3) widok Ryzyka
jest poza matrycą 720. Sprawdź:
```
ls shots-baseline | grep -i ryzyk | wc -l
grep -rn "SAIL_ROWS\|ferry-sailings\|voyage" src --include='*.ts' --include='*.tsx'
```
Jeżeli (1) lub (2): napraw, pełny przebieg 720, raport. **Jeżeli zmieniły się
wyłącznie ujęcia widoku Ryzyka** — commit wzorca, tag `baseline-fala-2b-<data>`.
Jeżeli zmieniło się cokolwiek innego — STOP. Jeżeli (3): dodaj widok
do matrycy i zanotuj.

**F2.2 — Próg testu wizualnego.** `maxDiffPixelRatio: 0.001` przepuszcza
zmienioną cyfrę w komórce i **luzuje się wraz z długością strony** —
najsłabiej chroniony jest harmonogram. Zmień na:
```ts
await expect(page).toHaveScreenshot(nazwa, {
  fullPage: true, maxDiffPixels: 60, threshold: 0.15, animations: 'disabled',
});
```
Przebieg porównawczy 720. Fałszywe czerwone od wygładzania → podnoś
`threshold`, **nie** `maxDiffPixels`. Wzorca nie regenerujesz.

**F2.3 — Stylelint zielony.** Nowy `.stylelintrc.json` z pakietu usuwa
dwa moje błędy: regułę zakazu nieparzystych pikseli (sprzeczna z kanonem —
makieta ma `9px 13px`, `7px 9px`) i martwy wzorzec `**/tower.css`
(arkusz to `src/index.css`). Uruchom, wypisz **pięć najczęstszych reguł**
z wyniku. Reguły formatowania kłócące się ze zwartym stylem kanonu
(zapewne `declaration-block-single-line-max-declarations` i pokrewne)
**wyłącz świadomie w pliku, z komentarzem w commicie**. Reguł tokenów,
promieni, cieni, krojów i `!important` nie wyłączasz. Cel: **lint zielony**,
dopięty do haka `pre-push`.

**F2.4 — Weryfikacja mechanizmu paliwowego (bez kodu).**
W `docs/handover/03_PARAMETRY_BIZNESOWE.md`:
- ścieżki plików dokumentacji mechanizmu SEFS — jeden obowiązujący
- tabela zgodności: `reguła z dokumentu | cytat, plik, sekcja | kod: plik, linia | zgodne?`
  — źródła cen hurtowych PL i SE, częstotliwość odczytu, budowa tablic
  SEFS_SEK i SEFS_PLN, `Math.min`, zakres tylko stawki drogowej,
  zaokrąglenie, progi, minimum, maksimum
- **który odczyt indeksu obowiązuje w danej dacie** — ostatni przed datą,
  z tego dnia, średnia — z cytatem; jeżeli dokumentacja milczy, napisz to
- **które pola ekranu Opcje faktycznie zasilają `computeSefs`**;
  niezasilające → do D25 (pole, które zapisuje się bez skutku, to fasada
  szczególnie groźna w wycenie)

Każda niezgodność kodu z dokumentem = osobna pozycja naprawy w `POSTEP.md`.

**F2.5 — Pozycje L1, L2, L4, L5, L7, L8, L9, L16.** Każdej: jedno zdanie
opisu i przydział do etapu 2, 4 albo 5. **Pozycja bez etapu nie zostanie
zrobiona.** Dopisz je do `POSTEP.md`.

**F2.6 — Trzy wyjaśnienia, jedno zdanie każde:** kokpit 54 ujęcia zamiast
90 (30 ujęć roli KSH z innymi KPI?); mapa 18 ujęć wyłącznie przy 1920 —
co jest widoczne tylko tam; zapis w dokumentacji: `Europe/Warsaw`
i `Europe/Stockholm` mają identyczne przesunięcie i reguły czasu letniego —
rozróżnienie jest zapisem intencji, liczbowo niczego nie zmienia.

**G1 — Brama etapu 1:** unit i Playwright zielone; stylelint zielony;
720 z nowym progiem zielone; `03_PARAMETRY_BIZNESOWE.md` z tabelą
zgodności; pozycje L przydzielone.

---

# 6. ETAP 2 — FALA 3A: TREŚĆ, JĘZYK, FORMATY, SILNIK

Bez backendu. Wszystko przez `DemoProvider`.

| ID | Pozycja | Kryterium odbioru |
|---|---|---|
| **D19-T** | **Najpierw.** Test Playwright: w trybie EN i SV żaden widok nie zawiera `ą ć ę ł ń ó ś ź ż` w tekście interfejsu. Komórki z danymi (nazwiska, miejscowości, kody) oznacz `data-content` i wyłącz | test istnieje; liczba trafień zapisana jako licznik D19 |
| **D10** | Jedna funkcja formatująca kwoty: `formatMoney(kwota, język, waluta)` z silnika — **kod waluty**, liczba wg języka, waluta wyświetlania z ustawień | test jednostkowy; zero innych formatowań kwot w kodzie (`grep`) |
| **D17** | Format daty w tabeli bez powtarzanego roku | test jednostkowy |
| **M1** | Silnik `src/lib/money/engine.ts` + `tests/money.test.ts` + fixture. **Nie zmieniaj logiki reguły kursowej ani niezmiennika** — jeżeli nie pasuje do aplikacji, napisz | **49 zielonych, 1 pominięty** (żywe API za `NBP_LIVE=1`) |
| **D11** | Ciągi debugowe i angielskie wartości wyliczeniowe out z interfejsu | `grep` na `permitFits`, `CANCELLED` itd. w wyrenderowanym tekście = 0 |
| **D19** | 104 napisy wpisane w komponentach → słownik, trzy języki | **D19-T zielony** |
| **D12** | Dane startowe prawdopodobne: nazwiska PL, LT, SE; telefony E.164; rejestracje PL, SE, LT; **numery zleceń KSH, HHL i SCX** w realnych formatach | brak „Driver 1", „+48 600 000 000", „PSE 1000" |
| **D6** | Telefon kierowcy z tabeli do szuflady; rola KSH widzi go tylko w oknie ±24 h wokół dostawy | test uprawnień |
| **D13** | Wzorce wizualne spoza katalogu opisane w `DESIGN_SYSTEM.md` albo usunięte; `section-card-hd--drag` ujednolicone z konwencją | po D13 włącz w stylelint `selector-class-pattern` |
| **D18** | Widoczne oznaczenie danych demonstracyjnych: stawki, parametry opłaty paliwowej, panel warunków drogowych. Wyłączalne jednym przełącznikiem | przełącznik działa |
| **P6** | Stawki demonstracyjne PLN → EUR tabelą 186/A/NBP/2026 (4,3900), kurs w metadanych | żadnej stawki w PLN w danych |
| **D-EUR-T** | Test Playwright w **dwóch trybach**. Waluta EUR: zero `PLN`, `zł`, `SEK`, `kr`, `kronor`, `złotych` w interfejsie. Waluta PLN: zero `SEK`, `kr`. Wyjątki jawnie wyłączone: dane indeksu paliwowego, kurs i numer tabeli na fakturze, kwoty faktury w walucie faktury, suma polisy | zielony w obu trybach |
| **D25** | Osiem atrap i sześć porzuconych z `02_FASADA.md`, w tym wybór „Wybierz" i pola Opcji z F2.4. Każda: zaimplementować, usunąć albo widocznie oznaczyć jako nieaktywną. **Martwy przycisk pokazany klientowi jest gorszy niż brak przycisku** | `02_FASADA.md` bez pozycji ATRAPA i PORZUCONE bez decyzji |

**G2 — Brama etapu 2:** unit, Playwright, D19-T, D-EUR-T, stylelint — zielone,
liczbami. Pełny przebieg 720, raport grupami, tag `baseline-fala-3a-<data>`.

---

# 7. ETAP 3 — BACKEND

**BK0 — STOP. Dane dostępowe od właściciela.** Wypisz dokładnie, czego
potrzebujesz i gdzie ma to trafić — **nigdy w rozmowie**:

| Zmienna | Gdzie | Uwaga |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | projekt w regionie UE |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | |
| `SUPABASE_SERVICE_ROLE_KEY` | sekrety funkcji, CI | **nigdy w kodzie przeglądarki** |
| `SUPABASE_DB_URL` | lokalnie, CI | do migracji |
| `RESEND_API_KEY` | sekrety funkcji | e-mail z przypomnieniami |
| `MAIL_FROM` | sekrety funkcji | zweryfikowana domena nadawcy |

Plus środowisko testowe: lokalny Supabase przez CLI (Docker), a jeżeli
Dockera nie ma — drugi projekt Supabase `tower-test`. `.env.local` w `.gitignore`.

**BK1 — Migracje i dane startowe.** `supabase db push` z `0001`–`0003`,
potem `supabase/seed/stegra.sql` (organizacje, projekt, warunki płatności
30 i 35 dni — wykonanie wielokrotne jest bezpieczne). Harmonogram pg_cron:
`refresh_payment_status()` codziennie, `purge_personal_data()` codziennie,
`detect_silent_vehicles()` co 15 minut, `detect_sequence_risk()` codziennie.
**Uwaga:** `tests/db/supabase_stub.sql` służy **wyłącznie** do testu na czystym
Postgresie — **nigdy nie uruchamiaj go na Supabase**, nadpisałby schemat `auth`.

**BK2 — Uwierzytelnianie.** Logowanie linkiem e-mail. Trzy organizacje,
role z `0001`. Administrator HHL zaprasza użytkowników i nadaje role.
Konta testowe — po jednym na firmę — w środowisku testowym.

**BK3 — Warstwa danych.** `src/data/` z `DemoProvider` i `SupabaseProvider`.
Zustand zostaje jako pamięć podręczna, nie jako źródło. Magazyn lokalny
v2 nie przenosi danych demonstracyjnych na serwer.

**BK4 — Pliki.** Supabase Storage: PDF faktur, CMR, POD, zdjęcia z aplikacji
kierowcy. **Zdjęcia kierowcy przestają trafiać do `localStorage`** — tam
brakowało miejsca. Linki podpisane, ważne 15 minut. Polityki koszyka
zgodne z `invoice_documents` i widocznością dokumentów z `0001`.

**BK5 — Test widoczności na poziomie API.** Playwright, trzy konta testowe.
KSH w odpowiedzi API **nigdy** nie dostaje: `load_cost`, faktury kosztowej,
jej pozycji ani dokumentów. SCX nigdy: `load_revenue`, faktury przychodowej.
Sprawdzasz **odpowiedź sieciową**, nie ekran.

**BK6 — CI.** `tests/db/run.sh` na usłudze Postgres w GitHub Actions,
`tests/money.test.ts`, unit, Playwright — z `lfs: true` przy pobieraniu kodu
i tymi samymi przeglądarkami co lokalnie. Jeżeli Actions nadal zablokowane
rozliczeniami — hak `pre-push` rozszerzony o `tests/db/run.sh` i zapis
w `POSTEP.md`, że CI czeka na właściciela.

**G3 — Brama etapu 3:** `tests/db/run.sh` **39/39** na czystym Postgresie;
migracje na Supabase bez błędu; BK5 zielony; logowanie trzech kont działa;
aplikacja w trybie Supabase wyświetla dane ze wspólnej bazy.

---

# 8. ETAP 4 — FALA 3B: PIENIĄDZE, FAKTURY, ZLECENIA NA BACKENDZIE

| ID | Pozycja | Kryterium odbioru |
|---|---|---|
| **M2** | Dane v2: EUR z ograniczeniem, trzy poziomy wyceny, **obie wartości** (wyliczona i fakturowana), migawka mnożnika z datą, migawka kursu z numerem tabeli. `STORE_SCHEMA_VERSION` → 2 dla pamięci lokalnej | Z1 sprawdzone testem: faktura nie nadpisuje wyliczonej |
| **M3** | Kurs NBP na żywo: funkcja pobiera przedział `[dzień − 14, dzień − 1]`, zapisuje tabele w `fx_rates`, migawka przy rozładunku. Nigdy pojedynczy dzień | test z `NBP_LIVE=1` zielony; migawka niezmienna po zmianie planu |
| **M4** | Ustawienia użytkownika we wszystkich rolach: język, waluta wyświetlania, motyw. Panel „Preferencje interfejsu" użyty ponownie, pozycja „Ustawienia" w nawigacji KSH i SCX. Zapis w `user_preferences` | przełączenie na PLN zmienia wszystkie kwoty; D-EUR-T zielony w obu trybach |
| **M5** | Numery zleceń: pola `hhl_order_no`, `carrier_order_no`; każda strona edytuje wyłącznie swój (szuflada); **trzy kolumny w Harmonogramie** — KSH, HHL, SCX — obok kodu wysyłki; brak numeru przed terminem → pozycja w kolejce ryzyk i przypomnienie. Tabela przewija się w poziomie, ostatnia kolumna finansowa przyklejona | wymuszenie z bazy działa z interfejsu: próba GOTOWY bez numeru HHL pokazuje zrozumiały komunikat |
| **M6** | Faktury — pełny model trzech stron wg `MECHANIZM_PIENIEDZY.md` sekcja 6: rejestracja przez wystawcę z plikiem PDF; wybór waluty EUR/PLN; netto, VAT i brutto **przepisane z dokumentu** (system nie liczy VAT); **kurs per pozycja podpowiadany z reguły W3**, wystawca potwierdza albo poprawia; kontrole: zły tydzień, niezrealizowany, pominięty z tygodnia, podwójne fakturowanie (blokada w bazie), kwota, opłata paliwowa, tabela, kurs, data kursu, brak kursu; **dwa niezależne statusy**: weryfikacja (ustawia odbiorca) i płatność (ustawia HHL). **KSH: nowy moduł Faktury** — wyłącznie faktury HHL dla KSH, przy każdej PDF + CMR + POD, kontrola wobec cen KSH (nigdy kosztu), akcje ZGODNA / SPORNA z uzasadnieniem / ZAAKCEPTOWANA. **HHL:** sekcje kosztowe i przychodowe; kreator faktury przychodowej wzorem kreatora SCX. **SCX:** rejestracja, statusy, termin — bez oznaczania „Opłacona". Numery zleceń na pozycjach faktur. Q13: powiadomienie KSH o nowej fakturze HHL | BK5 obejmuje faktury; `tests/db` zielone; ścieżka od rejestracji przez SCX do oznaczenia przez HHL przechodzi na trzech kontach |
| **M7** | Terminy i płatności: termin = wystawienie + 30 dni (KSH) / 35 dni (HHL wobec SCX), termin z dokumentu ma pierwszeństwo; `refresh_payment_status()` codziennie, w obie strony; przypomnienia −3/0/+1/+7/+14 **wyłącznie do płatnika i wierzyciela tej faktury**, e-mailem (Resend) i w centrum powiadomień, w języku odbiorcy, kwota w walucie faktury; opłacona → cisza. „Opłacona" tylko przez funkcję HHL z datą zapłaty; cofnięcie tylko z powodem; oba w dzienniku audytu | test: KSH nie dostaje przypomnień o fakturach SCX; przypomnienie nie wychodzi po oznaczeniu |
| **M8** | Niezmiennik i poziomy w ścieżce wyceny: `assertSameMechanism` wywoływany przy każdym wyliczeniu; kokpit i widoki z oznaczeniem poziomu i kursu prowizorycznego; szuflada — zakładka Ceny pokazuje poziom i datę mnożnika | test: rozjazd mnożników przerywa wyliczenie |
| **M9** | Aplikacja kierowcy: pozycja **ciągła** (`watchPosition`) zamiast jednorazowej, wysyłana do `process_position()` z `0002` — geofencing z histerezą, czasem przebywania i odbiciem; zdjęcia do Storage. **Zgoda kierowcy na lokalizację** przy pierwszym uruchomieniu, w jego języku (PL/EN/SV); bez zgody działają wyłącznie przyciski etapów. **Współrzędne stref terminali Gdańsk i Nynäshamn** zweryfikuj z mapą — Research zgłosił je jako przybliżone | zdarzenia stref powstają z pozycji testowych; odmowa zgody nie blokuje przycisków |
| **D26** | Import harmonogramu — usunięcia za wyraźną zgodą: pole wyboru w podglądzie, domyślnie odznaczone, z liczbą i listą kodów; `allowRemovals` przekazywane z interfejsu. Podgląd **przestaje pokazywać usunięcia, których system nie wykona** | test w zestawie D23 |
| **D23-S** | Wariant testu importu na realnej skali — siedemdziesiąt kilka wierszy, bo usterka historyczna dotyczyła 72 | zielony |

**G4 — Brama etapu 4:** wszystkie testy liczbami (unit, money, db, Playwright,
D19-T, D-EUR-T, BK5); przebieg 720 na `DemoProvider` z nowymi widokami
(Faktury KSH, faktury przychodowe HHL, Ustawienia) — **podaj nową liczbę ujęć**;
dodatkowo zestaw kontrolny w trybie PLN: kokpit i harmonogram, każda rola,
1440, motyw domyślny roli. Raport grupami, tag `baseline-fala-3b-<data>`.

---

# 9. ETAP 5 — FALA 4: INFRASTRUKTURA

| ID | Pozycja | Kryterium odbioru |
|---|---|---|
| **D14** | Trasy adresowalne: `/harmonogram`, `/mapa`, `/transport/SG-32`, `/faktury`, `/ustawienia`; rola i język w trwałym ustawieniu | link do transportu otwiera szufladę |
| **D15** | Podział paczki, mapa ładowana leniwie. Cel: pierwsze wczytanie **poniżej 400 kB** | rozmiar przed i po w raporcie |

**G5 — Brama etapu 5:** testy zielone; raport rozmiaru paczki.

---

# 10. ETAP 6 — ODBIÓR KOŃCOWY

| ID | Pozycja |
|---|---|
| **O1** | Pełny komplet, liczbami: unit, money, `tests/db`, Playwright, D19-T, D-EUR-T, BK5, stylelint, 720, **pełny przebieg 14 prób (D24) na paczce produkcyjnej z sumą kontrolną** |
| **O2** | Wdrożenie produkcyjne na Vercel ze zmiennymi środowiskowymi; migracje na produkcyjnym Supabase; dane startowe |
| **O3** | Test dymny na produkcji: logowanie trzech kont, widoczność faktur, jeden transport od importu do rozładunku |
| **O4** | Oznaczenie danych demonstracyjnych **zostaje** do potwierdzenia przez właściciela prawdziwych stawek i parametrów opłaty paliwowej. Panel warunków drogowych SE zostaje demonstracyjny do czasu klucza Trafikverket |
| **O5** | Raport końcowy w `docs/handover/RAPORT_KONCOWY.md`: co zrobione, co otwarte i dlaczego, liczby. Tag `release-1.0` |

**Poza zakresem tego zlecenia — zapisz w `POSTEP.md` jako otwarte, nie pomijaj:**
- adapter telematyki przewoźnika — czeka na nazwę systemu i dostęp do API
  od Scandinavian Express
- parametry operacyjne od przewoźnika: cutoff promu, progi fal, prędkość
  planowana ponadgabarytu
- geometria trasy z zezwolenia do wykrywania zjazdu z trasy — czeka
  na zezwolenia z trasą
- klucz Trafikverket
- **źródło statusu promów Polferries** — dane startowe z ręczną aktualizacją
  czy odczyt strony komunikatów (Research ostrzega przed regulaminem);
  decyzja właściciela, do tego czasu dane startowe
- rozbicie marży na trzy poziomy — czeka na zgodę
- włączenie rozliczeń GitHub Actions i wypchnięcie `unit.yml` — właściciel

---

# 11. RAPORTOWANIE

**Po każdej pozycji:** wiersz w `POSTEP.md` — ID, commit, testy liczbami.

**Po każdym etapie, w rozmowie:**
```
ETAP <n> — <nazwa>: ZAMKNIĘTY / STOP
pozycje: <zamknięte>/<wszystkie>
testy: unit x/x · money x/x · db x/x · pw x/x · D19-T · D-EUR-T · BK5 · stylelint · visual x/x
wzorzec: <zmienione>/<wszystkie>, tag <tag>
otwarte: <lista z powodem>
następny: ETAP <n+1>
```

---

# 12. LISTA KONTROLNA — WSZYSTKIE IDENTYFIKATORY

Twoja tabela w `POSTEP.md` musi zawierać każdy z nich, plus pozycje L
po przydziale w F2.5 i niezgodności znalezione w F2.4.

**Etap 0:** P0.1 · P0.2 · P0.3
**Etap 1:** F2.1 · F2.2 · F2.3 · F2.4 · F2.5 · F2.6 · G1
**Etap 2:** D19-T · D10 · D17 · M1 · D11 · D19 · D12 · D6 · D13 · D18 · P6 · D-EUR-T · D25 · G2
**Etap 3:** BK0 · BK1 · BK2 · BK3 · BK4 · BK5 · BK6 · G3
**Etap 4:** M2 · M3 · M4 · M5 · M6 · M7 · M8 · M9 · D26 · D23-S · G4
**Etap 5:** D14 · D15 · G5
**Etap 6:** O1 · O2 · O3 · O4 · O5

**Łącznie: 51 pozycji.**

Zacznij od P0.1.


---

# ANEKS 1

> Dopisano 25.09.2026 (AN1.1) — pełna treść aneksu właściciela `ANEKS_1_DLA_GROKA.md`, bez zmian. Od teraz część zlecenia.

# ANEKS 1 DO ZLECENIA KOŃCOWEGO

> Nowe decyzje właściciela i poprawki kontraktu bazy. **Nie przerywaj
> bieżącej pozycji** — dokończ ją, zrób commit, potem wykonaj AN1.

---

# AN1 — ZASTOSUJ ANEKS (przed następną pozycją zlecenia)

**AN1.1 — Zapisz aneks.** Cała treść na końcu `docs/handover/ZLECENIE_FINAL.md`
jako sekcja „ANEKS 1". Commit: `docs: aneks 1`. Od teraz aneks jest częścią
zlecenia — czytasz go z pliku, jak resztę.

**AN1.2 — Pliki z pakietu.** Właściciel umieścił `TOWER-pakiet-aneks1.zip`
w `~/Downloads`. Nie znajdziesz — STOP, poproś.

| Z pakietu | Do repozytorium | Co się zmieniło |
|---|---|---|
| `STATUSY_AUTOMATYCZNE.md` | `docs/handover/` | **nowy** — jedyne źródło prawdy o statusach, rejsach, strefach |
| `MECHANIZM_PIENIEDZY.md` | `docs/handover/` | wersja 2.2: rozbicie marży zatwierdzone, zasada Z4 |
| `AGENTS.md` | korzeń repozytorium | **nowy** — zasady dla Cursora i każdego agenta |
| `.cursor/rules/tower.mdc` | `.cursor/rules/` | **nowy** — reguła zawsze aktywna w Cursorze |
| `supabase/migrations/0002_geofence_engine.sql` | zastępuje | **trzy usterki naprawione** — patrz niżej |
| `supabase/migrations/0004_statusy_automatyczne.sql` | **nowy** | rejsy, automat statusów, PROM, ochrona kolumn transportu, harmonogram zadań |
| `supabase/seed/stegra.sql` | zastępuje | + pięć stref korytarza, + dwa statki |
| `tests/db/*` | zastępuje | `security.sh` 50 przypadków, **nowy `status.sh` 44**, `run.sh` uruchamia oba |
| `SCOPE.md` | `docs/handover/` | sekcja 37 |

**AN1.3 — Uruchom `bash tests/db/run.sh`.** Oczekiwane: **security 50/50,
status 44/44.** Inny wynik — STOP.

**AN1.4 — Dopisz do `POSTEP.md`** pozycje AN1, M10, M11 i zmiany zakresu
pozycji M5, M6, M9, BK1, BK5 opisane niżej.

---

# 1. NOWE DECYZJE WŁAŚCICIELA

| # | Decyzja |
|---|---|
| S1 | **Statusy zmieniają się na podstawie pozycji** |
| S2 | **Port PL i port SE mają swoje strefy** — wjazd auta = automatyczna zmiana statusu |
| S3 | **PROM:** auto w strefie portu Gdańsk + nadchodzi **czas wypłynięcia wg rozkładu armatora** dla **rejsu przypisanego do auta** → system **sam przełącza na PROM** |
| — | **Rozbicie marży w Finansach — zatwierdzone** |
| — | **GitHub Actions — odłożone.** Pozostaje hak `pre-push` |
| — | **Po Twojej pracy budowę dokończy Cursor** — patrz sekcja 4 |

Szczegóły: `docs/handover/STATUSY_AUTOMATYCZNE.md`.

---

# 2. CO WYKRYŁ TEST BAZY — MUSISZ TO WIEDZIEĆ

**Silnik stref z migracji 0002 nigdy nie działał.** Trzy błędy czasu
wykonania, niewidoczne dla parsera:

- **G1** nazwy kolumn wyniku funkcji takie same jak kolumny tabel —
  każda pozycja w pobliżu strefy kończyła się błędem i **przepadała**
- **G2** zapis zdarzenia bez warunku indeksu częściowego — **żaden wjazd
  ani wyjazd nie mógł powstać**
- **G3** promień strefy w odwzorowaniu Mercatora — strefy **40–60% mniejsze**,
  im dalej na północ, tym gorzej: port Gdańsk 463 m zamiast 800, plac
  Stegra 613 m zamiast 1 500

**Dziura bezpieczeństwa od migracji 0001:** Supabase nadaje rolom prawo
zmiany całej tabeli, więc lista kolumn przewoźnika niczego nie ograniczała.
**Przewoźnik mógł zmienić numer zlecenia HHL i KSH we własnym transporcie.**
Naprawione wyzwalaczem w 0004. Wcześniejszy test 39/39 tego nie złapał,
bo sprawdzał, co przewoźnikowi wolno, a nie czego mu nie wolno.

**Wniosek dla Ciebie:** jeżeli gdziekolwiek w kodzie aplikacji użyłeś
pól `ferry_vessel` albo `ferry_departure` — **usunięto je**. Dane o rejsie
czytasz z `sailings` przez `loads.sailing_id`.

---

# 3. ZMIANY ZAKRESU

## Nowe pozycje

**M10 — Rejsy i automat statusów w aplikacji** (etap 4, po M6):
- **HHL zarządza rozkładem rejsów:** dodawanie, opóźnienie (nowy czas
  odejścia i przypłynięcia), odwołanie. Źródło statusu Polferries pozostaje
  decyzją otwartą właściciela — do tego czasu ręcznie
- **przypisanie rejsu do transportu** w szufladzie: HHL i przewoźnik;
  po wypłynięciu wyłącznie HHL
- oś zdarzeń w szufladzie pokazuje **zmiany automatyczne** (`STATUS_AUTO`)
  z powodem — wjazd w strefę, odejście rejsu
- kolejka ryzyk: nowe rodzaje — **AUTO_STATUS** (zmiana zablokowana,
  z przyczyną), **LOADING_UNCONFIRMED**, rejs przegapiony, rejs odwołany,
  PROM po czasie — teksty w PL, EN, SV
- błędy bazy pokazywane zrozumiale: „Data rozładunku zamrożona —
  transport jest na fakturze", „Status nie może się cofnąć", „Numer
  zlecenia przewoźnika wpisuje wyłącznie przewoźnik"
- *kryterium:* ścieżka jednego transportu od wjazdu do portu przez PROM
  do placu budowy widoczna w aplikacji na trzech kontach testowych

**M11 — Rozbicie marży w Finansach** (etap 4, po M2):
- trzy wiersze w istniejącym bloku „Od przychodu do marży", wzorzec `.mrow`:
  zafakturowana, zrealizowana niezafakturowana, prognozowana
- sumy z `totalsByTier`, w walucie wyświetlania użytkownika
- *kryterium:* suma trzech wierszy = marża łączna; test jednostkowy

## Zmienione pozycje

**BK1** — migracje 0001–**0004**; **przed migracją włącz rozszerzenie
`pg_cron`** w panelu Supabase — 0004 sama zaplanuje zadania: PROM co minutę,
PROM po czasie co 10 minut, cisza GPS co 15 minut, terminy płatności,
RODO, kolejność montażowa. Seed `stegra.sql` zakłada strefy i statki.

**BK5** — test API rozszerzony: przewoźnik próbujący zmienić numer
zlecenia HHL albo KSH przez API dostaje błąd, nie sukces.

**M5** — przewoźnik zmienia wyłącznie swój numer, HHL wyłącznie swój.
**HHL nie może zmienić numeru zlecenia przewoźnika** — decyzja W12,
wymusza baza.

**M6** — faktura: po umieszczeniu transportu na fakturze **data rozładunku
jest zamrożona** dla wszystkich poza HHL (zasada Z4).

**M9** — aplikacja kierowcy wysyła zdarzenia zgodnie z
`STATUSY_AUTOMATYCZNE.md` sekcja 6:
- przycisk „Załadowany" → zdarzenie `MILESTONE_LOADED`
- przycisk „Rozładowany" → status UNLOADED **razem z datą rozładunku**
  w jednej zmianie — baza odrzuca UNLOADED bez daty
- pozycje przez `process_position()`
- **strefy załadunku** z `docs/watch-tower/ADDRESSES.md` do danych
  startowych — bez zgadywania współrzędnych; **współrzędne terminali
  zweryfikuj z mapą**

## Brama etapu 3 i etapu 4

Zamiast `tests/db/run.sh 39/39` — **security 50/50 i status 44/44**.

## Lista kontrolna

Dochodzą: **AN1 · M10 · M11**. **Łącznie 54 pozycje.**

---

# 4. PRZEKAZANIE CURSOROWI

Budowę po Tobie dokończy Cursor. Dlatego:

1. `AGENTS.md` i `.cursor/rules/tower.mdc` **commitujesz w AN1** — Cursor
   czyta je sam przy każdej zmianie
2. `POSTEP.md` musi być **aktualny po każdej pozycji** — Cursor zacznie
   od niego
3. Jeżeli nie zamkniesz całego zlecenia — **raport końcowy O5 piszesz
   i tak**, w `docs/handover/RAPORT_KONCOWY.md`: co zamknięte (z commitami
   i liczbami testów), co otwarte, **na czym dokładnie stanąłeś** (plik,
   gałąź, ostatni zielony commit), co wymaga decyzji właściciela. To jest
   dokument startowy dla Cursora
4. Zostawiasz repozytorium **zielone**: wszystkie testy przechodzą na
   ostatnim commicie gałęzi `main`, albo w raporcie jest dokładnie
   opisane, który test jest czerwony i dlaczego

Wróć do bieżącej pozycji zlecenia.


---

# ANEKS 2

> Dopisano 25.09.2026 (AN2.1) — pełna treść aneksu właściciela `ANEKS_2_DLA_GROKA.md`, bez zmian. Od teraz część zlecenia.

# ANEKS 2 DO ZLECENIA KOŃCOWEGO

> **Nie przerywaj bieżącej pozycji.** Dokończ ją, commit, potem AN2.

---

# AN2 — ZASTOSUJ ANEKS

**AN2.1 — Zapisz aneks** na końcu `docs/handover/ZLECENIE_FINAL.md` jako
sekcja „ANEKS 2". Commit: `docs: aneks 2`.

**AN2.2 — Pliki z pakietu** `TOWER-pakiet-aneks2.zip` w `~/Downloads`
(nie znajdziesz — STOP, poproś):

| Z pakietu | Do repozytorium | Zmiana |
|---|---|---|
| `ZRODLA_DANYCH.md` | `docs/handover/` | **nowy** — jedyne źródło prawdy o danych zewnętrznych |
| `STATUSY_AUTOMATYCZNE.md` | `docs/handover/` | przewoźnik nie zmienia okien planowych |
| `AGENTS.md`, `.cursor/rules/tower.mdc` | korzeń, `.cursor/rules/` | dopisany `ZRODLA_DANYCH.md` |
| `supabase/migrations/0004_statusy_automatyczne.sql` | zastępuje | okna planowe poza listą przewoźnika; `vessels.mmsi`, `vessels.imo` |
| `supabase/seed/stegra.sql` | zastępuje | operator POLSCA Baltic Ferries; MMSI i IMO promu Nova Star |
| `tests/db/security.sh` | zastępuje | **52 przypadki** (+2: okna planowe) |
| `lib/ferry/polferries.ts`, `lib/ferry/digitraffic.ts` | `src/lib/ferry/` | **nowe** — parser komunikatów armatora, klient AIS |
| `tests/ferry.test.ts` | `tests/` | **nowy — 17 testów** |
| `tests/fixtures/polferries-komunikaty-2026-09-25.html`, `digitraffic-nova-star-2026-09-25.json` | `tests/fixtures/` | prawdziwe dane z 25.09.2026 |
| `SCOPE.md` | `docs/handover/` | sekcja 38 |

**AN2.3 — Testy:** `bash tests/db/run.sh` → **security 52/52, status 44/44**;
`npx vitest run tests/ferry.test.ts` → **17/17**. Inny wynik — STOP.

**AN2.4 — `POSTEP.md`:** dopisz AN2 i M12, zaktualizuj opis D3, M5, M10.

---

# 1. DECYZJE WŁAŚCICIELA

| # | Decyzja |
|---|---|
| — | **Przewoźnik nie może zmieniać okien planowych** załadunku i dostawy. Plan pochodzi z harmonogramu KSH. **Wymusza baza** (0004), sprawdzone testem |
| — | Źródła danych zewnętrznych muszą być **darmowe** — wybrane i zweryfikowane w `ZRODLA_DANYCH.md` |

---

# 2. ZMIANY ZAKRESU

## Nowa pozycja

**M12 — Integracje danych zewnętrznych** (etap 4, po M10). Wszystko wg
`docs/handover/ZRODLA_DANYCH.md`. Funkcje Edge wywoływane z pg_cron:

| Funkcja | Co | Częstotliwość | Wymaga |
|---|---|---|---|
| `ferry-schedule` | import rozkładu cargo armatora do `sailings` | raz w tygodniu + ręcznie przez HHL | — |
| `ferry-status` | `parsePolferriesStatus` → opóźnienie, odwołanie, NIEZNANY | **co 15 min, nie częściej** | — |
| `ferry-ais` | `fetchVesselFix` dla statków z rejsem w toku | co 10 min | — |
| `road-se` | Trafikverket: Situation, RoadCondition, WeatherStation przez GetBuffer wzdłuż E4 | co 10 min | klucz |
| `road-pl` | KPD GDDKiA, DATEX II | wg warunków KPD | rejestracja, certyfikat |
| `traffic-flow` | TomTom: prędkość bieżąca wobec swobodnej przy aktywnych autach | co 15 min na auto | klucz |

**Zasady, bez wyjątków:**
- **pierwszeństwo źródeł rejsu: `RECZNIE` > `POLFERRIES` > `DANE_STARTOWE`** —
  zmiany ręcznej HHL odczyt automatyczny nie nadpisuje
- status NIEZNANY z komunikatów → **bez zmiany rejsu**, ryzyko dla HHL
- każda awaria źródła albo zmiana struktury strony → ryzyko „źródło
  niedostępne" widoczne w kolejce, **nigdy cicha pustka**
- ryzyka drogowe w istniejących rodzajach `ROAD_SE` i `ROAD_PL`
- **atrybucje z sekcji 4 `ZRODLA_DANYCH.md` w interfejsie** — Digitraffic
  obowiązkowo (CC BY 4.0)
- funkcja bez klucza (brak `TRAFIKVERKET_API_KEY`, `TOMTOM_API_KEY`) —
  panel zostaje oznaczony jako dane demonstracyjne (D18), funkcja nie działa
  na niby
- klucze wyłącznie w sekretach funkcji

*Kryterium odbioru:* `ferry-status` zapisuje rejsy z prawdziwej strony
do bazy testowej; przy braku kluczy panele drogowe mają oznaczenie
demonstracyjne; test jednostkowy każdej funkcji na zapisanych danych,
bez sieci.

## Zmienione pozycje

**D3** — panel warunków drogowych SE przechodzi z danych demonstracyjnych
na Trafikverket, **gdy właściciel założy klucz**. Do tego czasu bez zmian.

**M5, M10** — w szufladzie i formularzach **przewoźnik nie widzi pól
okien planowych jako edytowalnych**. Baza i tak odrzuci zmianę; interfejs
nie może jej proponować.

## Brama etapu 3 i 4

`tests/db/run.sh`: **security 52/52, status 44/44**; `tests/ferry.test.ts`: **17/17**.

## Lista kontrolna

Dochodzą: **AN2 · M12**. **Łącznie 56 pozycji.**

Wróć do bieżącej pozycji zlecenia.


---

# ANEKS 3

> Dopisano 26.09.2026 — pełna treść dokumentu właściciela `DECYZJE_WYDANIE_1_0.md`, bez zmian. Od teraz część zlecenia.

# DECYZJE DO WYDANIA 1.0

> Odpowiedź na oba Twoje pytania — z zamknięcia etapu 4 i z etapu 6.
> Zapisz na końcu `docs/handover/ZLECENIE_FINAL.md` jako „ANEKS 3",
> dopisz pozycje do `POSTEP.md`, potem realizuj w kolejności z sekcji 5.

---

# 1. TERAZ — WYPCHNIJ

**Tak, wypchnij 7 commitów natychmiast**, zanim zrobisz cokolwiek innego.
Praca tylko na dysku to jedna kopia — ten sam problem, który zamykaliśmy
w etapie 0.5. Potem weryfikacja drzew jak w 0.5a: suma drzewa lokalnie
równa sumie zdalnej, wynik jedną linią.

**Uzupełnij raport liczbami.** „Testy na serwerze Supabase też przechodzą"
to nie jest liczba. Podaj każdy zestaw osobno: unit, money, ferry,
security, status, BK5, D19-T, D-EUR-T, stylelint, visual, 14 prób.

**O2 i O3 nie są zamknięte.** O2 to wdrożenie produkcyjne, O3 test dymny
na produkcji — żadne z nich jeszcze się nie odbyło. Oznacz w `POSTEP.md`
jako otwarte.

---

# 2. DECYZJE Z ETAPU 4

## 2.1 Import usuwający transporty w drodze — BLOKUJEMY

Transport od wjazdu na załadunek istnieje fizycznie: ciężarówka ze stalą,
pozycje GPS, zdarzenia, być może faktura. Import harmonogramu nie może
tego skasować.

- **usunięcie przez import = anulowanie** (status CANCELLED), **nigdy
  fizyczne skasowanie wiersza** — historia, pozycje i dziennik zostają
- dozwolone **wyłącznie** dla statusów PLANNED, RESOURCES_PENDING,
  DOCS_PENDING, READY — **od AT_LOADING zablokowane**
- **transport na jakiejkolwiek fakturze — zablokowany** niezależnie od statusu
- transport w drodze, który naprawdę trzeba wycofać — anuluje HHL ręcznie,
  z powodem, w dzienniku audytu
- **wymusza baza:** zakaz `DELETE` na `loads` dla ról API; przejście
  do CANCELLED z importu tylko przy spełnieniu warunków
- podgląd importu pokazuje transporty, których usunąć nie można, z powodem

*Testy bazy:* import nie anuluje transportu w AT_LOADING i dalej; nie
anuluje zafakturowanego; `DELETE` odrzucony dla każdej roli API; anulowanie
w READY działa i zostawia wiersz.

## 2.2 Ryzyka widoczne dla wszystkich — NIE

To ten sam rodzaj wycieku co koszt i przychód. Ryzyko rozbieżności
na fakturze przewoźnika zawiera kwoty kosztu HHL — KSH nie może go zobaczyć.
Ryzyko kolejności montażu to informacja klienta — przewoźnik nie musi.

- nowa kolumna `risk_signals.audience`: `HHL` · `HHL_PRZEWOZNIK` ·
  `HHL_KLIENT` · `WSZYSCY`
- **domyślnie `HHL` — zasada zamkniętych drzwi.** Rodzaj nieprzypisany
  niżej widzi wyłącznie HHL
- przypisanie:

| Rodzaj | Odbiorcy |
|---|---|
| FERRY, ROAD_SE, ROAD_PL, WEATHER, ETA_BREACH | `WSZYSCY` |
| SILENT_VEHICLE, AUTO_STATUS, LOADING_UNCONFIRMED, RESOURCE_MISSING, DOC_MISSING, PERMIT, INSURANCE | `HHL_PRZEWOZNIK` |
| SEQUENCE | `HHL_KLIENT` |
| INVOICE_MISMATCH — faktura kosztowa | `HHL_PRZEWOZNIK` |
| INVOICE_MISMATCH — faktura przychodowa | `HHL_KLIENT` |

- przewoźnik widzi ryzyka **wyłącznie swoich transportów** i ryzyka
  korytarza bez przypisanego transportu; klient — swojego projektu
- **wymusza baza, polityka RLS**, nie interfejs

*Testy bazy:* KSH nie widzi ryzyka faktury kosztowej; SCX nie widzi ryzyka
faktury przychodowej ani kolejności montażu; SCX nie widzi ryzyk transportów
innego przewoźnika; ryzyko nowego, nieprzypisanego rodzaju widzi tylko HHL.

## 2.3 Kierowca bez logowania — TAK, zostaje, pod warunkami

Kierowcy są pracownikami przewoźnika i często się zmieniają; konto dla
każdego to przeszkoda, nie zabezpieczenie. Link z tokenem zostaje, jeżeli:

- token losowy co najmniej 128 bitów, przechowywany jako skrót, nie jawnie
- **jeden token = jeden transport**; nie da się nim zapisać niczego
  w innym transporcie
- token wyłącznie zapisuje pozycje, zdarzenia etapów i zdjęcia; odczytuje
  tylko instrukcje dla kierowcy — **żadnych cen, żadnych innych transportów**
- ważność: do 24 h po rozładunku, maksymalnie 14 dni; odwoływalny przez
  przewoźnika i HHL; nowy token unieważnia poprzedni
- pozycje i zdarzenia etapów przez funkcję SQL ze sprawdzeniem skrótu
  tokenu i limitem zapytań (budżet planu darmowego — ANEKS 4, PR6);
  zdjęcia przez funkcję Edge

*Testy:* token transportu A odrzucony przy zapisie do B; token wygasły
i odwołany — odrzucony; odpowiedź nie zawiera żadnego pola cenowego.

## 2.4 Numer zlecenia 48 godzin wcześniej — TYLKO OSTRZEŻENIE

Blokady zostają tam, gdzie są (decyzja Q10): numer HHL przed GOTOWY,
numer przewoźnika przed załadunkiem. **48 godzin przed planowanym
załadunkiem brak numeru = ryzyko i przypomnienie**, nie blokada:
- brak numeru przewoźnika → ryzyko z odbiorcami `HHL_PRZEWOZNIK`,
  przypomnienie do przewoźnika
- brak numeru HHL → ryzyko `HHL`, przypomnienie do HHL

---

# 3. POLSKIE ZNAKI — POPRAW PRZED WYDANIEM

Tak. „Marza" i „Zalaczniki" w wersji 1.0 to błąd widoczny dla klienta.

**Trzy warunki:**

1. **Zmieniasz wyłącznie napisy wyświetlane.** Identyfikatory w bazie —
   `OPLACONA`, `ODWOLANY`, `PO_TERMINIE`, `ZLY_TYDZIEN` i pozostałe —
   **zostają ASCII**: to kontrakt migracji i testów. Jeżeli któryś
   z 25 napisów to surowa wartość z bazy pokazana w interfejsie —
   to regresja D11: mapowanie przez słownik, nie zmiana wartości w bazie
2. **Test, żeby nie wróciło.** D19-T łapie polskie znaki w EN i SV — nic
   nie łapie ich braku w PL. Nowy test **PL-T**: słownik języka polskiego
   (hunspell `pl_PL`) na wszystkich wartościach słownika PL, z listą
   wyjątków dla kodów i skrótów. Czerwony przy „Marza", zielony po poprawce
3. **Kontrola wzorca:** jeden przebieg 840 po poprawce. **Mogą się zmienić
   wyłącznie ujęcia w języku polskim. Ujęcia EN i SV: dokładnie 0 zmian.**
   Jakakolwiek zmiana w EN albo SV — STOP, to znaczy, że dotknąłeś czegoś
   poza napisami. Raport i tag `baseline-1.0-<data>`

---

# 4. O2 — PRODUKCJA

## 4.1 Obecny projekt Supabase = TESTOWY

Ma konta testowe, dane z testów i konta BK5. Zostaje środowiskiem testowym.
Testy dalej chodzą na nim, nie na produkcji.

## 4.2 Produkcja = nowy projekt, plan darmowy

**Decyzja właściciela: wszystko na planach darmowych.** Szczegóły,
zabezpieczenia i budżety: **`ANEKS_4_PRODUKCJA_ZA_DARMO.md`** — pozycje PR1–PR8.

Ty na produkcji:
- migracje wszystkie, w kolejności; `pg_cron` włączony przed migracjami
- **wyłącznie** `supabase/seed/stegra.sql` — **nigdy `tests/db/seed.sql`
  ani `supabase_stub.sql`**
- funkcja `ferry-schedule` pobiera prawdziwe rejsy od nowa
- sekrety funkcji: te same nazwy, wartości produkcyjne
- konta: tylko prawdziwi użytkownicy; kont testowych nie ma

## 4.3 Vercel — plan darmowy, z zapasowym hostingiem

**Decyzja właściciela: Vercel na planie darmowym. Planu Pro nie będzie.**

Regulamin planu darmowego dopuszcza wyłącznie użytek osobisty,
niekomercyjny. Ryzyko to wstrzymanie projektu przez Vercel — aplikacja
przestaje wtedy działać dla wszystkich trzech firm. Dlatego wstrzymanie
ma trwać minuty, nie dni:

**a) Aplikacja nie zależy od niczego, co ma tylko Vercel.** To statyczna
strona; całe zaplecze działa w Supabase. Żadnych funkcji serwerowych
Vercel, żadnych zmiennych, bez których build nie działa gdzie indziej.
Sprawdź i napisz jedną linią, że tak jest.

**b) Zapasowy hosting w gotowości.** Ten sam build wdrożony równolegle
na **Cloudflare Pages, plan darmowy** — statyczne pliki są tam bezpłatne
i bez limitu, a regulamin nie zawiera zakazu użycia komercyjnego, jaki ma
Vercel i GitHub Pages. Wdrażany przy każdym wydaniu, tak jak Vercel.

**c) Domena pod kontrolą właściciela, nie Vercel.** Serwery nazw domeny
u rejestratora albo w Cloudflare — nie przeniesione do Vercel. Przełączenie
na zapas = zmiana jednego rekordu DNS.

**d) Procedura przełączenia** w `docs/handover/PRZELACZENIE_HOSTINGU.md`:
kroki, kto, ile trwa. **Przetestowana raz**, z wynikiem w `POSTEP.md`.

**e) Ustawienia planu darmowego:**
- w ustawieniach zespołu Vercel **wyłącz zgodę na użycie treści
  do trenowania modeli** — na planie darmowym jest domyślnie włączona
- wdrożenia podglądowe są na planie darmowym **publiczne** — wskazują
  wyłącznie na **testowy** Supabase; klucza `service_role` nie ma
  w żadnym buildzie, nigdzie

Środowisko produkcyjne wskazuje na produkcyjny projekt Supabase. Oznaczenie
danych demonstracyjnych zostaje do potwierdzenia stawek (O4).

## 4.4 Token Supabase

Nowy token dostępu zakłada właściciel i umieszcza **w pliku środowiskowym
na Twojej maszynie** (`SUPABASE_ACCESS_TOKEN`), nigdy w rozmowie.
Po zakończeniu wdrożenia — **właściciel go odwołuje**. Zanim włączysz
funkcje i integracje — napisz, na którym projekcie: testowym czy
produkcyjnym.

---

# 5. KOLEJNOŚĆ

```
1   wypchnięcie 7 commitów + weryfikacja drzew
2   raport liczbami, O2 i O3 jako otwarte
3   2.1 import: anulowanie zamiast kasowania, blokada od AT_LOADING   ← z testami bazy
4   2.2 widoczność ryzyk, zamknięte drzwi                            ← z testami bazy
5   2.3 warunki tokenu kierowcy                                      ← z testami
6   2.4 ostrzeżenie 48 h
7   3   polskie znaki + PL-T + wzorzec: EN i SV = 0 zmian
    PR1–PR8 z ANEKSU 4 — produkcja za darmo
    ── czekasz na właściciela: działania z sekcji 10 ANEKSU 4 ──
8   4.2 produkcja: migracje, seed stegra, rejsy, sekrety
9   4.3 wdrożenie produkcyjne: Vercel + zapas Cloudflare Pages + test przełączenia
10  O3 test dymny NA PRODUKCJI
11  O5 raport końcowy
12  tag release-1.0 — na commicie, który działa na produkcji
```

**Tag `release-1.0` dopiero po O3 na produkcji.** Wersja wydana to wersja,
która działa u użytkowników — nie ta, która przeszła testy lokalnie.

Punkty 2.1–2.4 są przed wydaniem, bo dwa z nich to bezpieczeństwo danych.


---

# ANEKS 4

> Dopisano 26.09.2026 — pełna treść dokumentu właściciela `ANEKS_4_PRODUKCJA_ZA_DARMO.md`, bez zmian. Od teraz część zlecenia; zastępuje §4.2 Aneksu 3 i doprecyzowuje §2.3.

# ANEKS 4 — PRODUKCJA W CAŁOŚCI ZA DARMO

> **Decyzja właściciela: wszystko na planach darmowych — Supabase, Vercel,
> integracje. Bez planów płatnych, nigdy.** Zapisz na końcu
> `docs/handover/ZLECENIE_FINAL.md` jako „ANEKS 4". Zastępuje w
> `DECYZJE_WYDANIE_1_0.md` sekcję 4.2 i doprecyzowuje sekcję 2.3.

Plan płatny daje sam z siebie cztery rzeczy, które na darmowym trzeba
zbudować: brak usypiania, kopie zapasowe, zapas limitów, pocztę. Ten aneks
je buduje. Wszystko poniżej sprawdzone 26.09.2026 — **warunki darmowych
planów zmieniają się; przy zakładaniu każdego konta sprawdź je jeszcze raz.**

---

# 1. SUPABASE — DWA PROJEKTY, TO CAŁY LIMIT

Plan darmowy pozwala na **dwa aktywne projekty**:
- **testowy** — obecny, zostaje
- **produkcyjny** — nowy, **region UE**

Trzeciego nie ma. Nie zakładaj tymczasowych projektów, nie usuwaj testowego.

---

# 2. USYPIANIE PO 7 DNIACH — PR1

Supabase usypia darmowy projekt przy zbyt małej **aktywności użytkowników
w bazie** w ciągu tygodnia. Codzienne użycie to zwykle wystarcza, ale
dwa tygodnie przerwy świątecznej już nie.

- **Cloudflare Worker, plan darmowy, wyzwalacz czasowy co 6 godzin**
  wywołuje funkcję `keep_alive()` w bazie produkcyjnej — prawdziwe zapytanie
  (zapis znacznika w tabeli `system_heartbeat`), nie sam ping adresu
- **nie opieraj tego na pg_cron** — zadania wewnątrz bazy mogą nie liczyć
  się jako aktywność użytkowników
- ten sam Worker sprawdza odpowiedź; błąd → e-mail do administratora HHL
  „baza produkcyjna nie odpowiada"
- **Supabase wysyła ostrzeżenie tydzień przed uśpieniem** na adres właściciela
  konta — to musi być skrzynka, którą ktoś czyta. Uśpiony projekt przywraca
  się jednym kliknięciem

*Kryterium:* Worker działa, znacznik w bazie odświeża się co 6 h, symulowany
błąd wysyła e-mail.

---

# 3. KOPIE ZAPASOWE — PR2

Na planie darmowym **kopii nie da się pobrać**; Supabase zaleca własne zrzuty.

**Codziennie o 02:30**, funkcja Edge `backup-export` (pg_cron):
- `COPY` wszystkich tabel biznesowych do CSV, kompresja gzip
- **szyfrowanie kluczem publicznym** (age, X25519). Klucz prywatny ma
  **wyłącznie właściciel, poza wszystkimi systemami** — zapis na papierze
  albo nośniku offline. W sekretach funkcji tylko klucz publiczny
- zapis do **Cloudflare R2, plan darmowy**: 10 GB, zero opłat za transfer,
  bez wygasania
- **surowe pozycje GPS pomijane** — dane osobowe, i tak kasowane po okresie
  retencji; zdarzenia biznesowe są w `load_events` i trafiają do kopii
- pliki (PDF, CMR, POD, zdjęcia): codziennie przyrostowo — tylko nowe

**Retencja w R2:** kopie dzienne 30 dni, miesięczne 12 miesięcy.

**Odtworzenie:** `scripts/restore.sh` — odszyfrowanie i załadowanie
do projektu **testowego**. **Test odtworzenia raz w miesiącu**, wynik
w `POSTEP.md`. Kopia, której nigdy nie odtworzono, nie jest kopią.

Utrata danych w najgorszym razie: **do 24 godzin** — zapisz to wprost
w dokumentacji dla właściciela.

Przy aktywacji R2 Cloudflare może poprosić o dane karty — w limicie planu
darmowego opłat nie ma. **Sprawdź przy zakładaniu i napisz mi.**

*Kryterium:* kopia powstaje, jest zaszyfrowana, odtworzenie do projektu
testowego przechodzi, liczba wierszy się zgadza.

---

# 4. POCZTA — PR3, BLOKUJE PRODUKCJĘ

**Domyślna poczta Supabase wysyła wyłącznie do adresów z zespołu projektu
i służy tylko do testów.** Bez własnej poczty użytkownicy KSH i przewoźnika
**nie dostaną linku do logowania**.

- **Resend, plan darmowy**, jako własny serwer SMTP w Supabase Auth
- **zweryfikowana domena nadawcy** — rekordy DNS (SPF, DKIM) po stronie
  właściciela
- ten sam Resend wysyła przypomnienia o płatnościach
- **dzienny limit wysyłek planu darmowego sprawdź przy zakładaniu** —
  i porównaj z budżetem: logowania + przypomnienia (sekcja 7)

*Kryterium:* link logowania dociera na adres spoza zespołu projektu.

---

# 5. LIMITY — PR4: CODZIENNA KONTROLA

Plan darmowy: baza **500 MB**, pliki **1 GB**, funkcje Edge **500 000
wywołań miesięcznie**, transfer **5 GB**.

Funkcja `usage-check` codziennie:
- mierzy zajętość bazy, plików, wywołania, transfer
- **70% → ryzyko dla HHL; 85% → ryzyko wysokie i e-mail**
- zapisuje historię — widać trend, nie tylko stan

---

# 6. BUDŻET BAZY 500 MB — PR5: POZYCJE GPS

Pozycje GPS to jedyna tabela, która może rozsadzić limit.

- aplikacja kierowcy: pozycja **co 2 minuty w ruchu, co 15 minut na postoju**
  (prędkość poniżej 5 km/h) — silnik stref potrzebuje dwóch kolejnych
  punktów, więc wjazd w strefę nadal wykrywany w kilka minut
- telematyka przewoźnika: ten sam limit w `process_position()` — punkt
  bliżej niż 60 s po poprzednim dla tego transportu jest pomijany
- **retencja: pozycje kasowane 30 dni po rozładunku** — sprawdź obecne
  ustawienie `purge_personal_data()` i dostosuj
- **zmierz:** ile bajtów zajmuje 1 000 pozycji z indeksami; podaj prognozę
  dla całego projektu

---

# 7. BUDŻET FUNKCJI EDGE 500 000 — PR6

**Doprecyzowanie sekcji 2.3 `DECYZJE_WYDANIE_1_0.md`:** pozycje i zdarzenia
etapów od kierowcy **nie przez funkcję Edge**, tylko przez funkcję SQL
`driver_post_position(token, …)` wywoływaną przez API bazy — sprawdzenie
skrótu tokenu i limit zapytań w SQL. Wywołanie funkcji bazy nie zużywa
limitu funkcji Edge. Wszystkie warunki tokenu z sekcji 2.3 zostają.
**Zdjęcia** — przez funkcję Edge, bo to kilka sztuk na transport.

| Funkcja | Wywołań miesięcznie |
|---|---|
| `ferry-status`, co 15 min | ~2 900 |
| `ferry-ais`, co 10 min | ~4 300 |
| `road-se`, co 10 min | ~4 300 |
| `traffic-flow`, 20 aut co 15 min | ~58 000 |
| `backup-export`, `usage-check`, przypomnienia | ~100 |
| zdjęcia kierowców | ~1 500 |
| **razem** | **~71 000 z 500 000** |

Zmierz rzeczywiste po miesiącu i porównaj.

---

# 8. PLIKI 1 GB — PR7

- **zdjęcia kompresowane w przeglądarce przed wysłaniem:** dłuższy bok
  1 600 px, JPEG jakość ok. 0,75 — typowo 200–400 kB zamiast kilku MB
- PDF: limit 10 MB na plik, większy odrzucany ze zrozumiałym komunikatem
- **archiwizacja od 70% zajętości:** pliki transportów rozładowanych ponad
  90 dni temu, zafakturowanych i opłaconych, przenoszone do R2; w bazie
  zostaje wskaźnik, pobranie przez podpisany link. Kopia zapasowa obejmuje
  oba miejsca

*Kryterium:* zdjęcie 5 MB z telefonu trafia do bazy jako < 500 kB;
archiwizacja przetestowana na projekcie testowym.

---

# 9. HOSTING — PR8

Bez zmian względem sekcji 4.3 `DECYZJE_WYDANIE_1_0.md`: Vercel na planie
darmowym, zapas na Cloudflare Pages w gotowości, domena pod kontrolą
właściciela, procedura przełączenia przetestowana raz.

---

# 10. DZIAŁANIA WŁAŚCICIELA — WSZYSTKIE BEZPŁATNE

| # | Działanie |
|---|---|
| 1 | projekt Supabase **produkcyjny, region UE, plan darmowy**; włączyć `pg_cron` |
| 2 | konto Cloudflare: Pages (zapas hostingu), R2 (kopie), Workers (podtrzymanie) |
| 3 | konto Resend, weryfikacja domeny — rekordy DNS |
| 4 | **para kluczy age** na własnym komputerze: `age-keygen`; **klucz prywatny offline**, do Groka trafia wyłącznie publiczny |
| 5 | adres e-mail konta Supabase — skrzynka, którą ktoś czyta codziennie |
| 6 | token Supabase do pliku środowiskowego, odwołanie po wdrożeniu |

---

# 11. MIEJSCE W KOLEJNOŚCI

Pozycje **PR1–PR8** — między punktem 7 (polskie znaki) a punktem 8
(produkcja) z sekcji 5 `DECYZJE_WYDANIE_1_0.md`. **PR3 (poczta) i PR2
(kopie) muszą działać przed pierwszym prawdziwym użytkownikiem.**
Tag `release-1.0` — po teście dymnym na produkcji, jak dotąd.

Lista kontrolna: dochodzą **PR1–PR8**.


---

# ANEKS 5

> Dopisano 26.09.2026 — pełna treść dokumentu właściciela „ANEKS 5 — jeden projekt, roczna sesja użytkownika” (wersja 2), bez zmian. Zastępuje: Aneks 3 §4.1, §4.2 i linię o ważności tokenu w §2.3; Aneks 4 sekcję 1, fragment PR2 o odtwarzaniu do projektu testowego oraz kolejność PR (sekcja 6 poniżej).

# ANEKS 5 — JEDEN PROJEKT, ROCZNA SESJA UŻYTKOWNIKA

> **Wersja 2 — zastępuje wersję 1 w całości.** Poprawka właściciela: rok
> dotyczy **użytkowników programu**, nie kierowców. Jeżeli zacząłeś
> autoryzację urządzenia kierowcy na rok — wycofaj ją.

> Zapisz na końcu `docs/handover/ZLECENIE_FINAL.md` jako „ANEKS 5".
> **Zastępuje:** `DECYZJE_WYDANIE_1_0.md` sekcje 4.1 i 4.2 oraz linię
> o ważności tokenu w 2.3; `ANEKS_4` sekcję 1 i fragment PR2
> o odtwarzaniu do projektu testowego.

---

# 1. DECYZJE WŁAŚCICIELA

| # | Decyzja |
|---|---|
| A5.1 | **Jeden projekt Supabase — obecny — jest produkcją.** Drugiego projektu nie zakładamy |
| A5.2 | **Wykonujesz wszystkie kroki właściciela** — masz dostęp przez API |
| A5.3 | **Resend: konto założone, domena zweryfikowana, DNS potwierdzone** |
| A5.4 | Skrzynka konta Supabase jest czytana — ostrzeżenia o uśpieniu dotrą |
| A5.5 | **Logowanie użytkownika z linku e-mail — urządzenie pamięta je rok** |
| A5.6 | **Kierowca bez zmian: link ważny do 24 h po rozładunku, maksymalnie 14 dni** (sekcja 2.3 decyzji) |

---

# 2. SKUTKI JEDNEGO PROJEKTU — MUSISZ JE OBSŁUŻYĆ

Projekt, który był testowy, staje się produkcją. Trzy rzeczy przestają być
bezpieczne:

## 2.1 Sprzątanie przed pierwszym prawdziwym użytkownikiem

1. **najpierw kopia zapasowa (PR2)** — zanim cokolwiek usuniesz
2. usuń: **konta testowe** (w tym konta BK5), **faktury, transporty,
   zdarzenia i pozycje testowe**, ryzyka z testów
3. zostaw: migracje, `stegra.sql` (organizacje, projekt, strefy, statki,
   warunki płatności 30 i 35 dni), **147 prawdziwych rejsów**
4. lista usuniętego — liczbami, tabela po tabeli — w `POSTEP.md`
5. **napisz mi, zanim usuniesz** — lista do zatwierdzenia, potem usunięcie

## 2.2 Testy zapisujące dane — nigdy na tym projekcie

Od chwili sprzątania żaden test, który zapisuje albo zmienia dane, nie jest
uruchamiany na tym projekcie.
- `tests/db/run.sh` — działa na lokalnym Postgresie, bez zmian
- **BK5 (test API)** — przenieś na **lokalny Supabase przez CLI i Docker**.
  Jeżeli Dockera nie ma — napisz; nie uruchamiaj BK5 na produkcji
- **test odtworzenia kopii (PR2) — do lokalnego Postgresa** z migracjami,
  nie do projektu Supabase

## 2.3 Wdrożenia podglądowe — bez produkcji

Na planie darmowym Vercel podglądy są publiczne, a teraz jedyna baza
to produkcja. **Podglądy budowane w trybie `DemoProvider`** — bez połączenia
z Supabase. Produkcyjny build wyłącznie z gałęzi `main`.

---

# 3. POCZTA — PR3 GOTOWE DO URUCHOMIENIA

Domena zweryfikowana. Ty:
- ustaw Resend jako SMTP w Supabase Auth
- nadawca na domenie właściciela
- **wyślij link logowania na adres spoza zespołu projektu** i potwierdź
  dostarczenie — to jest kryterium, nie samo zapisanie ustawień
- sprawdź dzienny limit wysyłek darmowego planu Resend i napisz go w raporcie

---

# 4. SESJA UŻYTKOWNIKA — ROK

Pracownik HHL, KSH albo przewoźnika klika link z e-maila; to urządzenie
pozostaje zalogowane **365 dni od logowania**. Po roku — ponowne logowanie
linkiem.

## 4.1 Plan darmowy nie ma tego ustawienia

W Supabase sesja domyślnie trwa bez końca; **limit czasu sesji jest
dostępny wyłącznie od planu Pro.** Rok budujesz sam:

- **zadanie pg_cron raz dziennie usuwa z `auth.sessions` sesje utworzone
  ponad 365 dni temu.** Przy następnym odświeżeniu tokenu użytkownik
  trafia na ekran logowania z komunikatem: „Minął rok od logowania na tym
  urządzeniu — zaloguj się ponownie linkiem z e-maila" (PL/EN/SV)

## 4.2 Czego NIE robić

**Nie wydłużaj czasu ważności tokenu dostępu (JWT) do roku.** Zostaje
3 600 sekund. Rok ma żyć w sesji, którą da się usunąć — nie w tokenie,
którego nie da się odwołać. Token ważny rok oznaczałby, że zwolniony
pracownik albo skradziony laptop ma dostęp przez rok.

## 4.3 Link i sesja to dwie różne rzeczy

- **link w e-mailu: jednorazowy, ważny najwyżej godzinę** — sprawdź
  ustawienie i nie wydłużaj
- **sesja: 365 dni**

## 4.4 Odwoływanie

- **„Wyloguj ze wszystkich urządzeń"** w Ustawieniach użytkownika
- **HHL wylogowuje dowolnego użytkownika ze wszystkich urządzeń** —
  zgubiony laptop, odejście pracownika
- **dezaktywacja użytkownika odcina dane natychmiast**, nie po wygaśnięciu
  tokenu: funkcje używane w politykach RLS (`current_app_role()`,
  `current_org_id()`) zwracają pusto dla nieaktywnego użytkownika,
  a jego sesje są usuwane
- **„Moje urządzenia"** w Ustawieniach: przeglądarka, data logowania,
  data wygaśnięcia, ostatnia aktywność

## 4.5 Testy

- sesja starsza niż 365 dni usunięta przez zadanie; odświeżenie → ekran
  logowania z komunikatem
- sesja młodsza niż 365 dni nietknięta
- czas ważności tokenu dostępu = 3 600 s (test konfiguracji)
- link z e-maila użyty drugi raz — odrzucony
- użytkownik zdezaktywowany z wciąż ważnym tokenem — **zero wierszy**
  w każdej tabeli
- „wyloguj wszędzie" usuwa wszystkie sesje użytkownika
- HHL wylogowuje innego użytkownika; KSH i przewoźnik nie mogą wylogować
  nikogo poza sobą

# 5. KLUCZ DO KOPII — JEDYNY KROK WYŁĄCZNIE WŁAŚCICIELA

Robisz wszystko sam, z jednym wyjątkiem, bo wynika z celu zabezpieczenia:

- wygeneruj parę kluczy `age-keygen` **do pliku poza repozytorium**
- klucz publiczny — do sekretów funkcji `backup-export`
- **klucz prywatny przekaż właścicielowi do zapisania offline**
  (nośnik, drugi egzemplarz w menedżerze haseł właściciela), a następnie
  **usuń go z dysku** i potwierdź usunięcie
- nigdy w repozytorium, sekretach, rozmowie ani logach
- do comiesięcznego testu odtworzenia właściciel udostępnia klucz na czas
  testu; po teście usuwasz

Bez klucza prywatnego kopie są nie do odtworzenia — dlatego dwa egzemplarze
u właściciela.

---

# 6. KOLEJNOŚĆ

```
1   PR3 poczta: SMTP Resend + dostarczenie na adres spoza zespołu
2   PR2 kopie: klucz (sekcja 5), backup-export, R2, test odtworzenia lokalnie
3   2.1 sprzątanie: kopia → lista do zatwierdzenia → usunięcie → liczby
4   2.2 BK5 na lokalny Supabase; 2.3 podglądy w DemoProvider
5   4   sesja użytkownika rok + odwoływanie + testy
6   pozostałe PR z ANEKSU 4
7   wdrożenie produkcyjne, test dymny, raport, tag release-1.0
```

Lista kontrolna: dochodzą **A5-SPRZATANIE · A5-BK5-LOKALNIE · A5-PODGLADY ·
A5-SESJA-ROK · A5-KLUCZ**.

---

# ANEKS 6

> Polecenie właściciela z 26.09.2026 21:09 — pełny tekst, zapisany dosłownie.

# ANEKS 6 — TŁUMACZENIA — CZEGO D19-T NIE WIDZI

> A, B, faktury, retencja i wzorzec — przyjęte. Koordynator sprawdził
> na produkcji zadania `tower-wygasanie-zaproszen` (04:40) i
> `tower-retencja-przebiegow` (04:50). Wyjaśnienie hasła (B) — przyjęte.
> Odstępstwo w commicie `docs(ZAPR-LOGIN)` — przyjęte; **historii nie
> przepisuj, nic nie wypychaj z `--force`**.

Zrzut, który przysłałeś — **nowy wzorzec, widok HHL, język EN** — ma
na ekranie kilkanaście tekstów po polsku. Są trzy różne przyczyny.

---

## T1 — WYSOKA: baza tworzy ryzyka po polsku

Sprawdzone na produkcji: `risk_signals` ma tylko `title text` — gotowy
tekst, bez klucza tłumaczenia. Funkcje wpisują tam po polsku:
- `detect_silent_vehicles`: „Brak pozycji pojazdu %s od %s min"
- `detect_sequence_risk`: „Rozjazd kolejności montażu: %s (poz. %s)…"
- `detect_missing_order_numbers`: „…brak numeru zlecenia HHL"
- `job_watchdog` i pozostałe

Ryzyko ciszy GPS ma odbiorców `HHL_PRZEWOZNIK`. **Szwedzki dyspozytor
Scandinavian Express w widoku SV dostanie je po polsku** — a to komunikat,
na który ma zareagować.

**Poprawka:**
- `risk_signals`: nowa kolumna `title_key text`; parametry w
  `detail->'params'`
- **każda** funkcja tworząca ryzyko — w bazie i w funkcjach Edge — zapisuje
  klucz i parametry; `title` zostaje jako tekst polski dla dziennika
- interfejs wyświetla `title_key` ze słownika PL/EN/SV z podstawieniem
  parametrów
- **to samo dla e-maili** z `send-notifications`: język według
  `app_users.locale` odbiorcy, nie według nadawcy
- **baner promowy** na kokpicie („Rejs 24.09 zagrożony…") — ten sam
  mechanizm
- **dane demonstracyjne** — ryzyka też z kluczami, żeby wzorzec EN/SV
  pokazywał tłumaczenia

**Testy:**
- statyczny: każdy klucz użyty w migracjach i funkcjach Edge istnieje
  w słownikach PL, EN i SV
- bazy: każda funkcja tworząca ryzyko zapisuje niepusty `title_key`
- przewoźnik w SV widzi ryzyko ciszy GPS po szwedzku

**Przed zaproszeniem przewoźnika** — to jego pierwszy kontakt z systemem.

---

## T2 — ŚREDNIA: napisy wpisane na sztywno, których nie ma w słowniku

Na tym samym zrzucie, w widoku EN:
„Czas wykrycia odchylenia", „mediana, ostatnie 30 dni",
„7 dostarczonych, 29 w przygotowaniu", „10 dostaw poza oknem",
„projekt Stegra Boden", „Odpowiada:", „przyczyna:", „źródło:", „koszt".

**Dlaczego D19-T ich nie złapał — dwie ślepe plamki naraz:**
1. rozszerzony D19-T porównuje z **wartościami słownika PL** — napis,
   którego nigdy nie dodano do słownika, przechodzi
2. żaden z nich nie ma polskiej litery — test polskich znaków też przechodzi

**Poprawka testu — pseudo-lokalizacja:** język testowy, w którym każda
wartość słownika jest opakowana znacznikami, np. `⟦Loads in transit⟧`.
Test renderuje wszystkie widoki w tym języku; **każdy widoczny tekst
bez znaczników = napis poza słownikiem = test czerwony.** Lista wyjątków
tylko dla danych: identyfikatory (SG-32), nazwy statków, liczby, daty.
To łapie napisy na sztywno niezależnie od słownika i od liter.

Podaj, ile znalazł; przenieś wszystkie do słownika.

---

## T3 — NISKA: format liczb według języka

Widok EN: „15,7% · koszt PLN 2,429,297.29" — procent z polskim przecinkiem
obok kwoty w formacie angielskim. Wszystkie liczby, procenty i daty przez
`Intl.NumberFormat` / `Intl.DateTimeFormat` z **aktywnym językiem** —
EN: 15.7%, PL: 15,7%, SV: 15,7 %.

---

## Wzorzec po T1–T3

Jeden przebieg 840. **Kryterium:**
- EN i SV: zmiany tylko w miejscach tekstów z T1–T3
- **PL: 0 zmian.** Klucze w PL muszą dać dokładnie ten sam tekst co dziś.
  Każda zmiana w PL — STOP

---

Kolejność: **T1 przed zaproszeniem przewoźnika**, T2 i T3 przed
wydaniem 1.0. R2 i przekazanie klucza — bez zmian, czekają na właściciela.

## Zmiana PR2 (decyzja właściciela, 26.09 21:15)

Kopie zapasowe **bez klucza R2 i bez S3**. `backup-export` wysyła kopie przez Worker Cloudflare
z wiązaniem R2 (binding):

- Worker obsługuje wyłącznie `PUT` nowego obiektu z nagłówkiem sekretu współdzielonego z `backup-export`;
- `GET`, `LIST`, `DELETE` → 405; nadpisanie istniejącego klucza → 409; `PUT` bez sekretu → 401;
- blokada retencji jak w `bucket-lock.json`;
- `scripts/restore.sh` pobiera kopie osobnym tokenem tylko do odczytu, tworzonym na czas testu
  odtworzenia i odwoływanym po nim.

Realizacja dopiero po ANEKS 6 T1–T3 i po dostarczeniu tokena Cloudflare
(`CLOUDFLARE_API_TOKEN` w środowisku / `.env.local`).
