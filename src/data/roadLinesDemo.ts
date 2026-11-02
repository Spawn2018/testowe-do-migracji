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

/* ---------- BN9-c5 (#718 BN7): przykładowe linie Korytarza bałtyckiego — PRZYKŁAD (demo), nie geometria HERE ---------- */
/* Punkty to miasta na drodze (via z BN7 §2), jak linie PL/SE wyżej. W produkcji nigdy: tam legi z `map_display_state`. */

/** Śrem → Warszawa → Białystok → Suwałki → Kowno → Bauska → Ryga → Ainaži → Parnawa (wspólny początek PL-TLL/MUU/PLD). */
const ROAD_PL_EE_DEMO: DemoRoadLine = [
  [52.07391, 17.0246], [52.33, 17.57], [52.22, 18.25], [52.23, 19.36], [52.23, 21.01], [52.8, 21.89], [53.13, 23.16],
  [53.84, 22.98], [54.1, 22.93], [54.56, 23.35], [54.9, 23.9], [55.73, 24.36], [56.41, 24.19], [56.95, 24.11],
  [57.5, 24.38], [57.87, 24.36], [58.39, 24.5], [58.9, 24.43],
];
/** przykład: PL-TLL — dalej do Tallinna (Vanasadam). */
const ROAD_PL_TLL_DEMO: DemoRoadLine = [...ROAD_PL_EE_DEMO, [59.43, 24.75], [59.443, 24.77]];
/** przykład: PL-MUU — Tallinn → Muuga. */
const ROAD_PL_MUU_DEMO: DemoRoadLine = [...ROAD_PL_EE_DEMO, [59.43, 24.75], [59.47, 24.9], [59.497, 24.96]];
/** przykład: PL-PLD — Parnawa → Keila → Paldiski. */
const ROAD_PL_PLD_DEMO: DemoRoadLine = [...ROAD_PL_EE_DEMO, [59.3, 24.41], [59.335, 24.083]];

/** Wspólny koniec FI: Lahti → Jyväskylä → Oulu → Kemi → Tornio → Kalix → Boden. */
const ROAD_FI_TAIL_DEMO: DemoRoadLine = [
  [60.98, 25.66], [61.6, 25.6], [62.24, 25.75], [62.6, 25.73], [63.37, 25.57], [64.2, 25.4], [65.01, 25.47],
  [65.73, 24.56], [65.85, 24.15], [65.85, 23.15], [65.91, 22.65], [65.80539, 21.75914],
];
/** przykład: FI-HEL — Helsinki (Länsisatama) → Järvenpää → dalej E75. */
const ROAD_FI_HEL_DEMO: DemoRoadLine = [[60.153, 24.915], [60.47, 25.09], ...ROAD_FI_TAIL_DEMO];
/** przykład: FI-VUO — Vuosaari → Järvenpää → dalej E75. */
const ROAD_FI_VUO_DEMO: DemoRoadLine = [[60.206, 25.19], [60.47, 25.09], ...ROAD_FI_TAIL_DEMO];

/** E4 od Uppsali na północ (z linii SE wyżej). */
const SE_FROM_UPPSALA = ROAD_SE_DEMO.slice(ROAD_SE_DEMO.findIndex(([lat]) => lat === 59.8586));
/** przykład: SE-STO — Värtahamnen → Sztokholm → E4 jak z Nynäshamn. */
const ROAD_SE_STO_DEMO: DemoRoadLine = [[59.35, 18.105], ...ROAD_SE_DEMO.slice(ROAD_SE_DEMO.findIndex(([lat]) => lat === 59.3293))];
/** przykład: SE-KPS — Kapellskär → Norrtälje → Uppsala → E4. */
const ROAD_SE_KPS_DEMO: DemoRoadLine = [[59.721, 19.065], [59.76, 18.7], ...SE_FROM_UPPSALA];

/**
 * BN9-c5: linie demo z kodem legu — ten sam filtr co w produkcji (karta transportu: legi jego trasy; Mapa i Kokpit:
 * rdzeń i trasy aktywnych transportów; mapy stref: rdzeń). PL-GDY w demo = ta sama linia co PL-GDN (rysowana raz).
 * Rdzeń (PL-GDN, PL-GDY, SE-NYN, SE-KAA) = dokładnie `DEMO_ROAD_LINES` (dzisiejszy rysunek). Legi BN7 — przykład.
 */
export const DEMO_ROAD_LEGS: readonly { leg: string; line: DemoRoadLine; example?: true }[] = [
  { leg: 'PL-GDN', line: ROAD_PL_DEMO },
  { leg: 'PL-GDY', line: ROAD_PL_DEMO },
  { leg: 'SE-NYN', line: ROAD_SE_DEMO },
  { leg: 'SE-KAA', line: ROAD_SE_KAA_DEMO },
  { leg: 'PL-TLL', line: ROAD_PL_TLL_DEMO, example: true },
  { leg: 'PL-MUU', line: ROAD_PL_MUU_DEMO, example: true },
  { leg: 'PL-PLD', line: ROAD_PL_PLD_DEMO, example: true },
  { leg: 'FI-HEL', line: ROAD_FI_HEL_DEMO, example: true },
  { leg: 'FI-VUO', line: ROAD_FI_VUO_DEMO, example: true },
  { leg: 'SE-STO', line: ROAD_SE_STO_DEMO, example: true },
  { leg: 'SE-KPS', line: ROAD_SE_KPS_DEMO, example: true },
];
