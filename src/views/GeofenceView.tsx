import { useState } from 'react';
import { geofenceTypeLabel } from '../lib/enumLabels';
import { useTowerStore } from '../store/useTowerStore';
import { canEditGeofence } from '../lib/permissions';
import type { Geofence, GeofenceType } from '../types';
import { t } from '../i18n/messages';

const TYPE_PILL: Record<string, string> = {
  SITE: 'p-go',
  LOADING: 'p-amber',
  PRE_ARRIVAL: 'p-sea',
  PORT_OUT: 'p-sea',
  PORT_IN: 'p-sea',
  CHECKPOINT: 'p-plan',
  REST: 'p-plan',
  PRE_PORT: 'p-sea',
};

export function GeofenceView() {
  const geofences = useTowerStore((s) => s.geofences);
  const saveGeofence = useTowerStore((s) => s.saveGeofence);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const canEdit = canEditGeofence(role);
  const [edit, setEdit] = useState<Geofence | null>(null);

  return (
    <div className="panel section-card page-sections" data-page="geofence" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_geo')}</h2>
        <span className="sub">{geofences.length} stref · rysowane na mapie</span>
        <div className="spacer" />
        {canEdit ? (
          <button
            type="button"
            className="chipbtn"
            onClick={() =>
              setEdit({
                id: `gf-new-${Date.now()}`,
                name: 'Nowa strefa',
                type: 'CHECKPOINT',
                shape: 'circle',
                lat: 60,
                lng: 18,
                radiusM: 1000,
                hysteresisM: 200,
                dwellMin: 5,
                notifyHhl: true,
                notifyKsh: false,
                notifyScx: true,
                active: true,
                trigger: 'ENTER',
              })
            }
          >
            Nowa strefa
          </button>
        ) : null}
      </header>
      <div className="panel-bd flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Typ</th>
                <th className="num">Promień</th>
                <th className="num">Postój</th>
                <th className="num">Histereza</th>
                <th className="num">Próbki</th>
                <th>Powiadamia</th>
              </tr>
            </thead>
            <tbody>
              {geofences.map((g) => {
                const who =
                  g.type === 'PRE_ARRIVAL'
                    ? 'KSH, SCX, H&H'
                    : g.type === 'LOADING'
                      ? 'H&H'
                      : 'KSH, H&H';
                const dwell =
                  g.type === 'PORT_OUT' || g.type === 'PORT_IN' || g.type === 'SITE' ? '15 min' : '—';
                const hyst =
                  g.type === 'PRE_ARRIVAL' || g.type === 'SITE' ? '1000 m' : `${g.hysteresisM} m`;
                return (
                  <tr
                    key={g.id}
                    style={{ cursor: canEdit ? 'pointer' : undefined }}
                    onClick={() => canEdit && setEdit(g)}
                  >
                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                    <td>
                      <span className={`pill ${TYPE_PILL[g.type] ?? 'p-plan'}`}>{geofenceTypeLabel(g.type)}</span>
                    </td>
                    <td className="num">{(g.radiusM / 1000).toFixed(g.radiusM >= 1000 ? 0 : 1)} km</td>
                    <td className="num">{dwell}</td>
                    <td className="num">{hyst}</td>
                    <td className="num">2</td>
                    <td>{who}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="note">
          Histereza chroni przed parą wjazd/wyjazd, gdy auto stoi na granicy strefy. Próbki to liczba kolejnych pozycji
          wewnątrz, zanim wjazd zostanie uznany — filtr na błędny odczyt GPS. Postój to czas, po którym strefa liczy się
          jako osiągnięta, żeby przejazd obok bramy nie był przyjazdem.
        </div>
      </div>

      {edit && canEdit && (
        <div className="panel-bd" style={{ borderTop: '1px solid var(--rule)' }}>
          <h4 className="sec">Edycja · {edit.name}</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              saveGeofence({
                ...edit,
                name: String(fd.get('name') || edit.name),
                type: String(fd.get('type') || edit.type) as GeofenceType,
                radiusM: Number(fd.get('radiusM')) || edit.radiusM,
                hysteresisM: Number(fd.get('hysteresisM')) || edit.hysteresisM,
                dwellMin: Number(fd.get('dwellMin')) || edit.dwellMin,
              });
              setEdit(null);
            }}
          >
            <dl className="kv">
              <dt>Nazwa</dt>
              <dd>
                <input name="name" className="input" defaultValue={edit.name} style={{ width: '100%' }} />
              </dd>
              <dt>Typ</dt>
              <dd>
                <select name="type" className="input" defaultValue={edit.type}>
                  {(
                    [
                      'LOADING',
                      'PORT_OUT',
                      'PRE_PORT',
                      'PORT_IN',
                      'CHECKPOINT',
                      'PRE_ARRIVAL',
                      'SITE',
                      'REST',
                    ] as GeofenceType[]
                  ).map((tp) => (
                    <option key={tp} value={tp}>{geofenceTypeLabel(tp)}</option>
                  ))}
                </select>
              </dd>
              <dt>Promień (m)</dt>
              <dd>
                <input name="radiusM" type="number" className="input" defaultValue={edit.radiusM} />
              </dd>
              <dt>Histereza (m)</dt>
              <dd>
                <input name="hysteresisM" type="number" className="input" defaultValue={edit.hysteresisM} />
              </dd>
              <dt>Postój (min)</dt>
              <dd>
                <input name="dwellMin" type="number" className="input" defaultValue={edit.dwellMin} />
              </dd>
            </dl>
            <div style={{ marginTop: 10, display: 'flex', gap: 7 }}>
              <button type="submit" className="btn">
                Zapisz
              </button>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
