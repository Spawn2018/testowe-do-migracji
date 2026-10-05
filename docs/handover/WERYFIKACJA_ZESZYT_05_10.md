# Weryfikacja zeszytu B/C na produkcji — 05.10.2026

Zasada: DONE tylko gdy na **produkcji** wygląda i działa jak **dosłowne** słowa właściciela z `ZLECENIE_POPRAWKI_02_10.md` (część B/C). Dowód = zrzut w `docs/evidence/zeszyt/<numer>.png`. Bez zrzutu = niezrobione.

Źródło listy: `LISTA_KONTROLNA_ZESZYT.md`.

| numer | słowa właściciela (dosłownie / skrót z listy) | wynik | zrzut | PR / migracja |
|-------|-----------------------------------------------|-------|-------|---------------|
| 1.1 | Na mapach jest wiele obiektów — pomimo braku podłączonych pojazdów → na mapach nie ma obiektów bez prawdziwych pojazdów (tylko naczepa SG-03 i promy) | **zgodne** — na MAPA: 1 znacznik pojazdu = GPS `EMTRACK_WEB` naczepy GD035YX (SG-03 / IN_TRANSIT_SE); 4 promy AIS; 0 znaczników demo/seed; `prodFleetMarkers` (brak pozycji = brak znacznika). Uwaga (poczekalnia): napis „2 pojazdów w ruchu” liczy `progress`, nie GPS. | `docs/evidence/zeszyt/1.1.png` (+ `1.1-390.png`) | brak zmiany kodu (stan prod) |

## Raport sekcji 1 (Mapy)
- Zgodne: 1
- Poprawione: 0
- ⛔: 0
- Wdrożenie: nie wymagane (bez zmian kodu)
