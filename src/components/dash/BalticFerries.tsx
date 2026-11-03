/**
 * BN9-c6 (ekrany po BN8, #720 §3 pkt 5) — Kokpit: „Najbliższy prom” na przeprawach bałtyckich (Tallink, Viking Line,
 * Eckerö, DFDS, armatorzy tylko z bazy) obok kafelka Polferries / Stena. Ze słownika: `nearestCrossingByOperator`
 * (`CrossingMap`) — armator bałtycki trafia tu tylko z rejsem w rozkładzie, więc bez rejsów bałtyckich nic się nie rysuje
 * i Kokpit wygląda jak dotąd. Karta: armator, odejście, statek, trasa i przypłynięcie (ETA promu — opóźnione, gdy jest).
 * Wygląd kart jak pogoda na przeprawach (BN9-c3: `kpi ck-tile ck-sea-card`). Klik — Ryzyka › Sytuacja na trasie.
 */
import type { Locale } from '../../types';
import { effArrival, effDeparture } from '../../lib/sailings';
import type { BalticFerry } from './balticNearest';
import { formatListDateTime } from '../../lib/format';
import { ferryRouteLabel } from '../../lib/portName';
import { pt, ptp } from '../../i18n/p7';

export function BalticFerries({ locale, ferries, onGo }: { locale: Locale; ferries: readonly BalticFerry[]; onGo: () => void }) {
  if (!ferries.length) return null;
  return (
    <div className="ck-sea" data-ck-baltic-ferries>
      <h3 className="ck-sea-h">{pt(locale, 'p7_ck_baltic_h')}</h3>
      <div className="kpis ck-grid ck-sea-grid">
        {ferries.map(({ op, name, sailing: s }) => {
          const dep = formatListDateTime(effDeparture(s));
          const arr = formatListDateTime(effArrival(s));
          const route = ferryRouteLabel(locale, s.route);
          const late = s.delayedArrivalAt != null || s.delayedDepartureAt != null;
          return (
            <button key={op} type="button" className="kpi ck-tile ck-sea-card" data-ck="baltic-ferry" data-ck-baltic-op={op} onClick={onGo}>
              <span className="ck-top">
                <span className="k">{name}</span>
              </span>
              <span className={`v${late ? ' warn' : ''}`}>
                <span className="ck-desk">{dep}</span>
                <span className="ck-phone">{dep.split(', ')[1] ?? dep}</span>
              </span>
              <span className="d">
                <span className="ck-desk" data-ck-baltic-eta>{ptp(locale, 'p7_ck_baltic_desc', { vessel: s.vessel, route, arr })}</span>
                <span className="ck-phone">{ptp(locale, 'p7_ck_baltic_short', { route, arr: arr.split(', ')[1] ?? arr })}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
