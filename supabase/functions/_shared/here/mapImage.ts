/**
 * H-7 — HERE Map Image API v3 (statyczna mapa z punktem / trasą).
 * Liczone w puli kafelków (tiles). Generowane przy wysyłce — bez długiego storage.
 */
export type MapPoint = { lat: number; lon: number; label?: string };

export function buildMapImageUrl(opts: {
  apiKey: string;
  points: MapPoint[];
  polyline?: string;
  width?: number;
  height?: number;
  style?: string;
}): string {
  const w = opts.width ?? 800;
  const h = opts.height ?? 400;
  const style = opts.style ?? 'logistics.day';
  const base = `https://image.maps.hereapi.com/mia/v3/base/mc/overlay:padding=48/${w}x${h}/png`;
  const q: string[] = [
    `apiKey=${encodeURIComponent(opts.apiKey)}`,
    `style=${encodeURIComponent(style)}`,
    'scaleBar=km',
  ];
  if (opts.points.length) {
    const pts = opts.points
      .map((p, i) => {
        const lbl = p.label ?? (i === 0 ? 'A' : 'B');
        return `${p.lat},${p.lon};label=${lbl}`;
      })
      .join('|');
    q.push(`overlay=${encodeURIComponent(`point:${pts}|size=large`)}`);
  }
  if (opts.polyline) {
    q.push(`overlay=${encodeURIComponent(`line:${opts.polyline};width=4`)}`);
  }
  return `${base}?${q.join('&')}`;
}
