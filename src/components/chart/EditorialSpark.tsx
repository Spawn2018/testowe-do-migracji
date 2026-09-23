/** Editorial OTIF / throughput spark — hairline grid, no gradient candy (v4). */
export function EditorialSpark({
  series,
  accent = 'var(--wt-ok)',
  height = 120,
}: {
  series: number[];
  accent?: string;
  height?: number;
}) {
  const w = 320;
  const h = height;
  const padX = 8;
  const padY = 10;
  const vals = series.length ? series : [0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const pts = vals.map((v, i) => {
    const x = padX + (i / Math.max(1, vals.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (v - min) / span) * (h - padY * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area =
    line +
    ` L${pts[pts.length - 1][0].toFixed(1)},${(h - padY).toFixed(1)}` +
    ` L${pts[0][0].toFixed(1)},${(h - padY).toFixed(1)} Z`;

  const gridYs = [0.25, 0.5, 0.75].map((t) => padY + t * (h - padY * 2));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend"
      style={{ display: 'block' }}
    >
      {gridYs.map((y) => (
        <line
          key={y}
          x1={padX}
          x2={w - padX}
          y1={y}
          y2={y}
          stroke="var(--wt-border-soft)"
          strokeWidth={1}
        />
      ))}
      <path d={area} fill={accent} fillOpacity={0.12} stroke="none" />
      <path d={line} fill="none" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" />
      {pts.length ? (
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r={2.5}
          fill={accent}
        />
      ) : null}
    </svg>
  );
}
