/**
 * audyt D-07 (E45 „Trasa” = droga + prom; E1, makieta `img/e1-kokpit-new`) — tylko demo.
 * Odcinki lądowe trasy jako osobne linie [lat, lng], rysowane ciągłą linią jak trasy HERE w produkcji
 * (`CorridorMap` → `loadRoadLines`). Bez odcinka morskiego — prom rysuje warstwa `ferryLeg` (tory wodne).
 * Punkty pośrednie to miasta na drodze (przybliżenie do kadru kraju, nie geometria nawigacji). Wszystkie leżą w kadrze
 * całej trasy (`corridorBoundsOf`: korytarz, tory wodne, cztery punkty) — kadr E1 bez zmian.
 */
export type DemoRoadLine = readonly (readonly [number, number])[];

/** PL: Śrem → Gniezno → Bydgoszcz → Świecie (S5) → A1 → Gdańsk, terminal promowy. */
const ROAD_PL_DEMO: DemoRoadLine = [
  [52.07391, 17.0246], [52.24, 17.09], [52.535, 17.6], [52.85, 17.72], [53.1235, 18.0084], [53.41, 18.45],
  [53.4837, 18.7536], [53.93, 18.7], [54.352, 18.6466], [54.4037, 18.6813],
];

/** SE: Nynäshamn → Sztokholm → E4 (Gävle, Sundsvall, Umeå, Luleå) → Boden, plac Stegra. */
const ROAD_SE_DEMO: DemoRoadLine = [
  [58.9045, 17.9562], [59.1, 17.9], [59.3293, 18.0686], [59.65, 17.93], [59.8586, 17.6389], [60.345, 17.515],
  [60.6749, 17.1413], [61.3, 17.06], [61.7274, 17.1056], [62.3908, 17.3069], [62.62, 17.9], [62.8, 17.94],
  [63.05, 18.33], [63.2909, 18.7153], [63.57, 19.5], [63.8258, 20.263], [64.19, 20.85], [64.7507, 20.9528],
  [64.95, 21.21], [65.3172, 21.4794], [65.43, 21.7], [65.5848, 22.154], [65.7, 21.95], [65.80539, 21.75914],
];

/** SE z Karlskrony: E22 (Kalmar, Västervik, Norrköping) → E4 → Sztokholm, dalej jak z Nynäshamn. */
const ROAD_SE_KAA_DEMO: DemoRoadLine = [
  [56.161, 15.63], [56.45, 16.07], [56.663, 16.356], [57.04, 16.41], [57.264, 16.448], [57.758, 16.637],
  [57.894, 16.405], [58.203, 16.601], [58.48, 16.32], [58.59, 16.18], [58.665, 16.37], [58.72, 16.47],
  [58.753, 17.008], [58.95, 17.49], [59.196, 17.626], [59.3293, 18.0686],
];

export const DEMO_ROAD_LINES: readonly DemoRoadLine[] = [ROAD_PL_DEMO, ROAD_SE_DEMO, ROAD_SE_KAA_DEMO];
