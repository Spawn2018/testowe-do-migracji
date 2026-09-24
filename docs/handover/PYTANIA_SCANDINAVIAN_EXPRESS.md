# Spotkanie ze Scandinavian Express — checklista

**Projekt:** KSH / Stegra Boden — konstrukcje stalowe ponadnormatywne, PL → Boden (SE)
**Data spotkania:** ______________  **Uczestnicy:** ______________________________

---

## ⚠ PIĘĆ PYTAŃ, OD KTÓRYCH ZALEŻY ARCHITEKTURA

Jeśli z całego spotkania wrócisz tylko z tym — wystarczy.

| | Pytanie | Odpowiedź |
|---|---|---|
| 1 | Jakiego systemu telematycznego używacie — pełna nazwa dostawcy? | |
| 2 | Macie dostęp do API tego systemu? Kto u Was ma konto administratora? | |
| 3 | Podzlecacie te transporty dalej, czy jedzie wyłącznie Wasza flota? | |
| 4 | Kierowcy mają smartfony z transmisją danych? Zgodzicie się, żeby klikali status w linku z SMS-a? | |
| 5 | Kto rezerwuje prom i jaki jest lead time rezerwacji dla ponadgabarytu? | |

**Poproś o jedną rzecz na piśmie w ciągu 48 h:** dokumentację API telematyki
albo jasne „nie mamy API". Od tego zależy połowa budowy.

---

## A. TELEMATYKA — blok najważniejszy

| | Pytanie | Odpowiedź |
|---|---|---|
| A1 | Nazwa i wersja systemu (Webfleet / Transics / Mapon / Ruptela / Wialon / Framelogic / Scania FMS / Volvo Connect / inne) | |
| A2 | Jest REST API? Dokumentacja? Kto wystawia klucz? | |
| A3 | API daje **webhooki / push**, czy tylko odpytywanie? | |
| A4 | Pojazdy fabrycznie „connected"? Możecie włączyć **rFMS**? Kto płaci za subskrypcję? | |
| A5 | Częstotliwość zapisu pozycji — w ruchu i na postoju? | |
| A6 | Identyfikacja pojazdu w API: nr rejestracyjny czy wewnętrzne ID? Dostanę mapowanie? | |
| A7 | Limity zapytań / opłata za wywołanie? | |
| A8 | Macie u siebie geofencing? Możecie wysyłać nam zdarzenia wjazd/wyjazd? | |
| A9 | **RODO:** kto jest administratorem danych kierowców? Kierowcy są poinformowani o udostępnianiu pozycji podmiotowi trzeciemu? Podpiszemy umowę powierzenia? | |
| A10 | Jeśli API nie będzie — zgoda na **PWA kierowcy** (link SMS, 4 przyciski + aparat)? | |
| A11 | Języki kierowców: PL / EN / SV / LT / UA? | |
| A12 | Pojazd pilotujący ma własną telematykę? | |

---

## B. FLOTA, ZASOBY, WYMIARY

| | Pytanie | Odpowiedź |
|---|---|---|
| B1 | Typy naczep: teleskopowa / niskopodwoziowa, liczba osi, nośność? | |
| B2 | **Długość całkowita zestawu z elementem 18,21 m? Wysokość całkowita? Szerokość?** (wymiar elementu ≠ wymiar zestawu) | |
| B3 | Ile zestawów dedykujecie? Stałe czy rotacja? | |
| B4 | Jeden zestaw weźmie dwa elementy (SG-01 + SG-02)? | |
| B5 | Obsada jedno- czy dwuosobowa na 1250 km? | |

---

## C. ZEZWOLENIA I PILOTAŻ

| | Pytanie | Odpowiedź |
|---|---|---|
| C1 | Kto występuje o zezwolenia w PL? Lead time? | |
| C2 | Kto o szwedzki **dispens** (Trafikverket)? Lead time? | |
| C3 | Zezwolenia jednorazowe czy okresowe na trasę? | |
| C4 | **Prześlecie wzór zezwolenia** (do zmapowania pól: max L/W/H/masa, trasa, ważność)? | |
| C5 | Pilotaż: ile pojazdów w PL, ile w SE? Kto zapewnia? Wliczone w stawkę? | |
| C6 | Ograniczenia jazdy: noce, weekendy, święta — PL i SE? | |
| C7 | Trasa w zezwoleniu jest sztywna? Prześlecie ją jako przebieg dróg? | |

---

## D. PROM

| | Pytanie | Odpowiedź |
|---|---|---|
| D1 | Kto rezerwuje — Wy czy my? | |
| D2 | Macie kontrakt z POLSCA / Polferries? Warunki dla ponadgabarytu? | |
| D3 | Lead time rezerwacji miejsca? | |
| D4 | Kto ponosi koszt przy odwołanym rejsie / braku miejsca? | |
| D5 | Alternatywy w zapasie: Gdańsk–Karlshamn, Gdynia–Karlskrona, Świnoujście–Ystad/Trelleborg? | |
| D6 | Prześlecie nr rezerwacji i nazwę promu do systemu? | |

---

## E. DOKUMENTY

| | Pytanie | Odpowiedź |
|---|---|---|
| E1 | Forma POD: skan, zdjęcie, e-CMR? | |
| E2 | **Używacie e-CMR? Jakiego dostawcy?** | |
| E3 | Ile czasu od rozładunku do dokumentów? | |
| E4 | Kto podpisuje POD na placu Stegra w Boden? | |
| E5 | Kto robi i podpisuje dokumentację mocowania? | |

---

## F. STAWKI, BAF, FAKTUROWANIE

| | Pytanie | Odpowiedź |
|---|---|---|
| F1 | ~~Waluta rozliczenia~~ **ROZSTRZYGNIĘTE: EUR** (decyzja 24.09.2026). Potwierdzić z przewoźnikiem i zapisać w umowie | EUR |
| F2 | ~~Kurs~~ **ROZSTRZYGNIĘTE: NBP, tabela A, kurs średni z dnia roboczego poprzedzającego dzień rozładunku.** Do umowy — jeżeli przewoźnik nie jest polskim podatnikiem, to warunek umowny, nie ustawowy. Na fakturze: numer tabeli i kurs | NBP A, D−1 roboczy |
| F3 | Co w stawce, a co poza: prom, opłaty drogowe SE, pilotaż, zezwolenia, postojowe? | |
| F4 | Akceptujecie BAF wg indeksu? Który: EU Weekly Oil Bulletin / Orlen hurt / e-petrol? | |
| F5 | ~~Udział paliwa~~ **NIE DOTYCZY** — mechanizm hybrid_min nie używa udziału paliwa | — |
| F6 | Wartość i data bazowa indeksu? Cykl rewizji? Próg wyzwolenia? | |
| F7 | Cykl faktury: tydzień kalendarzowy? Termin płatności? | |
| F8 | Postojowe: od której godziny, ile za godzinę i dobę? | |
| F9 | Co przy odwołaniu transportu przez klienta / pustym przebiegu? | |
| F10 | Rejestracja faktury w systemie: faktura wystawiona w Waszym systemie, tu **rejestrowana z plikiem PDF**, porównywana z cennikiem, kursem i opłatą paliwową. Zgoda? | |
| F11 | **Czy Wasz system fakturowy potrafi wystawić fakturę tygodniową w PLN z RÓŻNYM kursem NBP na każdej pozycji** (każdy transport ma kurs z dnia roboczego przed swoim rozładunkiem)? Jeżeli nie — jak to rozwiązujecie? | |
| F12 | Waluta faktury: EUR czy PLN — którą wybieracie domyślnie? (Wybór jest po Waszej stronie) | |
| F13 | **Wasz numer zlecenia** — format, kto go nadaje, kiedy. Będzie **obowiązkowy przed załadunkiem** i widoczny w harmonogramie | |

---

## G. UBEZPIECZENIA

| | Pytanie | Odpowiedź |
|---|---|---|
| G1 | Suma gwarancyjna OCP. Obejmuje ponadnormatywne i Szwecję? | |
| G2 | Odrębne cargo na konstrukcje stalowe? Franszyza? | |
| G3 | Prześlecie polisę i będziecie aktualizować przy odnowieniu? | |

---

## H. LUDZIE, DOSTĘP, PROCES

| | Pytanie | Odpowiedź |
|---|---|---|
| H1 | **Ile osób ma mieć konto? Imiona, maile, role** (dyspozytor / administracja / księgowość) | |
| H2 | Domyślny język interfejsu: PL / EN / SV? | |
| H3 | Godziny dyspozytorni. Dyżur weekendowy. Numer alarmowy. | |
| H4 | **Zgadzacie się wpisywać dane kierowcy, pojazdu i awizacji do systemu zamiast mailem?** ← najważniejsze pytanie procesowe | |
| H5 | Zgoda na wspólne **kody przyczyn opóźnień A–F**, przypisywane wspólnie? | |
| H6 | Wiecie, że system pokaże Waszą terminowość i kompletność danych — również Wam? | |

---

## KODY PRZYCZYN OPÓŹNIEŃ — do uzgodnienia na spotkaniu

Kod determinuje, kto ponosi koszt. Ustalcie to teraz, nie przy pierwszym sporze.

| Kod | Przyczyna | Kto ponosi |
|---|---|---|
| **A** | Klient: załadunek, plac, dokumenty klienta | KSH |
| **B** | Przewoźnik: pojazd, kierowca, awaria, brak zasobu | SCX |
| **C** | Spedytor: dyspozycja, zlecenie, awizacja | HHL |
| **D** | Prom / port: odwołany rejs, brak miejsca, odprawa | do uzgodnienia |
| **E** | Siła wyższa: sztorm, zamknięcie drogi, jazda w kolumnie | do uzgodnienia |
| **F** | Administracja: zezwolenie, kontrola, granica | zależy od C1/C2 |

---

## PO SPOTKANIU — co zrobić z odpowiedziami

| Odpowiedź na | Wpisz do |
|---|---|
| A1–A7 | `lib/telematics/adapter.ts` → `PROVIDER_TEMPLATES` + zmienne środowiskowe |
| A9 | umowa powierzenia + `purge_personal_data()` (liczba dni retencji) |
| B2 | `loads.combo_*` + macierz cennikowa `rate_rules` |
| C4 | `permits` + walidator `permit_fits()` |
| C7 | geometria trasy planowanej na mapie |
| D2–D5 | moduł ryzyka promowego + panel alternatyw |
| F1–F6 | `baf_definitions` + `fx_rates` (NBP) |
| F7–F9 | moduł faktur + pozycje `extras` w cenniku |
| G1–G3 | `insurance_policies` + alert 14 dni przed wygaśnięciem |
| H1–H2 | `app_users` — konta zakładane przed startem |
| H5 | enum `delay_code` (już w migracji 0001) |
