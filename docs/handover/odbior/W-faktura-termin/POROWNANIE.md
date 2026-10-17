# wyglad/W-faktura-termin — wygląd pod A4 „Faktura po terminie płatności” — 17.10.2026

Podstawa: D-20261017-0730-01 §2 A4 („Po terminie płatności → ryzyko `INVOICE_OVERDUE` dla HHL, raz na fakturę (dzwonek i e-mail według macierzy)”); E4 (obieg faktury: „Po terminie bez zapłaty → status „Po terminie” i ryzyko”); E7, E9 (jedna liczba „Do zrobienia” w menu, Kokpicie i dzwonku); E43 (treści wiadomości). Dopisek: D-20261017-2130-01 (§5 — A1 L17, E27 pkt 7: „Potwierdź dostawę”).
Wygląd, teksty, obliczenia widoku i dane demo (F8). Sprawę w bazie, rodzaj powiadomienia, wiersz macierzy i link w powiadomieniu robi wykonawca w A4.

| Miejsce | Było | Jest |
|---|---|---|
| Ryzyka › Do zrobienia (HHL) | faktura po terminie była tylko kafelkiem „Po terminie” w Fakturach; sprawy nie było | karta bez transportu: „Faktura HHL/FV/2026/0901 (HHL → KSH) nieopłacona po terminie 15.10.2026” · „uzupełnia H&H Logistics”; przyciski „Biorę tę sprawę” i „Otwórz fakturę”; jedna karta na fakturę; liczy się w menu, Kokpicie i dzwonku u Administratora i Operacji HHL, u SCX i KSH — nie |
| „Otwórz fakturę” (Do zrobienia), wiersz w Kokpicie „Najpilniejsze” | — | Faktury, zakładka kierunku faktury (HHL: koszt albo przychód), rozwinięte szczegóły faktury, przewinięcie do niej i fokus na wierszu |
| Link `/finanse/faktury/<id>` (dzwonek, e-mail) | prowadził do listy Faktur — szczegóły trzeba było znaleźć samemu (`openInvoiceId` nieużywane) | otwiera szczegóły tej faktury jak wyżej — także dla obecnych e-maili faktur, gdy link ma id |
| Faktury › „Opłacona” | sprawy nie było | „Opłacona” zamyka sprawę od razu; spór (Sporna) też; cofnięcie opłaty po terminie przywraca sprawę (w demo; na produkcji sprawę zakłada baza) |
| Opcje › Powiadomienia › Kto co dostaje › Pieniądze (demo) | brak wiersza | „Faktura nieopłacona po terminie” — „raz na fakturę · tylko HHL · znika po „Opłacona”” · Administrator HHL: dzwonek i e-mail, Operacje HHL: dzwonek, KSH i SCX — „—”. Na produkcji wiersz `inv_overdue` dopisuje wykonawca razem z macierzą |
| Opcje › Powiadomienia › Treści wiadomości › Faktury | brak pozycji | „Faktura po terminie”: temat „Faktura {Numer faktury} nieopłacona po terminie {Termin}”, treść „Faktura … ({Tydzień}), {Kwota}: termin płatności {Termin} minął, a faktura nie jest oznaczona jako opłacona. Sprawdź płatność i oznacz fakturę: {Link do faktury}” |
| Ryzyka › Do zrobienia, Automatyzacje › lista spraw (A1 L17) | brak sprawy po spóźnionej dostawie | „Potwierdź dostawę” (karta przy transporcie, „Otwórz transport”), opcje „Podaj status ręcznie” i „Jeszcze w drodze — przypomnij jutro”; rodzaj `DELIVERY_UNCONFIRMED` na liście spraw w Automatyzacjach. Sprawę zakłada baza w A1 (dopisek §5) — bez niej widok jak dziś |
| Treści wiadomości › wszystkie e-maile faktur | klocek „Link do transportu”, podgląd `tower.log-mar.pl/#/transport/SG-01` | klocek i przycisk „Link do faktury”, podgląd `tower.log-mar.pl/#/finanse/faktury/…` (zapis klocka bez zmian: `{{link}}`) |

Obrazy (`now=2026-11-20T10:00Z` — trzy faktury demo po terminie; przy zegarze wzorców 23.09 żadna, więc wzorce `visual` bez zmian):
- `po-ryzyka-1440.webp` — komputer: karta „Faktura HHL/FV/2026/0901 (HHL → KSH) nieopłacona po terminie 15.10.2026”;
- `po-faktura-1440.webp` — po „Otwórz fakturę”: zakładka „Do KSH · przychód”, szczegóły faktury 0901 rozwinięte;
- `po-ryzyka-390.webp`, `po-faktura-390.webp` — telefon: karta i faktura po przejściu;
- `po-kto-co-1440.webp` — „Kto co dostaje” › Pieniądze z nowym wierszem;
- `po-tresci-1440.webp` — „Treści wiadomości” › „Faktura po terminie” z klockiem „Link do faktury”.

Testy:
- `tests/w-faktura-termin.test.ts` — kiedy faktura jest „po terminie” (dzień terminu — jeszcze nie; opłacona i sporna — nie), jedna sprawa na fakturę z kluczem i parametrami, wiersz bazy → sprawa (`detail.invoice_id` → „Otwórz fakturę”), liczba u HHL Administratora i Operacji, nie u SCX i KSH, zamknięcie po „Opłacona” i sporze, przywrócenie tylko w demo, przejścia do faktury, wiersz demo „Kto co dostaje”, treść e-maila, „Link do faktury”;
- `tests/p8-texts.test.ts` — 46 pozycji; rodzaj `INVOICE_OVERDUE` „planned”, dopóki wykonawca nie doda go w `notifyTemplates.ts`;
- e2e `etap6-ui` (CI): „A4 — faktura po terminie” — karta, „Otwórz fakturę” → szczegóły i fokus, „Opłacona” zamyka sprawę, liczba w menu o 1 mniej; link `/finanse/faktury/<id>` otwiera fakturę kosztową w zakładce kosztów.
