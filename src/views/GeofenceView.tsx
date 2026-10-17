import { useState } from 'react';
import { geofenceDisplayName, geofenceTypeLabel } from '../lib/enumLabels';
import { useTowerStore } from '../store/useTowerStore';
import { canEditGeofence } from '../lib/permissions';
import type { Geofence, GeofenceCountry, GeofenceType } from '../types';
import { t, tp } from '../i18n/messages';
import { clickableRow } from '../lib/clickableRow';
import { newGeofenceDraft, notifyWho, placeForCountry } from '../lib/geofenceDraft';
import { GeofenceEditorMap } from '../components/map/GeofenceEditorMap';
import { formatPlNumber } from '../lib/format';

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

const KINDS: GeofenceType[] = [
  'LOADING',
  'PORT_OUT',
  'PRE_PORT',
  'PORT_IN',
  'CHECKPOINT',
  'PRE_ARRIVAL',
  'SITE',
  'REST',
];

const COUNTRIES: GeofenceCountry[] = ['PL', 'SE', 'LT', 'DE'];

function countryLabel(locale: Parameters<typeof t>[0], country: GeofenceCountry | undefined): string {
  if (country === 'PL') return t(locale, 'geo_country_pl');
  if (country === 'SE') return t(locale, 'geo_country_se');
  if (country === 'LT') return t(locale, 'geo_country_lt');
  if (country === 'DE') return t(locale, 'geo_country_de');
  return '—';
}

export function GeofenceView() {
  const geofences = useTowerStore((s) => s.geofences);
  const saveGeofence = useTowerStore((s) => s.saveGeofence);
  const deleteGeofence = useTowerStore((s) => s.deleteGeofence);
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const canEdit = canEditGeofence(role);
  const [edit, setEdit] = useState<Geofence | null>(null);
  const [pinMoved, setPinMoved] = useState(false);

  function openNew() {
    setPinMoved(false);
    setEdit(newGeofenceDraft(t(locale, 'a6_geo_new')));
  }

  function openExisting(g: Geofence) {
    setPinMoved(true);
    setEdit({ ...g, country: g.country ?? 'PL' });
  }

  const saved = edit ? geofences.some((g) => g.id === edit.id) : false;

  return (
    <div className="panel section-card page-sections" data-page="geofence" style={{ margin: 12 }}>
      <header className="panel-hd">
        <h2>{t(locale, 'nav_geo')}</h2>
        <span className="sub">{tp(locale, 'a6_geo_sub', { n: String(geofences.length) })}</span>
        <div className="spacer" />
        {canEdit ? (
          <button type="button" className="chipbtn" onClick={openNew}>
            {t(locale, 'a6_geo_new')}
          </button>
        ) : null}
      </header>
      <div className="panel-bd flush">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t(locale, 'a6_geo_name')}</th>
                <th>{t(locale, 'sched_col_type')}</th>
                <th>{t(locale, 'geo_country')}</th>
                <th className="num">{t(locale, 'geo_radius')}</th>
                <th className="num">{t(locale, 'geo_dwell')}</th>
                <th className="num">{t(locale, 'a6_geo_hyst')}</th>
                <th className="num">{t(locale, 'geo_samples')}</th>
                <th>{t(locale, 'a6_geo_notifies')}</th>
              </tr>
            </thead>
            <tbody>
              {geofences.map((g) => {
                const dwell = g.dwellMin > 0 ? `${g.dwellMin} min` : '—';
                const hyst = `${g.hysteresisM} m`;
                return (
                  <tr
                    key={g.id}
                    style={{ cursor: canEdit ? 'pointer' : undefined }}
                    {...(canEdit ? clickableRow(() => openExisting(g)) : {})}
                  >
                    <td style={{ fontWeight: 600 }} data-content>{geofenceDisplayName(g.name, locale)}</td>
                    <td>
                      <span className={`pill ${TYPE_PILL[g.type] ?? 'p-plan'}`}>{geofenceTypeLabel(g.type, locale)}</span>
                    </td>
                    <td>{countryLabel(locale, g.country)}</td>
                    <td className="num">{formatPlNumber(g.radiusM / 1000, g.radiusM >= 1000 ? 0 : 1)} km</td>
                    <td className="num">{dwell}</td>
                    <td className="num">{hyst}</td>
                    <td className="num">{g.samplesRequired ?? 1}</td>
                    <td>{notifyWho(g)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="note">
          {t(locale, 'geo_note')}
        </div>
      </div>

      {edit && canEdit && (
        <div className="panel-bd" style={{ borderTop: '1px solid var(--rule)' }}>
          <h4 className="sec">{t(locale, 'geo_edit')} · {edit.name}</h4>
          <GeofenceEditorMap
            lat={edit.lat}
            lng={edit.lng}
            radiusM={edit.radiusM}
            hysteresisM={edit.hysteresisM}
            onMove={(lat, lng) => {
              setPinMoved(true);
              setEdit((cur) => (cur ? { ...cur, lat, lng } : cur));
            }}
          />
          <div className="gf-legend">
            <span><i className="gf-swatch gf-swatch-circle" /> {t(locale, 'geo_circle')}</span>
            <span><i className="gf-swatch gf-swatch-buffer" /> {t(locale, 'geo_buffer')}</span>
            <span>{t(locale, 'geo_move')}</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveGeofence(edit);
              setEdit(null);
            }}
          >
            <dl className="kv">
              <dt>{t(locale, 'a6_geo_name')}</dt>
              <dd>
                <input
                  name="name"
                  className="input"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </dd>
              <dt>{t(locale, 'a6_geo_type')}</dt>
              <dd>
                <select
                  name="type"
                  className="input"
                  value={edit.type}
                  onChange={(e) => setEdit({ ...edit, type: e.target.value as GeofenceType })}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>{geofenceTypeLabel(kind, locale)}</option>
                  ))}
                </select>
              </dd>
              <dt>{t(locale, 'geo_country')}</dt>
              <dd>
                <select
                  name="country"
                  className="input"
                  value={edit.country ?? 'PL'}
                  onChange={(e) => {
                    const country = e.target.value as GeofenceCountry;
                    if (!pinMoved && (country === 'PL' || country === 'SE')) {
                      const place = placeForCountry(country);
                      setEdit({ ...edit, country, lat: place.lat, lng: place.lng });
                      return;
                    }
                    setEdit({ ...edit, country });
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{countryLabel(locale, c)}</option>
                  ))}
                </select>
              </dd>
              <dt>{t(locale, 'geo_radius')} (m)</dt>
              <dd>
                <input
                  name="radiusM"
                  type="number"
                  className="input"
                  min={10}
                  max={200000}
                  value={edit.radiusM}
                  onChange={(e) => setEdit({ ...edit, radiusM: Number(e.target.value) || edit.radiusM })}
                />
              </dd>
              <dt>{t(locale, 'a6_geo_hyst_m')}</dt>
              <dd>
                <input
                  name="hysteresisM"
                  type="number"
                  className="input"
                  min={0}
                  value={edit.hysteresisM}
                  onChange={(e) => setEdit({ ...edit, hysteresisM: Number(e.target.value) || 0 })}
                />
              </dd>
              <dt>{t(locale, 'geo_dwell')} (min)</dt>
              <dd>
                <input
                  name="dwellMin"
                  type="number"
                  className="input"
                  min={0}
                  value={edit.dwellMin}
                  onChange={(e) => setEdit({ ...edit, dwellMin: Number(e.target.value) || 0 })}
                />
              </dd>
              <dt>{t(locale, 'geo_samples')}</dt>
              <dd>
                <input
                  name="samplesRequired"
                  type="number"
                  className="input"
                  min={1}
                  value={edit.samplesRequired ?? 1}
                  onChange={(e) => setEdit({ ...edit, samplesRequired: Number(e.target.value) || 1 })}
                />
              </dd>
              <dt>{t(locale, 'geo_who')}</dt>
              <dd className="gf-who">
                <label><input type="checkbox" checked={edit.notifyHhl} onChange={(e) => setEdit({ ...edit, notifyHhl: e.target.checked })} /> HHL</label>
                <label><input type="checkbox" checked={edit.notifyKsh} onChange={(e) => setEdit({ ...edit, notifyKsh: e.target.checked })} /> KSH</label>
                <label><input type="checkbox" checked={edit.notifyScx} onChange={(e) => setEdit({ ...edit, notifyScx: e.target.checked })} /> SCX</label>
              </dd>
            </dl>
            <p className="note">{t(locale, 'geo_sms_note')}</p>
            <div style={{ marginTop: 10, display: 'flex', gap: 7 }}>
              <button type="submit" className="btn">
                {t(locale, 'geo_save')}
              </button>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>
                {t(locale, 'geo_cancel')}
              </button>
              {saved ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    if (!window.confirm(tp(locale, 'geo_delete_ask', { name: edit.name }))) return;
                    deleteGeofence(edit.id);
                    setEdit(null);
                  }}
                >
                  {t(locale, 'geo_delete')}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
