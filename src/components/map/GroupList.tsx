import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import { p9e } from '../../i18n/p9e';
import { p9m } from '../../i18n/p9c';
import { splitLabel, type GroupView } from '../../lib/p9eGroups';

/**
 * wyglad/P9-e (E45 pkt 5, R5): lista transportów po kliknięciu znacznika grupy — na komputerze karta na mapie,
 * na telefonie lista od dołu (makieta `makiety_html/E45/mapa.html`, telefon). Wiersz otwiera panel transportu.
 */
export function GroupList({ view, phone, locale, onPick, onClose }: {
  view: GroupView;
  phone: boolean;
  locale: Locale;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const body = (
    <>
      <div className="mapsheet-hd">
        <b className="mapgrp-title">{view.title}</b>
        <button type="button" className="iconbtn" aria-label={p9e(locale, 'p9e_list_close')} onClick={onClose}>✕</button>
      </div>
      {view.sub ? <div className="mapsheet-line muted" data-grp-sub>{view.sub}</div> : null}
      {view.note ? <div className="mapsheet-line muted" data-grp-note>{view.note}</div> : null}
      <ul className="mapgrp-list" aria-label={p9e(locale, 'p9e_list')}>
        {view.rows.map((r) => {
          const n = splitLabel(r.label);
          return (
          <li key={r.id}>
            <button type="button" className="mapgrp-row" data-grp-row={r.id} onClick={() => onPick(r.id)}>
              <span className="mapgrp-name"><b>{n.code}</b>{n.num ? <small>{n.num}</small> : null}</span>
              <span>
                {r.late ? <span className="r">{p9m(locale, 'p9c_lg_late')} · </span> : null}
                {t(locale, r.stageKey)}
              </span>
            </button>
          </li>
          );
        })}
      </ul>
    </>
  );

  if (phone) {
    return createPortal(
      <div className="scrim mapsheet-back" data-map-group-sheet={view.kind} onClick={onClose}>
        <div className="mapsheet" role="dialog" aria-label={view.title} onClick={(e) => e.stopPropagation()}>
          {body}
        </div>
      </div>,
      document.body,
    );
  }
  return (
    <div className="mapgrp" role="dialog" aria-label={view.title} data-map-group={view.kind}>
      {body}
    </div>
  );
}
