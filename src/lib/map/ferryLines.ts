/**
 * wyglad/W-dane — E45 pkt 1 (decyzja 07.10.2026, 22:15; L56): przeprawy promowe na mapie mają się pokrywać z trasami
 * promów HERE. Serwer (P9, pozycja E45) dopisuje do `map_display_state` pole `ferries` — odcinki promowe z odpowiedzi
 * HERE Routing (`sections[].transport.mode = 'ferry'`), każdy jako `{ leg: 'FERRY-GDN-NYN' | 'FERRY-GDY-KAA',
 * points: [[szer., dł.], …] }`. Widok przyjmuje odcinek tylko wtedy, gdy zaczyna się i kończy przy właściwych portach
 * (do 10 km, w dowolnym kierunku), nie ma dziury (krok ≤ 150 km) i ma rozsądną długość (1,0–1,6 raza prostej). Bez danych albo przy złej geometrii zostają stałe tory wodne
 * (`WATER_GDN_NYN`, `WATER_GDY_KAA`) — dzisiejszy rysunek.
 */
import { haversineKm, lineLengthKm, maxSegmentKm, type LatLng } from './draw';
import { waterTrackOf, type WaterTrackId } from '../ferryCatalog';

export type FerryLeg = 'FERRY-GDN-NYN' | 'FERRY-GDY-KAA';

interface Port { lat: number; lng: number }
const PORTS: Record<FerryLeg, readonly [Port, Port]> = {
  /* Gdańsk (Westerplatte, Polferries) — Nynäshamn */
  'FERRY-GDN-NYN': [{ lat: 54.4, lng: 18.67 }, { lat: 58.9, lng: 17.95 }],
  /* Gdynia (Stena Line) — Karlskrona (Verkö) */
  'FERRY-GDY-KAA': [{ lat: 54.533, lng: 18.54 }, { lat: 56.15, lng: 15.62 }],
};

/** Koniec odcinka do 10 km od terminalu (Gdańsk i Gdynia dzieli 17 km — odcinek nie może pomylić portów). */
const PORT_KM = 10;
/** Długość odcinka wobec prostej między portami: od 1,0 do 1,6 raza. */
const MIN_RATIO = 1;
const MAX_RATIO = 1.6;
/** Najdłuższy krok między punktami — dłuższy oznacza dziurę w geometrii (na otwartym morzu HERE daje długie proste). */
const MAX_STEP_KM = 150;

/** Powód odrzucenia odcinka (do sprawdzenia na TEST, L56); null = odcinek dobry. */
export function ferryLineWhy(leg: FerryLeg, line: readonly LatLng[]): string | null {
  if (line.length < 2) return 'brak punktów';
  const [a, b] = PORTS[leg];
  const first = line[0];
  const last = line[line.length - 1];
  const near = (p: LatLng, port: Port) => haversineKm(p[0], p[1], port.lat, port.lng) <= PORT_KM;
  const ends = (near(first, a) && near(last, b)) || (near(first, b) && near(last, a));
  if (!ends) return `końce dalej niż ${PORT_KM} km od portów`;
  const step = maxSegmentKm(line);
  if (step > MAX_STEP_KM) return `krok ${Math.round(step)} km (dziura w geometrii)`;
  const straight = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const len = lineLengthKm(line);
  if (len < straight * MIN_RATIO || len > straight * MAX_RATIO) return `długość ${Math.round(len)} km przy ${Math.round(straight)} km prostej`;
  return null;
}

/** Czy linia łączy porty odcinka (w jednym albo drugim kierunku) i ma rozsądną długość. */
export function ferryLineOk(leg: FerryLeg, line: readonly LatLng[]): boolean {
  return ferryLineWhy(leg, line) === null;
}

/** Odcinki promowe z `map_display_state.ferries`, które przeszły sprawdzenie (najwyżej jeden na przeprawę). */
export function acceptedFerries(rows: unknown): { leg: FerryLeg; line: LatLng[] }[] {
  return checkFerries(rows).accepted;
}

/**
 * Wynik sprawdzenia: przyjęte odcinki i powody odrzucenia. Mapa zapisuje skrót w `data-ferries` elementu mapy
 * (np. „FERRY-GDN-NYN: HERE · FERRY-GDY-KAA: tor — krok 210 km”), żeby na TEST było widać, czemu został stały tor.
 */
export function checkFerries(rows: unknown): { accepted: { leg: FerryLeg; line: LatLng[] }[]; rejected: { leg: string; why: string }[] } {
  const rejected: { leg: string; why: string }[] = [];
  if (!Array.isArray(rows)) return { accepted: [], rejected };
  const out: { leg: FerryLeg; line: LatLng[] }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const leg = String((row as { leg?: unknown }).leg ?? '') as FerryLeg;
    if (!(leg in PORTS) || out.some((x) => x.leg === leg)) continue;
    const points = (row as { points?: unknown }).points;
    if (!Array.isArray(points)) { rejected.push({ leg, why: 'brak punktów' }); continue; }
    const line: LatLng[] = [];
    for (const p of points) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) line.push([lat, lng]);
    }
    const why = ferryLineWhy(leg, line);
    if (why) rejected.push({ leg, why });
    else out.push({ leg, line });
  }
  return { accepted: out, rejected };
}

/** Skrót do `data-ferries`: każda przeprawa — „HERE” albo „tor” z powodem. */
export function ferrySummary(r: ReturnType<typeof checkFerries>): string {
  return (Object.keys(PORTS) as FerryLeg[])
    .map((leg) => {
      if (r.accepted.some((a) => a.leg === leg)) return `${leg}: HERE`;
      const why = r.rejected.find((x) => x.leg === leg)?.why;
      return `${leg}: tor${why ? ` — ${why}` : ''}`;
    })
    .join(' · ');
}

/* ---------- BN9-a: tory wodne nowych przepraw (Estonia ⇄ Finlandia / Szwecja) ---------- */

/** Tory nowych przepraw (id z katalogu promów); GDN-NYN i GDY-KAA rysuje dalej `mapPool` z `WATER_*` ([dł., szer.]). */
export type ExtraWaterTrack = Exclude<WaterTrackId, 'GDN-NYN' | 'GDY-KAA'>;

/**
 * Tory wodne [szer., dł.] — od wody przy terminalu wyjazdowym do wody przy docelowym (nie są geometrią HERE). Wyznaczone
 * po wodzie na wielokątach lądu OpenStreetMap (land-polygons, 26.10.2026; najkrótsza droga z zapasem od brzegu przez
 * punkty kursu armatora) i sprawdzone: żaden odcinek nie przecina lądu. Ten sam styl linii co `WATER_GDN_NYN` /
 * `WATER_GDY_KAA`. Rysowane tylko, gdy trasę ma widoczny transport (dziś żaden — mapa bez zmian).
 */
export const WATER_TRACKS_EXTRA: Record<ExtraWaterTrack, readonly LatLng[]> = {
  /* Tallinn (Vanasadam) → Tallinna laht między Paljassaare a Viimsi, na zachód od Aegna → Zatoka Fińska → podejście do
     West Harbour (Länsisatama) od południa */
  'TLL-HEL': [
    [59.4468, 24.7727], [59.4488, 24.772], [59.4498, 24.77], [59.62, 24.72], [60.0, 24.9], [60.14, 24.908],
    [60.1477, 24.9169],
  ],
  /* Muuga (HHLA TK) → zatoka Muuga → na zachód od Prangli → Zatoka Fińska → Vuosaaren selkä → Vuosaari */
  'MUU-VUO': [
    [59.497, 24.9582], [59.6, 24.9], [59.97, 25.15], [60.182, 25.19], [60.186, 25.188], [60.206, 25.19],
  ],
  /* Tallinn → na północ od Naissaar → Zatoka Fińska na zachód (między Hanko a Osmussaar, na południe od Utö i Kökar) →
     Mariehamn (Västerhamn) → Morze Alandzkie → Söderarm → Furusundsleden → Vaxholm → na południe od Lidingö
     (Halvkakssundet, Saltsjön) → Blockhusudden → Värtahamnen. Od północy (Lilla Värtan) się nie da — Lidingöbron. */
  'TLL-STO': [
    [59.4468, 24.7727], [59.4488, 24.772], [59.4498, 24.77], [59.63, 24.62], [59.64, 24.3], [59.63, 24.0],
    [59.62, 23.4], [59.65, 22.7], [59.66, 22.0], [59.7, 21.4], [59.777, 20.812], [59.78, 20.8],
    [59.827, 20.526], [59.827, 20.492], [59.846, 20.45], [59.88, 20.3], [59.901, 20.189], [59.921, 20.127],
    [59.981, 19.985], [59.995, 19.959], [60.015, 19.941], [60.046, 19.943], [60.057, 19.929], [60.093, 19.925],
    [60.082, 19.926], [60.069, 19.92], [60.037, 19.884], [59.86, 19.56], [59.745, 19.47], [59.7455, 19.4084],
    [59.739, 19.3904], [59.738, 19.3824], [59.734, 19.3764], [59.7125, 19.3304], [59.7125, 19.3264], [59.7105, 19.3164],
    [59.7065, 19.3064], [59.6775, 19.2444], [59.6775, 19.2194], [59.6655, 18.9434], [59.6645, 18.9374], [59.574, 18.7034],
    [59.5675, 18.6794], [59.5675, 18.6704], [59.566, 18.6614], [59.5605, 18.6344], [59.5575, 18.6224], [59.548, 18.6034],
    [59.547, 18.5994], [59.5415, 18.5864], [59.5335, 18.5734], [59.4875, 18.4844], [59.487, 18.4754], [59.477, 18.4594],
    [59.4725, 18.4454], [59.472, 18.4444], [59.4585, 18.4264], [59.4545, 18.4254], [59.4215, 18.3504], [59.4185, 18.3464],
    [59.413, 18.3534], [59.4035, 18.3624], [59.402, 18.3624], [59.392, 18.3404], [59.386, 18.3374], [59.381, 18.3324],
    [59.378, 18.2894], [59.3445, 18.2224], [59.338, 18.2054], [59.3375, 18.1714], [59.339, 18.1644], [59.343, 18.1484],
    [59.354, 18.1154], [59.3545, 18.1124],
  ],
  /* Paldiski (port południowy) → zatoka Paldiski (na zachód od miasta, między półwyspem Pakri a Väike-Pakri) → otwarte
     morze na północny zachód → Bałtyk na południe od Wysp Alandzkich → Söderarm → Kapellskärsfjärden → Kapellskär */
  'PLD-KPS': [
    [59.3327, 24.0804], [59.3327, 24.078], [59.3327, 24.076], [59.3547, 24.034], [59.45, 24.0], [59.5, 23.6],
    [59.55, 22.9], [59.6, 22.1], [59.62, 21.3], [59.65, 20.5], [59.68, 19.95], [59.74, 19.5],
    [59.759, 19.3817], [59.746, 19.2297], [59.737, 19.2097], [59.731, 19.1797], [59.721, 19.0677],
  ],
};

/** Tory nowych przepraw dla użytych tras (np. trasy rejsów widocznych transportów); dzisiejsze trasy — pusto. */
export function extraWaterTracksFor(routes: Iterable<string | null | undefined>): { id: ExtraWaterTrack; line: readonly LatLng[] }[] {
  const ids = new Set<ExtraWaterTrack>();
  for (const code of routes) {
    /* BN9-b: Terminal A (TLLA-HEL) i kody z bazy — tor rodziny trasy */
    const track = waterTrackOf(code);
    if (track && track in WATER_TRACKS_EXTRA) ids.add(track as ExtraWaterTrack);
  }
  return [...ids].map((id) => ({ id, line: WATER_TRACKS_EXTRA[id] }));
}
