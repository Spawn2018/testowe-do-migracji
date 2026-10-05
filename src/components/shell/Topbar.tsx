import { useCallback, useEffect, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { INTL_LOCALE, t, tp } from '../../i18n/messages';
import { ROLE_META } from '../../lib/permissions';
import type { RoleId } from '../../types';
import { NotificationBell } from './NotificationBell';
import { ClaudeIcon } from './ClaudeIcon';
import { KeyboardHelp } from './KeyboardHelp';
import { ferryWidgetLabel, nextLiveSailing } from '../../lib/ferry';
import { getNow } from '../../lib/frozenNow';
import { canSwitchView, PROD_BUILD } from '../../lib/prodFacade';
import { dbFerryWidget, nearestCrossingSailings } from '../../lib/sailings';

const ROLES: RoleId[] = ['HHL', 'KSH', 'SCX'];
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
  const toggleTheme = useTowerStore((s) => s.toggleTheme);
  const sailings = useTowerStore((s) => s.sailings);
  const [help, setHelp] = useState(false);
  const [ops, setOps] = useState({
    wk: 0,
    /** P7 — Stena + Polferries obok siebie w pasku */
    ferryRows: [] as { cd: string; line: string }[],
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
      /* P7 — produkcja: najbliższe Stena + Polferries; demo — jeden widget jak wcześniej */
      let ferryRows: { cd: string; line: string }[] = [];
      if (PROD_BUILD) {
        const near = nearestCrossingSailings(sailings, now.getTime(), 1);
        const st = dbFerryWidget(near.stena[0] ?? null, now.getTime());
        const pf = dbFerryWidget(near.polferries[0] ?? null, now.getTime());
        if (st) ferryRows.push({ cd: st.cd, line: `Stena · ${st.line}` });
        else ferryRows.push({ cd: '—', line: `Stena · ${t(locale, 'i2_no_sailing')}` });
        if (pf) ferryRows.push({ cd: pf.cd, line: `Polferries · ${pf.line}` });
        else ferryRows.push({ cd: '—', line: `Polferries · ${t(locale, 'i2_no_sailing')}` });
      } else {
        const fw = ferryWidgetLabel(nextLiveSailing(now), locale);
        ferryRows = [{ cd: fw.cd, line: `${fw.line}${fw.wave ? ` · ${fw.wave}` : ''}` }];
      }
      const y = Number(get('year'));
      const m = Number(get('month'));
      const day = Number(get('day'));
      const localNoon = new Date(y, m - 1, day, 12, 0, 0);
      setOps({
        wk: isoWeek(localNoon),
        ferryRows,
        /* A6-T3 — data w języku interfejsu (PL bez zmian: DD.MM.RRRR); P10 — bez zegara */
        date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now),
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
  }, [locale, sailings]);

  return (
    <header className="topbar">
      <button
        type="button"
        className="iconbtn phone-menu-btn"
        aria-label={t(locale, 'a6_nav_menu_open')}
        title={t(locale, 'a6_nav_menu_open')}
        onClick={() => {
          const s = useTowerStore.getState();
          s.setNavCollapsed(!s.navCollapsed, { persist: false });
        }}
      >
        ☰
      </button>
      <div className="brand">
        <img src="/brand/watchtower-symbol.png" alt="" width={28} height={28} />
        <b>{t(locale, 'brand')}</b>
        <span id="brandSub" className="brand-sub">{`Stegra Boden · ${ROLE_META[role].name}`}</span>
      </div>
      <div className="spacer" />
      {/* I-2a: przełącznik widoku tylko dla HHL (w produkcji — konto organizacji HHL) */}
      {canSwitchView() ? <div className="roleswitch">
        <span id="roleLbl" className="role-lbl">{t(locale, 'role')}</span>
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
      </div> : null}
      {/* P8 — brak wyboru języka w UI */}
      <button
        type="button"
        className="iconbtn"
        id="themeBtn"
        onClick={toggleTheme}
        title={t(locale, 'a6_top_theme')}
        aria-label={t(locale, 'theme')}
      >
        <ClaudeIcon name="theme" />
      </button>
      <button
        type="button"
        className="iconbtn"
        id="helpBtn"
        title={t(locale, 'a6_top_shortcuts')}
        aria-label={t(locale, 'a6_top_shortcuts')}
        style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: 15 }}
        onClick={() => setHelp((h) => !h)}
        aria-pressed={help}
      >
        ?
      </button>
      <NotificationBell />
      <div className="ops" id="ops" title={t(locale, 'a6_top_ferry_title')} data-p7-ferries>
        <span className="wk">{tp(locale, 'a6_top_wk', { n: String(ops.wk) })}</span>
        <span className="sep" />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--sea)' }}>
          <ClaudeIcon name="ferry" />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {ops.ferryRows.map((row, i) => (
            <span key={i} data-ferry-row={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1.15 }}>
              <span className="cd" style={{ fontSize: i === 0 ? undefined : 12 }}>{row.cd}</span>
              <span className="lb">{row.line}</span>
            </span>
          ))}
        </span>
        <span className="sep" />
        {/* P10 — data bez zegara */}
        <span>
          <span className="cd" data-ops-date>{ops.date}</span>
        </span>
      </div>
      <KeyboardHelp open={help} onClose={closeHelp} />
    </header>
  );
}
