# Cele kliknięć — typ po typie (L-4)

Zapisz w repozytorium: `docs/handover/CELE_KLIKNIEC.md`.
Źródło: tabela DEC-CLICK (Cursor, 30.09, zaakceptowana przez właściciela
z odpowiedziami a/b/c) + uzupełnienia koordynatora 04.10.

## Rodzaje celów

- **Decyzja** — okno decyzji (opis, skutki, przyciski opcji)
- **Transport** — podgląd transportu (boczny panel), na wskazanej zakładce
- **Formularz** — okno z gotową akcją (awizacja, dokument, polisa,
  numer zlecenia, status, dopłata)
- **Stan systemu** — Opcje → Stan systemu, na wskazanej sekcji
- **Szczegóły wpisu** — okienko z treścią, czasem i źródłem wpisu
  (gdy nie ma obiektu, do którego można przejść)

## Zasady

1. Każdy typ w kodzie ma wiersz w tej tabeli. Test w bramie odrzuca typ
   bez celu.
2. Nigdy strona główna. Typ nieznany → **Szczegóły wpisu** + błąd w teście.
3. Ten sam cel z kokpitu, listy ryzyk, dzwonka i e-maila.
4. Widoczność bez zmian — macierz §4. Kliknięcie działa dla każdej firmy,
   która widzi pozycję. Brak uprawnień do celu → komunikat „Brak
   dostępu", nie strona główna.
5. Zdarzenie statusu albo strefy → zawsze **Transport**, bez mini-akcji
   (odpowiedź b).

---

## A. Decyzje (16 typów) — zawsze **Decyzja**

| # | Typ | Cel | Akcja w oknie decyzji |
|---|---|---|---|
| 1 | FERRY_CANCELLED | Decyzja | + link do transportu |
| 2 | ETA_AFTER_LATEST | Decyzja | |
| 3 | KSH_DATE_LT_5D | Decyzja | |
| 4 | NO_AWIZACJA | Decyzja | opcja „Dodaj" → Formularz awizacji |
| 5 | DOC_MISSING | Decyzja | → Formularz zezwolenia / dokumentu |
| 6 | KSH_ROW_GONE | Decyzja | |
| 7 | TOWER_KSH_CONFLICT | Decyzja | |
| 8 | KSH_FILE_ERROR | Decyzja | |
| 9 | NO_POSITION | Decyzja | → Formularz statusu ręcznego |
| 10 | ROUTE_DEVIATION | Decyzja | |
| 11 | SEFS_OUT_OF_TABLE | Decyzja | |
| 12 | SEFS_INVOICE_DIFF | Decyzja | |
| 13 | KR_OVER_3 | Decyzja | |
| 14 | INSURANCE_EXPIRING | Decyzja | → Formularz polisy |
| 15 | DWELL_OVER_FREE | Decyzja | → Formularz dopłaty |
| 16 | BACKUP_FAILED | Decyzja | → przycisk „Ponów kopię" (L-6) |
| — | decyzja po terminie (eskalacja) | ta sama Decyzja, czerwona | |

## B. Ryzyka, które otwierają decyzję → **Decyzja** odpowiedniego typu

| Ryzyko | Cel |
|---|---|
| prom: odwołanie, sztorm, nieznany status | Decyzja #1 |
| opóźnienie ETA (tylko z GPS/AIS) | Decyzja #2 |
| zmiana daty awizowanego transportu | Decyzja #3 |
| brak awizacji (progi 48/12 h) | Decyzja #4 |
| brak dokumentu, zezwolenia, polisy | Decyzja #5 |
| import: wiersz zniknął / konflikt / błąd pliku | Decyzja #6 / #7 / #8 |
| brak pozycji GPS | Decyzja #9 |
| zjazd z trasy | Decyzja #10 |
| SEFS poza tabelą albo awaria źródła SEFS | Decyzja #11 |
| rozbieżność SEFS na fakturze | Decyzja #12 |
| ponad 3 ładunki KR jednego dnia | Decyzja #13 |
| polisa wygasa | Decyzja #14 |
| postój ponad czas wolny | Decyzja #15 |
| nieudana albo nieświeża kopia zapasowa | Decyzja #16 |

## C. Ryzyka bez decyzji → **Transport** albo **Formularz**

| Ryzyko | Cel |
|---|---|
| LOADING_UNCONFIRMED (port bez załadunku, wyjazd bez potwierdzenia) | Transport → zakładka Status |
| AUTO_STATUS (automat zablokowany) | Transport → zakładka Status (z przyczyną) |
| brak zasobów: kierowca, auto | Formularz awizacji |
| brak zasobów: dokumenty | Transport → zakładka Dokumenty |
| brak zasobów: pilot (tylko gdy wymagany) | Formularz awizacji, sekcja pilota |
| brak nr zlecenia HHL | Formularz „Dodaj nr HHL" |
| brak nr zlecenia przewoźnika | Formularz numeru przewoźnika |
| SEQUENCE (kolejność montażu) | Transport → zakładka Status, z listą powiązanych transportów |
| DATES_UNCONFIRMED | Transport → zakładka Status |
| sytuacja drogowa PL/SE (spowolnienie, zamknięcie) | Transport; powyżej progu zjazdu → Decyzja #10 |
| pogoda (sztorm) | rejs zagrożony → Decyzja #1; inaczej → Transport |
| USAGE_LIMIT (70/85 % limitów usług) | Stan systemu → Zużycie |
| JOB_FAILURE poza kopią (integracja, SMS, błędy przeglądarki, zadania) | Stan systemu → Integracje / Dziennik |
| SOURCE_DOWN, brak AIS | Stan systemu → Integracje |

## D. Zdarzenia i powiadomienia (nie są decyzją)

| Zdarzenie | Cel |
|---|---|
| zmiana statusu (ręczna i automatyczna) | Transport → zakładka Status |
| strefa: wjazd, wyjazd, postój | Transport → zakładka Status |
| awizacja dodana albo zmieniona, numer zlecenia | Transport → zakładka Status |
| zmiana dat, import harmonogramu | Transport; zmiana krytyczna → Decyzja #3 |
| załadunek / rozładunek potwierdzony | Transport → zakładka Status |
| nowe ryzyko albo zmiana poziomu | według tabel B i C |
| decyzja: otwarta, rozstrzygnięta, eskalowana | Decyzja |
| **nowa wiadomość w Ustaleniach** | Transport → zakładka Ustalenia, przewinięte do tej wiadomości |
| **dopłata zgłoszona do akceptacji** | Transport → zakładka Ceny → lista dopłat z „Akceptuj" / „Odrzuć" |
| dopłata zaakceptowana albo odrzucona | Transport → zakładka Ceny |
| cennik, SEFS — zmiana | Opcje → Cennik / SEFS |
| integracje, kopie, logowania | Stan systemu (sekcja właściwa) |

## E. Uzupełnienia koordynatora (04.10) — przypadki bez celu

| Zdarzenie | Cel | Kto widzi |
|---|---|---|
| **Faktura**: nowa, zmiana statusu, oznaczona jako opłacona | Finanse → Faktury → otwarta konkretna faktura | HHL (strona MONEY według macierzy) |
| Faktura: rozbieżność SEFS | Decyzja #12 | HHL |
| **Milcząca bramka SMS** (SMS_GATEWAY_SILENT, cisza > 15 min) | Stan systemu → Bramka SMS (ostatni kontakt, instrukcja „sprawdź telefon") | tylko HHL / administrator |
| SMS niedoręczony (SMS_UNDELIVERED) | Stan systemu → Bramka SMS → lista SMS z tym wpisem | tylko HHL / administrator |
| **Limit stref** (osiągnięty limit stref albo limit SMS ze stref) | Opcje → Odbiorcy SMS i strefy (kreator stref, L-12) | tylko HHL / administrator |
| **Wpis bez obiektu** (ogłoszenie, baner, komunikat systemu) | Szczegóły wpisu; po kliknięciu znika z dzwonka (L-5) | według macierzy |
| **SMS niewysłany, e-mail zastępczy** (SMS_FALLBACK) | Stan systemu → Bramka SMS → wpis tego SMS-a (status, odbiorca, wysłany e-mail zastępczy) z linkiem do transportu | tylko HHL i administrator |
| **Alert reguły** (WORKFLOW_ALERT) | gdy dotyczy transportu: Transport → zakładka Status; gdy nie: Automatyzacje → reguła, która wywołała alert (podgląd reguły) | według macierzy |

---

## E-mail

Każdy e-mail zawiera link do konkretnego celu z tej tabeli:

- decyzja → `/decyzje/{id}`
- transport → `/transport/{kod}?zakladka=…`
- faktura → `/finanse/faktury/{id}`
- Stan systemu → `/opcje/stan-systemu#{sekcja}`

Po kliknięciu: logowanie (jeśli potrzebne) i przekierowanie dokładnie
do celu. Brak uprawnień → „Brak dostępu", nigdy strona główna.
Test: dla każdego typu e-maila link prowadzi do właściwego celu
po zalogowaniu.

## Gotowe, gdy

- każdy typ powiadomienia, ryzyka i decyzji w kodzie ma cel z tej tabeli
  (test odrzuca brak)
- dla każdego typu test: kliknięcie w kokpicie, na liście ryzyk,
  w dzwonku i link w e-mailu otwiera ten sam cel
- żadne kliknięcie nie prowadzi na stronę główną
