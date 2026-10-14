# Odbiór P5 — wygląd (koordynator, `wyglad/P5`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
Polecenie właściciela 14.10.2026, 16:26 („opracuj kolejny etap po swojej stronie”). Zakres z `PLAN.md` §4 P5: ekrany Finanse, Faktury, Dokumenty, Opcje › Pieniądze, panel (dokumenty, kwoty, okno „Dopłata”).

Ten PR zmienia tylko wygląd i nawigację (F8). Nie zmienia migracji, zapytań, uprawnień ani zapisów. Nowe dane biorą się z `src/lib/p5Source.ts`. Działa to tak:
- w demo przykłady są w `src/lib/p5Demo.ts`, wywoływane tylko przy warunku trybu demo (strażnik I-0, test `p5-finance`);
- w produkcji źródło zwraca `null`, dopóki wykonawca nie podłączy danych z bazy. Do tego czasu sekcja bez danych jest ukryta (paczka tygodnia, zezwolenia „Firma / Trasa”, podpowiedzi dopłat) albo zostaje dzisiejszy formularz (dopłaty, polisy).

Co podłącza wykonawca — dopisek D-20261014-2005-01 (S1–S5).

Zrzuty z podglądu demo, „teraz” = 14.10.2026, 12:00, folder `wyglad-P5/`, zrobione po poprawkach z niezależnego sprawdzenia (narzędzie `p5-evidence.mjs`, obrazy porównawcze `p5-compose.py` — poza repozytorium). Numery faktur, polis, zezwoleń i adresy e-mail w demo są zmyślone (G-09).

## Z3 — element po elemencie

### Finanse (E16, E39, E40) — `porownanie-e16-finanse.png`, `porownanie-e40-paczka.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „Finanse”, liczba wycenionych, waluta z „Dla mnie” | to samo; bez ceny: kody i „brak daty” | tak | — |
| etapy rozliczenia | tabela „Od przychodu do marży”: Zafakturowane, Dostarczone, Prognoza, Razem; marża i % | to samo; KSH „Do zapłaty według etapu”, SCX „Należność według etapu” — jedna kolumna | tak | — |
| marża według rodzaju | tabela rodzajów z marżą | to samo; czerwone tylko poniżej progu z Opcji | tak | E16 „jedna marża wszędzie” — na ekranach P5 bez reguł 12 % / 18 %; zostają w Harmonogramie (`ScheduleView` < 18 %) i w danych (`pricing.ts`, `mappers.ts` < 12 %) — wykonawca, dopisek |
| kurs NBP, flaga marży | karty z boku: ostatnia tabela A, próg 4 %, lista poniżej progu | to samo; próg z `marginThresholdOf` (demo 4 %) | tak | bez progu flaga wyłączona |
| opłata paliwowa (E39) | tabela tygodni: tydzień, wskaźniki, OKQ8, Orlen ze średnią i publikacjami, stosowany, stan | to samo; wiersz rozwija transporty i publikacje; prognoza „ostateczna od …”; telefon — karty | tak | średnie i publikacje z `fuel_basis` — wykonawca; oznaczenie demo (G-08) |
| paczka tygodnia (E40) | dwie paczki: KSH (faktura HHL → KSH) i HHL (faktura SCX → HHL), faktura z PDF, kwoty, transporty z CMR z podpisem, adresy, pliki, „Wyślij” / „Pobierz paczkę (ZIP)”, ślad | to samo; blokady z powodem i kto uzupełnia (brak faktury, PDF, akceptacji HHL — 2A, CMR — 3A, adresu); „Wyślij” szary; ponowna wysyłka z potwierdzeniem; tydzień bez paczki → najnowszy | częściowo | napis „CMR” bez „z podpisem”, dopóki wymaganie w bazie to CMR z załadunku (1B — wykonawca). ZIP w demo: wgrane CMR + opisy plików faktury i zestawienia (bez treści); prawdziwy PDF faktury i zestawienie składa serwer — wykonawca. W produkcji sekcji nie ma do podłączenia adresów i dziennika wysyłek |

### Faktury (E4, E4b) — `porownanie-e4-faktury.png`, `porownanie-e4b-faktoring.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| zakładki | HHL: „Od przewoźnika · koszt” / „Do KSH · przychód” | to samo; strzałki, Home, End; KSH i SCX jedna sekcja | tak | — |
| kafelki | czeka na wystawienie, do (Twojej) weryfikacji, do zapłaty w 7 dni, po terminie | to samo; po terminie z numerem faktury | tak | — |
| obieg | 5 kroków, kto i kiedy | to samo; terminy 35 dni (SCX → HHL) i 30 dni (HHL → KSH) — 03_REJESTR | tak | telefon bez obiegu (jak obraz) |
| lista | tydzień, faktura, transporty, netto, VAT 23 %, brutto, termin, jeden status; „Akceptuj” / „Sporna” | to samo; wiersz „Do wystawienia” z kwotą z cennika; bez osobnego „Zgodna” | tak | — |
| nowa faktura | dwie kolumny: transporty tygodnia, pola, „VAT 23 % · liczy system”, „Brutto · liczy system”, porównanie z cennikiem, „Wyślij do weryfikacji HHL” | dwie kolumny, porównanie, termin, przycisk; pola VAT i brutto wpisywane | częściowo | VAT i brutto liczone przez system, jedna kwota netto zamiast kwot przy pozycjach — wykonawca (zapis) |
| faktoring — wybór SCX | „Standardowo” / „Faktoring HHL” z kwotami | to samo (gdy oferta włączona); kwoty w walucie faktury | tak | oferta z bazy i zapis wyboru — wykonawca; dziś wybór zostaje tylko na ekranie |
| faktoring — zadanie HHL | „Wypłata faktoringu”, termin 48 h, oś | to samo (demo) | tak | zadania z bazy — wykonawca |
| Opcje › Faktoring | „Oferta HHL”: włącznik, kto wypłaca, prowizja, wypłata, dla kogo, wersja, przykład | to samo | tak | w produkcji ekran ukryty (`shows('factoringOffer')`) do podłączenia |
| telefon | kafelki 2 × 2, karty faktur z „Akceptuj” / „Sporna” | to samo; bez tabeli „Kto co widzi” | tak | — |

### Dokumenty (E31) — `porownanie-e31-dokumenty.png`, `wgraj-1440-hhl.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| nagłówek | „Wgraj dokument”, „Paczka tygodnia: t41 · 05.10–11.10 ▾” | to samo; lista tygodni pobiera ZIP | tak | KSH bez „Wgraj” (19:11) |
| wymagania | dokument, kto wgrywa, termin, po terminie, w ciągu 7 dni, uwagi; klik w liczbę → transporty | to samo; bez rysunku, POD i zdjęć mocowania | tak | — |
| CMR | decyzja 1B: tylko CMR z podpisem odbiorcy | nazwa według terminu z bazy: dziś „CMR z załadunku” (wymaganie w bazie: 2 h po załadunku), po zmianie „CMR z podpisem odbiorcy” | częściowo | zmiana wymagania i alarmów — wykonawca |
| polisy | przewoźnika (numer, ważność), HHL („brak” do wgrania) | to samo; KSH — tylko polisa HHL, SCX — tylko swoja (pytanie 3) | tak | numer polisy z bazy — wykonawca; dziś liczba transportów z ważną polisą |
| terminy | tylko do odczytu; zmienia Administrator w Opcjach › Zezwolenia i dokumenty | edytor przeniesiony do Opcji bez zmiany zapisu; Operacje — tylko odczyt | tak | blokada w bazie dla Operacji — wykonawca |
| zezwolenia | tabela „Firma” / „Trasa”: kraj, numer, ważne, limity, dotyczy, transporty | to samo (demo) | tak | w produkcji tabela ukryta do podłączenia rodzaju zezwolenia |
| pliki | filtry tydzień / transport / rodzaj, „Widzą”, „cała firma” | to samo | tak | — |
| okno „Wgraj dokument” | transport (szukaj), rodzaj z brakami na górze, „Firma / Trasa”, plik | to samo; zapis jak dziś do wybranego transportu i rodzaju | tak | nazwa pliku z kodem i „Firma / Trasa” w zapisie — wykonawca |
| telefon | „Wgraj dokument lub zrób zdjęcie”, karty braków z liczbą | to samo | tak | — |

### Panel transportu — Ceny (E33), Dokumenty (E31 pkt 5) — `porownanie-e33-ceny.png`

| element | obraz raportu / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| tabela ceny | „Koszt · SCX / Przychód · KSH”: fracht, opłata paliwowa (tydzień · mnożnik), dopłaty, razem | to samo | tak | demo w PLN, bo domyślna waluta wyświetlania w aplikacji to PLN; E16 — EUR domyślnie (wykonawca) |
| marża, kurs | marża EUR i %, linia w PLN z kursem | to samo; kolor według progu z Opcji | tak | — |
| karta opłaty paliwowej | tydzień, wskaźniki, OKQ8, Orlen, stosowany, stan, ▸ publikacje | to samo; „publikacje” prowadzi do Finansów | tak | — |
| KSH / SCX | „Twoja cena” / „Twoja stawka”, bez napisu o cudzej cenie | to samo | tak | — |
| dopłaty | postój (pomiar albo powód braku), anulowanie; „+ Dopłata” | to samo (demo); decyzja osobno po stronie HHL (przychód) i SCX (koszt); dopłatę dodaną przez SCX HHL akceptuje albo odrzuca; dodaną przez HHL akceptuje KSH | tak | w produkcji zostaje dzisiejszy formularz dopłat do podłączenia podpowiedzi |
| okno „Dopłata” | rodzaj, wyliczenie, „Przychód · KSH (Twoja strona)” / „Koszt · SCX”, opis, „Nie dodaję” / „Dodaj” | to samo; Esc zamyka okno, nie panel; fokus zostaje w oknie | tak | zapis osobnych kwot kosztu i przychodu, akceptacje — wykonawca; w demo stan zostaje na ekranie |
| zasady cennika | czas wolny, 75 EUR / h, 750 EUR / doba, procenty anulowania | to samo | tak | wartości z bazy — wykonawca |
| panel Dokumenty | wymagane ze stanem, „Wgraj”, polisy (AUTO / HHL), „Inne pliki” z „+ Dodaj”, „Pobierz wszystkie (ZIP)” | to samo bez „+ Dodaj” przy „Inne pliki”; polisa HHL bez danych — „—” | częściowo | „+ Dodaj” wraca z rodzajem „Inne” (OTHER) — wykonawca. Stan i terminy wymagań: te same co na stronie Dokumenty (odczyt z bazy po jej otwarciu); w produkcji bez tego odczytu panel pokazuje tylko „jest / brak”, bez dat — wykonawca podłącza `doc_requirements_status` w panelu |
| telefon | karty koszt / przychód / marża (marża też w PLN), zwinięte paliwo, dopłaty, zasady, „+ Dopłata” | to samo | tak | nagłówek panelu zawija nazwę — „✕” zostaje na ekranie przy 360 px |

## Różnice, które zostają

| różnica | gdzie | zamyka |
|---|---|---|
| VAT i brutto wpisywane ręcznie, kwoty przy pozycjach faktury | Faktury › nowa faktura | wykonawca (E4: system liczy VAT 23 %, jedna kwota netto) |
| faktury przykładowe w demo mają VAT 0,00 (dane sprzed E4), choć kolumna to „VAT 23 %” | Faktury, paczka tygodnia (demo) | znika, gdy system liczy VAT (E4) — wiersz „Do wystawienia” już liczy 23 % |
| „CMR z załadunku” zamiast „CMR z podpisem odbiorcy” | Dokumenty, panel | wykonawca (decyzja 1B, L26) |
| tabela zezwoleń, paczka tygodnia, podpowiedzi dopłat, numery polis — tylko demo | Dokumenty, Finanse, panel | wykonawca — D-20261014-2005-01 |
| domyślna waluta wyświetlania PLN | cała aplikacja | wykonawca (E16: EUR domyślnie) |
| adresy księgowości w Opcjach (E40) i treść e-maila (E43) | Opcje | wykonawca razem z wysyłką (E40), wygląd ekranu — kolejny `wyglad/*` |
| „Załączniki CMR” na stronie Faktury | Faktury | znika, gdy CMR z podpisem trafia do faktury automatycznie (E4, E31) |
| próg marży 18 % w Harmonogramie i 12 % w danych | Harmonogram, `pricing.ts`, `mappers.ts` | wykonawca (E16: jeden próg z Opcji) |
| wybór „Standardowo / Faktoring HHL” bez zapisu | Faktury (SCX) | wykonawca (zapis wyboru, zadanie HHL) |
| „+ Dodaj” przy „Inne pliki” | panel › Dokumenty | wykonawca (rodzaj „Inne” — OTHER w aplikacji) |
| terminy wymagań w panelu tylko po otwarciu strony Dokumenty | panel › Dokumenty (produkcja) | wykonawca (`doc_requirements_status` w panelu) |

## Ograniczenia w interfejsie (do wiadomości wykonawcy)

Wygląd niczego nie zapisuje inaczej niż dziś, ale część przycisków jest ukryta albo zawężona. Blokady w bazie dopisuje wykonawca.

| co | gdzie | dlaczego |
|---|---|---|
| nie ma przycisku „Zgodna”; zostaje „Akceptuj” i „Sporna” z powodem | Faktury (lista i szczegóły) | E4 — jeden status; „Akceptuj” na liście ustawia „Zaakceptowana” tą samą akcją co w szczegółach (`verifyBill`) |
| terminy dokumentów zmienia tylko Administrator HHL; Operacje widzą je tylko do odczytu | Opcje › Zezwolenia i dokumenty | E31 — blokada w bazie dla Operacji: wykonawca |
| oferta faktoringu tylko do odczytu dla Operacji HHL | Opcje › Faktoring | E4b — zmienia Administrator HHL |
| KSH nie ma „Wgraj” w panelu ani na stronie Dokumenty | panel, Dokumenty | decyzja 19:11 — KSH nic nie wgrywa |
| okno „Wgraj dokument” przyjmuje tylko zezwolenie PL, zezwolenie SE i CMR | Dokumenty, panel | E31 — polisy wgrywa się raz w „Polisy” (G-21), nie przy transporcie |

## Konta (Z11)

| konto | zrzuty | różnica |
|---|---|---|
| HHL Administrator | `finanse-1440-hhl`, `faktury-1440-hhl*`, `paczka-1440-hhl`, `dokumenty-1440-hhl`, `wgraj-1440-hhl`, `panel-*-1440-hhl`, `doplata-1440-hhl`, `telefon-390-hhl-*` | wszystko; terminy dokumentów i faktoring zmienia |
| HHL Operacje | jak HHL w demo | terminy dokumentów i oferta faktoringu tylko do odczytu |
| KSH Użytkownik | `finanse-1440-ksh`, `faktury-1440-ksh`, `dokumenty-1440-ksh`, `panel-*-1440-ksh`, `telefon-390-ksh-*` | tylko swoja cena, faktury HHL → KSH, polisa HHL; nic nie wgrywa |
| SCX Dyspozytor i Użytkownik | `finanse-1440-scx`, `faktury-1440-scx*`, `dokumenty-1440-scx`, `panel-*-1440-scx`, `doplata-1440-scx`, `telefon-390-scx-*` | tylko swoja stawka i faktury; wgrywa zezwolenia i CMR; decyduje o dopłacie po swojej stronie |

## Sprawdzenia (lokalnie, podgląd demo)

- `tsc -b`: 0 błędów.
- `test:unit`: 1018 testów przechodzi, 37 pominiętych. Nowe testy: `p5-finance`, `p5-invoices`, `p5-pack`, `p5-docs`, `p5-fees` (w tym panel „Ceny” bez daty załadunku — produkcja, `fuel_ref_date = null`).
- `lint:css`: 0 błędów. `stylesheet-mockup`: bez nowych odstępstw.
- Pierwsze wczytanie: 385,1 kB gzip (budżet 400 kB). Finanse, Faktury, Dokumenty i zakładki panelu ładują się leniwie.
- Brama E8: całość przechodzi, w tym bloki P5 (Finanse, Faktury, Dokumenty, panel — 3 role, 360 / 390 / 430 px).
- Przechodzą też: `etap4-ui`, `etap5-ui`, `etap6-ui`, `aud01e-map-pool`, `aud03-ksh-panel`, `b7-map`, `d-eur-t`, `e2e-core`, `persist-toast`, `pr7-compress`, `resp14-phone` — razem z bramą E8 105 / 105 (14.10, 20:20, po poprawkach).
- Przepisane testy:
  - `etap4-ui` M6 (zakładka przychodu), M8 (tabela cen), M11;
  - `etap5-ui` D15 (paczka tygodnia);
  - `b4a-fin-no-pilot`, `b32-insurance-cover`, `i2-facade`;
  - `e8-phone-gate` (karty Finansów i Dokumentów);
  - lokalny `iii6-docs.local` (zmiana terminu w Opcjach);
  - `scripts/baseline.mjs` klika zakładkę przychodu.
