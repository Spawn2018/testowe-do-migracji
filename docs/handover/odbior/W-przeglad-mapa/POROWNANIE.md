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
