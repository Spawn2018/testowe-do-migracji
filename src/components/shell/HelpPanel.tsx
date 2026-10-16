/**
 * wyglad/P10b-b — Pomoc (E37 pkt 3, makieta `makiety_html/E37/pasek.html`): panel z prawej (na telefonie cały ekran)
 * z zakładkami Jak pracuję, Co nowego, Kontakt, Skróty. „Jak pracuję” w 5 wersjach według rodzaju konta (w Podglądzie —
 * wersja podglądanej firmy); kliknięcie kroku otwiera miejsce. „Skróty” tylko na komputerze, „Zmień widok” tylko HHL.
 * Zastępuje listę skrótów (KeyboardHelp) i „Instrukcję” z Opcji i Ustawień.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { hp, hpp } from '../../i18n/help';
import { useIsPhone } from '../../lib/useIsPhone';
import { getAuthProfile } from '../../auth/profile';
import { viewedKind } from '../../lib/cockpitE9';
import { helpVersion, HELP_PHONE_STEPS, type HelpStep } from '../../lib/helpContent';
import { goHelpTarget } from '../../lib/helpNav';
import { helpContacts, whatsNew } from '../../lib/helpSource';
import { DemoMark } from '../ui/DemoMark';

export type HelpTab = 'how' | 'news' | 'contact' | 'keys';

const DEMO = import.meta.env.VITE_AUTH_MODE !== 'supabase';
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
/* liczba i jednostka w jednej linii („72 h”, „1 %”, „7 dni”) — tekst bez zmian */
const keepUnits = (x: string) => x.replace(/(\d) (?=(?:h|%|dni|min|kolumn)(?![\p{L}\p{N}]))/gu, '$1\u00a0');

export function HelpPanel({ open, onClose, initialTab = 'how' }: { open: boolean; onClose: () => void; initialTab?: HelpTab }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const phone = useIsPhone();
  const [tab, setTab] = useState<HelpTab>(initialTab);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const version = helpVersion(viewedKind(role, getAuthProfile()?.role));
  const tabs: HelpTab[] = phone ? ['how', 'news', 'contact'] : ['how', 'news', 'contact', 'keys'];
  const shown: HelpTab = tabs.includes(tab) ? tab : 'how';
  const label = (k: HelpTab) => hp(locale, k === 'how' ? 'help_tab_how' : k === 'news' ? 'help_tab_news' : k === 'contact' ? 'help_tab_contact' : 'help_tab_keys');

  const step = (s: HelpStep, i: number) => (
    <li key={`${s.place}-${i}`}>
      {s.target ? (
        <button
          type="button"
          className="helpp-step"
          data-help-target={s.target}
          aria-label={hpp(locale, 'help_step_open', { place: s.place })}
          onClick={() => { const tg = s.target; onClose(); if (tg) goHelpTarget(tg, phone); }}
        >
          <b>{s.place}</b> — {keepUnits(s.text)}
        </button>
      ) : (
        <div className="helpp-step is-plain"><b>{s.place}</b> — {keepUnits(s.text)}</div>
      )}
    </li>
  );

  let body: ReactElement;
  if (shown === 'how') {
    body = (
      <div data-help-how={version.kind}>
        <p className="helpp-intro">{version.intro}</p>
        <ol className="helpp-steps">{version.steps.map(step)}</ol>
        {phone ? (
          <>
            <h3 className="helpp-sub">{hp(locale, 'help_phone_h')}</h3>
            <ol className="helpp-steps" start={version.steps.length + 1} data-help-phone>{HELP_PHONE_STEPS.map(step)}</ol>
          </>
        ) : null}
      </div>
    );
  } else if (shown === 'news') {
    const items = whatsNew() ?? [];
    body = (
      <div data-help-news>
        {DEMO ? <DemoMark /> : null}
        {items.length ? (
          <ul className="helpp-news">
            {items.map((n, i) => (
              <li key={`${n.at}-${i}`}>
                <span className="helpp-date">{dmy(n.at)}</span>
                <b>{n.title}</b>
                <p>{n.text}</p>
              </li>
            ))}
          </ul>
        ) : <p className="helpp-intro">{hp(locale, 'help_news_none')}</p>}
      </div>
    );
  } else if (shown === 'contact') {
    const list = helpContacts() ?? [];
    body = (
      <div data-help-contact>
        {DEMO ? <DemoMark /> : null}
        {list.length ? (
          <ul className="helpp-contacts">
            {list.map((c) => (
              <li key={c.id}>
                <span className="helpp-who">
                  <span><b>{hp(locale, 'help_contact_role')}</b> · {c.name}</span>
                  <small>{[c.phone, c.email].filter(Boolean).join(' · ')}</small>
                </span>
                <a className="chipbtn helpp-call" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} data-help-call>{hp(locale, 'help_call')}</a>
              </li>
            ))}
          </ul>
        ) : <p className="helpp-intro">{hp(locale, 'help_contact_none')}</p>}
      </div>
    );
  } else {
    const fin = role === 'KSH' ? 'nav_fin_ksh' : role === 'SCX' ? 'nav_fin_scx' : 'nav_fin';
    const rows: Array<[string, string]> = [
      [hp(locale, 'help_key_dash'), 'K'],
      [hp(locale, 'help_key_map'), 'M'],
      [hp(locale, 'help_key_sched'), 'H'],
      [hp(locale, 'help_key_risk'), 'R'],
      [hp(locale, 'help_key_docs'), 'D'],
      [t(locale, fin), 'F'],
      ...(role === 'HHL' ? [[hp(locale, 'help_key_view'), 'Shift + R'] as [string, string]] : []),
      [hp(locale, 'help_key_theme'), 'T'],
      [hp(locale, 'help_key_esc'), 'Esc'],
      [hp(locale, 'help_key_help'), '?'],
    ];
    body = (
      <dl className="helpp-keys" data-help-keys>
        {rows.map(([l, k]) => (
          <div key={l}><dt>{l}</dt><dd><kbd>{k}</kbd></dd></div>
        ))}
      </dl>
    );
  }

  return createPortal(
    <div className="helpp-back" data-help-back onClick={onClose}>
      <aside className="helpp" role="dialog" aria-label={hp(locale, 'help_title')} data-help-panel onClick={(e) => e.stopPropagation()}>
        <header className="helpp-hd">
          <b>{hp(locale, 'help_title')}</b>
          <span className="helpp-kind" data-help-kind={version.kind}>{version.title}</span>
          <button ref={closeRef} type="button" className="iconbtn" aria-label={hp(locale, 'help_close')} onClick={onClose}>✕</button>
        </header>
        <div className="helpp-tabs" role="tablist" aria-label={hp(locale, 'help_tabs')}>
          {tabs.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`helpp-tab-${k}`}
              aria-selected={shown === k}
              aria-controls="helpp-pane"
              data-help-tab={k}
              onClick={() => setTab(k)}
            >
              {label(k)}
            </button>
          ))}
        </div>
        <div className="helpp-body" role="tabpanel" id="helpp-pane" aria-labelledby={`helpp-tab-${shown}`}>{body}</div>
      </aside>
    </div>,
    document.body,
  );
}
