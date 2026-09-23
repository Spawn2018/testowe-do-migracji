export function KpiTile({
  label,
  value,
  delta,
  tone = 'default',
  onClick,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'default' | 'alert' | 'warn' | 'good';
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'alert' ? 'alert' : tone === 'warn' ? 'warn' : tone === 'good' ? 'good' : '';
  return (
    <button type="button" onClick={onClick} className="kpi">
      <div className="k">{label}</div>
      <div className={`v${toneClass ? ` ${toneClass}` : ''}`}>{value}</div>
      {delta ? <div className="d">{delta}</div> : null}
    </button>
  );
}
