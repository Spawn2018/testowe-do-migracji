# Odbiór P7 — wygląd, część a: panel transportu › Przegląd i okno Awizacja (koordynator, `wyglad/P7-a`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), obraz `img/e32-after.webp`. Dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
Polecenie właściciela 14.10.2026, 23:56 („opracuj kolejny etap po swojej stronie”). Zakres z `PLAN.md` §4 P7, punkt E32: panel transportu (Przegląd) i okno Awizacja, komputer i telefon. Harmonogram, import pliku i E20 (E38, E30, E20) — część b, osobna gałąź.

Ten PR zmienia tylko wygląd i nawigację (F8). Nie zmienia migracji, uprawnień ani zapisów. Nie dodaje zapytań:
- okno Awizacja zapisuje tak jak dotąd: `updateResources`, `setOrderNo`, `assignSailing`; walidacja (kierowca i ciągnik) bez zmian;
- numer SCX w Przeglądzie — ten sam `setOrderNo`; daty KSH — to samo okno `KshDatesModal`;
- Przegląd przestał wołać „Kontrolę trasy” i „Przeszkody wzdłuż korytarza” (E32 „Znika”).

Nowe dane biorą się z `src/lib/p7Source.ts`:
- w demo przykłady z `src/lib/p7Demo.ts` (tabela symboli właściciela z 07.10, zmyśleni piloci), wołane tylko za warunkiem trybu demo (strażnik I-0, test `p7-awiz`);
- w produkcji `null` / `false`. Wtedy nie ma rodzaju zezwolenia, pilotów, sekcji „Piloci” w oknie ani „Popraw awizację”. Zestaw jest z pól transportu, a lista pilotów z bazy (`EscortPanel`) zostaje jak dotąd.

Co podłącza wykonawca — dopisek D-20261015-0130-01 (P1–P8).

Zrzuty z podglądu demo, folder `wyglad-P7-a/`:
- SG-19 (bez awizacji, załadunek sob 17.10) — „teraz” = 17.10.2026, 08:30;
- K-03 (KR, piloci) — 07.10.2026, 16:00;
- reszta — 14.10.2026, 12:00.

Osoby, telefony (pula fikcyjna +48 000 000 0xx) i piloci (WX 0000x, ABC 00x) są zmyśleni (G-09).

## Z3 — element po elemencie

### Przegląd — komputer (E32 pkt 1–8) — `porownanie-e32-komputer.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „SG-15 brak nr HHL · PLANOWANY”, Odbiorca · Załadunek „czw 08.10 · t41” · Dostawa | to samo; brak numeru na czerwono („brak nr HHL” / „brak nr SCX”, E41) | tak | pasek śledzenia (E27, P4-b) zostaje nad zakładkami |
| kolejność | Do zrobienia → mapa → Plan i ETA → Awizacja / Kierowcy i zestaw → Ładunek i zestaw → Numery → Dokumenty → PDF | to samo (`data-po`: plan, awiz, cargo, numbers, docs) | tak | — |
| Do zrobienia przy tym transporcie | „· 4”, „ZAŁADUNEK DZIŚ”, sprawa z firmą i terminem („SCX · pilne od 07.10, 12:00”), przycisk tylko dla firmy, która to robi | to samo z listy E7 (P6-a) dla tego transportu; HHL „Dodaj” przy sprawie numeru HHL, SCX „Uzupełnij” / „Wgraj” / „Ceny” | tak | w demo SG-09 ma wpisane zasoby i otwarte sygnały braku (dane demo); w produkcji jedna definicja L3_AWIZ (dopisek P1) |
| KSH | bez Do zrobienia, linia stanu „Awizacja: przewoźnik uzupełnia” | to samo; przy części „(brakuje: …)” | tak | — |
| mapa | zoom 11 / cała trasa z powodem (E1) | dzisiejsza mapa transportu | nie | E1 — P9 (PLAN §4 P7: „P7 jej nie zmienia”) |
| Plan i ETA | „czw 08.10.2026 · godzina nie podana”, miejsce, „z harmonogramu KSH · import 01.10, 21:43”, „KSH może zmienić do wjazdu na załadunek”, ETA „–” do wyjazdu | to samo; po zmianie dat „zmienił Imię Nazwisko // Firma, …”; bez „potwierdził” bez osoby; ETA — blok E15 | tak | ETA jako blok E15 (img/e15-after), do którego odsyła E32 pkt 4; „Jak działa” z E15 |
| Awizacja (bez kierowcy) | „Awizacja · uzupełnia SCX BRAK”, Kierowca —, Ciągnik · naczepa — · —, Link —, Rejs „wybiera SCX z rozkładu w awizacji” | to samo; przy części „BRAKUJE n” | tak | przycisk: SCX „Uzupełnij awizację” / „Edytuj awizację”, HHL „Popraw awizację” (demo) |
| Kierowcy i zestaw | odcinki PL / SE z „Zadzwoń”, odcinek „teraz” wyróżniony; naczepa, link „wpisany”, rejs | to samo (E6); jeden kierowca — „Kierowca · odbiór i dostawa · Śrem → Boden” | tak | telefon według `visibleDriverPhone` jak dotąd |
| piloci | tylko „PL + SE” (KR, PL-B): pilot PL, pilot SE | wiersze „Pilot PL / SE” — „brak · uzupełnia SCX” albo numer i nazwisko (K-03) | tak | produkcja po P3 dopisku |
| Ładunek i zestaw | „Słupy główne · SG · 7 szt. · 20,44 t”, wymiary ładunku, „Zestaw z ładunkiem 21,69 × 2,45 × 3,75 m [Zmień] z Twojej tabeli (SG) · zmienia HHL”, „FIRMA podpina się samo” | to samo; „z tabeli HHL (SG)” albo „wpisane przy transporcie”; „TRASA wgrywa SCX do transportu” przy KR | tak, bez „Zmień” | „Zmień” po zapisie dla HHL (dopisek P2 pkt 3) |
| Numery zleceń | HHL „brak [Dodaj]”, SCX „brak · wpisuje SCX” | to samo; SCX wpisuje swój numer w miejscu; KSH bez sekcji (E41) | tak | — |
| Dokumenty | „Zezwolenie PL, SE — brak · po terminie”, „CMR z załadunku — do 2 h po załadunku”, „Polisa SCX …”, „Dokumenty →” | to samo z wymagań E31 (P5); „niezgodne z zestawem” przy `permitFits = false` | tak | polisa HHL — w zakładce Dokumenty |
| znika | „Kontrola trasy”, „Przeszkody”, profil trasy, czerwony baner zezwolenia, „potwierdził KSH” | nie ma | tak | klucz fasady `permitNumber` usunięty (I-2: 9 → 8) |
| PDF | „PDF transportu (+ mapa)” | to samo | tak | — |

### Okno Awizacja (E32 pkt 6–7; D-20261009-1233-01; R1) — `porownanie-e32-okno.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „Awizacja · SG-15 brak nr SCX załadunek czw 08.10 · Śrem” | to samo | tak | — |
| „Brakuje” | „Brakuje: kierowca, telefon, ciągnik, naczepa. Pilne od 07.10, 12:00 (12 h przed dniem załadunku).” | to samo, liczone na bieżąco z pól okna; z godziną z planu „(12 h przed załadunkiem)” jak `l3_anchor` | tak | komplet — „Awizacja kompletna.” |
| odcinek kierowcy | „KIEROWCA · ODBIÓR I DOSTAWA · ŚREM → BODEN”: imię i nazwisko, telefon „PL ▾”, ciągnik | to samo; przy przepięciu „ODCINEK PL · ŚREM → PROM” i „ODCINEK SE · PROM → BODEN” | tak | puste pola z czerwoną krawędzią |
| naczepa, przepięcie | „NACZEPA (JEDNA NA CAŁĄ TRASĘ)”, „Przepięcie naczepy — po zaznaczeniu pojawia się …” | to samo | tak | — |
| link śledzenia | pole jak dziś (E27), RIO rozpoznawany (E44) | pole z P4-c (E44) z etykietą jak inne pola | tak | „Otwórz w RIO” w produkcji — PR #203 (dopisek P7) |
| armator, rejs | „ARMATOR Polferries ▾”, „REJS DO SZWECJI” | to samo; statek w nazwie rejsu | tak | dawny wiersz „Statek: …” usunięty (nie ma go w obrazie) |
| numery | „NR ZLECENIA SCX” (wymagane), „NR ZLECENIA HHL — wpisuje HHL” szare | to samo | tak | KSH bez numerów |
| piloci | „Piloci 2 BRAKUJĄ”, opis z zestawu, konwój, „PILOT PL · ŚREM → GDAŃSK” i „PILOT SE · NYNÄSHAMN → BODEN”: numer rejestracyjny, imię i nazwisko | to samo (K-03); konwój KR z tą samą datą — jedna linia i zapis dla wszystkich kodów | tak | „Tabela HHL” zamiast „Twoja tabela” (okno widzi SCX) |
| stopka | „Można zapisać część …”, „Anuluj”, „Zapisz” | to samo | tak, tekst | zapis części — dopisek P1 pkt 3 |
| KSH | tylko ogląda (E32 pkt 6) | pola wyłączone, „Awizację robi SCX. Ty ją oglądasz.”, „Zamknij” | tak | wejście tylko z adresu `?zakladka=awizacja` |

### Telefon (E32 pkt 9, E8) — `porownanie-e32-telefon.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „← SG-15 brak nr HHL PLANOWANY” | to samo; strzałka zamyka panel („Wróć do listy”), bez ✕ | tak | — |
| zakładki | przewijane w bok | to samo | tak | — |
| Do zrobienia | na górze, „Do zrobienia · 4”, przyciski | to samo | tak | — |
| mapa | 150 px | 150 px | tak | — |
| sekcje | zwinięte z linią stanu: „Plan · czw 08.10 → śr 14.10 · ETA –”, „Awizacja brak”, „Ładunek i zestaw · SG · 21,69 m”, „Numery brak obu”, „Dokumenty 1 brak” | to samo; wiersz ≥ 44 px | tak | — |
| okno Awizacja | na cały ekran | na cały ekran (390 px), pola ≥ 16 px, „Anuluj” i „Zapisz” 44 px | tak | — |

## Z4 — różnice, które zostają

| różnica | gdzie | dlaczego |
|---|---|---|
| mapa bez zoomu 11 i bez powodu „Brak pozycji …” | Przegląd | E1 — P9 |
| „Zmień” przy „Zestaw z ładunkiem” | Przegląd | brak zapisu zestawu dla HHL (dopisek P2 pkt 3) |
| piloci, rodzaj zezwolenia i zestaw z tabeli tylko w demo | Przegląd, okno | tabela symboli i piloci w bazie (P2, P3) |
| „Popraw awizację” tylko w demo | Przegląd | prawa HHL Administrator w bazie (P4) |
| zapis bez kierowcy albo ciągnika odrzucany | okno | walidacja to logika (P1 pkt 3) |
| sprawa „Daty KSH do sprawdzenia” | Do zrobienia | sygnał w bazie (P5 pkt 2) |
| ETA jako blok E15, nie jeden wiersz | Plan i ETA | E32 pkt 4 odsyła do E15 (img/e15-after) |

## Konta (Z11)

| konto | zrzuty | różnica |
|---|---|---|
| HHL Administrator i Operacje | `przeglad-SG-09-HHL-desk`, `przeglad-SG-19-HHL-*` | Do zrobienia z „Dodaj” nr HHL; „Popraw awizację” (demo; w produkcji tylko Administrator — P4) |
| SCX Dyspozytor i Użytkownik | `przeglad-SG-19-SCX-*`, `przeglad-SG-08-SCX-*`, `przeglad-K-03-SCX-*`, `przeglad-SG-01-SCX-*`, `okno-*` | „Uzupełnij / Edytuj awizację”, numer SCX w miejscu, piloci przy KR |
| KSH Użytkownik | `przeglad-SG-19-KSH-*` | linia stanu zamiast Do zrobienia, „Edytuj” daty, bez numerów i przycisków awizacji |

## Sprawdzenia (lokalnie, podgląd demo)

- `tsc -b`: 0 błędów; `lint:css`: 0 błędów; gitleaks: 0.
- `test:unit`: 1070 przechodzi, 37 pominiętych; strażnik produkcji `i0-prod-guard`: 7 / 7. Nowy test `p7-awiz` (16): jedna definicja awizacji (odcinek SE, piloci), termin 48 / 12 h (z godziną i bez, czas letni i zimowy), dni tygodnia, tabela symboli, konwój KR, I-0 i brak zapytań w nowych plikach.
- Brama E8: nowy blok P7-a (komputer HHL, SCX, KSH; telefon HHL, SCX, KSH przy 360 / 390 / 430 / 768 px, także sekcje rozwinięte i okno Awizacja) — 4 / 4. Cały zestaw Playwright: poza 3 testami nie przechodzącymi tak samo na `main` (lokalne czcionki w zrzutach `visual` i `visual-states`, `d19-i18n` — „lang missing: en”) — zielony; w GitHub Actions decyduje `visual`.
- Pierwsze wczytanie: 382,8 kB gzip (budżet 400 kB); Przegląd ładuje się leniwie.
- Przepisane testy: `e2e-core` (awizacja: „Uzupełnij / Edytuj awizację”, „Awizacja · …”), `aud03-ksh-panel` (test: „Edytuj” w Przeglądzie; spec: „Plan” rozwijany na telefonie), `i2-facade` (rejestr 8 kluczy), `e8-phone-gate` P4-c (sekcja „Awizacja” rozwijana na telefonie).
- Przegląd niezależny (agent bez udziału w pracy): 1 blokada (fałszywe „Polisa HHL: brak” w produkcji) i 6 uwag — poprawione: polisa jak w zakładce Dokumenty, termin od godziny załadunku, odcinek SE bez przepięcia, „Dodaj” tylko przy sprawie numeru HHL, wiersz zezwolenia z brakującego, KSH tylko ogląda; zapis części i definicja L3_AWIZ — dopisek P1.
