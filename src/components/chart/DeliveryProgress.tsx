import { useMemo } from 'react';
import type { Load, Locale } from '../../types';
import { t } from '../../i18n/messages';
import { getNow } from '../../lib/frozenNow';

/** I-0: w buildzie produkcyjnym „dziś” = bieżąca data (bez zamrożonej daty danych demo 23.09). */
const PROD_BUILD = import.meta.env.VITE_AUTH_MODE === 'supabase';
function prodToday(): Date {
  const n = getNow();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
function ddmm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

type WeekPoint = { w: number; plan: number; act: number; future: boolean };

/** Poniedziałek tygodnia ISO (UTC) i numer tygodnia ISO. */
function isoMonday(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() || 7) - 1));
  return x;
}
function isoWeekNo(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

/**
 * I-2b — oś postępu w produkcji z danych z bazy: tygodnie od pierwszej do ostatniej planowanej dostawy
 * (maks. 26), plan = narastająco tony wg `plan_delivery_date`, wykonanie = narastająco tony wg faktycznej
 * daty rozładunku (`actual_delivery_at`), „dziś” = bieżąca data. Bez transportów → brak osi.
 */
export function progressWeeksFromDb(loads: readonly Load[], today: Date): WeekPoint[] {
  const dates = loads.map((l) => Date.parse(l.plannedDeliverDate)).filter((n) => !Number.isNaN(n));
  if (!dates.length) return [];
  const first = isoMonday(new Date(Math.min(...dates)));
  const last = isoMonday(new Date(Math.max(...dates)));
  const n = Math.min(26, Math.round((last.getTime() - first.getTime()) / (7 * 86400000)) + 1);
  const out: WeekPoint[] = [];
  for (let w = 0; w < n; w++) {
    const from = new Date(first.getTime() + w * 7 * 86400000);
    const to = new Date(from.getTime() + 7 * 86400000);
    const plan = loads.filter((l) => Date.parse(l.plannedDeliverDate) < to.getTime()).reduce((a, l) => a + (l.dims.weightT || 0), 0);
    const act = loads.filter((l) => l.unloadedAt && Date.parse(l.unloadedAt) < to.getTime()).reduce((a, l) => a + (l.dims.weightT || 0), 0);
    out.push({ w: isoWeekNo(from), plan, act, future: from > today });
  }
  return out;
}

/** Zakres tygodni osi (nagłówek panelu): „tygodnie 40–47”; pusty harmonogram → null. */
export function progressWeeksLabel(weeks: readonly WeekPoint[]): string | null {
  return weeks.length ? `${weeks[0].w}–${weeks[weeks.length - 1].w}` : null;
}

/** Claude scurveHTML twin — cumulative tonnes Plan/Actual weeks 37–45. */
export function DeliveryProgress({ loads, locale }: { loads: Load[]; locale: Locale }) {
  const weeks = useMemo(() => {
    if (PROD_BUILD) return progressWeeksFromDb(loads, prodToday());
    const start = new Date('2026-09-07T00:00:00Z');
    const today = new Date('2026-09-23T00:00:00Z');
    const out: WeekPoint[] = [];
    for (let w = 0; w < 9; w++) {
      const from = new Date(start);
      from.setUTCDate(from.getUTCDate() + w * 7);
      const to = new Date(start);
      to.setUTCDate(to.getUTCDate() + w * 7 + 7);
      const plan = loads
        .filter((l) => new Date(l.plannedDeliverDate) < to)
        .reduce((s, l) => s + (l.dims.weightT || 0), 0);
      const act = loads
        .filter(
          (l) =>
            (l.status === 'DELIVERED' || l.status === 'UNLOADING') &&
            new Date(l.plannedDeliverDate) < to,
        )
        .reduce((s, l) => s + (l.dims.weightT || 0), 0);
      out.push({ w: w + 37, plan, act, future: from > today });
    }
    return out;
  }, [loads]);

  if (!weeks.length) return <div className="note" data-progress="empty" style={{ border: 0 }}>{t(locale, 'i2_progress_empty')}</div>;

  const maxV = Math.max(1, ...weeks.map((x) => x.plan));
  const W = 560;
  const H = 150;
  const pad = 26;
  const X = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, weeks.length - 1);
  const Y = (v: number) => H - 18 - (v / maxV) * (H - 34);
  const pl = weeks
    .map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(d.plan).toFixed(1)}`)
    .join(' ');
  const past = weeks.filter((d) => !d.future);
  const ac = past
    .map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(d.act).toFixed(1)}`)
    .join(' ');
  const futureIdx = weeks.findIndex((d) => d.future);
  // I-2b: „dziś” po ostatnim tygodniu osi → linia na końcu (wcześniej lądowała na początku)
  const nowX = futureIdx < 0 ? X(weeks.length - 1) : X(Math.max(0, futureIdx - 0.15));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={t(locale, 'progress')}
      >
        <line x1={pad} y1={H - 18} x2={W - pad} y2={H - 18} stroke="var(--rule)" />
        <line
          x1={nowX}
          y1={10}
          x2={nowX}
          y2={H - 18}
          stroke="var(--amber)"
          strokeDasharray="3 3"
        />
        <path d={pl} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="5 4" />
        {ac ? <path d={ac} fill="none" stroke="var(--go)" strokeWidth={2.4} /> : null}
        {weeks.map((d, i) => (
          <text
            key={d.w}
            x={X(i)}
            y={H - 5}
            fontSize={10.5}
            textAnchor="middle"
            fill="var(--ink-3)"
            fontFamily="Barlow Condensed, Barlow, Arial, sans-serif"
          >
            t{d.w}
          </text>
        ))}
        <text
          x={pad}
          y={13}
          fontSize={11}
          fill="var(--ink-3)"
          fontFamily="Barlow Condensed, Barlow, Arial, sans-serif"
        >
          {t(locale, 'chart_tons_cum')} · max {maxV.toFixed(0)} t
        </text>
      </svg>
      <div className="legendline">
        <span>
          <svg width={18} height={6} aria-hidden>
            <line
              x1={0}
              y1={3}
              x2={18}
              y2={3}
              stroke="var(--ink-3)"
              strokeWidth={1.6}
              strokeDasharray="5 4"
            />
          </svg>{' '}
          {t(locale, 'planline')}
        </span>
        <span>
          <svg width={18} height={6} aria-hidden>
            <line x1={0} y1={3} x2={18} y2={3} stroke="var(--go)" strokeWidth={2.4} />
          </svg>{' '}
          {t(locale, 'actualline')}
        </span>
        <span style={{ color: 'var(--amber)' }}>▏{t(locale, 'today_mark')} {PROD_BUILD ? ddmm(prodToday()) : '23.09'}</span>
      </div>
    </div>
  );
}
