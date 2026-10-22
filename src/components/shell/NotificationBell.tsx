import { useEffect, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import type { Severity } from '../../types';
import { getNowMs } from '../../lib/frozenNow';
import { formatListDateTime } from '../../lib/format';
import { bellGeneralCount, bellGroups, type BellGroup, type BellLocale, type BellSource } from '../../lib/bellList';
import { transportLabel } from '../../lib/transportName';
import { pt } from '../../i18n/p6e';

/** Pasek po lewej pozycji: „Do zrobienia” według wagi, „Moje transporty” zawsze niebieski (img/e5-desk). */
function gut(section: 'todo' | 'mine', s: Severity): string {
  if (section === 'mine') return 'mine';
  if (s === 'CRITICAL' || s === 'HIGH') return 'hot';
  if (s === 'MEDIUM') return 'warn';
  return 'mine';
}


/**
 * E5 (img/e5-desk, img/e5-phone; decyzja 07.10 13:21): dzwonek w dwóch grupach — „Do zrobienia” i „Moje transporty”.
 * Sytuacja ogólna (promy, drogi, pogoda bez transportu) nie trafia do dzwonka — zdanie pod listą prowadzi do Ryzyk.
 * Nazwa transportu według firmy (E41) w drugiej linii pozycji „Do zrobienia” i na początku pozycji „Moje transporty”.
 */
export function NotificationBell() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const notifications = useTowerStore((s) => s.notifications);
  const markAllNotificationsRead = useTowerStore((s) => s.markAllNotificationsRead);
  const openNotification = useTowerStore((s) => s.openNotification);
  const markNotificationRead = useTowerStore((s) => s.markNotificationRead);
  const setView = useTowerStore((s) => s.setView);
  const loads = useTowerStore((s) => s.loads);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lang: BellLocale = 'pl'; /* 8A (17.10): dzwonek tylko po polsku */
  const all = bellGroups(notifications, role, (id) => {
    const load = loads.find((l) => l.id === id);
    return load ? transportLabel(load, role) : undefined;
  }, lang);
  /* audyt 17.10 (N13): liczba przy dzwonku przed ucięciem listy do 40 pozycji */
  const visible = all.slice(0, 40);
  const todo = visible.filter((g) => g.section === 'todo');
  const mine = visible.filter((g) => g.section === 'mine');
  const unread = all.length;
  const nowMs = getNowMs();
  const general = bellGeneralCount(notifications, role, nowMs);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    /* telefon (iOS Safari): dotknięcie obok nie zawsze daje „mousedown” — pointerdown działa dla myszy i dotyku */
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  /* P11 (e5, e13): Esc zamyka dzwonek i wraca na przycisk — jak Pomoc i menu konta */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>('.bell-trigger')?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const item = (g: BellGroup<BellSource>) => {
    const isTodo = g.section === 'todo';
    const when = formatListDateTime(g.latest.at);
    const chat = g.chat;
    const title = chat ? g.title : isTodo ? g.what : g.title;
    const meta = chat
      ? [chat.more, when].filter(Boolean).join(' · ')
      : isTodo
        ? [g.name, g.body].filter(Boolean).join(' · ')
        : [when, g.body].filter(Boolean).join(' · ');
    return (
      <div key={g.key} className={`bell-item${chat ? ' is-chat' : ''}`} data-bell-count={g.count} data-bell-section={g.section} data-bell-chat={chat ? (chat.only ? 'HHL_SCX' : 'ALL') : undefined}>
        <span className={`bell-gut ${gut(g.section, g.severity as Severity)}`} aria-hidden />
        <button
          type="button"
          className="bell-go"
          onClick={() => {
            openNotification(g.latest.id);
            for (const id of g.ids.slice(1)) markNotificationRead(id);
            setOpen(false);
          }}
        >
          <span className="bell-line">
            <span className="bell-title">{isTodo ? <i className="bell-dot" aria-hidden /> : null}{title}</span>
            <span className="bell-to">{t(locale, `bell_to_${g.place}`)} ›</span>
          </span>
          {chat?.text ? (
            <span className="bell-chat" data-content>
              {chat.only ? <span className="bell-only">{pt('p6e_bell_only')}</span> : null}
              {chat.text}
            </span>
          ) : null}
          {meta ? <span className="bell-meta">{meta}</span> : null}
        </button>
      </div>
    );
  };

  const section = (key: 'todo' | 'mine', list: BellGroup<BellSource>[]) => (list.length ? (
    <section className="bell-sec" data-bell-sec={key} aria-label={t(locale, `bell_sec_${key}`)}>
      <h3 className="bell-sec-hd"><span>{t(locale, `bell_sec_${key}`)}</span><span className="tabular">{list.length}</span></h3>
      {list.map(item)}
    </section>
  ) : null);

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        type="button"
        className="iconbtn bell-trigger" aria-haspopup="dialog"
        aria-label={t(locale, 'notifications')}
        aria-expanded={open}
        onClick={() => {
          /* Właściciel 21.10.2026 20:14 (pkt 5): otwarcie dzwonka dociąga nowe wpisy z serwera (telefon bez przeładowania) */
          if (!open && import.meta.env.VITE_AUTH_MODE === 'supabase') {
            void import('../../data/supabaseBridge').then((b) => b.refreshNotifications()).catch(() => undefined);
          }
          setOpen((v) => !v);
        }}
        style={{ width: 32, padding: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="bell-badge cond tabular">{unread > 99 ? '99+' : unread}</span>
        ) : null}
      </button>
      {open && (
        <div
          className="bell-pop"
          role="dialog"
          aria-label={t(locale, 'notifications')}
        >
          <div className="panel-hd bell-hd">
            <h2>{t(locale, 'notifications')}</h2>
            <div className="spacer" />
            {unread > 0 ? (
              <button type="button" className="btn bell-all" onClick={() => markAllNotificationsRead(role)}>
                {t(locale, 'bell_mark_all')}
              </button>
            ) : null}
            {/* P11 (e13): „Dotknięcie obok albo „✕” zamyka panel” */}
            <button type="button" className="iconbtn bell-x" aria-label={t(locale, 'close')} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="bell-scroll">
            {visible.length === 0 ? (
              <div className="panel-bd bell-empty">{t(locale, 'no_notifications')}</div>
            ) : (
              <>
                {section('todo', todo)}
                {section('mine', mine)}
              </>
            )}
            <p className="bell-general">
              {t(locale, 'bell_general')}{' '}
              <button type="button" className="btn bell-link" onClick={() => { setView('risk'); setOpen(false); }}>
                {t(locale, 'bell_general_link')}
              </button>
              {'. '}
              {general > 0 ? `${t(locale, 'bell_general_n').replace('{n}', String(general))} ` : ''}
              {t(locale, 'bell_general_tail')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
