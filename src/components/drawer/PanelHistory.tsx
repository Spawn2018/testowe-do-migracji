/**
 * wyglad/P6-b — panel transportu › „Historia” (E17 pkt 2, img/e17-after „Historia”).
 * Dziennik zmian po polsku: dni (najnowsze najpierw), filtry „Wszystko / Statusy i trasa / Zasoby i awizacja / Numery /
 * Dokumenty / Ceny”, wpis „było → jest” z rodzajem, autor „Imię Nazwisko // Firma” albo „System // Watch Tower”,
 * przy strefie jej nazwa. Wpisy bez zmiany ukryte i policzone pod listą. Ceny według firmy (KSH i SCX bez marży).
 * KSH bez numerów zleceń (E41) i bez filtra „Numery”. Telefon: filtry przewijają się w bok, bez znaczników rodzaju.
 * Tylko odczyt — bez zapisów i zapytań.
 */
import { useMemo, useState } from 'react';
import type { Geofence, Load, LoadEvent, Locale } from '../../types';
import { buildHistory, dayLabel, hhmm, histFiltersFor, type HistFilter, type HistRow } from '../../lib/p6History';
import { historyEventsOf } from '../../lib/p6bSource';
import { ht, htn } from '../../i18n/p6b';
import './p6b.css';

interface Props {
  load: Load;
  role: 'HHL' | 'KSH' | 'SCX';
  locale: Locale;
  phone: boolean;
  events: readonly LoadEvent[];
  geofences: readonly Pick<Geofence, 'id' | 'name'>[];
  nowIso: string;
}

function What({ r, locale, phone }: { r: HistRow; locale: Locale; phone: boolean }) {
  return (
    <div className="ph-what">
      {!phone ? <span className={`ph-tag t-${r.cat.toLowerCase()}`}>{ht(locale, `p6b_tag_${r.cat}`).toUpperCase()}</span> : null}
      <span className="ph-tx">
        {r.head ? <span data-content>{r.head}</span> : null}
        {r.head && (r.from != null || r.to != null) ? ' ' : null}
        {r.from != null ? (
          <>
            {r.from === '—' ? <span>—</span> : <s data-content>{r.from}</s>}
            {' → '}
          </>
        ) : null}
        {r.to != null ? <b data-content>{r.to}</b> : null}
        {r.tail ? <span className="ph-tail" data-content>{` · ${r.tail}`}</span> : null}
      </span>
    </div>
  );
}

export function PanelHistory({ load, role, locale, phone, events, geofences, nowIso }: Props) {
  const [filter, setFilter] = useState<HistFilter>('ALL');
  const zones = useMemo(() => new Map(geofences.map((g) => [g.id, g.name])), [geofences]);
  const all = useMemo(() => historyEventsOf(load, events, nowIso), [events, load, nowIso]);
  const hist = useMemo(() => buildHistory(all, role, filter, locale, zones), [all, role, filter, locale, zones]);

  return (
    <div className="ph" data-history-panel>
      <div className="ph-filters" role="group" aria-label={ht(locale, 'p6b_f_aria')}>
        {histFiltersFor(role).map((f) => (
          <button
            key={f}
            type="button"
            className="ph-chip"
            aria-pressed={filter === f}
            data-hist-filter={f}
            onClick={() => setFilter(f)}
          >
            {ht(locale, phone && f === 'RES' ? 'p6b_f_RES_short' : `p6b_f_${f}`)}
          </button>
        ))}
      </div>
      <div className="ph-days" data-history data-hist-total={hist.total}>
        {hist.days.length === 0 ? <p className="ph-empty">{ht(locale, 'p6b_hist_empty')}</p> : null}
        {hist.days.map((d) => (
          <section key={d.day} className="ph-day">
            <h5 className="ph-day-hd">{dayLabel(d.day).toUpperCase()}</h5>
            <ul className="ph-list">
              {d.rows.map((r) => (
                <li key={r.id} className="ph-row" data-hist-cat={r.cat}>
                  <span className="ph-time">{hhmm(r.at)}</span>
                  <div className="ph-body">
                    <What r={r} locale={locale} phone={phone} />
                    <div className="ph-who" data-content>{r.src ? `${r.who} · ${r.src}` : r.who}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {hist.hidden > 0 ? <p className="ph-hidden" data-hist-hidden={hist.hidden}>{htn(locale, 'p6b_hidden', hist.hidden)}</p> : null}
    </div>
  );
}
