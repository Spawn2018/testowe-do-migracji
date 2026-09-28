# SCOPE.md — rejestr zakresu

**Zasada nadrzędna: z tego pliku nic nie znika.**

Pozycja może zmienić status na `ODŁOŻONA` z podanym powodem i datą.
Nie może zostać skasowana, scalona po cichu ani „uproszczona".
Jeżeli przy przeglądzie czegoś tu nie ma, a powinno — dopisujemy,
nie dyskutujemy.

Ten plik jest odpowiedzią na warunek: *zakres nie może zostać zawężony,
nic pominięte, nic zapomniane*.

## Statusy

| Status | Znaczenie |
|---|---|
| `DO ZROBIENIA` | w zakresie, jeszcze nietknięte |
| `W TOKU` | robione w bieżącej sesji |
| `GOTOWE` | zrobione, przetestowane, przyjęte |
| `ODŁOŻONA` | świadomie przesunięta — **wymaga powodu i daty** |
| `ZABLOKOWANA` | czeka na decyzję lub dostęp — **wymaga wskazania, na co** |
| `DO POTWIERDZENIA` | zrobione według założenia, które musi potwierdzić człowiek |

## Legenda kolumny „dowód"

Czym udowadniamy, że pozycja jest `GOTOWE`. Bez dowodu status się nie zmienia.

---

## 0. Wierność wizualna

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 0.1 | Arkusz stylów przeniesiony dosłownie z mockupu | | porównanie sum kontrolnych | |
| 0.2 | Zrzuty wzorcowe: widok × rola × język × 5 szerokości × 2 tryby | | katalog wzorców w repo | |
| 0.3 | Test regresji wizualnej w CI, próg 0,1% | | zielony przebieg | |
| 0.4 | Konfiguracja blokująca wartości spoza systemu | | zielony przebieg | |
| 0.5 | Zakaz Tailwinda i motywów bibliotek w komponentach | | przegląd kodu | |
| 0.6 | Katalog komponentów jako kontrakt nazw klas | | `DESIGN_SYSTEM.md` | |
| 0.7 | Procedura dodania nowej klasy (3 warunki) | | zapisana i stosowana | |
| 0.8 | Stany: spoczynek, najechanie, fokus, wciśnięty, zablokowany | | zrzuty | |
| 0.9 | Stany: ładowanie, pusty, błąd, błąd walidacji | | zrzuty | |
| 0.10 | Tryb jasny, ciemny i honorowanie ustawienia systemu | | zrzuty | |

## 1. Fundament

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 1.1 | Repozytorium, CI, środowiska testowe i produkcyjne | | | |
| 1.2 | Szkielet aplikacji, trasowanie, układ | | | |
| 1.3 | Trzy języki: polski, angielski, szwedzki | | | |
| 1.4 | Logowanie bez hasła, dwuskładnikowe dla administratorów | | | |
| 1.5 | Wdrożenie na wskazanej domenie | | | |
| 1.6 | Podgląd wdrożeń zabezpieczony hasłem | | | dane klienta |
| 1.7 | Monitoring błędów i logi | | | |
| 1.8 | Kopie zapasowe bazy i procedura odtworzenia | | | |

## 2. Dane i dostęp

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 2.1 | Schemat: organizacje, użytkownicy, role | | | **schema z mockupu ma zostać** |
| 2.2 | Projekt, elementy, transporty (model dwupoziomowy) | | | |
| 2.3 | Strumień zdarzeń, niezmienny | | | |
| 2.4 | Rozdzielenie kosztu i przychodu na poziomie bazy | | test dostępu | |
| 2.5 | Widoki rolowe | | | |
| 2.6 | Dziennik audytu | | | |
| 2.7 | Retencja danych osobowych | | | czeka na decyzję: ile dni |
| 2.8 | Umowy powierzenia między trzema stronami | | | poza kodem, ale w zakresie |

## 3. Harmonogram

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 3.1 | Wgrywanie pliku arkusza | | | |
| 3.2 | Kreator mapowania kolumn z zapisem szablonu | | | |
| 3.3 | Parser wymiarów, dat, godzin, telefonów | | testy jednostkowe | |
| 3.4 | Walidacja blokująca, w tym przesunięte kolumny | | testy | |
| 3.5 | Podgląd różnic przed zapisem | | | |
| 3.6 | Wersjonowanie i archiwum pliku źródłowego | | | |
| 3.7 | Powiadomienie o zmianie daty na transporcie awizowanym | | | |
| 3.8 | Klasyfikacja ponadnormatywności per kraj | | | limity do potwierdzenia |
| 3.9 | Kolejność montażowa i wykrywanie rozjazdu | | | |
| 3.10 | Integracja z SharePoint | | | zależna od zgody IT klienta |

## 4. Zasoby i awizacja

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 4.1 | Formularz zasobów dla przewoźnika | | | |
| 4.2 | Awizacja jako okno czasowe | | | |
| 4.3 | Terminy uzupełnienia i eskalacje | | | |
| 4.4 | Wymiary zestawu odrębnie od wymiarów elementu | | | |
| 4.5 | Pojazdy pilotujące | | | |
| 4.6 | Rezerwacja promu | | | |

## 5. Pozycje i mapa

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 5.1 | Adapter telematyki: interfejs | | | |
| 5.2 | Adapter: standard producentów pojazdów | | | |
| 5.3 | Adapter: system przewoźnika | | | **czeka na odpowiedź przewoźnika** |
| 5.4 | Aplikacja dla kierowcy z tokenem | | | fallback, budowany zawsze |
| 5.5 | Odbiór zdarzeń wypychanych i odpytywanie | | | |
| 5.6 | Idempotentność przetwarzania pozycji | | testy | |
| 5.7 | Surowy odczyt nigdy nienadpisywany | | | |
| 5.8 | Geofencing: histereza, postój, tłumienie drgań | | testy | |
| 5.9 | Edytor stref na mapie | | | |
| 5.10 | Mapa: warstwy, tryb skupienia, unikanie kolizji etykiet | | | |
| 5.11 | Wykrywanie cichego pojazdu | | | |
| 5.12 | Przewidywany czas przyjazdu, model segmentowy | | | |
| 5.13 | Odtwarzanie przebiegu w czasie | | | |
| 5.14 | Podmiana schematu mapy na warstwę kartograficzną | | | |

## 6. Dokumenty

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 6.1 | Kategorie z wymagalnością i terminami | ZROBIONE 28.09 (III-6) | 0078 `doc_requirements` + `doc_requirements_status()`; i2 [III-6]; `tests/doc-requirements.test.ts`; e2e `tests/iii6-docs.local.spec.ts` | terminy startowe — propozycja do potwierdzenia z SCX/KSH |
| 6.2 | Wersjonowanie i widoczność per organizacja | ZROBIONE 28.09 (III-6) | 0078 `document_supersede`, `docs_scope` (dokument organizacyjny przewoźnika niewidoczny dla innego przewoźnika); i2 [III-6]; `tests/doc-versions.test.ts` | |
| 6.3 | Odnośniki z krótkim czasem ważności | | | |
| 6.4 | Zezwolenia: pola, ważność, trasa, pilotaż | | | wzór do zmapowania |
| 6.5 | Walidator wymiarów zestawu wobec zezwolenia | ZROBIONE 28.09 | 0081 `permit_fits` (brak wymiaru = DIMS_UNKNOWN), `load_permit_status`, blokada READY `trg_loads_permit_gate`; i2 [6.5]; e2e `tests/permit-validator.local.spec.ts` | blokuje transport z niezgodnym zezwoleniem; brak zezwolenia — sygnał, nie blokada |
| 6.6 | Polisy z alertem wygaśnięcia | | | |
| 6.7 | Potwierdzenie dostawy i zdjęcia mocowania | | | |
| 6.8 | Pobieranie paczki per transport i per tydzień | | | |
| 6.9 | Elektroniczny list przewozowy | | | faza późniejsza |

## 7. Pieniądze

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 7.1 | Macierz cennika, wersjonowana | | | czeka na stawki |
| 7.2 | Dopasowanie stawki; brak dopasowania nie daje zera | | testy | |
| 7.3 | Indeksacja paliwowa, pełna parametryzacja | | testy | czeka na parametry |
| 7.4 | Pobieranie notowań z zapisem źródła | | | |
| 7.5 | Kursy walut i konwencja | | | czeka na ustalenie |
| 7.6 | Marża, próg ostrzegawczy | | | |
| 7.7 | Dodatki: pilotaż, postojowe, prom, zezwolenia | | | |
| 7.8 | Faktura zbiorcza, kreator dla przewoźnika | | | |
| 7.9 | Dopasowanie trójstronne z rozbiciem różnic | | testy | |
| 7.10 | Ścieżka sporu i akceptacji | ZROBIONE 28.09 (III-7) | 0079 `invoice_dispute_events`, `invoice_dispute_reply`, wstrzymanie zapłaty w sporze; i2 [III-7]; `tests/invoice-dispute.test.ts`; e2e `tests/iii7-dispute.local.spec.ts` | korekta z dokumentem faktury — w bazie (CORRECTION), w UI na razie odpowiedź tekstowa |
| 7.11 | Krajowy system e-faktur | | | faza późniejsza |

## 8. Ryzyko

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 8.1 | Pogoda morska na trasie promowej | | | licencja źródła do potwierdzenia |
| 8.2 | Odczyt komunikatów armatora | | | |
| 8.3 | Śledzenie jednostek | | | |
| 8.4 | Panel alternatywnych przepraw z przeliczeniem | | | |
| 8.5 | Zdarzenia drogowe w Szwecji | | | |
| 8.6 | Zdarzenia drogowe w Polsce | | | brak dobrego źródła — do rozstrzygnięcia |
| 8.7 | Ryzyka dokumentowe i zasobowe | | | |
| 8.8 | Ryzyko kolejności montażowej | | | |
| 8.9 | Kolejka wyjątków z wagą i czasem do skutku | | | |
| 8.10 | Kody przyczyn opóźnień | | | czeka na uzgodnienie z przewoźnikiem |

## 9. Automatyzacje i powiadomienia

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 9.1 | Silnik: wyzwalacz, warunek, akcje | | | |
| 9.2 | Wykonanie trwałe, z ponawianiem | | | |
| 9.3 | Siedem reguł startowych | | | |
| 9.4 | Kreator reguł dla administratora | | | |
| 9.5 | Poczta z szablonami w trzech językach | | | |
| 9.6 | Wiadomości tekstowe | | | |
| 9.7 | Powiadomienia w aplikacji | | | |
| 9.8 | Odsiewanie duplikatów | | testy | |
| 9.9 | Kanał zespołowy | | | |
| 9.10 | Kalendarz do subskrypcji | | | |
| 9.11 | Czat przy transporcie | | | |

## 10. Pulpity

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 10.1 | Pulpit spedytora | | | |
| 10.2 | Pulpit klienta | | | |
| 10.3 | Pulpit przewoźnika | | | |
| 10.4 | Widok placu budowy, tylko do odczytu | | | opcjonalny |
| 10.5 | Krzywa postępu dostaw | | | |
| 10.6 | Ocena przewoźnika | | | |
| 10.7 | Czas wykrycia odchylenia | | | |
| 10.8 | Eksport do arkusza i pliku przenośnego | | | |
| 10.9 | Raport śladu węglowego | | | faza późniejsza |

## 11. Jakość

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 11.1 | Testy jednostkowe logiki: cennik, indeksacja, parser, strefy | | | |
| 11.2 | Testy integracyjne bazy i uprawnień | | | |
| 11.3 | Testy ścieżek użytkownika | | | |
| 11.4 | Testy regresji wizualnej | | | patrz 0.3 |
| 11.5 | Dostępność: klawiatura, kontrast, czytniki ekranu | | | |
| 11.6 | Wydajność przy pełnym zakresie projektu | | | |
| 11.7 | Skróty klawiszowe z widocznymi podpowiedziami | | | |
| 11.8 | Dokumentacja wdrożeniowa i instrukcja dla trzech stron | | | |

---

## Dziennik odłożeń

Każda pozycja przeniesiona na `ODŁOŻONA` trafia tutaj. Pusta tabela oznacza,
że zakres nie został zawężony.

| Data | Pozycja | Powód | Kto zdecydował | Kiedy wraca |
|---|---|---|---|---|
| 27.09.2026 | 3.10 Integracja z SharePoint | zależy od zgody IT klienta | propozycja audytu (E) — do zatwierdzenia przez właściciela | po zgodzie IT KSH |
| 27.09.2026 | 6.9 Elektroniczny list przewozowy | faza późniejsza | propozycja audytu (E) — do zatwierdzenia | po release-1.0 |
| 27.09.2026 | 7.11 KSeF | faktury wystawiane w systemach stron, TOWER rejestruje PDF | propozycja audytu (E) — do zatwierdzenia | po release-1.0 |
| 27.09.2026 | 9.6 Wiadomości tekstowe | brak darmowego dostawcy — decyzja: rezygnacja albo płatny dostawca | do decyzji właściciela | po decyzji |
| 27.09.2026 | 9.9 Kanał zespołowy | do decyzji | do decyzji właściciela | po decyzji |
| 27.09.2026 | 9.10 Kalendarz do subskrypcji | do decyzji | do decyzji właściciela | po decyzji |
| 27.09.2026 | 10.9 Ślad węglowy | faza późniejsza (kolumna `loads.co2_kg` istnieje, nic jej nie wylicza) | propozycja audytu (E) — do zatwierdzenia | po release-1.0 |

## Dziennik blokad

| Data | Pozycja | Na co czeka | Kto odblokowuje |
|---|---|---|---|
| 27.09.2026 | 2.8 Umowy powierzenia (RODO) | umowy HHL↔KSH↔SCX + dostawcy, klauzula GPS dla kierowców | właściciel, prawnik |
| 27.09.2026 | 5.1, 5.2, 5.3 Adapter telematyki | nazwa systemu SCX i API (spotkanie, blok A pytań) | właściciel / SCX |
| 27.09.2026 | 7.1 Macierz cennika | stawki z oferty i umowy (prod `rate_cards` 0, `rate_rules` 0) | właściciel |
| 27.09.2026 | 7.3 Indeksacja paliwowa | parametry SEFS i decyzja o pobieraniu notowań (prod `baf_definitions` 0) | właściciel + SCX |
| 27.09.2026 | 8.2 Komunikaty armatora | zgoda armatora na odczyt | właściciel |
| 27.09.2026 | 8.5 Zdarzenia drogowe SE | klucz Trafikverket | właściciel |
| 27.09.2026 | 8.6 Zdarzenia drogowe PL | wybór źródła | właściciel |
| 27.09.2026 | 8.10 Kody przyczyn opóźnień | uzgodnienie z przewoźnikiem | właściciel / SCX |

---

## 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026)

Wykryte przez inspekcję `watch-tower-makieta.vercel.app`. Nie były w moim
projekcie — wchodzą do rejestru, żeby nie zginęły przy przejęciu.

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 12.1 | Mapa Leaflet z kafelkami zamiast schematu SVG | | | markery `wt-marker`, `wt-marker-ferry`, `wt-dot`, `wt-arrow` |
| 12.2 | Ekran Opcje (administracja HHL) | | | 7 paneli |
| 12.3 | Cennik edytowalny z interfejsu, 3 linie wymiarowe | | | koszt 16500/19200/22800, przychód 20500/23800/27900 PLN |
| 12.4 | BAF/SEFS: indeks `SEFS_HYBRID_OKQ8_ORLEN`, SEK/l | | | baza 19,47 · bieżąca 19,68 · źródło okq8.se |
| 12.5 | Moduł factoringu: oferta, zapis stawek, widoczność dla SCX | | | |
| 12.6 | Załączniki CMR/POD przy fakturze | | | |
| 12.7 | Panel „Warunki drogowe SE · E4" | | | zasila go `/api/trafikverket` |
| 12.8 | Dzwonek powiadomień z licznikiem | | | |
| 12.9 | Zwijana nawigacja boczna | | | |
| 12.10 | Przeciągane karty sekcji na kokpicie | | | `section-card`, `section-grip` |
| 12.11 | Preferencje interfejsu per profil | | | język, domyślne ustawienia |
| 12.12 | Tabela pojazdów w widoku Mapy z własnym zestawem kolumn | | | Kod, Ładunek, Kierowca, Rejestracja, Status, ETA, Okno |
| 12.13 | Zbiór danych rozszerzony do 72 transportów i 28 ryzyk | | | |
| 12.14 | Kody przyczyn w kolejce ryzyk (siła wyższa, graniczne, pogoda) | | | |

## 13. Defekty wdrożenia do naprawy przed przejęciem

| # | Defekt | Waga | Dowód | Status |
|---|---|---|---|---|
| 13.1 | Tailwind v4 w bundlu — zmienne `--tw-*`, klasy `.flex .grid .absolute .p-2` | wysoka | `app.css` | |
| 13.2 | Systemowy stack czcionek z preflight Tailwinda obok Barlow | wysoka | `--default-font-family` | |
| 13.3 | `box-shadow` użyty 10×, `border-radius` > 2 px w 5 miejscach, `!important` 1× | średnia | `app.css` | |
| 13.4 | `POST /api/trafikverket` zwraca 405 — endpoint niewdrożony | wysoka | 4 żądania przy wejściu | |
| 13.5 | Trzy sprzeczne stany rejsu 24.09 na jednym ekranie | wysoka | nagłówek vs baner vs kolejka ryzyk | |
| 13.6 | KPI nie zgadza się z korytarzem (21+44 vs 21/39/5/7) | wysoka | kokpit | |
| 13.7 | Niespójne formatowanie kwot: „8739" obok „10 402,18" | średnia | harmonogram | |
| 13.8 | Godzina załadunku 02:00 w każdym wierszu — podejrzenie konwersji stref | wysoka | harmonogram | |
| 13.9 | Format daty odszedł od projektu: „30.09.2026, 02:00" zamiast „30.09 06:00" | niska | harmonogram | |
| 13.10 | Dane zastępcze: „Driver 1", „+48 600 000 000", „PSE 1000" | średnia | wszystkie role | osłabia demonstrację |
| 13.11 | Ciągi debugowe w interfejsie: `permitFits=false`, `CANCELLED`, `E4 CLOSED` | średnia | kolejka ryzyk | także język angielski w polskim UI |
| 13.12 | Telefon kierowcy w tabeli dla wszystkich ról, w tym klienta | wysoka | harmonogram | dane osobowe, RODO — **NAPRAWIONE 28.09 (0076, SEC-1 w POSTEP)** |
| 13.13 | `data-theme="dark"` zaszyte w `<html>` — ustawienie systemu ignorowane | niska | źródło strony | regresja naprawiona w makiecie |
| 13.14 | Udział paliwa = 0% — przy tym wzorze BAF zawsze wyjdzie zero | wysoka | Opcje | do potwierdzenia: wzór czy niewypełnione pole |
| 13.15 | Nowe wzorce wizualne poza katalogiem komponentów | średnia | eyebrow wersalikami, tytuł strony, etykieta w nagłówku panelu, karty przeciągane | przyjąć do systemu albo usunąć |
| 13.16 | Bundle 2,0 MB JS | średnia | `app.js` | ładowanie na telefonie w terenie |

---

## 14. Ustalenia z etapu 0 przekazania (23.09.2026)

Odpowiedzi Grok Bota na sprawdzenie dostępu. Zmieniają plan przejęcia.

| # | Ustalenie | Waga | Konsekwencja |
|---|---|---|---|
| 14.1 | **Brak repozytorium Git.** Kod żyje wyłącznie w `/workspace/watch-tower-app`, bez `.git`, bez remote | KRYTYCZNA | Zero historii, zero możliwości przeglądu zmian, jedno nadpisanie i praca przepada. Etap D („każda naprawa osobnym commitem") jest bez tego niewykonalny |
| 14.2 | **Katalog `api/` nie istnieje** — potwierdzenie przyczyny 405 na `/api/trafikverket` | wysoka | Panel warunków drogowych nie ma i nigdy nie miał źródła danych |
| 14.3 | **Istnieją inne boty z wiedzą o projekcie:** WT — UX, Visual, Research, QA | wysoka | Część intencji, decyzji i odrzuconych pomysłów leży poza sesją Groka. Bez eksportu ta wiedza ginie |
| 14.4 | **Dokumenty QA w `/workspace/watch-tower/qa-start/`** oraz pliki `*.md` w katalogu aplikacji | średnia | Istniejąca dokumentacja, dotąd nieuwzględniona w zakresie |
| 14.5 | Wizualne źródło prawdy: `/workspace/watch-tower/claude-v2.0/` | — | Makieta użyta zgodnie z założeniem |
| 14.6 | Plik blokady wersji prawdopodobnie nie istnieje | wysoka | Budowanie nieodtwarzalne; odtworzony lockfile nie jest oryginałem i musi być tak oznaczony |
| 14.7 | Brak CI, brak monitoringu, brak pomiarów wydajności, brak matrycy przeglądarek | średnia | Do zbudowania od zera |
| 14.8 | Brak mechanizmu zamrożenia zegara | wysoka | Blokuje powtarzalne zrzuty, więc blokuje test regresji wizualnej |
| 14.9 | Brak kluczy do integracji na żywo (Trafikverket, AIS i pozostałe) | średnia | Weryfikacja integracji dopiero po stronie właściciela |
| 14.10 | Stawki w ekranie Opcje: nieustalone, czy prawdziwe czy demonstracyjne | wysoka | Do czasu potwierdzenia muszą być widocznie oznaczone jako demonstracyjne — inaczej klient lub przewoźnik zobaczy liczby, które nie są ustaleniem |
| 14.11 | Konto Vercel: `sebastianbozekq-7781s`, projekt `watch-tower-makieta` | — | |

## 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A)

| # | Pozycja | Status | Notatka |
|---|---|---|---|
| 15.1 | `git init` w katalogu aplikacji | | |
| 15.2 | `.gitignore`: `node_modules`, `dist`, `.env*`, `.vercel` | | |
| 15.3 | Kopia makiety do `design/claude-v2.0/` (kopiować, nie przenosić) | | |
| 15.4 | Kopia dokumentów QA do `docs/qa-start/` | | |
| 15.5 | Commit bazowy + tag `baseline-2026-09-23` | | wersja poddana analizie |
| 15.6 | Repozytorium zdalne, prywatne | | |
| 15.7 | Odtworzenie pliku blokady wersji, oznaczone jako odtworzone | | |

---

## 16. Wiedza od agentów WT (przekazanie 23.09.2026)

Cztery role: UX, Visual, Research, QA. Artefakty rozrzucone po ~60 plikach
w trzech katalogach, dwa równoległe tory w `research-2026/`, część
dokumentów nieaktualna.

### 16.1 Gdzie co leży

| Katalog | Właściciel | Zawartość |
|---|---|---|
| `/workspace/watch-tower/UX_MAP.md` | WT — UX | role, moduły M1–M12, ścieżki §6/§6.5, dane startowe, kryteria akceptacji #1–21 |
| `VISUAL_BRIEF.md`, `VISUAL_ALIGN_CLAUDE.md` | WT — Visual | tokeny, Barlow, przepisy powłoki, bramy FAIL |
| `claude-visual-ref/`, `claude-makieta.html`, `claude-v2.0/` | — | trzy referencje wizualne, **konflikt kanoniczności** |
| `research-2026/` (deep-dive) | WT — Research | 01-competitors, 02-corridor-pl-se-apis, 03-eta-predictions, 04-ux-ops-trends |
| `research-2026/` (pack) | koordynator | 00_EXEC_SUMMARY … 07_TEAM_ORDERS |
| `research-2026/visual-gate-*` | WT — Visual | FULL_1TO1_SURFACE_CHECKLIST, START/RE/FINAL_SQUINT |
| `START_API_NOTES.md` | WT — Research | P0 dla buildera, MMSI, Plan B Stena |
| `qa-start/` | WT — QA | ~20 raportów SHIP/NO_SHIP + zrzuty |
| `QA_ELITE_UPGRADE_CHECKLIST.md` | WT — QA | bramy S1–S6, backlog elite D1–D8 |

### 16.2 Ustalenia produktowe, których nie miałem

| # | Ustalenie | Źródło | Uwaga |
|---|---|---|---|
| 16.1 | Stegra **nie jest rolą** — to punkt zainteresowania i strefa | UX_MAP §4 | mój „widok placu, tylko do odczytu" był opcjonalny — tu rozstrzygnięte |
| 16.2 | Motyw pierwszego malowania per rola: HHL i SCX ciemny, KSH jasny | akceptacja #12 | **koliduje z D16** — patrz 17.9 |
| 16.3 | ~~Import XLSX **tylko u KSH**, eksport **tylko u HHL**~~ **ZASTĄPIONA PRZEZ I-18** (właściciel 27.09: import u KSH zastąpiony potwierdzaniem dat przez KSH) | Visual | uprawnienie, którego nie miałem wprost |
| 16.4 | Ceny ukrywane **usunięciem z DOM per rola**, nie rozmyciem ani kropkami | UX_MAP | zgodne z zasadą „nie ukrywaj w interfejsie" |
| 16.5 | Moduły M1–M12 i ścieżki E1–E4 (audyt, zezwolenia, faktoring HHL, ufność ETA) | UX_MAP §6.5 | pełna lista do wciągnięcia do rejestru |
| 16.6 | Brama wizualna działa **na oko**, nie na różnicy pikseli | Visual | patrz 17.8 |
| 16.7 | FINAL_SQUINT PASS 96/0/6, powłoka zamrożona | Visual | stan na ~02:49 |
| 16.8 | MMSI: Wawel 311852000, Nova Star 311000787 | Research | |

### 16.3 Sprostowania faktograficzne od Research

| Twierdzenie | Sprostowanie |
|---|---|
| Trafikverket `FerryAnnouncement` jako status promu bałtyckiego | To **promy drogowe** (vägfärjor), nie Bałtyk. Do statusu Gdańsk–Nynäshamn nieprzydatne |
| FourKites jako lider kwadrantu Gartnera | Wyszli z kwadrantu 24.02.2025 |
| Publiczne API rezerwacyjne Polferries / Unity / TT | Nie istnieje. Nie wymyślać |
| Odczyt strony Polferries jako główne źródło | Ryzyko regulaminowe. Stanowisko Research: dane startowe + człowiek w pętli dla MVP. **Decyzja do podjęcia** |

## 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu

| # | Ryzyko | Waga | Źródło | Konsekwencja |
|---|---|---|---|---|
| 17.1 | **Import XLSX historycznie kasował tabelę (72→1)**. Naprawione pod P9 (łączenie 72→73), ale wrażliwe na dane wejściowe — regresja łatwa | KRYTYCZNA | QA | Utrata harmonogramu klienta. Wymaga testu regresji na kilku wariantach pliku, nie na jednym |
| 17.2 | **Magazyn trwały bez wersjonowania i migracji** (v5→v6-ready-gate). Bez wyczyszczenia pamięci przeglądarki czyta fałszywy stan | KRYTYCZNA | QA | Użytkownik po aktualizacji widzi dane sprzed zmiany schematu |
| 17.3 | **Trzy referencje wizualne na dysku**, dokumentacja UX wskazuje `claude-makieta.html`, koordynator `claude-v2.0/` | wysoka | UX vs koordynator | Nie wiadomo, wobec czego mierzyć wierność |
| 17.4 | **Brak pełnego przebiegu 14 prób po P9** — tylko skupione sprawdzenia | wysoka | QA | Nie wiadomo, czy naprawa importu nie zepsuła czegoś innego |
| 17.5 | Skarbiec kierowcy w pamięci przeglądarki — limit przy zdjęciach | średnia | QA | Utrata dokumentacji mocowania |
| 17.6 | Pozycja GPS jednorazowa, nie ciągła | średnia | QA | Śledzenie nie działa tak, jak sugeruje interfejs |
| 17.7 | Martwy MapLibre w drzewie obok żywego Leaflet | średnia | QA | Rozmiar paczki, mylące przy utrzymaniu |
| 17.8 | Brama wizualna „na oko" zamiast różnicy pikseli | wysoka | Visual | Dryf poniżej progu oka przechodzi. Potrzebne oba mechanizmy |
| 17.9 | Motyw per rola (akceptacja #12) wobec naprawy D16 | średnia | UX vs moja lista | **Rozstrzygnięcie: rola ustala motyw domyślny w kodzie, nie atrybut zaszyty w dokumencie. Użytkownik może nadpisać, wybór zapamiętany** |
| 17.10 | Dokumenty anti-slop nadal wskazują IBM Plex | średnia | Visual, UX | Builder może przeczytać nieaktualne i cofnąć krój |
| 17.11 | `corridor_ref.geojson` obiecany, nigdy niewytworzony | średnia | Research | Brak geometrii referencyjnej trasy z zezwolenia |
| 17.12 | Trafikverket: wersja schematu 1.5 wobec 1.6, filtr obszaru — do weryfikacji | średnia | Research | |
| 17.13 | Współrzędne terminali Gdańsk i Nynäshamn orientacyjne | średnia | Research | Strefy portowe mogą nie trafiać |
| 17.14 | Parametry operacyjne niezebrane: cutoff promu, progi fal, prędkość planowana ponadgabarytu | wysoka | Research | Wejdą z listy pytań do przewoźnika |
| 17.15 | Dwa równoległe tory plików w `research-2026/` | średnia | Research | Łatwo o sprzeczność; reguła rozstrzygania w README |
| 17.16 | Dowody FINAL w `/tmp/` — efemeryczne | niska | Visual | Do przeniesienia do repozytorium |

## 18. Status na 23.09.2026, 21:30

- 14.6 **zamknięte** — lockfile oryginalny istniał, regeneracja niepotrzebna
- 15.5 **zamknięte** — commit bazowy `af3ea61`, tag `baseline-2026-09-23`
- 15.6 **zamknięte** — zdalne `Spawn2018/testowe-do-migracji` (prywatne)
- **nowe 15.8** — weryfikacja kompletności wypchnięcia (trzy paczki przez agenta)
- **nowe 15.9** — kanon projektu poza repozytorium: `/workspace/watch-tower/`
  z UX_MAP, VISUAL_BRIEF, research-2026, bramami wizualnymi, START_API_NOTES,
  referencjami HTML i canonem wejściowym. Do wciągnięcia jako `docs/watch-tower/`
  z zachowaniem struktury
- **nowe 15.10** — dowody `/tmp/wt-*.png` do `docs/evidence/`, póki istnieją
- Repozytorium prywatne, bez uwierzytelnienia nieczytelne z zewnątrz —
  odczyt kodu przez archiwum albo lokalnie

## 19. Kolizja instrukcji 23.09.2026 ~21:35

- Instrukcje 0.5a i 0.5b trafiły do wykonawcy **w trakcie etapu C**.
  Etapy A i B zamknięte wcześniej, nie są powtarzane.
- **Poprawka metody weryfikacji:** porównanie sum plików w drzewie roboczym
  było błędne — w trakcie etapu C drzewo jest brudne. Porównujemy sumy
  **drzew commitów** (`git rev-parse <commit>^{tree}`). Równe drzewa
  oznaczają identyczną zawartość co do bajtu.
- Sumy commitów różnią się z definicji: `305da3e` lokalnie wobec `af3ea61`
  zdalnie, bo commit zasiewający zmienił rodzica. To nie jest usterka.
- **Nowa 15.11 — do potwierdzenia:** czy tag `baseline-2026-09-23` obejmuje
  także dokumenty przekazania (`00_KONTEKST.md`, `08_MANIFEST.md`), czy
  wyłącznie stan wdrożony. Na build nie wpływa, ale znaczenie tagu musi
  być jednoznaczne.

## 20. Etap C — wyniki i zamknięcia (23.09.2026, 22:06)

### Zamknięte
- **0.5a** — `305da3e^{tree}` = `af3ea61^{tree}` = `3c6c2af0…`, wypchnięcie kompletne
- **15.11** — baseline **nie zawiera** dokumentów przekazania; znaczenie tagu czyste
- **0.5b** — `0ad97ba`, +326 ścieżek, tag `baseline-docs-2026-09-23`; kanon w repozytorium
- **17.3** — kanon wizualny rozstrzygnięty: `claude-v2.0`. Wszystkie trzy cechy v2
  potwierdzone w aplikacji (cyfry na pasku etapów, nagłówek listu przewozowego
  z perforacją, ukośne pasy banera)
- **17.16** — dowody z `/tmp` **utracone**, odnotowane w `UTRACONE.md`, nieodtwarzane
- **C2.4** — test różnicy pikseli działa, próg 0,001, cztery próby dymne zielone

### Nowe znaleziska z etapu C

| # | Znalezisko | Waga | Źródło | Pozycja D |
|---|---|---|---|---|
| 20.1 | **104 napisy wpisane na stałe w komponentach** — wersja szwedzka w dużej części pozorna | KRYTYCZNA | C3 | D19 |
| 20.2 | **Różnice na fakturach zaszyte na stałe** — dopasowanie trójstronne jest fasadą | KRYTYCZNA | C1 | D20 |
| 20.3 | Tabela fasady: 98 pozycji — 73 działa, 11 częściowo, 8 atrap, 6 porzuconych | — | C1 | — |
| 20.4 | Atrapa: wybór przewoźnika „Wybierz" | średnia | C1 | D |
| 20.5 | Porzucone: MapLibre i warstwa telematyki | średnia | C1 | D21 |
| 20.6 | Słownik: 124 klucze, 47 nieużywanych | niska | C3 | — |
| 20.7 | Magazyn trwały: klucz v6 bez wersjonowania schematu | wysoka | plik 07 | D22 |
| 20.8 | Import harmonogramu bez testów automatycznych | KRYTYCZNA | plik 07 | D23 |
| 20.9 | Pełny przebieg 14 prób po P9 nie wykonany | wysoka | plik 07 | D24 |
| 20.10 | Skrypt zrzutów nawiguje po etykietach zależnych od języka — klasa błędu, nie pojedyncza usterka | średnia | C2.3 | narzędzie |

### Decyzja metodyczna
Wzorzec zrzutów pochodzi **z jednego przebiegu jednej wersji skryptu**.
Dogrywanie nieudanych ujęć poprawioną wersją jest zakazane — baseline
złożony z dwóch wersji nie pozwala odróżnić dryfu aplikacji od artefaktu
narzędzia.

### Jedyna dozwolona zmiana kodu przed etapem D
Atrybuty `data-view` na przyciskach nawigacji i `data-role` na przełączniku
roli. Narzędzie testowe, nie naprawa: zero wpływu na wygląd i zachowanie.

## 21. Etap C zamknięty (23.09.2026, 22:49)

- **C2.3** — 720/720, zero nieudanych, jeden przebieg, skrypt
  `2026-09-23-data-view`, suma paczki `138c2120e19b51fee3bf7cd452a7bc9387e8eeb943566e89a20648a7583112a2`
- Nawigacja w skrypcie po `data-view` / `data-role` / `data-lang`,
  bez wyrażeń na etykietach — klasa błędu 20.10 zamknięta u źródła
- `NAPRAWY.md` z D1–D24, podział 47 nieużywanych kluczy w `C3_JEZYKI.md`
- Dziesięć plików `00`–`09` w repozytorium

**Baseline wizualny istnieje.** Od tej chwili każda zmiana wyglądu jest
albo zamierzona i udokumentowana, albo jest usterką.

## 22. Etap D — struktura

Cztery fale, brama po każdej. **D25 nowe:** zamknięcie ośmiu atrap
i sześciu porzuconych z `02_FASADA.md` — zaimplementować, usunąć albo
widocznie oznaczyć jako nieaktywne.

| Fala | Zakres | Brama |
|---|---|---|
| 0 — siatka bezpieczeństwa | D23, D24 | testy zielone, raport 14 prób |
| 1 — fundament wizualny | D1, D2, D9, D21, D16 | **test zielony bez regeneracji wzorca** |
| 2 — prawda danych | D7 (odpowiedź przed naprawą), D22, D3, D4, D5, D8, D20 | przebieg 720, tag `baseline-fala-2` |
| 3 — treść i język | D19, D11, D12, D6, D10, D17, D13, D18, D25 | przebieg 720, tag `baseline-fala-3` |
| 4 — infrastruktura | D14, D15 | test zielony, raport rozmiaru paczki |

**Protokół regeneracji wzorca:** nigdy częściowo, nigdy po pojedynczej
naprawie. Pełny przebieg jednym skryptem na końcu fali, raport ile z 720
ujęć się zmieniło i dlaczego, commit plus tag. Więcej zmienionych ujęć,
niż da się uzasadnić, oznacza zatrzymanie, nie regenerację.

**Uzasadnienie kolejności:** D23 przed wszystkim, bo naprawy dotykają kodu,
który potrafi skasować harmonogram klienta, a testu wyłapującego to nie ma.
Fala 1 to wyłącznie usuwanie — czerwony test oznacza tam usterkę, nie zmianę.

## 23. Etap D, fala 0 — D23 zamknięte (23.09.2026, 23:02)

- 8/8 testów zielonych (Vitest), commit `ce9cafa`, PR #1, gałąź
  `cursor/d23-schedule-import-tests-27c2`
- Pięć wariantów pliku plus przypadki `allowRemovals`; każdy startuje
  z niepustej bazy i sprawdza, że istniejące ładunki przetrwały
- **Ustalenie:** logika ochronna **już była w kodzie** — `dryRunFromXlsx`
  zawsze zwraca `removedIds: []`, `commitImport` ignoruje usuwanie bez
  `allowRemovals` i przy `accepted === 0` nie rusza bazy. Testy nie naprawiają,
  tylko zamykają. Pozycja 17.1 i 20.8 **zamknięte**
- Wzorzec wizualny nietknięty

### 23.1 Ryzyko krytyczne ujawnione przy okazji

**Cały dorobek etapu C leży poza repozytorium**, na jednym komputerze:
atrybuty `data-view` / `data-role` / `data-lang`, `scripts/baseline.mjs`,
720 ujęć wzorcowych, `tests/visual.spec.ts`, konfiguracja Playwrighta,
pliki przekazania `01`–`09`, `NAPRAWY.md`, `C3_JEZYKI.md`, `C2_4_PIXEL.md`.

Dowody: w opisie PR — „`docs/handover/NAPRAWY.md` nie ma na main",
„`test:visual` w tym repozytorium nie istnieje"; w pytaniu koordynatora —
„lokalny box ma niezacommitowane data-view / handover".

Skutek uboczny: **dwa rozjeżdżające się światy**. Gałąź agenta chmurowego
wyszła z `main`, który nie zna `data-view`. Oba zmieniają `package.json`.

**Kolejność naprawcza:** scalić PR #1 → `pull --rebase` na boxie
i rozwiązać konflikt w `package.json` zachowując oba zestawy skryptów →
zmierzyć `shots-baseline` i zdecydować o Git LFS → wypchnąć całość
z tagiem `etap-c-2026-09-23` → weryfikacja drzew → dopiero D24.

| # | Pozycja | Status |
|---|---|---|
| 23.2 | Scalenie PR #1 | |
| 23.3 | Synchronizacja boxa, konflikt `package.json` | |
| 23.4 | Decyzja o Git LFS dla 720 ujęć (próg 100 MB) | |
| 23.5 | Wypchnięcie dorobku etapu C, tag `etap-c-2026-09-23` | |
| 23.6 | Weryfikacja drzew box wobec zdalnego | |

## 24. D26 — podgląd importu pokazuje usunięcia, których nie wykona

Z opisu PR #1: `diffSchedule` widzi brakujące kody jako `removed`,
a `dryRunFromXlsx(...).removedIds` jest `[]`.

Klient widzi w podglądzie „2 usunięte", zatwierdza, nic nie zostaje usunięte.
Podgląd kłamie — w bezpieczną stronę, ale kłamie.

Dwie dopuszczalne drogi: podgląd przestaje pokazywać usunięcia i zastępuje
je informacją, że brakujące kody zostaną zachowane; albo usunięcia stają się
możliwe za wyraźną zgodą — pole wyboru w oknie podglądu, domyślnie odznaczone,
z listą kodów. Druga lepsza operacyjnie, wymaga przekazania `allowRemovals`
z interfejsu. **Fala 3.**

## 25. Drobne do fali 3

- **25.1** Testy importu startują z sześciu ładunków; usterka historyczna
  dotyczyła siedemdziesięciu dwóch. Dodać jeden wariant na realnej skali
- **25.2** Gdy test wizualny trafi do CI — te same przeglądarki co lokalnie,
  inaczej różnice w renderowaniu czcionek dadzą fałszywe czerwone

## 26. Fala 0 zamknięta (23.09.2026)

| Pozycja | Wynik |
|---|---|
| D23 | 8/8 Vitest, PR #1 scalony squashem → `3f140a7` |
| D24 | **14/14 PASS (SHIP)**, paczka `index-BqvbHwzw.js`, suma `d91ce4c3786…474fa`, raport `docs/qa-start/D24_14_CLICK.md` (`71da774`) |
| Synchronizacja | box = zdalne, drzewo `d305c245…`, tag `etap-c-2026-09-23`, HEAD `86050d1` |
| Wzorzec wizualny | `shots-baseline` 100 MB → **Git LFS**, 720/720 |
| Testy | `test:unit` 8/8, Playwright 4/4 |
| D26 | dopisane do fali 3, wybrana **droga 2**: usunięcia za wyraźną zgodą |

Zamknięte przy okazji: 23.2–23.6, 20.8, 17.1.

### 26.1 Otwarte, blokujące bramę fali 1

| # | Pozycja | Waga | Uwaga |
|---|---|---|---|
| 26.2 | **CI nie działa** — runner Actions nie startuje z powodu rozliczeń | KRYTYCZNA | Testy są w repozytorium, ale nikt ich nie uruchamia. Brama fali 1 („test musi zostać zielony") jest bez tego pozorna. Trzy drogi: włączyć rozliczenia, hak `pre-push`, własny runner. Do czasu rozstrzygnięcia — uruchamianie ręczne po każdym commicie, z liczbami w `NAPRAWY.md` |
| 26.3 | **LFS w kroku pobierania kodu w CI** | wysoka | Bez `lfs: true` test wizualny porówna zrzut ze wskaźnikiem LFS i wywali się tak, jakby wygląd się rozjechał |
| 26.4 | Potwierdzenie, że tag `etap-c-2026-09-23` wskazuje commit z drzewem `d305c245…`, a `71da774` jest po nim | niska | porządek w rejestrze |

## 27. Fala 1 — kolejność i korekta reguły bramy

Kolejność wykonania **zmieniona** względem `ETAP_D.md`: od izolowanych
do najgroźniejszego.

```
D21 → D9 → D16 → D1 → D2
```

Gdy największa zmiana ląduje na końcu, każde pęknięcie po niej pochodzi
od niej. D1 poprzedzony inwentarzem: każda używana klasa użytkowa z plikiem
i linią. D2 jest konsekwencją D1, nie osobną pracą.

### 27.1 Korekta reguły bramy — istotna

Preflight Tailwinda wykonuje realną pracę: zeruje marginesy nagłówków,
punktory list, obramowania tabel, style kontrolek, ustawia `box-sizing`.
Usunięcie go **może przesunąć układ i zapalić test na czerwono**.
To jest sytuacja przewidziana.

**Jedyna dopuszczalna reakcja: dopisać brakujące zerowanie do arkusza
projektowego, aż test wróci do zieleni. Nigdy nie regenerować wzorca.**

Regeneracja w fali 1 zamroziłaby przesunięty układ jako nowy wzorzec.
Od tej chwili aplikacja różniłaby się od zatwierdzonej makiety, a test
byłby zielony i nikt by o tym nie wiedział. **Tak właśnie projekty tracą
wierność wizualną — nie jednym błędem, tylko serią zielonych testów
na przesuniętym wzorcu.**

Jeżeli po dopisaniu zerowania zieleń nie wraca — zatrzymanie i zgłoszenie,
które ujęcia i czym się różnią.

## 28. Fala 1 zamknięta (24.09.2026)

| Pozycja | Commit | Wynik |
|---|---|---|
| D21 martwy MapLibre | `58a509a` | usunięty `maplibre-gl`, `CorridorMap.leaflet.tsx`, style i selektory; paczka −246 B (zależność była poza grafem importów) |
| D9 cienie, promienie | `cb41781` | **częściowo** — cienie w 3 miejscach, promień 3→2, „część" `!important` |
| D16 motyw per rola | `230e876` | HHL i SCX ciemny, KSH jasny, bez klasy na dokumencie; testy 8→13 |
| D1a inwentarz | `de851b8` | 26 klas użytkowych w 42 miejscach, tylko `DriverPwa` i `NotificationBell` |
| D1 + D2 | — | Tailwind usunięty według inwentarza |

**Brama: `unit 13/13`, `playwright 4/4`, `visual 720/720 bez regeneracji
wzorca`.** Paczka: CSS −12 KB, JS −189 B. Tip `757f1e4`,
tag `baseline-fala-1-2026-09-24`.

Wynik 720/720 bez regeneracji dowodzi, że preflight Tailwinda nie wykonywał
w tej aplikacji pracy, na której ktoś polegał. Korekta reguły z 27.1 okazała
się niepotrzebna — ale słusznie była na stole.

### 28.1 Otwarte po fali 1

| # | Pozycja | Waga |
|---|---|---|
| 28.2 | **Kolizja numeracji w `NAPRAWY.md`** — dwa systemy D nakładają się; wychwycone przy D9 („D9-legacy" = JSONLogic). Ujednolicić: `D1–D26` z mojej listy, wcześniejsze z przedrostkiem `L`, tabela przekładu na górze pliku | wysoka |
| 28.3 | **D9 zamknięte częściowo** — inspekcja zewnętrzna wykazała 10 cieni, 5 promieni > 2 px, 1 `!important`; zgłoszono 3 cienie i „część". Weryfikacja przez `.stylelintrc.json` z paczki, z liczbami i uzasadnieniem dla każdego wyjątku | średnia |
| 28.4 | **D2 bez dowodu** — brak potwierdzenia zera `--tw-` i braku czcionek systemowych w zbudowanym arkuszu | niska |
| 28.5 | **`unit.yml` z `lfs: true` niewypchnięty** — brak uprawnienia `workflow` w tokenie. Hak `pre-push` (`947da02`) pokrywa unit i Playwrighta, **nie pokrywa 720 ujęć** | wysoka — zadanie właściciela |

## 29. Fala 2 — kolejność i szacunki

```
D7 (odpowiedź) → D22 → D5 → D4 → D3 → D20 → D8
```

D8 ostatnie, bo dotyka wszystkich dat i zmieni najwięcej ujęć — wcześniej
zatopiłoby w szumie różnice z pozostałych napraw.

Szacunek zmian we wzorcu, do weryfikacji przy bramie:

| Pozycja | Szacunek ujęć |
|---|---|
| D22 | 0, o ile migracja zachowa stan |
| D5 | ~90 |
| D4 | ~180 |
| D3 | ~90 |
| D20 | ~60 |
| D8 | 400+ |

### 29.1 Pułapka D22
Podbicie wersji magazynu z migracją **kasującą** stan da pustą aplikację
we wszystkich 720 ujęciach. Dwa warunki: migracja przenosi, nie kasuje;
`baseline.mjs` startuje z jawnie zaszczepionego stanu, nie z pozostałości
po poprzednim przebiegu. Drugi warunek sprawdzić **przed** D22.

## 30. Sprostowania po mojej stronie (24.09.2026)

**30.1 Liczby D9 były mierzone przed D1.** „10 cieni, 5 promieni > 2 px,
1 `!important`" pochodzi ze zbudowanego arkusza wdrożenia **z Tailwindem
w środku**. Część mogła należeć do Tailwinda i zniknąć razem z nim.
Zgłoszone przez wykonawcę trzy miejsca mogą być kompletnym wynikiem
dla obecnego stanu. **Zarzut zawieszony do pomiaru na obecnej paczce.**

**30.2 Błąd w `.stylelintrc.json` z paczki.** Komentarze zapisane jako klucze
wewnątrz sekcji `rules` (`"//odstepy"`, `"//gradienty"`, `"//jednostki"`,
`"//styl-w-komponentach"`) — stylelint waliduje nazwy reguł i wywala się
na nich z „Unknown rule". Dodatkowo zbędne nadpisanie dla `.tsx` przez
`postcss-styled-syntax`. **Plik poprawiony i przycięty; obowiązuje nowa wersja.**

Świadomie pominięte w nowej wersji: `selector-class-pattern` (zgłaszałaby
`section-card-hd--drag`, czyli D13 — dołożyć po fali 3) oraz sprawdzanie
plików `.tsx` (po D1 nie ma tam stylowania).

**30.3 Kolejność dla D9:** najpierw pomiar przez `grep` na obecnym źródle —
trzy liczby i lista miejsc, dziesięć sekund. Stylelint jest narzędziem
pilnowania, nie warunkiem zamknięcia. Nie blokować D9 na jego konfiguracji.

## 31. Fala 2 zamknięta — z trzema zastrzeżeniami (24.09.2026)

| Pozycja | Commit | Wynik |
|---|---|---|
| D9 dokończone | — | cienie 0, promienie > 2 px 0, `!important` 28→11 (reduced-motion, Leaflet, `[hidden]`); zamiany: `border-left`, `outline`, `50%` |
| Stylelint | `2415e11` | podpięty; triada czysta; **492 błędy poza triadą** |
| D2 | — | `--tw-` 0; Barlow + zastępcze; `Helvetica Neue` z `leaflet.css` nadpisana w czasie działania |
| Numeracja | `fb197e4` | tabela przekładu; otwarte L1, L2, L4, L5, L7, L8, L9, L16 |
| D7 | — | odpowiedź udzielona, **wzór inny niż zakładany** |
| D22 | `107bb35` | `STORE_SCHEMA_VERSION = 1`, migracja v0→v1; unit 23 |
| D5 | `cc31d93` | przyczyna: whitelist pomijał `DELAYED`/`SILENT`; `corridorKpis.ts` |
| D4 | `d26f8cd` | przyczyna: `SAIL_ROWS` z odwróconymi statkami; SoT `voyage.ts` |
| D3 | — | etykieta demonstracyjna, brak klucza |
| D20 | `bfb23d5` | `buildThreeWayMatch` zamiast zaszytych +1240/+600/+1840 |
| D8 | `1690153` | Warsaw dla interfejsu, Stockholm dla ETA Boden, `Intl` |
| Brama | `27fe0dd` | unit 41/41, pw 4/4, **249/720 zmienionych**, tag `baseline-fala-2-2026-09-24` |

### 31.1 Zastrzeżenie krytyczne: widok Ryzyka — 0 zmian
D3 (etykieta demo) i D4 (źródło rejsów) zmieniają ten widok widocznie.
Zero zmienionych ujęć jest niemożliwe. Trzy hipotezy: trzecia kopia danych
rejsów w tabeli promowej Ryzyk; etykieta D3 w innym miejscu; widok poza
matrycą. **Wzorzec już zregenerowany — mógł zamrozić usterkę.**
Fala 3 wstrzymana do wyjaśnienia.

### 31.2 Próg wizualny za luźny dla treści
`maxDiffPixelRatio: 0.001` przepuszcza zmienioną cyfrę w komórce
i **luzuje się wraz z długością strony** — najsłabiej chroniony jest
harmonogram. Zmiana na `maxDiffPixels` bezwzględne z `threshold`
na wygładzanie. Uznana granica: test pikselowy pilnuje wyglądu,
poprawność treści pilnują asercje.

### 31.3 Stylelint — błędy po mojej stronie
- reguła zakazu nieparzystych pikseli **sprzeczna z kanonem** (`9px 13px`,
  `7px 9px` w makiecie wszędzie) — **usunięta**
- wzorzec `**/tower.css` nie trafiał w nic, arkusz to `src/index.css` —
  **usunięty**; arkusz zostaje w lincie, reguły formatowania do świadomego
  wyłączenia na podstawie pięciu najczęstszych z wyniku

### 31.4 D7 — decyzja biznesowa, nie naprawa
Wzór: `appliedMult = Math.min(multSek, multPln)` z tablic SEFS_SEK/SEFS_PLN,
tylko na stawkę drogową (`src/lib/sefs.ts` L50–63, `src/lib/pricing.ts` L53–54).
**Nie ma mnożnika udziału paliwa.** Pola w ekranie Opcje mogą być fasadą.

**Do decyzji właściciela:**
- czy `hybrid_min` jest zamierzony — przy stosowaniu tylko po stronie kosztu
  chroni marżę HHL; przy stosowaniu po obu stronach klient zawsze płaci
  niższą dopłatę
- po której stronie ma działać: koszt, przychód, obie
- skąd prawdziwe wartości tablic SEFS — z uzgodnienia z przewoźnikiem

### 31.5 Nowe narzędzie: D19-T
Test polskich znaków diakrytycznych w interfejsie EN i SV, z wyłączeniem
komórek z danymi. Licznik D19 spadający do zera zamiast ręcznego szukania
stu czterech napisów.

## 32. D7 — decyzja właściciela (24.09.2026)

**DECYZJA:** dla każdej ze stron stosowany jest dokładnie ten sam mechanizm
opłaty paliwowej. Zasada, źródło cen hurtowych i mechanizm opisane w plikach
projektu. `hybrid_min` (`Math.min(multSek, multPln)`, tylko stawka drogowa)
jest zamierzony i działa identycznie po stronie kosztu i przychodu.

Pozycja 31.4 **zamknięta jako pytanie biznesowe**. D7 przechodzi
w weryfikację zgodności kodu z dokumentem.

| # | Pozycja | Status | Uwaga |
|---|---|---|---|
| 32.1 | Ścieżki dokumentów opisujących mechanizm | | jeden obowiązujący |
| 32.2 | Tabela zgodności reguła–kod w `03_PARAMETRY_BIZNESOWE.md` | | każda niezgodność = osobna naprawa |
| 32.3 | **Data pobrania mnożnika** — ta sama dla obu stron, migawka przy transporcie | | główne ryzyko praktyczne: cykl faktur przewoźnika tygodniowy, klienta może być inny |
| 32.4 | Test niezmiennika: mnożnik kosztu = mnożnik przychodu, identyczny przyrost % stawki drogowej | | chroni przed przyszłymi wyjątkami |
| 32.5 | Pola Opcje niezasilające `computeSefs` → D25 | | fasada szczególnie groźna: zapis bez skutku |

**Zapis do dokumentacji:** marża procentowa całego transportu **nie jest**
stała przy zmianie cen paliwa, bo mnożnik obejmuje tylko stawkę drogową,
a prom i pilotaż nie. Niezmiennikiem jest równość mnożników po obu
stronach, nie stałość marży całkowitej.

D7 nie blokuje już startu fali 3.

## 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026)

**DECYZJA:** faktura obejmuje transporty zrealizowane w danym tygodniu.
Realizacja usługi = dostarczenie towaru. Mnożnik opłaty paliwowej:

| Poziom | Stan transportu | Data dla mnożnika |
|---|---|---|
| PROGNOZA | niedostarczony | planowana data dostawy z harmonogramu |
| REALIZACJA | dostarczony | rzeczywista data dostawy (migawka) |
| FAKTURA | zafakturowany | nadrzędna, nadpisuje powyższe |

Ta sama data po obu stronach → ten sam mnożnik. **Pozycja 32.3 zamknięta.**

| # | Pozycja | Waga | Uwaga |
|---|---|---|---|
| 33.1 | Trzy wartości przy transporcie ze źródłem i migawką mnożnika | wysoka | zmiana schematu → `STORE_SCHEMA_VERSION` 2 z migracją |
| 33.2 | **„Faktura nadpisuje" nie może kasować wartości wyliczonej** | KRYTYCZNA | inaczej D20 porównuje fakturę samą ze sobą; obie wartości zapisane, marża z faktury, różnica flagowana |
| 33.3 | **Tydzień liczony w czasie lokalnym, nie w UTC** | wysoka | dostawa pon. 00:30 lokalnie = nd. 22:30 UTC latem → zła faktura; usterka sezonowa |
| 33.4 | Który odczyt indeksu obowiązuje w danej dacie — z dokumentacji | średnia | jeżeli dokumentacja milczy: zgłosić, nie zakładać |
| 33.5 | Testy: prognoza, realizacja, faktura, granica tygodnia lato/zima, przesunięcie planu | wysoka | |
| 33.6 | Propozycja: marża rozbita na zafakturowaną, zrealizowaną, prognozowaną w widoku Finanse | — | **do zgody właściciela**, w istniejącym wzorcu `.mrow` |

Kolejność: fala 3, po D10 i D17.

## 34. Mechanizm pieniędzy — decyzje W1–W6 i realizacja (24.09.2026)

**DECYZJE WŁAŚCICIELA:**
- **W1** wszystkie ceny w EUR; nigdzie PLN ani SEK
- **W2** wyjątek: kokpit przeliczany na PLN
- **W3** kurs przewoźnika na fakturze: NBP, tabela A, kurs średni z dnia
  roboczego poprzedzającego dzień rozładunku
- W4–W6 jak w sekcjach 32–33 (ten sam mechanizm paliwowy, tydzień
  realizacji, trzy poziomy, faktura nadrzędna)

Jedyne źródło prawdy: **`MECHANIZM_PIENIEDZY.md`**. Zastępuje
`D7_DECYZJA.md` i `D7_CZAS.md` tam, gdzie się pokrywają.

### 34.1 Zweryfikowane na żywym API NBP
- endpoint i kształt odpowiedzi potwierdzone
- pojedynczy dzień bez publikacji → 404; zawsze przedział
- **24–28.12.2025 bez tabel** (Wigilia wolna od 2025); rozładunek 29.12.2025
  → tabela 248/A/NBP/2025 z 23.12
- ostatnia tabela na 24.09.2026: 186/A/NBP/2026, 4,3900
- **pułapka UTC udowodniona liczbowo:** rozładunek 29.12.2025 23:30 UTC
  = 30.12 00:30 lokalnie → poprawnie 249/A, w UTC błędnie 248/A

### 34.2 Pliki referencyjne przygotowane i przetestowane
| Plik | Wynik |
|---|---|
| `lib/pricing/engine.ts` (przepisany) | typy `--strict` OK |
| `tests/money.test.ts` | **34 zielone, 1 pominięty celowo** (żywe API za `NBP_LIVE=1`) |
| `tests/fixtures/nbp-eur-2025-12.json` | 15 prawdziwych tabel A |
| `supabase/migrations/0001_core.sql` | waluta EUR z `CHECK`, kolumny poziomu i migawek; **parser Postgresa: 130 instrukcji bez błędów** |

Silnik **nie reimplementuje** mechanizmu SEFS — przyjmuje stawkę drogową
przed i po `applySefsToRoadRate`. Stary wzór z udziałem paliwa usunięty
z silnika i oznaczony jako niestosowany w migracji i w `CURSOR_PROMPT.md`.

### 34.3 Uzgodnione z decyzją
- `DESIGN_SYSTEM.md` — reguła kwot; „PLN" w makiecie to treść sprzed
  decyzji, nie forma
- `PYTANIA_SCANDINAVIAN_EXPRESS.md` — F1, F2, F4, F5, F6 rozstrzygnięte
  albo nie dotyczą

### 34.4 Zakres realizacji w aplikacji — fala 3, M1–M6
Pełna lista miejsc w `MECHANIZM_PIENIEDZY.md` sekcja 5: magazyn v2,
generator danych, cennik, dodatki, faktoring, harmonogram, szuflada,
kokpit trzech ról, finanse, rozliczenia, moje stawki, faktury, opcje,
kolejka ryzyk, powiadomienia, eksport XLSX, szablony automatyzacji,
dopasowanie trójstronne (+ sprawdzenie tabeli i kursu NBP), słownik i18n.

**Nowy test D-EUR-T:** zero PLN/zł/SEK/kr w interfejsie poza jawnymi
wyjątkami (kokpit, dane indeksu paliwowego, kurs na fakturze, suma polisy).

### 34.5 Pytania do właściciela — blokują M2

| # | Pytanie | Propozycja domyślna |
|---|---|---|
| P1 | Które zdarzenie jest realizacją: rozładunek czy dostarczenie dokumentów | zakończenie rozładunku |
| P2 | Faktura HHL→KSH: ta sama reguła kursowa? **Luka: brak miejsca na fakturę HHL→KSH w aplikacji** | tak; wprowadzanie ręczne lub import |
| P3 | Kokpit w PLN dla wszystkich ról czy tylko HHL | wszystkie trzy |
| P4 | Dane wejściowe indeksu paliwowego (SEK/l, PLN/l) | wyjątek od W1 — przeliczenie byłoby metodologicznie błędne |
| P5 | Symbol czy kod waluty; format liczby wg języka | kod (`EUR`, `PLN`), format wg języka |
| P6 | Stawki demonstracyjne w PLN | przeliczyć raz tabelą 186/A/NBP/2026 (4,3900), zostawić oznaczenie D18 |
| P7 | Kurs i numer tabeli na widoku faktury | pokazywać, bez kwot w PLN |
| P8 | Suma gwarancyjna polisy OCP | w walucie polisy — to atrybut dokumentu, nie cena |

### 34.6 Poza aplikacją
- W3 do warunków zlecenia albo umowy z przewoźnikiem — dla podmiotu
  niebędącego polskim podatnikiem to warunek umowny, nie ustawowy
- zastosowanie reguły do tego rodzaju usługi potwierdza księgowość

## 35. Faktury trzech stron, zlecenia, terminy, waluta per użytkownik (24.09.2026)

### 35.1 Decyzje właściciela
- **W1 zmienione:** EUR wszędzie; **każdy użytkownik przełącza walutę
  wyświetlania na PLN w swoich ustawieniach** — przeliczenie wszędzie.
  „PLN tylko na kokpicie" **zastąpione**
- **P1–P8 rozstrzygnięte:** realizacja = rozładunek; faktura HHL→KSH tak;
  indeks paliwowy w walutach bazowych; kod waluty i format wg języka;
  stawki demo przeliczone 4,3900; kurs + tabela + **data kursu** na fakturze;
  suma polisy w walucie polisy
- **W7** faktura HHL widoczna dla HHL i KSH; faktura SCX dla HHL i SCX;
  HHL widzi wszystkie
- **W8** HHL i SCX wybierają walutę faktury: EUR albo PLN
- **W9** faktury z systemów zewnętrznych, rejestrowane z plikiem
- **W10** system liczy termin każdej faktury i wysyła przypomnienia
- **W11** „Opłacona" — ręcznie, wyłącznie HHL, koszt i przychód
- **W12** numery zleceń HHL i SCX obowiązkowe, widoczne w Harmonogramie
- **W13** moduł Faktury dla KSH: faktury HHL + CMR i POD, nic więcej

### 35.2 Zrealizowane i sprawdzone po mojej stronie
| Element | Wynik |
|---|---|
| `lib/pricing/engine.ts` | waluta per użytkownik, faktury EUR/PLN z **kursem per pozycja**, kontrole tygodnia, podwójnego fakturowania, termin, stan płatności, przypomnienia, widoczność; typy `--strict` OK |
| `tests/money.test.ts` | **49 zielonych**, 1 pominięty celowo |
| **Test wykrył błąd w samym teście**: numer tabeli z 2.01.2026 wpisany z pamięci jako 002/A — według NBP to **001/A** (pierwsza tabela roku). Silnik miał rację | poprawione |
| `0003_faktury_zlecenia_ustawienia.sql` | nowa migracja |
| **Migracje wykonane na prawdziwym Postgres 16 + PostGIS**, od czystej bazy | 3/3 OK |
| `tests/db/run.sh` — podszywanie się pod HHL, KSH, SCX | **32/32** |

### 35.3 Usterki znalezione wykonaniem, niewidoczne dla parsera SQL
| # | Usterka | Od kiedy | Naprawa |
|---|---|---|---|
| 35.3.1 | **Brak rozszerzenia `citext`** — migracja 0001 wywróciłaby się przy pierwszym wdrożeniu | od pierwszego dnia | `create extension citext` |
| 35.3.2 | **Dziennik audytu nieczytelny dla administratora HHL** — `revoke all` odebrał też odczyt | od pierwszego dnia | `grant select`, zapis nadal tylko funkcjami |
| 35.3.3 | **Funkcja terminów wywoływalna przez użytkowników** — z datą z przyszłości dałoby się oznaczyć wszystkie faktury jako przeterminowane | 0003 | zadanie wyłącznie systemowe, `revoke execute` |
| 35.3.4 | **Przywileje kolumnowe nie odróżniają wystawcy od odbiorcy** — KSH mógłby zmienić kwotę faktury HHL | 0003 | wyzwalacz strażnika |
| 35.3.5 | Ograniczenie `currency = 'EUR'` na fakturach sprzeczne z W8 | poprzednia tura | dopuszczone EUR i PLN |

### 35.4 Pytania otwarte — `MECHANIZM_PIENIEDZY.md` sekcja 9
Q1–Q14. **Blokują:** Q1 (czy SCX widzi własną fakturę), **Q2 (kurs per
pozycja na fakturze tygodniowej PLN — czy systemy fakturowe to potrafią)**,
Q3 (termin od wystawienia czy doręczenia), Q12 (ustawienia użytkownika
w nawigacji KSH i SCX).

### 35.5 Do przewoźnika
`PYTANIA_SCANDINAVIAN_EXPRESS.md`: F7 (termin — dni i podstawa), F11
(kurs per pozycja w ich systemie fakturowym), F12 (waluta domyślna),
F13 (ich numer zlecenia).

## 36. Zlecenie końcowe dla Groka (24.09.2026)

### 36.1 Rozstrzygnięcia właściciela
Q1 tak · **Q2 każdy zrealizowany transport ma indywidualny kurs** ·
Q3 od wystawienia · **Q4 KSH 30 dni, HHL wobec SCX 35 dni** · Q12 zgoda ·
Q5–Q11, Q13, Q14 — „tak do wszystkich".

### 36.2 Wprowadzone do bazy i sprawdzone
- **Q7:** spór bez uzasadnienia odrzucany przez bazę
- **Q14:** HHL nie zmieni statusu weryfikacji na fakturze, której jest
  wystawcą; fakturę kosztową od SCX weryfikuje normalnie
- `supabase/seed/stegra.sql` — organizacje, projekt, warunki płatności
  30 i 35 dni od wystawienia; wykonanie wielokrotne bezpieczne
- **test bezpieczeństwa: 39/39** od czystej bazy; silnik: 49/49

### 36.3 Stan przekazania
Właściciel **nie przekazał** Grokowi: `FALA2_PRZEGLAD.md`, `D7_DECYZJA.md`,
`D7_CZAS.md`, `MECHANIZM_PIENIEDZY.md`. Ich treść jest w
**`ZLECENIE_DLA_GROKA.md`** albo w pakiecie, do którego zlecenie odsyła.

### 36.4 Najważniejsze ustalenie architektoniczne
**Obecna aplikacja nie ma wspólnej bazy** — Vite + Zustand w `localStorage`,
każda przeglądarka z własną kopią, przełącznik ról jako pokaz. Decyzje
W7–W13 (faktury trzech stron, przypomnienia, płatności) i rozdzielenie
cen są **niewykonalne bez backendu**. Zlecenie obejmuje backend Supabase
(etap 3) — migracje `0001`–`0003` są jego sprawdzonym kontraktem.
**Do zamknięcia etapu 3 aplikacja nie jest udostępniana stronom
z prawdziwymi danymi.**

### 36.5 Struktura zlecenia
Etapy 0–6, **51 pozycji**, spójność listy kontrolnej z treścią sprawdzona
programowo w obie strony. Mechanizm przeciw utracie kontekstu: zapis
zlecenia w repozytorium, `POSTEP.md` jako pamięć zewnętrzna, lista
kontrolna jako suma kontrolna przeczytania. STOP wyłącznie w pięciu
określonych sytuacjach.

### 36.6 Poza zakresem, zapisane jako otwarte
adapter telematyki · parametry operacyjne od przewoźnika · geometria trasy
z zezwolenia · klucz Trafikverket · **źródło statusu promów Polferries
(decyzja właściciela)** · rozbicie marży na trzy poziomy (zgoda) ·
rozliczenia GitHub Actions i `unit.yml` (właściciel).

### 36.7 Do przygotowania przez właściciela przed etapem 3
Projekt Supabase w regionie UE, konto Resend ze zweryfikowaną domeną
nadawcy, środowisko testowe (Docker albo drugi projekt Supabase).

## 37. Statusy z pozycji, PROM, naprawy silnika stref (24.09.2026)

### 37.1 Decyzje właściciela
- **S1** statusy zmieniają się na podstawie pozycji
- **S2** port PL i port SE mają strefy; wjazd = automatyczna zmiana statusu
- **S3** PROM: auto w strefie portu Gdańsk + czas wypłynięcia przypisanego
  rejsu wg rozkładu armatora → system sam przełącza na PROM
- **rozbicie marży w Finansach — zatwierdzone** (dotąd wstrzymane)
- **GitHub Actions — odłożone**; hak `pre-push` pozostaje
- **po pracy Groka budowę dokończy Cursor**

Jedyne źródło prawdy: **`STATUSY_AUTOMATYCZNE.md`**.

### 37.2 Sprostowania moich wcześniejszych opisów
| Twierdziłem | Stan faktyczny |
|---|---|
| „12 zaseedowanych stref korytarza" | **5 stref w zakomentowanym szablonie**; po migracjach baza nie miała żadnej. Punktów kontrolnych E4 i stref załadunku nie było wcale |
| silnik stref z trzema warstwami ochrony — gotowy | **nigdy nie przetworzył punktu w strefie** — patrz 37.3 |
| automatyczna zmiana statusu ze stref | **nie istniała** — silnik zapisywał zdarzenia, statusu nie zmieniał |

### 37.3 Usterki wykryte wykonaniem na Postgres 16
| # | Miejsce | Usterka | Skutek |
|---|---|---|---|
| G1 | 0002 `process_position` | kolumny wyniku o nazwach kolumn tabel | każda pozycja przy strefie — błąd, **pozycja przepadała** |
| G2 | 0002 zapis zdarzenia | brak warunku indeksu częściowego | **żaden wjazd ani wyjazd nie mógł powstać** |
| G3 | 0002 `make_circle_fence` | bufor w EPSG:3857 | strefy **40–60% za małe**, błąd rośnie na północ |
| **B1** | 0001 transport | prawo zmiany całej tabeli niweczyło listę kolumn przewoźnika | **przewoźnik zmieniał numery zleceń HHL i KSH** |
| B2 | 0001 transport | statek i godzina odejścia jako wolny tekst obok tabeli rejsów | dwa źródła prawdy o rejsie — usterka klasy D4 |
| B3 | 0001 transport | data rozładunku edytowalna po zafakturowaniu | cofnięcie o dzień zmienia kurs NBP na korzyść wystawcy |
| — | test 39/39 | sprawdzał, co wolno, nie czego nie wolno | B1 niewidoczna dla testu |

Wszystkie naprawione. **Wniosek metodyczny: test uprawnień musi sprawdzać
zakazy, nie tylko pozwolenia.**

### 37.4 Zrealizowane
- `0004_statusy_automatyczne.sql`: rejsy, statki, przypisanie rejsu,
  automat statusów ze stref, PROM w chwili odejścia (stan strefy na moment
  odejścia, nie „teraz"), opóźnienia i odwołania, PROM po czasie, przejście
  awaryjne przy zgubionym porcie SE, strażnik kolumn transportu, UNLOADED
  wymaga daty, zamrożenie daty rozładunku po fakturze z audytem,
  harmonogram pg_cron warunkowo
- seed: 5 stref z krajem, 2 statki
- **`tests/db/security.sh` 50/50** (+11 zakazów), **`tests/db/status.sh`
  44/44** — symulacja jedenastu ciężarówek pozycjami GPS
- `AGENTS.md`, `.cursor/rules/tower.mdc` — zasady w repozytorium dla Cursora
- `MECHANIZM_PIENIEDZY.md` 2.2 — rozbicie marży, zasada Z4
- `ANEKS_1_DLA_GROKA.md` — pozycje AN1, M10, M11; łącznie 54

### 37.5 Otwarte
- strefy załadunku z `ADDRESSES.md` — wykonawca
- weryfikacja współrzędnych terminali z mapą — wykonawca
- **źródło statusu promów Polferries** — decyzja właściciela
- lista kolumn przewoźnika zawiera **okna planowe załadunku i dostawy**
  (decyzja z 0001) — czy przewoźnik ma je zmieniać, skoro plan pochodzi
  z harmonogramu KSH? Do potwierdzenia przez właściciela
- **prompt dla Cursora** — po raporcie końcowym Groka

## 38. Źródła danych zewnętrznych, okna planowe (25.09.2026)

### 38.1 Decyzje właściciela
- **przewoźnik nie zmienia okien planowych** załadunku i dostawy —
  wymuszone w 0004, `security.sh` 52/52 (+2 przypadki)
- źródła danych zewnętrznych — **wyłącznie darmowe**

Jedyne źródło prawdy: **`ZRODLA_DANYCH.md`**.

### 38.2 Zweryfikowane na żywo
| Źródło | Wynik |
|---|---|
| Polferries — komunikaty | HTML serwerowy, bez API; `robots.txt` dopuszcza; rejsy Gdańsk–Nynäshamn w obu kierunkach ok. tydzień naprzód; dziś wyłącznie „Planowo" |
| Polferries — rozkład cargo | miesiące naprzód, statki NS/WAW |
| **operator** | od 30.03.2026 w ramach **POLSCA Baltic Ferries** |
| Digitraffic AIS | Zatoka Gdańska **0 statków**; Nynäshamn — tak; **Nova Star MMSI 311000787, IMO 9462067** potwierdzony; Wawel nieobecny w rejestrze |
| Urząd Morski Gdynia — ruch statków | **promów linii regularnej nie ma** — odrzucone |
| AISStream | zasięg zależny od wolontariuszy, licencja komercyjna niejasna — nie jako źródło krytyczne |
| Trafikverket | darmowy klucz, CC0, zdarzenia, stan dróg, pogoda, GetBuffer wzdłuż trasy; prędkości tylko w dużych miastach |
| KPD GDDKiA | darmowe, DATEX II, certyfikat klienta; utrudnienia, ograniczenia dla pojazdów, pomiary natężenia, prędkości i czasu przejazdu |
| TomTom Freemium | 2 500 zapytań + 50 000 kafelków dziennie, użycie komercyjne dozwolone, przekroczenie blokowane, nie naliczane |

### 38.3 Zrealizowane
- `lib/ferry/polferries.ts` — parser komunikatów; nieznany status →
  NIEZNANY + ostrzeżenie; zmiana struktury → ostrzeżenie; czas lokalny →
  UTC poprawnie przy zmianie czasu
- `lib/ferry/digitraffic.ts` — pozycja promu, interpretacja, atrybucja CC BY 4.0
- **`tests/ferry.test.ts` 17/17** na prawdziwej stronie i prawdziwej
  odpowiedzi AIS z 25.09.2026; zestaw jednostkowy łącznie **66 zielonych**
- `vessels.mmsi`, `vessels.imo`; seed z nazwą operatora i MMSI Nova Star
- `ANEKS_2_DLA_GROKA.md` — pozycje AN2, M12; łącznie **56**

### 38.4 Błąd w moim teście, wykryty przy uruchomieniu
Podmieniałem pierwszy status „Planowo" na stronie — a pierwszy należy do
linii Świnoujście–Ystad, którą parser słusznie pomija. Poprawione: test
celuje w rejs Gdańsk–Nynäshamn i sprawdza, że pozostałe są nietknięte.

### 38.5 Otwarte — działania właściciela, wszystkie bezpłatne
- klucz Trafikverket (od ręki) — przełącza D3 na dane żywe
- konto TomTom Freemium (od ręki)
- **rejestracja w KPD GDDKiA z certyfikatem klienta — najdłuższa droga**
- pismo do działu cargo POLSCA Baltic Ferries: zgoda na odczyt
  komunikatów albo oficjalne powiadomienia; **MMSI promu Wawel**
- opcjonalnie: Sjöfartsverket AAA, klucz AISStream do testu zasięgu

## 39. Wydanie 1.0 — stan i decyzje (26.09.2026)

### 39.1 Stan zgłoszony przez wykonawcę
- **etap 4 zamknięty:** M2–M12, D26, D23-S, G4; `153839c`; tag
  `baseline-fala-3b-2026-09-26`; unit 271, security 52/52, visual 840/840
  (+120 ujęć: Faktury KSH, faktury przychodowe HHL, Ustawienia);
  147 prawdziwych rejsów na serwerze testowym
- **etap 5 zamknięty:** trasy adresowalne, pierwsze wczytanie 222 kB
  zamiast 585 kB, 0 z 840 ujęć zmienionych
- **etap 6:** 14/14 prób; 7 commitów niewypchniętych

### 39.2 Zastrzeżenia
- 7 commitów tylko na dysku — jedna kopia
- „testy na serwerze Supabase przechodzą" bez liczb
- **O2 i O3 zgłoszone jako zrobione, a wdrożenia produkcyjnego nie było**

### 39.3 Decyzje (rekomendacje do potwierdzenia przez właściciela)
| # | Sprawa | Rekomendacja |
|---|---|---|
| 39.3.1 | import usuwa transporty w drodze | **anulowanie zamiast kasowania; blokada od AT_LOADING i dla zafakturowanych; zakaz DELETE w bazie** |
| 39.3.2 | ryzyka widoczne dla wszystkich | **nie — kolumna odbiorców, domyślnie tylko HHL**; wyciek klasy koszt/przychód |
| 39.3.3 | kierowca bez logowania | **tak, pod warunkami tokenu**: jeden transport, bez cen, wygasa, odwoływalny, przez funkcję Edge |
| 39.3.4 | numer zlecenia 48 h wcześniej | **ostrzeżenie, nie blokada**; blokady bez zmian (Q10) |
| 39.3.5 | ~25 napisów bez polskich znaków | poprawić; identyfikatory w bazie zostają ASCII; nowy test PL-T; wzorzec: EN i SV = 0 zmian |
| 39.3.6 | obecny Supabase | **testowy** |
| 39.3.7 | produkcja | **nowy projekt Supabase Pro, region UE** |
| 39.3.8 | Vercel | **plan Pro** — darmowy wyłącznie niekomercyjny |
| 39.3.9 | tag `release-1.0` | **dopiero po O3 na produkcji** |

### 39.4 Koszty — zweryfikowane 26.09.2026
- Vercel: Hobby wyłącznie do użytku osobistego, niekomercyjnego; Pro 20 USD/mies.
- Supabase Free: użycie komercyjne dozwolone, ale usypianie po 7 dniach
  bez aktywności i brak kopii do pobrania; Pro 25 USD/mies. — bez usypiania,
  7 dni kopii
- **razem ok. 45 USD/mies.**; źródła danych zewnętrznych bez zmian — darmowe

### 39.5 Działania właściciela
projekt Supabase Pro (UE) z `pg_cron` · Vercel Pro · domena · token
Supabase do pliku środowiskowego i odwołanie po wdrożeniu · klucze
Trafikverket i TomTom · rejestracja KPD · POLSCA Baltic Ferries: zgoda
i MMSI Wawel

## 40. Hosting — decyzja właściciela (26.09.2026)

**Vercel na planie darmowym. Planu Pro nie będzie — nigdy.**

Ryzyko zapisane: regulamin planu darmowego Vercel dopuszcza wyłącznie
użytek osobisty, niekomercyjny; możliwe wstrzymanie projektu.

Zabezpieczenie (sekcja 4.3 `DECYZJE_WYDANIE_1_0.md`):
- aplikacja bez zależności od funkcji Vercel — statyczna, zaplecze w Supabase
- **zapas: Cloudflare Pages, plan darmowy** — statyczne pliki bezpłatne
  i bez limitu; regulamin bez zakazu użycia komercyjnego (brak znalezionego
  wprost potwierdzenia od Cloudflare — do sprawdzenia przy zakładaniu konta)
- domena pod kontrolą właściciela; przełączenie = jeden rekord DNS
- procedura przełączenia udokumentowana i przetestowana raz
- wyłączona zgoda na trenowanie modeli; podglądy tylko na testowy Supabase

**Otwarte:** plan Supabase dla produkcji — decyzja właściciela.

## 41. Produkcja za darmo — decyzja właściciela (26.09.2026)

**Wszystko na planach darmowych: Supabase, Vercel, integracje. Nigdy płatne.**
Realizacja: **`ANEKS_4_PRODUKCJA_ZA_DARMO.md`**, pozycje PR1–PR8.

### 41.1 Zweryfikowane 26.09.2026
- Supabase Free: dwa aktywne projekty; usypianie przy niskiej aktywności
  użytkowników w ciągu 7 dni; kopie niedostępne do pobrania; 500 MB bazy,
  1 GB plików, 500 000 wywołań funkcji Edge, 5 GB transferu
- **domyślna poczta Supabase: wyłącznie do adresów z zespołu projektu,
  tylko do testów** — bez własnego SMTP użytkownicy nie dostaną linków
  logowania. **Blokuje produkcję**
- Cloudflare R2 Free: 10 GB, zero opłat za transfer, bez wygasania
- Cloudflare Workers Free: 100 000 zapytań dziennie, wyzwalacze czasowe

### 41.2 Zabezpieczenia zamiast planu płatnego
| # | Problem planu darmowego | Rozwiązanie |
|---|---|---|
| PR1 | usypianie | Worker co 6 h z prawdziwym zapytaniem; e-mail przy braku odpowiedzi; skrzynka na ostrzeżenia Supabase |
| PR2 | brak kopii do pobrania | codzienny zrzut, szyfrowanie age (klucz prywatny offline), R2, retencja 30 dni + 12 miesięcy, **test odtworzenia co miesiąc**; RPO 24 h |
| PR3 | poczta tylko testowa | Resend jako SMTP, zweryfikowana domena |
| PR4 | limity | codzienna kontrola, ryzyko przy 70%, alarm przy 85% |
| PR5 | 500 MB bazy | GPS co 2 min w ruchu / 15 min na postoju; retencja 30 dni po rozładunku; pomiar |
| PR6 | 500 000 wywołań Edge | pozycje kierowcy przez funkcję SQL, nie Edge; budżet ~71 000/mies. |
| PR7 | 1 GB plików | kompresja zdjęć w przeglądarce; limit PDF; archiwizacja do R2 od 70% |
| PR8 | Vercel niekomercyjny | zapas Cloudflare Pages, przełączenie DNS |

### 41.3 Do sprawdzenia przy zakładaniu kont
- czy aktywacja R2 wymaga karty
- dzienny limit wysyłek darmowego planu Resend wobec budżetu logowań i przypomnień

## 42. Jeden projekt, roczna autoryzacja urządzenia (26.09.2026)

### 42.1 Decyzje właściciela
- **jeden projekt Supabase — obecny — jest produkcją**; drugiego nie ma
- wykonawca realizuje wszystkie kroki właściciela przez API
- **Resend: konto, domena i DNS zweryfikowane**
- skrzynka konta Supabase czytana
- **autoryzacja urządzenia kierowcy z linku — ważna rok**

Realizacja: **`ANEKS_5_JEDEN_PROJEKT.md`**.

### 42.2 Skutki obsłużone
| Skutek jednego projektu | Rozwiązanie |
|---|---|
| dane i konta testowe w produkcji | sprzątanie: kopia → lista do zatwierdzenia → usunięcie; zostają migracje, seed, 147 rejsów |
| testy zapisujące na produkcji | zakaz; BK5 na lokalny Supabase (Docker); test odtworzenia do lokalnego Postgresa |
| publiczne podglądy Vercel na produkcyjnej bazie | podglądy w trybie `DemoProvider`, bez Supabase |

### 42.3 Sesja użytkownika rok — poprawka właściciela
**Rok dotyczy użytkowników programu (HHL, KSH, przewoźnik), nie kierowców.**
Kierowca bez zmian: link do 24 h po rozładunku, maksymalnie 14 dni.

- plan darmowy Supabase **nie ma limitu czasu sesji** (tylko Pro); sesje
  domyślnie bez końca → zadanie dzienne usuwa sesje starsze niż 365 dni
- **token dostępu zostaje 3 600 s** — rok w sesji, którą da się usunąć,
  nie w tokenie, którego nie da się odwołać
- link z e-maila jednorazowy, najwyżej godzina
- wyloguj wszędzie (użytkownik), wyloguj dowolnego (HHL), dezaktywacja
  odcina dane natychmiast przez funkcje RLS, lista urządzeń
- 7 przypadków testowych

### 42.4 Jedyny krok wyłącznie w rękach właściciela
**Klucz prywatny do kopii** — wykonawca generuje parę poza repozytorium,
przekazuje prywatny właścicielowi do zapisu offline (dwa egzemplarze),
usuwa z dysku. Bez niego kopie są nie do odtworzenia.

### 42.5 Otwarte
Brak — interpretacja potwierdzona przez właściciela.

## 43. Stan po raporcie z aneksu 5 (26.09.2026)

### 43.1 Zgłoszone
- HEAD `f25cdc5` = origin/main, drzewo `fa0c8af6…`; tag `baseline-1.0-2026-09-26`
- unit 299 (+22 pominięte) · money 49+1 · ferry 17 · security 52/52 ·
  status 44/44 · storage 33/33 · db release 145/145 · kopia 10/10 lokalnie,
  12/12 odczyt z produkcji · D19-T 1/1 · D-EUR-T 2/2 · **PL-T 4/4
  (czerwony przed poprawką: 112 słów)** · stylelint 0 · 14 prób 14/14 ·
  pierwsze wczytanie 222 kB gzip
- **wzorzec 840: 169 zmian, wszystkie PL; EN i SV: 0** — kryterium spełnione
- migracje 0019–0025 na produkcji, niedestrukcyjne
- PR5: 387 B na pozycję z indeksami; najgorszy przypadek 20 aut ≈ 190 MB = 38% limitu
- BK5 8/8 sprzed aneksu 5; brak Dockera

### 43.2 Luka bezpieczeństwa — trzecia w tej samej klasie
`purge_personal_data(0)` wywoływalna przez każdego zalogowanego — kasowała
dane kierowców. Naprawiona. Poprzednio: funkcja terminów w 0003.
**Przyczyna: domyślne prawo wywołania dla `PUBLIC`.** Zlecone: odebranie
domyślnych praw + test listy dozwolonych funkcji.

### 43.3 Baner kokpitu
Poprawka zmienia EN i SV → napis na sztywno, bez tłumaczenia. D19-T nie
złapał, bo szuka polskich liter. Zlecone: słownik + rozszerzenie D19-T
o porównanie z wartościami słownika PL.

### 43.4 Poświadczenia Cloudflare
Dwa osobne, zawężone: token API do konfiguracji (do odwołania) i klucz R2
ograniczony do zasobnika kopii. Worker podtrzymujący — klucz `anon`.
**`service_role` nigdy poza Supabase.**

### 43.5 Otwarte
- sprzątanie danych testowych — lista do zatwierdzenia
- podglądy w `DemoProvider` — niezgłoszone
- sesja użytkownika rok — niezgłoszone

## 44. Niezależna weryfikacja produkcji (26.09.2026)

Łączniki Supabase i Cloudflare podłączone po stronie koordynatora — odczyt.

### 44.1 Supabase — `nglnnrmzmhusvxslousq`, UE (Irlandia), 24 MB
- migracje 0001–0029; 11 funkcji Edge (10 z wymogiem logowania)
- **potwierdzone:** widoki cenowe filtrują; funkcje admin/finanse sprawdzają
  rolę; `purge_personal_data` i `purge_expired_sessions` niedostępne dla
  API; domyślne prawa do funkcji odebrane; brak prawa CREATE w `public`;
  11 zadań harmonogramu; `driver-photo` weryfikuje token w bazie
- **do zrobienia:** 3 konta testowe z hasłami i 174 sesje → sprzątanie;
  rejestracja publiczna wyłączona; `ferry-ais` do zaplanowania (bez klucza);
  typ i rozmiar pliku w `driver-photo` po stronie serwera; `search_path`
  na 22 funkcjach; odebranie `anon` z 4 funkcji pomocniczych;
  `loaded_confirmed`; `spatial_ref_sys`; opis fałszywego alarmu widoków
  w `SECURITY.md`; potwierdzenie 8 tabel bez polityk

### 44.2 Cloudflare
- **R2 niewłączone** („enable R2 through the Dashboard"); 0 Workerów

### 44.3 Wzorzec
Grok najpierw uznał różnice poza banerem za szum, potem sam wykazał
powtarzalną różnicę 13 ujęć kokpitu (159–298 px) z wcześniejszego commitu.
**Wzorzec wstrzymany do znalezienia commitu.** Przyczyna: hak uruchamia
4 ujęcia, nie 840 → pełny przebieg przed każdym tagiem.

### 44.4 Decyzje (rekomendacje do potwierdzenia)
próbny link na `Sebastian@log-mar.pl` · przypomnienia po sprzątaniu ·
token Supabase do końca aneksu 5

## 45. Weryfikacja produkcji — część 2 (26.09.2026)

Symulacja ról na produkcji (odczyt, w transakcji): anonim, KSH, przewoźnik.

### 45.1 Potwierdzone
- anonim: 0 wierszy w 18 tabelach
- `load_cost`, `load_revenue`: brak dostępu API; tylko filtrujące widoki
- KSH: 0 w widoku marż i kosztu; filtr odbiorców ryzyk działa
- przewoźnik: 2 z 3 transportów; pozycje i zdarzenia dziedziczą widoczność
- `documents.docs_scope` RESTRICTIVE — dokumenty i faktury poprawnie
- zapis tabel referencyjnych tylko HHL; 3 zasobniki prywatne z limitami i typami
- **brak cen w bazie — rozdział potwierdzony ze struktury, nie z danych**

### 45.2 Usterki
| # | Waga | Usterka | Poprawka |
|---|---|---|---|
| W1 | **wysoka** | `spatial_ref_sys` zapisywalna i usuwalna przez `anon` — wyłączenie silnika stref jednym zapytaniem; REVOKE niemożliwy (nadał `supabase_admin`) | wyzwalacz instrukcyjny — `postgres` ma prawo TRIGGER |
| W2 | **wysoka** | zdarzenia `GEOFENCE_*`, `STATUS_AUTO` dopisywalne przez API (także klient); `apply_geofence_status` bierze rodzaj strefy i czas z treści zdarzenia → sfałszowana zmiana statusu | lista dozwolonych typów dla ról API; CHECK na typie; rodzaj strefy z tabeli |
| W3 | średnia | `load_messages`, `shipment_items` — odczyt po rodzaju firmy, nie po transporcie/projekcie; bez skutków przy jednym kliencie i przewoźniku | warunek widoczności transportu/projektu |
| W4 | niska | limity zasobników 15/20 MB | 2 MB zdjęcia, 10 MB dokumenty |

Rozładunek niepodatny — datę ustawia wyłącznie `driver_post_event` z tokenem.

### 45.3 Warunek przed pierwszym użytkownikiem
W1, W2, sprzątanie; transport testowy z kosztem i przychodem → symulacja
trzech ról → liczby → usunięcie.

## 46. W1, W2 wdrożone — sprawdzone niezależnie (26.09.2026, 13:59 UTC)

- **W1:** wyzwalacz `spatial_ref_sys_readonly` włączony; test własny jako
  `anon` (usunięcie 0 wierszy) → 42501; 8 500 wierszy
- **W2:** `CHECK load_events_event_type_known`; `apply_geofence_status`
  czyta strefę z tabeli, treść zdarzenia ignorowana; blokada niezmienności
  włączona
- **rejestracja:** `handle_new_auth_user` odrzuca konto bez otwartego
  zaproszenia → `disable_signup=false` bezpieczne. **Luka: zaproszenie
  nie wygasa**
- **harmonogram:** `tower-ferry-ais` 13:40 → 403, 13:50 → 200. **Oba
  zapisane w `cron.job_run_details` jako „succeeded"** — pg_cron melduje
  sukces po wysłaniu zapytania, nie po odpowiedzi. Bez strażnika wyniku
  niedziałające kopie wyglądałyby na działające
- **Wawel:** MMSI 311852000, IMO 7814462, C6TY9 — potwierdzone w pięciu
  źródłach (Wikipedia, MarineTraffic, VesselFinder, ShipSpotting, MagicPort);
  FleetMon podaje odmienny IMO — w mniejszości

### Decyzje (rekomendacje)
sprzątanie zatwierdzone w jednej transakcji · dziennik testowy usunięty
z jednym wpisem opisującym sprzątanie · zaproszenie `Sebastian@log-mar.pl`
jako HHL_ADMIN po sprzątaniu = ostateczny test PR3 · MMSI Wawela ·
`disable_signup=false` + wygasanie zaproszeń · strażnik wyniku zadań

## 47. Stan produkcji po sprzątaniu — sprawdzone niezależnie (26.09.2026)

### 47.1 Potwierdzone
- **dane testowe: 0** we wszystkich tabelach operacyjnych; **żaden wyzwalacz
  w schemacie `public` nie jest wyłączony**
- referencyjne: 3 organizacje, 1 projekt, 6 stref, 2 statki, 147 rejsów,
  17 kursów NBP, 2 warunki płatności
- `audit_log`: CLEANUP_TEST_DATA → USER_INVITED → USER_ACCEPTED_INVITE
- konto `sebastian@log-mar.pl`: HHL_ADMIN, aktywne; 1 sesja (Android),
  26.09.2026 14:06 UTC → wygasa 26.09.2027
- zasobniki: faktury 20 MB, zdjęcia 2 MB, dokumenty 10 MB, wszystkie prywatne
- W3: `msgs_read` z widocznością transportu; `items_read` po projekcie klienta
- harmonogram 14 zadań, strażnik co godzinę; HTTP: 30×200 od poprawki
- Wawel MMSI 311852000 / IMO 7814462; Nova Star 311000787 / 9462067
- `invite_valid_days()` = 7; `integration_runs` ≈ 430/dobę
  (send-notifications 288 + ferry-ais 144)

### 47.2 Nowe ustalenia
- **wygasanie zaproszeń bez skutku:** konto auth powstaje w chwili
  zaproszenia (USER_INVITED 14:03:29 → konto 14:03:30), więc sprawdzenie
  7 dni zawsze przechodzi; „przyjęcie" zapisywane przed kliknięciem
  (kliknięcie 14:06). Nieodebrane zaproszenie = aktywne konto bez limitu
- **konto administratora ma hash hasła** (bcrypt) — prawdopodobnie losowe
  hasło nadawane przez Supabase przy tworzeniu konta linkiem; do
  potwierdzenia przez wykonawcę

### 47.3 Decyzje (rekomendacje)
PL-T i D15 do wzorca (para przed/po znacznika do obejrzenia) · faktury 10 MB
(zgodnie z aneksem 4) · retencja `integration_runs` 30 dni udane, 180 błędy ·
**R2 = jedyna blokada przed zaproszeniem KSH i przewoźnika**

## 48. Tłumaczenia — ślepe plamki D19-T (26.09.2026)

### 48.1 Przyjęte i sprawdzone
- A (wygasanie zaproszeń od pierwszego logowania): `tower-wygasanie-zaproszen`
  02:40 UTC; B (hash hasła): losowe hasło Supabase przy `signInWithOtp`
- faktury 10 MB; retencja `tower-retencja-przebiegow` 02:50 UTC
- wzorzec `baseline-fala-3c-2026-09-26`, 840/840; znacznik D15 = przesunięcie
  o piksel, wizualnie bez różnicy

### 48.2 Znalezione na zrzucie nowego wzorca (HHL, EN)
| # | Waga | Usterka |
|---|---|---|
| T1 | **wysoka** | ryzyka generowane w bazie po polsku (`title` bez klucza) — przewoźnik w SV dostanie „Brak pozycji pojazdu…"; też e-maile, baner promowy |
| T2 | średnia | napisy poza słownikiem bez polskich liter — D19-T ślepy podwójnie; pseudo-lokalizacja |
| T3 | niska | „15,7%" w EN — formatowanie liczb niezależne od języka |

Kryterium wzorca po poprawkach: **PL — 0 zmian**.
T1 przed zaproszeniem przewoźnika.

## 49. T1–T3 wdrożone — sprawdzone (26.09.2026)

- tag `baseline-fala-3d-2026-09-26`, HEAD `ad6bf40`; 840/840, PL 0 zmian
- produkcja: `risk_signals.title_key` jest; przebiegi 24 h: send-notifications
  89/0, ferry-ais 46/0
- **`raise_risk`, `raise_integration_risk` nie ustawiają klucza** — robi to
  wyzwalacz `risk_signals_title_key`; **przy braku klucza podstawia
  `rk_generic` z polskim tytułem w parametrach i tylko `raise warning`** →
  ryzyko bez prawdziwego klucza pokaże się po polsku w SV, bez sygnału
- 3 „stare usterki PL" (kod `doc_cat_drawing`, kod kategorii w dymku,
  „podwyzszone"/„Zaladowano") — kod klucza na ekranie powinien był
  złapać test pseudo-lokalizacji → prawdopodobnie na liście 583 „danych"
- **Cloudflare: R2 nadal niewłączone** (10042); token nie dociera do
  środowiska wykonawcy — aktualizacja komputera Grok bota

## 50. Audyt zakresu (27.09.2026)

Pełny wynik: **`AUDYT_ZAKRESU.md`**. Najważniejsze:
- **sekcje 0–11 (ok. 110 pozycji) nigdy nie dostały statusów**; dziennik
  odłożeń pusty mimo faktycznych odłożeń
- blokuje pierwszego użytkownika lub fakturę: stawki (0), parametry i odczyty
  SEFS (0, brak źródła), umowy RODO, spotkanie z SCX (68 pytań), strefy
  załadunku (1), instrukcje, 2FA administratorów (0)
- **fasada na produkcji:** Workflows (0 reguł, brak silnika w bazie),
  ETA (nic nie wylicza), pogoda morska (brak źródła), **zezwolenia i polisy
  nieczytelne dla wszystkich ról** (RLS bez reguł odczytu)
- zgłoszone jako zrobione bez widocznych wyników: F2.1, F2.2, F2.4, F2.5, F2.6, 25.1

## 51. Decyzje właściciela do audytu — sekcja E (27.09.2026)

| Pozycja | Decyzja |
|---|---|
| 9.6 SMS | **zostaje** — bramka SMS na telefonie z Androidem, stale zasilanym, na Wi-Fi, z aplikacją |
| 3.10 SharePoint | **później**; plik harmonogramu KSH na tenancie `hyzykspzoo.sharepoint.com` — **tylko odczyt, nic nie zmieniać** (bieżąca praca zespołów) |
| 7.11 KSeF | **poza TOWER na stałe** — faktury wystawiane w systemach stron, TOWER rejestruje PDF |
| 9.9, 9.10, 6.9, 10.9 | bez decyzji — domyślnie rekomendacje koordynatora: kanał zespołowy rezygnacja w 1.0; kalendarz, e-CMR, ślad węglowy po 1.0 |

### 51.1 Bramka SMS — architektura (rekomendacja)
**Model pobierania:** kolejka `sms_outbox` w Supabase, telefon sam pobiera
wiadomości i melduje status. Bez serwera pośredniego, bez otwartego portu
w sieci domowej, bez zewnętrznego przekaźnika z numerami kierowców.
Gotowe aplikacje: tryb chmurowy przechodzi przez serwer dostawcy; tryb
prywatny wymaga własnego serwera, którego nie mamy.

### 51.2 SharePoint — dostęp
Automatyczny odczyt zablokowany (robots), logowanie wymaga kodu na skrzynkę
właściciela. Na teraz: kopia pliku przesłana przez właściciela. Docelowo:
rejestracja aplikacji w tenancie KSH z odczytem jednej witryny — zgoda IT KSH.

## 52. Odpowiedzi do audytu i etap I (27.09.2026)

### 52.1 Z odpowiedzi wykonawcy (`88c92cc`), sprawdzone przez koordynatora
- 114 pozycji sekcji 0–11: 47 gotowe, 37 częściowo, 9 nie, 10 zablokowane,
  7 odłożone, 4 do potwierdzenia
- **BLOKER: import w trybie produkcyjnym nie zapisuje transportów do `loads`**
- C1 brak silnika Workflows („Uruchom" bez warunku i akcji); C2 ETA
  w przeglądarce z samego statusu; C3 brak pogody; C4 zezwolenia i polisy
  jako dokumenty — zamierzone; C5 dane statyczne; C8 kody w bazie, UI ich
  nie używa; F2.4: Opcje BAF to fasada
- B5 pasuje: harmonogram bez kolumny adresu załadunku, jedyny załadunek
  KSH Śrem, 0,33 m od środka strefy
- O2, O3a DONE — potwierdzone: 3 konta testowe nieaktywne, 0 sesji
- **wyciek:** `KSH_HARMONOGRAM.xlsx` i 4 kopie makiety były publiczne w paczce
  produkcyjnej; na `tower.log-mar.pl` i Vercel dziś 404; **na Pages
  `/tower-makieta` nadal 200**; stare wdrożenia Pages publiczne bez ochrony
- usterki demo w produkcji: przełącznik ról u KSH i SCX, baner R-03,
  „dziś 23.09"

### 52.2 Etap I — definicja
**`ZLECENIE_ETAP_I.md`**: I-0 wyciek, I-1 import, I-2 zero fasady,
I-3 SMS, I-4 instrukcje, I-5 2FA, I-6 monitoring błędów, I-7 retencja,
I-8 wydajność, I-9 synchronizacja rejestru.
**Wydanie 1.0 = etap I + O3b.**

## 53. Wyciek plików — ocena zamknięta (27.09.2026)

- `KSH_HARMONOGRAM.xlsx`: 1 arkusz, 123 wiersze (50 z wysyłką), 16 kolumn;
  kolumny kierowcy (imię i nazwisko, telefon) **puste — brak danych
  osobowych**; wyciekły dane biznesowe KSH: wysyłki, wymiary, wagi, daty
- ekspozycja: Vercel `watch-tower-makieta.vercel.app` **23.09 13:20 –
  27.09 12:11**; Pages od 27.09 11:06; brak logów pobrań
- makieta w pamięci podręcznej Pages `/tower-makieta` do ok. 04.10:
  sprawdzona przez koordynatora — bez wymiarów i wag, nazwy firm i projektu,
  10 numerów z danych demo
- dane demo: 30 „realistycznych" numerów w `seedIdentity.ts` (pule
  operatorów) → zamiana na pulę PTS (SE) i numery nieprzydzielalne (PL, LT),
  w I-2
- RODO nie dotyczy (brak danych osobowych); **decyzja właściciela:
  informacja dla KSH** — rekomendacja: poinformować, sprawdzić klauzulę
  poufności w umowie z KSH
- **27.09.2026: KSH poinformowany przez właściciela, odpowiedź: w porządku.
  Incydent zamknięty.**

## 54. I-1 import i luka „nieznane" w strażnikach (27.09.2026)

- **I-1 zrobione:** import w produkcji zapisuje transporty i pozycje w jednej
  transakcji, z podglądem; lokalnie 41 transportów / 30 ms, powtórka 0 zmian,
  zmieniony plik 1 nowy / 4 zmienione / 2 anulowane; tylko HHL; archiwum wersji;
  0047, 0048 na produkcji, 0 transportów na produkcji
- **9 transportów z wymiarem „Standard"** (T-03…05, T-08…10, T-13…15)
  odrzucanych przez import — rekomendacja: przyjąć jako klasę STANDARD
  (ładunek normatywny), wymiary puste jawnie, nie domyślne
- **luka NULL w strażnikach plpgsql** — sprawdzona przez koordynatora:
  `current_app_role()` zwraca NULL dla nieaktywnych → `is_hhl()` NULL →
  `if not is_hhl() then raise` NIE odmawia. Dotyczy: cancel_load,
  import_cancel_loads, import_removal_check, register_invoice,
  mark_invoice_paid, unmark_invoice_paid (naprawia poprawka `is_hhl()`) oraz
  **issue_driver_token, revoke_driver_token, report_position** (wyrażenie
  `is_hhl() or (current_org_kind() = 'CARRIER' …)` — poprawka `is_hhl()`
  NIE wystarcza); guard_load_update i guard_invoice_update do przeglądu.
  Okno: do 1 h ważności tokenu po dezaktywacji. `import_schedule` poprawny
  (`coalesce`)
- kopia zapasowa nie obejmuje nowej tabeli archiwum → lista tabel kopii
  do wyliczania z katalogu + test

## 55. Tryb pracy ciągłej (27.09.2026)

**Decyzja właściciela:** zmiany są wyłącznie dopisywane do planu, który
wykonawca realizuje w sposób ciągły. Wymiana między koordynatorem
a wykonawcą nie może zatrzymywać realizacji.

- jedyna lista pracy: **`PLAN.md`** (w repo `docs/handover/PLAN.md`)
- wykonawca: kolejka od góry, bez pytania o kontynuację; pytania do sekcji
  „Decyzje oczekujące" i dalej; STOP tylko w 5 zdefiniowanych sytuacjach
- koordynator: wyłącznie bloki `DOPISZ` z priorytetem P0/P1/P2;
  weryfikacja asynchroniczna, znaleziska jako nowe pozycje
- właściciel: przekazuje raporty w dogodnym momencie, rozstrzyga decyzje D-*

## 56. Statusy wykonawcy i mapa kolejki (I-9, I-11 — 27.09.2026)

W `PLAN.md` ta sekcja figuruje jako „§53”; numery 53–55 zajął w międzyczasie koordynator, więc jest to §56.
Nic nie zniknęło: sekcje 0–55 powyżej są kopią pliku koordynatora (27.09.2026, 19:45) bez zmian,
z trzema dopiskami wykonawcy: 16.3 „ZASTĄPIONA PRZEZ I-18” (decyzja właściciela 27.09) oraz wiersze
dziennika odłożeń i blokad z audytu 27.09. Poprzedni `SCOPE.md` z repo (tabele 0–11 ze statusami
i dowodami, dawny §39 „Audyt statusów”) jest przeniesiony w całości niżej (56.2, 56.3).
Statusy aktualne po etapie I — tabela 56.1 (ona obowiązuje, gdy różni się od 56.2).

### 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7)

Każda z 65 pozycji ma miejsce w `PLAN.md` albo w dzienniku odłożeń / blokad. Po etapie I:
DO POTWIERDZENIA 5, DO ZROBIENIA 9, DO ZROBIENIA (częściowo) 26, GOTOWE 8, ODŁOŻONA 7, ZABLOKOWANA 10. Nowe pozycje dopisane do `PLAN.md` przy tej okazji: I-20…I-24, III-2…III-9, D-13…D-15.

| # | Status po etapie I | Gdzie / dowód |
|---|---|---|
| 0.1 | DO ZROBIENIA (częściowo) | PLAN III-2 |
| 0.3 | CZĘŚCIOWO 28.09 — brama lokalna gotowa (`npm run gate:visual`, próg 0,1%), wynik 665/840; 175 ujęć (Dokumenty, Harmonogram) = dryf sprzed III-2 → decyzja D-25 | PLAN III-2, D-25 |
| 0.7 | DO ZROBIENIA | PLAN III-2 |
| 0.8 | DONE 28.09 | PLAN III-2 (`tests/visual-states.spec.ts`) |
| 0.9 | DONE 28.09 | PLAN III-2 (szkielet i stan pusty harmonogramu jak w makiecie + zrzuty) |
| 0.10 | DONE 28.09 | PLAN III-2 (tryb systemowy = motyw roli, SCOPE 17.9; test atrybutu) |
| 1.1 | DO ZROBIENIA (częściowo) | PLAN III-3 |
| 1.4 | DO POTWIERDZENIA | I-5 `a548eba` + I-17 `642d68f`: 2FA działa, dwa urządzenia; wymaganie aal2 włącza właściciel — D-11 |
| 1.5 | GOTOWE | produkcyjny build na tower.log-mar.pl — Vercel `a14a2ac` (POSTEP O-V3), 0 × service_role |
| 1.6 | DO POTWIERDZENIA | PLAN D-13 (zamiennik hasła do zatwierdzenia) |
| 1.7 | GOTOWE | I-6 `642d68f`: `client_errors` + alarm co 15 min (test produkcyjny: ryzyko + e-mail 200) |
| 2.6 | DO ZROBIENIA (częściowo) | PLAN I-20 |
| 2.7 | DO POTWIERDZENIA | I-7 `642d68f`: dane kierowcy 90 dni; zdjęcia, CMR, POD — D-3 |
| 2.8 | ZABLOKOWANA | D-5 (umowy RODO), Dziennik blokad |
| 3.2 | DO ZROBIENIA (częściowo) | PLAN I-22 |
| 3.7 | GOTOWE | I-10 `a0d21bc`: e-mail wysłany (SENT 21:20); I-18: także zmiana daty potwierdzonej |
| 3.8 | DO POTWIERDZENIA | PLAN D-15 (limity ponadnormatywności per kraj) |
| 3.10 | ODŁOŻONA | Dziennik odłożeń; Etap III (SharePoint) |
| 4.3 | DO ZROBIENIA | PLAN I-21 |
| 4.5 | DO ZROBIENIA (częściowo) → **GOTOWE 28.09 (0087)** | PLAN III-4 — dane pilotów (firma, tablica, zakres), wymóg z zezwolenia, awizacja z terminem ESCORT; dane osobowe pilota — D-22 |
| 5.1 | ZABLOKOWANA | PLAN II-4, D-6; Dziennik blokad |
| 5.2 | ZABLOKOWANA | PLAN II-4, D-6; Dziennik blokad |
| 5.3 | ZABLOKOWANA | PLAN II-4, D-6; Dziennik blokad |
| 5.5 | DO ZROBIENIA (częściowo) | PLAN II-4 (po adapterze 5.1) |
| 5.10 | DO ZROBIENIA (częściowo) → **GOTOWE 28.09** | promy z AIS — I-2j (GOTOWE); kolizje etykiet — PLAN III-5 (GOTOWE: `src/lib/mapDeclutter.ts`, build produkcyjny) |
| 5.12 | GOTOWE | ETA v1 w bazie: I-2d (0051), D-9 (0054), I-15 pasmo RSS (0062), I-16 walidacja 50 transportów; kalibracja — PLAN III-1 |
| 5.13 | DO ZROBIENIA → **GOTOWE 28.09 (0088)** | PLAN III-5 — warstwa „Ślad”: odtwarzanie przebiegu GPS z bazy (`load_track`) |
| 6.1 | DO ZROBIENIA (częściowo) | PLAN III-6 |
| 6.2 | DO ZROBIENIA (częściowo) | PLAN III-6 |
| 6.4 | DO ZROBIENIA (częściowo) → **GOTOWE 28.09 (0086)** | PLAN Etap III „walidator zezwoleń i wymiarów” (0081); formularz zezwoleń w szufladzie transportu — HHL i przewoźnik transportu (0086) |
| 6.5 | DO ZROBIENIA (częściowo) | PLAN Etap III „walidator zezwoleń i wymiarów” |
| 6.6 | DO ZROBIENIA (częściowo) | PLAN Etap III „walidator zezwoleń i wymiarów” (polisy — C4) |
| 6.8 | GOTOWE | I-2k `e4b393d`: paczka tygodnia tylko z dokumentów tygodnia ISO |
| 6.9 | ODŁOŻONA | Dziennik odłożeń; Etap III (e-CMR) |
| 7.1 | ZABLOKOWANA | D-1 (kwoty); formularz cennika — PLAN I-19; pozycja STANDARD — I-12 (0064) |
| 7.3 | ZABLOKOWANA | D-2 / PLAN II-1 (wartości); formularz SEFS I-2f (0052), zakres I-13 (0063) |
| 7.4 | DO ZROBIENIA (częściowo) | PLAN II-1 (zadanie notowań po D-2) |
| 7.5 | DO POTWIERDZENIA | PLAN D-14 (konwencja kursu — księgowość) |
| 7.7 | DO ZROBIENIA (częściowo) | PLAN I-19 (dodatki w cenniku) + D-1 |
| 7.10 | DO ZROBIENIA (częściowo) | PLAN III-7 |
| 7.11 | ODŁOŻONA | Dziennik odłożeń |
| 8.1 | DO ZROBIENIA | PLAN Etap III „źródło pogody morskiej” |
| 8.2 | ZABLOKOWANA | PLAN II-5; Dziennik blokad |
| 8.4 | DO ZROBIENIA (częściowo) | PLAN II-6 |
| 8.5 | ZABLOKOWANA | PLAN II-6; Dziennik blokad |
| 8.6 | ZABLOKOWANA | PLAN II-6; Dziennik blokad |
| 8.10 | ZABLOKOWANA | PLAN II-2; Dziennik blokad |
| 9.1 | GOTOWE (28.09, 0094) | POSTEP 9.1–9.4 |
| 9.2 | GOTOWE (28.09, 0094; zadanie cyklicznego wywołania — decyzja) | POSTEP 9.1–9.4 |
| 9.3 | GOTOWE (28.09, 0094: START-1…7 wyłączone) | POSTEP 9.1–9.4 |
| 9.4 | CZĘŚCIOWO (baza gotowa: zapis przez API z walidacją; widok WorkflowsView nadal demo, w produkcji ukryty — I-2) | POSTEP 9.1–9.4 |
| 9.6 | ODŁOŻONA | Dziennik odłożeń; bramka SMS — I-3 (D-4) |
| 9.8 | GOTOWE (28.09) | PLAN I-23 + POSTEP 9.8 |
| 9.9 | ODŁOŻONA | Dziennik odłożeń |
| 9.10 | ODŁOŻONA | Dziennik odłożeń; Etap III (kalendarz) |
| 10.4 | ODŁOŻONE (decyzja właściciela) | PLAN D-24 (opcjonalny) |
| 10.6 | DONE 28.09 | PLAN III-9 (0089, karta przewoźników w Opcjach, ocena w szufladzie) |
| 10.7 | GOTOWE | I-2l `825da20`: czas wykrycia z `risk_signals` |
| 10.8 | GOTOWE (28.09) | PLAN I-24 (PDF) + POSTEP 10.8 |
| 10.9 | ODŁOŻONA | Dziennik odłożeń; Etap III (ślad węglowy) |
| 11.3 | DO ZROBIENIA (częściowo) | PLAN R-3 (O3b) |
| 11.4 | CZĘŚCIOWO 28.09 | jak 0.3 (D-25) |
| 11.5 | DO ZROBIENIA | PLAN Etap III „audyt dostępności” |
| 11.6 | GOTOWE | I-8 `642d68f`: 350 transportów, 112 496 pozycji — liczby w POSTEP |
| 11.8 | GOTOWE | I-4 `3dac401`: instrukcje w aplikacji dla kierowcy (PL/EN/SV), HHL, KSH, przewoźnika |

### 56.2 Tabele statusów sekcji 0–11 (stan audytu 27.09.2026, przeniesione z poprzedniego `SCOPE.md` repo)

#### 56.2.0 Wierność wizualna

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 0.1 | Arkusz stylów przeniesiony dosłownie z mockupu | DONE 28.09 (III-2: `tests/stylesheet-mockup.test.ts` — suma kontrolna arkusza makiety + porównanie każdej deklaracji, 13 odstępstw z uzasadnieniem) | `src/index.css` nagłówek „CSS 1:1 z tower-makieta.html” (Fala-1-D1) | porównania sum kontrolnych arkusza brak; arkusz rozbudowany o klasy ról |
| 0.2 | Zrzuty wzorcowe: widok × rola × język × 5 szerokości × 2 tryby | GOTOWE | `shots-baseline/` 840 ujęć, tag `baseline-fala-3e-2026-09-27`; WZORZEC-3C `cede8bd`, A6-WZORZEC2 `ce094ad` |  |
| 0.3 | Test regresji wizualnej w CI, próg 0,1% | DO ZROBIENIA (częściowo) | F2.2 `14261fc` (720/720); `.githooks/pre-push` → `scripts/ci/fresh-smoke.sh` (smoke 4 ujęć) | próg zmieniony na `maxDiffPixels:60, threshold:0.28` zamiast 0,1%; pełne 840 porównywane ręcznie; GitHub `unit.yml` uruchamia tylko testy jednostkowe |
| 0.4 | Konfiguracja blokująca wartości spoza systemu | GOTOWE | F2.3 `6f77f7e` stylelint `declaration-strict-value`; `npm run lint:css` w pre-push |  |
| 0.5 | Zakaz Tailwinda i motywów bibliotek w komponentach | GOTOWE | `package.json` bez Tailwind/MUI/Chakra; `src/index.css` „no Tailwind” (Fala-1-D1) | przegląd grep 27.09 |
| 0.6 | Katalog komponentów jako kontrakt nazw klas | GOTOWE | `docs/handover/DESIGN_SYSTEM.md` |  |
| 0.7 | Procedura dodania nowej klasy (3 warunki) | DONE 28.09 (DESIGN_SYSTEM.md §7a; warunek 2 wymuszany stylelintem) | nie zrobione | w DESIGN_SYSTEM.md brak zapisanej procedury 3 warunków |
| 0.8 | Stany: spoczynek, najechanie, fokus, wciśnięty, zablokowany | DO ZROBIENIA (częściowo) | tokeny `--surface-2` (hover), `--focus` w DESIGN_SYSTEM.md | brak zrzutów stanów najechanie/fokus/wciśnięty/zablokowany |
| 0.9 | Stany: ładowanie, pusty, błąd, błąd walidacji | DO ZROBIENIA (częściowo) | klasa `.empty` (DESIGN_SYSTEM.md:174) | brak zrzutów stanów ładowanie/błąd/błąd walidacji |
| 0.10 | Tryb jasny, ciemny i honorowanie ustawienia systemu | DO ZROBIENIA (częściowo) | 840 ujęć × 2 tryby; `@media (prefers-color-scheme: dark)` `src/index.css:20` | brak zrzutu trybu „systemowy” |

#### 56.2.1 Fundament

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 1.1 | Repozytorium, CI, środowiska testowe i produkcyjne | DO ZROBIENIA (częściowo) | repo GitHub; CI lokalne `.githooks/pre-push` (BK6 `7c5c63a`); produkcja Supabase `nglnnrmzmhusvxslousq` | GitHub Actions tylko unit; brak osobnego środowiska testowego Supabase (BK0) — testy db na lokalnym Postgres |
| 1.2 | Szkielet aplikacji, trasowanie, układ | GOTOWE | `src/App.tsx`, `src/components/shell/*`, D10 `20ba91c` | routes.test.ts |
| 1.3 | Trzy języki: polski, angielski, szwedzki | GOTOWE | D19 `d1d10b1`; `tests/d19-i18n.spec.ts` (0 braków) |  |
| 1.4 | Logowanie bez hasła, dwuskładnikowe dla administratorów | DO ZROBIENIA (częściowo) | BK2 `1fd0e82` magic link; ZAPR-LOGIN `0f1ff4d` | 2FA: produkcja `auth.mfa_factors` = 0, nic nie wymusza aal2 (audyt B7) |
| 1.5 | Wdrożenie na wskazanej domenie | DO ZROBIENIA (częściowo) | DOMENA-TOWER `3307c05` (CNAME, Site URL, `scripts/check-domain.sh`) | O2 OPEN: Vercel serwuje build demo sprzed 3 dni |
| 1.6 | Podgląd wdrożeń zabezpieczony hasłem | DO POTWIERDZENIA | A5-PODGLADY `e87c24f` (podglądy w trybie demo) | dane klienta; zamiennik zamiast hasła — do zatwierdzenia przez właściciela jako zamknięte |
| 1.7 | Monitoring błędów i logi | DO ZROBIENIA (częściowo) | STRAZNIK `ea201ee` (`job_watchdog`, cron tower-straznik-zadan) | monitoringu błędów przeglądarek i logów aplikacji brak (audyt D1) |
| 1.8 | Kopie zapasowe bazy i procedura odtworzenia | GOTOWE | PR2-B `5c62f6c`, PR2-C `74a7ca0`, PR2-B-R2LOCK; gate backup 20/20; `scripts/restore-files.sh` | cron tower-backup-export 00:30 |

#### 56.2.2 Dane i dostęp

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 2.1 | Schemat: organizacje, użytkownicy, role | GOTOWE | `0001_core.sql` (organizations, app_users, role); BK1 `e70e378`; gate security 83 | **schema z mockupu ma zostać** |
| 2.2 | Projekt, elementy, transporty (model dwupoziomowy) | GOTOWE | `0001_core.sql` loads + shipment_items | schemat; produkcja loads = 0 wierszy |
| 2.3 | Strumień zdarzeń, niezmienny | GOTOWE | wyzwalacz `trg_load_events_immutable` (prod), polityki tylko SELECT/INSERT; gate status 44 |  |
| 2.4 | Rozdzielenie kosztu i przychodu na poziomie bazy | GOTOWE | load_cost/load_revenue RLS; BK5 `17e6beb` 8/8; gate money 130 |  |
| 2.5 | Widoki rolowe | GOTOWE | widoki prod `v_load_price_client`, `v_load_price_carrier`, `v_load_financials_hhl`; 2.2 `8d4198a` |  |
| 2.6 | Dziennik audytu | DO ZROBIENIA (częściowo) | `audit_log` (prod 3 wiersze) zapisywany w 0008, 0026, 0034, 0039, 0045 | tylko wybrane operacje (zaproszenia, sesje, relink, okna); brak ogólnego wyzwalacza audytu |
| 2.7 | Retencja danych osobowych | DO POTWIERDZENIA | `purge_personal_data(p_days=90)` + cron tower-rodo; GPS 30 dni po rozładunku (0025) | czeka na decyzję: ile dni; liczba dni do decyzji; zdjęcia i CMR poza retencją (audyt D13) |
| 2.8 | Umowy powierzenia między trzema stronami | ZABLOKOWANA | nie zrobione | poza kodem, ale w zakresie; umowy powierzenia — właściciel/prawnik (audyt B3) |

#### 56.2.3 Harmonogram

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 3.1 | Wgrywanie pliku arkusza | GOTOWE | D23 `3f140a7`, D26 `dc364d7`, D23-S `4c52455`; I-1 `9bf80d7`, `f8b6355` (0047, 0048); I-2C `0c247b3` (0050) | produkcja: `import_schedule()` zapisuje `loads` + `shipment_items` w jednej transakcji (tylko HHL); pełny plik lokalnie 50/50 wysyłek (41 z wymiarami + 9 klasy STANDARD, wymiary NULL) |
| 3.2 | Kreator mapowania kolumn z zapisem szablonu | DO ZROBIENIA (częściowo) | `src/lib/importColumnMap.ts` COLUMN_MAP_DEFAULT; kolumna `schedule_imports.column_map` | stały szablon, brak kreatora mapowania i zapisu szablonu przez aplikację |
| 3.3 | Parser wymiarów, dat, godzin, telefonów | GOTOWE | `src/lib/scheduleParse.ts`; schedule-import.test.ts | część testów parsera w schedule-import (unit 353 passed) |
| 3.4 | Walidacja blokująca, w tym przesunięte kolumny | GOTOWE | `scheduleDryRun.ts` (72 błędne → baza nietknięta, D23-S `4c52455`) |  |
| 3.5 | Podgląd różnic przed zapisem | GOTOWE | `diffSchedule` + podgląd w ScheduleView; D26 `dc364d7` |  |
| 3.6 | Wersjonowanie i archiwum pliku źródłowego | GOTOWE | I-1 `9bf80d7`: `schedule_imports` (wersja, sha, file_name), koszyk Storage `harmonogramy`; I-2B `d2a8219`: kubełek i tabela w kopii zapasowej; 0093 (28.09): wersje tylko do dopisywania — rolom API sam odczyt (HHL) | kopia: tabele z katalogu minus jawne wyłączenia, kubełek `harmonogramy` w `files/` |
| 3.7 | Powiadomienie o zmianie daty na transporcie awizowanym | GOTOWE (IN_APP) | I-1 `9bf80d7`: SCHEDULE_DATE_CRITICAL + `notifications` IN_APP dla HHL i przewoźnika | e-mail wymaga wdrożenia Edge `send-notifications` (template gotowy) |
| 3.8 | Klasyfikacja ponadnormatywności per kraj | DO POTWIERDZENIA | `src/lib/permits.ts` (PL kategorie I–V, SE TSFS); PL-T `40eca8a`; pl-t.test.ts | limity do potwierdzenia; limity do potwierdzenia |
| 3.9 | Kolejność montażowa i wykrywanie rozjazdu | GOTOWE | cron tower-kolejnosc `detect_sequence_risk`; gate risks 23 | kolejność montażu z kolumny dodanej po naszej stronie |
| 3.10 | Integracja z SharePoint | ODŁOŻONA | nie zrobione | zależna od zgody IT klienta; zob. Dziennik odłożeń |

#### 56.2.4 Zasoby i awizacja

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 4.1 | Formularz zasobów dla przewoźnika | GOTOWE | `load.resources` → update loads (SupabaseProvider:179); awizacja-patch.test.ts |  |
| 4.2 | Awizacja jako okno czasowe | GOTOWE | kolumny `plan_load_from/to`, `plan_delivery_from/to` (0001); `load.awizacja` (SupabaseProvider:180) |  |
| 4.3 | Terminy uzupełnienia i eskalacje | DO ZROBIENIA (nie zrobione) | nie zrobione | terminy uzupełnienia zasobów i eskalacje w bazie brak (tower-terminy dotyczy płatności, M7) |
| 4.4 | Wymiary zestawu odrębnie od wymiarów elementu | GOTOWE | kolumny `combo_*` (0001) odrębne od `shipment_items`; `src/lib/permits.ts` SetDims |  |
| 4.5 | Pojazdy pilotujące | DO ZROBIENIA (częściowo) | kolumna `escort_vehicles`; dodatek pilotażu w `money/engine.ts` | brak osobnej obsługi pojazdów pilotujących (dane, awizacja) |
| 4.6 | Rezerwacja promu | GOTOWE | `ferry_booking_ref`, `load.ferry` (SupabaseProvider:181), sailings prod 147 |  |

#### 56.2.5 Pozycje i mapa

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 5.1 | Adapter telematyki: interfejs | ZABLOKOWANA | nie zrobione | interfejsu adaptera w kodzie brak — czeka na nazwę systemu SCX i API |
| 5.2 | Adapter: standard producentów pojazdów | ZABLOKOWANA | nie zrobione | rFMS tylko wzmianka w 0001 — zależy od spotkania z SCX |
| 5.3 | Adapter: system przewoźnika | ZABLOKOWANA | nie zrobione | **czeka na odpowiedź przewoźnika**; czeka na odpowiedź przewoźnika |
| 5.4 | Aplikacja dla kierowcy z tokenem | GOTOWE | M9 `3f73c7a`, 2.3 `1595e8b`, PR5 `816970f`; driver-api.test.ts, driver-tracking.test.ts | fallback, budowany zawsze |
| 5.5 | Odbiór zdarzeń wypychanych i odpytywanie | DO ZROBIENIA (częściowo) | RPC `report_position` (odpytywanie przez PWA) | odbioru zdarzeń wypychanych (webhook telematyki) brak — zależy od 5.1 |
| 5.6 | Idempotentność przetwarzania pozycji | GOTOWE | PR5 `816970f`; gate watchdog/status |  |
| 5.7 | Surowy odczyt nigdy nienadpisywany | GOTOWE | `positions`: tylko polityka SELECT, zapis wyłącznie przez RPC, brak UPDATE |  |
| 5.8 | Geofencing: histereza, postój, tłumienie drgań | GOTOWE | `0002_geofence_engine.sql` (hysteresis, dwell, debounce); gate status 44 |  |
| 5.9 | Edytor stref na mapie | GOTOWE | GeofenceView + RPC `upsert_geofence_circle` (`geofence.save`) | tylko okręgi |
| 5.10 | Mapa: warstwy, tryb skupienia, unikanie kolizji etykiet | DO ZROBIENIA (częściowo) | D14 `f384740` (Leaflet, warstwy), tryb skupienia CorridorMap | unikanie kolizji etykiet nie zweryfikowane; markery floty w demo mają sztuczny dryf (02_FASADA) |
| 5.11 | Wykrywanie cichego pojazdu | GOTOWE | cron tower-cisza-gps `detect_silent_vehicles` */15 |  |
| 5.12 | Przewidywany czas przyjazdu, model segmentowy | DO ZROBIENIA (częściowo) | `src/lib/eta.ts computeEta` (M12 `380e0ac`) | heurystyka statusowa po stronie klienta; `eta_site` nie wyliczane w bazie (audyt C2) |
| 5.13 | Odtwarzanie przebiegu w czasie | DO ZROBIENIA (nie zrobione) | nie zrobione | brak odtwarzania przebiegu |
| 5.14 | Podmiana schematu mapy na warstwę kartograficzną | GOTOWE | D14 `f384740` CorridorMap (Leaflet) |  |

#### 56.2.6 Dokumenty

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 6.1 | Kategorie z wymagalnością i terminami | DO ZROBIENIA (częściowo) | typy dokumentów + KPI kompletności (DashboardView) | wymagalność i terminy per kategoria — brak reguł w bazie |
| 6.2 | Wersjonowanie i widoczność per organizacja | DO ZROBIENIA (częściowo) | `documents` + polityka `docs_read`, `create_document`/`discard_document`; BK4 `80e870b` | widoczność per organizacja jest; wersjonowania dokumentu brak |
| 6.3 | Odnośniki z krótkim czasem ważności | GOTOWE | BK4 `80e870b` signed URL; storage-files.test.ts; gate storage 37 |  |
| 6.4 | Zezwolenia: pola, ważność, trasa, pilotaż | DO ZROBIENIA (częściowo) | tabele `permits`, `load_permits` (0001) | wzór do zmapowania; RLS bez polityk, aplikacja nie czyta; zezwolenia tylko jako `documents` (audyt C4) |
| 6.5 | Walidator wymiarów zestawu wobec zezwolenia | DO ZROBIENIA (częściowo) | `permit_fits()` (SECURITY INVOKER), `src/lib/permits.ts` | blokuje transport; na produkcji nie blokuje transportu — 0 zezwoleń, tabela nieczytelna (audyt C4) |
| 6.6 | Polisy z alertem wygaśnięcia | DO ZROBIENIA (częściowo) | tabela `insurance_policies`; typ ryzyka INSURANCE (0020) | brak alertu wygaśnięcia — tabela nieczytelna, brak zadania (audyt C4) |
| 6.7 | Potwierdzenie dostawy i zdjęcia mocowania | GOTOWE | PR6 `1595e8b`/`9b404ba` Edge driver-photo; PR7 `b93f0a3` kompresja; pr7-compress.spec.ts |  |
| 6.8 | Pobieranie paczki per transport i per tydzień | DO ZROBIENIA (częściowo) | `src/lib/zipDocs.ts`: paczka per transport (LoadDrawer:403) i „tydzień” (DocsView:78) | paczka „tygodniowa” pakuje całą listę, bez filtra tygodnia |
| 6.9 | Elektroniczny list przewozowy | ODŁOŻONA | nie zrobione | faza późniejsza; zob. Dziennik odłożeń |

#### 56.2.7 Pieniądze

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 7.1 | Macierz cennika, wersjonowana | ZABLOKOWANA | M1 `d113779` silnik; produkcja `rate_cards` 0, `rate_rules` 0 | czeka na stawki; czeka na stawki (audyt B1) |
| 7.2 | Dopasowanie stawki; brak dopasowania nie daje zera | GOTOWE | M1 `d113779`, M2 `45e8d10`; money.test.ts; gate money 130 |  |
| 7.3 | Indeksacja paliwowa, pełna parametryzacja | ZABLOKOWANA | M4 `500e405`, `src/lib/sefs.ts`; produkcja `baf_definitions` 0, `baf_index_values` 0 | czeka na parametry; czeka na parametry SEFS (audyt B2); F2.4-a, F2.4-b OPEN |
| 7.4 | Pobieranie notowań z zapisem źródła | DO ZROBIENIA (częściowo) | M3 `ce3ff43` NBP (cron tower-kurs-nbp, fx_rates 17) | kursy tak; notowań paliwa (OKQ8/Orlen) brak zadania (audyt B2) |
| 7.5 | Kursy walut i konwencja | DO POTWIERDZENIA | M3 `ce3ff43`, W3 `7318abd` | czeka na ustalenie; konwencja kursu do potwierdzenia przez księgowość (audyt H) |
| 7.6 | Marża, próg ostrzegawczy | GOTOWE | M11 `fd94928`; money-m11.test.ts |  |
| 7.7 | Dodatki: pilotaż, postojowe, prom, zezwolenia | DO ZROBIENIA (częściowo) | `money/engine.ts` dodatki; money-v2.test.ts | bez stawek na produkcji nic nie wylicza (7.1) |
| 7.8 | Faktura zbiorcza, kreator dla przewoźnika | GOTOWE | M6 `2b4ff4a`, RPC `register_invoice`; invoices3.test.ts |  |
| 7.9 | Dopasowanie trójstronne z rozbiciem różnic | GOTOWE | `src/lib/invoiceMatch.ts`; invoice-match.test.ts |  |
| 7.10 | Ścieżka sporu i akceptacji | DO ZROBIENIA (częściowo) | `bill.verify` (dispute_note, SupabaseProvider:220), BillsPanel | akceptacja/spór jako weryfikacja faktury; brak pełnej ścieżki sporu |
| 7.11 | Krajowy system e-faktur | ODŁOŻONA | nie zrobione | faza późniejsza; zob. Dziennik odłożeń |

#### 56.2.8 Ryzyko

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 8.1 | Pogoda morska na trasie promowej | DO ZROBIENIA (nie zrobione) | nie zrobione | licencja źródła do potwierdzenia; brak źródła i zadania; baner fali tylko w demo (audyt C3) |
| 8.2 | Odczyt komunikatów armatora | ZABLOKOWANA | `src/lib/ferry/polferries.ts`, Edge ferry-status | brak zadania cron — czeka na zgodę armatora (audyt C7) |
| 8.3 | Śledzenie jednostek | GOTOWE | cron tower-ferry-ais */10 (Digitraffic); WAWEL-AIS `4569a7b` |  |
| 8.4 | Panel alternatywnych przepraw z przeliczeniem | DO ZROBIENIA (częściowo) | RisksView `ALT` (4 przeprawy), `seRouteAlts.ts` (D25) | dane statyczne, bez przeliczenia na żywo (audyt C5) |
| 8.5 | Zdarzenia drogowe w Szwecji | ZABLOKOWANA | M12 `380e0ac` Edge road-se | brak klucza Trafikverket, brak cron; w UI oznaczenie demo |
| 8.6 | Zdarzenia drogowe w Polsce | ZABLOKOWANA | Edge road-pl | brak dobrego źródła — do rozstrzygnięcia; brak źródła/klucza, brak cron |
| 8.7 | Ryzyka dokumentowe i zasobowe | GOTOWE | risk_signals typy DOC_MISSING/PERMIT/INSURANCE (0020); gate risks 23 |  |
| 8.8 | Ryzyko kolejności montażowej | GOTOWE | cron tower-kolejnosc; gate risks 23 |  |
| 8.9 | Kolejka wyjątków z wagą i czasem do skutku | GOTOWE | kolejka wyjątków (RisksView/DashboardView); risk-keys.test.ts |  |
| 8.10 | Kody przyczyn opóźnień | ZABLOKOWANA | enum `delay_code` A_CLIENT…F_ADMIN (0001) | czeka na uzgodnienie z przewoźnikiem; nieuzgodnione z przewoźnikiem; UI nie używa (audyt C8) |

#### 56.2.9 Automatyzacje i powiadomienia

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 9.1 | Silnik: wyzwalacz, warunek, akcje | GOTOWE (28.09) | 0094: `wf_logic` (JSONLogic), wyzwalacz `load_events_workflows`, akcje notify/risk, email/sms zablokowane do R-2 | `tests/db/workflows.sh` 35/35 |
| 9.2 | Wykonanie trwałe, z ponawianiem | GOTOWE (28.09) | 0094: kolejka `workflow_runs` (QUEUED/RETRY/OK/SKIPPED/DEAD, dedup_key), `workflow_worker()` — podtransakcja, 2^n min, 5 prób | bez crona — uruchomienie decyzją |
| 9.3 | Siedem reguł startowych | GOTOWE (28.09) | 0094: START-1…7 w każdym projekcie, wyłączone | produkcja: 7 reguł, 0 włączonych |
| 9.4 | Kreator reguł dla administratora | CZĘŚCIOWO | baza: zapis HHL_ADMIN (RLS `wf_all`) + walidacja `wf_validate`; WorkflowsView nadal demo | podpięcie widoku do bazy — pakiet przekazania |
| 9.5 | Poczta z szablonami w trzech językach | GOTOWE | M7 `c907fe9`; `supabase/functions/_shared/notifyTemplates.ts` pl/en/sv; cron tower-send-notifications |  |
| 9.6 | Wiadomości tekstowe | ODŁOŻONA | nie zrobione | zob. Dziennik odłożeń |
| 9.7 | Powiadomienia w aplikacji | GOTOWE | `notifications` + RPC `mark_notifications_read` |  |
| 9.8 | Odsiewanie duplikatów | GOTOWE (28.09) | unikalny indeks `notifications(dedup_key)`, `risk_signals(dedup_key) where resolved_at is null` (0001), `sms_outbox(dedup_key)` (0067); wysyłka e-mail z `Idempotency-Key` per powiadomienie | `tests/notify-dedup.test.ts` (każdy INSERT: dedup_key + on conflict albo sprawdzenie otwartego sygnału), i2 „[I-23]” i „[9.8]” |
| 9.9 | Kanał zespołowy | ODŁOŻONA | nie zrobione | zob. Dziennik odłożeń |
| 9.10 | Kalendarz do subskrypcji | ODŁOŻONA | nie zrobione | zob. Dziennik odłożeń |
| 9.11 | Czat przy transporcie | GOTOWE | `load_messages` + `message.send` (SupabaseProvider:186); data-layer.test.ts |  |

#### 56.2.10 Pulpity

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 10.1 | Pulpit spedytora | GOTOWE | DashboardView (HHL); etap4/5/6-ui.spec.ts |  |
| 10.2 | Pulpit klienta | GOTOWE | DashboardView (KSH); BK5 8/8 |  |
| 10.3 | Pulpit przewoźnika | GOTOWE | DashboardView (SCX); BK5 8/8 |  |
| 10.4 | Widok placu budowy, tylko do odczytu | DO ZROBIENIA (nie zrobione) | nie zrobione | opcjonalny; opcjonalny |
| 10.5 | Krzywa postępu dostaw | GOTOWE | `src/components/chart/DeliveryProgress.tsx` |  |
| 10.6 | Ocena przewoźnika | DO ZROBIENIA (nie zrobione) | nie zrobione | brak oceny przewoźnika |
| 10.7 | Czas wykrycia odchylenia | DO ZROBIENIA (częściowo) | kafelek `a6_dash_detect_time` (DashboardView:261) | wartość wpisana na sztywno „8 min” — atrapa |
| 10.8 | Eksport do arkusza i pliku przenośnego | GOTOWE (28.09) | `src/lib/xlsxExport.ts` + `src/lib/pdfExport.ts` (ScheduleView) | XLSX kolumny per rola; PDF bez kierowcy i kwot, w języku interfejsu, czasy wg D8 |
| 10.9 | Raport śladu węglowego | ODŁOŻONA | nie zrobione | faza późniejsza; zob. Dziennik odłożeń |

#### 56.2.11 Jakość

| # | Pozycja | Status | Dowód | Notatka |
|---|---|---|---|---|
| 11.1 | Testy jednostkowe logiki: cennik, indeksacja, parser, strefy | GOTOWE | unit 353 passed / 28 skipped (money, sefs, schedule-import, routes, …) |  |
| 11.2 | Testy integracyjne bazy i uprawnień | GOTOWE | `tests/db/gate.sh`: security 83, status 44, storage 37, money 130, release 145, backup 20, session 27, archive 18, watchdog 27, invite 48, risks 23 |  |
| 11.3 | Testy ścieżek użytkownika | DO ZROBIENIA (częściowo) | etap4/5/6-ui.spec.ts, bk5-api.live.spec.ts | na produkcji niewykonane (O3a/O3b) |
| 11.4 | Testy regresji wizualnej | DO ZROBIENIA (częściowo) | zob. 0.3 | patrz 0.3 |
| 11.5 | Dostępność: klawiatura, kontrast, czytniki ekranu | DO ZROBIENIA (nie zrobione) | nie zrobione | nigdy niesprawdzana (audyt D2); są tylko atrybuty aria |
| 11.6 | Wydajność przy pełnym zakresie projektu | DO ZROBIENIA (częściowo) | D15 `ecb0632` (pierwsze wczytanie 224 kB gz) | bazy z 72 transportami i pełnym GPS nie testowano (audyt D3) |
| 11.7 | Skróty klawiszowe z widocznymi podpowiedziami | GOTOWE | `src/components/shell/KeyboardHelp.tsx` |  |
| 11.8 | Dokumentacja wdrożeniowa i instrukcja dla trzech stron | DO ZROBIENIA (częściowo) | `docs/handover/*` (wdrożeniowe, PRZELACZENIE_HOSTINGU.md) | instrukcji dla trzech stron brak (audyt B6) |

---

### 56.3 Audyt statusów (dawny §39 `SCOPE.md` repo, 27.09.2026)


Źródło: `docs/handover/AUDYT_ZAKRESU.md` (audyt właściciela, 27.09.2026). Sekcje 0–11 dostały
statusy i dowody (114 pozycji). Produkcja sprawdzona wyłącznie odczytem (SELECT). Nic nie naprawiano.

**Podsumowanie sekcji 0–11:** GOTOWE 47 · częściowo 37 · nie zrobione 9 · ZABLOKOWANA 10 ·
ODŁOŻONA 7 · DO POTWIERDZENIA 4 (razem 114).

**Nowe ustalenie (poza listą audytu):** SupabaseProvider nie zapisuje nowych ani zmienionych
transportów z importu harmonogramu (brak `insert` do `loads`; jest tylko `import_cancel_loads`).
Na produkcji import nie utworzy transportu — dotyczy 3.1 i O3b.

#### Odpowiedzi na sekcję C

| # | Odpowiedź | Dowód |
|---|---|---|
| C1 | Potwierdzam: silnika reguł na produkcji nie ma; 12 reguł istnieje tylko w demo, „Uruchom” zapisuje przebieg bez ewaluacji i akcji | prod `workflows` 0, `workflow_runs` 0; pg_proc/pg_trigger/cron.job: 0 odwołań; `src/data/seed.ts` wf-1…12; `useTowerStore.runWorkflowNow`; L9 OPEN |
| C2 | Potwierdzam: `eta_site` nie jest wyliczane w bazie; ETA liczy klient heurystyką statusową (bez GPS, dystansu, rozkładu) | brak funkcji/wyzwalacza/Edge zapisujących `eta_site`; `src/lib/eta.ts computeEta` (M12 `380e0ac`), `mappers.ts:182 applyEtaToLoad` |
| C3 | Potwierdzam: brak źródła i zadania pogody morskiej; fala tylko w danych demo (SAIL_ROWS, oznaczone demo) | pg_proc `weather|wave|pogod` 0; cron bez zadania pogody; `02_FASADA.md` |
| C4 | Potwierdzam i odpowiadam: RLS bez polityk celowo — HHL widzi zezwolenia i polisy jako `documents` (PERMIT_PL/PERMIT_SE/INSURANCE); tabele nieużywane przez aplikację | prod `permits` 0, `insurance_policies` 0, 0 polityk; `permit_fits` SECURITY INVOKER; POSTEP 3.2f `4ecf337`, SECURITY.md §2 |
| C5 | Dane statyczne: 4 przeprawy i 4 objazdy SE wpisane w kod, bez przeliczenia na żywo | `RisksView.tsx` stała `ALT`; `src/lib/seRouteAlts.ts` (D25) |
| C6 | Potwierdzam: funkcje Edge road-se/road-pl wdrożone, bez zadań cron i bez kluczy; UI oznaczone demo | cron.job bez road-*; M12 `380e0ac`; D3 |
| C7 | Potwierdzam: parser i Edge ferry-status są, zadania cron brak | cron.job bez ferry-status; `src/lib/ferry/polferries.ts` |
| C8 | W bazie enum `delay_code` A_CLIENT…F_ADMIN; interfejs z niego nie korzysta; nieuzgodnione | `0001_core.sql` (`delay_code`); rg w `src/` 0 użyć |

#### B5 — strefy załadunku według audytu

Harmonogram (`public/KSH_HARMONOGRAM.xlsx`, `src/data/ksh-schedule.json`, 50 pozycji) nie ma
kolumny adresu załadunku; `loads` na produkcji nie ma kolumn adresu (0 wierszy). Jedyne miejsce
załadunku = siedziba KSH.

| Adres z harmonogramu | Geokodowanie (Nominatim) | Strefa LOADING | Środek / promień | Odległość | Pasuje |
|---|---|---|---|---|---|
| KSH, Grunwaldzka 27C, 63-100 Śrem (jedyne miejsce, kolumny adresu brak) | 52.0739128, 17.0246018 (house) | KSH Śrem · Grunwaldzka 27C | 52.07391, 17.02460 / 600 m, histereza 150 m | 0,33 m | TAK |

Pozostałe strefy produkcji: PRE_PORT, PORT_OUT Gdańsk, PORT_IN Nynäshamn, PRE_ARRIVAL, SITE Boden.
Jeśli KSH zacznie ładować gdzie indziej — potrzebna kolumna adresu w harmonogramie i nowa strefa.

#### O3 podzielone, warunek release-1.0

- **O3a** — logowanie trzech ról (HHL, KSH, SCX) na produkcji.
- **O3b** — pełny transport (import → awizacja → prom → SE → rozładunek) przy pierwszym prawdziwym
  transporcie w pilotażu. Warunek wstępny: zapis importu do `loads` (ustalenie wyżej).
- **release-1.0** — dopiero po etapie I z audytu i po O3b.

#### Etap I (przyjęto: sekcja B audytu — blokery pierwszego użytkownika i faktury)

| # | Stan 27.09.2026 |
|---|---|
| B1 Stawki | ZABLOKOWANA — `rate_cards` 0, `rate_rules` 0 |
| B2 SEFS | ZABLOKOWANA — `baf_definitions` 0, `baf_index_values` 0, brak zadania notowań paliwa |
| B3 Umowy RODO | ZABLOKOWANA — właściciel/prawnik |
| B4 Spotkanie z SCX | nie odbyte (brak zapisu w repo) |
| B5 Strefy załadunku | sprawdzone — pasuje (tabela wyżej) |
| B6 Instrukcje | nie zrobione |
| B7 2FA administratorów | nie zrobione — `auth.mfa_factors` 0 |

#### I-2i — pozycje „częściowo” działające tylko w demo (27.09.2026)

Tabela: `docs/handover/POSTEP.md` § I-2i (11 pozycji: 8 ukrytych/zastąpionych w I-2a–h, nowe I-2j, I-2k, I-2l w `PLAN.md`). Statusy przeniesie I-9.

## 57. Założenia planu i czasu przejazdu (27.09)

plan KSH 5 dni od podjęcia do dostawy; obsada jednoosobowa, odpoczynek dobowy na promie; model ok. 2,5 doby + oczekiwanie na rejs; opóźnienie liczone od końca okna dostawy, a gdy okna nie ma — od końca dnia dostawy (Europe/Stockholm).

## 58. Daty planu — źródło (27.09)

ostateczne daty podaje KSH; daty z harmonogramu wstępne do potwierdzenia (I-18); import hurtowy u HHL nie nadpisuje po cichu dat potwierdzonych; SCOPE 16.3 zastąpiony przez potwierdzanie dat przez KSH.
