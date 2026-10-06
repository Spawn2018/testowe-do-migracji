# Kafelki mapy dla testów wizualnych (P2-TILES, 06.10.2026)

Zapis 06.10.2026 ~10:35 (Europe/Warsaw), `TILES=record` na buildzie demo `70bd625`, ujęcia `mapa__*` matrycy 280.
Tylko do bramy wizualnej (`scripts/baseline.mjs`, `tests/visual.spec.ts`, `tests/visual-states.spec.ts`) — aplikacja ich nie używa.

| katalog | źródło | układ | atrybucja |
|---|---|---|---|
| `carto-dark/` | `https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png` | `z/x/y.png` | © OpenStreetMap contributors © CARTO |
| `esri-streets/` | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}` | `z/x/y.jpg` | Esri, HERE, Garmin, © OpenStreetMap contributors |
| `_missing.png` | szary zastępnik dla kafelka spoza repozytorium (matryca zgłasza błąd) | — | — |

Uwaga (06.10): CARTO `dark_all` bez klucza zwraca kafelek „API KEY REQUIRED” — zapisany tak, jak go widzi produkcja
w trybie zapasowym (bez HERE). Zmiana dostawcy podkładu = osobna pozycja PLAN, nie ten katalog.

Odświeżenie (świadome, z przyczyną w PLAN/POSTEP): `TILES=record BASE_URL=http://127.0.0.1:4179/ OUT=tmp-rec FILTER=mapa__ node scripts/baseline.mjs`.
