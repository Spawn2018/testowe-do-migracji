import { useCallback, useEffect, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { ROLE_META } from '../../lib/permissions';
import type { Locale, RoleId } from '../../types';
import { NotificationBell } from './NotificationBell';
import { ClaudeIcon } from './ClaudeIcon';
import { KeyboardHelp } from './KeyboardHelp';
import { ferryWidgetLabel, nextLiveSailing } from '../../lib/ferry';
import { getNow } from '../../lib/frozenNow';

const ROLES: RoleId[] = ['HHL', 'KSH', 'SCX'];
const LANGS: Locale[] = ['pl', 'en', 'sv'];

/** ISO week number (Europe/Warsaw local date). */
function isoWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function Topbar() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const setRole = useTowerStore((s) => s.setRole);
  const setLocale = useTowerStore((s) => s.setLocale);
  const toggleTheme = useTowerStore((s) => s.toggleTheme);
  const [help, setHelp] = useState(false);
  const [ops, setOps] = useState({
    wk: 0,
    cd: '0 h 00 min',
    ferryLine: '—',
    wave: 'fala —',
    clock: '00:00',
    date: '',
  });

  const closeHelp = useCallback(() => setHelp(false), []);

  useEffect(() => {
    const onHelp = () => setHelp((h) => !h);
    window.addEventListener('wt-toggle-help', onHelp);
    return () => window.removeEventListener('wt-toggle-help', onHelp);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = getNow();
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      const sailing = nextLiveSailing(now);
      const fw = ferryWidgetLabel(sailing);
      const y = Number(get('year'));
      const m = Number(get('month'));
      const day = Number(get('day'));
      const localNoon = new Date(y, m - 1, day, 12, 0, 0);
      setOps({
        wk: isoWeek(localNoon),
        cd: fw.cd,
        ferryLine: fw.line,
        wave: fw.wave,
        clock: `${get('hour')}:${get('minute')}`,
        date: `${get('day')}.${get('month')}.${get('year')}`,
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    // also refresh countdown display every second for the clock + smooth CD
    const id2 = window.setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      clearInterval(id2);
    };
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <b>{t(locale, 'brand')}</b>
        <span id="brandSub">{`Stegra Boden · ${ROLE_META[role].name}`}</span>
      </div>
      <div className="spacer" />
      <div className="roleswitch">
        <span id="roleLbl">{t(locale, 'role')}</span>
        <div className="seg" role="group" aria-label={t(locale, 'role')} id="roleSeg">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              data-role={r}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              title={ROLE_META[r].name}
            >
              {ROLE_META[r].name}
            </button>
          ))}
        </div>
      </div>
      <div className="seg" role="group" aria-label="Język" id="langSeg">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            data-lang={l}
            aria-pressed={locale === l}
            onClick={() => setLocale(l)}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="iconbtn"
        id="themeBtn"
        onClick={toggleTheme}
        title="Jasny / ciemny"
        aria-label={t(locale, 'theme')}
      >
        <ClaudeIcon name="theme" />
      </button>
      <button
        type="button"
        className="iconbtn"
        id="helpBtn"
        title="Skróty klawiszowe"
        aria-label="Skróty klawiszowe"
        style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 15 }}
        onClick={() => setHelp((h) => !h)}
        aria-pressed={help}
      >
        ?
      </button>
      <NotificationBell />
      <div className="ops" id="ops" title="Następny odjazd promu (rozklad Polferries GDN↔NYN)">
        <span className="wk">t{ops.wk}</span>
        <span className="sep" />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--sea)' }}>
          <ClaudeIcon name="ferry" />
        </span>
        <span>
          <span className="cd">{ops.cd}</span>
          <span className="lb" style={{ display: 'block' }}>
            {ops.ferryLine} · {ops.wave}
          </span>
        </span>
        <span className="sep" />
        <span>
          <span className="cd">{ops.clock}</span>
          <span className="lb" style={{ display: 'block' }}>
            {ops.date}
          </span>
        </span>
      </div>
      <KeyboardHelp open={help} onClose={closeHelp} />
    </header>
  );
}
