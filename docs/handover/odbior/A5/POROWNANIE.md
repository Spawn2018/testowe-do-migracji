# wyglad/A5 — okno „Zmień status”: CMR i faktury (E25 „Rozliczenie”)

Źródło: raport audytu E25, „Ręczna zmiana statusu z datą”, punkt „Rozliczenie”: „Gotowe do fakturowania” ustawione ręcznie od razu prosi o plik CMR, a „Zafakturowano” wymaga wskazania faktury. Decyzje z 07.10, 17:46: „Zafakturowano”, gdy transport jest na obu fakturach (SCX → HHL i HHL → KSH), a w panelu widać, której brakuje. Dopisek D-20261015-0300-01 A5: pole w oknie robi koordynator po wpisie wykonawcy w POSTEP (wpis „Poprawki audyt A NA PRODUKCJI”, 15.10).

E25 nie ma obrazu tego fragmentu, więc użyte są tylko elementy, które już są w oknie (Z10 pkt 2): pola ostrzeżeń `.scm-info`, podpis pola jak w formularzu, przycisk `.btn`.

## Co jest w oknie

| Wybrany status | Okno | „Zapisz status” |
|---|---|---|
| Gotowe do fakturowania, brak CMR | czerwone pole „„Gotowe do fakturowania” jeszcze nie. Brakuje pliku CMR z podpisem odbiorcy.” i przycisk „Wgraj CMR” | zablokowany |
| Gotowe do fakturowania, CMR jest | zielone pole „CMR z podpisem odbiorcy: <plik>”, „wgrany <data, godzina>” | aktywny |
| Zafakturowano | „Faktury z tym transportem”: SCX → HHL i HHL → KSH, przy każdej numer i data albo „brak” | zablokowany, gdy brakuje faktury, którą firma widzi |

- „Wgraj CMR” otwiera dzisiejsze okno „Wgraj dokument” z tym transportem i rodzajem CMR. Zapis odbywa się tak jak dziś (`attachDocumentFile`). Po wgraniu pole zmienia się na zielone. Klawisz Esc zamyka najpierw okno „Wgraj dokument”.
- SCX nie widzi faktury HHL → KSH. Przy tej fakturze ma napis „sprawdzi baza przy zapisie”, a blokuje go tylko brak jego własnej faktury.
- Baza sprawdza to samo w `load_status_set` (migracja 0210): brak CMR albo jednej z faktur oznacza odmowę z komunikatem.
- Bez nowych zapytań i zapisów: dokumenty i faktury pochodzą z danych, które aplikacja już ma.

## Zrzuty (podgląd demo, „teraz” 14.10.2026 12:00)

Faktury SG-12 (na obu fakturach) i SG-13 (tylko SCX → HHL) dopisane zostały wyłącznie w przeglądarce podglądu, na potrzeby zrzutów. Numery są zmyślone.

| Plik | Co |
|---|---|
| `okno-1440-hhl-gotowe-brak-cmr.png` | HHL, SG-09: brak CMR, „Wgraj CMR”, zapis zablokowany |
| `okno-1440-scx-wgraj-cmr.png` | SCX: „Wgraj CMR” otwiera „Wgraj dokument” z SG-09 i CMR |
| `okno-1440-scx-gotowe-cmr-jest.png` | SCX, SG-12: CMR jest, plik i godzina wgrania |
| `okno-1440-hhl-zafakturowano-sg12.png` | HHL, SG-12: obie faktury, „Transport jest na obu fakturach.” |
| `okno-1440-hhl-zafakturowano-sg13.png` | HHL, SG-13: brak HHL → KSH, zapis zablokowany |
| `okno-1440-scx-zafakturowano-sg12.png` | SCX, SG-12: własna faktura jest, HHL → KSH „sprawdzi baza przy zapisie” |
| `okno-1440-hhl-zafakturowano-sg13-ciemny.png` | to samo co SG-13 w ciemnym motywie |
| `telefon-390-scx-gotowe-brak-cmr.png` | telefon 390 px, arkusz od dołu, „Wgraj CMR” na całą szerokość (44 px) |
| `telefon-390-hhl-zafakturowano-sg13.png` | telefon 390 px, faktury |

## Sprawdzenia

- `tests/a5-status-settlement.test.ts` — 7 testów: CMR (brak, zastąpiony, najnowszy), faktury (HHL obie, inna faktura się nie liczy, SCX bez faktury HHL → KSH) i źródło okna.
- `npm run test:unit` — 136 plików, 1064 testy zielone; `npm run lint:css` — 0.
- axe (WCAG 2 A i AA) w oknie: 8 wariantów (jasny i ciemny; HHL i SCX; oba statusy) — 0 naruszeń.
- Telefon 390 i 768 px: bez przewijania w poziomie, przycisk 44 px.
