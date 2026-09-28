/**
 * III-5 (SCOPE 5.10) — unikanie kolizji znaczników i etykiet na mapie. Punkty (w pikselach ekranu) bliższe niż `minPx`
 * łączone są w grupy (łańcuchowo); każda grupa > 1 rozkładana jest na okręgu wokół środka grupy tak, by sąsiednie
 * znaczniki dzieliło co najmniej `minPx`. Kolejność na okręgu według id — wynik deterministyczny (zrzuty, testy).
 */
export type PxPoint = { id: string; x: number; y: number };

export function declutter(points: PxPoint[], minPx = 22): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const sorted = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (Math.hypot(sorted[i].x - sorted[j].x, sorted[i].y - sorted[j].y) < minPx) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, PxPoint[]>();
  sorted.forEach((p, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), p]);
  });
  for (const g of groups.values()) {
    if (g.length === 1) { out.set(g[0].id, { x: g[0].x, y: g[0].y }); continue; }
    const cx = g.reduce((s, p) => s + p.x, 0) / g.length;
    const cy = g.reduce((s, p) => s + p.y, 0) / g.length;
    // do 8 punktów: okrąg (cięciwa 2R·sin(π/n) = minPx); więcej: spirala Vogla (równomierne pole, odstęp ≥ minPx)
    g.forEach((p, k) => {
      if (g.length <= 8) {
        const radius = Math.max(minPx / (2 * Math.sin(Math.PI / g.length)), minPx / 2);
        const a = -Math.PI / 2 + (2 * Math.PI * k) / g.length;
        out.set(p.id, { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      } else {
        const radius = minPx * 1.25 * Math.sqrt(k + 0.5);
        const a = k * 2.399963229728653; // kąt złoty
        out.set(p.id, { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }
    });
  }
  return out;
}

/** Pozycja odtwarzania: interpolacja liniowa między punktami przebiegu dla chwili `t` (ms). */
export type TrackPoint = { ts: string; lat: number; lng: number; speed_kmh: number | null };
export function trackPositionAt(track: TrackPoint[], t: number): { lat: number; lng: number; idx: number } | null {
  if (track.length === 0) return null;
  const ms = track.map((p) => Date.parse(p.ts));
  if (t <= ms[0]) return { lat: track[0].lat, lng: track[0].lng, idx: 0 };
  const last = track.length - 1;
  if (t >= ms[last]) return { lat: track[last].lat, lng: track[last].lng, idx: last };
  let i = 0;
  while (i < last && ms[i + 1] < t) i++;
  const f = ms[i + 1] === ms[i] ? 0 : (t - ms[i]) / (ms[i + 1] - ms[i]);
  return { lat: track[i].lat + (track[i + 1].lat - track[i].lat) * f, lng: track[i].lng + (track[i + 1].lng - track[i].lng) * f, idx: i };
}
