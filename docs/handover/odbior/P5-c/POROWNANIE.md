# Odbiór P5-c — wygląd: marża w Kokpicie, opłata paliwowa na fakturze i w panelu, odrzucenie dopłaty z powodem (koordynator, `wyglad/P5-c`)

Podział pracy: D-20261013-1835-01 (FRONT-KOORDYNATOR). Wzór: raport audytu `docs/handover/audyt_claude_2026-10-08/raport/` (konstytucja VIII, WYGLAD-RAPORT), dowód według Z3, Z4, Z10 i Z11 (D-20261013-1550-01).
Zakres: D-20261015-0300-01 D („Ekrany — wygląd” P5, reszta po `wyglad/P5-b`): Kokpit „Marża” z liczbą transportów z ceną i bez (E16), Faktury z „Opłata paliwowa t41 · ×1,13” (E39), panel „Ceny” z liczbą publikacji i „ostateczna od …” (E39), pole powodu odrzucenia dopłaty (E33). Do tego decyzja właściciela **W41** (15.10.2026, 18:32): stawka dobowa za postój od 10 h.

Ten PR zmienia tylko wygląd, teksty i obliczenia widoku (F8). Bez migracji, zapytań, zmian uprawnień i zapisów:
- marża i liczby w Kokpicie HHL — z tej samej funkcji co Finanse (`financeOf`: suma marż ÷ suma przychodów transportów z ceną, ta sama waluta i liczba „z ceną / bez ceny”; demo i produkcja);
- opłata przy pozycji faktury — z migawki opłaty na transporcie (`billLineFuel`, `src/lib/p5cFuel.ts`);
- powód odrzucenia — na ekranie (jak dziś decyzje dopłat), zapis podłącza wykonawca (dopisek D-20261015-1850-01).

Zrzuty z podglądu demo, „teraz” = 14.10.2026, 12:00 czasu polskiego, folder `zrzuty/`; obrazy porównawcze `porownanie-*.png` (lewa strona — raport, prawa — aplikacja).

## Z3 — element po elemencie

| ekran | raport / decyzja | po zmianie w aplikacji | zgodne | uwagi |
|---|---|---|---|---|
| Kokpit HHL › Marża | E16: „suma marż ÷ suma przychodów, z liczbą transportów z ceną i bez ceny”; E9: „Marża ważona przychodem” | „… PLN · ważona przychodem · 86 z ceną · 8 bez ceny” (demo: „72 z ceną”) — te same słowa co nagłówek Finansów | tak | % i kwota z `financeSummary(loads, 'both')` (to samo co `financeOf` w Finansach; bez przykładów demo w pierwszym wczytaniu — budżet 400 kB gzip: 392,3) (wcześniej z innego wyliczenia — przy transporcie z ceną tylko po jednej stronie Kokpit różnił się od Finansów) |
| Faktury › pozycja transportu | E39: „Opłata paliwowa t41 · ×1,13” i kwota z wyliczenia; przy weryfikacji widać tydzień opłaty | pod kodem transportu: „Opłata paliwowa t43 · ×1,05 · prognoza · 301,88 PLN” (w walucie faktury) | tak | stan „prognoza” liczony jak w Finansach; „bez ceny” — bez linii; faktura w PLN: kwota po kursie pozycji, bez kursu — bez kwoty |
| Faktury › tabela pozycji | E41 / E16 | kolumny „Transport” (było „Wysyłka”) i „Kurs NBP”; kurs „4,3750” z przecinkiem (było „4.3750”) | tak | — |
| Faktury › weryfikacja | E4: „Akceptuj” / „Sporna” z powodem | „Sporna” wielką literą jak na liście; pole „Powód sporu — wymagany przy »Sporna«” (było „Uzasadnienie (wymagane dla SPORNA)”) | tak | — |
| panel › Ceny › karta opłaty (ostateczna) | E39 SG-15: „OKQ8 … 22,63 SEK/l (4 publ.) → ×1,13 · Orlen 7,22 PLN/l (5 publ.) → ×1,15 · niższy ×1,13 · ostateczna” — `porownanie-e39-panel.png` | to samo w pasku z E33 („Po zmianie”): średnie z liczbą publikacji | tak | układ paska z E33 (nowszy niż karta E39); liczby demo inne niż w raporcie |
| panel › Ceny › karta opłaty (prognoza) | E39 SG-30: wiersz „Opłata paliwowa t43 · ×1,13 prognoza”; „wskaźniki t42 — jeszcze nie zamknięty; do tego czasu ostatnia ostateczna ×1,13 (wskaźniki t40); ostateczna od 19.10” — `porownanie-e39-prognoza.png` | wiersz „t43 · ×1,05 prognoza”; pasek „wskaźniki t42 · 12.10–18.10 · jeszcze nie zamknięte, do tego czasu ostatnia ostateczna ×1,05 (wskaźniki t41) · prognoza · ostateczna od 19.10” | tak | układ paska z E33; „wskaźniki t41”, bo „dziś” w demo to 14.10 (raport — 07.10); bez daty — „ostateczna po zamknięciu tygodnia przed załadunkiem” |
| panel › Ceny › dopłata czeka na KSH | E33 KSH SG-15: „Akceptuj” / „Odrzuć” — `porownanie-e33-ksh.png` | to samo (demo: SG-15) | tak | — |
| odrzucenie dopłaty | E33 / D-20261015-0300-01 D: odrzucenie dopłaty SCX przez HHL z powodem | „Odrzuć” otwiera pole „Powód odrzucenia” (fokus w polu, Enter — „Odrzuć dopłatę”, Escape — anuluj); HHL odrzucając dopłatę SCX musi wpisać powód („Wpisz powód — zobaczy go SCX.”), KSH może; potem „Odrzucona przez HHL: …” u SCX i HHL, „Odrzucona przez KSH: …” u KSH i HHL; formularz tylko dla firmy odrzucającej | tak | zasady jako czyste funkcje (`rejecterOf`, `rejectNeedsReason`, `rejectionVisibleTo`); `zrzuty/panel-odrzuc-*`, `panel-odrzucona-*` |
| Zasady cennika w panelu | W41 (15.10 18:32): stawka dobowa od 10 h | „Powyżej 10 h — 750 EUR za każdą rozpoczętą dobę” (było „Powyżej 24 h” na stałe) | tak | próg z zasad (`dayAfterH`); podpowiedź postoju 12 h → 1 doba × 750 EUR |

## Z4 — role

| konto | co widzi | sprawdzenie |
|---|---|---|
| HHL | Kokpit z liczbą transportów z ceną i bez; obie strony faktur z opłatą przy pozycji; dopłata SCX czeka — „Akceptuj” / „Odrzuć” z obowiązkowym powodem | podgląd demo, przebieg w przeglądarce |
| KSH | swoje faktury z opłatą po stronie przychodu; dopłata HHL czeka — „Akceptuj” / „Odrzuć” z powodem nieobowiązkowym | podgląd demo |
| SCX | swoje faktury z opłatą po stronie kosztu; dopłata „czeka na HHL”, po odrzuceniu — powód | podgląd demo, test |

## Z10 — telefon

360, 390 i 768 px: 0 px przewijania strony i panelu w poziomie; w formularzu odrzucenia przyciski ≥ 44 px, pole 16 px; pozycja faktury na karcie z linią opłaty paliwowej.

## Z11 — dostępność

axe (wcag2a, wcag2aa), motyw jasny i ciemny: Kokpit, faktura rozwinięta, panel SG-15 z otwartym polem powodu, panel SG-30 — **0 błędów**. Poprawione w trakcie (istniały przed tym PR): zakładki panelu jako lista zakładek (rola „tab” z panelem „tabpanel”, ← → Home End przełączają, Tab wchodzi tylko na wybraną) i tekst drugorzędny w pasku „Śledzenie trwa” w motywie ciemnym (kontrast ≥ 4,5). Sprawdzone klawiaturą w przeglądarce.

## Testy

- `tests/p5c-look.test.ts` — 12 testów: opłata przy pozycji faktury (koszt / przychód, waluta, prognoza i „bez ceny” jak w Finansach, brak danych), opis kafelka „Marża” z liczbami (także 0 transportów), karta opłaty (publikacje, „ostateczna od”, „jeszcze nie zamknięte”, „prognoza” w wierszu), zasady odrzucenia (kto odrzuca, kiedy powód obowiązkowy, kto widzi), W41.
- `tests/etap4-ui.spec.ts` — pole powodu sporu szukane po uchwycie `data-dispute-note` (tekst etykiety zmieniony na „Powód sporu”).
- `tests/fixtures/pl-t-exceptions.txt` — „elem” (skrót „elem.” w kafelku KSH, istniał wcześniej); test pisowni PL-T z hunspell pl_PL: 4/4.
- `tests/p5-fees.test.ts` — przepisany według W41: powyżej 10 h stawka dobowa (12 h → 750 EUR; dokładnie 10 h → godziny).
- Cały zestaw: 141 plików, 1103 testy zielone; `tsc -p tsconfig.app.json`, `lint:css`, `oxlint` bez nowych uwag.

## Niezależne sprawdzenie (F7)

Osobny agent (nie budował tego wyglądu) przejrzał zmiany 15.10, ok. 19:00: F8 i I-0 bez naruszeń; 11 uwag. Poprawione w tym PR: test `etap4` po zmianie etykiety, migawki Kokpitu, marża w Kokpicie z tego samego wyliczenia co Finanse, fokus / Enter / Escape w formularzu odrzucenia, formularz tylko dla firmy odrzucającej, stan opłaty na fakturze jak w Finansach (bez linii „×1,00”), tekst „jeszcze nie zamknięte … (wskaźniki t…)”, słowa liczby transportów jak w Finansach i brak opisu przy 0 transportów, zasady odrzucenia jako czyste funkcje z testami, zakładki panelu z obsługą klawiatury. Dopisek W41 (D-20261015-1805-01) jest w PR #222 — scalasz go przed tym PR.
- Migawki Playwright: Kokpit HHL (1920, jasny i ciemny) się zmienia — odświeżone w GitHub Actions (`visual.yml`, `update=true`), wpis w `docs/handover/G4_WZORZEC.md`.
