# W-przeglad-mapa — panel transportu › Przegląd (właściciel 19.10.2026, 15:27)

Polecenie właściciela:
- z Przeglądu usunąć sekcję „Dokumenty” i przycisk „PDF transportu (+mapa)”;
- mapa na samej górze zakładki, w dawnej wysokości;
- „Do zrobienia” zaraz pod mapą;
- na komputerze „Do zrobienia” zwijane, domyślnie zwinięte, rozwija się po kliknięciu.

| Punkt | Przed | Po | Dowód |
|---|---|---|---|
| Kolejność Przeglądu | Do zrobienia / linia KSH → mapa → Plan i ETA → Awizacja → Ładunek → Numery → Dokumenty → PDF | **mapa** → sprawa „Czy dostarczono?” (jeśli jest) → **Do zrobienia** / linia KSH → Plan i ETA → Awizacja → Ładunek → Numery | `e8-phone-gate` (komputer: kolejność `todo, plan, awiz, cargo, numbers`, pierwszy element = mapa); `etap6-ui` (telefon: mapa, potem `todo`) |
| Sekcja „Dokumenty” | jest (zezwolenie, CMR, polisa SCX) | **brak**; dokumenty w zakładce Dokumenty | `[data-po="docs"]` = 0 |
| „PDF transportu (+mapa)” | przycisk na dole Przeglądu | **brak** | `[data-action="export-load-pdf-map"]` = 0 |
| Mapa — telefon | 150 px (E32) | **220 px** (jak przed zmniejszeniem) | `e8-phone-gate`: wysokość 220 |
| Mapa — komputer | 220 px | 220 px (nigdy nie była mniejsza) | — |
| „Do zrobienia” — komputer | sekcja zawsze otwarta, nad mapą | **zwinięta** pod mapą: tytuł z liczbą, pierwsza sprawa i „i jeszcze N”; kliknięcie rozwija | `etap6-ui`: `open = false`, po kliknięciu lista |
| „Do zrobienia” — telefon | zwinięta, nad mapą | zwinięta, **pod mapą** | `etap6-ui` |

Zrzuty: `komputer-zwiniete.png` (1440 px, T-01 HHL), `telefon-zwiniete.png` (390 px).

Bez zmian w bazie i w logice; KSH nadal bez „Do zrobienia” (linia stanu awizacji).

## F7 (niezależny przegląd, 19.10.2026) — gotowe; 0 B, 1 P, 7 D
- Sprawdzone: 46 transportów × 3 role na 1440 px — mapa 220 px pierwsza, „Do zrobienia” zwinięte, KSH tylko linia stanu; klawiatura (Tab, Enter, Spacja), brak ucięć; `p11-bramy` 32/32, `e8-phone-gate` (P7-a, P9-f, L14) 16/16.
- **P1 (poprawione):** `permit-validator.local` i `p64-permit-form.local` szukały `[data-permit="mismatch"]` z usuniętej sekcji — teraz wiersz zezwolenia w zakładce Dokumenty (`[data-permit-row] [data-permit-fit="no"]`).
- **D1 (poprawione, błąd sprzed PR):** „Dodaj” numer HHL z „Do zrobienia” najpierw otwiera pole w Numerach, potem ustawia kursor.
- **D2–D4 (poprawione):** komentarz nagłówka `PanelOverview`, martwy CSS (`.po-todo-hd`, `.po-pdf`, `.po-map.is-phone`), odstęp pod „Czy dostarczono?” (`gap` zamiast marginesu).
- **Zostaje (D):** nieużywane klucze `h7_pdf_*` / `p7_doc(s)_*` i `exportLoadPdfWithMap` — do sprzątania w P11 (słowniki); brama kontrastu P11 mierzy „Do zrobienia” zwinięte; produkcja: niezgodne zezwolenie w Przeglądzie widać tylko jako sprawę w „Do zrobienia” (zgodnie z poleceniem).
