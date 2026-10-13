# Odbiór P3 — wygląd (koordynator, `wyglad/P3`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
P3 wyglądu ma trzy części: **P3-a** pasek górny (ten dokument), P3-b Kokpit według E9, P3-c Opcje według E11 i E12.

## wyglad/P3-a — pasek górny, konto, paski pod paskiem (E37 pkt 1–2, E13)

Obraz raportu: `raport/img/e37-after.webp`, część „Po zmianie” (komputer: pasek, konto, pomoc; telefon: zaproszona osoba i pasek). Dzwonek na telefonie: `e13-phone-fix`.
Zakres P3 z `PLAN.md` §4: „E37 (część: pasek górny; reszta E37 w P10b) konto, „Moje konto” i „Wyloguj” po prawej; „Podgląd: HHL · KSH · SCX”; motyw w menu konta” oraz E13.

### Z3 — element po elemencie

| element | obraz raportu | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| logo i podpis | logo, „WATCH TOWER”, „Stegra Boden” (bez nazwy firmy) | to samo; firma przeszła do konta | tak | — |
| Podgląd (tylko HHL) | „Podgląd” + HHL / KSH / SCX | to samo; u KSH i SCX w produkcji nie ma (E9) | tak | uchwyt testów `#roleSeg button[data-role]` bez zmian |
| tydzień, rejsy, data | t41 · ⛴ · dwa rejsy „6 h 13 min Stena Estelle · 08:00 · Gdynia → Karlskrona”, „16 h 13 min Wawel · 18:00 · Gdańsk → Nynäshamn” · data | to samo; pełne nazwy portów; najbliższy rejs u góry; inny dzień: „09.10, 08:00” (E21) | tak | demo ma jeden rejs pokazowy Polferries |
| „?” | przycisk „?” = Pomoc | przycisk „?” otwiera dzisiejszą listę skrótów | częściowo | panel Pomocy (Jak pracuję, Co nowego, Kontakt, Skróty) — E37 pkt 3, P10b |
| dzwonek | dzwonek z liczbą | dzwonek z liczbą, ikona liniowa | tak | obraz ma kolorowy znak dzwonka z makiety; zostaje ikona liniowa jak w E13 i E8 (spójnie z resztą ikon) |
| konto | inicjały w kółku, „Anna Nowak”, „HHL · Operacje”, ▼ | to samo; dane z profilu konta | tak | konto bez imienia i nazwiska: e-mail (E6 każe uzupełnić) |
| menu konta — nagłówek | imię i nazwisko; „H&H Logistics · Operacje HHL”; „tel. +48 ••• ••• 123 · ostatnie logowanie: dziś, 07:58” | to samo | częściowo | „ostatnie logowanie” pokaże się, gdy profil poda `last_sign_in_at` (logika — Cursor, dopisek) |
| menu konta — pozycje | Moje konto (imię, nazwisko, telefon, hasło, 2FA, urządzenia) · Dla mnie (co dostaję) · Pomoc ? · Jasny / ciemny T · Wyloguj | to samo | tak | „Moje konto” → Opcje › Użytkownicy (HHL), Ustawienia (KSH, SCX); „Dla mnie” → preferencje; w P3-c obie prowadzą do ekranów z menu bocznego E11 |
| motyw | w menu konta | w menu konta (`#themeBtn`), klawisz T bez zmian | tak | — |
| lewe menu | bez e-maila i „Wyloguj” | bez e-maila, rodzaju i „Wyloguj” | tak | — |
| pasek „Podgląd” | niebieski: „Podgląd: tak widzi KSH Użytkownik. Nic tu nie zapiszesz.” · „Wróć do HHL” | to samo, na całą szerokość pod paskiem | tak | logika podglądu — Cursor (E9-7, G-07) |
| pasek „Działasz jako” | bursztynowy: „Działasz jako: dyspozytor SCX” + zdanie o historii · „Zakończ” | to samo; po rodzaju konta imię i nazwisko osoby w nawiasie | tak, z dodatkiem | w zdaniu o historii jest e-mail administratora, dopóki profil nie poda jego imienia i nazwiska (dopisek) |
| komunikat HHL | „KOMUNIKAT HHL” · treść · „do 09.10, 12:00” · „Zamknij” | to samo bez „Zamknij” | częściowo | „Zamknij”, odświeżanie co minutę i wybór firm — E37 pkt 4, P10b |
| kolejność pasków | Podgląd albo „Działasz jako”, potem komunikat | to samo | tak | — |
| telefon — pasek | logo, najbliższy prom („⛴ 6 h 13 min / Stena 08:00”), dzwonek, inicjały | to samo; bez ☰, „?”, motywu, Podglądu, tygodnia i daty | tak | — |
| telefon — prom | dotknięcie → oba rejsy, tydzień, data | lista pod paskiem: rejsy, „t41”, data | tak | układ listy nie jest na obrazie — wzór Z10 pkt 1 (jak lista dzwonka E13) |
| telefon — menu konta | Anna Nowak / H&H Logistics · Operacje HHL; Moje konto ›, Pomoc ›, Podgląd: HHL · KSH · SCX ›, Jasny / ciemny ›, Wyloguj | to samo; „Podgląd” rozwija HHL / KSH / SCX | tak | „Dla mnie” tylko na komputerze, jak na obrazie |
| telefon — komunikat | „Komunikat HHL: …” · ✕ | „Komunikat HHL: …” bez ✕ | częściowo | ✕ — P10b |
| telefon — dzwonek (E13) | lista pod paskiem na całą szerokość | bez zmian (poprawka Cursora w P3) | tak | — |

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
- Nowe testy „wyglad/P3 pasek górny” (komputer i telefon) w tym samym pliku.
- Pasek bez wyjścia poza okno przy 1440, 1366, 1280, 1100, 1024, 900, 800, 768, 430, 390 i 360 px (3 konta). Od 1100 px w dół przy koncie zostają same inicjały, a podpis „Stegra Boden” znika.
- Menu konta na Mapie jest nad mapą i nad pasem warstw (sprawdzone przy 1440 i 390 px): warstwy mapy zamknięte we własnym pudełku (`isolation`).
- axe (WCAG 2.1 AA) na pasku z otwartym menu, jasny i ciemny: 0 nowych naruszeń. Zostaje stare: liczba dzwonka w motywie ciemnym (biel na `--red` #E8687C, kontrast 2,9 : 1) — E10, poza tą częścią.
- Testy przepisane: `tests/visual.spec.ts`, `tests/visual-states.spec.ts`, `scripts/a11y/audit.mjs` (motyw klikany skryptem, bo jest w zamkniętym menu konta), `tests/resp14-phone.spec.ts` („menu telefon” — konto w pasku zamiast `.nav-session`).

### Zostaje do innych części

- Panel Pomocy, komunikaty zdaniami, logowanie, zaproszenie, pierwsze wejście — E37 pkt 3–9, P10b.
- „Moje konto” i „Dla mnie” jako ekrany menu bocznego Opcji — P3-c.

### Pliki

`wyglad-P3-a/`: `porownanie-*` (obraz raportu u góry albo z lewej, aplikacja obok), `pasek-*`, `podpaski-*`, `menu-*`, `promy-*`.
