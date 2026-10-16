# wyglad/P9-b — bez „Kontroli trasy” i „Przeszkód wzdłuż korytarza” (16.10.2026, 05:45)

Podstawa:
- decyzja właściciela 16.10.2026, 01:13: rezygnacja na stałe z „Przeszkód wzdłuż korytarza” i „Kontroli trasy” (H-1, H-3);
- D-20261016-0200-01 (P9: usunięcie H-1 i H-3);
- PLAN §4 P9.

Złożone na `wyglad/P7-b` (#231): Przegląd w panelu (P7-a) już nie pokazuje obu sekcji. Ten PR usuwa resztę wyglądu.

| Miejsce | Było | Jest |
|---|---|---|
| Panel transportu › Przegląd | sekcje „Kontrola trasy” i „Przeszkody wzdłuż korytarza” (usunięte w P7-a, pliki zostały) | pliki `RouteCheckPanel.tsx` i `CorridorObstaclesPanel.tsx` usunięte |
| Opcje › System › Przełączniki | 13 przełączników, w tym „Kontrola trasy HERE”, „Przeszkody wzdłuż korytarza”, „Warstwa przeszkód na mapie” (każdy „Czeka na wymiary”) | 10 przełączników, bez tych trzech |
| Teksty | `h1_*` (bez `h1_tile*`) i `h3_*` w 3 językach, `p3c_flag_H1/H3/H6` | usunięte |

Bez zmian (dane — Cursor, P9, D-20261016-0200-01):
- tekst ryzyka `rk_route_obstacle` i rodzaj `ROUTE_OBSTACLE` w dzwonku zostają, dopóki baza ma takie ryzyka (pokazują się zdaniem, nie kluczem);
- `h1_tile*` (budżet HERE) zostaje.

**Sprawdzone:**
- e2e P3-c (Przełączniki: 10 wierszy, telefon 0 w bramie E8) i P7-a — 8/8;
- unit — cały zestaw zielony;
- pierwsze wczytanie 375,4 kB gzip.

**Zrzut:** `przelaczniki-1440.webp`.
