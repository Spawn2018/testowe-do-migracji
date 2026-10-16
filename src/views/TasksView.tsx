import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { formatTableDay } from '../lib/time';
import { getNow } from '../lib/frozenNow';
import { clickableRow } from '../lib/clickableRow';
import { transportLabel } from '../lib/transportName';

function hoursUntilLoad(plannedLoadDate: string): number {
  const target = Date.parse(`${plannedLoadDate}T06:00:00+02:00`);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.round((target - getNow().getTime()) / 3_600_000));
}

export function TasksView() {
  const loads = useTowerStore((s) => s.loads);
  const role = useTowerStore((s) => s.role);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const locale = useTowerStore((s) => s.locale);

  const need = loads
    .filter((l) => ['RESOURCES_PENDING', 'DOC_MISSING', 'READY'].includes(l.status))
    .slice(0, 9);

  return (
    <div className="panel section-card page-sections" data-page="tasks" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_tasks')}</h2>
        <span className="sub">{t(locale, 'a6_task_sub')}</span>
      </header>
      <div className="panel-bd flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t(locale, 'sched_col_code')}</th>
                <th>{t(locale, 'a6_task_what')}</th>
                <th>{t(locale, 's_loading')}</th>
                <th>{t(locale, 'bill_col_due')}</th>
                <th>{t(locale, 'a6_task_state')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {need.map((l) => {
                const what =
                  l.status === 'RESOURCES_PENDING'
                    ? t(locale, 'a6_task_need_res')
                    : l.status === 'DOC_MISSING'
                      ? t(locale, 'a6_task_need_permit')
                      : l.awizacja.confirmed && l.awizacja.loadWindowStart
                        ? t(locale, 'a6_task_ready')
                        : t(locale, 'a6_task_need_awi');
                const hrs = hoursUntilLoad(l.plannedLoadDate);
                const pill = hrs < 24 ? 'p-red' : hrs < 48 ? 'p-amber' : 'p-plan';
                const lab = hrs < 24 ? t(locale, 'a6_task_urgent') : hrs < 48 ? t(locale, 'a6_task_soon') : t(locale, 'a6_task_on_time');
                return (
                  <tr key={l.id} data-load={l.id} style={{ cursor: 'pointer' }} {...clickableRow(() => selectLoad(l.id))}>
                    <td>
                      <span className="code" data-content>{transportLabel(l, role)}</span>
                    </td>
                    <td>{what}</td>
                    <td>{formatTableDay(l.plannedLoadDate)}</td>
                    <td className="mono">{tp(locale, 'a6_task_in_h', { h: String(hrs) })}</td>
                    <td>
                      <span className={`pill ${pill}`}>{lab}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="chipbtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectLoad(l.id);
                        }}
                      >
                        {t(locale, 'a6_task_fill')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
