/**
 * BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: sekcje „Drogi LT”, „Drogi LV”, „Drogi EE”, „Drogi FI” obok „Drogi PL”
 * i „Drogi SE”, ten sam wygląd wierszy co Drogi SE (wpływ, tytuł, kiedy; opis pod spodem na komputerze).
 * Ograniczenia masy/wymiarów wyróżnione etykietą i dopiskiem „Sprawdź zezwolenie / trasę.” (bez danych ładunku spoza ryzyka).
 * Kraj na trasie aktywnego transportu bez zdarzeń — „Brak utrudnień na korytarzu.”; bez transportów bałtyckich — nic.
 * Atrybucja pod sekcją z `detail.zrodlo` ryzyk (bez wpisanych na sztywno źródeł).
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { attributionView, type BalticRoadRow, type BalticRoadSection } from '../../lib/bn9c4Roads';
import { formatListDateTime, formatPlNumber } from '../../lib/format';
import { rt, rtn, rtp } from '../../i18n/p6';
import { DemoMark } from '../ui/DemoMark';

const fmtNum = (v: number) => formatPlNumber(v, Number.isInteger(v) ? 0 : 1);

/* etykieta limitu z wartością („Limit masy 12 t”); bez wartości — sama nazwa limitu */
function limitLabel(locale: Locale, r: BalticRoadRow): string {
  if (!r.limit) return '';
  if (r.limitValue == null) return rt(locale, `bn9c4_limit_${r.limit}`);
  const key = r.limit === 'WEIGHT' ? 'bn9c4_weight' : r.limit === 'HEIGHT' ? 'bn9c4_height' : 'bn9c4_width';
  return rtp(locale, key, { limit: fmtNum(r.limitValue) });
}

function rowWhen(locale: Locale, r: BalticRoadRow): string | null {
  const f = r.from ? formatListDateTime(r.from) : null;
  const to = r.to ? formatListDateTime(r.to) : null;
  if (f && to) return rtp(locale, 'bn9c4_when_range', { from: f, to });
  if (f) return rtp(locale, 'bn9c4_when_from', { from: f });
  if (to) return rtp(locale, 'bn9c4_when_to', { to });
  return null;
}

function Row({ r, locale, phone }: { r: BalticRoadRow; locale: Locale; phone: boolean }) {
  const when = rowWhen(locale, r);
  const note = r.note;
  return (
    <li className={r.limit ? 'rk-road rk-road-limit' : 'rk-road'} data-baltic-road={r.id} data-limit={r.limit ?? undefined}>
      <span className="rk-box">{r.country}</span>
      <span className="rk-road-tx">
        {/* długi tytuł ze źródła — jedna linia z wielokropkiem, pełny tekst w podpowiedzi (React sam koduje znaki) */}
        <span className="rk-road-t" title={[limitLabel(locale, r), r.event ?? r.title].filter(Boolean).join(' · ')}>
          {r.limit ? <span className="rk-limit-tag" data-limit-tag>{limitLabel(locale, r)}</span> : null}
          {r.event ?? r.title}
        </span>
        <span className="rk-road-s">
          <span className={`rk-alert ${r.impact === 'VERY_HIGH' ? 'is-red' : r.impact === 'HIGH' ? 'is-amber' : 'is-plain'}`}>
            {rt(locale, `p6_imp_${r.impact}`)}
          </span>
          {when ? ` · ${when}` : ''}
        </span>
        {r.limit ? (
          <span className="rk-road-n rk-limit-check" data-limit-check>
            {r.loadT != null ? rtp(locale, 'bn9c4_check_load', { load: fmtNum(r.loadT) }) : rt(locale, 'bn9c4_check')}
          </span>
        ) : null}
        {note && !phone ? <span className="rk-road-n" data-road-note="baltic">{note}</span> : null}
      </span>
    </li>
  );
}

const FIRST_ROWS = 5;
const isHigh = (r: BalticRoadRow) => r.impact === 'VERY_HIGH' || r.impact === 'HIGH';

/**
 * Sekcja kraju (przegląd koordynatora 02.11, produkcja: 146 × ROAD_FI po pierwszym przebiegu road-fi): zwinięta domyślnie,
 * w nagłówku licznik „Finlandia · 146 utrudnień · 0 wysokich”; po rozwinięciu najpierw bardzo duży / duży / średni wpływ,
 * do 5 pozycji i „Pokaż wszystkie”; niski wpływ zawsze pod osobnym, zwiniętym „… o niskim wpływie”.
 */
function CountrySection({ s, locale, phone, demo }: { s: BalticRoadSection; locale: Locale; phone: boolean; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const lc = s.country.toLowerCase();
  const id = `rk-${lc}-h`;
  const main = s.rows.filter((r) => r.impact !== 'LOW');
  const low = s.rows.filter((r) => r.impact === 'LOW');
  const high = s.rows.filter(isHigh).length;
  const shown = all ? main : main.slice(0, FIRST_ROWS);
  return (
    <section
      className="rk-sec-box"
      data-panel={`road-${lc}`}
      data-baltic={s.country}
      data-open={open ? '1' : '0'}
      data-demo={demo ? 'baltic-roads' : undefined}
      aria-labelledby={id}
    >
      <div className="rk-sec-hd">
        <h3 id={id}>{rt(locale, `bn9c4_road_${s.country}`)}</h3>
        <span className="rk-sec-sub" data-baltic-sum>
          {s.rows.length
            ? `${rt(locale, `bn9c4_country_${s.country}`)} · ${rtn(locale, 'bn9c4_n', s.rows.length)} · ${rtn(locale, 'bn9c4_high', high)}`
            : rt(locale, `bn9c4_country_${s.country}`)}
        </span>
        {demo ? <DemoMark /> : null}
      </div>
      {s.rows.length === 0 ? <p className="rk-muted" data-empty={`road-${lc}`}>{rt(locale, 'bn9c4_none')}</p> : (
        <button
          type="button"
          className="linkbtn rk-more"
          aria-expanded={open}
          aria-controls={`rk-${lc}-list`}
          data-baltic-toggle
          onClick={() => setOpen((v) => !v)}
        >
          {open ? rt(locale, 'bn9c4_hide') : rt(locale, 'bn9c4_show')}
        </button>
      )}
      {open && s.rows.length ? (
        <div id={`rk-${lc}-list`} className="rk-baltic-list">
          {shown.length ? <ul className="rk-roads">{shown.map((r) => <Row key={r.id} r={r} locale={locale} phone={phone} />)}</ul> : null}
          {main.length > FIRST_ROWS ? (
            <button type="button" className="linkbtn rk-more" aria-expanded={all} data-baltic-all onClick={() => setAll((v) => !v)}>
              {all ? rt(locale, 'p6_road_less') : rtp(locale, 'p6_road_all', { n: main.length })}
            </button>
          ) : null}
          {low.length ? (
            <details className="rk-orig rk-baltic-low" data-baltic-low>
              <summary>{rtn(locale, 'bn9c4_low', low.length)}</summary>
              <ul className="rk-roads">{low.map((r) => <Row key={r.id} r={r} locale={locale} phone={phone} />)}</ul>
            </details>
          ) : null}
        </div>
      ) : null}
      {s.sources.length ? (
        <p className="rk-muted rk-road-attr" data-attribution={`road-${lc}`}>
          {s.sources.map((src) => attributionView(src, locale))
            .map((v) => (/^(?:Źródło|Source): /.test(v) ? v : rtp(locale, 'bn9c4_attr', { src: v }))).join(' · ')}
        </p>
      ) : null}
    </section>
  );
}

/** Sekcje krajów bałtyckich (kolejność na trasie: LT, LV, EE, FI). */
export function balticRoadSectionNodes(
  { sections, locale, phone, demo }: { sections: readonly BalticRoadSection[]; locale: Locale; phone: boolean; demo: boolean },
): ReactNode[] {
  return sections.map((s) => <CountrySection key={`road-${s.country}`} s={s} locale={locale} phone={phone} demo={demo} />);
}
