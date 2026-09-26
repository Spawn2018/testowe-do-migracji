import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { formatTableDay, refYearInOps } from '../lib/time';
import { getNow } from '../lib/frozenNow';

function hoursUntilLoad(plannedLoadDate: string): number {
  const target = Date.parse(`${plannedLoadDate}T06:00:00+02:00`);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.round((target - getNow().getTime()) / 3_600_000));
}

export function TasksView() {
  const loads = useTowerStore((s) => s.loads);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const locale = useTowerStore((s) => s.locale);
  const refYear = refYearInOps(getNow());

  const need = loads
    .filter((l) => ['RESOURCES_PENDING', 'DOC_MISSING', 'READY'].includes(l.status))
    .slice(0, 9);

  return (
    <div className="panel section-card page-sections" data-page="tasks" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_tasks')}</h2>
        <span className="sub">uzupełnij przed terminem — po nim wychodzi eskalacja</span>
      </header>
      <div className="panel-bd flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t(locale, 'sched_col_code')}</th>
                <th>Czego brakuje</th>
                <th>{t(locale, 's_loading')}</th>
                <th>{t(locale, 'bill_col_due')}</th>
                <th>Stan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {need.map((l) => {
                const what =
                  l.status === 'RESOURCES_PENDING'
                    ? 'Kierowca, telefon, nr rejestracyjne'
                    : l.status === 'DOC_MISSING'
                      ? 'Zezwolenie PL i dispens SE'
                      : l.awizacja.confirmed && l.awizacja.loadWindowStart
                        ? 'Gotowe do startu — awizacja potwierdzona'
                        : 'Awizacja godziny podjęcia';
                const hrs = hoursUntilLoad(l.plannedLoadDate);
                const pill = hrs < 24 ? 'p-red' : hrs < 48 ? 'p-amber' : 'p-plan';
                const lab = hrs < 24 ? 'pilne' : hrs < 48 ? 'wkrótce' : 'w terminie';
                return (
                  <tr key={l.id} data-load={l.id} style={{ cursor: 'pointer' }} onClick={() => selectLoad(l.id)}>
                    <td>
                      <span className="code" data-content>{l.code}</span>
                    </td>
                    <td>{what}</td>
                    <td>{formatTableDay(l.plannedLoadDate, refYear)}</td>
                    <td className="mono">za {hrs} h</td>
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
                        Uzupełnij
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
