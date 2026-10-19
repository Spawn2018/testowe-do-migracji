# P11 pkt 7 — zgodność aplikacji z raportem audytu (końcowe porównanie)

Koordynator (Claude), 18.10.2026, 15:24. Gałąź `wyglad/W-przed-wydaniem-3` (od `main` a2eb2d4). F8: wygląd, teksty, obliczenia widoku, dane demo.

## Jak sprawdzone
- **Kto:** 6 niezależnych sprawdzających (paczki A–F), każdy na swojej części raportu. Sprawdzali w demo na buildzie `main` a2eb2d4, z zegarem 23.09.2026, 16:32 i 20.11.2026, 11:00.
- **Konta:** 5 rodzajów — HHL Administrator, HHL Operacje, KSH, SCX Dyspozytor, SCX Użytkownik.
- **Szerokości:**
  - komputer 1440 (Faktury, Finanse i Harmonogram także 1280 / 1366 / 1920);
  - telefon 390 (dzwonek także 360 i 430).
- **Wzorzec, od najważniejszego:**
  1. najnowsza decyzja właściciela (Zmiany 09.10 / 11.10 / 15.10 / 16.10 / 18.10);
  2. obraz „po zmianie”;
  3. tekst etapu.
- **Klasy różnic:**
  - W — wygląd do poprawy;
  - D — tylko dane demo, zegar lub liczby;
  - N — świadomie inaczej, bo jest nowsza decyzja;
  - L — czeka na logikę lub bazę;
  - ? — do rozstrzygnięcia.
- Pełne raporty paczek ze zrzutami są poza repozytorium (folder sprawdzających). W tym pliku są wyniki i decyzje.

## Wynik na obraz

| obraz | miejsce · konta · szerokości | wynik | W — co i gdzie poprawione |
|---|---|---|---|
| e1-kokpit-new, e1-kokpit-new-mob | Kokpit, 5 kont, 1440 / 390 | zgodny | — |
| e24-after | podkład mapy niedostępny, 1440 / 390 | zgodny; 1 ?, 1 D | — |
| e29-after | Mapa, HHL / SCX / KSH, 1440 / 1366 / 390 | 5 W | pola warstw w tokenach (partia 2) · „Więcej” zaznaczone (partia 1) · mapa zostaje na ekranie przy długiej liście, jeden zapis opóźnienia (partia 3) · białe linie między kafelkami — nie powtórzone na buildzie gałęzi (1366, 1440, 1920), bez zmian |
| e45-after | Mapa: warstwy, prom, strefa; panel T-18 | zgodny; N, L | — |
| e27-after | panel przed, w i po oknie śledzenia; Mapa | 1 W | zakładki panelu na telefonie bez ucinania (partia 1) |
| e15-after, e49-eta | panel › blok ETA, 7 stanów | 2 W | etap „Załadunek” jako „Przed wyjazdem ze Śremu”, ETA Boden na promie (partia 3) |
| e49-objazd-scx | Ryzyka › objazd czy postój | zgodny; 1 D | — |
| e1-drawer-new-z11, e32-after | panel › Przegląd, 5 kont, 1440 / 390 | 5 W | tytuły spraw „Brak numeru zlecenia HHL / SCX” (partia 1; makieta pisze „Nr zlecenia …” — u nas pełne zdanie o braku, jak w „Do zrobienia”) · ramka stanu mapy nie zasłania podpisu mapy i ma drugą linię, numer zlecenia jako tekst z „Edytuj”, linia „Plan” na telefonie (partia 3) |
| e17-after, e25-after, e26-after | Status, Historia, Czat; okno „Zmień status” | 1 W | „Teraz: Na placu od …” (partia 1) |
| e33-after, e3-drawer | panel › Ceny, 5 kont | 2 W | podpisy „Twoja cena” / „Twoja stawka” na telefonie (partia 1) · „+ Dopłata” u SCX (partia 3, sprawdzenie uprawnień widoku) |
| e41-after | nagłówek panelu i okien | 2 W | kod duży, kropka w kolorze akcentu, numer mniejszy; bez kreskowanej linii (partia 1) |
| e6b-desk, e6b-phone | kierowcy i przepięcie | zgodny; N | — |
| e28-after | pasek etapów | zgodny | — |
| e30-after | Harmonogram: widok skrócony, filtry, Rejsy | 2 W | znaczniki braków dokumentów i status z datą „Dostarczone” na kartach telefonu, trasa Rejsów na telefonie (partia 4) |
| e38-after | Harmonogram: układ pliku | 1 W | kreska przyklejonej „Wysyłki” jedzie z kolumną (partia 2) |
| e31-after | Dokumenty, okno „Wgraj dokument” | 3 W | „CMR z podpisem odbiorcy” liczy termin tylko po „Dostarczone” („—” dla transportów w drodze), podpowiedź „Firma” z nazwą pliku i liczbą transportów, równe wiersze „Pliki” na telefonie (partia 4); baza — uwaga w „Czeka na bazę” |
| e7-desk, e7-phone, e6-desk, e6-phone | Ryzyka, karta sprawy, Moje konto | zgodny; N, D, 1 ? | — |
| e34-after | Strefy | 1 W | droga i przerywane promy na mapie wszystkich stref (partia 4) |
| e35-after | Automatyzacje | zgodny | — |
| e4-faktury-desk, e4-faktury-phone | Faktury, 5 kont, 1440 / 390, 20.11 i 23.09 | 9 W | odmiana „1 transport dostarczony”, „t39 · …”, pola wyboru i radio w tokenach, przycisk na całą szerokość, etykiety przy lewej, wiersze CMR wyrównane, wiersz „do wystawienia” bez tła, „Termin płatności (35 dni)” (partia 2) · rozbicie „Stawka · Opłata · Razem” i nagłówek „Transport” w kreatorze (partia 4) |
| e4b-desk, e4b-phone | Faktoring | prawie zgodny | przełącznik zamiast pola wyboru, zablokowane pola wyglądają na zablokowane (partia 4) |
| e40-after | Finanse › Paczka tygodnia; Terminy | prawie zgodny | znak pliku (kartka), „CMR z podpisem ✓” w kolumnie KSH (partia 4) |
| e16-after | Finanse, Rozliczenia, Moje stawki; panel › Ceny | 2 W | nazwa etapu „Dostarczone” w panelu (partia 3) · procent bez spacji (partia 4) |
| e39-after | opłata paliwowa: Finanse i panel | 3 W | daty publikacji (partia 2) · karta opłaty w panelu i data „ostateczna od …” (partia 3) |
| e3-opcje-desk, e3-opcje-phone | Opcje › Opłata paliwowa | 2 W | mnożnik w menu z tego samego źródła, karty KSH/SCX jedna pod drugą na telefonie (partia 2) |
| e11-desk, e11-phone, e12-after | Opcje: menu, Kto co dostaje, 22 ekrany | 3 W | „Treści wiadomości” ostatnie, „Dla mnie” pierwsza u KSH/SCX (partia 2) · „»” na telefonie (partia 1) |
| e9-after | menu i Kokpit, 5 kont | 3 W | liczba Faktur w „Więcej” (partia 1) · Operacje bez Automatyzacji w demo (partia 2) |
| e42-after, e43-after | SMS przy miejscach, Treści wiadomości | 3 W | pola A–D w tokenach, bez kodów etapów, podgląd e-maili logowania bez transportu (partia 2) |
| e23-after, e18-after, e19-after, e46-after | Stan systemu, Historia zmian, Bezpieczeństwo, Wydajność | 4 W (niska waga) | Operacje bez podpowiedzi 2FA, odnośnik progów źródeł, Historia i Wydajność na telefonie (partia 2) |
| e5-desk, e5-phone, e13-phone-fix | dzwonek, 360 / 390 / 430 | 3 W | Esc i „✕”, link „Ryzyka” w linii tekstu (partia 2) · „☎ Dyspozytor SCX” przy decyzji — L: telefonu firmy decydującej nie ma w danych dzwonka (do Cursora z P10b, do 27.10) |
| e37-after | pasek górny, menu konta, Pomoc | zgodny | — |
| e8-after | wszystkie strony, telefon 390 | 2 W | wykres postępu ≥ 12 px, paczka tygodnia pod „Wgraj dokument” (partia 2) |
| e20-after | Harmonogram, Faktury, Finanse, 1280–1920 | 1 W | nagłówek „Załadunek → dostawa” przy 1280 (partia 2) |
| e21-after | teksty wszystkich ekranów | 2 W | procent bez odstępu („4%”) w tekstach, Opcjach i panelu (partia 4); reguły strażnika dla procentu i kodów etapów — po scaleniu #301, najpóźniej 21.10 · kwoty EUR bez waluty w Fakturach = N (obraz E4: waluta umowy bez kodu) |
| e22-after | przeładowanie, nowa wersja | 1 W | pogrubiony nagłówek komunikatu (partia 2) |
| e10-after | kontrast | 1 W | Kto co dostaje — zaznaczony wiersz (#301) |

## Partie poprawek (ta gałąź)
- **Partia 1 — 9d65928:**
  - zakładki panelu na telefonie;
  - podpisy cen KSH i SCX;
  - nagłówek panelu bez kreskowanej linii;
  - tytuły „Do zrobienia”;
  - „Teraz: … od”;
  - „Więcej” (zaznaczenie, liczba, „»”).
- **Partia 2 — 3c581b8:**
  - pola wyboru w tokenach;
  - Faktury;
  - Finanse;
  - Opcje;
  - dzwonek;
  - telefon (wykres, Dokumenty);
  - Harmonogram (kreska, nagłówek);
  - komunikat po aktualizacji.
- **Partia 3:**
  - blok ETA (załadunek, prom);
  - Mapa (mapa na ekranie, zapis opóźnienia); białych linii między kafelkami na buildzie gałęzi nie powtórzono — próbna poprawka kafelków wycofana, bez zmian;
  - Przegląd (ramka stanu mapy, numer zlecenia, linia „Plan”);
  - panel › Ceny (karta opłaty paliwowej, „Dostarczone”, „+ Dopłata” u SCX).
- **Partia 4:**
  - Harmonogram na telefonie (status z datą, braki dokumentów);
  - Rejsy (linia trasy na telefonie);
  - Dokumenty („CMR z podpisem” po dostawie, podpowiedź „Firma”, „Pliki” na telefonie);
  - Strefy (droga i promy na mapie);
  - kreator faktury („Transport · Dostarczony · Stawka · Paliwo · Razem”), u KSH bez wiersza „do wystawienia”;
  - Faktoring (przełącznik), zablokowane pola;
  - Paczka tygodnia;
  - procent bez odstępu;
  - bez kodów etapów w Strefach, Automatyzacjach i Historii;
  - dzwonek: informacje bez działania w „Moje transporty”.
- **Partia 5:**
  - dane demo: wiersze panelu › Ceny sumują się do „Razem”, opłata paliwowa z mnożnika; etap „Zafakturowane” z faktur na stronie Faktury (niżej, „Dane demo”);
  - Strefy: „50 km”, „20 km”, „60 min” w opisach buforów na twardej spacji — po usunięciu kodów etapów (partia 4) „50” i „km” łamały się na końcu linii przy 1440 i 1280 (CI, `etap6-ui`).
  - wzorce `visual` Kokpitu HHL (jasny, ciemny) — kafelek „Marża (prognoza)” z danymi demo: 14,5 % → 17,6 % (bez ukrytych 303 EUR w koszcie).
- **Partia 6 — CMR tylko po rozładunku (decyzja właściciela 18.10, 17:28; wcześniej 08.10 B):**
  - wszędzie „CMR z podpisem odbiorcy”; teksty „CMR z załadunku” i „do 2 h po załadunku” usunięte;
  - Harmonogram, Dokumenty i panel pomijają stan CMR transportów przed „Dostarczone” (`cmrAfterDelivery`), w panelu „po rozładunku”; „Rozładowany” (UNLOADING) liczy się jak „Dostarczone”, tak jak w Kokpicie i kreatorze faktury (F7 #303 B1: pierwsza wersja ukrywała przy nich brak CMR);
  - F7 #303: na telefonie (do 768 px, jak `useIsPhone`) dopisek na mapie Przeglądu u góry, w jednym ciągu (pojazd i „+ / −” widoczne; test e8 przy 390 i 768), „brak: zezwolenie PL” zamiast „brak zezwolenie PL”, bez „(I-21)” w tekstach spraw, kody etapów usunięte z tekstów zmienionych plików („szablon E43”, „zasad E42”, „E34”, „W12”, „III-4”, „E5-2”), twarde spacje w liczbach z jednostką w tych plikach, pomoc SCX: CMR „do 24 h” po „Dostarczone”;
  - wartość startowa aplikacji: CMR po rozładunku, 24 h;
  - na produkcji wymaganie ma jeszcze „2 h po załadunku” (22 transporty przed dostawą z „po terminie”) — poprawka bazy: D-20261018-1740-01; filtr widoku działa już teraz.

## Rozstrzygnięcia koordynatora („?” z paczek)
- **Liczba przy dzwonku i „Do zrobienia”** — ma być ta sama, bo dopisek w aplikacji to obiecuje (e7).
- **Informacje bez działania w dzwonku** („Faktura zaakceptowana”, „Import zatwierdzony”) — przechodzą do „Moje transporty”, bo „Do zrobienia” to tylko sprawy z działaniem (E5). Partia 4.
- **KSH widzi „Czeka na wystawienie”** (zadanie HHL) — E4: KSH widzi tylko faktury od HHL. Partia 4 ukrywa ten wiersz u KSH.
- **Pierwsza karta Harmonogramu na telefonie na 319 px** — N. Pasek etapów z E28 (nowszy) wygrywa z „górną 1/3” z E8.
- **Pola daty i godziny w formacie przeglądarki** — N. W polskiej przeglądarce jest „23.09.2026” i „16:32”; testowa przeglądarka ma język angielski.
- **Kwoty EUR bez kodu waluty w Fakturach** — N. Obraz E4 pisze kwoty w walucie umowy bez kodu, a inną walutę z kodem.
- **Dane demo (partia 5, F8):**
  - w panelu › Ceny kwoty nie sumowały się do „Razem” (w sumie była ukryta kwota ok. 303 EUR, a opłata paliwowa przy „×1,05” wynosiła ok. 1 % frachtu) — **poprawione**: opłata paliwowa = fracht × (mnożnik − 1) z tej samej migawki co znacznik „t38 · ×1,05”, „Razem” = fracht + opłata paliwowa + dopłaty; transporty „poniżej progu” mają marżę ok. 9 % z tych samych wierszy (`seed.ts`, `consistentDemoPricing`);
  - „Zafakturowane 0” przy wystawionych fakturach t37–t38 — **poprawione**: w demo etap „Zafakturowane” strony bierze się z faktur na stronie Faktury (HHL → KSH zamyka przychód, SCX → HHL — koszt; `invoices3.ts`, `withBilledMoney`), a nie ze starego zestawu faktur przewoźnika. Ta sama zasada co status „Zafakturowano” (transport na obu fakturach);
  - prom: transporty „Na promie · Nova Star” przy odejściu o 18:00 — **N**: wjazd na prom 15:30, ok. 2,5 h przed odejściem, jak w porcie; przypłynięcie następnego dnia 12:00;
  - brak zdarzeń strefy placu (wjazd, postój, wyjazd po 3 h 44 min) — **poprawione** 18.10 w `wyglad/W-demo-strefy` (`docs/handover/odbior/W-demo-strefy/`); produkcja ma te zdarzenia z bazy (silnik stref).
- **Decyzje właściciela (18.10, 15:34):**
  1. rogi przycisków i pól zostają zaokrąglone (2 px) — N wobec tokenów makiet „radius 0”;
  2. podkład mapy w demo z angielskimi nazwami zostaje (produkcja: HERE) — N;
  3. najechany / wybrany wiersz Mapy zostaje jasnopomarańczowy — N;
  4. sekcja „Załączniki CMR” na stronie Faktury zostaje — N wobec obrazu E4.
- **„+ / −” na mapie Kokpitu** — N: Kokpit ma mapę podglądu (przybliżanie na stronie Mapa), reguła z 07.10.

## Czeka na bazę (L) — dopisek do wykonawcy
- **CMR tylko po rozładunku** (decyzja właściciela 18.10, 17:28) — wymaganie CMR w produkcji (`doc_requirements`) ma kotwicę `AT_LOAD` + 2 h; poprawka wymagania, zabezpieczenia i `doc_requirements_status()`: D-20261018-1740-01 — **do 20.10** (przed A3). Widok (partia 6) pomija CMR przed „Dostarczone” już teraz; do poprawki bazy Dokumenty › Terminy pokazują godziny ze starego wymagania („do 2 h”), a po „Dostarczone” termin z bazy jest jeszcze liczony od załadunku.
- **Eskalacje decyzji** — fałszywe sprawy „SEFS: brak źródła indeksu”, podwójne wpisy, numery wewnętrzne w tytułach: D-20261018-1610-01 — **do 20.10**.
- **Ślad przejazdu w Boden i linie promów** — z HERE (E45, P9) — **do 26.10**.
- **Linia „Plik KSH (SharePoint): zsynchronizowano …”, znacznik „Zmiana numeracji”, waga elementu** — W13 i import — **do 26.10**.
- **Wpisy SMS w Historii transportu** (P8) i sprawa „Źródło danych nie działa” w dzwonku Administratora (E23, P10b) — **do 27.10**.
- **Paski „Podgląd…” i „Działasz jako…”, logowanie, zaproszenie** — sprawdzić na TEST, w tym czy „Nie pamiętam hasła” nie zdradza, że konto istnieje (`authErrorPl`) — **27.10**, pełna brama TEST (P11 pkt 5).
