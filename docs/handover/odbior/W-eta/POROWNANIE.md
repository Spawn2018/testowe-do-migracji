# wyglad/W-eta — czasy przy ETA „X d Y h Z min” (D-071) i „przyjazd nocą” na Mapie i w Harmonogramie (D-101) — 17.10.2026

Podstawa:
- D-071 (zeszyt 8.8, decyzja właściciela 02.10): ETA „X d Y h Z min” powyżej 24 h, „Y h Z min” poniżej;
- D-101 (ETA-MARK, 05.10): znaczniki „w oknie / przed terminem / po terminie / przyjazd nocą 22–06”;
- audyt 17.10, §3.1 pkt 3 i 5 (pominięte w planie); D-20261017-0730-01 §3 pkt 2–3 („wygląd koordynatora, jeśli brak”; „widok sprawdza koordynator”).

Dopisek: D-20261017-1100-01. Tylko wygląd, teksty i obliczenia widoku (F8).

| Miejsce | Było | Jest |
|---|---|---|
| Pigułka opóźnienia (panel, Harmonogram, nagłówek) | „+20h47”, „+1d 18h 00m” | „+20 h 47 min”, „+1 d 18 h” |
| Mapa — „ETA Boden” | „+28 h 27 min po oknie” | „+1 d 4 h 27 min po oknie”; przy ETA 22:00–06:00 dopisek „przyjazd nocą” |
| Harmonogram — „ETA Boden” | sama godzina | pod godziną „przyjazd nocą”, gdy ETA wypada 22:00–06:00 |
| Blok ETA (panel) | czasy powyżej 24 h w samych godzinach: „jazda 26 h 10 min”, „z GPS 26 h 5 min temu” | „jazda 1 d 2 h 10 min”, „z GPS 1 d 2 h 5 min temu”; poniżej 24 h bez zmian („jazda 8 h 20 min”) |

W bloku ETA znaczniki „przed oknem / w oknie / po oknie dostawy” i „przyjazd nocą” już były (P4-b). Teraz D-101 jest też na Mapie i w Harmonogramie.

Jedna funkcja `etaDuration` (`src/lib/etaDuration.ts`) dla bloku ETA, pigułki, Mapy i Harmonogramu (E21: jeden moduł formatów). Części równe zero są pomijane („2 h”, „1 d 18 h”).

Obrazy (demo, `now=2026-09-23T14:32Z`; `przed-*` = `wyglad/W-pl`, `po-*` = ta gałąź):
- `*-eta-sg-35` — pigułka „+20 h 47 min”;
- `*-map-table` — SG-14 „+1 d 4 h 27 min po oknie”;
- `po-sched-night` — SG-03 „26.09.2026, 02:00 · przyjazd nocą”.

**Testy:**
- `tests/status-pill.test.ts` — przepisany na D-071 (8 przypadków, w tym `etaDuration`);
- unit: 1527 zielonych.

**Teksty z serwera** (e-maile, SMS, tytuły spraw) z tym samym formatem — wykonawca w P4-u (D-20261017-0730-01 §3 pkt 3).
