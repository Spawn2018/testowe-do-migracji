# wyglad/W-naprawy — faktura tylko z CMR i co do grosza (A4), „jako” w Historii (B5) — 17.10.2026

Podstawa: D-20261017-0730-01 §2 (A4, B5); decyzja 07.10.2026, 12:35 (faktura co do grosza). Dopisek: D-20261017-1450-01 (z uzupełnieniem po F7, 15:40).
Wygląd, teksty i obliczenia widoku (F8). Reguła, którą widok przekazuje do bazy (tolerancja kwoty, „pominięty”), zmienia się na produkcji dopiero z A4 wykonawcy — wyłącznik `INVOICE_A4` (w demo działa od razu). Baza (`register_invoice`, Podgląd) — wykonawca w A4 i B5.

| Miejsce | Było | Jest |
|---|---|---|
| Finanse › Faktury › „Nowa faktura” (SCX → HHL i HHL → KSH) | wszystkie transporty rozładowane w tygodniu do zaznaczenia, także bez CMR | do zaznaczenia tylko „gotowe do faktury”: „Gotowe do fakturowania” / „Zafakturowano” albo aktualny CMR wgrany po rozładunku (jak automat C17); reszta szara, nie do zaznaczenia, „czeka na CMR”; pod tabelą „Czeka na CMR (6): SG-02, T-02, …” |
| Kafel „Czeka na wystawienie”, liczba przy „Faktury” w menu, Kokpit | liczyły także transporty bez CMR (np. „7 gotowych do faktury”, „Faktury 8”, a w kreatorze do zaznaczenia 1) | ta sama definicja co w kreatorze: „1 transport”, „Faktury 2”, „… czekają na podpisany CMR · 1 gotowy do faktury” (`now=28.09`) |
| Lista „Tydzień” w kreatorze | tydzień bez gotowych transportów otwierał pusty kreator | dopisek „· czeka na CMR”; domyślnie najnowszy tydzień z gotowym transportem |
| „pominięty z tygodnia · N” | ze wszystkich transportów tygodnia | tylko wśród gotowych (po A4; w demo od razu) |
| Kontrola kwoty | „zgodna” przy różnicy do 1 i do 0,2 % | **co do grosza:** każda różnica ≥ 0,01 → „kwota” (po A4; w demo od razu) |
| „Różnica · zgodna” w sumie | z samej sumy — dwie różnice ±0,01 dawały „0,00 · zgodna”, pusta faktura też | „zgodna” tylko gdy suma = 0, są pozycje i żadna nie ma „kwota” |
| Kwota w polu „Na fakturze” | „6271.9”; wpis „6 271,90” dawał 0 | podpowiedź „6 271,90”; pole przyjmuje spację i twardą spację |
| Telefon (390 px) | każdy transport bez CMR jako karta (ok. 280 px), etykieta „Kontrole” dwa razy | czekające tylko w zdaniu z kodami; pierwsza etykieta „Na fakturę”; pole wyboru z celem 44 px |
| Historia i oś Status transportu, wpis z Podglądu (B5) | autor: sam administrator | „Anna Wiśniewska // H&H Logistics jako Piotr Zając // KSH” (z `payload.preview_as`) |
| „Do zrobienia” — nowe sprawy z A2, A3, A6 | sprawa z nowym kodem pokazałaby surowy kod | „Daty KSH do sprawdzenia”, „Czy dostarczono?”, „Wgraj CMR” i przyciski („Daty są dobre”, „Tak, dostarczono”, …) |
| Dane demo — CMR | wgrany o 16:30 dnia planowej dostawy (czasem przed rozładunkiem albo po zegarze demo) | wgrany 2 h po rozładunku, tylko gdy to już było |
| Komunikat „PDF jest za duży” | „12.4 MB” | „12,4 MB” |

Obrazy (1440 px; `now=2026-09-28T10:00Z`, tydzień 39 zamknięty):
- `po-kreator-hhl.webp` — HHL → KSH: T-11 do faktury, 6 transportów czeka na CMR, „0,00 · zgodna”;
- `po-kreator-scx.webp` — SCX → HHL, ten sam tydzień, ze sposobem zapłaty;
- `po-faktury-hhl.webp` — kafel „Czeka na wystawienie · 1 transport” i „Faktury 2” w menu;
- `po-kokpit-hhl.webp` — „… czekają na podpisany CMR · 1 gotowy do faktury”;
- `po-kreator-telefon.webp` — telefon 390 px: karta T-11, zdanie z kodami czekających.

Testy:
- `tests/w-naprawy.test.ts` — `billReady` (status, CMR po rozładunku, zastąpiony, z błędem), `billSumOk` (±0,01 się nie znoszą, pusta faktura), `parseAmount` („6 271,90”), „Do wystawienia” i liczba w menu tylko z CMR, wyłącznik `INVOICE_A4`, autor „jako”, nazwy nowych spraw;
- `tests/invoices3.test.ts` — KWOTA co do grosza, „pominięty” z dokumentami CMR;
- `tests/p3b-cockpit-e9.test.ts` — liczba przy „Faktury” i Kokpit z CMR;
- e2e: `etap4-ui` (faktury), `e8-phone-gate` (P5 Finanse, Faktury, Dokumenty; P6-b Historia; P3-b Kokpit), `aud03-ksh-panel`.
