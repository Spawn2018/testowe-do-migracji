import { useMemo } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { canSeeCost, canSeeMargin, canSeeRevenue } from '../lib/permissions';
import { t } from '../i18n/messages';
import { DemoMark } from '../components/ui/DemoMark';
import { SEFS_WEEKLY, SEFS_SOURCES, computeSefs } from '../lib/sefs';
import { formatMoney } from '../lib/money/engine';

function pct(n: number) {
  return `${(n * 100).toFixed(1).replace('.', ',')}%`;
}

export function FinanceView() {
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const locale = useTowerStore((s) => s.locale);
  const currency = useTowerStore((s) => s.displayCurrency);
  const money = (n: number) => formatMoney(n, locale, currency);

  const showCost = canSeeCost(role);
  const showRev = canSeeRevenue(role);
  const showMargin = canSeeMargin(role);

  const done = useMemo(() => loads.filter((l) => l.status === 'DELIVERED'), [loads]);
  const rev = done.reduce((s, l) => s + l.pricing.revTotal, 0);
  const cost = done.reduce((s, l) => s + l.pricing.costTotal, 0);
  const baseR = done.reduce((s, l) => s + l.pricing.revBase, 0);
  const bafR = done.reduce((s, l) => s + l.pricing.revSefs, 0);
  const exR = done.reduce((s, l) => s + (l.pricing.revTotal - l.pricing.revBase - l.pricing.revSefs), 0);
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
      ? `${done.length} zrealizowanych transportów`
      : role === 'KSH'
        ? `${done.length} zrealizowanych dostaw`
        : `${done.length} zrealizowanych · kurs NBP tabela A`;

  const week = SEFS_WEEKLY[SEFS_WEEKLY.length - 1];
  const live = computeSefs(week.priceSek, week.pricePln);
  const appliedPct = ((live.appliedMult - 1) * 100).toFixed(1).replace('.', ',');
  const below = loads.filter((l) => l.pricing.belowThreshold);

  const bafCard = (
    <div>
      <dl className="kv">
        <dt>Indeks</dt>
        <dd>
          SEFS hybrid · {SEFS_SOURCES.labelSek} / {SEFS_SOURCES.labelPln}
        </dd>
        <dt>{t(locale, 'fin_base_val')}</dt>
        <dd>
          {formatMoney(SEFS_SOURCES.baseSek, locale, 'SEK')} · {formatMoney(SEFS_SOURCES.basePln, locale, 'PLN')}
        </dd>
        <dt>Notowanie</dt>
        <dd>
          {formatMoney(week.priceSek, locale, 'SEK')} · {formatMoney(week.pricePln, locale, 'PLN')} · {week.weekLabel}
        </dd>
        <dt>{t(locale, 'fin_fuel_share')}</dt>
        <dd>min(mult_SEK, mult_PLN) na fracht drogowy</dd>
        <dt>{t(locale, 'fin_formula')}</dt>
        <dd>
          min({live.multSek.toFixed(3)}, {live.multPln.toFixed(3)}) = <b>{live.appliedMult.toFixed(3)}</b> (−
          {appliedPct}% vs 1,0)
        </dd>
        <dt>{t(locale, 'fin_threshold')}</dt>
        <dd>{t(locale, 'fin_margin_flag')}</dd>
        <dt>Cykl</dt>
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
        <span data-content>. Każde notowanie z datą — przy sporze dowód, nie pamięć.</span>
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
                <h4 className="sec">Należność narastająco</h4>
                <div className="mrow">
                  <span className="lbl">Stawka bazowa</span>
                  <span>{money(baseC)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{`Dodatek paliwowy ${appliedPct}%`}</span>
                  <span>{money(bafC)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">Pilotaż i dodatki</span>
                  <span>{money(exC)}</span>
                </div>
                <div className="mrow total">
                  <span>Razem</span>
                  <span>{money(cost)}</span>
                </div>
                <div className="locked" style={{ marginTop: 13 }}>
                  Cena płacona przez KSH i marża spedytora nie są dostępne w roli przewoźnika.
                </div>
              </>
            )}
            {role === 'KSH' && showRev && (
              <>
                <h4 className="sec">Do zapłaty narastająco</h4>
                <div className="mrow">
                  <span className="lbl">Fracht — stawka bazowa</span>
                  <span>{money(baseR)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">{`Dodatek paliwowy ${appliedPct}%`}</span>
                  <span>{money(bafR)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">Pilotaż i dodatki</span>
                  <span>{money(exR)}</span>
                </div>
                <div className="mrow total">
                  <span>Razem</span>
                  <span>{money(rev)}</span>
                </div>
                <div className="locked" style={{ marginTop: 13 }}>
                  Stawki przewoźnika i marża spedytora nie są dostępne w roli klienta.
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
                  <span className="lbl">{t(locale, 'fin_rev_extra')}</span>
                  <span>{money(exR)}</span>
                </div>
                <div className="mrow">
                  <span className="lbl">Koszt Scandinavian Express</span>
                  <span style={{ color: 'var(--red)' }}>− {money(cost)}</span>
                </div>
                <div className="mrow total">
                  <span>{t(locale, 'sched_col_margin')}</span>
                  <span style={{ color: 'var(--go)' }}>
                    {money(rev - cost)} · {pct(rev ? (rev - cost) / rev : 0)}
                  </span>
                </div>
              </>
            )}
          </div>
          <div>
            <h4 className="sec" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {t(locale, 'fin_fuel_addon')}
              <DemoMark />
            </h4>
            {bafCard}
          </div>
        </div>

        {role === 'HHL' && showMargin && (
          <>
            <div className="hr" />
            <h4 className="sec">{t(locale, 'fin_margin_by_type')}</h4>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Typ</th>
                  <th className="num">Szt.</th>
                  <th className="num">{t(locale, 'sched_col_rev')}</th>
                  <th className="num">Koszt</th>
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
              <span data-content>Transport, który nie trafia w żaden przedział cennika, nie dostaje stawki zero — trafia na listę wyjątków.</span>
            </div>
            {below.length > 0 ? (
              <>
                <div className="hr" />
                <h4 className="sec">{t(locale, 'fin_below_margin')}</h4>
                {below.map((l) => (
                  <div key={l.id} className="mrow">
                    <span className="lbl">
                      <span className="code" data-content>{l.code}</span> <span data-content>{l.itemType}</span>
                    </span>
                    <span style={{ color: 'var(--red)' }}>
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
