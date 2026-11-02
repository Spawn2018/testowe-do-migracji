/**
 * BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: sekcje „Drogi LT”, „Drogi LV”, „Drogi EE”, „Drogi FI” obok „Drogi PL”
 * i „Drogi SE”, ten sam wygląd wierszy co Drogi SE (wpływ, tytuł, kiedy; opis pod spodem na komputerze).
 * Ograniczenia masy/wymiarów wyróżnione etykietą i dopiskiem „Sprawdź zezwolenie / trasę.” (bez danych ładunku spoza ryzyka).
 * Kraj na trasie aktywnego transportu bez zdarzeń — „Brak utrudnień na korytarzu.”; bez transportów bałtyckich — nic.
 * Atrybucja pod sekcją z `detail.zrodlo` ryzyk (bez wpisanych na sztywno źródeł).
 */
import type { ReactNode } from 'react';
import type { Locale } from '../../types';
import type { BalticRoadRow, BalticRoadSection } from '../../lib/bn9c4Roads';
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
        <span className="rk-road-t">
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

/** Sekcje krajów bałtyckich (kolejność na trasie: LT, LV, EE, FI). */
export function balticRoadSectionNodes(
  { sections, locale, phone, demo }: { sections: readonly BalticRoadSection[]; locale: Locale; phone: boolean; demo: boolean },
): ReactNode[] {
  return sections.map((s) => {
    const id = `rk-${s.country.toLowerCase()}-h`;
    return (
      <section
        key={`road-${s.country}`}
        className="rk-sec-box"
        data-panel={`road-${s.country.toLowerCase()}`}
        data-baltic={s.country}
        data-demo={demo ? 'baltic-roads' : undefined}
        aria-labelledby={id}
      >
        <div className="rk-sec-hd">
          <h3 id={id} title={rt(locale, `bn9c4_country_${s.country}`)}>{rt(locale, `bn9c4_road_${s.country}`)}</h3>
          {s.rows.length ? <span className="rk-sec-sub">{rtn(locale, 'bn9c4_n', s.rows.length)}</span> : null}
          {demo ? <DemoMark /> : null}
        </div>
        {s.rows.length ? (
          <ul className="rk-roads">{s.rows.map((r) => <Row key={r.id} r={r} locale={locale} phone={phone} />)}</ul>
        ) : <p className="rk-muted" data-empty={`road-${s.country.toLowerCase()}`}>{rt(locale, 'bn9c4_none')}</p>}
        {s.sources.length ? (
          <p className="rk-muted rk-road-attr" data-attribution={`road-${s.country.toLowerCase()}`}>
            {rtp(locale, 'bn9c4_attr', { src: s.sources.join(' · ') })}
          </p>
        ) : null}
      </section>
    );
  });
}
