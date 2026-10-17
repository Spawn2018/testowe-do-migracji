# wyglad/W-naprawy — kreator faktury tylko z CMR i co do grosza (A4), „jako” w Historii (B5) — 17.10.2026

Podstawa: D-20261017-0730-01 §2 (A4, B5); decyzja 07.10.2026, 12:35 (faktura co do grosza). Dopisek: D-20261017-1450-01.
Wygląd i obliczenia widoku (F8). Baza (`register_invoice`, Podgląd) — wykonawca w A4 i B5.

| Miejsce | Było | Jest |
|---|---|---|
| Finanse › Faktury › „Nowa faktura” (SCX → HHL i HHL → KSH) | wszystkie transporty rozładowane w tygodniu do zaznaczenia, także bez CMR | do zaznaczenia tylko transporty z CMR („Gotowe do fakturowania” / „Zafakturowano” albo wgrany CMR z podpisem odbiorcy); reszta szara: pole wyboru nieaktywne, bez kwoty, znacznik „czeka na CMR”, pod tabelą „Czeka na CMR: N.” |
| „pominięty z tygodnia · N” | liczone ze wszystkich transportów tygodnia — z czekającymi na CMR | liczone tylko wśród transportów z CMR (czekających nie da się dać na fakturę) |
| Kontrola kwoty | „zgodna” przy różnicy do 1 i do 0,2 % | **co do grosza:** każda różnica ≥ 0,01 → „kwota”, bez „zgodna” |
| Kwota w polu „Na fakturze” | „6271.9” (kropka, bez groszy) | „6271,90” |
| Historia transportu, wpis z Podglądu (B5) | autor: sam administrator | „Anna Wiśniewska // H&H Logistics jako Piotr Zając // KSH” (z `payload.preview_as`) |
| Komunikat „PDF jest za duży” | „12.4 MB” | „12,4 MB” |

Obrazy (`now=2026-09-23T14:32Z`, 1440 px):
- `po-kreator-hhl.webp` — HHL → KSH, tydzień 39: T-11 do faktury, 6 transportów rozładowanych 22–23.09 czeka na CMR;
- `po-kreator-scx.webp` — SCX → HHL, ten sam tydzień, z wyborem sposobu zapłaty.

Testy:
- `tests/w-naprawy.test.ts` (4) — `billReady` (status i CMR), wiersze szare w kreatorze, „pominięty” tylko z CMR, tolerancja 0,01, autor „jako”;
- `tests/invoices3.test.ts` — KWOTA co do grosza (+0,01 → flaga), „pominięty” z dokumentami CMR;
- e2e: `etap4-ui` (faktury M6), `e8-phone-gate` (P5 Finanse i Faktury, P5 Dokumenty, P6-b Historia) — 61 zielonych + 3 po ostatniej zmianie.
