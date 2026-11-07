/**
 * DP-232 (#860) — pole wyboru „emtrack” przy Link śledzenia w awizacji.
 * Zaznaczenie → stały EMTRACK_APP_URL; edycja z zapisanym emtrack → zaznaczone; odznaczenie → pusto.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrackingLinkField } from '../src/components/drawer/TrackingLinkField';
import { EMTRACK_APP_URL, trackerKind } from '../src/lib/trackerLink';
import type { Load } from '../src/types';

const load = {
  plannedLoadDate: '2026-10-05',
  plannedDeliverDate: '2026-10-07',
  planDates: undefined,
} as unknown as Pick<Load, 'plannedLoadDate' | 'plannedDeliverDate' | 'planDates'>;
const NOW = '2026-10-04T10:00:00Z';

describe('DP-232 — EMTRACK_APP_URL', () => {
  it('stała w jednym miejscu; trackerKind rozpoznaje emtrack', () => {
    expect(EMTRACK_APP_URL).toBe('https://emtrack.eu/app/');
    expect(trackerKind(EMTRACK_APP_URL)).toBe('emtrack');
    expect(trackerKind('https://emtrack.eu/app')).toBe('emtrack');
  });
});

describe('DP-232 — TrackingLinkField checkbox emtrack', () => {
  const render = (value: string, trailerPlate = '') => renderToStaticMarkup(createElement(TrackingLinkField, {
    value,
    onChange: () => {},
    savedRef: value,
    info: null,
    load,
    locale: 'pl',
    nowIso: NOW,
    trailerPlate,
  }));

  it('zaznaczony przy zapisanym emtrack — pole nieaktywne ze stałym URL', () => {
    const html = render(EMTRACK_APP_URL, 'ABC 123');
    expect(html).toContain('data-tl-emtrack="1"');
    expect(html).toContain('data-tl-emtrack-box');
    expect(html).toContain('checked=""');
    expect(html).toContain(`value="${EMTRACK_APP_URL}"`);
    expect(html).toContain('disabled=""');
    expect(html).toContain('emtrack · konto przewoźnika');
    expect(html).not.toContain('data-tl-emtrack-trailer-warn');
  });

  it('odznaczony przy pustym linku — pole do wklejenia', () => {
    const html = render('', 'ABC 123');
    expect(html).toContain('data-tl-emtrack="0"');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('placeholder="URL lub identyfikator"');
  });

  it('ostrzeżenie przy emtrack bez naczepy', () => {
    const html = render(EMTRACK_APP_URL, '');
    expect(html).toContain('data-tl-emtrack-trailer-warn');
    expect(html).toContain('Podaj numer naczepy');
  });

  it('ostrzeżenie przy emtrack i dwóch numerach naczepy', () => {
    const html = render(EMTRACK_APP_URL, 'ABC 123 - XYZ 45');
    expect(html).toContain('data-tl-emtrack-trailer-warn');
    expect(html).toContain('Wpisz jeden numer naczepy');
  });
});
