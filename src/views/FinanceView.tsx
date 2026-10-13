import { useMemo } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { canSeeCost, canSeeMargin, canSeeRevenue } from '../lib/permissions';
import { t, tp } from '../i18n/messages';
import { DemoMark } from '../components/ui/DemoMark';
import { PROD_BUILD } from '../lib/prodFacade';
import { SEFS_WEEKLY, SEFS_SOURCES, computeSefs } from '../lib/sefs';
import { formatAppMoney, formatSourceMoney } from '../lib/money/demoFx';
import { TIER_PILL, marginSplit, moneyViewFor, tierSummary } from '../lib/money/loadMoney';
import type { PricingTier } from '../lib/money/engine';
import { formatPercentPoints } from '../lib/format';
import { transportLabel } from '../lib/transportName';

const TIERS: PricingTier[] = ['PROGNOZA', 'REALIZACJA', 'FAKTURA'];

function pct(n: number) {
  return formatPercentPoints(n * 100);
}

export function FinanceView() {
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const money = (n: number) => formatAppMoney(n, locale, currency);

  const showCost = canSeeCost(role);
  const showRev = canSeeRevenue(role);
  const showMargin = canSeeMargin(role);

  const done = useMemo(() => loads.filter((l) => l.status === 'DELIVERED'), [loads]);
  const rev = done.reduce((s, l) => s + l.pricing.revTotal, 0);
  const cost = done.reduce((s, l) => s + l.pricing.costTotal, 0);
  const baseR = done.reduce((s, l) => s + l.pricing.revBase, 0);
  const bafR = done.reduce((s, l) => s + l.pricing.revSefs, 0);
  const baseC = done.reduce((s, l) => s + l.pricing.costBase, 0);
  const bafC = done.reduce((s, l) => s + l.pricing.costSefs, 0);
  const exC = done.reduce((s, l) => s + l.pricing.costExtras, 0);

  const byType = useMemo(() => {
    const map = new Map<string, { n: number; r: number; c: number }>();
    for (const l of loads) {
      const cur = map.get(l.itemType) ?? { n: 0, r: 0, c: 0 };
      cur.n += 1;
      cur.r += l.pricing.revTotal;
      cur.c += l.pricing.costTotal;
      map.set(l.itemType, cur);
    }
    return [...map.entries()].map(([k, v]) => ({
      k,
      ...v,
      m: v.r - v.c,
      p: v.r ? (v.r - v.c) / v.r : 0,
    }));
  }, [loads]);
  const maxAbs = Math.max(...byType.map((t) => t.r), 1);

  const title =
    role === 'SCX' ? t(locale, 'nav_fin_scx') : role === 'KSH' ? t(locale, 'nav_fin_ksh') : t(locale, 'nav_fin');
  const sub =
    role === 'SCX'
      ? tp(locale, 'a6_fin_sub_scx', { n: String(done.length) })
      : role === 'KSH'
        ? tp(locale, 'a6_fin_sub_ksh', { n: String(done.length) })
        : tp(locale, 'a6_fin_sub_hhl', { n: String(done.length) });

  const week = SEFS_WEEKLY[SEFS_WEEKLY.length - 1];
  const live = computeSefs(week.priceSek, week.pricePln);
  const appliedNum = Number(((live.appliedMult - 1) * 100).toFixed(1));
  const below = loads.filter((l) => l.pricing.belowThreshold);
  const tiers = useMemo(() => tierSummary(loads, role), [loads, role]);
  const split = useMemo(() => marginSplit(loads), [loads]);
  /* M11 — sumy z totalsByTier: EUR źródłowo, PLN per transport kursem NBP (nie kursem demo). */
  const splitMoney = (x: { marginEur: number; marginPln: number }) =>
    currency === 'PLN' ? formatSourceMoney(x.marginPln, locale, 'PLN') : formatSourceMoney(x.marginEur, locale, 'EUR');

  const bafCard = (
    <div data-deur-exempt="fuel-index" title={t(locale, 'a6_fin_deur_fuel')}>
      <dl className="kv">
        <dt>{t(locale, 'a6_fin_index')}</dt>
        <dd>
          SEFS hybrid · {SEFS_SOURCES.labelSek} / {SEFS_SOURCES.labelPln}
        </dd>
        <dt>{t(locale, 'fin_base_val')}</dt>
        <dd>
          {formatSourceMoney(SEFS_SOURCES.baseSek, locale, 'SEK')} · {formatSourceMoney(SEFS_SOURCES.basePln, locale, 'PLN')}
        </dd>
        <dt>{t(locale, 'a6_fin_quote')}</dt>
        <dd>
          {formatSourceMoney(week.priceSek, locale, 'SEK')} · {formatSourceMoney(week.pricePln, locale, 'PLN')} · {week.weekLabel}
        </dd>
        <dt>{t(locale, 'fin_fuel_share')}</dt>
        <dd>{t(locale, 'a6_fin_fuel_rule')}</dd>
        <dt>{t(locale, 'fin_formula')}</dt>
        <dd>
          min({live.multSek.toFixed(3)}, {live.multPln.toFixed(3)}) = <b>{live.appliedMult.toFixed(3)}</b> (−
          {tp(locale, 'a6_fin_vs_one', { pct: appliedNum })}
        </dd>
        <dt>{t(locale, 'fin_threshold')}</dt>
        <dd>{t(locale, 'fin_margin_flag')}</dd>
        <dt>{t(locale, 'a6_fin_cycle')}</dt>
        <dd>{t(locale, 'fin_weekly')} · {week.sourceNote}</dd>
      </dl>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 9 }}>
        {t(locale, 'fin_sources')}{' '}
        <a href={SEFS_SOURCES.orlen} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
          ORLEN
        </a>
        {' · '}
        <a href={SEFS_SOURCES.okq8} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
          OKQ8
        </a>
        <span data-content>{t(locale, 'a6_fin_quote_note')}</span>
      </div>
    </div>
  );

  return (
    <div className="panel section-card page-sections" data-page="finance" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{title}</h2>
        <span className="sub">{sub}</span>
      </header>
      <div className="panel-bd">
        <div className="two">
          <div>
            {role === 'SCX' && showCost && (
              <>
                <h4 className="sec">{t(locale, 'a6_fin_due_scx')}</h4>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'a6_fin_base_rate')}</span>
                  <span>{money(baseC)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{PROD_BUILD ? t(locale, 'fin_rev_fuel') : tp(locale, 'a6_fin_fuel_pct', { pct: appliedNum })}</span>
                  <span>{money(bafC)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'a6_fin_pilot')}</span>
                  <span>{money(exC)}</span>
                </div>
                <div className="mrow total">
                  <span>{t(locale, 'a6_fin_total')}</span>
                  <span>{money(cost)}</span>
                </div>
                <div className="locked" style={{ marginTop: 13 }}>
                  {t(locale, 'a6_fin_locked_scx')}
                </div>
              </>
            )}
            {role === 'KSH' && showRev && (
              <>
                <h4 className="sec">{t(locale, 'a6_fin_due_ksh')}</h4>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'a6_fin_freight_base')}</span>
                  <span>{money(baseR)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{PROD_BUILD ? t(locale, 'fin_rev_fuel') : tp(locale, 'a6_fin_fuel_pct', { pct: appliedNum })}</span>
                  <span>{money(bafR)}</span>
                </div>
                <div className="mrow total">
                  <span>{t(locale, 'a6_fin_total')}</span>
                  <span>{money(rev)}</span>
                </div>
                <div className="locked" style={{ marginTop: 13 }}>
                  {t(locale, 'a6_fin_locked_ksh')}
                </div>
              </>
            )}
            {role === 'HHL' && showMargin && (
              <>
                <h4 className="sec">{t(locale, 'fin_from_rev')}</h4>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'fin_rev_base')}</span>
                  <span>{money(baseR)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'fin_rev_fuel')}</span>
                  <span>{money(bafR)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{t(locale, 'a6_fin_cost_scx')}</span>
                  <span style={{ color: 'var(--red)' }}>− {money(cost)}</span>
                </div>
                <div className="mrow total">
                  <span>{t(locale, 'sched_col_margin')}</span>
                  <span style={{ color: 'var(--go)' }}>
                    {money(rev - cost)} · {pct(rev ? (rev - cost) / rev : 0)}
                  </span>
                </div>
                <div data-margin-split>
                  {(['FAKTURA', 'REALIZACJA', 'PROGNOZA'] as const).map((k) => (
                    <div key={k} className="mrow" data-margin-tier={k} data-count={split.tiers[k].count}>
                      <span className="lbl">
                        <span className={`pill ${TIER_PILL[k]}`}>{t(locale, `tier_${k}`)}</span> {t(locale, `m11_${k}`)} · {split.tiers[k].count}
                      </span>
                      <span>{splitMoney(split.tiers[k])}</span>
                    </div>
                  ))}
                  <div className="mrow total" data-margin-total data-count={split.total.count}>
                    <span>
                      {t(locale, 'm11_total')} · {split.total.count}
                      {split.skipped ? ` · ${t(locale, 'm11_skipped')}: ${split.skipped}` : ''}
                    </span>
                    <span style={{ color: 'var(--go)' }}>{splitMoney(split.total)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div>
            <h4 className="sec" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {t(locale, 'fin_fuel_addon')}
              {PROD_BUILD ? null : <DemoMark />}
            </h4>
            {PROD_BUILD ? <div className="note" data-no-source="fuel-finance">{t(locale, 'i2_fin_fuel_prod')}</div> : bafCard}
          </div>
        </div>

        <div className="hr" />
        <h4 className="sec">{t(locale, 'fin_tiers')}</h4>
        <div data-tier-summary>
          {TIERS.map((k) => (
            <div key={k} className="mrow">
              <span className="lbl"><span className={`pill ${TIER_PILL[k]}`}>{t(locale, `tier_${k}`)}</span></span>
              <span data-tier-count={k}>{tiers.counts[k]}</span>
            </div>
          ))}
          <div className="mrow">
            <span className="lbl"><span className="pill p-amber">{t(locale, 'fx_provisional')}</span></span>
            <span data-tier-provisional>{tiers.provisional}</span>
          </div>
        </div>
        {tiers.errors.length > 0 ? (
          <div className="note" data-money-errors style={{ margin: '11px 0 0', color: 'var(--red)' }}>
            {t(locale, 'fin_tiers_err')}: {tiers.errors.length} · <span className="mono">{tiers.errors.join(', ')}</span>
          </div>
        ) : (
          <div className="note" data-money-ok style={{ margin: '11px 0 0' }}>{t(locale, 'fin_tiers_ok')}</div>
        )}

        {role === 'HHL' && showMargin && (
          <>
            <div className="hr" />
            <h4 className="sec">{t(locale, 'fin_margin_by_type')}</h4>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t(locale, 'inv_type')}</th>
                  <th className="num">{t(locale, 'a6_fin_qty')}</th>
                  <th className="num">{t(locale, 'sched_col_rev')}</th>
                  <th className="num">{t(locale, 'cost')}</th>
                  <th className="num">{t(locale, 'sched_col_margin')}</th>
                  <th style={{ width: 140 }} />
                </tr>
              </thead>
              <tbody>
                {byType.map((row) => (
                  <tr key={row.k}>
                    <td>
                      <span className="code" data-content>{row.k.slice(0, 8)}</span> <span data-content>{row.k}</span>
                    </td>
                    <td className="num">{row.n}</td>
                    <td className="num">{money(row.r)}</td>
                    <td className="num">{money(row.c)}</td>
                    <td className={`num money ${row.p < 0.18 ? 'neg' : ''}`}>
                      {money(row.m)} · {pct(row.p)}
                    </td>
                    <td>
                      <svg width="130" height="12">
                        <rect width={(row.r / maxAbs) * 130} height="12" fill="var(--rule)" />
                        <rect width={(row.c / maxAbs) * 130} height="12" fill="var(--sea)" fillOpacity={0.55} />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="note" style={{ margin: '11px -13px -13px' }}>
              <span data-content>{t(locale, 'a6_fin_no_zero')}</span>
            </div>
            {below.length > 0 ? (
              <>
                <div className="hr" />
                <h4 className="sec">{t(locale, 'fin_below_margin')}</h4>
                {below.map((l) => (
                  <div key={l.id} className="mrow">
                    <span className="lbl">
                      <span className="code" data-content>{transportLabel(l, role)}</span> <span data-content>{l.itemType}</span>
                    </span>
                    <span style={{ color: 'var(--red)' }}>
                      {l.pricing.money?.v === 2 ? (
                        <><span className={`pill ${TIER_PILL[moneyViewFor('HHL', l.pricing.money).tier]}`} data-tier={l.pricing.money.tier}>{t(locale, `tier_${l.pricing.money.tier}`)}</span>{' '}</>
                      ) : null}
                      {(l.pricing.marginPct * 100).toFixed(1)}% · {money(l.pricing.margin)}
                    </span>
                  </div>
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
