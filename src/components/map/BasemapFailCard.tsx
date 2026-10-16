import { useLayoutEffect, useRef, useState } from 'react';
import type { Locale } from '../../types';
import { p9, p9p } from '../../i18n/p9a';
import type { BasemapHealth } from './mapPool';

/** Poniżej tej szerokości mapy — wersja krótka z makiety telefonu (E24-1): tytuł, jedno zdanie, jeden przycisk. */
export const BASEMAP_CARD_COMPACT_PX = 560;

const VIA_KEY: Record<BasemapHealth['via'], string> = {
  'here-both': 'p9a_via_here_both',
  'here-proxy': 'p9a_via_here_proxy',
  fallback: 'p9a_via_fallback',
};

/**
 * wyglad/P9-a (E24-1) — komunikat zamiast szarej mapy (makieta `raport/img/e24-after`). Biała karta na środku mapy;
 * reszta mapy (trasa, pojazdy, przyciski) działa pod spodem — karta zasłania tylko siebie.
 */
export function BasemapFailCard({
  health,
  busy,
  locale,
  onRetry,
  onReload,
}: {
  health: BasemapHealth;
  busy: boolean;
  locale: Locale;
  onRetry: () => void;
  onReload: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setCompact(el.clientWidth > 0 && el.clientWidth < BASEMAP_CARD_COMPACT_PX);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chunk = health.cause === 'chunk';
  const via = chunk ? p9(locale, 'p9a_via_chunk') : p9(locale, VIA_KEY[health.via]);
  const tried = p9p(locale, 'p9a_tried', { n: Math.max(health.tries, 3), via });
  const retry = (
    <button type="button" className={`btn${chunk ? ' ghost' : ''}`} data-basemap-retry onClick={onRetry} disabled={busy} aria-busy={busy || undefined}>
      {busy ? p9(locale, 'p9a_retrying') : p9(locale, 'p9a_retry')}
    </button>
  );
  const reload = (
    <button type="button" className={`btn${chunk ? '' : ' ghost'}`} data-basemap-reload onClick={onReload}>
      {p9(locale, 'p9a_reload')}
    </button>
  );

  return (
    <div ref={wrapRef} className="bm-fail-wrap" data-basemap-failed={health.cause} data-compact={compact ? '1' : '0'}>
      <div className="bm-fail" role="status" aria-live="polite">
        <b className="bm-fail-t">{p9(locale, compact ? 'p9a_title_short' : 'p9a_title')}</b>
        <span className="bm-fail-b">
          {compact ? p9(locale, 'p9a_body_short') : p9(locale, chunk ? 'p9a_body_chunk' : 'p9a_body')}
        </span>
        <div className="bm-fail-row">
          {compact ? (chunk ? reload : retry) : chunk ? <>{reload}{retry}</> : <>{retry}{reload}</>}
        </div>
        {compact ? null : (
          <span className="bm-fail-src" data-basemap-src>
            {tried}
            {health.reported ? <> {p9(locale, 'p9a_reported')}</> : null}
          </span>
        )}
      </div>
    </div>
  );
}
