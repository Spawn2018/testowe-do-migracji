/* Właściciel 21.10.2026 20:14 pkt 5–7: kliknięcie powiadomienia na telefonie prowadzi do miejsca czynności; zamknięte sprawy nie wracają. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inAppTwinKey, pushNidFromSearch } from '../src/lib/pushOpen';
import { bellVisible } from '../src/lib/bellList';

describe('powiadomienia — cel i zamknięte sprawy', () => {
  it('service worker: wpis z id zawsze otwiera ?pn=<id> (także gdy baza dała url — #411), url tylko bez id', () => {
    const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
    expect(sw).toContain("const raw = d.nid ? `/?pn=${encodeURIComponent(d.nid)}` : ((d.url && d.url !== '/') ? d.url : '/');");
  });
  it('push (WEB_PUSH) → bliźniaczy wpis w dzwonku (IN_APP) po kluczu', () => {
    expect(inAppTwinKey('risk:abc:WP:u1')).toBe('risk:abc:IN:u1');
    expect(inAppTwinKey('risk:abc:IN:u1')).toBeNull();
    expect(inAppTwinKey(null)).toBeNull();
    const src = readFileSync(new URL('../src/lib/pushOpen.ts', import.meta.url), 'utf8');
    expect(src).toContain(".eq('channel', 'IN_APP').eq('dedup_key', twin)");
  });
  it('odczyt ?pn tylko liczbowy', () => {
    expect(pushNidFromSearch('?pn=123')).toBe(123);
    expect(pushNidFromSearch('?pn=abc')).toBeNull();
    expect(pushNidFromSearch('')).toBeNull();
  });
  it('aplikacja wpina otwieranie celu z powiadomienia', () => {
    expect(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')).toContain('usePushOpen();');
  });
  it('dzwonek nie pokazuje „Decyzja zamknięta” ani „Ryzyko zamknięte”', () => {
    const items = [
      { id: 'a', read: false, kind: 'DECISION_RESOLVED' },
      { id: 'b', read: false, kind: 'RISK_RESOLVED' },
      { id: 'c', read: false, kind: 'DECISION_OPEN' },
    ];
    expect(bellVisible(items, 'HHL').map((x) => x.id)).toEqual(['c']);
  });
});
