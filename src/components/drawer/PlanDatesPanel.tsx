/**
 * I-18 (D-12) — status dat planu (WSTĘPNA | POTWIERDZONA) w Przeglądzie, dla trzech ról.
 * AUD-03: edycja dat KSH przeniesiona do okna „Edytuj” (KshDatesModal) — ten blok tylko pokazuje stan.
 */
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { fmtDateTime } from '../../lib/time';
import type { Load } from '../../types';

export function PlanDatesPanel({ load }: { load: Load }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const pd = load.planDates;
  if (!pd) return null;
  const confirmed = pd.status === 'POTWIERDZONA';
  return (
    <div data-plan-dates={pd.status} data-b-ksh>
      <h4 className="sec" style={{ marginTop: 18 }}>{t(locale, 'i18_h')}</h4>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`pill ${confirmed ? 'p-go' : ''}`} data-plan-dates-status>{t(locale, confirmed ? 'i18_confirmed' : 'i18_provisional')}</span>
        {confirmed && pd.confirmedAt
          ? <small data-plan-dates-by>{t(locale, 'i18_by_ksh').replace('{at}', fmtDateTime(pd.confirmedAt))}</small>
          : <small>{t(locale, 'i18_waiting')}</small>}
      </div>
      {role === 'SCX' && <div className="note" style={{ margin: '8px 0 0' }}>{t(locale, 'i18_carrier_note')}</div>}
    </div>
  );
}
