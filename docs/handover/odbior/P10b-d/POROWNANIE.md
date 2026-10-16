# wyglad/P10b-d — pierwsze wejście: Zaproszenie, Hasło, Twoje dane, Powiadomienia i telefon (16.10.2026, 09:30)

Podstawa:
- E37 pkt 9 (zdecydowane 08.10 12:14) — 4 ekrany, potem Kokpit z „Jak pracuję” otwartym raz; krok 4 można pominąć; konta bez telefonu dostają krok 3 przy następnym logowaniu;
- makieta `makiety_html/E37/pasek.html` („Po zmianie · telefon · zaproszona osoba (link → hasło → pierwsze wejście)”);
- PLAN §4 P10b („E37 (reszta)”).

Wygląd, teksty, obliczenia widoku i przejścia (F8). Zapis hasła — bez zmian (ten sam co dziś). **Złożone na #253 (`wyglad/P10b-c`), zawiera #246 (`wyglad/P10b-a`) i #242 (`wyglad/P6-f` z #237)** — scalasz po #253.

| Miejsce | Było | Jest |
|---|---|---|
| Link z e-maila zaproszenia | „Otworzono link z e-maila…” i „Dalej” | **1 z 4 · Zaproszenie do Watch Tower**: „{kto} z {firma} zaprasza Cię do systemu kontroli transportów Śrem → Boden.”, Osoba · Firma · Konto, „Dalej — ustaw hasło”, przypis o ochronie przed programami sprawdzającymi pocztę, „Anuluj” |
| Hasło po zaproszeniu | „Ustaw hasło” z dwoma polami | **2 z 4 · Ustaw hasło**: przy polu „14 znaków — dobrze (min. 12)” albo „7 znaków — za mało”, przy powtórzeniu „✓ Hasła są takie same” albo „Hasła się różnią”, „Zapisz hasło”, „Dalej logujesz się e-mailem i hasłem. Sesja na tym urządzeniu trwa do roku.” |
| Po haśle | od razu Kokpit | **3 z 4 · Twoje dane**: imię, nazwisko, telefon (wymagany) z kierunkowym +48 / +46; bez telefonu nie przejdzie |
| | | **4 z 4 · Powiadomienia i telefon**: „Dostajesz:” według „Dla mnie” (najpierw to, co przychodzi na telefon, „i N innych — pełna lista w »Dla mnie«”), „Włącz powiadomienia na tym telefonie / komputerze”, iPhone: „Udostępnij → Dodaj do ekranu głównego, potem otwórz Watch Tower z ikony”, Android: „Zainstaluj aplikację”, „Zaczynam” (krok można pominąć) |
| Potem | Kokpit | Kokpit z Pomocą na „Jak pracuję” w wersji konta — jeden raz |
| Logowanie konta bez telefonu | pasek „Uzupełnij telefon” | najpierw sam krok 3 (bez „n z 4”): „Na Twoim koncie nie ma jeszcze telefonu. Uzupełnij go, żeby przejść dalej.”, „Zapisz i przejdź dalej” |
| „Nie pamiętam hasła” | ekran hasła | bez zmian (bez „n z 4”) |

**Produkcja:** do podłączenia danych (D-20261016-0930-01) logowanie działa jak dziś — wszystkie nowe miejsca w logowaniu są za `firstEntryReady()`, w produkcji dziś `false`.

**Demo:** `#/?pierwsze-wejscie=1` — cała ścieżka dla firmy wybranej w Podglądzie (zapraszająca i zaproszona osoba zmyślone, G-09; hasło, dane i powiadomienia tylko udają zapis); `#/?pierwsze-wejscie=telefon` — sam krok 3.

**Różnice wobec makiety (z powodu):**
- imię i nazwisko w dwóch polach — tak zapisuje je konto (E6);
- kierunkowy jako lista +48 / +46 — numery PL i SE (E42);
- „Krok 4 można pominąć” jako „Zaczynam” bez włączania i przypis „Możesz to zrobić później: Menu konta › Dla mnie › Ten telefon.” — bez osobnego przycisku „Pomiń”.

**Sprawdzone:**
- unit `first-entry` (8): kolejność kroków i „n z 4”; ocena długości hasła; telefon → E.164 (PL, SE, zły numer); rozpoznanie iPhone, iPad, Android, komputer; „Dostajesz:” według „Dla mnie” (najpierw telefon, bez „Sytuacji ogólnej”); źródło z warunkiem trybu wpisanym wprost (I-0); w logowaniu każde miejsce za `firstEntryReady()`; teksty bez kodów;
- e2e blok P10b-d (3):
  - komputer, KSH: 4 ekrany z „n z 4”, Firma „KSH”, Konto „Użytkownik”; ocena hasła; bez telefonu nie przejdzie (+46 działa); „Dostajesz:” 3 pozycje; „Włącz powiadomienia na tym komputerze”; po „Zaczynam” Kokpit i „Jak pracuję” w wersji KSH; po zamknięciu i zmianie widoku Pomoc nie wraca;
  - telefon 390 (iPhone), SCX: każdy ekran bez przewijania w bok, przyciski ≥ 44 px, tekst ≥ 12 px; „Udostępnij → Dodaj do ekranu głównego”; „Jak pracuję” w wersji SCX Dyspozytor;
  - telefon 390, konto bez telefonu: sam krok 3 bez numeru, bez telefonu nie przejdzie, Pomoc się nie otwiera;
- build produkcyjny: ekrany w części logowania (ładowanej osobno), bez przykładów demo; pierwsze wczytanie produkcji 394,8 kB gzip;
- demo: pierwsze wczytanie 398,6 kB gzip (ekrany ładowane osobno);
- cały zestaw unit zielony; cała specyfikacja e8-phone-gate + AUD-01e + B-7.

**Zrzuty:** `1-zaproszenie-1440-ksh.webp`, `2-haslo-1440.webp`, `3-dane-1440.webp`, `4-powiadomienia-1440.webp`, `5-kokpit-jak-pracuje-1440.webp`, `1-zaproszenie-390-scx.webp`, `2-haslo-390.webp`, `3-dane-390.webp`, `4-powiadomienia-390-iphone.webp`, `konto-bez-telefonu-390.webp`.
