# ZLECENIE — DECYZJE PO SPOTKANIU Z PRZEWOŹNIKIEM (29.09.2026)

> 27 decyzji właściciela po spotkaniu ze Scandinavian Express + odpowiedzi
> na pytania koordynatora. **Zastępuje sprzeczne wcześniejsze ustalenia**
> (lista w §0). Dane osobowe (odbiorcy SMS po stronie KSH) wprowadza właściciel
> w aplikacji — **nie ma ich i nie może być w repozytorium**.

## §0. Co przestaje obowiązywać
| Było | Jest |
|---|---|
| SMS do kierowców (rodzaje 1–5, 8, 9) | **brak SMS do kierowców**; bramka SMS tylko dla KSH (§5) |
| aplikacja kierowcy: GPS z telefonu, zdjęcia, POD, potwierdzenie rozładunku | **ukryta** (kod zostaje); pozycje z telematyki (§2); CMR wgrywa dyspozytor |
| POD i zdjęcia mocowania | **rezygnacja** — tylko skan CMR |
| I-32: opłaty dodatkowe liczone automatycznie | **żadnych opłat automatycznie** (§8) |
| „Potwierdź daty" w TOWER (I-18) | **usunąć** — KSH podaje datę i godzinę w pliku (§7) |
| faktury wyłącznie w EUR | **waluta faktury EUR albo PLN**, wybór przy wystawieniu (§9) |
| mechanizm wycofania zgody RODO (SHAREPOINT §1a) | **nie budujemy** — temat RODO zamknięty |
| progi sztormowe „wstępne" | **potwierdzone:** fala 3,8 m, porywy 40 węzłów |
| D-34 | **zamknięte:** tydzień SEFS według daty **załadunku** (załącznik BAF) |
| logowanie linkiem e-mail | **logowanie hasłem**; e-mail tylko do zaproszenia i odzyskania hasła (§1) |
| aplikacja pod ekran komputera | **pełna responsywność + instalacja jako aplikacja na telefonie** (§14) |
| nazwa „TOWER" i dotychczasowe ikony | **„WATCH TOWER" i nowe logo** (§15) |
| numer HHL tylko w awizacji | **HHL dodaje i edytuje numer HHL samodzielnie** (§4a) |

---

## §1. LOGOWANIE HASŁEM · P0
Przyczyna problemów (logi 29.09): `429 email rate limit exceeded` — limit Supabase
30 e-maili/h wyczerpany przez powtarzane próby osób **bez zaproszenia**.
**Decyzja właściciela: logowanie hasłem.**
1. **zaproszenie** (e-mail z linkiem) → strona **„Ustaw hasło"** → konto aktywne
2. **logowanie: e-mail + hasło** — zero e-maili przy codziennej pracy
3. **„Nie pamiętam hasła"** → e-mail z linkiem → strona ustawienia nowego hasła
4. **strona pośrednia dla każdego linku z e-maila:** nasza strona z przyciskiem
   „Dalej" → dopiero wtedy weryfikacja tokenu. Firmowe skrzynki skanują linki
   i zużywają jednorazowy token (w logach 29.09: „email link has expired")
5. adres bez zaproszenia → **żaden e-mail nie wychodzi**, komunikat „Brak
   zaproszenia — skontaktuj się z HHL" (dziś: błąd 500)
6. hasło: min. 12 znaków; pokazywanie wpisywanego hasła przyciskiem; menedżery
   haseł i autouzupełnianie działają (`autocomplete="current-password"` /
   `"new-password"`)
7. jasne komunikaty dla każdego błędu: złe hasło, limit prób, link wygasł, brak zaproszenia
8. sesja 365 dni bez zmian; administrator — weryfikacja dwuetapowa bez zmian
9. obecni użytkownicy (logujący się linkiem) — przy następnym wejściu prośba
   o ustawienie hasła
Kryterium: 20 kont loguje się hasłem w ciągu 5 minut z jednego adresu IP bez
błędu i bez wysłania e-maila; próba bez zaproszenia nie wysyła e-maila; link
otwarty najpierw przez skaner, potem przez człowieka — człowiek ustawia hasło.

## §2. TELEMATYKA · P1 (czeka na dane)
- **emtrack.eu** — system przewoźnika, dostęp przez API. **Dokumentacja — właściciel
  dostarczy.** Teraz: szkielet adaptera (tabela źródeł pozycji, zapis pozycji do
  istniejącej tabeli GPS, dopasowanie auta do transportu po nr rejestracyjnym)
- **linki śledzenia od podwykonawców** — pole „link śledzenia" w awizacji (§4),
  w podglądzie transportu przycisk „Śledź u przewoźnika". **Przykłady linków —
  właściciel dostarczy**; potem ocena, czy da się czytać pozycję automatycznie
- **do czasu API — statusy ręcznie:** dyspozytor przewoźnika i HHL ustawiają
  status przyciskiem (z dziennikiem); strefy działają automatycznie, gdy są pozycje
- data rozładunku (data usługi, kurs) = wyjazd ze strefy placu z telematyki,
  a bez niej — potwierdzenie dyspozytora

## §3. STENA LINE GDYNIA – KARLSKRONA · P1
**Wszystko to samo co dla Polferries Gdańsk – Nynäshamn:**
- armator i statki w słownikach; MMSI statków — **zweryfikuj u źródła**
- rozkład rejsów w `sailings`; komunikaty o rejsach (odczyt jak II-5) — **najpierw
  regulamin i `robots.txt`** (skill `tower-nowa-integracja`)
- pozycje AIS — sprawdź zasięg Digitraffic przy Gdyni i Karlskronie; brak zasięgu
  ≠ opóźnienie
- pogoda na trasie promu (FMI/DMI/SMHI) — punkty: Gdynia, środek trasy, Karlskrona;
  progi 3,8 m / 40 kn
- strefy: terminal Gdynia, terminal Karlskrona
- korytarz OSM: Śrem – Gdynia oraz Karlskrona – Boden; warunki drogowe SE
  (Trafikverket) na nowym odcinku
- ETA: osobne odcinki i osobna kalibracja dla trasy Stena
- **trasa alternatywna w ryzykach (pkt 19):** przy odwołaniu rejsu albo sztormie
  na trasie Polferries — propozycja rejsu Stena, **tylko jeśli** na trasie Stena
  nie ma odwołań ani sztormu (i odwrotnie)
- rezerwacja promu i jej koszt — po stronie przewoźnika; cena transportu bez zmian

## §4. AWIZACJA — PRZYCISK „DODAJ" / „EDYTUJ" I OKNO · P1
**Nie przez sekcję „Ustalenia".** W podglądzie transportu (panel z prawej) mały
przycisk **„Dodaj"** → **osobne okno** nad panelem. **Gdy awizacja już jest —
w tym samym miejscu przycisk „Edytuj"**: to samo okno, wypełnione zapisanymi
danymi. Zmiana względem makiety — zatwierdzona.

**Pola (zgodne z kolumnami pliku KSH):**
- **kierowca:** imię i nazwisko, telefon (walidacja z prefiksem kraju)
- **nr rej. ciągnika · nr rej. naczepy**
- **nr zlecenia przewoźnika** — wpisuje przewoźnik (z systemu SCX); w pliku KSH
  kolumna „Nr zlecenia"
- **nr zlecenia HHL** — wpisuje HHL (z systemu HHL); w pliku kolumna „Nr zlecenia HHL";
  jeśli jest już w pliku — podpowiedziany i tylko do odczytu dla przewoźnika
- **link śledzenia** podwykonawcy albo identyfikator w emtrack
- **armator → rejs → statek:** listy zależne — armator; rejsy tylko tego armatora,
  na które auto zdąży (planowany dojazd do portu + odprawa); statek ustawia się sam

**Zasady:**
- podpowiedzi z wcześniej używanych kierowców i aut; ostrzeżenie o duplikacie
- kto: dyspozytor przewoźnika (swoje transporty), HHL, administrator
- **„Edytuj":** zmiana dowolnego pola; w historii zmian było → jest, kto, kiedy;
  zmiana kierowcy, auta albo rejsu → powiadomienie HHL i KSH; zapis zwrotny do pliku KSH
- usunięcie awizacji — tylko HHL, z powodem, w historii
Kryterium: awizacja w ≤ 6 kliknięciach; po zapisie przycisk zmienia się na „Edytuj";
nie da się wybrać rejsu, na który auto nie zdąży; statek zawsze zgodny z rejsem;
edycja zapisuje różnicę w historii i aktualizuje plik KSH.

## §4a. NUMER ZLECENIA HHL — DODAWANIE I EDYCJA PRZEZ HHL · P1
- **użytkownik HHL (HHL_OPS) i administrator** dodają i edytują „Nr zlecenia HHL"
  **samodzielnie**, bez awizacji: w podglądzie transportu pole z przyciskiem
  „Dodaj" / „Edytuj" (ten sam wzorzec co awizacja) oraz w oknie awizacji
- przewoźnik i KSH — tylko odczyt
- walidacja: niepuste, bez spacji na końcach; ostrzeżenie, gdy ten sam numer jest
  już przy innym transporcie
- każda zmiana w historii (było → jest, kto, kiedy) i **zapis do pliku KSH**
  (kolumna „Nr zlecenia HHL")
- zmiana tej komórki w pliku przez kogoś innego → import do TOWER z historią;
  gdy od ostatniej synchronizacji zmieniono **i** w TOWER, **i** w pliku — ryzyko
  HHL „konflikt numeru zlecenia", bez nadpisywania

## §5. POWIADOMIENIA I SMS DLA KSH · P1
- **strefa załadunku KSH (Śrem):** te same zdarzenia i powiadomienia co dla
  dostaw na plac Stegra (zbliża się, wjechał, wyjechał)
- **SMS — ZMIANA 29.09:** 2 osoby na załadunku i 2 na rozładunku, przy przekroczeniu
  stref (zbliżanie i wjazd) — `ZLECENIE_DECYZJE_POWIADOMIENIA.md` §5
- odbiorcy — lista w ustawieniach (imię, telefon), **wprowadza właściciel**;
  nigdy w repozytorium ani w testach
- bramka SMS na telefonie z Androidem (istniejąca kolejka `sms_outbox`) —
  nowy rodzaj SMS; rodzaje dla kierowców wyłączone
- limit 150/dobę bez zmian

## §6. OPÓŹNIENIE I CZAS PRZEJAZDU · P1
- **godzina dostawy od KSH = „najpóźniej do"** — opóźnienie od tej godziny
  (reguła I-25: plan_delivery_to = godzina z pliku)
- godzina załadunku od KSH — oczekiwany przyjazd na strefę Śrem
- **tranzyt: 4 dni, 5 przy ciężkiej pogodzie w Szwecji** (przewoźnik) — wiedza
  wstępna ETA dopasowana do 4 dni (odcinek „rezerwa operacyjna", uczony w II-7b);
  ciężka pogoda z II-6/II-8 → korekta do 5 dni
- **wyprzedzenie 5 dni (D-12):** zmiana daty w pliku KSH na mniej niż 5 dni
  przed załadunkiem → ryzyko „późna zmiana" + powiadomienie przewoźnika

## §7. DATY Z PLIKU KSH · P1
KSH wpisuje **datę i godzinę** załadunku i dostawy w Excelu na SharePoint
(II-10). Przewoźnik się dostosowuje. **„Potwierdź daty" usunąć** — plik jest
źródłem. Historia zmian komórek (II-10) pokazuje, co i kiedy KSH zmieniło.

## §8. OPŁATY DODATKOWE — WYŁĄCZNIE RĘCZNIE · P1 (zastępuje I-32)
**Nic nie nalicza się automatycznie** (podejście partnerskie).
- HHL dodaje ręcznie pozycję „dopłata uzgodniona": rodzaj (postojowe, anulowanie,
  inne), kwota EUR, strona (koszt, przychód lub obie), opis uzgodnienia; dziennik
- cennik opłat (czas wolny 6/4 h, 75 EUR/h, 750 EUR/doba, procenty anulowania)
  — jako **podpowiedź** przy dodawaniu, nie automat
- zmierzony czas postoju ze stref — **informacja dla HHL**, bez kwoty
- pusty przebieg — nie obsługujemy

## §9. FAKTURY · P1
- faktury wystawiają systemy fakturowe HHL i przewoźnika — **osobny kurs EUR dla
  każdego transportu**
- **waluta faktury: EUR albo PLN** — wybór przy rejestracji faktury (HHL i przewoźnik);
  przy PLN kwota każdej pozycji = EUR × kurs NBP A tego transportu
- marża liczona zawsze w EUR (pozycje PLN przeliczane wstecz tym samym kursem)
- zestawienie tygodniowe dla systemu fakturowego: transport, numery zleceń,
  kwota EUR, data rozładunku, kurs, kwota PLN

## §10. ADMINISTRATOR MOŻE WSZYSTKO · P1
- konto HHL_ADMIN wykonuje **każdą czynność każdego innego konta** i zmienia
  każde ustawienie każdego konta
- tryb **„Działaj jako"**: wybór konta → widok i uprawnienia tego konta, wyraźny
  pasek „Działasz jako …", wyjście jednym kliknięciem
- w dzienniku każdy wpis: **faktyczny wykonawca (administrator) + konto, jako
  które działał**
- tylko z weryfikacją dwuetapową administratora (gdy włączona)

## §11. PEŁNA HISTORIA ZMIAN · P1
- **każda zmiana w każdej tabeli biznesowej** — nie tylko 7 obecnych; także
  zmiany kont, uprawnień, ustawień, awizacji, dokumentów
- widok **„Historia zmian"** (HHL_ADMIN): filtry kto / kiedy / obiekt / rodzaj
  zmiany, wyszukiwanie, było → jest, eksport
- zmiany wprowadzone przez automaty (import SharePoint, telematyka, kurs) —
  oznaczone jako automatyczne ze źródłem

## §12. INTERFEJS · P2
- **zalogowany użytkownik, jego rola i „Wyloguj" — do lewego paska menu**
  (dziś zasłaniają pola). Zmiana względem makiety — zatwierdzona
- POD i zdjęcia mocowania — usunąć z interfejsu; CMR (zdjęcie lub skan) wgrywa
  dyspozytor przewoźnika albo HHL

## §13. ZEZWOLENIA · P2 (czeka na dane)
Przewoźnik poda **wymiary aut dla każdego rodzaju towaru** → automatyczne
przypisanie zezwoleń według zestawu + ręczne dodawanie zezwoleń na trasę.

## §14. PEŁNA RESPONSYWNOŚĆ I INSTALACJA NA TELEFONIE · P1
Użytkownicy pracują także na telefonach: **Chrome → „Zainstaluj aplikację" /
„Dodaj do ekranu głównego"**. Aplikacja ma być czytelna i wygodna w pracy,
nie tylko „mieścić się". Zmiana względem makiety (która jest pod komputer) —
**zatwierdzona**; styl, kolory i typografia — z makiety.

**Instalacja (PWA):**
- manifest: nazwa „TOWER", ikony 192 i 512 px (także maskowalna), `start_url`,
  `display: standalone`, kolor motywu z makiety
- service worker: pamięć podręczna **wyłącznie** statycznych plików aplikacji
  z wersjonowaniem; **nigdy** odpowiedzi API, danych ani logowania
- po wdrożeniu nowej wersji — komunikat „Dostępna nowa wersja — odśwież"
- ekran bez sieci: „Brak połączenia" zamiast pustej strony

**Układ na telefonie (szerokości 360–430 px) i tablecie (768 px):**
- menu boczne → przycisk menu; użytkownik, rola i „Wyloguj" w menu (§12)
- **harmonogram:** tabela → **lista kart** (numer, trasa, daty, status, ryzyko);
  filtry w wysuwanym panelu
- **podgląd transportu:** panel boczny → pełny ekran
- **okno awizacji (§4):** pełny ekran, jedno pole pod drugim, listy zależne
  armator → rejs → statek zachowane
- mapa: pełna szerokość, obsługa gestów
- kokpit: kafelki jeden pod drugim, najważniejsze ryzyka na górze
- tabele szerokie (faktury, cennik, historia zmian) → karty albo przewijanie
  poziome **wewnątrz** tabeli, nigdy całej strony

**Wygoda pracy:**
- cele dotyku min. 44 × 44 px; odstęp między przyciskami
- pola formularzy min. 16 px czcionki (bez powiększania ekranu na iPhonie)
- właściwe klawiatury: telefon, numer, data (`inputmode`, `type`)
- nic nie wychodzi poza ekran przy 360 px; bez przewijania w poziomie strony
- tryb jasny i ciemny jak na komputerze

**Kryterium odbioru:**
- brama wizualna: dodatkowe ujęcia 390 × 844 i 768 × 1024 dla każdego widoku
  i każdej roli
- test ręczny na Androidzie w Chrome: instalacja, logowanie hasłem, awizacja
  od początku do końca, harmonogram, podgląd transportu
- audyt Lighthouse (telefon): dostępność ≥ 90, instalowalność spełniona

## §15. NAZWA I LOGO „WATCH TOWER" · P1
Grafiki gotowe w `public/brand/` (przygotował koordynator z logo właściciela;
oryginał: `docs/brand/Watch-Tower_logo_ORYGINAL.png`).
| Plik | Użycie |
|---|---|
| `watchtower-logo-full.png` | ekran ładowania i logowania — **motyw jasny** |
| `watchtower-logo-full-dark.png` | to samo — **motyw ciemny** (jasny napis) |
| `watchtower-symbol.png` | sam symbol wieży — małe miejsca w interfejsie |
| `icon-192.png`, `icon-512.png` | ikony aplikacji, `purpose: "any"` |
| `icon-maskable-192.png`, `icon-maskable-512.png` | ikony Androida, `purpose: "maskable"` — symbol w strefie bezpiecznej (sprawdzone) |
| `apple-touch-icon.png` | iPhone |
| `favicon.ico`, `favicon-32.png`, `favicon-16.png` | karta przeglądarki |
Zadania:
- **nagłówek aplikacji: „WATCH TOWER"** zamiast „TOWER"; `<title>` i nazwy w PL/EN/SV
  — „Watch Tower"
- manifest: `name` i `short_name` „Watch Tower", nowe ikony (any + maskable),
  `background_color` i `theme_color` zgodne z motywem
- **ekran ładowania:** pełne logo na środku (≤ 280 px szerokości na telefonie,
  ≤ 360 px na komputerze), wariant jasny/ciemny według motywu
- `index.html`: favicon (`.ico` + 32 + 16), `apple-touch-icon`
- **stare ikony i logo — usunąć** z repozytorium i manifestu
- **podbij wersję service workera i manifestu**, żeby zainstalowane aplikacje
  pobrały nowe ikony
- nadawca e-maili (zaproszenie, reset hasła) i ich nagłówek — „Watch Tower"
Kryterium: nowa ikona po instalacji z Chrome na Androidzie; favicon w karcie; ekran
ładowania w obu motywach; w kodzie zero wystąpień starej nazwy w tekstach dla
użytkownika (wyszukiwanie w słownikach PL/EN/SV).

## Kolejność dla wykonawcy
P0: I-33 kopia · §1 logowanie hasłem · I-30 cennik · I-31 SEFS · potem P0 z `ZLECENIE_DECYZJE_POWIADOMIENIA.md` (decyzje, powiadomienia, widoczność)
P1: **§15 nazwa i logo** · §4 awizacja · §4a numer HHL · **§14 telefon i instalacja** · §6–7 daty i opóźnienie · II-10 SharePoint · §8 opłaty ·
§9 faktury · §10–11 administrator i historia · §5 powiadomienia KSH ·
§3 Stena Line · II-5 komunikaty (oba armatory) · II-7/7b ETA (obie trasy) ·
II-8 pogoda (obie trasy) · II-9 AIS · §2 szkielet telematyki
P2: §12 interfejs · D-27 · D-30 · D-31 · D-29 (tabela) · §13 po danych
