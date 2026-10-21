/**
 * Właściciel 21.10.2026 20:14 (pkt 5): „Na komórce nie wyświetlają się powiadomienia z dzwoneczka.”
 * Dzwonek dociąga wpisy z serwera po powrocie do aplikacji, przy otwarciu i co minutę; lista na telefonie się nie zwija.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bellVisible, mergeBellRefresh } from '../src/lib/bellList';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const n = (id: string, read = false) => ({ id, read, at: '2026-10-21T20:14:00Z' });

describe('W-dzwonek-tel (22.10.2026)', () => {
  it('nowe wpisy z serwera trafiają do dzwonka, przeczytane lokalnie zostają przeczytane', () => {
    const local = [n('srv-2', true), n('srv-1'), n('push-x', true)];
    const server = [n('srv-3'), n('srv-2'), n('srv-1')];
    const out = mergeBellRefresh(local, server);
    expect(out.map((x) => x.id)).toEqual(['srv-3', 'srv-2', 'srv-1', 'push-x']);
    expect(out.find((x) => x.id === 'srv-2')!.read).toBe(true);
    expect(bellVisible(out, 'HHL').map((x) => x.id)).toEqual(['srv-3', 'srv-1']);
  });

  it('przeczytane na serwerze (np. na komputerze) znika też z telefonu', () => {
    expect(mergeBellRefresh([n('srv-1')], [n('srv-1', true)])[0].read).toBe(true);
  });

  it('odświeżanie: powrót do aplikacji, otwarcie dzwonka, co minutę; tylko w trybie Supabase', () => {
    const br = read('src/data/supabaseBridge.ts');
    expect(br).toContain("addEventListener('visibilitychange'");
    expect(br).toContain("addEventListener('pageshow'");
    expect(br).toContain('startBellRefresh();');
    expect(br).toMatch(/disconnectSupabaseData\(\): void \{\n {2}stopBellRefresh\(\);/);
    expect(read('src/data/supabaseProvider.ts')).toContain('loadNotifications');
    const bell = read('src/components/shell/NotificationBell.tsx');
    expect(bell).toContain("import.meta.env.VITE_AUTH_MODE === 'supabase'");
    expect(bell).toContain('b.refreshNotifications()');
    expect(bell).toContain("addEventListener('pointerdown', onDoc)");
  });

  it('CSS: lista dzwonka z podstawą auto (WebKit), przewijanie w środku', () => {
    expect(read('src/index.css')).toContain('.bell-pop .bell-scroll{flex:1 1 auto;min-height:0;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}');
  });
});
