import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';

export type OptionsSectionDef = {
  id: string;
  titleKey: string;
  descKey: string;
  /** Licznik w nagłówku (np. „3 aktywne”). */
  count?: string;
  /** Tekst do wyszukiwania (oprócz tytułu/opisu). */
  keywords?: string;
  /** B-SMOKE-DRIFT (O4/D18): oznaczenie w nagłówku sekcji (np. DemoMark) — widoczne także po zwinięciu. */
  mark?: ReactNode;
  children: ReactNode;
};

type Props = {
  locale: Locale;
  sections: OptionsSectionDef[];
  /** Otwórz sekcję (np. stan systemu po kliknięciu SMS_FALLBACK). */
  forceOpen?: string | null;
};

/** DEC-6 — sekcje zwijane, domyślnie zwinięte; szukaj + rozwiń/zwiń wszystkie. */
export function OptionsAccordion({ locale, sections, forceOpen }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  useEffect(() => {
    if (forceOpen) setOpen((prev) => ({ ...prev, [forceOpen]: true }));
  }, [forceOpen]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter((s) => {
      const hay = [
        t(locale, s.titleKey),
        t(locale, s.descKey),
        s.keywords ?? '',
        s.count ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [locale, q, sections]);

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of filtered) next[s.id] = true;
    setOpen((prev) => ({ ...prev, ...next }));
  };
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of filtered) next[s.id] = false;
    setOpen((prev) => ({ ...prev, ...next }));
  };

  return (
    <div className="opt-acc" data-dec6="accordion">
      <div className="opt-acc-toolbar">
        <label className="opt-acc-search">
          <span className="sr-only">{t(locale, 'opt_acc_search')}</span>
          <input
            className="input full"
            type="search"
            value={q}
            placeholder={t(locale, 'opt_acc_search')}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t(locale, 'opt_acc_search')}
          />
        </label>
        <div className="opt-acc-actions">
          <button type="button" className="chipbtn" onClick={expandAll}>
            {t(locale, 'opt_acc_expand')}
          </button>
          <button type="button" className="chipbtn" onClick={collapseAll}>
            {t(locale, 'opt_acc_collapse')}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="note option-note" style={{ margin: '12px 0' }}>
          {t(locale, 'opt_acc_empty')}
        </div>
      ) : null}

      <div className="opt-acc-list">
        {filtered.map((s) => {
          const isOpen = open[s.id] === true;
          return (
            <details
              key={s.id}
              className="opt-acc-item panel"
              data-section={s.id}
              open={isOpen}
              onToggle={(e) => {
                const el = e.currentTarget;
                setOpen((prev) => ({ ...prev, [s.id]: el.open }));
              }}
            >
              <summary className="opt-acc-summary panel-hd">
                <div className="opt-acc-summary-copy">
                  <h2>{t(locale, s.titleKey)}</h2>
                  <span className="sub">{t(locale, s.descKey)}</span>
                </div>
                {s.mark ?? null}
                {s.count ? <span className="opt-acc-count">{s.count}</span> : null}
                <span className="opt-acc-chevron" aria-hidden>
                  {isOpen ? '▾' : '▸'}
                </span>
              </summary>
              <div className="opt-acc-body panel-bd">{s.children}</div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
