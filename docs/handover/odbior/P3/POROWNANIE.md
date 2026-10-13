# Odbiór P3 — wygląd (koordynator, `wyglad/P3`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
P3 wyglądu ma trzy części: **P3-a** pasek górny (ten dokument), P3-b Kokpit według E9, P3-c Opcje według E11 i E12.

## wyglad/P3-a — pasek górny, konto, paski pod paskiem (E37 pkt 1–2, E13)

Obraz raportu: `raport/img/e37-after.webp`, część „Po zmianie” (komputer: pasek, konto, pomoc; telefon: zaproszona osoba i pasek). Dzwonek na telefonie: `e13-phone-fix`.
Zakres P3 z `PLAN.md` §4: „E37 (część: pasek górny; reszta E37 w P10b) konto, „Moje konto” i „Wyloguj” po prawej; „Podgląd: HHL · KSH · SCX”; motyw w menu konta” oraz E13.

### Z3 — element po elemencie

| element | obraz raportu | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| logo i podpis | logo, „WATCH TOWER”, „Stegra Boden” (bez nazwy firmy) | to samo; firma przeszła do konta | tak | obraz ma zielony trójkąt w miejscu logo (znak makiety); zostaje logo Watch Tower jak na obrazie „Dziś”. „Stegra Boden” znika poniżej 1367 px (miejsce na długie nazwiska) |
| Podgląd (tylko HHL) | „Podgląd” + HHL / KSH / SCX | to samo; u KSH i SCX w produkcji nie ma (E9) | tak | uchwyt testów `#roleSeg button[data-role]` bez zmian |
| tydzień, rejsy, data | t41 · ⛴ · dwa rejsy „6 h 13 min Stena Estelle · 08:00 · Gdynia → Karlskrona”, „16 h 13 min Wawel · 18:00 · Gdańsk → Nynäshamn” · data | to samo; pełne nazwy portów; najbliższy rejs u góry, drugi odliczany mniejszą cyfrą; inny dzień: „09.10, 08:00” (E21) | tak | demo ma jeden rejs pokazowy Polferries. Znak statku: obraz ma ciemny znak z makiety, aplikacja — ikonę liniową w kolorze morza (jak „Dziś”) |
| „?” | przycisk „?” = Pomoc, biały, 36 px | przycisk „?” 36 px, biały, otwiera dzisiejszą listę skrótów | częściowo | panel Pomocy (Jak pracuję, Co nowego, Kontakt, Skróty) — E37 pkt 3, P10b |
| dzwonek | dzwonek z liczbą | dzwonek z liczbą, ikona liniowa | tak | obraz ma kolorowy znak dzwonka z makiety; zostaje ikona liniowa jak w E13 i E8 (spójnie z resztą ikon) |
| konto | inicjały w kółku, „Anna Nowak”, „HHL · Operacje”, ▼ | to samo; dane z profilu konta | tak | konto bez imienia i nazwiska: e-mail (E6 każe uzupełnić). Długie imię i nazwisko zawija się w dwie linie w ramce konta; poniżej 1101 px same inicjały |
| menu konta — nagłówek | imię i nazwisko; „H&H Logistics · Operacje HHL”; „tel. +48 ••• ••• 123 · ostatnie logowanie: dziś, 07:58” | to samo | częściowo | „ostatnie logowanie” pokaże się, gdy profil poda `last_sign_in_at` (logika — Cursor, dopisek) |
| menu konta — pozycje | Moje konto (imię, nazwisko, telefon, hasło, 2FA, urządzenia) · Dla mnie (co dostaję) · Pomoc ? · Jasny / ciemny T · Wyloguj | to samo | tak | „(E11)” przy „co dostaję” to dopisek audytu, nie tekst aplikacji. Obraz ma cień pod menu — nie ma tokenu cienia, a cień spoza tokenu zabrania reguła stylów (`AGENTS.md` §4), więc menu ma ramkę. „Moje konto” → Opcje › Użytkownicy (HHL) i Ustawienia (KSH, SCX — formularz konta podłącza Cursor, dopisek); „Dla mnie” → preferencje; w P3-c obie prowadzą do ekranów z menu bocznego E11 |
| motyw | w menu konta | w menu konta (`#themeBtn`), klawisz T bez zmian | tak | — |
| lewe menu | bez e-maila i „Wyloguj” | bez e-maila, rodzaju i „Wyloguj” | tak | — |
| pasek „Podgląd” | niebieski: „Podgląd: tak widzi KSH Użytkownik. Nic tu nie zapiszesz.” · „Wróć do HHL” | to samo, na całą szerokość pod paskiem | tak | logika podglądu — Cursor (E9-7, G-07). Pasek 44 px jak na obrazie |
| pasek „Działasz jako” | bursztynowy: „Działasz jako: dyspozytor SCX” + zdanie o historii · „Zakończ” | to samo; po rodzaju konta imię i nazwisko osoby w nawiasie | tak, z dodatkiem | w zdaniu o historii jest e-mail administratora, dopóki profil nie poda jego imienia i nazwiska (dopisek) |
| komunikat HHL | „KOMUNIKAT HHL” · treść · „do 09.10, 12:00” · „Zamknij” | to samo bez „Zamknij” | częściowo | „Zamknij”, odświeżanie co minutę i wybór firm — E37 pkt 4, P10b |
| kolejność pasków | Podgląd albo „Działasz jako”, potem komunikat | to samo | tak | — |
| telefon — pasek | logo, najbliższy prom („⛴ 6 h 13 min / Stena 08:00”), dzwonek, inicjały | to samo; bez ☰, „?”, motywu, Podglądu, tygodnia i daty | tak | pasek 52 px (makieta Claude v2.0, `.topbar`), na obrazie ok. 55 px |
| telefon — prom | dotknięcie → oba rejsy, tydzień, data | lista pod paskami: rejsy, „t41”, data | tak | układ listy nie jest na obrazie — wzór Z10 pkt 1 (jak lista dzwonka E13) |
| telefon — menu konta | pod komunikatem HHL; Anna Nowak / H&H Logistics · Operacje HHL; Moje konto ›, Pomoc ›, Podgląd: HHL · KSH · SCX ›, Jasny / ciemny ›, Wyloguj | to samo, pod paskami; „Podgląd” rozwija HHL / KSH / SCX | tak | „Dla mnie” tylko na komputerze, jak na obrazie |
| telefon — komunikat | „Komunikat HHL: …” · ✕ | „Komunikat HHL: …” bez ✕ | częściowo | ✕ — P10b |
| telefon — dzwonek (E13, `e13-phone-fix`) | lista pod paskiem na całą szerokość (8 px od brzegów), przewijana w środku | to samo; gdy są paski „Podgląd”, „Działasz jako” albo komunikat — pod nimi; zamyka dotknięcie obok | tak | CSS E13 przejęty od Cursora (D-20261013-2130-01 pkt 1; jego commit `52a15123` wycofany na gałęzi logiki). Bez „✕”, jak na obrazie. Test „E13 telefon” w bramie: szerokość, lista w środku nad treścią, przewijanie, zamknięcie |

### Konta (Z11)

| konto | zrzut | różnica |
|---|---|---|
| HHL Administrator | `menu-1440-hhl-administrator-demo.png` (demo) | — |
| HHL Operacje | `pasek-1440-hhl-*`, `menu-1440-hhl-jasny.png`, `menu-390-hhl-jasny.png` | podpis „HHL · Operacje” |
| KSH Użytkownik | `*-ksh-*` | bez Podglądu (produkcja) |
| SCX Dyspozytor | `*-scx-*` | bez Podglądu (produkcja); konto bez telefonu → e-mail w nagłówku menu |
| SCX Użytkownik | jak SCX Dyspozytor | podpis „SCX · Użytkownik” |

Zrzuty z trybu demo (zamrożony czas 08.10.2026, 07:47). Konto z imieniem, telefonem i paskami „Podgląd”, „Działasz jako” i komunikatem wstawione w przeglądarce do podglądu wyglądu (dane zmyślone, adres `przyklad.pl`); w demo te paski się nie pokazują, bo zależą od logowania.

### Sprawdzenia

- Brama E8 (`tests/e8-phone-gate.spec.ts`) obejmuje teraz także otwarte menu konta (z rozwiniętym Podglądem) i listę promów, 3 konta × 360 / 390 / 430 px: 0 / 0 / 0. Wstrzyknięta usterka (pozycje menu 30 px, 11 px) — brama łapie (`cel=4`, `tekst=4`).
- Nowe testy „wyglad/P3 pasek górny” w tym samym pliku:
  - komputer 800–1440 px (także 1241 px) z imieniem i nazwiskiem „Przemysław Szczepański-Kowalczyk”: wszystko w pasku 52 px, nic na sobie, „WATCH TOWER” w jednej linii;
  - telefon 360 / 390 / 430 px z paskami „Podgląd”, „Działasz jako” i komunikatem (znaczniki tych trzech pasków wstawione w teście, bo w demo ich nie ma): 0 uciętych, 0 celów < 44 px, 0 tekstu < 12 px, menu konta pod paskami;
  - oba testy padają na pierwszej wersji tej gałęzi (`3320bff`) — to były usterki znalezione przez agenta kontrolnego;
  - komputer i telefon: elementy paska i pozycje menu.
- Pasek bez wyjścia poza okno przy 1440, 1366, 1280, 1100, 1024, 900, 800, 768, 430, 390 i 360 px (3 konta).
- Menu konta na Mapie jest nad mapą i nad pasem warstw (sprawdzone przy 1440 i 390 px): warstwy mapy zamknięte we własnym pudełku (`isolation`).
- axe (WCAG 2.1 AA) na pasku z otwartym menu, jasny i ciemny: 0 nowych naruszeń. Zostaje stare: liczba dzwonka w motywie ciemnym (biel na `--red` #E8687C, kontrast 2,9 : 1) — E10, poza tą częścią.
- Testy przepisane: `tests/visual.spec.ts`, `tests/visual-states.spec.ts`, `scripts/a11y/audit.mjs` (motyw klikany skryptem, bo jest w zamkniętym menu konta), `tests/resp14-phone.spec.ts` („menu telefon” — konto w pasku zamiast `.nav-session`).

### Niezależne sprawdzenie (agent kontrolny koordynatora, 13.10 ok. 22:00–22:25)

Sprawdził pierwszą wersję (`3320bff`). Poprawione w drugim commicie:
- **poza wyglądem (F8):** formularz „Moje konto” w Ustawieniach KSH i SCX (zapis przez funkcję bazy) i powrót z Podglądu do HHL przy „Moje konto” — usunięte; formularz w Ustawieniach podłącza Cursor (dopisek);
- znacznik `[data-auth="session"]` (19 testów logowania czeka na niego) stał na ukrytym „Wyloguj” — jest na widocznym przycisku konta;
- przy 1241–1280 px długie imię i nazwisko spychało „WATCH TOWER” do dwóch linii poza pasek;
- „Dla mnie” (HHL, 1440 px) przewijało stronę, zanim sekcja się rozwinęła;
- na telefonie menu konta i lista promów zasłaniały paski „Podgląd”, „Działasz jako” i komunikat (obraz: menu pod komunikatem);
- Escape oddaje fokus przyciskowi konta i przyciskowi promu; lista promów zamyka się Escape; „Pomoc” z menu zawsze otwiera; opis przycisku konta zawiera rodzaj konta;
- wymiary bliżej obrazu: „?” i dzwonek 36 px na białym tle, Podgląd na białym tle, opisy rejsów 13 px w kolorze tekstu, drugi rejs mniejszą cyfrą, paski pod paskiem 44 px, opis „Moje konto” od 67 px od lewej krawędzi menu (obraz ok. 66 px), na telefonie „WATCH TOWER” 17 px, prom wyśrodkowany, menu 13 px od krawędzi, pozycje 44 px, nazwisko 17 px.
- Drugie sprawdzenie tego samego agenta (na `c5c18a3`): wszystko wyżej potwierdzone. Znalazł jeszcze listę dzwonka na telefonie schodzącą pod dolny pasek, gdy są paski pod paskiem (i nazwisko z 31+ znaków o 1 px za wysokie). Poprawione: wysokość list z paska = okno minus pasek z paskami, odstęp i dolny pasek; lista dzwonka nad dolnym paskiem; nazwisko w ramce konta w 2 liniach do ok. 50 znaków. Test „paski pod paskiem” mierzy teraz menu konta, prom i dzwonek na niskim telefonie (640 px): pod paskami, nad dolnym paskiem, dół listy widoczny.
- Migawki wzorców (`tests/__screenshots__/`) odświeżone w `visual.yml` (`update=true`) — wpis w `docs/handover/G4_WZORZEC.md`.

### Zostaje do innych części

- Panel Pomocy, komunikaty zdaniami, logowanie, zaproszenie, pierwsze wejście — E37 pkt 3–9, P10b.
- „Moje konto” i „Dla mnie” jako ekrany menu bocznego Opcji — P3-c.

### Pliki

`wyglad-P3-a/`: `porownanie-*` (obraz raportu u góry albo z lewej, aplikacja obok), `pasek-*`, `podpaski-*`, `menu-*`, `promy-*`.
