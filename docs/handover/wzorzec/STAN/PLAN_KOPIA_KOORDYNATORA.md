# PLAN CIĄGŁY — TOWER

> Zapisz jako `docs/handover/PLAN.md`. **Od teraz to jedyna lista pracy.**
> `POSTEP.md` zostaje dziennikiem wykonanego. `SCOPE.md` — rejestrem zakresu.

---

# 1. ZASADY PRACY CIĄGŁEJ

1. **Realizujesz kolejkę z sekcji 3 od góry, bez przerw.** Po zakończeniu
   pozycji: wpis w `POSTEP.md` z liczbami, status w tym pliku, **od razu
   następna pozycja**. Nie pytasz, czy iść dalej. Nie czekasz na akceptację.
2. **Zmiany tylko dopisujemy.** Koordynator przysyła bloki `DOPISZ` (sekcja 2).
   Istniejących pozycji nie przepisujemy — najwyżej oznaczamy
   `ZASTĄPIONA PRZEZ <ID>`.
3. **Pytanie do właściciela nie zatrzymuje kolejki.** Wpisujesz je do
   sekcji 4 (Decyzje oczekujące) i **przechodzisz do następnej pozycji,
   która od niego nie zależy**. Kolejka nigdy nie stoi przez jedno pytanie.
4. **STOP — wyłącznie w tych sytuacjach:**
   - usunięcie albo zmiana prawdziwych danych na produkcji
   - wydanie pieniędzy albo zmiana planu usług
   - wysłanie czegokolwiek do prawdziwych użytkowników z zewnątrz
   - wzorzec zrzutów zmienia się poza zakresem przewidzianym w pozycji
   - dane, które może dać tylko właściciel (stawki, umowy)
5. **Znaleziona luka bezpieczeństwa wysokiej wagi:** naprawiasz od razu,
   jako następną pozycję, bez pytania — i zgłaszasz w raporcie.
6. **Raport:** jeden krótki po każdej zakończonej pozycji (ID, wynik
   liczbami, commit). Właściciel przekazuje raporty koordynatorowi
   w dogodnym momencie — nie po każdym.
7. **Nic nie ginie:** każda pozycja z `SCOPE.md` o statusie innym niż
   DONE musi mieć swoje miejsce w kolejce albo w dzienniku odłożeń.

---

# 2. PROTOKÓŁ DOPISYWANIA

Koordynator przysyła wyłącznie bloki w tej formie:

```
DOPISZ
ID: <etap>-<numer>
Priorytet: P0 | P1 | P2
Opis: …
Kryterium odbioru: …
```

- **P0** — bezpieczeństwo albo bloker: wchodzi jako następna pozycja
  po bieżącej; bieżącej nie przerywasz
- **P1** — bieżący etap, na koniec jego listy
- **P2** — etap późniejszy, na koniec tamtego etapu

---

# 3. KOLEJKA

Statusy: `W TOKU` · `DO ZROBIENIA` · `CZEKA NA: <co>` · `DONE <commit>`

## ETAP I — przed pilotażem (w tej kolejności)

| ID | Opis | Kryterium | Status |
|---|---|---|---|
| I-0 | wyciek plików | stare wdrożenia usunięte, ocena ekspozycji | DONE |
| I-0b | usunięcie poprzednich wdrożeń Pages przy najbliższym logowaniu | lista wdrożeń = 1 | DO ZROBIENIA (przy okazji) |
| I-1 | import w produkcji zapisuje transporty | 41/41 lokalnie, powtórka 0 zmian | DONE |
| I-SEC | strażniki odporne na NULL (`is not true`), `is_hhl()`/`can_see_margin()` tylko true/false | nieaktywne konto każdej roli × każda funkcja z listy dozwolonych = odmowa; test statyczny migracji | DONE 0049 — 140/140 odmów; potwierdzone przez koordynatora |
| I-BK | kopia zapasowa: tabele wyliczane z katalogu, jawne wykluczenia | tabela spoza kopii i spoza wykluczeń = test czerwony | DONE — 38/41, 4 wykluczenia z powodem, test 22/22 |
| I-1b | klasa STANDARD dla 9 transportów | import 50/50 | DONE 0050 — 50/50; ograniczenie na `shipment_items` potwierdzone |
| I-12 | cennik: pozycja STANDARD — stała stawka, koszt i przychód osobno | transport STANDARD wylicza koszt, przychód, marżę; brak stawki = ostrzeżenie | DONE 0064 — kwoty czekają na D-1 |
| I-2a | przełącznik ról tylko dla HHL | KSH i SCX go nie widzą | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2c | moduł Workflows ukryty w produkcji | niewidoczny poza trybem demo | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2d | ETA v1 w bazie: odcinek + czasy odcinków + rejs z `sailings`, przeliczana przy zdarzeniu | test na symulacji 11 transportów ze `status.sh` | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2e | pogoda, przeprawy alternatywne, objazdy SE — ukryte albo „brak źródła danych" | zero danych statycznych w produkcji | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2f | Opcje BAF — prawdziwy formularz parametrów SEFS i odczytów indeksu, ze źródłem, datą i dziennikiem | zapis i odczyt w produkcji | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2g | kody opóźnień ukryte do uzgodnienia z przewoźnikiem | — | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2h | telefony demo: pula PTS (SE), nieprzydzielalne (PL, LT); SMS i e-mail nigdy w trybie demo | test | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2i | przegląd 37 pozycji „częściowo" — każda działająca tylko w demo trafia tu jako nowa pozycja I-2* | lista w raporcie | DONE — wdrożone (0051, 0052, a4ff639) |
| I-2j/k/l | trzy pozycje „tylko demo" z przeglądu I-2i — treść w repo | — | DO ZROBIENIA |
| I-13 | `sefs_parameters.applies_to` COST/REVENUE/BOTH + RLS stron | przewoźnik nie widzi REVENUE, KSH nie widzi COST | DONE 0063 — 14 przypadków |
| I-14 | jedno źródło prawdy dla opłaty paliwowej (baf_* vs sefs_parameters) | jedna tabela parametrów, jedna odczytów | DONE 0066 — baf_* usunięte |
| I-10 | e-mail o zmianie daty awizowanego transportu | dostarczenie na adres z plusem | DONE 0056 — test 21:20 |
| I-3 | bramka SMS według `PROPOZYCJA_SMS.md` + decyzje z `ZLECENIE_ETAP_I.md` | testy z propozycji; 24 h pracy telefonu | CZEKA NA: telefon i SIM (część bazowa i aplikacja — DO ZROBIENIA) |
| I-5 | 2FA TOTP, wymagane dla HHL_ADMIN (`aal2`) | administrator bez drugiego składnika = odmowa | DONE 0057 — wymaganie wyłączone do D-11 |
| I-15 | pasmo ETA: odpoczynek dobowy 11 h ±0% osobno; łączenie niepewności pierwiastkiem z sumy kwadratów | pasmo przed/po | DONE 0062 — pasmo 1013→433 min |
| I-16 | wykonalność planu KSH i walidacja modelu ETA: plan KSH = **5 dni od podjęcia do dostawy** (właściciel 27.09); model ≈ 2,5 doby + rejs → zapas ok. 1,5 doby. Rozkład zapasu dla 50 transportów + rozbicie testowego transportu z D-9 | każdy zapas dodatni albo wyjaśniony | DONE — zapas min 30 h, mediana 54 h, max 55 h |
| I-17 | 2FA: drugie urządzenie uwierzytelniające | dwa czynniki działają osobno | DONE 0060 |
| I-18 | status dat planu: WSTĘPNA / POTWIERDZONA przez KSH; import nie nadpisuje potwierdzonej po cichu; ryzyko braku potwierdzenia N dni przed załadunkiem | test bazy + widoki trzech ról | DONE 0061 |
| I-19 | formularz cennika dla HHL (dziś tylko SQL) — dopisane przez Groka | zapis stawek z aplikacji | DONE 0065 |
| I-20 | (pozycja wykonawcy) | — | DONE 0072 |
| I-21 | (pozycja wykonawcy) | — | DONE 0073–0075 — terminy do potwierdzenia z SCX |
| I-22 | (pozycja wykonawcy) | — | DONE 0077 |
| I-23 | (pozycja wykonawcy) | — | DONE |
| I-24 | (pozycja wykonawcy) | — | DONE |
| I-25 | **P0** — cofnięcie 0070: opóźnienie od końca okna dostawy, bez okna od końca dnia; import nie ustawia okna bez godzin | 4 testy z przykładami | DONE 0080 — load_delivery_deadline, sprawdzone |
| I-26 | anon: odebrać uprawnienia do tabel public (20 tabel z INSERT/UPDATE/DELETE, blokowanych tylko RLS) + domyślne uprawnienia | anon 0 uprawnień; przebieg kierowcy działa | DONE 0083 — sprawdzone |
| I-27 | brak zezwolenia blokuje „Gotowy" dla klasy innej niż STANDARD — przełącznik włączony przed R-3 | test | DONE 0084 — przełącznik WYŁĄCZONY do D-21 |
| I-28 | usunięcie nieużywanej `load_delivery_day_end` | — | DONE 0085 |
| I-4 | instrukcje: kierowca PL/EN/SV, KSH, przewoźnik | dostępne w aplikacji | DONE |
| I-6 | monitoring błędów przeglądarki do własnej tabeli, alarm | błąd testowy widoczny w tabeli | DONE 0058 |
| I-7 | retencja: dane kierowcy 90 dni | test | DONE 0059 — dokumenty: D-3 |
| I-8 | wydajność: cały harmonogram + GPS według PR5, trzy role | czasy liczbami | DONE |
| I-9 | `SCOPE.md` koordynatora w repo; Twoje statusy jako §53 | jeden rejestr | DONE — statusy jako §56 |
| I-11 | każda pozycja SCOPE 0–11 inna niż DONE ma miejsce w tej kolejce albo w dzienniku odłożeń | zasada 7 spełniona | DONE — 65 pozycji przypisanych |

## PILOTAŻ I WYDANIE

| ID | Opis | Status |
|---|---|---|
| R-1 | import prawdziwego harmonogramu na produkcję | CZEKA NA: I-1b, stawki (D-1) |
| R-2 | zaproszenie pracowników HHL, potem KSH, potem przewoźnika | CZEKA NA: etap I |
| R-3 | O3b — pierwszy prawdziwy transport od importu do faktury | CZEKA NA: R-2 |
| R-4 | raport końcowy, tag `release-1.0` | CZEKA NA: R-3 |

## ETAP II — po spotkaniu z przewoźnikiem

| ID | Opis | Status |
|---|---|---|
| II-1 | wartości SEFS i ich wprowadzenie | CZEKA NA: D-2 |
| II-2 | kody opóźnień uzgodnione — włączenie w interfejsie | CZEKA NA: spotkanie |
| II-3 | parametry operacyjne: cutoff promu, progi fal, prędkość | CZEKA NA: spotkanie |
| II-4 | adapter telematyki przewoźnika | CZEKA NA: spotkanie |
| II-5 | komunikaty armatora w harmonogramie | CZEKA NA: zgoda armatora |
| II-6 | Trafikverket, TomTom, KPD — zadania i klucze | CZEKA NA: klucze (każdy osobno — rusza, gdy jego klucz dotrze) |

## ETAP III — po pilotażu

III-1 kalibracja czasów odcinków ETA po 5 transportach (propozycja do zatwierdzenia) · Silnik Workflows · źródło pogody morskiej · walidator zezwoleń i wymiarów ·
pozycje D4–D12 audytu · integracja SharePoint (zgoda IT KSH) · kalendarz ·
e-CMR · ślad węglowy · SMS 6, 7, 10, 11 · retencja `files/` w R2 ·
audyt dostępności · przekazanie Cursorowi.

---

# 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL

Wpisujesz tu każde pytanie i idziesz dalej.

| ID | Sprawa | Blokuje |
|---|---|---|
| D-1 | stawki — koszt przewoźnika, przychód od KSH | R-1, faktury |
| D-2 | parametry SEFS — po spotkaniu z przewoźnikiem | II-1 |
| D-3 | retencja zdjęć, CMR, POD | część I-7 |
| D-4 | telefon z Androidem i firmowa karta SIM z SMS na +46 | test I-3 |
| D-5 | umowy RODO z KSH i przewoźnikiem | R-2 |
| D-6 | spotkanie ze Scandinavian Express | etap II |
| D-7 | Vercel: wyłączenie trenowania modeli (panel) | — |
| D-8 | wycena STANDARD | **ROZSTRZYGNIĘTA: A — osobna stawka** (kwota w D-1) |
| D-9 | czasy odcinków ETA | **ROZSTRZYGNIĘTA: wartości początkowe koordynatora** (PL 7,5 h, SE 17 h + 13 h odpoczynku, check-in 3 h); **zamknięta:** obsada jednoosobowa, odpoczynek na promie — potwierdzone przez właściciela |
| D-12 | źródło dat planu | **ROZSTRZYGNIĘTA: ostateczne daty podaje KSH (I-18)**; termin N — domyślnie 5 dni, do uzgodnienia z przewoźnikiem (5b) i KSH |
| D-13 | podglądy wdrożeń bez hasła | **ZAMKNIĘTA: zastąpione** — Vercel Authentication + dane demo; podglądy Pages wyłączone |
| D-14 | kurs NBP — potwierdzenie księgowości | czeka na właściciela |
| D-15 | limity ponadnormatywności PL i SE | Grok zbiera ze źródłem; potwierdzenie z przewoźnikiem |
| D-16 | lista użytkowników do zaproszenia: imię, e-mail, firma, rola — HHL, KSH, przewoźnik | R-2 |
| D-17 | rejestracja w KPD GDDKiA (firma, potem użytkownik z certyfikatem) | II-6 dla Polski |
| D-18 | e-mail do armatora o zgodę na odczyt komunikatów | II-5 |
| D-11 | włączenie 2FA na koncie administratora (Opcje → Weryfikacja dwuetapowa) | **ROZSTRZYGNIĘTA: właściciel włącza po I-17** — dwa urządzenia, potem „Włącz wymaganie" |
| D-10 | przewoźnik widzi SEFS | **ROZSTRZYGNIĘTA: tak, tylko odczyt, tylko wersje uzgodnione** + I-13 |


**Stan 28.09:** etap I zamknięty; I-25 DONE (0080) (sprawdzone na produkcji: migracje do 0079). Poprawka wycieku danych kierowcy (0076) potwierdzona.

**Decyzje 28.09:** D-21 przed pierwszym transportem (właściciel) · D-22 TAK, zasady kierowcy · D-23 TAK, bez uwag wewnętrznych · D-24 ZAMKNIĘTE decyzją 16.1 · D-25 zatwierdzone z warunkiem obszaru różnic · hasło bazy — zmiana przez właściciela.
**Dopisane P2:** III-10 EU Weekly Oil Bulletin (wyłączone do D-2) · III-11 raport źródeł pogody morskiej · III-12 lista otwartych pozycji III niezależnych od właściciela · gate:visual co noc.

**29.09 — sprawdzone i rozstrzygnięte:** D-22 potwierdzone na produkcji (kasowanie po 90 dniach obejmuje pilotów) · D-23 0091 · III-10 wyłączone do D-2 (0 odczytów, brak zadania) · III-13 (dawne D-26): 36 ujęć zamierzonych, wzorzec `a956ab6` · III-11: FMI + DMI, CC BY 4.0 · III-12: dostępność 54 widoki.
**Decyzje:** D-27 kontrast ZATWIERDZONY z testem ≥ 4,5:1 na każdym tle (zapasowo #7C909E w ciemnym) · pogoda morska WDRAŻAĆ bez alarmów do II-3, z podaniem źródła · D-28 lista reguł startowych automatyzacji — do przygotowania przez wykonawcę · import wyłącznie HHL (§58).

**29.09 — decyzje właściciela (pogoda, prom, drogi SE, silnik opóźnień):** `ZLECENIE_POGODA_DROGI_ETA.md`.
Wchodzi: II-5 odczyt komunikatów teraz (bez czekania na zgodę; D-18 jako informacja) · II-8 pogoda FMI/DMI/SMHI, progi wstępne 3,8 m / 40 kn · II-9 opóźnienie z AIS · II-6 Trafikverket (po kluczu) · II-7 ETA v2 z TomTom po trasie z zezwolenia · I-29 budżety dla 140 transportów.
Odrzucone z uzasadnieniem: Open-Meteo (niekomercyjne), HERE (karta, wykluczenie śledzenia pojazdów), AISStream.
**Skala:** 140 transportów ponadnormatywnych do końca roku.

**30.09 — ZMIANA (właściciel): serwis tras = HERE Routing v8 zamiast TomTom.** Zabezpieczenia: II-7a — twardy limit 25 000/mies. w kodzie, weryfikacja regulaminu (śledzenie pojazdów, przechowywanie wyników, podanie źródła) przed podpięciem GPS; STOP, jeśli regulamin wyklucza nasze użycie.

**30.09 — D-1 i D-2 PRZEKAZANE przez właściciela:** cenniki SCX i HHL, załącznik SEFS. `CENNIK_STEGRA.json` (zweryfikowany: 12 pozycji, narzut identyczny, tabele SEFS spójne). Zlecenie `ZLECENIE_CENNIK_SEFS.md`: I-30 P0 cennik według symboli, wariantów i konwoju (zastępuje I-12/I-19) · I-31 P0 SEFS z pobieraniem Orlen i OKQ8 · I-32 P1 opłaty dodatkowe. **D-8 zamknięte: „Standard" = tężniki T, bez osobnej stawki.** Do wyjaśnienia z SCX: VAT w cenie OKQ8, metoda średniej, anulowanie 2 dni przed, czas wolny, przestój.

**30.09 — paczka `PACZKA_DECYZJI_30_09.md`:** D-28 HERE odrzucony (regulamin: wykluczenie liczenia tras dla pojazdów) → własny silnik na korytarzu OSM · konwój = liczba KR z tą samą datą załadunku, automatycznie · KSH identyczna dopłata SEFS · D-27 zatwierdzony · D-29 najpierw tabela nakładania · D-30 tak · D-31 napraw 390 px.

**30.09 (2):** SEFS — cena „tak, jak podaje źródło" (OKQ8 lista z VAT z pliku historii, Orlen API zł/m³÷1000); mnożnik tygodnia 28.09–04.10 = 1,14 · D-28 HERE płatny (Enterprise/od pojazdu), II-7 za przełącznikiem · **II-10 SharePoint w obie strony** · import tylko HH z wymiarami, NTG pomijane · 3 PL bez ceny (wysokość 2,60 > 2,45) · błędy dat KR w pliku KSH · D-32 zgoda IT KSH · D-33 kolumny zapisu zwrotnego i dane kierowców.
**30.09 (3):** PL-1/PL-10.1/PL-17.1 — cena jak przy 2,45 m (PL-B), 95/95 wycenione · daty KR zostają jako test II-10 · **KSH widzi na stałe pełne dane kierowcy i auta; retencja do wycofania zgody** · D-33 rozstrzygnięte (kierowca, telefon, nr zlecenia, nr rejestracyjny do pliku KSH).
**30.09 (4) — D-28 KOŃCOWA: własny silnik (II-7) + automatyczna kalibracja ucząca się (II-7b, zastępuje III-1).** HERE nie.

**29.09 — AUDYT GŁĘBOKI (`TOWER_WZORZEC_2026-09-29.zip`):**
DOPISZ · ID: I-33 · **P0** · Kopia zapasowa 29.09 zawieszona: start 00:30 UTC, status RUNNING po 6 h 38 min, `finished_at` puste, 8 062 B; cron zgłosił sukces. Wyjaśnij przyczynę, wykonaj kopię ponownie, dodaj strażnika: kopia w toku > 30 min → ERROR + e-mail na ALERT_EMAIL_TO. Kryterium: symulacja zawieszenia → alarm w ≤ 30 min; nocna kopia OK z `finished_at`.
DOPISZ · D-34 · Tydzień SEFS: załącznik 28.09 = data załadunku; ustalenie 24.09 = data realizacji (rozładunek). Do potwierdzenia przez właściciela; do tego czasu według załącznika.

**29.09 — decyzja właściciela: hasło bazy BEZ ZMIANY — ryzyko przyjęte.** Zamiast tego: unieważnienie tokenów Groka (Supabase, GitHub, Vercel) po przekazaniu.
