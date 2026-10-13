import type { ReactNode } from 'react';

export function KpiTile({
  label,
  value,
  delta,
  tone = 'default',
  onClick,
  tags,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'default' | 'alert' | 'warn' | 'good';
  onClick?: () => void;
  tags?: ReactNode;
}) {
  const toneClass =
    tone === 'alert' ? 'alert' : tone === 'warn' ? 'warn' : tone === 'good' ? 'good' : '';
  // E8 pkt 6 (wyglad/P2-2 W1): długa wartość (kwota, data z godziną) ma na telefonie cały rząd,
  // żeby liczba się nie łamała. Na komputerze klasa nic nie zmienia.
  const wide = String(value).length > 9;
  return (
    <button type="button" onClick={onClick} className={wide ? 'kpi kpi-wide' : 'kpi'}>
      <div className="k">{label}</div>
      <div className={`v${toneClass ? ` ${toneClass}` : ''}`}>{value}</div>
      {delta ? <div className="d">{delta}</div> : null}
      {tags ? <div className="d" data-kpi-tags>{tags}</div> : null}
    </button>
  );
}
