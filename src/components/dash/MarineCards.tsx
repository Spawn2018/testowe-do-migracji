/**
 * BN9-c3 (#573 „Ekrany po BN5”) — Kokpit: pogoda morska dla przepraw, którymi jadą aktywne transporty (rodzina trasy
 * z rejsu transportu). Karty w stylu kafelków Kokpitu (`kpi ck-tile`, 2 kolumny, także na telefonie 390 px).
 * Bez transportów na przeprawach bałtyckich lista jest pusta i nic się nie rysuje — Kokpit wygląda jak dotąd.
 * Klik — Ryzyka › Sytuacja na trasie (tam pełna lista przepraw, atrybucja i dopisek o NAVTEX).
 */
import type { Locale } from '../../types';
import type { CockpitCrossing } from '../../lib/bn9c3Marine';
import { MARINE_ATTRIBUTION_DEFAULT } from '../../lib/bn9c3Marine';
import { formatListDateTime, formatPlNumber } from '../../lib/format';
import { formatSeaRiskLabel } from '../../lib/voyageSea';
import { t, tp } from '../../i18n/messages';

function loadsText(locale: Locale, n: number): string {
  const d = n % 10;
  const h = n % 100;
  const form = n === 1 ? '1' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? '2' : '5';
  return tp(locale, `bn9c3_ck_loads_${form}`, { n });
}

export function MarineCards({ locale, crossings, onGo }: { locale: Locale; crossings: readonly CockpitCrossing[]; onGo: () => void }) {
  if (!crossings.length) return null;
  const attribution = [...new Set(crossings.map((c) => c.attribution).filter(Boolean))].join(' · ') || MARINE_ATTRIBUTION_DEFAULT;
  return (
    <div className="ck-sea" data-ck-sea>
      <h3 className="ck-sea-h">{t(locale, 'bn9c3_ck_h')}</h3>
      <div className="kpis ck-grid ck-sea-grid">
        {crossings.map((c) => {
          const risk = c.risk ? formatSeaRiskLabel(c.risk, locale) : '';
          const gust = c.gustKn == null ? '—' : formatPlNumber(c.gustKn, 0);
          const loads = loadsText(locale, c.loads);
          const tone = c.risk === 'wysokie' ? ' alert' : c.risk === 'podwyższone' ? ' warn' : '';
          return (
            <button
              key={c.corridor}
              type="button"
              className="kpi ck-tile ck-sea-card"
              data-ck="sea"
              data-ck-sea-row={c.corridor}
              data-risk={c.risk ?? 'none'}
              onClick={onGo}
            >
              <span className="ck-top">
                <span className="k">
                  <span className="ck-desk">{t(locale, `bn9c3_corr_${c.corridor}`)}</span>
                  <span className="ck-phone">{t(locale, `bn9c3_corr_s_${c.corridor}`)}</span>
                </span>
              </span>
              <span className={`v${c.noReading ? '' : tone}`}>
                {c.noReading || c.waveM == null ? '—' : tp(locale, 'bn9c3_ck_wave', { wave: formatPlNumber(c.waveM, 1) })}
                {!c.noReading ? <small className="ck-of">{t(locale, 'bn9c3_ck_of')}</small> : null}
              </span>
              <span className="d">
                <span className="ck-desk">
                  {c.noReading
                    ? tp(locale, 'bn9c3_ck_noread', { loads })
                    : tp(locale, 'bn9c3_ck_desc', { gust, risk, at: c.observedAt ? formatListDateTime(c.observedAt) : '—', loads })}
                </span>
                <span className="ck-phone">
                  {c.noReading ? t(locale, 'bn9c3_ck_noread_short') : tp(locale, 'bn9c3_ck_short', { gust, risk })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="ck-sea-attr" data-attribution="marine-cockpit">{attribution} · {t(locale, 'bn9c3_disclaimer')}</p>
    </div>
  );
}
