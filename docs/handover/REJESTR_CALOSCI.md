# REJESTR CAŁOŚCI

Data sporządzenia: niedziela 4 października 2026.

Repozytorium: `/workspace/watch-tower-app`.

Rewizja: `76e343f`. Gałąź: `feat/h2-trafikverket`.

Jedno użycie gita: `git -C /workspace/watch-tower-app rev-parse --short HEAD` oraz `git -C /workspace/watch-tower-app branch --show-current`. Bez `log`, `diff` i `blame`. Statusów nie brano z kodu ani z migracji, chyba że dokument je cytuje.

## Pliki przeczytane

- `docs/handover/wzorzec/03_REJESTR_DECYZJI.md`
- `docs/handover/ZLECENIE_FINAL.md`
- `docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md`
- `docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md`
- `docs/handover/ZLECENIE_SHAREPOINT.md`
- `docs/handover/ZLECENIE_CENNIK_SEFS.md`
- `docs/handover/ZLECENIE_POGODA_DROGI_ETA.md`
- `docs/handover/ZLECENIE_POPRAWKI_02_10.md`
- `docs/handover/ZLECENIE_HERE.md`
- `docs/handover/PACZKA_DECYZJI_30_09.md`
- `docs/handover/POLECENIA_KOORDYNATORA.md`
- `docs/handover/SCOPE.md`
- `docs/handover/PLAN.md`
- `docs/handover/POSTEP.md`
- `docs/handover/wzorzec/11_INWENTARZ_PLIKOW.md`
- `docs/handover/wzorzec/STAN/PLAN_KOPIA_KOORDYNATORA.md`
- `docs/handover/wzorzec/STAN/SCOPE_KOPIA_KOORDYNATORA.md`
- `docs/handover/wzorzec/STAN/PACZKA_DECYZJI_30_09.md`
- `docs/handover/wzorzec/STAN/ZLECENIE_POGODA_DROGI_ETA.md`
- `docs/handover/wzorzec/STAN/ZLECENIE_SHAREPOINT.md`

## Pliki z polecenia, których nie ma na dysku

- `ZLECENIE_ETAP_I.md` — brak jako plik w `/workspace/watch-tower-app` (find, bez `node_modules`). Wzmianki: `docs/handover/SCOPE.md` §52.2, `docs/handover/PLAN.md` wiersz I-3, `docs/handover/POSTEP.md` wiersz I-3 P0, `docs/handover/wzorzec/11_INWENTARZ_PLIKOW.md` („wykonane”). Treści pliku nie odtworzono.
- `ZLECENIE_DLA_GROKA.md` — brak jako plik. Wzmianki: `docs/handover/ZLECENIE_FINAL.md` (tabela etapu 0: „to samo zlecenie”), `docs/handover/SCOPE.md` §36, `docs/handover/POSTEP.md` P0.1 („identyczne z `ZLECENIE_DLA_GROKA.md` z pakietu”), `docs/handover/wzorzec/11_INWENTARZ_PLIKOW.md`. Treści pliku nie odtworzono.

Dodatkowe trafienie nazwy `ZLECENIE_ETAP_I` w `supabase/migrations/0069_sms_8_9_secret.sql` — plik kodu, nie źródło statusu i nie odtworzenie treści.

Zakres sekcji poza prośbą o §1–§15 / §0–§60 / części A–D:

- `ZLECENIE_PO_SPOTKANIU_SCX.md`: jest §0 i sekcja „Kolejność dla wykonawcy” — poza §1–§15. Wypisane osobno.
- `ZLECENIE_POPRAWKI_02_10.md`: części A, B, C, D. Dalszych części (E…) nie ma.
- `SCOPE.md`: sekcje numerowane kończą się na §58. Nie ma §59 ani §60. Poza numeracją §0–§58: „Statusy”, „Legenda kolumny dowód”, „Dziennik odłożeń”, „Dziennik blokad”.
- `ZLECENIE_DECYZJE_POWIADOMIENIA.md`: jest §0 i „Kolejność” poza §1–§6.

Reguła pozycji: wiersz tabeli z identyfikatorem oraz nagłówek sekcji z identyfikatorem. Akapit bez numeru nie jest pozycją. Kopia `docs/handover/wzorzec/STAN/` nie jest drugim źródłem pozycji; różnica statusu tej samej pozycji trafia do sekcji 3.

## 1. DECYZJE

Rejestr, który wypisuje D-n: `docs/handover/wzorzec/03_REJESTR_DECYZJI.md`. Numer spoza tego pliku: „BRAK W REJESTRZE”, treść pusta, status NIEZNANY. Status „obowiązuje”, gdy wiersz rejestru nie ma adnotacji, że cała decyzja jest zastąpiona albo usunięta. Gdy dwa dokumenty mówią co innego: status NIEZNANY i sekcja 3.

| ID | Treść (cytat z rejestru) | Źródło | Status |
|---|---|---|---|
| D-1 | cenniki SCX i HHL przekazane — 12 pozycji (kwoty w plikach poufnych) | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-2 | załącznik SEFS z 28.09; ceny „tak, jak podaje źródło" | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-3 | CMR, POD, zdjęcia 3 lata; PDF faktur 5 lat — rekomendacja, czeka na potwierdzenie | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | otwarta — czeka na potwierdzenie |
| D-4 | **ZAMKNIĘTE 01.10** — telefon Android + SIM są; SMS tylko do KSH (do kierowców — rezygnacja D-37); dokończenie APK = I-3-APK | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-5 | **zamknięte** — wszystkie zgody są, temat zakończony | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-6 | **odbyte 29.09** — decyzje w `ZLECENIE_PO_SPOTKANIU_SCX.md` | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-7 | wyłączyć | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-8 | obowiązuje — «Standard» = transporty NTG (potwierdzenie właściciela 04.10) | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-9 | czasy = start kalibracji (D-85); ETA z planu usunięte (D-80) | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | czasy = start kalibracji (D-85); ETA z planu usunięte (D-80) |
| D-10 | tak, odczyt, tylko wersje uzgodnione | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-11 | włącza właściciel, dwa urządzenia | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-12 | KSH — **data i godzina** w pliku SharePoint; wyprzedzenie 5 dni | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-13 | zamknięte zamiennikiem | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-14 | pytanie do księgowej | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | otwarta — czeka na potwierdzenie |
| D-15 | zebrane, do potwierdzenia z przewoźnikiem | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | otwarta — czeka na potwierdzenie |
| D-16 | **zakłada właściciel w aplikacji** (partiami — limit e-maili) | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-17 | — | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-18 | informacja; odczyt ruszył bez zgody (decyzja 29.09) | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-19 | numer nieużyty | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | numer nieużyty |
| D-20 | BRAK W REJESTRZE |  | NIEZNANY |
| D-21 | włączyć przed pierwszym transportem | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-22 | tak | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-23 | tak, bez uwag HHL | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-24 | zamknięte decyzją 16.1 — Stegra nie jest rolą | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-25 | zatwierdzony z warunkiem | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-26 | przeniesiona do III-13, zamknięta | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | przeniesiona do III-13, zamknięta |
| D-27 | zatwierdzony, test ≥ 4,5:1 | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-28 | zmieniona przez D-77 (własny silnik = zapas) | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | zmieniona przez D-77 |
| D-29 | ONE-MECH: tabela D-29t **zaakceptowana 01.10** (warunek: każdy alarm ma zastępnik); scalenie kodu w toku | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-30 | tak | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-31 | naprawić | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-32 | — | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-33 | kierowca, telefon, nr zlecenia, nr rejestracyjny | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-34 | według mechanizmu BAF — data załadunku | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-35 | **bez zmiany — ryzyko przyjęte**; unieważnienie tokenów Groka | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje numerowane | obowiązuje |
| D-36 | emtrack.eu przez API + linki od podwykonawców; dokumentacja i przykłady — właściciel dostarczy | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-37 | do kierowców — rezygnacja; do KSH — 1 h przed przyjazdem na załadunek | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-38 | ukryta; CMR wgrywa dyspozytor; POD i zdjęcia mocowania — rezygnacja | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-39 | fala 3,8 m, porywy 40 węzłów — potwierdzone | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-40 | rezerwuje i opłaca przewoźnik | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-41 | 4 dni; 5 przy ciężkiej pogodzie w Szwecji | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-42 | wyłącznie ręcznie po uzgodnieniu; pusty przebieg — nie dotyczy | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-43 | EUR albo PLN, wybór przy wystawieniu; osobny kurs dla każdego transportu | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-44 | plik KSH: **„Nr zlecenia" = przewoźnik**, **„Nr zlecenia HHL" = HHL**; przewoźnik wpisuje swój w awizacji | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-45 | pełna obsługa jak Polferries + trasa alternatywna w ryzykach | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-46 | przewoźnik: armator → rejs → statek, listy zależne | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-47 | przycisk „Dodaj" w panelu → osobne okno; **po zapisie „Edytuj"** — to samo okno z danymi | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-48 | „najpóźniej do" | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-49 | 🔁 **hasłem** (zmiana decyzji 29.09); e-mail tylko do zaproszenia i odzyskania hasła; bez e-maili dla adresów bez zaproszenia | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-50 | do lewego menu, z „Wyloguj" | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-51 | powiadomienia i strefy jak dla dostaw do Stegry | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-52 | wykonuje wszystko za każde konto; „Działaj jako" | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-53 | każda zmiana zapisana, szybkie śledzenie kto i co | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-54 | część «wymiary od przewoźnika» zastąpiona przez D-83 i D-68 | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | część «wymiary od przewoźnika» zastąpiona przez D-83 i D-68 |
| D-55 | **pełna responsywność + instalacja z Chrome jako aplikacja**; czytelna i wygodna praca na telefonie | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-56 | `SCRAP_transporty_…_REV_01.xlsx` — 20 kolumn, mapowanie po nazwach; transporty sprzed uruchomienia jako historyczne | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-57 | HHL i administrator dodają i edytują samodzielnie; przewoźnik i KSH — odczyt | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-58 | kierowca, rejestracje, oba numery zleceń — **tekst**; telefon — **liczba** | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-59 | **„WATCH TOWER"**; nowe logo na ekranie ładowania, favicon i ikona aplikacji na telefonie | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-60 | 🔁 **zawsze bez kierunkowego** (zastępuje „pełny numer międzynarodowy"); kraj numeru tylko dla bramki SMS | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-61 | pełny proces: katalog 16 typów, kto decyduje, opcje ze skutkiem, terminy, eskalacja, historia | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-62 | każde zdarzenie, zmiana statusu, ryzyko i decyzja w centrum powiadomień | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-63 | administrator wybiera firmy (HHL / przewoźnik / KSH — jedna, dwie, trzy) dla każdego typu; blokady danych finansowych | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-64 | 2 osoby na załadunku (Śrem) i 2 na rozładunku (Boden); strefa zbliżania i wjazd; odbiorców wpisuje administrator | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-65 | sekcje zwijane, domyślnie zwinięte; nowe: widoczność, SMS i strefy, progi, stan systemu, użytkownicy i sesje, dziennik logowań, komunikat, eksport | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje po spotkaniu z przewoźnikiem (29.09) — szczegóły w `ZLECENIE_PO_SPOTKANIU_SCX.md` | obowiązuje |
| D-66 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-67 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-68 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-69 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-70 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-71 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-72 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-73 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-74 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-75 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-76 | BRAK W REJESTRZE |  | nie odtworzono — brak numeru w ZLECENIE_POPRAWKI_02_10.md |
| D-77 | HERE wchodzi do systemu. Zastępuje zapis „bez HERE" z D-28. Własny silnik zostaje jako zapas, gdy HERE jest niedostępne albo budżet wyczerpany. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-78 | Do 100 USD miesięcznie. Ostrzeżenia w Stanie systemu przy 50%, 80% i 100%. Po przekroczeniu 100% system przestaje odpytywać HERE i przechodzi na darmowe wyliczenia. Nigdy nie płaci ponad budżet. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-79 | Zero aplikacji dla kierowców (Scandinavian Express). HERE WeGo Pro i pakiet nawigacyjny HERE SDK wykluczone. Nic nie jest instalowane u przewoźnika ani kierowców. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-80 | ETA nadal wyłącznie z pozycji GPS i AIS (decyzja z 04.10). HERE liczy czas przejazdu z bieżącej pozycji, nigdy z planu. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-81 | Wyniki przechowujemy najwyżej 30 dni. Na stałe wyłącznie własne podsumowania. Geometria i surowe dane HERE kasowane po 30 dniach. Warunki usługi — w `POSTEP.md` przed startem. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-82 | Opłaty drogowe poza zakresem. Nie liczymy i nie pokazujemy. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-83 | Wymiary dla każdego transportu poda właściciel. Kontrola trasy nie bierze niczego z dokumentów. Przewoźnik nie wprowadza żadnych wymiarów. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-84 | Porywy 15 m/s. Silny wiatr na trasie wydłuża ETA (H-10). | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |
| D-85 | W pełni automatyczne, zero ręcznego wpisu, także prędkości. | docs/handover/wzorzec/03_REJESTR_DECYZJI.md — Decyzje HERE (04.10.2026) — szczegóły w `ZLECENIE_HERE.md` | obowiązuje |

## 2. POZYCJE

| ID | Źródło | Tytuł (cytat lub skrót dosłowny) | Status |
|---|---|---|---|
| BRAK-PLIKU-ZLECENIE_ETAP_I | brak pliku na dysku; wzmianka: docs/handover/SCOPE.md — 52.2 Etap I — definicja | ZLECENIE_ETAP_I.md: I-0 wyciek, I-1 import, I-2 zero fasady, I-3 SMS, I-4 instrukcje, I-5 2FA, I-6 monitoring błędów, I-7 retencja, I-8 wydajność, I-9 synchronizacja rejestru. | do zrobienia |
| BRAK-PLIKU-ZLECENIE_DLA_GROKA | brak pliku na dysku; wzmianka: docs/handover/ZLECENIE_FINAL.md — ETAP 0 (tabela plików) oraz docs/handover/POSTEP.md — Etap 0 P0.1 | ZLECENIE_DLA_GROKA.md \| — \| to samo zlecenie; jeżeli wklejony tekst był ucięty, źródłem jest ten plik | do zrobienia |
| D-10 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~widoczność SEFS dla przewoźnika~~ — **ROZSTRZYGNIĘTE 27.09:** przewoźnik widzi parametry tylko do odczytu, wyłącznie wersje uzgodnione (`agreed_with_carrier = true`) → **I-13** (właściciel 27.09; pierwotnie I-15) | do zrobienia |
| D-11 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **ROZSTRZYGNIĘTE 27.09:** właściciel włącza wymaganie dopiero po I-17 (drugie urządzenie). | do zrobienia |
| D-12 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **ROZSTRZYGNIĘTE 27.09:** ostateczne daty załadunku i rozładunku podaje KSH (→ I-18). Termin potwierdzenia N — do uzgodnienia, domyślnie 5 dni. INFO: plan KSH = 5 dni od odbioru do dostawy | do zrobienia |
| D-14 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | (z I-11: SCOPE 7.5) konwencja kursu NBP (tabela A z dnia roboczego przed rozładunkiem) — **CZEKA:** właściciel pyta księgowość | do zrobienia |
| D-16 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | lista użytkowników do zaproszenia: imię i nazwisko, e-mail, firma, rola | do zrobienia |
| D-17 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | rejestracja w KPD GDDKiA: najpierw firma, potem użytkownik z certyfikatem | do zrobienia |
| D-18 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | e-mail do armatora z prośbą o zgodę na odczyt komunikatów (informacja — odczyt II-5 już włączony) | do zrobienia |
| D-2 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **ZREALIZOWANE** (I-31): SEFS hybrid_min w bazie; III-10 WOB wyłączone (niezgodne z umową). Potwierdzenie SCX (pyt. 9) nie blokuje | zrobione |
| D-20 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **CZĘŚCIOWO 02.10:** RODO/zgody załatwione (R-1/R-2). | do zrobienia |
| D-21 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **POTWIERDZONE 28.09 (właściciel): właściciel włącza przed pierwszym transportem.** **DZIAŁANIE WŁAŚCICIELA przed pierwszym prawdziwym transportem (R-3):** włączyć przełącznik I-27 „brak zezwolenia blokuje Gotowy” dla kl… | do zrobienia |
| D-22 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~dane kierowcy pojazdu pilotującego~~ — **ROZSTRZYGNIĘTE 28.09 (właściciel): TAK** imię i telefon, te same zasady co kierowca: retencja 90 dni, dostęp przez funkcję danych kontaktowych, KSH nie widzi, nie ma w eksporcie… | zrobione |
| D-23 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~widoczność ocen dla przewoźnika~~ — **ROZSTRZYGNIĘTE 28.09 (właściciel): TAK** przewoźnik widzi swoje oceny i punktualność; wewnętrzne notatki HHL (komentarz) niewidoczne | zrobione |
| D-24 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~widok placu budowy~~ — **ZAMKNIĘTE 28.09 (właściciel) przez SCOPE 16.1:** Stegra nie jest rolą, tylko strefą/POI. Bez nowej roli; SCOPE 10.4 nie będzie realizowany | do zrobienia |
| D-25 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~odświeżenie wzorca Dokumenty/Harmonogram~~ — **ZATWIERDZONE WARUNKOWO 28.09 (właściciel):** każde ze 175 ujęć sprawdzić — różnica wyłącznie w miejscu nowych elementów (terminy, „Zmień”, wybór tygodnia, „Wgraj aktualiza… | do zrobienia |
| D-3 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | retencja zdjęć, CMR, POD | do zrobienia |
| D-32 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **CZEKA.** Zgoda IT KSH (Graph, `Sites.Selected`, witryna STEGRABODEN). | do zrobienia |
| D-33 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **ROZSTRZYGNIĘTE 30.09, NIE ZROBIONE.** TOWER wpisuje do pliku KSH: kierowca, telefon, nr zlecenia, nr rejestracyjny (nowa kolumna „Nr rejestracyjny (TOWER)”). | do zrobienia |
| D-5 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **DONE 02.10** (właściciel): umowy RODO / zgody załatwione — odblokowanie zaproszeń i e-maili do kont dodanych w aplikacji (0133); pełne EXTERNAL_MESSAGING nadal osobna decyzja | zrobione |
| D-6 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | spotkanie ze Scandinavian Express | do zrobienia |
| D-7 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | Vercel: wyłączenie trenowania modeli (panel) | do zrobienia |
| D-8 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~wycena ładunków STANDARD~~ — **ROZSTRZYGNIĘTE 27.09**, potem **NIEAKTUALNE 30.09:** transporty „Standard” należą do NTG (inna firma) i nie są importowane. | do zrobienia |
| D-9 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | ~~parametry odcinków ETA v1~~ — **ROZSTRZYGNIĘTE 27.09:** wartości wpisane (I-D9, 0054); obsada jednoosobowa, przeprawa = dobowy odpoczynek na promie (potwierdzone przez właściciela, bez postoju w Nynäshamn); czasy PL/ch… | do zrobienia |
| D-STENA-COORDS | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **DONE 02.10** (właściciel potwierdził terminale). Współrzędne: Gdynia 54.53321, 18.54425; Karlskrona 56.16460, 15.63080 — obowiązują w geofence STENA-3 | zrobione |
| D-TELM-ETA | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | **CZEKA.** API emtrack + przykłady linków podwykonawców (TELM-2) — bez GPS po rozładunku nie domykamy II-7b (symulacja 30 / uczenie tempa) | do zrobienia |
| D-1 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-1, D-2 — CENNIK I SEFS: PRZEKAZANE | **ZREALIZOWANE** (I-30): cennik SYMBOL w bazie (TEST+PROD), kwoty wyłącznie skryptem z `D:\Watch Tower\dane` | zrobione |
| D-28 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-28 — DECYZJA KOŃCOWA: WŁASNY SILNIK + KALIBRACJA UCZĄCA SIĘ | **ROZSTRZYGNIĘTE 30.09: HERE — nie**. II-7 DONE (0122, OSM). II-7b szkielet 0123; nauka CZEKA NA TELM-2 | zrobione |
| D-29 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-29 — REGUŁY STARTOWE: NAJPIERW TABELA | **AKCEPTACJA 01.10 (D-29t + warunek zastępników).** Tabela w PLAN zaakceptowana; żaden alarm bez zastępnika (lista w POSTEP). Scalenie kodu = pozycja ONE-MECH. START-1…7 nadal 0/7 do scalenia | do zrobienia |
| D-4 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/POSTEP.md — Akceptacja koordynatora (01.10 popołudnie) | ~~telefon i SIM~~ — **ZAMKNIĘTE 01.10:** telefon Android + karta SIM są (koordynator). Dokończenie = I-3-APK | do zrobienia |
| DEC-CLICK | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/POSTEP.md — Akceptacja koordynatora (01.10 popołudnie) | **AKCEPTACJA 01.10.** (a) grupy C bez nowych typów: LOADING_UNCONFIRMED, SEQUENCE, DATES_UNCONFIRMED, USAGE_LIMIT, JOB_FAILURE (poza kopią). | do zrobienia |
| D-13 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | ~~podglądy wdrożeń~~ — **ZAMKNIĘTE 28.09 (zastąpione):** podglądy Vercel za Vercel Authentication i wyłącznie na danych demo; podglądy Pages wyłączone. | do zrobienia |
| D-15 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (z I-11: SCOPE 3.8) limity ponadnormatywności PL i SE — zebrane z podstawą prawną w [LIMITY_PONADNORMATYWNOSC.md](LIMITY_PONADNORMATYWNOSC.md) (zebrane 28.09), **do potwierdzenia z przewoźnikiem** | do zrobienia |
| D-34 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §0. Co przestaje obowiązywać | **ROZSTRZYGNIĘTE 01.10:** klucz Trafikverket w sekretach Edge + `.env.local` — II-6 LIVE (RoadCondition + WeatherMeasurepoint). Situation usunięty z Open API dostawcy | do zrobienia |
| B-1 | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Mapy: pojazdy tylko z prawdziwych pozycji GPS (brak pozycji = brak znacznika). Warstwy stref, portów, korytarza, promów i sytuacji drogowych zostają. Na produkcji brak danych przykładowych. | w kolejce (miejsce: **DO SCALENIA** — `fix/b-1`) |
| B-10 | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Podgląd zlecenia, edycja/awizacja, przepięcie, Status/Historia, dokumenty, ceny, ustalenia, lista KSH, rejsy Steny | w kolejce (miejsce: NIEZACZĘTE) |
| B-2a | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Ryzyka: brak wypłynięć Steny | w kolejce (miejsce: NIEZACZĘTE) |
| B-2b | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Ryzyka: brak widoczności warunków drogowych w SE. | zrobione (**DONE** — Situation schemat 1.6, namespace `road.trafficinfo` (1.5 bez przestrzeni nazw nie istnieje). Pusto = „Brak danych”.) |
| B-2c | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Centrum decyzji: jak działa i dlaczego puste — opisać logikę, nie zgadywać | w kolejce (miejsce: NIEZACZĘTE) |
| B-3a | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Dokumenty: zezwolenie per firma obok polisy; auto-podpięcie do trasy wg wymiarów; polisa auto do każdej trasy | w kolejce (miejsce: NIEZACZĘTE) |
| B-4a | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Finanse: przychód — pilotaż i dodatki mają zniknąć | w kolejce (miejsce: NIEZACZĘTE) |
| B-4b | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Załącznik: zostaje samo CMR (bez POD) | w kolejce (miejsce: NIEZACZĘTE) |
| B-5 | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Automatyzacje: brak przycisku nowej automatyzacji | w kolejce (miejsce: NIEZACZĘTE) |
| B-6a | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Opcje: logika i workflow „Powiadomienia i decyzje” | w kolejce (miejsce: NIEZACZĘTE) |
| B-6b | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Odbiorcy SMS i strefy: po co strefy i co robią | w kolejce (miejsce: NIEZACZĘTE) |
| B-6c | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Progi i terminy: jak działa mechanizm | w kolejce (miejsce: NIEZACZĘTE) |
| B-6d | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Stan systemu: styl dashboardu (teraz nieczytelne) | w kolejce (miejsce: NIEZACZĘTE) |
| B-6e | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Dziennik logowań nic nie pokazuje | w kolejce (miejsce: NIEZACZĘTE) |
| B-6f | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Historia zmian: „200” obok przycisku — usunąć z wyglądu, jeśli nie pełni roli | w kolejce (miejsce: NIEZACZĘTE) |
| B-6g | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Cennik: rozjazd tabeli w prawo | w kolejce (miejsce: NIEZACZĘTE) |
| B-6h | docs/handover/PLAN.md — Część B — NIEZACZĘTE | SEFS/BAF: czy średnia PL i SE z poprzedniego tygodnia uzupełnia indeksy i liczy opłatę | w kolejce (miejsce: NIEZACZĘTE) |
| B-6i | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Wymóg zezwoleń: rozjazd wizualny w prawo | w kolejce (miejsce: NIEZACZĘTE) |
| B-7a | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Mapa: stały rozmiar, całość widoczna przy otwarciu (nie wysokość tabeli) | w kolejce (miejsce: NIEZACZĘTE) |
| B-7b | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Checkboxy mapy zawsze widoczne; na telefonie nie nachodzą | w kolejce (miejsce: NIEZACZĘTE) |
| B-7c | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Filtry mapy i tabeli: znaczenie, logika, propozycja nowych | w kolejce (miejsce: NIEZACZĘTE) |
| B-8 | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Harmonogram: mapowanie pól, godziny, ciągnik, linie, szerokość kolumn, ETA, statusy, polisa, rok w datach, kierowca/telefon, PDF, filtr dat | w kolejce (miejsce: NIEZACZĘTE) |
| B-8-IMP | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Wydzielone z B-8 (D-8, decyzja A). Import: wiersz TYP = STANDARD (kolumna Typ albo „Standard” w wymiarach) jest pomijany, reszta wchodzi. | do zrobienia |
| B-9 | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Górny pasek filtrów: logika; usunąć cyfry w kafelku; propozycje ułatwień | w kolejce (miejsce: NIEZACZĘTE) |
| B-Q | docs/handover/PLAN.md — Część B — NIEZACZĘTE | Pytania o logikę 1–19 (powiadomienia, dzwonek, decyzje, statusy, alternatywy, faktury opłacone, Stena w pasku, bez EN/SV, tryb jasny, zegar, responsywność, kokpit, workflow 3 kont, logowanie, strefy, trasy OSM, statki, u… | w kolejce (miejsce: NIEZACZĘTE) |
| C-SEP | docs/handover/PLAN.md — Część C — NIEZACZĘTE (wygrywa z separatorami w B) | Separator „ / ” domyślnie. „\ | do zrobienia |
| D-LATER | docs/handover/PLAN.md — Część D — na później, nie zaczynać | API Stena + telematyka + SharePoint (notatki właściciela) | do zrobienia |
| I-0b | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | usunięcie poprzednich wdrożeń Pages przy najbliższym logowaniu | w kolejce (miejsce: DO ZROBIENIA (przy okazji)) |
| I-15 (stara, D-10) | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P1, decyzja D-10) przewoźnik widzi parametry SEFS tylko do odczytu, wyłącznie wersje `agreed_with_carrier = true` | usunięte (ZASTĄPIONA PRZEZ I-13 (właściciel 27.09: D-10 w I-13; ID I-15 przejęte przez pasmo ETA niżej)) |
| I-1b | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | klasa STANDARD dla 9 transportów | zrobione (DONE 0c247b3) |
| I-22 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P2, z I-11: SCOPE 3.2) kreator mapowania kolumn importu z zapisem szablonu w bazie (HHL) | zrobione (**DONE** 28.09 (0077)) |
| I-25 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P0, właściciel 28.09) cofnięcie reguły opóźnienia z 0070 (błąd w komunikacie koordynatora): opóźnienie od końca okna dostawy (`plan_delivery_to`, tylko od KSH), a bez okna — od końca dnia dostawy (Europe/Stockholm); imp… | zrobione (**DONE** 28.09 (0080)) |
| I-26 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P1, właściciel 28.09) anon ma INSERT/UPDATE/DELETE na ~20 tabelach `public` (m.in. | zrobione (**DONE** 28.09 (0083)) |
| I-27 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P1, właściciel 28.09, przed R-3) brak zezwolenia dla transportu o klasie innej niż STANDARD blokuje przejście do READY („Gotowy”) — przełącznik w tabeli parametrów; włącza właściciel przed pierwszym prawdziwym transport… | zrobione (**DONE** 28.09 (0084; przełącznik WYŁĄCZONY — włącza właściciel, D-21)) |
| I-28 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P2, właściciel 28.09) usunąć `load_delivery_day_end` — nieużywana, ignoruje okno dostawy (najpierw sprawdzić brak odwołań) | zrobione (**DONE** 28.09 (0085)) |
| I-BK | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | kopia zapasowa: tabele wyliczane z katalogu, jawne wykluczenia | zrobione (DONE d2a8219) |
| I-SEC | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | strażniki odporne na NULL (`is not true`), `is_hhl()`/`can_see_margin()` tylko true/false | zrobione (DONE 5d375f5) |
| SEC-OWASP | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności) | (P1) Na końcu, przed pilotażem. OWASP ASVS poziom 2: lista z wynikiem każdego punktu. | w kolejce (miejsce: NIEZACZĘTE) |
| I-0 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Etap I — wyciek plików (KSH_HARMONOGRAM.xlsx, 4 kopie makiety) i danych demo w pakiecie JS | zrobione (DONE) |
| I-1 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | import w produkcji zapisuje transporty | zrobione (DONE) |
| I-10 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | e-mail o zmianie daty awizowanego transportu | zrobione (DONE a0d21bc (SENT 21:20)) |
| I-11 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | każda pozycja SCOPE 0–11 inna niż DONE ma miejsce w tej kolejce albo w dzienniku odłożeń | zrobione (DONE (ten commit) — SCOPE §56.1: 65 pozycji → miejsce w PLAN albo dzienniku; nowe I-20…I-24, III-2…III-9, D-13…D-15) |
| I-12 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, D-8, blok właściciela 27.09) cennik — pozycja STANDARD: stała stawka, koszt i przychód osobno, ten sam mechanizm paliwa i kursu; `cargo_class = STANDARD` → pozycja STANDARD; brak stawki = wyraźne ostrzeżenie, nie ze… | zrobione (DONE a14a2ac — 0064; kwoty STANDARD czekają na D-1) |
| I-13 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, kolejność P1: 5.; obejmuje D-10) `sefs_parameters.applies_to` (COST / REVENUE / BOTH, domyślnie BOTH); RLS: przewoźnik COST+BOTH, KSH REVENUE+BOTH, HHL wszystko | zrobione (DONE 1d05ea4 — 0063; D-10 zrealizowane tutaj) |
| I-14 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P2) `baf_definitions` + `baf_index_values` (0 wierszy) obok `sefs_parameters`/`fuel_index_readings` = dwa źródła prawdy dopłaty paliwowej — wybrać jedno, drugie usunąć (tylko przy 0 wierszy na produkcji) albo opisać | zrobione (DONE (ten commit) — 0066: jedyne źródło = `sefs_parameters` (parametry) + `fuel_index_readings` (odczyty); `baf_definitions`, `baf_index_values` i `rate_cards.baf_id` usunięte (produkcja: 0/0/0 wierszy; strażnik przerywa migrację przy danyc…) |
| I-15 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, kolejność P1: 4.) pasmo ETA: odpoczynek dobowy 11 h jako osobny odcinek ±0%, przerwy 2 h ±50%; łączenie niepewności pierwiastkiem z sumy kwadratów zamiast sumy | zrobione (DONE bfbc974 — 0062; rejs założony 1013 → 433 min) |
| I-16 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, kolejność P1: 3.) walidacja ETA na 50 prawdziwych transportach: zapas w godzinach względem planu 5 dni (min, mediana, maks.) + rozbicie transportu testowego D-9 (planowany załadunek, planowana dostawa, rejs, ETA na… | zrobione (DONE 4e40ca5 — 30 / 54 / 55 h, 0 ujemnych) |
| I-17 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, kolejność P1: 1.) 2FA: drugie urządzenie uwierzytelniające w „Weryfikacja dwuetapowa” | zrobione (DONE 642d68f) |
| I-18 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, kolejność P1: 2.; D-12) status daty planu: WSTĘPNA \ | zrobione |
| I-19 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P1, właściciel 27.09 — luka z I-12) formularz cennika dla HHL w aplikacji: stawki koszt (przewoźnik) i przychód (KSH), przedziały wymiarów i pozycja STANDARD, wersjonowanie (nowa wersja zamiast nadpisania) z dziennikiem… | zrobione (DONE (ten commit) — 0065: rate_card_save (tylko HHL, nowa wersja per strona+organizacja, walidacja nakładania przedziałów, powód od v2), rate_card_change_log, tylko dopisywanie, RLS odczytu tylko HHL; Opcje → „Cennik HHL” (build produkcyjny…) |
| I-20 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P2, z I-11: SCOPE 2.6) ogólny dziennik audytu: wyzwalacz na tabelach biznesowych (loads, shipment_items, invoices, rate_*, sefs_*) — kto, kiedy, stara/nowa wartość | zrobione (DONE 28.09 (0072) — wyzwalacz `trg_audit_row` na 7 tabelach: ROW_INSERT/UPDATE/DELETE, kto, stara/nowa wartość tylko zmienionych kolumn; bez wpisu przy przeliczeniu ETA; dane osobowe kierowcy jako „[dane osobowe]”; odczyt tylko HHL_ADMIN) |
| I-21 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P2, z I-11: SCOPE 4.3) terminy uzupełnienia zasobów (kierowca, pojazd, dokumenty) przed załadunkiem i eskalacja (ryzyko + powiadomienie) | zrobione (DONE 28.09 (0073) — `resource_deadlines` (kierowca 48/12 h, pojazd 48/12 h, dokumenty 24/6 h — propozycja do potwierdzenia z SCX, II-3), `detect_resource_deadlines` co 15 min: RESOURCE_MISSING HIGH → CRITICAL, IN_APP przewoźnik (+ HHL przy…) |
| I-23 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P2, z I-11: SCOPE 9.8) test odsiewania duplikatów powiadomień (dedup_key) dla wszystkich szablonów | zrobione (DONE 28.09 — `tests/notify-dedup.test.ts` (każdy INSERT do notifications w bazie: dedup_key + on conflict do nothing; 8 szablonów z własnym tekstem PL/EN/SV) + i2 „[I-23]” (unikalny indeks, duplikat odrzucony)) |
| I-24 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P2, z I-11: SCOPE 10.8) eksport raportów do PDF (obok XLSX) | zrobione (DONE 28.09 — przycisk „Eksport PDF” obok XLSX w harmonogramie (`src/lib/pdfExport.ts`, pdf-lib + Liberation Sans OFL, ładowane leniwie); A4 poziomo, stronicowanie, bez danych kierowcy i kwot) |
| I-2a | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | przełącznik ról tylko dla HHL. Import harmonogramu też tylko HHL (2026-10-04 20:52 — wygrywa; KSH harmonogramu nie wgrywa). | zrobione (DONE 16638cb) |
| I-2c | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | moduł Workflows ukryty w produkcji | zrobione (DONE 16638cb; od 28.09 (9.4) w produkcji widoczny dla HHL_ADMIN na danych z bazy) |
| I-2d | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | ETA v1 w bazie: odcinek + czasy odcinków + rejs z `sailings`, przeliczana przy zdarzeniu | zrobione (DONE 16638cb (tests/db/i2.sh 51/51)) |
| I-2e | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | pogoda, przeprawy alternatywne, objazdy SE — ukryte albo „brak źródła danych" | zrobione (DONE a4ff639) |
| I-2f | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Opcje BAF — prawdziwy formularz parametrów SEFS i odczytów indeksu, ze źródłem, datą i dziennikiem | zrobione (DONE d912df7 (0052 na produkcji, weryfikacja w wycofanej transakcji)) |
| I-2g | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | kody opóźnień ukryte do uzgodnienia z przewoźnikiem | zrobione (DONE 16638cb) |
| I-2h | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | telefony demo: pula PTS (SE), nieprzydzielalne (PL, LT); SMS i e-mail nigdy w trybie demo | zrobione (DONE 16638cb) |
| I-2i | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | przegląd 37 pozycji „częściowo" — każda działająca tylko w demo trafia tu jako nowa pozycja I-2* | zrobione (DONE (POSTEP § I-2i)) |
| I-2j | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | pozycje promów z bazy (AIS z `ferry-ais`) na mapie zamiast pozycji przykładowych — z I-2i (5.10) | zrobione (DONE 5ed7dd0) |
| I-2k | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | paczka dokumentów „tydzień” — tylko dokumenty transportów z wybranego tygodnia ISO — z I-2i (6.8) | zrobione (DONE e4b393d) |
| I-2l | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | czas wykrycia odchylenia liczony z `risk_signals` (wykrycie − zdarzenie) zamiast „8 min” — z I-2i (10.7) | zrobione (DONE 825da20) |
| I-3 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | bramka SMS według `PROPOZYCJA_SMS.md` + decyzje z `ZLECENIE_ETAP_I.md` | zrobione |
| I-4 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | instrukcje: kierowca PL/EN/SV, KSH, przewoźnik | zrobione (DONE 3dac401) |
| I-5 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | 2FA TOTP, wymagane dla HHL_ADMIN (`aal2`) | zrobione (DONE a548eba (wymaganie wyłączone do D-11)) |
| I-6 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | monitoring błędów przeglądarki do własnej tabeli, alarm | zrobione (DONE 642d68f) |
| I-7 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | retencja: dane kierowcy 90 dni | zrobione (DONE 642d68f; dokumenty — decyzja D-3) |
| I-8 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | wydajność: cały harmonogram + GPS według PR5, trzy role | zrobione (DONE 642d68f) |
| I-9 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | `SCOPE.md` koordynatora w repo; Twoje statusy jako §53 | zrobione (DONE (ten commit) — SCOPE = plik koordynatora §0–55 bez zmian + §56 (statusy wykonawcy; §53–55 zajęte przez koordynatora)) |
| I-D9 | docs/handover/PLAN.md — ETAP I — przed pilotażem (w tej kolejności); docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | (P0, decyzja D-9) nowe wartości `eta_segment_params`: PL 7,5 h ±25%, check-in 3 h, SE 17 h ±20%, przerwy SE 13 h ±30%, przeprawa 18 h bez zmian; odpoczynek dobowy na promie | zrobione (DONE 8d69a40 (±747 → ±1013 min, opóźnienie 390 → 1080 min)) |
| II-1 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem | wartości SEFS i ich wprowadzenie | czeka na dane (na co: CZEKA NA: D-2) |
| II-2 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem | kody opóźnień uzgodnione — włączenie w interfejsie | czeka na dane (na co: CZEKA NA: spotkanie) |
| II-3 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem | parametry operacyjne: cutoff promu, progi fal, prędkość; potwierdzenie z SCX czasów odcinków D-9 (PL 7,5 h, check-in 3 h, SE 17 h — „szacunek koordynatora”) oraz najpóźniejszej godziny końca załadunku (model: 07:30 dla r… | czeka na dane (na co: CZEKA NA: spotkanie) |
| II-4 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem | adapter telematyki przewoźnika | czeka na dane (na co: CZEKA NA: spotkanie) |
| II-7a | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem | (P1, decyzja właściciela 28.09) **warunek włączenia II-7:** twardy limit w kodzie **25 000 transakcji HERE / miesiąc** — po limicie zero zapytań do końca miesiąca, ETA v1, ryzyko dla HHL + e-mail; alarm przy 80%; przelic… | do zrobienia |
| II-5 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem; docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników) | komunikaty armatora w harmonogramie | do zrobienia |
| II-6 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem; docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników) | Trafikverket, ~~TomTom~~ (zastąpiony przez HERE — II-7), KPD — zadania i klucze | do zrobienia |
| II-7 | docs/handover/PLAN.md — ETAP II — po spotkaniu z przewoźnikiem; docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników) | (decyzja właściciela 28.09 — zmiana) serwis tras = **HERE Routing API v8** zamiast TomTom: `transportMode=truck`, trasa przez punkty pośrednie z zezwolenia | do zrobienia |
| AUDIT-PROD | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | Zasada: blokują tylko luki wysokie i krytyczne w zależnościach produkcyjnych (`npm audit --omit=dev --audit-level=high`). Zależności deweloperskie to P3, sprawdzane w niedzielnej bramie. | do zrobienia |
| B-KSH | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | P2. Lista harmonogramu KSH: klik otwiera boczny panel tylko z „Edytuj”. KSH edytuje daty i godziny załadunku i rozładunku. | w kolejce (miejsce: NIEZACZĘTE) |
| B-REJSY | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | P2. Rejsy — część B zlecenia, sekcja REJSY, jako osobna pozycja. | w kolejce (miejsce: NIEZACZĘTE) |
| KOPIA-D | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | P3. Dograć kopię `usuniete_standard_2026-10-03` na `D:\Watch Tower\dane\`, gdy komputer domowy będzie włączony. | w kolejce (miejsce: NIEZACZĘTE — komputer Domowy był offline 03.10; kopia jest w R2) |
| Q-11a | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | P2. Pięć rozmiarów ekranu. | w kolejce (miejsce: NIEZACZĘTE) |
| Q-11b | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | P2. Powiadomienia na Android i iOS. | w kolejce (miejsce: NIEZACZĘTE) |
| Q-17 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | Pytanie 17. Trasy promów i drogi pokrywają się z OpenStreetMap. Trasa statku to trasa promu, nie ląd. | w kolejce (miejsce: NIEZACZĘTE — razem z H-6) |
| Q-18 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | Pytanie 18. Statki: tylko płynące do Szwecji, odświeżane bez przestojów. | w kolejce (miejsce: NIEZACZĘTE) |
| Q-19 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10) | Pytanie 19. Na mapie widać ulice i miejscowości, szczególnie w widoku Mapa. | w kolejce (miejsce: NIEZACZĘTE — razem z H-6) |
| L-1 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-1 · Automatyczne otwieranie decyzji · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-03 — domknięcie L-1, stop L-3 | P1. Automatyczne otwieranie decyzji. Każde ryzyko, które w tabeli DEC-CLICK (część B) ma typ decyzji, otwiera decyzję z katalogu 16 typów. | do zrobienia |
| L-10 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-10 · Opis trzech ścieżek pracy · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:52 (czas warszawski) — L-10 | P1. Opis trzech ścieżek pracy. Plik `docs/handover/WORKFLOW_FIRM.md`: trzy schematy krok po kroku (HHL, KSH, Scandinavian Express), od zaproszenia do zamknięcia transportu, prostym językiem, ze schematami Mermaid. | zrobione (**ZROBIONE** 2026-10-04 — `WORKFLOW_FIRM.md`.) |
| L-11 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-11 · Górny pasek bez numeru etapu · P1 | P1. Górny pasek bez numeru etapu. Usunąć numer etapu (1–9) z kafelków; liczba transportów zostaje. Źródło: B 9, decyzja właściciela 03.10. | w kolejce (miejsce: **W TEJ PACZCE** — z kafelka znika numer 1–9 (`.kb`). Zostaje liczba transportów (`.n`) i polska nazwa etapu. Klik nadal filtruje mapę.) |
| L-12 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-12 · Kreator stref z mapą · P1 | P1. Kreator stref z mapą, tylko HHL: ustawianie i przesuwanie środka na mapie, podgląd koła i zapasu, kraj, kogo powiadomić, usuwanie. | w kolejce (miejsce: **W TEJ PACZCE** — kreator na mapie, tylko HHL. Nowa strefa startuje w Śremie (PL), nie na 60°N 18°E. Kraj, odbiorcy, przesuwanie środka, podgląd koła i zapasu, usuwanie. SMS według kraju i rodzaju: test bazy `l12`.) |
| L-13 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-13 · Zalew powiadomień · P1 (po L-5); docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 15:57 (czas warszawski) — L-13 | P1, po L-5. Zalew powiadomień. Symulacja SIM-1 dała 155 powiadomień dla jednego transportu. Rozbicie według typu, odbiorcy i firmy; łączenie duplikatów. | w kolejce (miejsce: **W TEJ PACZCE** — 0148. Ten sam klucz zdarzenia bez zegara. Szacunek poczty przy 94 i przy 10 w ruchu. Skrót niekrytycznych (DIGEST, bez wysyłki). Strażnik 80/95/100. E-mail decyzji automatycznych NIE włączony.) |
| L-2 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-2 · Kto decyduje · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-03 — start L-2 | P1. Kto decyduje. Rozstrzygnąć decyzję może tylko firma wskazana w katalogu (kolumna „kto decyduje”) oraz administrator. Odmowa w bazie (funkcja), nie tylko ukryty przycisk. Źródło: B 2c; LOGIKA §1. | zrobione (**ZROBIONE** — migracja 0139. Przewoźnik rozstrzyga typ CARRIER, operacje HHL typ HHL, administrator HHL każdy typ. Inna firma i KSH dostają odmowę z `decision_resolve`.) |
| L-3 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-3 · Osiem progów podłączonych do alarmów · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 00:07 (czas warszawski) — wzory progów L-3, SG-01, potem L-1b | P1. Osiem progów podłączonych do alarmów: próg opóźnienia, wyprzedzenie dat KSH, awizacja ostrzeżenie/krytyczne, dokumenty ostrzeżenie/krytyczne, brak pozycji GPS, zjazd z trasy. | zrobione (**NA PRODUKCJI** — migracja 0143. Wzór A dla dostawy nadal bez alarmu (brak kolumny kierowcy dostarczającego, C-SEP). Reszta wzorów A (załadunek), B–F jest w 0143.) |
| L-4 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-4 · Cele kliknięć i link w e-mailu · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 14:48 (czas warszawski) — cele kliknięć, L-4 | P1. Cele kliknięć i link w e-mailu. | do zrobienia |
| L-5 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-5 · Dzwonek · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 15:47 (czas warszawski) — SMS_FALLBACK, WORKFLOW_ALERT, potem L-5 | P1. Dzwonek. Bez napisu „przeczytane”. Pozycja znika z listy po kliknięciu i prowadzi do celu z L-4. Źródło: pytanie 13. | zrobione (**ZROBIONE** — bez napisu „przeczytane”; klik oznacza pozycję i zdejmuje ją z listy; licznik to długość listy; cel z L-4.) |
| L-6 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-6 · „Ponów kopię" uruchamia kopię · P1 | P1. „Ponów kopię” uruchamia kopię zapasową (dziś tylko zapisuje prośbę, LOGIKA §1). | zrobione (**NA PRODUKCJI** — 0151 `l6_backup_retry`, wdrożenie `dpl_DzV56mBDm5K1vCrjuwoiBNL6rq55` (04.10.2026, `main` 419c5bb). Ten sam start co cron. Brak pg_net albo Vault zostawia ERROR na liście kopii.) |
| L-7 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-7 · Nazwy statusów „opóźniony" i „cichy" · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:15 (czas warszawski) — L-7 | P1. Nazwy statusów „opóźniony” i „cichy”. Na liście harmonogramu oba mają własną polską nazwę. Źródło: B 8, pytanie 4; LOGIKA §5. | zrobione (**NA PRODUKCJI** — PR #29, `main` 163ecf8, wdrożenie `dpl_EmxNgLKUy16bNEt25ZgD4J82BbWj`.) |
| L-8 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-8 · Kafelki kokpitu · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:22 (czas warszawski) — L-8 | P1. Kafelki kokpitu. Kafelek KSH „Wymaga decyzji” liczy tylko to, co KSH widzi. Kafelek przewoźnika pokazuje bieżący tydzień zamiast stałego „tydzień 38”. Źródło: pytanie 12; LOGIKA §11. | zrobione (**NA PRODUKCJI** — PR #30, `main` e9eb6ae, wdrożenie `dpl_3jRbftYi8YXHRyuH3ecNdc1NbVxu`.) |
| L-9 | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — L-9 · Alternatywy dla rejsu · P1; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:35 (czas warszawski) — L-9 | P1. Alternatywy dla rejsu. Na produkcji lista z prawdziwych rozkładów w bazie — najbliższe rejsy Polferries i Stena. Bez danych zmyślonych. Objazdy w Szwecji zostają ukryte. Źródło: pytanie 5; LOGIKA §9. | w kolejce (miejsce: **W TEJ PACZCE** — z `sailings`: do trzech najbliższych odejść do Szwecji, Polferries (Gdańsk–Nynäshamn) i Stena (Gdynia–Karlskrona). Pusty rozkład armatora = „Brak danych”. Objazdy SE zostają ukryte.) |
| L-1b | docs/handover/PLAN.md — Kolejka L i pozostałe polecenia koordynatora (03.10); docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 14:14 (czas warszawski) — L-1b i pozycja SG-01; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 14:40 (czas warszawski) — kolejka po L-1b | P1, zaraz po L-3. Siedem typów decyzji z katalogu (ZLECENIE_DECYZJE_POWIADOMIENIA.md §2, tabela DEC-CLICK), których wyzwalacze nie były w kodzie. | w kolejce (miejsce: **W TRAKCIE TEJ PACZKI** — 0144 usuwa jedną pozycję testową SG-01.) |
| I-32 | docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_CENNIK_SEFS.md — I-32 · P1 — OPŁATY DODATKOWE | I-32 · P1 — OPŁATY DODATKOWE | usunięte (ZASTĄPIONA PRZEZ OPL-8 (ręczne §8)) |
| II-10 | docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_SHAREPOINT.md — ZLECENIE — INTEGRACJA Z HARMONOGRAMEM KSH W SHAREPOINT (II-10); docs/handover/PACZKA_DECYZJI_30_09.md — II-10 — SHAREPOINT, NOWE, P1 | ZLECENIE — INTEGRACJA Z HARMONOGRAMEM KSH W SHAREPOINT (II-10) | usunięte (ZASTĄPIONA PRZEZ II-10-E1 / II-10-E2) |
| R-1 | docs/handover/PLAN.md — PILOTAŻ I WYDANIE | import prawdziwego harmonogramu na produkcję. Start produkcji = import ze SharePoint po D-SP (w planie już II-10-E1 i II-10-E2, bez drugiej kopii). Przed tym importem, i tylko po pisemnej akceptacji, czyszczenie z R-0. | do zrobienia |
| R-2 | docs/handover/PLAN.md — PILOTAŻ I WYDANIE | zaproszenie pracowników HHL, potem KSH, potem przewoźnika | do zrobienia |
| R-3 | docs/handover/PLAN.md — PILOTAŻ I WYDANIE | O3b — pierwszy prawdziwy transport od importu do faktury | czeka na dane (na co: CZEKA NA: R-2) |
| R-4 | docs/handover/PLAN.md — PILOTAŻ I WYDANIE | raport końcowy, tag `release-1.0` | czeka na dane (na co: CZEKA NA: R-3) |
| R-0 | docs/handover/PLAN.md — PILOTAŻ I WYDANIE; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:23 (czas warszawski) — kolejka, pytania 17–19, R-0 | Plan czyszczenia przed R-1. Tylko plan, do akceptacji. Kasowane wyłącznie transporty i wiersze związane kluczem obcym. Reszta zostaje. Wykonanie dopiero tuż przed R-1, po pisemnej akceptacji. Nic nie kasować wcześniej. | do zrobienia |
| ENV-0a | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | .gitattributes `* text=auto eol=lf` + renormalize | zrobione (DONE a2b38f18) |
| ENV-0b | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | vitest: CRLF / suma makiety / hunspell skip Windows | zrobione (DONE a2b38f18 (530 passed / 36 skip)) |
| ENV-0c | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | baza testowa watch-tower-test (emkbykwenwrjmbprydml) | zrobione (DONE 894a684e — pominięte w tej sesji) |
| ENV-0e | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | usuń VITE_TRAFIKVERKET_API_KEY — tylko TRAFIKVERKET_API_KEY | zrobione (DONE a2b38f18) |
| GATE-I30-I31 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | P0. EXPECTED i30=10, i31=6 w `test-db-gate.mjs` + subset — brama kończy kodem 0 | zrobione (**DONE** `b34a2236` (potwierdzenie exit 0: 02.10)) |
| GATE-WEEKLY | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | P1. Co niedzielę: brama TEST (`emkbykwenwrjmbprydml`) w częściach, nie jednym procesem. | do zrobienia |
| II-10-E1 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | P1. SharePoint etap 1: STEGRABODEN **tylko odczyt**; zapis testowy wyłącznie do `harmonogram_TEST_WatchTower.xlsx` (ID pliku na sztywno — inny plik = błąd). Tylko HH; NTG nie. Creds po D-32 → `.env.local` | w kolejce (miejsce: DO ZROBIENIA — **zastępuje** wcześniejszy wiersz II-10 do czasu E2) |
| II-10-E2 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | P1. SharePoint etap 2: zapis do pliku produkcyjnego — **tylko po pisemnej akceptacji właściciela** | czeka na dane (na co: CZEKA NA: akceptację właściciela po E1) |
| TELM-2 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | P1. Szkielet telematyki (§2) — czeka na API emtrack i linki | czeka na dane (na co: CZEKA NA: docs API emtrack, przykłady linków) |
| ZEZW-13 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora | P2. Zezwolenia (§13) | czeka na dane (na co: CZEKA NA: wymiary aut) |
| D-27 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-27 — KONTRAST: ZATWIERDZONY z warunkiem | P2. Kontrast ≥ 4,5:1; ewentualnie #7C909E | do zrobienia |
| D-30 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-30 — POLISY: TAK | P2. Polisy: cron + formularz HHL/przewoźnik (bazowa 0097 DONE) | zrobione |
| D-31 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-31 — PASEK GÓRNY PRZY 390 px: NAPRAW | P2. Pasek górny 390 px — naprawa | do zrobienia |
| D-29t | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/POSTEP.md — Akceptacja koordynatora (01.10 popołudnie) | P2. Tabela nakładania reguł START → **część ONE-MECH / D-29** (nie osobny tor) | do zrobienia |
| I-7a | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. KSH widzi na stałe pełne dane kierowcy i auta (SHAREPOINT §1a). **Bez** mechanizmu wycofania zgody | do zrobienia |
| I-30 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_CENNIK_SEFS.md — I-30 · P0 — CENNIK WEDŁUG SYMBOLI (zastępuje model z I-12 i I-19) | P0. Cennik według symboli (zastępuje I-12/I-19). Transkrypcja vs JSON — różnica=STOP. Kwoty skryptem z `D:\Watch Tower\dane` | do zrobienia |
| I-31 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_CENNIK_SEFS.md — I-31 · P0 — DOPŁATA PALIWOWA SEFS | P0. SEFS: OKQ8 + Orlen; mnożnik=niższy; tydzień 28.09–04.10 = **1,14** | zrobione (**DONE** (ten commit) — 0101; unit+db 1,14; load tabel TEST+PROD) |
| I-29 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_POGODA_DROGI_ETA.md — I-29 · P1 — BUDŻETY DARMOWYCH PLANÓW DLA 140 TRANSPORTÓW | P1. Budżety darmowych planów na 140 transportów | do zrobienia |
| II-7b | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_POGODA_DROGI_ETA.md — II-7b · P1 — KALIBRACJA AUTOMATYCZNA, UCZĄCA SIĘ (decyzja właściciela) | P1. Kalibracja ucząca się (zastępuje III-1) | do zrobienia |
| II-8 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_POGODA_DROGI_ETA.md — II-8 · P1 — POGODA MORSKA | P1. Pogoda FMI+DMI+SMHI; progi 3,8 m / 40 kn potwierdzone | do zrobienia |
| II-9 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/PLAN.md — ONE-MECH / D-29t — tabela nakładania (**zaakceptowana 01.10**, warunek zastępników); docs/handover/ZLECENIE_POGODA_DROGI_ETA.md — II-9 · P1 — OPÓŹNIENIE WYPŁYNIĘCIA Z POZYCJI PROMU | P1. Opóźnienie wypłynięcia z AIS; brak pozycji ≠ opóźnienie | do zrobienia |
| DEC-6 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Akceptacja koordynatora (01.10 popołudnie) | P1. Ustawienia administratora (DECYZJE §6) | zrobione (**DONE** — układ + **0107** progi + **0110** dziennik Auth + baner + eksport CSV/XLSX; stan systemu (kopie/integracje/bramka SMS)) |
| I-3-APK | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Akceptacja koordynatora (01.10 popołudnie); docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P0 (akceptacja 01.10). Aplikacja bramki Android: PULL `sms_pull`/`sms_report`/`sms_heartbeat`, APK + instrukcja instalacji; token parowania w Opcjach (nigdy w repo/logach); numer SIM w ustawieniach app; SMS test → właści… | zrobione |
| ADM-10 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Administrator może wszystko (§10) | zrobione |
| CLEAN-TT-HERE | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P2. Usunąć martwy kod/zmienne TomTom i HERE (TOMTOM_API_KEY, job traffic-flow TomTom, i18n źródła itd.). ETA = II-7 | do zrobienia |
| DATY-67 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Daty z pliku KSH + opóźnienie (§6–7); usunąć „Potwierdź daty" (I-18) | zrobione |
| FAK-9 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Faktury EUR lub PLN przy wystawieniu (§9) | do zrobienia |
| HIST-11 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Pełna historia zmian (§11) | zrobione |
| ONE-MECH | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Jeden przepływ: decyzje (§2) + ryzyka + reguły + powiadomienia (§3); zero podwójnych alarmów. Tabela D-29t **zaakceptowana 01.10** (warunek: żaden alarm bez zastępnika — lista było→jest w POSTEP) | do zrobienia |
| OPL-8 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Opłaty wyłącznie ręcznie (§8; zastępuje auto I-32) | zrobione |
| SMS-DELIV | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P0. Burst 10/10 DELIVERED → włączenie wyzwalaczy stref §5 | zrobione |
| STENA-3 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Stena Line Gdynia–Karlskrona jak Polferries (§3) | zrobione |
| UI-12 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | interfejs §12 | do zrobienia |
| AUTH-1 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P0. Logowanie hasłem (PO_SPOTKANIU §1): zaproszenie→ustaw hasło; e-mail+hasło; reset; strona pośrednia „Dalej”; bez zaproszenia zero e-maili | zrobione (DONE (ten commit, 0099) — live 20 kont przy R-2) |
| AWIZ-4 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P1. Awizacja „Dodaj"/„Edytuj" + okno (PO_SPOTKANIU §4) | zrobione (**DONE** (ten commit) — modal; Ustalenia bez formularza awizacji; rejsy „zdąży”; tracking→telematics_vehicle_id; zapis zwrotny KSH = II-10) |
| BRAND-15 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P1. Nazwa i logo Watch Tower (PO_SPOTKANIU §15, `public/brand`) | zrobione (**DONE** 57527034 — e-mail Auth (nadawca) = dashboard Supabase) |
| DEC-2 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P0. Centrum decyzji — pełny proces (DECYZJE §2) | zrobione (**DONE** (ten commit) — 0102/0103 + **0126** skutki opcji (`decision_apply_effect`); UI hint → szuflada) |
| DEC-3 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P0. Powiadomienia — każde zdarzenie/status/ryzyko/decyzja (DECYZJE §3) | zrobione (**DONE** (ten commit) — 0104 decyzje; **0126** status/ryzyko/strefy przez `matrix_notify`; **0127** mapowanie kind→grupa (RESOURCE_MISSING ≠ RISK_FERRY_WEATHER)) |
| DEC-4 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P0. Widoczność — admin wybiera firmy (DECYZJE §4) | zrobione (**DONE** (ten commit) — 0105 UI + egzekwowanie w `matrix_notify` (IN_APP/EMAIL × firma)) |
| DEC-5 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P1. SMS przy strefach — 2+2 osoby (DECYZJE §5); brak SMS do kierowców | zrobione (**DONE** (ten commit) — 0106; dec5 **11/11**; UI Opcje; bufor Śrem; wyzwalacze) |
| I-33 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P0. Kopia 29.09 zawieszona (RUNNING, finished_at puste). Przyczyna, ponowienie, strażnik RUNNING > 30 min → ERROR + e-mail. Sprawdź nocną | zrobione (DONE (ten commit, 0098)) |
| TEL-1 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33 | P1. Telefony zawsze bez kierunkowego (DECYZJE §1) | zrobione (**DONE** — `toNationalPhone` + awizacja + import + eksport + SMS (E.164 dopiero przy enqueue); **0111** `driver_phone_country`) |
| HHL-4a | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Numer HHL — dodawanie/edycja przez HHL (§4a) | do zrobienia |
| RESP-14 | docs/handover/PLAN.md — Potwierdzenie uzupełnienia (01.10) — od koordynatora; docs/handover/POSTEP.md — Sesja 30.09 (wieczór) — ENV + I-33; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | P1. Telefon i instalacja PWA (§14) | zrobione |
| DAILY-1 | docs/handover/PLAN.md — Przed pilotażem (P1, kolejność 02.10) — dopisane zleceniem właściciela; docs/handover/POSTEP.md — Przed pilotażem — kolejka (02.10) | Codzienny e-mail o 7:00 tylko do administratora — kopie, integracje, bramka SMS, błędy z ostatniej doby | zrobione (**DONE** — 0129+0130; okno 24 h OK; sms_failed=seria anulowana 01.10; Leaflet+lazyRetry) |
| DOC-ROLE | docs/handover/PLAN.md — Przed pilotażem (P1, kolejność 02.10) — dopisane zleceniem właściciela; docs/handover/POSTEP.md — Przed pilotażem — kolejka (02.10) | 1-stronicowe instrukcje dla KSH, przewoźnika i HHL (PL); także w aplikacji (panel „Instrukcja”) | zrobione (**DONE** — `docs/handover/instrukcje/{HHL,KSH,SCX}.md`; panel Guide (`i4_*`) w Opcjach/Ustawieniach) |
| DR-TEST | docs/handover/PLAN.md — Przed pilotażem (P1, kolejność 02.10) — dopisane zleceniem właściciela; docs/handover/POSTEP.md — Przed pilotażem — kolejka (02.10) | Odtworzenie ostatniej kopii z R2 na projekt TEST (`emkbykwenwrjmbprydml`). Klucz age tylko lokalnie na czas próby (nigdy repo/logi) | zrobione (**DONE** — 67 tabel / 4920 wierszy / 20 s (`restore_20261002`)) |
| LOAD-1 | docs/handover/PLAN.md — Przed pilotażem (P1, kolejność 02.10) — dopisane zleceniem właściciela; docs/handover/POSTEP.md — Przed pilotażem — kolejka (02.10) | Test obciążenia na TEST — 140 transportów, 20 jednoczesnych użytkowników (3 role); czasy kokpitu, harmonogramu, mapy | zrobione (**DONE** — seed 140/570 ms; kokpit p50 386 ms, harmonogram 319, mapa 88) |
| SIM-1 | docs/handover/PLAN.md — Przed pilotażem (P1, kolejność 02.10) — dopisane zleceniem właściciela; docs/handover/POSTEP.md — Przed pilotażem — kolejka (02.10) | Symulacja pełnego transportu na TEST — zmyślony GPS Śrem→Gdańsk→prom→Nynäshamn→Boden: statusy, ETA, decyzje, powiadomienia; SMS tylko na numer właściciela | zrobione (**DONE** — pełny tor → AT_SITE; SMS OWNER; e-mail BLOCKED_R2 (oczekiwane)) |
| H-0 | docs/handover/PLAN.md — Zlecenie HERE (04.10.2026) — kolejność z sekcji 5; docs/handover/ZLECENIE_HERE.md — H-0 · Test na koncie właściciela (najpierw, ok. 1 dzień); docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 18:52 (czas warszawski) — wdrożenie z main, wyjątki gitleaks, test e-mail, H-0 | Test na koncie właściciela, bez zmian w aplikacji. Odcinki Śrem → Gdańsk, Nynäshamn → Boden, Karlskrona → Boden. Raport do właściciela. | zrobione (DONE 2026-10-04 — uzupełnienie limitów, BK i propozycji H-4 w POSTEP. Kodu aplikacji nie ruszano.) |
| H-1 | docs/handover/PLAN.md — Zlecenie HERE (04.10.2026) — kolejność z sekcji 5; docs/handover/ZLECENIE_HERE.md — H-1 · Kontrola trasy | Kontrola trasy z wymiarów właściciela. Zbudować, zostawić wyłączone do D-83. | zrobione (**DONE** (ten commit) — flaga `H1_ROUTE_CHECK` wyłączona, bez crona, bez wymiarów przykładowych. „Wymaga zezwolenia” nie jest przeszkodą. Ryzyko tylko dla wiaduktu, mostu albo tunelu.) |
| H-2 | docs/handover/PLAN.md — Zlecenie HERE (04.10.2026) — kolejność z sekcji 5; docs/handover/ZLECENIE_HERE.md — H-2 · Utrudnienia drogowe w Polsce (i uzupełnienie Szwecji) | Utrudnienia PL/SE oraz B-2b: sytuacje Trafikverket (wypadki, zamknięcia, roboty). Nowe źródło API, panel „Warunki drogowe SE”, ROAD_SE z prawdziwych danych. Nie odkładać na H-4. | zrobione (**DONE** (B-2b, ten commit) — Situation 1.6 `road.trafficinfo`. Utrudnienia PL (HERE) zostają na później, nie w tym commicie.) |
| H-3 | docs/handover/PLAN.md — Zlecenie HERE (04.10.2026) — kolejność z sekcji 5; docs/handover/ZLECENIE_HERE.md — H-3 · Przeszkody wzdłuż korytarza | Przeszkody wzdłuż korytarza. | w kolejce (miejsce: NIEZACZĘTE — start od razu po H-2) |
| H-6 | docs/handover/PLAN.md — Zlecenie HERE (04.10.2026) — kolejność z sekcji 5; docs/handover/ZLECENIE_HERE.md — H-6 · Mapa przeszkód | Mapa przeszkód. Jedna praca z Q-17 i Q-19, bez dublowania. | w kolejce (miejsce: NIEZACZĘTE — Q-17 i Q-19 dopisane 04.10) |
| AN3 | docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | Aneks 3 — tekst w `ZLECENIE_FINAL.md` | zrobione (**DONE**) |
| PL-T | docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | Polskie znaki w napisach PL + test PL-T (hunspell pl_PL) + przebieg 840 (EN/SV = 0 zmian) | zrobione (DONE) |
| AN4 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Aneks 4 — tekst w `ZLECENIE_FINAL.md` | zrobione (**DONE**) |
| AN5 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Aneks 5 v2 — tekst w `ZLECENIE_FINAL.md` | zrobione (**DONE**) |
| F-KLUCZ | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Zadania cron → funkcje Edge dostawały 403 (klucz w env platformy ≠ klucz legacy w Vault) | zrobione (**DONE** (10 funkcji wdrożonych 26.09 ~15:49 PL)) |
| PR1 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Podtrzymanie: `keep_alive()` + `system_heartbeat`, Cloudflare Worker co 6 h, e-mail przy błędzie | czeka na dane (na co: DONE (Worker czeka na Cloudflare)) |
| PR2 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Kopie: `backup-export` 02:30 (CSV+gzip, age X25519, R2), `scripts/restore.sh`, test odtworzenia | czeka na dane (na co: DONE (Edge wdrożona; cron WYŁĄCZONY — czeka na R2)) |
| PR3 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Poczta: Resend jako SMTP Supabase Auth, domena zweryfikowana | zrobione (**DONE** (zamknięte przez właściciela 26.09.2026)) |
| PR4 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | `usage-check` codziennie: 70% → ryzyko, 85% → ryzyko wysokie + e-mail, historia | zrobione (**DONE** (wdrożone, cron włączony)) |
| PR5 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | GPS: 2 min w ruchu / 15 min na postoju, limit 60 s w `process_position()`, retencja 30 dni, pomiar bajtów | zrobione (DONE) |
| PR6 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | `driver_post_position(token, …)` w SQL (warunki 2.3, limit zapytań); zdjęcia przez Edge | zrobione (DONE (Edge driver-photo wdrożona)) |
| PR7 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Pliki: kompresja zdjęć w przeglądarce (1600 px, JPEG 0,75), PDF ≤ 10 MB, archiwizacja od 70% | czeka na dane (na co: **DONE** (archiwizacja: Edge przygotowana, czeka na R2)) |
| PR8 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Hosting: Vercel darmowy + zapas Cloudflare Pages, domena u właściciela, `PRZELACZENIE_HOSTINGU.md`, test przełączenia | do zrobienia |
| W1 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | spatial_ref_sys tylko do odczytu dla anon/authenticated (0031) | zrobione (**DONE** (produkcja 26.09 ~15:45 PL)) |
| W2 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Zdarzenia: lista dozwolonych typów dla ról API + CHECK + strefa z tabeli (0032) | zrobione (**DONE** (produkcja 26.09 ~15:47 PL)) |
| W3 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | load_messages.msgs_read + shipment_items.items_read wg transportu/projektu (0037) | zrobione (**DONE** (produkcja 26.09 ~16:40 PL)) |
| W4 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | Limity zasobników (0038) | zrobione (**DONE** (produkcja)) |
| M10 | docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Rejsy i automat statusów w aplikacji (po M6) | zrobione (DONE) |
| M11 | docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Rozbicie marży w Finansach (po M2) | zrobione (DONE) |
| M12 | docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Integracje danych zewnętrznych (po M10) | zrobione (DONE) |
| I-2A | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Etap I — systemowa poprawka strażników NULL (konto nieaktywne / bez `app_users` → `is_hhl()` = NULL, „if not …” nie odmawiał) | zrobione (**DONE** 27.09.2026) |
| I-2B | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Etap I — kopia zapasowa: tabele z katalogu zamiast listy na sztywno, kubełek `harmonogramy` | zrobione (**DONE** 27.09.2026) |
| I-2C | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Etap I — klasa ładunku STANDARD (9 transportów „Standard”: T-03…05, T-08…10, T-13…15) | zrobione (**DONE** 27.09.2026) |
| I-2b | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Etap I — baner i oś postępu kokpitu z bazy | zrobione (**DONE** 27.09.2026) |
| I-D9-a | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Analiza: czy opóźnienie 1080 min (ETA 01.10 18:00 PL) transportu wzorcowego D-9 jest wiarygodne | zrobione (**DONE** 27.09.2026) |
| III-1 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | raport kalibracji odcinków ETA | w kolejce (miejsce: **SZKIELET** 27.09 (ten commit)) |
| O-V2 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | wdrożenie Vercel `cdbb696` (I-4, I-6, I-7, I-8, I-17, I-18) | zrobione (**DONE** 27.09.2026) |
| O-V3 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | wdrożenie Vercel `a14a2ac` (I-16, I-15, I-13, I-12) | zrobione (**DONE** 27.09.2026) |
| O-V4 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | wdrożenie Vercel `04b1505` (I-19 formularz cennika, etykieta bramki SMS w ryzykach) | zrobione (**DONE** 27.09) |
| O-V5 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | wdrożenie Vercel `63ea178` (UI bramki SMS, „Wyślij link SMS-em”, opóźnienie od końca dnia dostawy) | zrobione (**DONE** 28.09) |
| O-V6 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | wdrożenie Vercel `db3d5e3` (Eksport PDF, teksty ryzyk zasobów I-21) | zrobione (**DONE** 28.09) |
| SEC-1 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | eksport XLSX i dane kierowcy per rola — **WYCIEK POTWIERDZONY I NAPRAWIONY** | zrobione (**DONE** 28.09 (ten commit)) |
| O-V | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | wdrożenie Vercel `5d43f5d` (I-2k + I-2l) | do zrobienia |
| AUTH-MAIL | docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | szablony e-mail Auth „Watch Tower” | do zrobienia |
| SMS-ZONE-ON | docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | włączenie stref po 10/10 | do zrobienia |
| L1 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Alternatywy trasy SE ×4 „Wybierz” mają mutować load/risk (dziś toast) | zrobione (**DONE**) |
| L16 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Force-majeure / opóźnienia — mechanizm ryzyk bez atrap (po SE road) | do zrobienia |
| L2 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Pill opóźnienia w drawerze z `delayMinutes`, nie stały napis | zrobione (**DONE**) |
| L4 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Terminy zadań z `plannedLoadDate` / danych load, nie `18+i*9` | zrobione (**DONE**) |
| L5 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Preferencje powiadomień w Opcjach: zapis **i** filtracja przy push | do zrobienia |
| L7 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Wskaźnik kompletności DRAWING z modelu, nie hardcode 100% | zrobione (**DONE**) |
| L8 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | Kolumna „Próbki” geofence z modelu, nie zawsze `2` | zrobione (**DONE**) |
| L9 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | JSONLogic / akcje workflow w runtime — realna semantyka, nie atrapa UI | do zrobienia |
| 0.1 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Arkusz stylów przeniesiony dosłownie z mockupu | zrobione |
| 0.10 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Tryb jasny, ciemny i honorowanie ustawienia systemu | do zrobienia |
| 0.3 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Test regresji wizualnej w CI, próg 0,1% | zrobione (GOTOWE 28.09 (wariant lokalny, jak III-3) — `npm run gate:visual` (840 ujęć, próg 0,1%): zielony przebieg `OK 840/840 kod 0` na `42a72c7` (15:33); w pre-push smoke 4 ujęć + 11 stanów) |
| 0.7 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Procedura dodania nowej klasy (3 warunki) | do zrobienia |
| 0.8 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Stany: spoczynek, najechanie, fokus, wciśnięty, zablokowany | zrobione |
| 0.9 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Stany: ładowanie, pusty, błąd, błąd walidacji | do zrobienia |
| 0.2 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Zrzuty wzorcowe: widok × rola × język × 5 szerokości × 2 tryby | zrobione (GOTOWE) |
| 0.4 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Konfiguracja blokująca wartości spoza systemu | zrobione (GOTOWE) |
| 0.5 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Zakaz Tailwinda i motywów bibliotek w komponentach | zrobione (GOTOWE) |
| 0.6 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | Katalog komponentów jako kontrakt nazw klas | zrobione (GOTOWE) |
| 1.1 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.1 Fundament | Repozytorium, CI, środowiska testowe i produkcyjne | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 1.4 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.1 Fundament | Logowanie bez hasła, dwuskładnikowe dla administratorów | do zrobienia |
| 1.5 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.1 Fundament | Wdrożenie na wskazanej domenie | do zrobienia |
| 1.6 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.1 Fundament | Podgląd wdrożeń zabezpieczony hasłem | do zrobienia |
| 1.7 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.1 Fundament | Monitoring błędów i logi | do zrobienia |
| 1.2 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.2.1 Fundament | Szkielet aplikacji, trasowanie, układ | zrobione (GOTOWE) |
| 1.3 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.2.1 Fundament | Trzy języki: polski, angielski, szwedzki | zrobione (GOTOWE) |
| 1.8 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.2.1 Fundament | Kopie zapasowe bazy i procedura odtworzenia | zrobione (GOTOWE) |
| 10.4 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.10 Pulpity | Widok placu budowy, tylko do odczytu | do zrobienia |
| 10.6 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.10 Pulpity | Ocena przewoźnika | zrobione |
| 10.7 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.10 Pulpity | Czas wykrycia odchylenia | do zrobienia |
| 10.8 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.10 Pulpity | Eksport do arkusza i pliku przenośnego | zrobione (GOTOWE (28.09)) |
| 10.9 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.10 Pulpity | Raport śladu węglowego | do zrobienia |
| 10.1 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | Pulpit spedytora | zrobione (GOTOWE) |
| 10.2 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | Pulpit klienta | zrobione (GOTOWE) |
| 10.3 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | Pulpit przewoźnika | zrobione (GOTOWE) |
| 10.5 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | Krzywa postępu dostaw | zrobione (GOTOWE) |
| 11.3 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | Testy ścieżek użytkownika | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 11.4 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | Testy regresji wizualnej | zrobione (GOTOWE 28.09 (wariant lokalny)) |
| 11.5 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | Dostępność: klawiatura, kontrast, czytniki ekranu | do zrobienia |
| 11.6 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | Wydajność przy pełnym zakresie projektu | do zrobienia |
| 11.8 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | Dokumentacja wdrożeniowa i instrukcja dla trzech stron | do zrobienia |
| 11.1 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.2.11 Jakość | Testy jednostkowe logiki: cennik, indeksacja, parser, strefy | zrobione (GOTOWE) |
| 11.2 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.2.11 Jakość | Testy integracyjne bazy i uprawnień | zrobione (GOTOWE) |
| 11.7 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.2.11 Jakość | Skróty klawiszowe z widocznymi podpowiedziami | zrobione (GOTOWE) |
| 12.1 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Mapa Leaflet z kafelkami zamiast schematu SVG | do zrobienia |
| 12.10 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Przeciągane karty sekcji na kokpicie | do zrobienia |
| 12.11 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Preferencje interfejsu per profil | do zrobienia |
| 12.12 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Tabela pojazdów w widoku Mapy z własnym zestawem kolumn | do zrobienia |
| 12.13 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Zbiór danych rozszerzony do 72 transportów i 28 ryzyk | do zrobienia |
| 12.14 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Kody przyczyn w kolejce ryzyk (siła wyższa, graniczne, pogoda) | do zrobienia |
| 12.2 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Ekran Opcje (administracja HHL) | do zrobienia |
| 12.3 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Cennik edytowalny z interfejsu, 3 linie wymiarowe | do zrobienia |
| 12.4 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | BAF/SEFS: indeks `SEFS_HYBRID_OKQ8_ORLEN`, SEK/l | do zrobienia |
| 12.5 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Moduł factoringu: oferta, zapis stawek, widoczność dla SCX | do zrobienia |
| 12.6 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Załączniki CMR/POD przy fakturze | do zrobienia |
| 12.7 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Panel „Warunki drogowe SE · E4" | do zrobienia |
| 12.8 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Dzwonek powiadomień z licznikiem | do zrobienia |
| 12.9 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | Zwijana nawigacja boczna | do zrobienia |
| 13.1 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Tailwind v4 w bundlu — zmienne `--tw-*`, klasy `.flex .grid .absolute .p-2` | do zrobienia |
| 13.10 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Dane zastępcze: „Driver 1", „+48 600 000 000", „PSE 1000" | do zrobienia |
| 13.11 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Ciągi debugowe w interfejsie: `permitFits=false`, `CANCELLED`, `E4 CLOSED` | do zrobienia |
| 13.12 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Telefon kierowcy w tabeli dla wszystkich ról, w tym klienta | do zrobienia |
| 13.13 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | `data-theme="dark"` zaszyte w `<html>` — ustawienie systemu ignorowane | do zrobienia |
| 13.14 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Udział paliwa = 0% — przy tym wzorze BAF zawsze wyjdzie zero | do zrobienia |
| 13.15 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Nowe wzorce wizualne poza katalogiem komponentów | do zrobienia |
| 13.16 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Bundle 2,0 MB JS | do zrobienia |
| 13.2 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Systemowy stack czcionek z preflight Tailwinda obok Barlow | do zrobienia |
| 13.3 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | `box-shadow` użyty 10×, `border-radius` > 2 px w 5 miejscach, `!important` 1× | do zrobienia |
| 13.4 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | `POST /api/trafikverket` zwraca 405 — endpoint niewdrożony | do zrobienia |
| 13.5 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Trzy sprzeczne stany rejsu 24.09 na jednym ekranie | do zrobienia |
| 13.6 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | KPI nie zgadza się z korytarzem (21+44 vs 21/39/5/7) | do zrobienia |
| 13.7 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Niespójne formatowanie kwot: „8739" obok „10 402,18" | do zrobienia |
| 13.8 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Godzina załadunku 02:00 w każdym wierszu — podejrzenie konwersji stref | do zrobienia |
| 13.9 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | Format daty odszedł od projektu: „30.09.2026, 02:00" zamiast „30.09 06:00" | do zrobienia |
| 14.1 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | **Brak repozytorium Git.** Kod żyje wyłącznie w `/workspace/watch-tower-app`, bez `.git`, bez remote | do zrobienia |
| 14.10 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Stawki w ekranie Opcje: nieustalone, czy prawdziwe czy demonstracyjne | do zrobienia |
| 14.11 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Konto Vercel: `sebastianbozekq-7781s`, projekt `watch-tower-makieta` | do zrobienia |
| 14.2 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | **Katalog `api/` nie istnieje** — potwierdzenie przyczyny 405 na `/api/trafikverket` | do zrobienia |
| 14.3 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | **Istnieją inne boty z wiedzą o projekcie:** WT — UX, Visual, Research, QA | do zrobienia |
| 14.4 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | **Dokumenty QA w `/workspace/watch-tower/qa-start/`** oraz pliki `*.md` w katalogu aplikacji | do zrobienia |
| 14.5 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Wizualne źródło prawdy: `/workspace/watch-tower/claude-v2.0/` | do zrobienia |
| 14.6 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Plik blokady wersji prawdopodobnie nie istnieje | do zrobienia |
| 14.7 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Brak CI, brak monitoringu, brak pomiarów wydajności, brak matrycy przeglądarek | do zrobienia |
| 14.8 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Brak mechanizmu zamrożenia zegara | do zrobienia |
| 14.9 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | Brak kluczy do integracji na żywo (Trafikverket, AIS i pozostałe) | do zrobienia |
| 15.1 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | `git init` w katalogu aplikacji | do zrobienia |
| 15.2 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | `.gitignore`: `node_modules`, `dist`, `.env*`, `.vercel` | do zrobienia |
| 15.3 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | Kopia makiety do `design/claude-v2.0/` (kopiować, nie przenosić) | do zrobienia |
| 15.4 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | Kopia dokumentów QA do `docs/qa-start/` | do zrobienia |
| 15.5 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | Commit bazowy + tag `baseline-2026-09-23` | do zrobienia |
| 15.6 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | Repozytorium zdalne, prywatne | do zrobienia |
| 15.7 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | Odtworzenie pliku blokady wersji, oznaczone jako odtworzone | do zrobienia |
| 16.1 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | Stegra **nie jest rolą** — to punkt zainteresowania i strefa | do zrobienia |
| 16.2 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | Motyw pierwszego malowania per rola: HHL i SCX ciemny, KSH jasny | do zrobienia |
| 16.3 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | ~~Import XLSX **tylko u KSH**, eksport **tylko u HHL**~~ **ZASTĄPIONA PRZEZ I-18** (właściciel 27.09: import u KSH zastąpiony potwierdzaniem dat przez KSH) | do zrobienia |
| 16.4 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | Ceny ukrywane **usunięciem z DOM per rola**, nie rozmyciem ani kropkami | do zrobienia |
| 16.5 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | Moduły M1–M12 i ścieżki E1–E4 (audyt, zezwolenia, faktoring HHL, ufność ETA) | do zrobienia |
| 16.6 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | Brama wizualna działa **na oko**, nie na różnicy pikseli | do zrobienia |
| 16.7 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | FINAL_SQUINT PASS 96/0/6, powłoka zamrożona | do zrobienia |
| 16.8 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | MMSI: Wawel 311852000, Nova Star 311000787 | do zrobienia |
| 17.1 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | **Import XLSX historycznie kasował tabelę (72→1)**. Naprawione pod P9 (łączenie 72→73), ale wrażliwe na dane wejściowe — regresja łatwa | do zrobienia |
| 17.10 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Dokumenty anti-slop nadal wskazują IBM Plex | do zrobienia |
| 17.11 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | `corridor_ref.geojson` obiecany, nigdy niewytworzony | do zrobienia |
| 17.12 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Trafikverket: wersja schematu 1.5 wobec 1.6, filtr obszaru — do weryfikacji | do zrobienia |
| 17.13 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Współrzędne terminali Gdańsk i Nynäshamn orientacyjne | do zrobienia |
| 17.14 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Parametry operacyjne niezebrane: cutoff promu, progi fal, prędkość planowana ponadgabarytu | do zrobienia |
| 17.15 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Dwa równoległe tory plików w `research-2026/` | do zrobienia |
| 17.16 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Dowody FINAL w `/tmp/` — efemeryczne | do zrobienia |
| 17.2 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | **Magazyn trwały bez wersjonowania i migracji** (v5→v6-ready-gate). Bez wyczyszczenia pamięci przeglądarki czyta fałszywy stan | do zrobienia |
| 17.3 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | **Trzy referencje wizualne na dysku**, dokumentacja UX wskazuje `claude-makieta.html`, koordynator `claude-v2.0/` | do zrobienia |
| 17.4 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | **Brak pełnego przebiegu 14 prób po P9** — tylko skupione sprawdzenia | do zrobienia |
| 17.5 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Skarbiec kierowcy w pamięci przeglądarki — limit przy zdjęciach | do zrobienia |
| 17.6 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Pozycja GPS jednorazowa, nie ciągła | do zrobienia |
| 17.7 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Martwy MapLibre w drzewie obok żywego Leaflet | do zrobienia |
| 17.8 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Brama wizualna „na oko" zamiast różnicy pikseli | do zrobienia |
| 17.9 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | Motyw per rola (akceptacja #12) wobec naprawy D16 | do zrobienia |
| 2.6 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | DO ZROBIENIA (częściowo) | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 2.7 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | Retencja danych osobowych | do zrobienia |
| 2.8 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | Umowy powierzenia między trzema stronami | do zrobienia |
| 2.5 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | Widoki rolowe | zrobione (GOTOWE) |
| 2.1 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | Schemat: organizacje, użytkownicy, role | zrobione (GOTOWE) |
| 2.2 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | Projekt, elementy, transporty (model dwupoziomowy) | zrobione (GOTOWE) |
| 2.3 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | Strumień zdarzeń, niezmienny | zrobione (GOTOWE) |
| 2.4 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | Rozdzielenie kosztu i przychodu na poziomie bazy | zrobione (GOTOWE) |
| 23.2 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | Scalenie PR #1 | do zrobienia |
| 23.3 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | Synchronizacja boxa, konflikt `package.json` | do zrobienia |
| 23.4 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | Decyzja o Git LFS dla 720 ujęć (próg 100 MB) | do zrobienia |
| 23.5 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | Wypchnięcie dorobku etapu C, tag `etap-c-2026-09-23` | do zrobienia |
| 23.6 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | Weryfikacja drzew box wobec zdalnego | do zrobienia |
| 26.2 | docs/handover/SCOPE.md — 26.1 Otwarte, blokujące bramę fali 1 | **CI nie działa** — runner Actions nie startuje z powodu rozliczeń | do zrobienia |
| 26.3 | docs/handover/SCOPE.md — 26.1 Otwarte, blokujące bramę fali 1 | **LFS w kroku pobierania kodu w CI** | do zrobienia |
| 26.4 | docs/handover/SCOPE.md — 26.1 Otwarte, blokujące bramę fali 1 | Potwierdzenie, że tag `etap-c-2026-09-23` wskazuje commit z drzewem `d305c245…`, a `71da774` jest po nim | do zrobienia |
| 28.2 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | **Kolizja numeracji w `NAPRAWY.md`** — dwa systemy D nakładają się; wychwycone przy D9 („D9-legacy" = JSONLogic). Ujednolicić: `D1–D26` z mojej listy, wcześniejsze z przedrostkiem `L`, tabela przekładu na górze pliku | do zrobienia |
| 28.3 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | **D9 zamknięte częściowo** — inspekcja zewnętrzna wykazała 10 cieni, 5 promieni > 2 px, 1 `!important`; zgłoszono 3 cienie i „część". | do zrobienia |
| 28.4 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | **D2 bez dowodu** — brak potwierdzenia zera `--tw-` i braku czcionek systemowych w zbudowanym arkuszu | do zrobienia |
| 28.5 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | **`unit.yml` z `lfs: true` niewypchnięty** — brak uprawnienia `workflow` w tokenie. Hak `pre-push` (`947da02`) pokrywa unit i Playwrighta, **nie pokrywa 720 ujęć** | do zrobienia |
| 3.10 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.3 Harmonogram | Integracja z SharePoint | do zrobienia |
| 3.2 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.3 Harmonogram | Kreator mapowania kolumn z zapisem szablonu | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 3.7 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.3 Harmonogram | Powiadomienie o zmianie daty na transporcie awizowanym | zrobione (GOTOWE) |
| 3.8 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.3 Harmonogram | Klasyfikacja ponadnormatywności per kraj | do zrobienia |
| 3.1 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | Wgrywanie pliku arkusza | zrobione (GOTOWE) |
| 3.3 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | Parser wymiarów, dat, godzin, telefonów | zrobione (GOTOWE) |
| 3.4 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | Walidacja blokująca, w tym przesunięte kolumny | zrobione (GOTOWE) |
| 3.5 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | Podgląd różnic przed zapisem | zrobione (GOTOWE) |
| 3.6 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | Wersjonowanie i archiwum pliku źródłowego | zrobione (GOTOWE) |
| 3.9 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | Kolejność montażowa i wykrywanie rozjazdu | zrobione (GOTOWE) |
| 32.1 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | Ścieżki dokumentów opisujących mechanizm | do zrobienia |
| 32.2 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | Tabela zgodności reguła–kod w `03_PARAMETRY_BIZNESOWE.md` | do zrobienia |
| 32.3 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | **Data pobrania mnożnika** — ta sama dla obu stron, migawka przy transporcie | do zrobienia |
| 32.4 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | Test niezmiennika: mnożnik kosztu = mnożnik przychodu, identyczny przyrost % stawki drogowej | do zrobienia |
| 32.5 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | Pola Opcje niezasilające `computeSefs` → D25 | do zrobienia |
| 33.1 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | Trzy wartości przy transporcie ze źródłem i migawką mnożnika | do zrobienia |
| 33.2 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | **„Faktura nadpisuje" nie może kasować wartości wyliczonej** | do zrobienia |
| 33.3 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | **Tydzień liczony w czasie lokalnym, nie w UTC** | do zrobienia |
| 33.4 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | Który odczyt indeksu obowiązuje w danej dacie — z dokumentacji | do zrobienia |
| 33.5 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | Testy: prognoza, realizacja, faktura, granica tygodnia lato/zima, przesunięcie planu | do zrobienia |
| 33.6 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | Propozycja: marża rozbita na zafakturowaną, zrealizowaną, prognozowaną w widoku Finanse | do zrobienia |
| 4.3 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | Terminy uzupełnienia i eskalacje | do zrobienia |
| 4.5 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | DO ZROBIENIA (częściowo) → **GOTOWE 28.09 (0087)** | zrobione |
| 4.1 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | Formularz zasobów dla przewoźnika | zrobione (GOTOWE) |
| 4.2 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | Awizacja jako okno czasowe | zrobione (GOTOWE) |
| 4.4 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | Wymiary zestawu odrębnie od wymiarów elementu | zrobione (GOTOWE) |
| 4.6 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | Rezerwacja promu | zrobione (GOTOWE) |
| 5.1 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Adapter telematyki: interfejs | do zrobienia |
| 5.10 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Mapa: warstwy, tryb skupienia, unikanie kolizji etykiet | zrobione |
| 5.12 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Przewidywany czas przyjazdu, model segmentowy | zrobione |
| 5.13 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Odtwarzanie przebiegu w czasie | zrobione |
| 5.2 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Adapter: standard producentów pojazdów | do zrobienia |
| 5.3 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Adapter: system przewoźnika | do zrobienia |
| 5.5 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Odbiór zdarzeń wypychanych i odpytywanie | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 5.11 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Wykrywanie cichego pojazdu | zrobione (GOTOWE) |
| 5.14 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Podmiana schematu mapy na warstwę kartograficzną | zrobione (GOTOWE) |
| 5.4 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Aplikacja dla kierowcy z tokenem | zrobione (GOTOWE) |
| 5.6 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Idempotentność przetwarzania pozycji | zrobione (GOTOWE) |
| 5.7 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Surowy odczyt nigdy nienadpisywany | zrobione (GOTOWE) |
| 5.8 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Geofencing: histereza, postój, tłumienie drgań | zrobione (GOTOWE) |
| 5.9 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | Edytor stref na mapie | zrobione (GOTOWE) |
| ETAP_I/I-0 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-0 wyciek | do zrobienia |
| ETAP_I/I-1 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-1 import | do zrobienia |
| ETAP_I/I-2 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-2 zero fasady | do zrobienia |
| ETAP_I/I-3 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-3 SMS | do zrobienia |
| ETAP_I/I-4 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-4 instrukcje | do zrobienia |
| ETAP_I/I-5 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-5 2FA | do zrobienia |
| ETAP_I/I-6 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-6 monitoring błędów | do zrobienia |
| ETAP_I/I-7 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-7 retencja | do zrobienia |
| ETAP_I/I-8 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-8 wydajność | do zrobienia |
| ETAP_I/I-9 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | I-9 synchronizacja rejestru | do zrobienia |
| 6.2 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | Wersjonowanie i widoczność per organizacja | do zrobienia |
| 6.4 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | Zezwolenia: pola, ważność, trasa, pilotaż | zrobione |
| 6.5 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | Walidator wymiarów zestawu wobec zezwolenia | do zrobienia |
| 6.6 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | Polisy z alertem wygaśnięcia | zrobione |
| 6.8 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | Pobieranie paczki per transport i per tydzień | do zrobienia |
| 6.9 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | Elektroniczny list przewozowy | do zrobienia |
| 6.3 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.2.6 Dokumenty | Odnośniki z krótkim czasem ważności | zrobione (GOTOWE) |
| 6.7 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.2.6 Dokumenty | Potwierdzenie dostawy i zdjęcia mocowania | zrobione (GOTOWE) |
| 7.1 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Macierz cennika, wersjonowana | do zrobienia |
| 7.10 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Ścieżka sporu i akceptacji | do zrobienia |
| 7.11 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Krajowy system e-faktur | do zrobienia |
| 7.3 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Indeksacja paliwowa, pełna parametryzacja | do zrobienia |
| 7.4 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Pobieranie notowań z zapisem źródła | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 7.5 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Kursy walut i konwencja | do zrobienia |
| 7.7 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | Dodatki: pilotaż, postojowe, prom, zezwolenia | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 7.2 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | Dopasowanie stawki; brak dopasowania nie daje zera | zrobione (GOTOWE) |
| 7.6 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | Marża, próg ostrzegawczy | zrobione (GOTOWE) |
| 7.8 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | Faktura zbiorcza, kreator dla przewoźnika | zrobione (GOTOWE) |
| 7.9 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | Dopasowanie trójstronne z rozbiciem różnic | zrobione (GOTOWE) |
| 8.1 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | Pogoda morska na trasie promowej | do zrobienia |
| 8.10 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | Kody przyczyn opóźnień | do zrobienia |
| 8.2 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | Odczyt komunikatów armatora | do zrobienia |
| 8.4 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | Panel alternatywnych przepraw z przeliczeniem | w kolejce (miejsce: DO ZROBIENIA (częściowo)) |
| 8.5 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | Zdarzenia drogowe w Szwecji | do zrobienia |
| 8.6 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | Zdarzenia drogowe w Polsce | do zrobienia |
| 8.3 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | Śledzenie jednostek | zrobione (GOTOWE) |
| 8.7 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | Ryzyka dokumentowe i zasobowe | zrobione (GOTOWE) |
| 8.8 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | Ryzyko kolejności montażowej | zrobione (GOTOWE) |
| 8.9 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | Kolejka wyjątków z wagą i czasem do skutku | zrobione (GOTOWE) |
| 9.1 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Silnik: wyzwalacz, warunek, akcje | zrobione (GOTOWE (28.09, 0094)) |
| 9.10 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Kalendarz do subskrypcji | do zrobienia |
| 9.2 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Wykonanie trwałe, z ponawianiem | zrobione (GOTOWE (28.09, 0094; zadanie cyklicznego wywołania — decyzja)) |
| 9.3 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Siedem reguł startowych | zrobione (GOTOWE (28.09, 0094: START-1…7 wyłączone)) |
| 9.4 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Kreator reguł dla administratora | zrobione (GOTOWE (28.09: widok na danych z bazy dla HHL_ADMIN — lista, włącz/wyłącz, kreator przez API; bez osobnego UI edycji — brak w makiecie)) |
| 9.6 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Wiadomości tekstowe | do zrobienia |
| 9.8 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Odsiewanie duplikatów | zrobione (GOTOWE (28.09)) |
| 9.9 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Kanał zespołowy | do zrobienia |
| 9.11 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Czat przy transporcie | zrobione (GOTOWE) |
| 9.5 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Poczta z szablonami w trzech językach | zrobione (GOTOWE) |
| 9.7 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | Powiadomienia w aplikacji | zrobione (GOTOWE) |
| 20.1 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D19 | do zrobienia |
| 20.10 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | narzędzie | do zrobienia |
| 20.2 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D20 | do zrobienia |
| 20.3 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | — | do zrobienia |
| 20.4 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D | do zrobienia |
| 20.5 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D21 | do zrobienia |
| 20.6 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | — | do zrobienia |
| 20.7 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D22 | do zrobienia |
| 20.8 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D23 | do zrobienia |
| 20.9 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | D24 | do zrobienia |
| DECPOW-§0 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §0. Co przestaje obowiązywać | §0. Co przestaje obowiązywać | do zrobienia |
| DECPOW-§1 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §1. TELEFONY — ZAWSZE BEZ KIERUNKOWEGO · P1 | §1. TELEFONY — ZAWSZE BEZ KIERUNKOWEGO · P1 | do zrobienia |
| DECPOW-§2 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §2. CENTRUM DECYZJI — PEŁNY PROCES · P0 | §2. CENTRUM DECYZJI — PEŁNY PROCES · P0 | do zrobienia |
| DECPOW-§3 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §3. POWIADOMIENIA — KAŻDE ZDARZENIE · P0 | §3. POWIADOMIENIA — KAŻDE ZDARZENIE · P0 | do zrobienia |
| DECPOW-§4 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §4. WIDOCZNOŚĆ — ADMINISTRATOR WYBIERA FIRMY · P0 | §4. WIDOCZNOŚĆ — ADMINISTRATOR WYBIERA FIRMY · P0 | do zrobienia |
| DECPOW-§5 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §5. SMS — 2 OSOBY NA ZAŁADUNKU, 2 NA ROZŁADUNKU · P1 | §5. SMS — 2 OSOBY NA ZAŁADUNKU, 2 NA ROZŁADUNKU · P1 | do zrobienia |
| DECPOW-§6 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §6. USTAWIENIA ADMINISTRATORA · P1 | §6. USTAWIENIA ADMINISTRATORA · P1 | do zrobienia |
| F2.4. | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA | F2.4. | do zrobienia |
| P0.1. | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA | P0.1. | do zrobienia |
| P0.1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 0 — przygotowanie | Zapisz zlecenie → `ZLECENIE_FINAL.md` | zrobione (**DONE**) |
| P0.2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 0 — przygotowanie | Rozpakuj pakiet final wg tabeli | zrobione (**DONE**) |
| P0.3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 0 — przygotowanie | Założ `POSTEP.md` rejestr 51 | zrobione (**DONE**) |
| F2.1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Ryzyka: 0 zmienionych ujęć — wyjaśnij/napraw | zrobione (**DONE**) |
| F2.2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Próg testu wizualnego (`maxDiffPixelRatio`) | zrobione (**DONE**) |
| F2.3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Stylelint zielony (nowy `.stylelintrc`) | zrobione (**DONE**) |
| F2.4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Weryfikacja mechanizmu paliwowego (bez kodu) | zrobione (**DONE**) |
| F2.5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Pozycje L1–L2/L4–L5/L7–L9/L16 — przydział | zrobione (**DONE**) |
| F2.6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Trzy wyjaśnienia (kokpit 54, mapa 18, TZ) | zrobione (**DONE**) |
| G1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | Brama etapu 1 | zrobione (**DONE**) |
| D10 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Jedna funkcja `formatMoney` | zrobione (**DONE**) |
| D11 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Debug/EN enumy out z UI | zrobione (**DONE**) |
| D12 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Dane startowe prawdopodobne | zrobione (**DONE**) |
| D13 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Wzorce wizualne / `section-card-hd--drag` | zrobione (**DONE**) |
| D17 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Format daty w tabeli bez powtarzanego roku | zrobione (**DONE**) |
| D18 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Oznaczenie danych demonstracyjnych | zrobione (**DONE**) |
| D19 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | 104 napisy → słownik PL/EN/SV | zrobione (**DONE**) |
| D19-T | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Test PL-znaków poza EN/SV UI | zrobione (**DONE**) |
| D25 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Atrapy/porzucone z fasady — decyzja | zrobione (**DONE**) |
| D6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Telefon kierowcy → szuflada; KSH ±24 h | zrobione (**DONE**) |
| G2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Brama etapu 2 + baseline Fala 3a | zrobione (**DONE**) |
| M1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Silnik money + testy (49 zielonych, 1 skip) | zrobione (**DONE**) |
| P6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Stawki demo PLN→EUR tabelą 186/A/NBP/2026 | zrobione (**DONE**) |
| BK0 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | STOP — dane dostępowe od właściciela | zrobione (**DONE**) |
| BK1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | Migracje + seed stegra + cron | zrobione (**DONE**) |
| BK2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | Auth (magic link) + 3 org | zrobione (**DONE**) |
| BK3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | `DemoProvider` / `SupabaseProvider` | zrobione (**DONE**) |
| BK4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | Storage plików (PDF/CMR/POD/zdjęcia) | zrobione (**DONE**) |
| BK5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | Test widoczności na poziomie API | zrobione (**DONE**) |
| BK6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | CI db/money/unit/pw | zrobione (**DONE**) |
| G3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | Brama etapu 3 | zrobione (**DONE**) |
| D23-S | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Import test na skali ~72 wierszy | zrobione (DONE) |
| D26 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Import — usunięcia za zgodą | zrobione (DONE) |
| G4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Brama etapu 4 + baseline Fala 3b | zrobione (**DONE**) |
| M2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Dane v2: EUR, poziomy, migawki | zrobione (**DONE**) |
| M3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Kurs NBP na żywo + `fx_rates` | zrobione (**DONE**) |
| M4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Ustawienia użytkownika (język/waluta/motyw) | zrobione (**DONE**) |
| M5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Numery zleceń KSH/HHL/SCX w harmonogramie | zrobione (**DONE**) |
| M6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Faktury — model 3 stron | zrobione (**DONE**) |
| M7 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Terminy i płatności + przypomnienia | zrobione (**DONE** (e-mail: krok właściciela W-M7-1)) |
| M8 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Niezmiennik / poziomy w wycenie | zrobione (DONE) |
| M9 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | Aplikacja kierowcy: watchPosition + zgoda | zrobione (DONE) |
| D14 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)** | Trasy adresowalne | zrobione (**DONE**) |
| D15 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)** | Podział paczki / lazy mapa &lt;400 kB | zrobione (**DONE**) |
| G5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)** | Brama etapu 5 | zrobione (**DONE**) |
| O1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Pełny komplet testów + D24 ×14 | zrobione (**DONE**) |
| O2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Deploy produkcyjny Vercel + Supabase | zrobione (**DONE** 27.09.2026 (zgoda właściciela)) |
| O3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Test dymny na produkcji | do zrobienia |
| O4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | Oznaczenie demo zostaje do potwierdzenia | zrobione (**DONE** (potwierdzenie właściciela: W-O4)) |
| O5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | `RAPORT_KONCOWY.md` + tag `release-1.0` | do zrobienia |
| D-EUR-T | docs/handover/ZLECENIE_FINAL.md — 6. ETAP 2 — FALA 3A: TREŚĆ, JĘZYK, FORMATY, SILNIK; docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | Test Playwright w **dwóch trybach**. Waluta EUR: zero `PLN`, `zł`, `SEK`, `kr`, `kronor`, `złotych` w interfejsie. | zrobione (**DONE**) |
| AN1 | docs/handover/ZLECENIE_FINAL.md — AN1 — ZASTOSUJ ANEKS (przed następną pozycją zlecenia); docs/handover/POSTEP.md — Aneksy | AN1 — ZASTOSUJ ANEKS (przed następną pozycją zlecenia) | zrobione (**DONE**) |
| AN2 | docs/handover/ZLECENIE_FINAL.md — AN2 — ZASTOSUJ ANEKS; docs/handover/POSTEP.md — Aneksy | AN2 — ZASTOSUJ ANEKS | zrobione (**DONE**) |
| T1 | docs/handover/ZLECENIE_FINAL.md — T1 — WYSOKA: baza tworzy ryzyka po polsku | T1 — WYSOKA: baza tworzy ryzyka po polsku | do zrobienia |
| T2 | docs/handover/ZLECENIE_FINAL.md — T2 — ŚREDNIA: napisy wpisane na sztywno, których nie ma w słowniku | T2 — ŚREDNIA: napisy wpisane na sztywno, których nie ma w słowniku | do zrobienia |
| T3 | docs/handover/ZLECENIE_FINAL.md — T3 — NISKA: format liczb według języka | T3 — NISKA: format liczb według języka | do zrobienia |
| D-77 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | HERE wchodzi do systemu. Zastępuje zapis „bez HERE" z D-28. Własny silnik zostaje jako zapas, gdy HERE jest niedostępne albo budżet wyczerpany. | do zrobienia |
| D-78 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | Budżet HERE: **do 100 USD miesięcznie**. Ostrzeżenia w Stanie systemu przy 50%, 80% i 100%. Po przekroczeniu 100% system przestaje odpytywać HERE i przechodzi na darmowe wyliczenia — **nigdy nie płaci ponad budżet**. | do zrobienia |
| D-79 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | **Zero aplikacji dla kierowców** — decyzja Scandinavian Express. HERE WeGo Pro i pakiet nawigacyjny HERE SDK są wykluczone. Nic nie jest instalowane u przewoźnika ani kierowców. | do zrobienia |
| D-80 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | ETA nadal **wyłącznie z pozycji GPS i AIS** (decyzja z 04.10). HERE liczy czas przejazdu **z bieżącej pozycji** — nigdy z planu. | do zrobienia |
| D-81 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | Licencja HERE: wyniki przechowujemy **najwyżej 30 dni**. | do zrobienia |
| D-82 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | Opłaty drogowe (myto) — **poza zakresem**. Nie liczymy i nie pokazujemy. | do zrobienia |
| D-83 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | Wymiary zestawów **dla każdego transportu** poda właściciel na etapie budowy aplikacji — Watch Tower będzie je mieć. | do zrobienia |
| D-84 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | Próg wiatru **zatwierdzony: porywy 15 m/s**. Silny wiatr na trasie **wydłuża ETA** — zgodnie z logiką i faktami (sekcja H-10). | do zrobienia |
| D-85 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji); docs/handover/POLECENIA_KOORDYNATORA.md — Decyzja D-85 (2026-10-04) — ETA w pełni automatyczne; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:10 (czas warszawski) — D-85, droga SE | ETA **w pełni automatyczne**: zero ręcznego wpisu, także prędkości. | do zrobienia |
| H-10 | docs/handover/ZLECENIE_HERE.md — H-10 · Pogoda i wiatr na trasie | H-10 · Pogoda i wiatr na trasie | do zrobienia |
| H-12 | docs/handover/ZLECENIE_HERE.md — H-12 · Zakazy czasowe | H-12 · Zakazy czasowe | do zrobienia |
| H-7 | docs/handover/ZLECENIE_HERE.md — H-7 · Mapa w e-mailach i w eksporcie PDF | H-7 · Mapa w e-mailach i w eksporcie PDF | do zrobienia |
| H-8 | docs/handover/ZLECENIE_HERE.md — H-8 · Profil trasy | H-8 · Profil trasy | do zrobienia |
| POPRAWKI-A1 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ A | PRZEJĘCIE (bez zmian w kodzie): | do zrobienia |
| POPRAWKI-A2 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ A | ZASADY PRACY: | do zrobienia |
| POPRAWKI-B-1 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jaka logika powiadomień w pasku i banerze | do zrobienia |
| POPRAWKI-B-10 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | HARMONOGRAM -> PODGLĄD ZLECENIA | do zrobienia |
| POPRAWKI-B-10a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Usuwamy: Zlecenie, Śrem z nadawcy z górnego paska. | do zrobienia |
| POPRAWKI-B-10b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Edycja + dodawanie + mechanizm dodawania i przepięcia: | do zrobienia |
| POPRAWKI-B-10c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Przebieg — robimy kopię i dajemy ją na ostatniej zakładce po prawej stronie jako "Historia": | do zrobienia |
| POPRAWKI-B-10d | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | "Przebieg" -> zmiana nazwy na "Status": | do zrobienia |
| POPRAWKI-B-10e | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Dokumenty: | do zrobienia |
| POPRAWKI-B-10f | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Ceny — muszą wyglądać jak w makiecie w cursor; bez POD: | do zrobienia |
| POPRAWKI-B-10g | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Ustalenia: | do zrobienia |
| POPRAWKI-B-11 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | praca na wersji komputerowej i responsywności + powiadomienia | do zrobienia |
| POPRAWKI-B-12 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | każdy kafelek kokpitu: jaka logika i gdzie prowadzi kliknięcie | do zrobienia |
| POPRAWKI-B-13 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | dzwonek: usunąć napis przeczytane, mają znikać po kliknięciu; | do zrobienia |
| POPRAWKI-B-14 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jaka logika i workflow całej aplikacji per konto — czyli łącznie | do zrobienia |
| POPRAWKI-B-15 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | logowanie i odświeżanie danych (grafika z napisami, która się pojawia (logo i napisy, które znajdują się pod logiem— wszystko wyśrodkowane, | do zrobienia |
| POPRAWKI-B-16 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jak budować strefy i nimi zarządzać | do zrobienia |
| POPRAWKI-B-17 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | trasy promów i trasy drogowe muszą idealnie pokrywać się | do zrobienia |
| POPRAWKI-B-18 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | statki: pokazywać tylko te płynące do Szwecji i cały czas odświeżać. Nie może być przestojów | do zrobienia |
| POPRAWKI-B-19 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | na mapie mają być widzoczne ulice i miejscowości - szczególnie w MAPA | do zrobienia |
| POPRAWKI-B-2 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jaka logika w dzwonku | do zrobienia |
| POPRAWKI-B-2a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | brak wypłynięć Steny | do zrobienia |
| POPRAWKI-B-2b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | brak widoczności warunków drogowych w SE | zrobione |
| POPRAWKI-B-2c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Centrum decyzji — jak działa i dlaczego nic nie ma? Jaka jest logika? | do zrobienia |
| POPRAWKI-B-3 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jaka logika w "Wymaga decyzji" + Centrum decyzji | do zrobienia |
| POPRAWKI-B-3a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | brak możliwości dodania zezwolenia per firma obok polisy - zezwolenie to po określeniu wymiarów aut i podaniu przeze mnie do jakiego ładunku będzie potrzebne zezwolenie per trasa, będzie miało automatycznie podpinać się… | do zrobienia |
| POPRAWKI-B-4 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jaka logika + jakie statusy | do zrobienia |
| POPRAWKI-B-4a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Przychód — pilotaż i dodatki muszą zniknąć. | do zrobienia |
| POPRAWKI-B-4b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Załącznik CMR/POD — zostaje samo CMR | do zrobienia |
| POPRAWKI-B-5 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jaka logika i zasady w "Alternatywach dla rejsu" i "na drodze" | do zrobienia |
| POPRAWKI-B-6 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | jak oznaczać opłacone faktury kosztowe i przychodowe — tylko dla HHL | do zrobienia |
| POPRAWKI-B-6a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Jak działa -> Powiadomienia i decyzje + rozwinięcie. Jaka jest logika i work flow. | do zrobienia |
| POPRAWKI-B-6b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Odbiorcy SMS i strefy — po co są strefy i co robią | do zrobienia |
| POPRAWKI-B-6c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Progi i terminy — jak działa mechanizm | do zrobienia |
| POPRAWKI-B-6d | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Stan systemu -> zmiana na styl dashboardu (obecnie nieczytelne) | do zrobienia |
| POPRAWKI-B-6e | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Dziennik logowań — nic nie pokazuje | do zrobienia |
| POPRAWKI-B-6f | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Historia zmian — po co jest "200" obok przycisku (jeżeli nie pełni żadnej ważnej kwesti to usuwamy z wyglądu strony). | do zrobienia |
| POPRAWKI-B-6g | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Cennik — rozjazd tabeli cenowej w prawo - presunięte bardzo mocno w prawo. | do zrobienia |
| POPRAWKI-B-6h | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | SEFS/BAF — czy mechanizm automatycznie liczy średnią cenę dla PL i SE | do zrobienia |
| POPRAWKI-B-6i | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | Wymóg zezwoleń — rozjazd wizualny w prawo. | do zrobienia |
| POPRAWKI-B-7 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | w górnym pasku dodać najbliższe wypłynięcia Steny, obok Polferries | do zrobienia |
| POPRAWKI-B-7a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | musi mieć stały rozmiar, a nie dopasowany do wysokości tabeli po prawej. Musi być widoczna w całości, gdy uzytkwonik otwiera MAPA. | do zrobienia |
| POPRAWKI-B-7b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | checkboxy po lewej stronie zawsze widoczne; na telefonie są na wierzchu i wchodzą na inne elementy | do zrobienia |
| POPRAWKI-B-7c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | kwestia filtrów w mapie i w tabeli - co oznaczają, jaka jest ich logika i jaka jest sugestia dodania nowych (logicznie i z korzyścią dla użytkownika. | do zrobienia |
| POPRAWKI-B-8 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | bez języka szwedzkiego i angielskiego — usunąć wybór języka | do zrobienia |
| POPRAWKI-B-8a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | złe zmapowanie pól | do zrobienia |
| POPRAWKI-B-9 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | [P8] tryb jasny | do zrobienia |
| POPRAWKI-Q-1 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jaka logika powiadomień w pasku i banerze | do zrobienia |
| POPRAWKI-Q-10 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | usunąć zegar z prawego górnego rogu | do zrobienia |
| POPRAWKI-Q-11 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | praca na wersji komputerowej i responsywności + powiadomienia | do zrobienia |
| POPRAWKI-Q-12 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | każdy kafelek kokpitu: jaka logika i gdzie prowadzi kliknięcie | do zrobienia |
| POPRAWKI-Q-13 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | dzwonek: usunąć napis przeczytane, mają znikać po kliknięciu; | do zrobienia |
| POPRAWKI-Q-14 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jaka logika i workflow całej aplikacji per konto — czyli łącznie | do zrobienia |
| POPRAWKI-Q-15 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | logowanie i odświeżanie danych (grafika z napisami, która się pojawia (logo i napisy, które znajdują się pod logiem— wszystko wyśrodkowane, | do zrobienia |
| POPRAWKI-Q-16 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jak budować strefy i nimi zarządzać | do zrobienia |
| POPRAWKI-Q-17 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | trasy promów i trasy drogowe muszą idealnie pokrywać się | do zrobienia |
| POPRAWKI-Q-18 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | statki: pokazywać tylko te płynące do Szwecji i cały czas odświeżać. Nie może być przestojów | do zrobienia |
| POPRAWKI-Q-19 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | na mapie mają być widzoczne ulice i miejscowości - szczególnie w MAPA | do zrobienia |
| POPRAWKI-Q-2 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jaka logika w dzwonku | do zrobienia |
| POPRAWKI-Q-3 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jaka logika w "Wymaga decyzji" + Centrum decyzji | do zrobienia |
| POPRAWKI-Q-4 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jaka logika + jakie statusy | do zrobienia |
| POPRAWKI-Q-5 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jaka logika i zasady w "Alternatywach dla rejsu" i "na drodze" | do zrobienia |
| POPRAWKI-Q-6 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | jak oznaczać opłacone faktury kosztowe i przychodowe — tylko dla HHL | do zrobienia |
| POPRAWKI-Q-7 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | w górnym pasku dodać najbliższe wypłynięcia Steny, obok Polferries | do zrobienia |
| POPRAWKI-Q-8 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | bez języka szwedzkiego i angielskiego — usunąć wybór języka | do zrobienia |
| POPRAWKI-Q-9 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | [P8] tryb jasny | do zrobienia |
| POPRAWKI-D | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ D | API Stena + telematyka + SharePoint (słowa właściciela z notatek). | do zrobienia |
| SCX-§0 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §0. Co przestaje obowiązywać | §0. Co przestaje obowiązywać | do zrobienia |
| SCX-§1 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §1. LOGOWANIE HASŁEM · P0 | §1. LOGOWANIE HASŁEM · P0 | do zrobienia |
| SCX-§10 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §10. ADMINISTRATOR MOŻE WSZYSTKO · P1 | §10. ADMINISTRATOR MOŻE WSZYSTKO · P1 | do zrobienia |
| SCX-§11 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §11. PEŁNA HISTORIA ZMIAN · P1 | §11. PEŁNA HISTORIA ZMIAN · P1 | do zrobienia |
| SCX-§12 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §12. INTERFEJS · P2 | §12. INTERFEJS · P2 | do zrobienia |
| SCX-§13 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §13. ZEZWOLENIA · P2 (czeka na dane) | §13. ZEZWOLENIA · P2 (czeka na dane) | czeka na dane (na co: czeka na dane) |
| SCX-§14 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §14. PEŁNA RESPONSYWNOŚĆ I INSTALACJA NA TELEFONIE · P1 | §14. PEŁNA RESPONSYWNOŚĆ I INSTALACJA NA TELEFONIE · P1 | do zrobienia |
| SCX-§15 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §15. NAZWA I LOGO „WATCH TOWER" · P1 | §15. NAZWA I LOGO „WATCH TOWER" · P1 | do zrobienia |
| SCX-§2 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §2. TELEMATYKA · P1 (czeka na dane) | §2. TELEMATYKA · P1 (czeka na dane) | czeka na dane (na co: czeka na dane) |
| SCX-§3 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §3. STENA LINE GDYNIA – KARLSKRONA · P1 | §3. STENA LINE GDYNIA – KARLSKRONA · P1 | do zrobienia |
| SCX-§4 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §4. AWIZACJA — PRZYCISK „DODAJ" / „EDYTUJ" I OKNO · P1 | §4. AWIZACJA — PRZYCISK „DODAJ" / „EDYTUJ" I OKNO · P1 | do zrobienia |
| SCX-§4a | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §4a. NUMER ZLECENIA HHL — DODAWANIE I EDYCJA PRZEZ HHL · P1 | §4a. NUMER ZLECENIA HHL — DODAWANIE I EDYCJA PRZEZ HHL · P1 | do zrobienia |
| SCX-§5 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §5. POWIADOMIENIA I SMS DLA KSH · P1 | §5. POWIADOMIENIA I SMS DLA KSH · P1 | do zrobienia |
| SCX-§6 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §6. OPÓŹNIENIE I CZAS PRZEJAZDU · P1 | §6. OPÓŹNIENIE I CZAS PRZEJAZDU · P1 | do zrobienia |
| SCX-§7 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §7. DATY Z PLIKU KSH · P1 | §7. DATY Z PLIKU KSH · P1 | do zrobienia |
| SCX-§8 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §8. OPŁATY DODATKOWE — WYŁĄCZNIE RĘCZNIE · P1 (zastępuje I-32) | §8. OPŁATY DODATKOWE — WYŁĄCZNIE RĘCZNIE · P1 (zastępuje I-32) | do zrobienia |
| SCX-§9 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §9. FAKTURY · P1 | §9. FAKTURY · P1 | do zrobienia |

## 3. SPRZECZNOŚCI

Bez rozstrzygania. Wpis tylko tam, gdzie cytaty się wykluczają.

Cytat z tego samego pliku, bez wyboru zwycięzcy: `SCOPE.md` przy §56 — „Statusy aktualne po etapie I — tabela 56.1 (ona obowiązuje, gdy różni się od 56.2)." Wiersze 56.1 wobec 56.2 zostają w tej liście, bo teksty statusu się różnią.

| ID | Plik A | Sekcja A | Cytat A | Plik B | Sekcja B | Cytat B |
|---|---|---|---|---|---|---|
| D-8 | docs/handover/wzorzec/03_REJESTR_DECYZJI.md | Decyzje numerowane | 🔁 nieaktualne — „Standard" to transporty NTG | docs/handover/PACZKA_DECYZJI_30_09.md | D-1, D-2 — CENNIK I SEFS: PRZEKAZANE | D-8 zamknięte: „Standard" = tężniki T, bez osobnej stawki |
| D-28 | docs/handover/wzorzec/03_REJESTR_DECYZJI.md | Decyzje numerowane | 🔁 TomTom → HERE → **własny silnik + kalibracja ucząca się** 🔁 04.10.2026 — zapis „bez HERE" zastąpiony przez D-77 | docs/handover/PACZKA_DECYZJI_30_09.md | D-28 — DECYZJA KOŃCOWA: WŁASNY SILNIK + KALIBRACJA UCZĄCA SIĘ | HERE — nie. Trasa jest stała i wyznaczona w zezwoleniu, więc serwis tras nie jest potrzebny. |
| D-28 | docs/handover/PLAN.md | §4 Decyzje oczekujące | D-28 \| **ROZSTRZYGNIĘTE 30.09: HERE — nie**. II-7 DONE (0122, OSM). II-7b szkielet 0123; nauka CZEKA NA TELM-2 | docs/handover/wzorzec/03_REJESTR_DECYZJI.md | Decyzje HERE (04.10.2026) | HERE wchodzi do systemu. Zastępuje zapis „bez HERE" z D-28. Własny silnik zostaje jako zapas, gdy HERE jest niedostępne albo budżet wyczerpany. |
| D-34 | docs/handover/wzorzec/03_REJESTR_DECYZJI.md | Decyzje numerowane | tydzień dopłaty paliwowej — **według mechanizmu BAF — data załadunku** | docs/handover/PLAN.md | §4 Decyzje oczekujące | D-34 \| **ROZSTRZYGNIĘTE 01.10:** klucz Trafikverket w sekretach Edge + `.env.local` — II-6 LIVE (RoadCondition + WeatherMeasurepoint). |
| II-7 | docs/handover/PLAN.md | Potwierdzenie uzupełnienia (01.10) — od koordynatora | **DONE** (ten commit) — **0122** PROD+TEST; `corridor_polylines` + `compute_load_eta` v2 (OSM locate, SE×II-6, rejs GDN-NYN/GDY-KAA, odpoczynek I-15); ryzyko OFF_CORRIDOR + ETA_BREACH; UI attribution ODbL | docs/handover/PLAN.md | ETAP II — po spotkaniu z przewoźnikiem | **ZABLOKOWANE przez D-28** (regulamin HERE — `RAPORT_HERE_REGULAMIN.md`); nic z HERE nie implementujemy |
| 0.1 | docs/handover/SCOPE.md | 56.2.0 Wierność wizualna | DONE 28.09 (III-2: `tests/stylesheet-mockup.test.ts` — suma kontrolna arkusza makiety + porównanie każdej deklaracji, 13 odstępstw z uzasadnieniem) | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DO ZROBIENIA (częściowo) |
| 0.7 | docs/handover/SCOPE.md | 56.2.0 Wierność wizualna | DONE 28.09 (DESIGN_SYSTEM.md §7a; warunek 2 wymuszany stylelintem) | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DO ZROBIENIA |
| 0.8 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DONE 28.09 | docs/handover/SCOPE.md | 56.2.0 Wierność wizualna | DO ZROBIENIA (częściowo) |
| 0.9 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DONE 28.09 | docs/handover/SCOPE.md | 56.2.0 Wierność wizualna | DO ZROBIENIA (częściowo) |
| 0.10 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DONE 28.09 | docs/handover/SCOPE.md | 56.2.0 Wierność wizualna | DO ZROBIENIA (częściowo) |
| 1.5 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.1 Fundament | DO ZROBIENIA (częściowo) |
| 1.7 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.1 Fundament | DO ZROBIENIA (częściowo) |
| 5.12 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.5 Pozycje i mapa | DO ZROBIENIA (częściowo) |
| 6.1 | docs/handover/SCOPE.md | 6. Dokumenty | ZROBIONE 28.09 (III-6) | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DO ZROBIENIA (częściowo) |
| 6.2 | docs/handover/SCOPE.md | 6. Dokumenty | ZROBIONE 28.09 (III-6) | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DO ZROBIENIA (częściowo) |
| 6.5 | docs/handover/SCOPE.md | 6. Dokumenty | ZROBIONE 28.09 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DO ZROBIENIA (częściowo) |
| 6.8 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.6 Dokumenty | DO ZROBIENIA (częściowo) |
| 7.10 | docs/handover/SCOPE.md | 7. Pieniądze | ZROBIONE 28.09 (III-7) | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | DO ZROBIENIA (częściowo) |
| 10.7 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.10 Pulpity | DO ZROBIENIA (częściowo) |
| 11.6 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.11 Jakość | DO ZROBIENIA (częściowo) |
| 11.8 | docs/handover/SCOPE.md | 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7) | GOTOWE | docs/handover/SCOPE.md | 56.2.11 Jakość | DO ZROBIENIA (częściowo) |
| I-3 | docs/handover/wzorzec/STAN/PLAN_KOPIA_KOORDYNATORA.md | tabela kolejki (kopia STAN) | CZEKA NA: telefon i SIM (część bazowa i aplikacja — DO ZROBIENIA) | docs/handover/PLAN.md | ETAP I — przed pilotażem (w tej kolejności) | CZĘŚĆ BAZOWA DONE (0067–0069) + DEC-5 (0106). **D-4 ZAMKNIĘTE 01.10** (telefon+SIM są). DO ZROBIENIA: aplikacja Android → **I-3-APK** |
| II-5 | docs/handover/wzorzec/STAN/PLAN_KOPIA_KOORDYNATORA.md | tabela kolejki (kopia STAN) | CZEKA NA: zgoda armatora | docs/handover/PLAN.md | Potwierdzenie uzupełnienia (01.10) — od koordynatora | **DONE** (ten commit) — Polferries 403→NIEZNANY+ryzyko; Stena status z JSON; testy ferry+integrations |
| II-6 | docs/handover/wzorzec/STAN/PLAN_KOPIA_KOORDYNATORA.md | tabela kolejki (kopia STAN) | CZEKA NA: klucze (każdy osobno — rusza, gdy jego klucz dotrze) | docs/handover/PLAN.md | Potwierdzenie uzupełnienia (01.10) — od koordynatora | **DONE** — **0121** + cron **0131** `tower-road-se` `*/15`; panel SE czyta bazę (nie fasadę) |
| R-2 | docs/handover/wzorzec/STAN/PLAN_KOPIA_KOORDYNATORA.md | tabela kolejki (kopia STAN) | CZEKA NA: etap I | docs/handover/PLAN.md | PILOTAŻ I WYDANIE | **CZĘŚCIOWO** — właściciel sam dodaje użytkowników w aplikacji; zaproszenia/e-maile do tych kont mogą wychodzić (0133). Lista D-16 nadal u właściciela |
| 0.1 | docs/handover/SCOPE.md | 56.1 | 0.1 \| DO ZROBIENIA (częściowo) \| PLAN III-2 | docs/handover/PLAN.md | ETAP III | III-2 (P2, z I-11: SCOPE 0.1, 0.3, 0.7–0.10, 11.4) domknięcie wierności wizualnej — 0.1, 0.7 DONE 28.09 |
| 0.7 | docs/handover/SCOPE.md | 56.1 | 0.7 \| DO ZROBIENIA \| PLAN III-2 | docs/handover/PLAN.md | ETAP III | 0.1, 0.7 DONE 28.09 (`tests/stylesheet-mockup.test.ts`, naprawiony dryf `kbd`, DESIGN_SYSTEM §7a) |

## 4. BEZ STATUSU LUB BEZ MIEJSCA W PLAN.md

„Bez statusu” = żaden z dokumentów PLAN.md, POSTEP.md ani plik źródłowy pozycji nie podaje komórki statusu. Sprzeczność (sekcja 3) nie jest brakiem statusu. „Bez PLAN” = identyfikatora nie ma jako tokenu w `PLAN.md`.

| ID | Źródło | Brak |
|---|---|---|
| 0.2 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | PLAN |
| 0.4 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | PLAN |
| 0.5 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | PLAN |
| 0.6 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | PLAN |
| 0.9 | docs/handover/SCOPE.md — 0. Wierność wizualna; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.0 Wierność wizualna | PLAN |
| 1.2 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.2.1 Fundament | PLAN |
| 1.3 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.2.1 Fundament | PLAN |
| 1.7 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.1 Fundament | PLAN |
| 1.8 | docs/handover/SCOPE.md — 1. Fundament; docs/handover/SCOPE.md — 56.2.1 Fundament | PLAN |
| 10.2 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | PLAN |
| 10.3 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | PLAN |
| 10.5 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.2.10 Pulpity | PLAN |
| 10.9 | docs/handover/SCOPE.md — 10. Pulpity; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.10 Pulpity | PLAN |
| 11.1 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.2.11 Jakość | PLAN |
| 11.2 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.2.11 Jakość | PLAN |
| 11.3 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | PLAN |
| 11.6 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | PLAN |
| 11.7 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.2.11 Jakość | PLAN |
| 11.8 | docs/handover/SCOPE.md — 11. Jakość; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.11 Jakość | PLAN |
| 12.1 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.10 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.11 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.12 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.13 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.14 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.2 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.3 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.4 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.5 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.6 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.7 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.8 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 12.9 | docs/handover/SCOPE.md — 12. Funkcje znalezione we wdrożeniu na Vercel (23.09.2026) | status / PLAN |
| 13.1 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.10 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.11 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.12 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.13 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.14 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.15 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.16 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | PLAN |
| 13.2 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.3 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.4 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.5 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.6 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.7 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.8 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 13.9 | docs/handover/SCOPE.md — 13. Defekty wdrożenia do naprawy przed przejęciem | status / PLAN |
| 14.1 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.10 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.11 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.2 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.3 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.4 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.5 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.6 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.7 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.8 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 14.9 | docs/handover/SCOPE.md — 14. Ustalenia z etapu 0 przekazania (23.09.2026) | status / PLAN |
| 15.1 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 15.2 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 15.3 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 15.4 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 15.5 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 15.6 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 15.7 | docs/handover/SCOPE.md — 15. Etap 0.5 — zamrożenie w Git (blokujące, przed etapem A) | status / PLAN |
| 16.1 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status |
| 16.2 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status / PLAN |
| 16.3 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status |
| 16.4 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status / PLAN |
| 16.5 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status / PLAN |
| 16.6 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status / PLAN |
| 16.7 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status / PLAN |
| 16.8 | docs/handover/SCOPE.md — 16.2 Ustalenia produktowe, których nie miałem | status / PLAN |
| 17.1 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status |
| 17.10 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.11 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.12 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.13 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.14 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.15 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.16 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.2 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.3 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.4 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.5 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.6 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.7 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.8 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status / PLAN |
| 17.9 | docs/handover/SCOPE.md — 17. Ryzyka wykryte przez agentów — nowe pozycje zakresu | status |
| 2.1 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | PLAN |
| 2.2 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | PLAN |
| 2.4 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp; docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | PLAN |
| 2.5 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | PLAN |
| 2.7 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | PLAN |
| 2.8 | docs/handover/SCOPE.md — 2. Dane i dostęp; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.2 Dane i dostęp | PLAN |
| 20.1 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.10 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.2 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.3 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.4 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.5 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.6 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.7 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.8 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 20.9 | docs/handover/SCOPE.md — Nowe znaleziska z etapu C | status / PLAN |
| 23.2 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | status / PLAN |
| 23.3 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | status / PLAN |
| 23.4 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | status / PLAN |
| 23.5 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | status / PLAN |
| 23.6 | docs/handover/SCOPE.md — 23.1 Ryzyko krytyczne ujawnione przy okazji | status / PLAN |
| 26.2 | docs/handover/SCOPE.md — 26.1 Otwarte, blokujące bramę fali 1 | status / PLAN |
| 26.3 | docs/handover/SCOPE.md — 26.1 Otwarte, blokujące bramę fali 1 | status / PLAN |
| 26.4 | docs/handover/SCOPE.md — 26.1 Otwarte, blokujące bramę fali 1 | status / PLAN |
| 28.2 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | status / PLAN |
| 28.3 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | status / PLAN |
| 28.4 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | status / PLAN |
| 28.5 | docs/handover/SCOPE.md — 28.1 Otwarte po fali 1 | status / PLAN |
| 3.1 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.10 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.3 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.4 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.5 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.6 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.7 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 3.9 | docs/handover/SCOPE.md — 3. Harmonogram; docs/handover/SCOPE.md — 56.2.3 Harmonogram | PLAN |
| 32.1 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | status / PLAN |
| 32.2 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | status / PLAN |
| 32.3 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | status / PLAN |
| 32.4 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | status / PLAN |
| 32.5 | docs/handover/SCOPE.md — 32. D7 — decyzja właściciela (24.09.2026) | status / PLAN |
| 33.1 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | status / PLAN |
| 33.2 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | status / PLAN |
| 33.3 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | status / PLAN |
| 33.4 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | status / PLAN |
| 33.5 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | status / PLAN |
| 33.6 | docs/handover/SCOPE.md — 33. D7 — reguła czasu (decyzja właściciela, 24.09.2026) | status / PLAN |
| 4.1 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | PLAN |
| 4.2 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | PLAN |
| 4.4 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | PLAN |
| 4.6 | docs/handover/SCOPE.md — 4. Zasoby i awizacja; docs/handover/SCOPE.md — 56.2.4 Zasoby i awizacja | PLAN |
| 5.1 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.11 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.12 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.14 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.2 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.3 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.4 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.5 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.6 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.7 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.8 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 5.9 | docs/handover/SCOPE.md — 5. Pozycje i mapa; docs/handover/SCOPE.md — 56.2.5 Pozycje i mapa | PLAN |
| 6.3 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.2.6 Dokumenty | PLAN |
| 6.7 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.2.6 Dokumenty | PLAN |
| 6.9 | docs/handover/SCOPE.md — 6. Dokumenty; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.6 Dokumenty | PLAN |
| 7.1 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.11 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.2 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.3 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.4 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.6 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.7 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.8 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 7.9 | docs/handover/SCOPE.md — 7. Pieniądze; docs/handover/SCOPE.md — 56.2.7 Pieniądze | PLAN |
| 8.1 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.10 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.2 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.3 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.4 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.5 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.6 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.7 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.8 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 8.9 | docs/handover/SCOPE.md — 8. Ryzyko; docs/handover/SCOPE.md — 56.2.8 Ryzyko | PLAN |
| 9.1 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.10 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.11 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.2 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.3 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.5 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.6 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.7 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| 9.9 | docs/handover/SCOPE.md — 9. Automatyzacje i powiadomienia; docs/handover/SCOPE.md — 56.1 Pozycje sekcji 0–11 inne niż GOTOWE w audycie → status po etapie I i miejsce w kolejce (I-11, zasada 7); docs/handover/SCOPE.md — 56.2.9 Automatyzacje i powiadomienia | PLAN |
| AN1 | docs/handover/ZLECENIE_FINAL.md — AN1 — ZASTOSUJ ANEKS (przed następną pozycją zlecenia); docs/handover/POSTEP.md — Aneksy | PLAN |
| AN2 | docs/handover/ZLECENIE_FINAL.md — AN2 — ZASTOSUJ ANEKS; docs/handover/POSTEP.md — Aneksy | PLAN |
| AN3 | docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | PLAN |
| AN4 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| AN5 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| AUTH-MAIL | docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | PLAN |
| BK0 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BK1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BK2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BK3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BK4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BK5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BK6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| BRAK-PLIKU-ZLECENIE_DLA_GROKA | brak pliku na dysku; wzmianka: docs/handover/ZLECENIE_FINAL.md — ETAP 0 (tabela plików) oraz docs/handover/POSTEP.md — Etap 0 P0.1 | status / PLAN |
| BRAK-PLIKU-ZLECENIE_ETAP_I | brak pliku na dysku; wzmianka: docs/handover/SCOPE.md — 52.2 Etap I — definicja | status / PLAN |
| D-1 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-1, D-2 — CENNIK I SEFS: PRZEKAZANE | status |
| D-10 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-11 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-12 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-14 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-16 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-17 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-18 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-2 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-20 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-21 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-22 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-23 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-24 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-25 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-28 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-28 — DECYZJA KOŃCOWA: WŁASNY SILNIK + KALIBRACJA UCZĄCA SIĘ | status |
| D-29 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/PACZKA_DECYZJI_30_09.md — D-29 — REGUŁY STARTOWE: NAJPIERW TABELA | status |
| D-3 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-32 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-33 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-34 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL; docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §0. Co przestaje obowiązywać | status |
| D-5 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-6 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-7 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-77 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-78 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-79 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-8 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-80 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-81 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-82 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-83 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status |
| D-84 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji) | status / PLAN |
| D-85 | docs/handover/ZLECENIE_HERE.md — 1. Decyzje (dopisz do rejestru decyzji); docs/handover/POLECENIA_KOORDYNATORA.md — Decyzja D-85 (2026-10-04) — ETA w pełni automatyczne; docs/handover/POLECENIA_KOORDYNATORA.md — Polecenie 2026-10-04 20:10 (czas warszawski) — D-85, droga SE | status / PLAN |
| D-9 | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-EUR-T | docs/handover/ZLECENIE_FINAL.md — 6. ETAP 2 — FALA 3A: TREŚĆ, JĘZYK, FORMATY, SILNIK; docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D-STENA-COORDS | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D-TELM-ETA | docs/handover/PLAN.md — 4. DECYZJE OCZEKUJĄCE — WŁAŚCICIEL | status |
| D10 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D11 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D13 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D14 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)** | PLAN |
| D15 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)** | PLAN |
| D17 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D18 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D19 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D19-T | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D23-S | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| D25 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| D26 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| D6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| DECPOW-§0 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §0. Co przestaje obowiązywać | status / PLAN |
| DECPOW-§1 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §1. TELEFONY — ZAWSZE BEZ KIERUNKOWEGO · P1 | status / PLAN |
| DECPOW-§2 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §2. CENTRUM DECYZJI — PEŁNY PROCES · P0 | status / PLAN |
| DECPOW-§3 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §3. POWIADOMIENIA — KAŻDE ZDARZENIE · P0 | status / PLAN |
| DECPOW-§4 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §4. WIDOCZNOŚĆ — ADMINISTRATOR WYBIERA FIRMY · P0 | status / PLAN |
| DECPOW-§5 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §5. SMS — 2 OSOBY NA ZAŁADUNKU, 2 NA ROZŁADUNKU · P1 | status / PLAN |
| DECPOW-§6 | docs/handover/ZLECENIE_DECYZJE_POWIADOMIENIA.md — §6. USTAWIENIA ADMINISTRATORA · P1 | status / PLAN |
| ETAP_I/I-0 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-1 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-2 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-3 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-4 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-5 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-6 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-7 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-8 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| ETAP_I/I-9 | docs/handover/SCOPE.md — 52.2 Etap I — definicja (przypisane do brakującego ZLECENIE_ETAP_I.md) | status / PLAN |
| F-KLUCZ | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| F2.1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| F2.2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| F2.3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| F2.4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| F2.4. | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA | status / PLAN |
| F2.5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| F2.6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| G1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 1 — korekty po Fala 2 GATE | PLAN |
| G2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| G3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 3 — backend | PLAN |
| G5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 5 — Fala 4: infrastruktura · **ZAMKNIĘTY (G5)** | PLAN |
| H-10 | docs/handover/ZLECENIE_HERE.md — H-10 · Pogoda i wiatr na trasie | status |
| H-12 | docs/handover/ZLECENIE_HERE.md — H-12 · Zakazy czasowe | status |
| H-7 | docs/handover/ZLECENIE_HERE.md — H-7 · Mapa w e-mailach i w eksporcie PDF | status |
| H-8 | docs/handover/ZLECENIE_HERE.md — H-8 · Profil trasy | status |
| I-2A | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| I-2B | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| I-2C | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| I-2b | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| L1 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L16 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L2 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L4 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L5 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L7 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L8 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| L9 | docs/handover/POSTEP.md — Pozycje L* (F2.5) — przydział etapów | PLAN |
| M1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| M10 | docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M11 | docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M12 | docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M7 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M8 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| M9 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 4 — Fala 3B: pieniądze, faktury, zlecenia · **ZAMKNIĘTY (G4)** | PLAN |
| O-V | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy; docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | PLAN |
| O-V2 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O-V3 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O-V4 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O-V5 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O-V6 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O4 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| O5 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| P0.1 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 0 — przygotowanie | PLAN |
| P0.1. | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA | status / PLAN |
| P0.2 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 0 — przygotowanie | PLAN |
| P0.3 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 0 — przygotowanie | PLAN |
| P6 | docs/handover/ZLECENIE_FINAL.md — 12. LISTA KONTROLNA; docs/handover/POSTEP.md — Etap 2 — Fala 3A: treść, język, formaty, silnik · **ZAMKNIĘTY (G2)** | PLAN |
| PL-T | docs/handover/POSTEP.md — Aneks 3 — decyzje do wydania 1.0 (`DECYZJE_WYDANIE_1_0.md`) | PLAN |
| POPRAWKI-A1 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ A | status / PLAN |
| POPRAWKI-A2 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ A | status / PLAN |
| POPRAWKI-B-1 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10d | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10e | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10f | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-10g | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-11 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-12 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-13 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-14 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-15 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-16 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-17 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-18 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-19 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-2 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-2a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-2b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-2c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-3 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-3a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-4 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-4a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-4b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-5 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6d | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6e | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6f | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6g | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6h | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-6i | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-7 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-7a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-7b | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-7c | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-8 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-8a | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-B-9 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B | status / PLAN |
| POPRAWKI-D | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ D | status / PLAN |
| POPRAWKI-Q-1 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-10 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-11 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-12 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-13 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-14 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-15 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-16 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-17 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-18 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-19 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-2 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-3 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-4 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-5 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-6 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-7 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-8 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| POPRAWKI-Q-9 | docs/handover/ZLECENIE_POPRAWKI_02_10.md — CZĘŚĆ B — PYTANIA O LOGIKĘ | status / PLAN |
| PR1 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| PR2 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| PR3 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| PR4 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| PR6 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| PR7 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| PR8 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| SCX-§0 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §0. Co przestaje obowiązywać | status / PLAN |
| SCX-§1 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §1. LOGOWANIE HASŁEM · P0 | status / PLAN |
| SCX-§10 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §10. ADMINISTRATOR MOŻE WSZYSTKO · P1 | status / PLAN |
| SCX-§11 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §11. PEŁNA HISTORIA ZMIAN · P1 | status / PLAN |
| SCX-§12 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §12. INTERFEJS · P2 | status / PLAN |
| SCX-§13 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §13. ZEZWOLENIA · P2 (czeka na dane) | PLAN |
| SCX-§14 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §14. PEŁNA RESPONSYWNOŚĆ I INSTALACJA NA TELEFONIE · P1 | status / PLAN |
| SCX-§15 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §15. NAZWA I LOGO „WATCH TOWER" · P1 | status / PLAN |
| SCX-§2 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §2. TELEMATYKA · P1 (czeka na dane) | PLAN |
| SCX-§3 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §3. STENA LINE GDYNIA – KARLSKRONA · P1 | status / PLAN |
| SCX-§4 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §4. AWIZACJA — PRZYCISK „DODAJ" / „EDYTUJ" I OKNO · P1 | status / PLAN |
| SCX-§4a | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §4a. NUMER ZLECENIA HHL — DODAWANIE I EDYCJA PRZEZ HHL · P1 | status / PLAN |
| SCX-§5 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §5. POWIADOMIENIA I SMS DLA KSH · P1 | status / PLAN |
| SCX-§6 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §6. OPÓŹNIENIE I CZAS PRZEJAZDU · P1 | status / PLAN |
| SCX-§7 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §7. DATY Z PLIKU KSH · P1 | status / PLAN |
| SCX-§8 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §8. OPŁATY DODATKOWE — WYŁĄCZNIE RĘCZNIE · P1 (zastępuje I-32) | PLAN |
| SCX-§9 | docs/handover/ZLECENIE_PO_SPOTKANIU_SCX.md — §9. FAKTURY · P1 | status / PLAN |
| SEC-1 | docs/handover/POSTEP.md — Etap 6 — odbiór końcowy | PLAN |
| SMS-ZONE-ON | docs/handover/POSTEP.md — Naprawa bramy po 0106 (01.10) | PLAN |
| T1 | docs/handover/ZLECENIE_FINAL.md — T1 — WYSOKA: baza tworzy ryzyka po polsku | status / PLAN |
| T2 | docs/handover/ZLECENIE_FINAL.md — T2 — ŚREDNIA: napisy wpisane na sztywno, których nie ma w słowniku | status / PLAN |
| T3 | docs/handover/ZLECENIE_FINAL.md — T3 — NISKA: format liczb według języka | status / PLAN |
| W1 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| W2 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| W3 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |
| W4 | docs/handover/POSTEP.md — Aneks 4 — produkcja w całości za darmo (`ANEKS_4_PRODUKCJA_ZA_DARMO.md`) | PLAN |


## 5. DRUGIE PRZEJŚCIE (2026-10-04)

Dla każdej pozycji sekcji 2, która miała status NIEZNANY. „zrobione” tylko wtedy, gdy plik, migracja albo test istnieje. Inaczej „do zrobienia”. Kopia `wzorzec/STAN` nie jest dowodem. Przy SCOPE wygrywa 56.1, chyba że późniejszy datowany wpis „zrobione” ma dowód w pliku.

| ID | Status | Dowód |
|---|---|---|
| BRAK-PLIKU-ZLECENIE_ETAP_I | do zrobienia | — |
| BRAK-PLIKU-ZLECENIE_DLA_GROKA | do zrobienia | — |
| D-10 | do zrobienia | — |
| D-11 | do zrobienia | — |
| D-12 | do zrobienia | — |
| D-14 | do zrobienia | — |
| D-16 | do zrobienia | — |
| D-17 | do zrobienia | — |
| D-18 | do zrobienia | — |
| D-2 | zrobione | supabase/migrations/0101_i31_sefs_week.sql |
| D-20 | do zrobienia | — |
| D-21 | do zrobienia | — |
| D-22 | zrobione | supabase/migrations/0090_escort_driver_contact.sql |
| D-23 | zrobione | supabase/migrations/0091_carrier_sees_ratings.sql |
| D-24 | do zrobienia | — |
| D-25 | do zrobienia | — |
| D-3 | do zrobienia | — |
| D-32 | do zrobienia | — |
| D-33 | do zrobienia | — |
| D-5 | zrobione | supabase/migrations/0133_messaging_owner_accounts.sql |
| D-6 | do zrobienia | — |
| D-7 | do zrobienia | — |
| D-8 | do zrobienia | — |
| D-9 | do zrobienia | — |
| D-STENA-COORDS | zrobione | supabase/functions/_shared/ferry/digitraffic.ts |
| D-TELM-ETA | do zrobienia | — |
| D-1 | zrobione | supabase/migrations/0100_i30_symbol_rate.sql |
| D-28 | zrobione | supabase/migrations/0122_ii7_eta_osm_corridor.sql |
| D-29 | do zrobienia | — |
| D-4 | do zrobienia | — |
| DEC-CLICK | do zrobienia | — |
| D-13 | do zrobienia | — |
| D-15 | do zrobienia | — |
| D-34 | do zrobienia | — |
| B-8-IMP | do zrobienia | — |
| C-SEP | do zrobienia | — |
| D-LATER | do zrobienia | — |
| I-18 | zrobione | supabase/migrations/0061_plan_dates_confirm.sql |
| I-3 | zrobione | supabase/migrations/0067_sms_gateway_base.sql |
| II-7a | do zrobienia | — |
| II-5 | do zrobienia | — |
| II-6 | do zrobienia | — |
| II-7 | do zrobienia | — |
| AUDIT-PROD | do zrobienia | — |
| L-1 | do zrobienia | — |
| L-4 | do zrobienia | — |
| R-1 | do zrobienia | — |
| R-2 | do zrobienia | — |
| R-0 | do zrobienia | — |
| GATE-WEEKLY | do zrobienia | — |
| D-27 | do zrobienia | — |
| D-30 | zrobione | supabase/migrations/0097_insurance_expiry.sql |
| D-31 | do zrobienia | — |
| D-29t | do zrobienia | — |
| I-7a | do zrobienia | — |
| I-30 | do zrobienia | — |
| I-29 | do zrobienia | — |
| II-7b | do zrobienia | — |
| II-8 | do zrobienia | — |
| II-9 | do zrobienia | — |
| I-3-APK | zrobione | supabase/migrations/0116_sms_zone_triggers_on.sql |
| ADM-10 | zrobione | supabase/migrations/0117_adm10_impersonate.sql |
| CLEAN-TT-HERE | do zrobienia | — |
| DATY-67 | zrobione | supabase/migrations/0113_daty67_ksh_file_dates.sql |
| FAK-9 | do zrobienia | — |
| HIST-11 | zrobione | supabase/migrations/0118_hist11_full_audit.sql |
| ONE-MECH | do zrobienia | — |
| OPL-8 | zrobione | supabase/migrations/0115_opl8_manual_fees.sql |
| SMS-DELIV | zrobione | supabase/migrations/0116_sms_zone_triggers_on.sql |
| STENA-3 | zrobione | supabase/migrations/0119_stena3_dictionaries.sql |
| UI-12 | do zrobienia | — |
| HHL-4a | do zrobienia | — |
| RESP-14 | zrobione | tests/resp14-phone.spec.ts |
| PR8 | do zrobienia | — |
| O-V | do zrobienia | — |
| AUTH-MAIL | do zrobienia | — |
| SMS-ZONE-ON | do zrobienia | — |
| L16 | do zrobienia | — |
| L5 | do zrobienia | — |
| L9 | do zrobienia | — |
| 0.1 | zrobione | tests/stylesheet-mockup.test.ts |
| 0.10 | do zrobienia | — |
| 0.7 | do zrobienia | — |
| 0.8 | zrobione | tests/visual-states.spec.ts |
| 0.9 | do zrobienia | — |
| 1.4 | do zrobienia | — |
| 1.5 | do zrobienia | — |
| 1.6 | do zrobienia | — |
| 1.7 | do zrobienia | — |
| 10.4 | do zrobienia | — |
| 10.6 | zrobione | supabase/migrations/0089_carrier_rating.sql |
| 10.7 | do zrobienia | — |
| 10.9 | do zrobienia | — |
| 11.5 | do zrobienia | — |
| 11.6 | do zrobienia | — |
| 11.8 | do zrobienia | — |
| 12.1 | do zrobienia | — |
| 12.10 | do zrobienia | — |
| 12.11 | do zrobienia | — |
| 12.12 | do zrobienia | — |
| 12.13 | do zrobienia | — |
| 12.14 | do zrobienia | — |
| 12.2 | do zrobienia | — |
| 12.3 | do zrobienia | — |
| 12.4 | do zrobienia | — |
| 12.5 | do zrobienia | — |
| 12.6 | do zrobienia | — |
| 12.7 | do zrobienia | — |
| 12.8 | do zrobienia | — |
| 12.9 | do zrobienia | — |
| 13.1 | do zrobienia | — |
| 13.10 | do zrobienia | — |
| 13.11 | do zrobienia | — |
| 13.12 | do zrobienia | — |
| 13.13 | do zrobienia | — |
| 13.14 | do zrobienia | — |
| 13.15 | do zrobienia | — |
| 13.16 | do zrobienia | — |
| 13.2 | do zrobienia | — |
| 13.3 | do zrobienia | — |
| 13.4 | do zrobienia | — |
| 13.5 | do zrobienia | — |
| 13.6 | do zrobienia | — |
| 13.7 | do zrobienia | — |
| 13.8 | do zrobienia | — |
| 13.9 | do zrobienia | — |
| 14.1 | do zrobienia | — |
| 14.10 | do zrobienia | — |
| 14.11 | do zrobienia | — |
| 14.2 | do zrobienia | — |
| 14.3 | do zrobienia | — |
| 14.4 | do zrobienia | — |
| 14.5 | do zrobienia | — |
| 14.6 | do zrobienia | — |
| 14.7 | do zrobienia | — |
| 14.8 | do zrobienia | — |
| 14.9 | do zrobienia | — |
| 15.1 | do zrobienia | — |
| 15.2 | do zrobienia | — |
| 15.3 | do zrobienia | — |
| 15.4 | do zrobienia | — |
| 15.5 | do zrobienia | — |
| 15.6 | do zrobienia | — |
| 15.7 | do zrobienia | — |
| 16.1 | do zrobienia | — |
| 16.2 | do zrobienia | — |
| 16.3 | do zrobienia | — |
| 16.4 | do zrobienia | — |
| 16.5 | do zrobienia | — |
| 16.6 | do zrobienia | — |
| 16.7 | do zrobienia | — |
| 16.8 | do zrobienia | — |
| 17.1 | do zrobienia | — |
| 17.10 | do zrobienia | — |
| 17.11 | do zrobienia | — |
| 17.12 | do zrobienia | — |
| 17.13 | do zrobienia | — |
| 17.14 | do zrobienia | — |
| 17.15 | do zrobienia | — |
| 17.16 | do zrobienia | — |
| 17.2 | do zrobienia | — |
| 17.3 | do zrobienia | — |
| 17.4 | do zrobienia | — |
| 17.5 | do zrobienia | — |
| 17.6 | do zrobienia | — |
| 17.7 | do zrobienia | — |
| 17.8 | do zrobienia | — |
| 17.9 | do zrobienia | — |
| 2.7 | do zrobienia | — |
| 2.8 | do zrobienia | — |
| 23.2 | do zrobienia | — |
| 23.3 | do zrobienia | — |
| 23.4 | do zrobienia | — |
| 23.5 | do zrobienia | — |
| 23.6 | do zrobienia | — |
| 26.2 | do zrobienia | — |
| 26.3 | do zrobienia | — |
| 26.4 | do zrobienia | — |
| 28.2 | do zrobienia | — |
| 28.3 | do zrobienia | — |
| 28.4 | do zrobienia | — |
| 28.5 | do zrobienia | — |
| 3.10 | do zrobienia | — |
| 3.8 | do zrobienia | — |
| 32.1 | do zrobienia | — |
| 32.2 | do zrobienia | — |
| 32.3 | do zrobienia | — |
| 32.4 | do zrobienia | — |
| 32.5 | do zrobienia | — |
| 33.1 | do zrobienia | — |
| 33.2 | do zrobienia | — |
| 33.3 | do zrobienia | — |
| 33.4 | do zrobienia | — |
| 33.5 | do zrobienia | — |
| 33.6 | do zrobienia | — |
| 4.3 | do zrobienia | — |
| 4.5 | zrobione | supabase/migrations/0087_escort_vehicles.sql |
| 5.1 | do zrobienia | — |
| 5.10 | zrobione | src/lib/mapDeclutter.ts |
| 5.12 | zrobione | supabase/migrations/0051_eta_v1.sql |
| 5.13 | zrobione | supabase/migrations/0088_load_track.sql |
| 5.2 | do zrobienia | — |
| 5.3 | do zrobienia | — |
| ETAP_I/I-0 | do zrobienia | — |
| ETAP_I/I-1 | do zrobienia | — |
| ETAP_I/I-2 | do zrobienia | — |
| ETAP_I/I-3 | do zrobienia | — |
| ETAP_I/I-4 | do zrobienia | — |
| ETAP_I/I-5 | do zrobienia | — |
| ETAP_I/I-6 | do zrobienia | — |
| ETAP_I/I-7 | do zrobienia | — |
| ETAP_I/I-8 | do zrobienia | — |
| ETAP_I/I-9 | do zrobienia | — |
| 6.2 | do zrobienia | — |
| 6.4 | zrobione | supabase/migrations/0086_permit_form.sql |
| 6.5 | do zrobienia | — |
| 6.6 | zrobione | supabase/migrations/0097_insurance_expiry.sql |
| 6.8 | do zrobienia | — |
| 6.9 | do zrobienia | — |
| 7.1 | do zrobienia | — |
| 7.10 | do zrobienia | — |
| 7.11 | do zrobienia | — |
| 7.3 | do zrobienia | — |
| 7.5 | do zrobienia | — |
| 8.1 | do zrobienia | — |
| 8.10 | do zrobienia | — |
| 8.2 | do zrobienia | — |
| 8.5 | do zrobienia | — |
| 8.6 | do zrobienia | — |
| 9.10 | do zrobienia | — |
| 9.6 | do zrobienia | — |
| 9.9 | do zrobienia | — |
| 20.1 | do zrobienia | — |
| 20.10 | do zrobienia | — |
| 20.2 | do zrobienia | — |
| 20.3 | do zrobienia | — |
| 20.4 | do zrobienia | — |
| 20.5 | do zrobienia | — |
| 20.6 | do zrobienia | — |
| 20.7 | do zrobienia | — |
| 20.8 | do zrobienia | — |
| 20.9 | do zrobienia | — |
| DECPOW-§0 | do zrobienia | — |
| DECPOW-§1 | do zrobienia | — |
| DECPOW-§2 | do zrobienia | — |
| DECPOW-§3 | do zrobienia | — |
| DECPOW-§4 | do zrobienia | — |
| DECPOW-§5 | do zrobienia | — |
| DECPOW-§6 | do zrobienia | — |
| F2.4. | do zrobienia | — |
| P0.1. | do zrobienia | — |
| O3 | do zrobienia | — |
| O5 | do zrobienia | — |
| T1 | do zrobienia | — |
| T2 | do zrobienia | — |
| T3 | do zrobienia | — |
| D-77 | do zrobienia | — |
| D-78 | do zrobienia | — |
| D-79 | do zrobienia | — |
| D-80 | do zrobienia | — |
| D-81 | do zrobienia | — |
| D-82 | do zrobienia | — |
| D-83 | do zrobienia | — |
| D-84 | do zrobienia | — |
| D-85 | do zrobienia | — |
| H-10 | do zrobienia | — |
| H-12 | do zrobienia | — |
| H-7 | do zrobienia | — |
| H-8 | do zrobienia | — |
| POPRAWKI-A1 | do zrobienia | — |
| POPRAWKI-A2 | do zrobienia | — |
| POPRAWKI-B-1 | do zrobienia | — |
| POPRAWKI-B-10 | do zrobienia | — |
| POPRAWKI-B-10a | do zrobienia | — |
| POPRAWKI-B-10b | do zrobienia | — |
| POPRAWKI-B-10c | do zrobienia | — |
| POPRAWKI-B-10d | do zrobienia | — |
| POPRAWKI-B-10e | do zrobienia | — |
| POPRAWKI-B-10f | do zrobienia | — |
| POPRAWKI-B-10g | do zrobienia | — |
| POPRAWKI-B-11 | do zrobienia | — |
| POPRAWKI-B-12 | do zrobienia | — |
| POPRAWKI-B-13 | do zrobienia | — |
| POPRAWKI-B-14 | do zrobienia | — |
| POPRAWKI-B-15 | do zrobienia | — |
| POPRAWKI-B-16 | do zrobienia | — |
| POPRAWKI-B-17 | do zrobienia | — |
| POPRAWKI-B-18 | do zrobienia | — |
| POPRAWKI-B-19 | do zrobienia | — |
| POPRAWKI-B-2 | do zrobienia | — |
| POPRAWKI-B-2a | do zrobienia | — |
| POPRAWKI-B-2b | zrobione | tests/integrations.test.ts |
| POPRAWKI-B-2c | do zrobienia | — |
| POPRAWKI-B-3 | do zrobienia | — |
| POPRAWKI-B-3a | do zrobienia | — |
| POPRAWKI-B-4 | do zrobienia | — |
| POPRAWKI-B-4a | do zrobienia | — |
| POPRAWKI-B-4b | do zrobienia | — |
| POPRAWKI-B-5 | do zrobienia | — |
| POPRAWKI-B-6 | do zrobienia | — |
| POPRAWKI-B-6a | do zrobienia | — |
| POPRAWKI-B-6b | do zrobienia | — |
| POPRAWKI-B-6c | do zrobienia | — |
| POPRAWKI-B-6d | do zrobienia | — |
| POPRAWKI-B-6e | do zrobienia | — |
| POPRAWKI-B-6f | do zrobienia | — |
| POPRAWKI-B-6g | do zrobienia | — |
| POPRAWKI-B-6h | do zrobienia | — |
| POPRAWKI-B-6i | do zrobienia | — |
| POPRAWKI-B-7 | do zrobienia | — |
| POPRAWKI-B-7a | do zrobienia | — |
| POPRAWKI-B-7b | do zrobienia | — |
| POPRAWKI-B-7c | do zrobienia | — |
| POPRAWKI-B-8 | do zrobienia | — |
| POPRAWKI-B-8a | do zrobienia | — |
| POPRAWKI-B-9 | do zrobienia | — |
| POPRAWKI-Q-1 | do zrobienia | — |
| POPRAWKI-Q-10 | do zrobienia | — |
| POPRAWKI-Q-11 | do zrobienia | — |
| POPRAWKI-Q-12 | do zrobienia | — |
| POPRAWKI-Q-13 | do zrobienia | — |
| POPRAWKI-Q-14 | do zrobienia | — |
| POPRAWKI-Q-15 | do zrobienia | — |
| POPRAWKI-Q-16 | do zrobienia | — |
| POPRAWKI-Q-17 | do zrobienia | — |
| POPRAWKI-Q-18 | do zrobienia | — |
| POPRAWKI-Q-19 | do zrobienia | — |
| POPRAWKI-Q-2 | do zrobienia | — |
| POPRAWKI-Q-3 | do zrobienia | — |
| POPRAWKI-Q-4 | do zrobienia | — |
| POPRAWKI-Q-5 | do zrobienia | — |
| POPRAWKI-Q-6 | do zrobienia | — |
| POPRAWKI-Q-7 | do zrobienia | — |
| POPRAWKI-Q-8 | do zrobienia | — |
| POPRAWKI-Q-9 | do zrobienia | — |
| POPRAWKI-D | do zrobienia | — |
| SCX-§0 | do zrobienia | — |
| SCX-§1 | do zrobienia | — |
| SCX-§10 | do zrobienia | — |
| SCX-§11 | do zrobienia | — |
| SCX-§12 | do zrobienia | — |
| SCX-§14 | do zrobienia | — |
| SCX-§15 | do zrobienia | — |
| SCX-§3 | do zrobienia | — |
| SCX-§4 | do zrobienia | — |
| SCX-§4a | do zrobienia | — |
| SCX-§5 | do zrobienia | — |
| SCX-§6 | do zrobienia | — |
| SCX-§7 | do zrobienia | — |
| SCX-§8 | do zrobienia | — |
| SCX-§9 | do zrobienia | — |

### Powtórzenia i pozycje bez sensu — do decyzji koordynatora

| Pozycja | Z czym się kłóci albo dubluje | Dlaczego |
|---|---|---|
| POPRAWKI-Q-1 | POPRAWKI-B-1 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-2 | POPRAWKI-B-2 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-3 | POPRAWKI-B-3 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-4 | POPRAWKI-B-4 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-5 | POPRAWKI-B-5 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-6 | POPRAWKI-B-6 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-7 | POPRAWKI-B-7 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-8 | POPRAWKI-B-8 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-9 | POPRAWKI-B-9 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-10 | POPRAWKI-B-10 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-11 | POPRAWKI-B-11 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-12 | POPRAWKI-B-12 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-13 | POPRAWKI-B-13 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-14 | POPRAWKI-B-14 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-15 | POPRAWKI-B-15 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-16 | POPRAWKI-B-16 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-17 | POPRAWKI-B-17 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-18 | POPRAWKI-B-18 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-Q-19 | POPRAWKI-B-19 | to samo pytanie z części B, dwa identyfikatory |
| POPRAWKI-B-1…B-19 (numery) | B-1…B-10 w PLAN.md | ten sam przedrostek, inna treść: w rejestrze pytania, w planie pozycje części B |
| D-20 w dawnym PLAN §4 | brak D-20 w rejestrze decyzji | numer oznaczał pocztę zewnętrzną, nie decyzję D-n; zmieniony na nazwę opisową |
| D-34 w dawnym PLAN §4 | D-34 w rejestrze (tydzień dopłaty) | numer oznaczał klucz Trafikverket; zmieniony na nazwę opisową |
| D-19 | wzmianki DEC-5 + D-19 przy SMS | w rejestrze numer nieużyty; starsze wzmianki to inna numeracja |
| D-66…D-76 | brak w ZLECENIE_POPRAWKI_02_10.md | nie odtworzono; plik nie ma tych numerów ani „CZĘŚĆ 2 — NOWE DECYZJE” |
| BRAK-PLIKU-ZLECENIE_ETAP_I | BRAK-PLIKU-ZLECENIE_DLA_GROKA | pliku źródłowego nie ma; pozycja straciła treść |
| D-10 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-11 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-12 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-14 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-16 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-17 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-18 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-2 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-20 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-21 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-22 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-23 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-24 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-25 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-3 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-32 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-33 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-5 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-6 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-7 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-8 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-9 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-1 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-28 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-29 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-4 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-13 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-15 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-34 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-27 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-30 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-31 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-77 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-78 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-79 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-80 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-81 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-82 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-83 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-84 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |
| D-85 | sekcja 1 rejestru | ta sama decyzja wypisana drugi raz jako pozycja |

### Rozstrzygnięcia sprzeczności

- D-8: obowiązuje — «Standard» = transporty NTG (potwierdzenie właściciela 04.10). Zapis „tężniki T” w `PACZKA_DECYZJI_30_09.md` oznaczony „zastąpione 04.10”.
- Kopia `docs/handover/wzorzec/STAN/` przegrywa z `PLAN.md` (m.in. I-3, II-5, II-6, R-2 oraz statusy 0.1 i 0.7 w kopii planu).
- II-7: zrobione. Blokada „ZABLOKOWANE przez D-28” dotyczyła starego planu HERE. Dowód: `supabase/migrations/0122_ii7_eta_osm_corridor.sql`.
- SCOPE: 56.1 wygrywa z 56.2. Wyjątek zastosowany tylko tam, gdzie późniejszy datowany wpis „zrobione” ma istniejący plik, migrację albo test. Wynik jest w tabeli powyżej.
- D-66–D-76: nie dopisane. W `ZLECENIE_POPRAWKI_02_10.md` nie ma tych numerów.

## Liczniki

- Decyzje D-1…D-85 razem: 85
- D-66–D-76: nie odtworzono (brak w `ZLECENIE_POPRAWKI_02_10.md`)
- D-19: numer nieużyty
- D-26: przeniesiona do III-13, zamknięta
- Pozycje sekcji 2 przejrzane ze statusu NIEZNANY: 351
- Z tego „zrobione” z dowodem: 28
- Z tego „do zrobienia”: 323
- Pozycje sekcji 4: 424
- Z sekcji 4 przypisane do etapu albo „już w PLAN”: 107
- Z sekcji 4 „do decyzji koordynatora”: 308
- Powtórzenia i pozycje bez sensu (lista w sekcji 5): 66
