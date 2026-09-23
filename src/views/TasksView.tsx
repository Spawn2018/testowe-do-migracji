import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';

export function TasksView() {
  const loads = useTowerStore((s) => s.loads);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const locale = useTowerStore((s) => s.locale);

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
                <th>Wysyłka</th>
                <th>Czego brakuje</th>
                <th>Załadunek</th>
                <th>Termin</th>
                <th>Stan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {need.map((l, i) => {
                const what =
                  l.status === 'RESOURCES_PENDING'
                    ? 'Kierowca, telefon, nr rejestracyjne'
                    : l.status === 'DOC_MISSING'
                      ? 'Zezwolenie PL i dispens SE'
                      : l.awizacja.confirmed && l.awizacja.loadWindowStart
                        ? 'Gotowe do startu — awizacja potwierdzona'
                        : 'Awizacja godziny podjęcia';
                const hrs = 18 + i * 9;
                const pill = hrs < 24 ? 'p-red' : hrs < 48 ? 'p-amber' : 'p-plan';
                const lab = hrs < 24 ? 'pilne' : hrs < 48 ? 'wkrótce' : 'w terminie';
                return (
                  <tr key={l.id} data-load={l.id} style={{ cursor: 'pointer' }} onClick={() => selectLoad(l.id)}>
                    <td>
                      <span className="code">{l.code}</span>
                    </td>
                    <td>{what}</td>
                    <td>{l.plannedLoadDate}</td>
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
