/** H-8 A — profil wysokości / nachylenia (standard truck; notices po D-83). */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { t } from '../../i18n/messages';
import type { Locale } from '../../types';
import type { H8Leg } from '../../lib/h8RouteProfile';

const LIVE = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED;

export function RouteProfilePanel({ loadId, locale }: { loadId: string; locale: Locale }) {
  const [legs, setLegs] = useState<H8Leg[] | null>(null);
  const [mode, setMode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!LIVE) return;
    let cancel = false;
    setBusy(true);
    void import('../../lib/h8RouteProfile').then(({ fetchRouteProfile }) => fetchRouteProfile(loadId)).then(
      (r) => {
        if (cancel) return;
        if (!r.ok) {
          setErr(r.reason);
          setLegs([]);
        } else {
          setMode(r.dimsMode);
          setLegs(r.legs);
          setErr(null);
        }
        setBusy(false);
      },
      () => {
        if (!cancel) {
          setErr('map_error');
          setBusy(false);
        }
      },
    );
    return () => { cancel = true; };
  }, [loadId]);

  if (!LIVE) return <span data-h8="demo">—</span>;
  if (busy && !legs) return <span data-h8="loading">{t(locale, 'h8_loading')}</span>;
  if (err === 'budget') return <span data-h8="budget">{t(locale, 'h8_budget')}</span>;
  if (err && !legs?.length) return <span data-h8="err">{t(locale, 'h8_error')}</span>;
  if (!legs?.length) return <span data-h8="empty">{t(locale, 'h8_empty')}</span>;

  return (
    <div data-h8="lista">
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>
        {mode === 'with_dims' ? t(locale, 'h8_mode_dims') : t(locale, 'h8_mode_std')}
      </div>
      {legs.map((L) => (
        <div key={L.leg} style={{ marginBottom: 4 }}>
          <strong>{L.leg}</strong>
          {L.ok === false ? ` — ${t(locale, 'h8_leg_fail')}` : null}
          {L.ok ? (
            <>
              {' · '}
              {t(locale, 'h8_elev')}: {L.minM ?? '—'}…{L.maxM ?? '—'} m
              {L.maxDeltaM != null ? ` · Δ ${L.maxDeltaM} m` : ''}
              {L.notices === 'after_d83' ? ` · ${t(locale, 'h8_notices_later')}` : ''}
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
