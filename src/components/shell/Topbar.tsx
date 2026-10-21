import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { clearHelpOnce, peekHelpOnce } from '../../lib/firstEntryFlag';
import { useTowerStore } from '../../store/useTowerStore';
import { t, tp } from '../../i18n/messages';
import { fmtDate, fmtTime } from '../../lib/time';
import { ROLE_META } from '../../lib/permissions';
import type { Locale, RoleId } from '../../types';
import { NotificationBell } from './NotificationBell';
import { ClaudeIcon } from './ClaudeIcon';
import { hp } from '../../i18n/help';
import { AccountMenu } from './AccountMenu';
import { vesselById } from '../../lib/ferry';
import { nextGdnSailing } from '../../lib/voyage';
import { portName } from '../../lib/portName';
import { getNow } from '../../lib/frozenNow';
import { canSwitchView, PROD_BUILD } from '../../lib/prodFacade';
import { switchViewRole } from '../../auth/previewSwitch';
import { effDeparture, nearestCrossingSailings } from '../../lib/sailings';
import { formatListDateTime } from '../../lib/format';
import { lazyRetry } from '../../lib/lazyRetry';

/* wyglad/P10b-b: Pomoc ładowana dopiero po otwarciu (treści 5 wersji poza pierwszym wczytaniem) */
const HelpPanel = lazy(lazyRetry(() => import('./HelpPanel').then((m) => ({ default: m.HelpPanel }))));

const ROLES: RoleId[] = ['HHL', 'KSH', 'SCX'];
/** ISO week number (Europe/Warsaw local date). */
function isoWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Jeden rejs w pasku (E37 pkt 1: „6 h 13 min Stena Estelle · 08:00 · Gdynia → Karlskrona”). */
/** `head` + `to` = `line`; poniżej 1440 px pasek pokazuje tylko `head` (statek · godzina · port wyjścia — E20 pkt 2). */
type FerryRow = { mins: number; cd: string; line: string; short: string; head: string; to: string };

function countdown(mins: number): string {
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

/** Godzina rejsu: dziś „08:00”, inny dzień „09.10.2026, 08:00” (E21, rok zawsze — właściciel 16.10.2026). */
function depLabel(depIso: string, nowIso: string): string {
  const dep = formatListDateTime(depIso);
  const today = formatListDateTime(nowIso).split(', ')[0];
  const [day, time] = dep.split(', ');
  return day === today && time ? time : dep;
}

function buildFerryRows(locale: Locale, now: Date, sailings: Parameters<typeof nearestCrossingSailings>[0]): FerryRow[] {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const rows: FerryRow[] = [];
  if (PROD_BUILD) {
    /* P7 — produkcja: najbliższa Stena (GDY→KAA) i najbliższy Polferries (GDN→NYN) z bazy. */
    const near = nearestCrossingSailings(sailings, nowMs, 1);
    for (const [s, op] of [[near.stena[0], 'Stena'], [near.polferries[0], 'Polferries']] as const) {
      if (!s) {
        const none = `${op} · ${t(locale, 'i2_no_sailing')}`;
        rows.push({ mins: Number.MAX_SAFE_INTEGER, cd: '—', line: none, short: op, head: none, to: '' });
        continue;
      }
      const depIso = effDeparture(s);
      const mins = Math.max(0, Math.round((Date.parse(depIso) - nowMs) / 60_000));
      const [from, to] = s.route.split('-');
      const when = depLabel(depIso, nowIso);
      const head = `${s.vessel} · ${when} · ${portName(locale, from)}`;
      rows.push({
        mins,
        cd: countdown(mins),
        line: `${head} → ${portName(locale, to)}`,
        /* telefon: przycisk ma odliczanie i „Stena 08:00” — data z rokiem nie mieści się w 360 px; pełna data w liście po dotknięciu */
        short: `${op} ${fmtTime(depIso)}`,
        head,
        to: portName(locale, to),
      });
    }
  } else {
    /* Demo — rozkład pokazowy Polferries (jeden rejs): najbliższy odjazd z Gdańska do Szwecji, ten sam co kafelek
       „Najbliższy prom” w Kokpicie (E37; audyt-A A-04 — bez rejsu powrotnego Nynäshamn → Gdańsk). */
    const s = nextGdnSailing(now);
    const mins = Math.max(0, Math.round((Date.parse(s.depLocal) - nowMs) / 60_000));
    const when = depLabel(new Date(Date.parse(s.depLocal)).toISOString(), nowIso);
    const head = `${vesselById(s.vessel).short || vesselById(s.vessel).name} · ${when} · ${portName(locale, s.depPort)}`;
    rows.push({
      mins,
      cd: countdown(mins),
      line: `${head} → ${portName(locale, s.arrPort)}`,
      short: `Polferries ${fmtTime(s.depLocal)}`,
      head,
      to: portName(locale, s.arrPort),
    });
  }
  return rows.sort((a, b) => a.mins - b.mins);
}

/** Telefon (E37 pkt 2): najbliższy prom; dotknięcie → oba rejsy, tydzień i data. */
function FerryChip({ rows, wk, date }: { rows: FerryRow[]; wk: number; date: string }) {
  const locale = useTowerStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const first = rows[0];
  if (!first) return null;
  return (
    <div className="ferry-chip-wrap" ref={ref}>
      <button ref={btnRef} type="button" className="ferry-chip" aria-expanded={open} aria-controls="ferryPop"
        aria-label={t(locale, 'p3a_ferry_open')} onClick={() => setOpen((v) => !v)} data-ferry-chip>
        <span className="ferry-chip-cd"><ClaudeIcon name="ferry" />{first.cd}</span>
        <span className="ferry-chip-lb">{first.short}</span>
      </button>
      {open ? (
        <div className="ferry-pop" id="ferryPop" role="group" aria-label={t(locale, 'p3a_ferry_open')} data-ferry-pop>
          {rows.map((row, i) => (
            <div key={i} className="ferry-pop-row">
              <b>{row.cd}</b>
              <span>{row.line}</span>
            </div>
          ))}
          <div className="ferry-pop-ft">
            <b>{tp(locale, 'a6_top_wk', { n: String(wk) })}</b>
            <b>{date}</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar() {
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const setRole = useTowerStore((s) => s.setRole);
  const sailings = useTowerStore((s) => s.sailings);
  /* wyglad/P10b-d (E37 pkt 9): po pierwszym wejściu Kokpit z „Jak pracuję” otwartym raz */
  const [help, setHelp] = useState(() => peekHelpOnce());
  useEffect(() => { clearHelpOnce(); }, []);
  const [ops, setOps] = useState({ wk: 0, ferryRows: [] as FerryRow[], date: '' });

  const closeHelp = useCallback(() => setHelp(false), []);

  useEffect(() => {
    const onHelp = () => setHelp((h) => !h);
    /* menu konta „Pomoc” zawsze otwiera (nie przełącza) */
    const onOpenHelp = () => setHelp(true);
    window.addEventListener('wt-toggle-help', onHelp);
    window.addEventListener('wt-open-help', onOpenHelp);
    return () => {
      window.removeEventListener('wt-toggle-help', onHelp);
      window.removeEventListener('wt-open-help', onOpenHelp);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = getNow();
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).formatToParts(now);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      const localNoon = new Date(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 12, 0, 0);
      setOps({
        wk: isoWeek(localNoon),
        ferryRows: buildFerryRows(locale, now, sailings),
        /* DD.MM.RRRR we wszystkich językach (właściciel 16.10.2026, zmienia A6-T3); P10 — bez zegara */
        date: fmtDate(now.toISOString()),
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [locale, sailings]);

  const switchView = canSwitchView();

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/brand/watchtower-symbol.png" alt="" width={28} height={28} />
        <b>{t(locale, 'brand')}</b>
        <span id="brandSub" className="brand-sub">{t(locale, 'p3a_brand_sub')}</span>
      </div>
      <div className="spacer" />
      {/* E9 / E37 / B5: „Podgląd” w produkcji tylko dla Administratora HHL (canSwitchView) */}
      {switchView ? <div className="roleswitch">
        <span id="roleLbl" className="role-lbl">{t(locale, 'p3a_preview_lbl')}</span>
        <div className="seg" role="group" aria-label={t(locale, 'p3a_preview_lbl')} id="roleSeg">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              data-role={r}
              aria-pressed={role === r}
              onClick={() => void switchViewRole(r)}
              title={ROLE_META[r].name}
            >
              {ROLE_META[r].short}
            </button>
          ))}
        </div>
      </div> : null}
      <div className="ops" id="ops" title={t(locale, 'a6_top_ferry_title')} data-p7-ferries>
        {switchView ? <span className="sep" /> : null}
        <span className="wk">{tp(locale, 'a6_top_wk', { n: String(ops.wk) })}</span>
        <span className="ops-ferry-ico"><ClaudeIcon name="ferry" /></span>
        <span className="ops-rows">
          {ops.ferryRows.map((row, i) => (
            <span key={i} data-ferry-row={i} className="ops-row">
              <span className="cd">{row.cd}</span>
              <span className="lb">{row.head}{row.to ? <span className="ops-to"> → {row.to}</span> : null}</span>
            </span>
          ))}
        </span>
        <span className="sep" />
        {/* P10 — data bez zegara */}
        <span className="cd ops-date" data-ops-date>{ops.date}</span>
      </div>
      <FerryChip rows={ops.ferryRows} wk={ops.wk} date={ops.date} />
      <button
        type="button"
        className="iconbtn top-help"
        id="helpBtn"
        title={hp(locale, 'help_title')}
        aria-label={hp(locale, 'help_title')}
        onClick={() => setHelp((h) => !h)}
        aria-pressed={help}
      >
        ?
      </button>
      <NotificationBell />
      <AccountMenu />
      {/* wyglad/P10b-b (E37 pkt 3): „?” = Pomoc (Jak pracuję, Co nowego, Kontakt, Skróty) */}
      {help ? (
        <Suspense fallback={null}>
          <HelpPanel open onClose={closeHelp} />
        </Suspense>
      ) : null}
    </header>
  );
}
