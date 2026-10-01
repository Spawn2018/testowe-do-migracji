# REJESTR DECYZJI — STAN KOŃCOWY

> Jedno miejsce z każdą decyzją. Status: ✅ rozstrzygnięta · ⏳ czeka · 🔁 zmieniona.

## Decyzje podstawowe (22–27.09)
| Sprawa | Decyzja | Data |
|---|---|---|
| Wygląd | identyczny z makietą w 100%, bez „AI" | 22.09 |
| Waluta | EUR wszędzie; PLN tylko w ustawieniach użytkownika | 24.09 |
| Kurs | NBP A, dzień roboczy przed rozładunkiem, każdy transport osobno | 24.09 |
| Realizacja usługi | rozładunek | 24.09 |
| Faktury | tygodniowe; HHL→KSH widzi KSH; SCX→HHL widzi HHL; terminy 30/35 dni od wystawienia | 24.09 |
| Marża | z daty dostawy w harmonogramie; faktura nadrzędna | 24.09 |
| Statusy | z GPS, strefy portów PL i SE; prom = strefa + czas odejścia rejsu | 24.09 |
| Okna planu | przewoźnik nie zmienia okien planowanych | 25.09 |
| Koszt | wszystko za darmo, nigdy plan płatny | 26.09 |
| Sesja | użytkownik 365 dni, kierowca 14 dni | 26.09 |
| Domena | `tower.log-mar.pl`, zapas `tower-hhl.pages.dev` | 27.09 |
| SMS | własna bramka na telefonie z Androidem | 27.09 |
| KSeF | poza systemem na stałe | 27.09 |

## Decyzje numerowane
| ID | Sprawa | Decyzja | Status |
|---|---|---|---|
| D-1 | stawki | cenniki SCX i HHL przekazane — 12 pozycji (kwoty w plikach poufnych) | ✅ 29.09 |
| D-2 | dopłata paliwowa | załącznik SEFS z 28.09; ceny „tak, jak podaje źródło" | ✅ 29.09 |
| D-3 | retencja dokumentów | CMR, POD, zdjęcia 3 lata; PDF faktur 5 lat — **rekomendacja, czeka na potwierdzenie** | ⏳ |
| D-4 | telefon i SIM | **ZAMKNIĘTE 01.10** — telefon Android + SIM są; SMS tylko do KSH (do kierowców — rezygnacja D-37); dokończenie APK = I-3-APK | ✅ 01.10 |
| D-5 | RODO | **zamknięte** — wszystkie zgody są, temat zakończony | ✅ 29.09 |
| D-6 | spotkanie z przewoźnikiem | **odbyte 29.09** — decyzje w `ZLECENIE_PO_SPOTKANIU_SCX.md` | ✅ |
| D-7 | trenowanie modeli Vercel | wyłączyć | ⏳ |
| D-8 | stawka STANDARD | 🔁 nieaktualne — „Standard" to transporty NTG | ✅ |
| D-9 | czasy odcinków ETA | 7,5 h / 3 h / 18 h / 17 h / 13 h; obsada jednoosobowa; odpoczynek na promie | ✅ |
| D-10 | przewoźnik widzi SEFS | tak, odczyt, tylko wersje uzgodnione | ✅ |
| D-11 | 2FA administratora | włącza właściciel, dwa urządzenia | ⏳ |
| D-12 | źródło dat planu | KSH — **data i godzina** w pliku SharePoint; wyprzedzenie 5 dni | ✅ |
| D-13 | podglądy wdrożeń | zamknięte zamiennikiem | ✅ |
| D-14 | kurs NBP | pytanie do księgowej | ⏳ |
| D-15 | limity ponadnormatywności | zebrane, do potwierdzenia z przewoźnikiem | ⏳ |
| D-16 | konta użytkowników | **zakłada właściciel w aplikacji** (partiami — limit e-maili) | ✅ 29.09 |
| D-17 | rejestracja KPD GDDKiA | — | ⏳ |
| D-18 | e-mail do armatora | informacja; odczyt ruszył bez zgody (decyzja 29.09) | ⏳ |
| D-21 | wymóg zezwoleń | włączyć przed pierwszym transportem | ⏳ |
| D-22 | kierowca pilota | tak | ✅ |
| D-23 | przewoźnik widzi oceny | tak, bez uwag HHL | ✅ |
| D-24 | widok placu | zamknięte decyzją 16.1 — Stegra nie jest rolą | ✅ |
| D-25 | wzorzec zrzutów | zatwierdzony z warunkiem | ✅ |
| D-27 | kontrast | zatwierdzony, test ≥ 4,5:1 | ✅ |
| D-28 | serwis tras | 🔁 TomTom → HERE → **własny silnik + kalibracja ucząca się** | ✅ |
| D-29 | reguły automatyzacji | ONE-MECH: tabela D-29t **zaakceptowana 01.10** (warunek: każdy alarm ma zastępnik); scalenie kodu w toku | ✅ tabela / ⏳ kod |
| D-30 | polisy | tak | ✅ |
| D-31 | pasek 390 px | naprawić | ✅ |
| D-32 | zgoda IT KSH (SharePoint) | — | ⏳ |
| D-33 | zapis do pliku KSH | kierowca, telefon, nr zlecenia, nr rejestracyjny | ✅ |
| D-35 | hasło bazy | **bez zmiany — ryzyko przyjęte**; unieważnienie tokenów Groka | ✅ 29.09 |
| D-34 | tydzień dopłaty paliwowej | **według mechanizmu BAF — data załadunku** | ✅ 29.09 |

## Ustalenia z 29.09 bez numeru
- import tylko HH z wymiarami; NTG „Standard" pomijany ✅
- konwój = liczba aut z kratownicami z tą samą datą załadunku ✅
- KSH ma identyczną dopłatę paliwową ✅
- PL o wysokości 2,60 m wyceniane jak przy 2,45 m (PL-B) ✅
- błędne daty kratownic zostają — test wykrywania zmian ✅
- odczyt komunikatów armatora — włączyć od razu ✅
- SharePoint — integracja w obie strony ✅
- przejęcie pracy przez Cursora ✅

## Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md`
| ID | Sprawa | Decyzja |
|---|---|---|
| D-36 | telematyka | emtrack.eu przez API + linki od podwykonawców; dokumentacja i przykłady — właściciel dostarczy |
| D-37 | SMS | do kierowców — rezygnacja; do KSH — 1 h przed przyjazdem na załadunek |
| D-38 | aplikacja kierowcy | ukryta; CMR wgrywa dyspozytor; POD i zdjęcia mocowania — rezygnacja |
| D-39 | progi sztormowe | fala 3,8 m, porywy 40 węzłów — potwierdzone |
| D-40 | promy | rezerwuje i opłaca przewoźnik |
| D-41 | tranzyt | 4 dni; 5 przy ciężkiej pogodzie w Szwecji |
| D-42 | opłaty dodatkowe | wyłącznie ręcznie po uzgodnieniu; pusty przebieg — nie dotyczy |
| D-43 | faktury | EUR albo PLN, wybór przy wystawieniu; osobny kurs dla każdego transportu |
| D-44 | numery zleceń | plik KSH: **„Nr zlecenia" = przewoźnik**, **„Nr zlecenia HHL" = HHL**; przewoźnik wpisuje swój w awizacji |
| D-45 | Stena Line Gdynia – Karlskrona | pełna obsługa jak Polferries + trasa alternatywna w ryzykach |
| D-46 | wybór rejsu | przewoźnik: armator → rejs → statek, listy zależne |
| D-47 | awizacja | przycisk „Dodaj" w panelu → osobne okno; **po zapisie „Edytuj"** — to samo okno z danymi |
| D-48 | godzina dostawy KSH | „najpóźniej do" |
| D-49 | logowanie | 🔁 **hasłem** (zmiana decyzji 29.09); e-mail tylko do zaproszenia i odzyskania hasła; bez e-maili dla adresów bez zaproszenia |
| D-55 | telefon | **pełna responsywność + instalacja z Chrome jako aplikacja**; czytelna i wygodna praca na telefonie |
| D-50 | pasek użytkownika | do lewego menu, z „Wyloguj" |
| D-51 | załadunki KSH | powiadomienia i strefy jak dla dostaw do Stegry |
| D-52 | administrator | wykonuje wszystko za każde konto; „Działaj jako" |
| D-53 | historia zmian | każda zmiana zapisana, szybkie śledzenie kto i co |
| D-54 | zezwolenia | automatyczne według wymiarów aut od przewoźnika + ręczne na trasę |
| D-56 | wzór pliku KSH | `SCRAP_transporty_…_REV_01.xlsx` — 20 kolumn, mapowanie po nazwach; transporty sprzed uruchomienia jako historyczne |
| D-57 | numer zlecenia HHL | HHL i administrator dodają i edytują samodzielnie; przewoźnik i KSH — odczyt |
| D-58 | formaty kolumn w pliku KSH | kierowca, rejestracje, oba numery zleceń — **tekst**; telefon — **liczba** |
| D-59 | nazwa i logo | **„WATCH TOWER"**; nowe logo na ekranie ładowania, favicon i ikona aplikacji na telefonie |
| D-60 | telefony | 🔁 **zawsze bez kierunkowego** (zastępuje „pełny numer międzynarodowy"); kraj numeru tylko dla bramki SMS |
| D-61 | decyzje | pełny proces: katalog 16 typów, kto decyduje, opcje ze skutkiem, terminy, eskalacja, historia |
| D-62 | powiadomienia | każde zdarzenie, zmiana statusu, ryzyko i decyzja w centrum powiadomień |
| D-63 | widoczność | administrator wybiera firmy (HHL / przewoźnik / KSH — jedna, dwie, trzy) dla każdego typu; blokady danych finansowych |
| D-64 | SMS | 2 osoby na załadunku (Śrem) i 2 na rozładunku (Boden); strefa zbliżania i wjazd; odbiorców wpisuje administrator |
| D-65 | ustawienia administratora | sekcje zwijane, domyślnie zwinięte; nowe: widoczność, SMS i strefy, progi, stan systemu, użytkownicy i sesje, dziennik logowań, komunikat, eksport |
