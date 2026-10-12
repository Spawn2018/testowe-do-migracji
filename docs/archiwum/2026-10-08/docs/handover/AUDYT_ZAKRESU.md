# AUDYT ZAKRESU — CO POMINIĘTO, CO NIEDOKOŃCZONE

> 27.09.2026. Źródła: rejestr `SCOPE.md` (sekcje 0–49), zlecenie dla Groka
> (51 pozycji + aneksy 1–5), dokumenty `MECHANIZM_PIENIEDZY.md`,
> `STATUSY_AUTOMATYCZNE.md`, `ZRODLA_DANYCH.md`,
> `PYTANIA_SCANDINAVIAN_EXPRESS.md`, `CURSOR_PROMPT.md`, pełny zapis
> rozmowy — **oraz bezpośredni odczyt produkcji** (Supabase, Cloudflare).
>
> **Granica tego audytu:** nie widzę kodu ani pliku `POSTEP.md` Groka.
> Oceniam z zewnątrz: dokumenty, raporty i stan bazy. Pozycje oznaczone
> „?" wymagają potwierdzenia przez Groka — lista pytań w sekcji G.

---

## A. USTALENIE NADRZĘDNE

**Pierwotny rejestr zakresu — ok. 110 pozycji w sekcjach 0–11 `SCOPE.md` —
nigdy nie dostał statusów.** Kolumny „Status" i „Dowód" są puste od
pierwszego dnia. Postęp śledziło zlecenie dla Groka (51 pozycji), które
**nie obejmuje całego pierwotnego zakresu** — było naprawą i dokończeniem
istniejącej aplikacji. Część funkcji z pierwotnego planu nie trafiła
do żadnego zlecenia.

**Dziennik odłożeń jest pusty**, choć kilka pozycji faktycznie odłożono
(SharePoint, e-CMR, KSeF, ślad węglowy, SMS). Zakres został zawężony
bez zapisu — dokładnie to, przed czym rejestr miał chronić.

---

## B. BLOKUJE PIERWSZEGO PRAWDZIWEGO UŻYTKOWNIKA LUB PIERWSZĄ FAKTURĘ

| # | Sprawa | Stan na produkcji | Kto |
|---|---|---|---|
| B1 | **Stawki** — cennik kosztu i przychodu (7.1) | `rate_cards` **0**, `rate_rules` **0** | właściciel: plik z ofertą i umową |
| B2 | **Opłata paliwowa SEFS** — parametry i odczyty indeksu (7.3, 7.4) | `baf_definitions` **0**, `baf_index_values` **0**; **brak jakiegokolwiek zadania pobierającego ceny paliwa** OKQ8/Orlen | decyzja: pobieranie automatyczne czy ręczne wpisywanie przez HHL; wartości tablic SEFS uzgodnione z przewoźnikiem (F4, F6) |
| B3 | **Umowy powierzenia danych — RODO** (2.8) | brak | właściciel, prawnik: HHL ↔ KSH ↔ SCX oraz dostawcy (Supabase, Vercel, Cloudflare, Resend); klauzula informacyjna dla kierowców o GPS |
| B4 | **Spotkanie z przewoźnikiem** | **nigdy nie zgłoszone jako odbyte**; 68 pytań, w tym 5 „od których zależy architektura" | właściciel |
| B5 | **Strefy załadunku** (37.5) | **jedna** strefa `LOADING`: KSH Śrem. Jeśli harmonogram ma inne miejsca załadunku — tam status „na załadunku" nie włączy się sam | Grok: porównać adresy z harmonogramu ze strefami |
| B6 | **Instrukcje dla użytkowników** (11.8) | brak | Grok: jedna strona dla kierowcy (PL/EN/SV), krótkie dla KSH i przewoźnika — **przed pilotażem** |
| B7 | **Weryfikacja dwuetapowa dla administratorów** (1.4) | `auth.mfa_factors` **0** — nikt nie ma 2FA, nic jej nie wymaga | Grok: TOTP dla HHL_ADMIN, wymuszone w bazie dla funkcji administracyjnych |

---

## C. WIDAĆ W APLIKACJI, ALE NA PRODUKCJI NIE DZIAŁA — RYZYKO FASADY

To najgroźniejsza klasa: w wersji demonstracyjnej wygląda na gotowe,
a na produkcji nic tego nie wylicza.

| # | Funkcja | Dowód z produkcji |
|---|---|---|
| C1 | **Automatyzacje — moduł Workflows** (M9, 9.1–9.4, „siedem reguł startowych" 9.3) | `workflows` **0 wierszy**; **w bazie nie ma żadnej funkcji silnika reguł**. Działają wyłącznie zadania wpisane na sztywno w harmonogramie |
| C2 | **Przewidywany czas przyjazdu** (M12, 5.12) | kolumny `eta_site`, `eta_confidence_min` istnieją; **żadna funkcja ani zadanie ich nie wylicza** |
| C3 | **Pogoda morska na trasie promu** (8.1) | brak źródła, brak zadania. Baner „prognoza fali 2,9 m" istnieje tylko w danych demonstracyjnych |
| C4 | **Zezwolenia i polisy** (6.4, 6.5, 6.6) | tabele `permits` i `insurance_policies` mają zabezpieczenia wierszy **bez żadnej reguły odczytu** — **nikt, także HHL, nie odczyta ich przez aplikację**. Pytanie o to zadałem 26.09 — **bez odpowiedzi** |
| C5 | Panel alternatywnych przepraw (8.4) | ? — prawdopodobnie dane statyczne |
| C6 | Warunki drogowe SE i PL (8.5, 8.6, 12.7) | czekają na klucze; w interfejsie oznaczenie demonstracyjne (D3) |
| C7 | Komunikaty armatora (8.2) | parser gotowy, **bez harmonogramu** — czeka na zgodę armatora |
| C8 | Kody przyczyn opóźnień (8.10) | w demo są; **nieuzgodnione z przewoźnikiem** |

---

## D. ZAPLANOWANE, NIEZROBIONE, NICZYM NIEZABLOKOWANE

| # | Pozycja z rejestru | Stan |
|---|---|---|
| D1 | **Monitoring błędów aplikacji** (1.7) | brak — strażnik pilnuje tylko zadań harmonogramu, nie błędów w przeglądarkach użytkowników |
| D2 | **Dostępność**: klawiatura, kontrast, czytniki ekranu (11.5) | nigdy nie sprawdzana |
| D3 | **Wydajność przy pełnym zakresie** (11.6) | mierzony tylko rozmiar paczki; **nie testowano bazy z 72 transportami i pełnym GPS** |
| D4 | Wersjonowanie i archiwum pliku harmonogramu (3.6) | ? |
| D5 | Powiadomienie o zmianie daty transportu awizowanego (3.7) | ? |
| D6 | Klasyfikacja ponadnormatywności per kraj (3.8) | ? — „limity do potwierdzenia" |
| D7 | Zasoby i awizacja: formularz, okno, eskalacje, pilotaż, rezerwacja promu (4.1–4.6) | ? — żadna pozycja zlecenia nie obejmowała ich wprost |
| D8 | Edytor stref na mapie (5.9), odtwarzanie przebiegu (5.13) | ? |
| D9 | Paczka dokumentów per transport i tydzień (6.8) | ? |
| D10 | Ocena przewoźnika (10.6), eksport PDF (10.8) | ? — XLSX jest |
| D11 | Import tylko u KSH, eksport tylko u HHL (16.3) | ? — nie wiem, czy wymuszone w bazie |
| D12 | Odsiewanie duplikatów powiadomień (9.8) | ? |
| D13 | Retencja danych osobowych poza GPS (2.7) | GPS: 30 dni po rozładunku. **Nazwisko i telefon kierowcy, zdjęcia, CMR — nieustalone** |

---

## E. ODŁOŻONE BEZ ZAPISU — DO WPISANIA DO DZIENNIKA ODŁOŻEŃ

Albo decyzja „odkładamy, bo…, wraca po…", albo „rezygnujemy":

| Pozycja | Propozycja |
|---|---|
| 3.10 Integracja z SharePoint | odłożona — zależy od IT klienta |
| 5.1–5.3, 5.5 Telematyka przewoźnika | zablokowana — spotkanie z SCX, blok A pytań |
| 6.9 Elektroniczny list przewozowy | odłożona po 1.0 |
| 7.11 KSeF | odłożona — faktury wystawiane w systemach stron, TOWER rejestruje PDF |
| 9.6 SMS | **decyzja**: rezygnacja albo płatny dostawca — nie ma darmowego |
| 9.9 Kanał zespołowy, 9.10 kalendarz | decyzja |
| 10.9 Ślad węglowy | odłożona po 1.0 |
| 17.11 Geometria trasy z zezwolenia | zablokowana — wzór zezwolenia |
| 17.14 Parametry operacyjne: cutoff promu, progi fal, prędkość | zablokowana — spotkanie z SCX |
| 1.6 Podgląd zabezpieczony hasłem | **zastąpione** trybem demonstracyjnym podglądów — zapisać jako zamknięte zamiennikiem |

---

## F. ZGŁOSZONE JAKO ZROBIONE — WYNIKÓW NIE WIDZIAŁEM

Grok napisał: „wszystko sprzed aneksu 5 jest skończone". Te pozycje były
w zleceniu, ale ich wyników nie było w żadnym raporcie, który do mnie trafił:

| Pozycja | Czego dotyczy |
|---|---|
| F2.1 | widok Ryzyka — 0 zmian w fali 2, „niemożliwe"; mógł zamrozić usterkę we wzorcu |
| F2.2 | próg testu wizualnego `maxDiffPixels: 60` zamiast progu względnego |
| F2.4 | tabela zgodności mechanizmu paliwowego: kod ↔ dokumentacja |
| F2.5 | pozycje L1, L2, L4, L5, L7, L8, L9, L16 — przydział do etapów |
| F2.6 | trzy wyjaśnienia matrycy zrzutów |
| 25.1 | test importu na realnej skali 72 transportów |

---

## G. DO ZAMKNIĘCIA PRZED WYDANIEM 1.0 — ZNANE

- wdrożenie na `tower.log-mar.pl` (w toku), test dymny na produkcji,
  raport końcowy, tag `release-1.0`
- makieta do pobrania bez logowania? — pytanie wysłane
- `files/` w R2 bez retencji — decyzja po pilotażu
- **token Supabase Groka — do odwołania** po ostatnim kroku
- prompt startowy dla Cursora — po pilotażu

---

## H. SPRAWY PRAWNE I KSIĘGOWE — POZA KODEM, W ZAKRESIE

| Sprawa | Źródło |
|---|---|
| reguła kursu NBP w umowie z przewoźnikiem — dla nierezydenta to warunek umowny, nie ustawowy | 34.6, W3 |
| potwierdzenie reguły kursowej przez księgowość | 34.6 |
| umowy powierzenia i klauzule RODO | B3 |
| regulamin darmowego Vercel — użycie komercyjne niedozwolone; ryzyko przyjęte świadomie | 40 |
