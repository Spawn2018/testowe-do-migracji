import { useEffect, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import type { Severity } from '../../types';
import { getNowMs } from '../../lib/frozenNow';
import { bellAge, bellGroups, type BellLocale } from '../../lib/bellList';
import { transportLabel } from '../../lib/transportName';

function gut(s: Severity) {
  if (s === 'CRITICAL' || s === 'HIGH') return 'var(--red)';
  if (s === 'MEDIUM') return 'var(--amber)';
  return 'var(--plan)';
}

export function NotificationBell() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const notifications = useTowerStore((s) => s.notifications);
  const markAllNotificationsRead = useTowerStore((s) => s.markAllNotificationsRead);
  const openNotification = useTowerStore((s) => s.openNotification);
  const markNotificationRead = useTowerStore((s) => s.markNotificationRead);
  const loads = useTowerStore((s) => s.loads);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // AUD-02: grupy (transport + rodzaj), tytuł „SG-xx · co się stało”, czas „15 min temu”
  const lang: BellLocale = locale === 'en' || locale === 'sv' ? locale : 'pl';
  const visible = bellGroups(notifications, role, (id) => {
    const load = loads.find((l) => l.id === id);
    return load ? transportLabel(load, role) : undefined;
  }, lang).slice(0, 40);
  const unread = visible.length;
  const nowMs = getNowMs();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        type="button"
        className="iconbtn bell-trigger" aria-haspopup="dialog"
        aria-label={t(locale, 'notifications')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: 32, padding: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? (
          <span
            className="bell-badge cond tabular"
            style={{
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 2,
              background: 'var(--red)',
              color: 'var(--on-red)',
              fontSize: 12,
              fontWeight: 700,
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open && (
        <div
          className="bell-pop"
          role="dialog"
          aria-label={t(locale, 'notifications')}
        >
          <div className="panel-hd">
            <h2 style={{ margin: 0, fontFamily: '"Barlow Condensed"', fontSize: 17, fontWeight: 600, letterSpacing: '0.02em' }}>
              {t(locale, 'notifications')}
            </h2>
            <span className="sub">{unread}</span>
            <div className="spacer" />
            {unread > 0 ? (
              <button type="button" className="btn" onClick={() => markAllNotificationsRead(role)}>
                {t(locale, 'mark_all_read')}
              </button>
            ) : null}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {visible.length === 0 ? (
              <div className="panel-bd" style={{ color: 'var(--ink-3)' }}>{t(locale, 'no_notifications')}</div>
            ) : (
              visible.map((g) => (
                <div
                  key={g.key}
                  data-bell-count={g.count}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '9px 13px',
                    borderBottom: '1px solid var(--rule-2)',
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ width: 3, alignSelf: 'stretch', flex: '0 0 3px', background: gut(g.severity as Severity) }} />
                  <button
                    type="button"
                    style={{ flex: 1, textAlign: 'left', minWidth: 0, background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ink)', font: 'inherit' }}
                    onClick={() => {
                      openNotification(g.latest.id);
                      for (const id of g.ids.slice(1)) markNotificationRead(id);
                      setOpen(false);
                    }}
                  >
                    <div style={{ fontWeight: 500, lineHeight: 1.3 }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.body}</div>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className="age">{bellAge(g.latest.at, nowMs, lang)}</span>
                    {g.count > 1 ? <span className="age tabular" aria-label={`${g.count}`}>×{g.count}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
