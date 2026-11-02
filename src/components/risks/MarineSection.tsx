/**
 * BN9-c3 (#573 „Ekrany po BN5”) — Ryzyka › Sytuacja na trasie › „Pogoda na przeprawach”: wszystkie przeprawy z danymi
 * `marine_conditions` (BN5: Polska – Szwecja i trzy bałtyckie), nie tylko Polska – Szwecja. Wiersz: maks. fala, maks.
 * porywy, poziom ryzyka (te same kolory co wiersze promów), czas odczytu i źródła; „Brak odczytu”, gdy wiersz startowy
 * albo brak czasu odczytu. Najpierw przeprawy z ryzykiem wyższym, potem reszta w stałej kolejności.
 * Pod listą: atrybucja (CC BY 4.0), dopisek o NAVTEX i link tekstowy do mapy lodowej FMI (bez osadzania, BN5 §3).
 */
import type { Locale } from '../../types';
import type { MarineConditionRow } from '../../lib/marineWeatherDb';
import { CORRIDOR_NAME_KEY, FMI_ICE_CHART_URL, latestReadingAt, marineAttribution, marineCrossings, type MarineCrossingView } from '../../lib/bn9c3Marine';
import { formatListDateTime, formatPlNumber } from '../../lib/format';
import { t, tp } from '../../i18n/messages';
import { DemoMark } from '../ui/DemoMark';

const riskKey = (r: NonNullable<MarineCrossingView['risk']>) => `bn9c3_risk_${r === 'podwyższone' ? 'podwyzszone' : r}`;
const toneOf = (r: MarineCrossingView['risk']) => (r === 'wysokie' ? 'is-red' : r === 'podwyższone' ? 'is-amber' : 'is-go');
const num = (v: number | null, d: number) => (v == null ? '—' : formatPlNumber(v, d));
/* wartość null → samo „—”, bez jednostki */
const unit = (locale: Locale, key: 'bn9c3_m' | 'bn9c3_kn', v: number | null, d: number) => (v == null ? '—' : tp(locale, key, { n: formatPlNumber(v, d) }));

export function MarineSection({ locale, marine, demo }: { locale: Locale; marine: readonly MarineConditionRow[]; demo: boolean }) {
  const rows = marineCrossings(marine);
  const at = latestReadingAt(rows);
  const attribution = marineAttribution(marine);
  const thr = rows.find((r) => !r.noReading) ?? rows[0];
  return (
    <section className="rk-sec-box" data-panel="marine" data-demo={demo ? 'marine' : undefined} aria-labelledby="rk-marine-h">
      <div className="rk-sec-hd">
        <h3 id="rk-marine-h">{t(locale, 'bn9c3_sea_h')}</h3>
        <span className="rk-sec-sub">{tp(locale, 'bn9c3_sea_sub', { tw: num(thr.waveThrM, 1), tg: num(thr.gustThrKn, 0) })}</span>
        {demo ? <DemoMark /> : null}
      </div>
      <ul className="rk-ferries rk-marine">
        {rows.map((v) => (
          <li key={v.corridor} className="rk-ferry rk-sea-row" data-marine-row={v.corridor} data-risk={v.risk ?? 'none'}>
            <span className="rk-ferry-tx">
              <b data-marine-name>{t(locale, CORRIDOR_NAME_KEY[v.corridor])}</b>
              {/* data-content: „węzły”/„kn” — test waluty czyta treść (jak wiersze promów) */}
              <span className="rk-ferry-s" data-content>
                {v.noReading || !v.risk
                  ? <span className="rk-alert is-plain" data-noread>{t(locale, 'bn9c3_noread')}</span>
                  : (
                    <>
                      <span className={`rk-alert ${toneOf(v.risk)}`}>{t(locale, riskKey(v.risk))}</span>
                      {' · '}{tp(locale, 'bn9c3_vals', { wave: unit(locale, 'bn9c3_m', v.waveM, 1), gust: unit(locale, 'bn9c3_kn', v.gustKn, 0) })}
                    </>
                  )}
              </span>
              {!v.noReading ? (
                <span className="rk-road-n rk-sea-meta" data-marine-meta>
                  {tp(locale, 'bn9c3_at', { at: v.observedAt ? formatListDateTime(v.observedAt) : '—' })}
                  {v.sources ? ` · ${tp(locale, 'bn9c3_src', { src: v.sources })}` : ''}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {/* błąd odczytu (pusta lista) — tylko „Brak odczytu” w wierszach, bez podpisu danych, których nie ma */}
      {attribution ? (
        <p className="rk-muted" data-attribution="marine">
          {attribution}{at ? ` · ${tp(locale, 'bn9c3_at', { at: formatListDateTime(at) })}` : ''}
        </p>
      ) : null}
      <p className="rk-muted" data-sea-disclaimer>{t(locale, 'bn9c3_disclaimer')}</p>
      <p className="rk-muted rk-ice">
        <a href={FMI_ICE_CHART_URL} target="_blank" rel="noopener noreferrer" data-ice-chart>{t(locale, 'bn9c3_ice')}</a>
        {' '}<span>({t(locale, 'bn9c3_ice_note')})</span>
      </p>
    </section>
  );
}
