/* B4 (właściciel 21.10.2026 19:34): HHL i SCX piszą do wszystkich albo „tylko HHL i SCX”; KSH tylko do wszystkich. Produkcja włączona. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { messageFromRow } from '../src/data/mappers';
import { chatVisibilityOn, chatVisibleFor } from '../src/lib/p6bSource';

const base = { id: 1, load_id: 'L1', body: 'x', created_at: '2026-10-21T17:00:00Z', author_org: 'SCX' };

describe('B4 — widoczność wiadomości czatu', () => {
  it('wybór odbiorców włączony', () => {
    expect(chatVisibilityOn()).toBe(true);
  });
  it('odczyt: zbiór bez CLIENT = tylko HHL i SCX; pełny lub brak = wszyscy', () => {
    expect(messageFromRow({ ...base, visible_to: ['FORWARDER', 'CARRIER'] }).visibleTo).toBe('HHL_SCX');
    expect(messageFromRow({ ...base, visible_to: ['FORWARDER', 'CLIENT', 'CARRIER'] }).visibleTo).toBeUndefined();
    expect(messageFromRow({ ...base }).visibleTo).toBeUndefined();
  });
  it('KSH nie widzi rozmowy HHL–SCX', () => {
    const m = messageFromRow({ ...base, visible_to: ['FORWARDER', 'CARRIER'] });
    expect(chatVisibleFor([m], 'KSH')).toHaveLength(0);
    expect(chatVisibleFor([m], 'HHL')).toHaveLength(1);
  });
  it('zapis: „tylko HHL i SCX” wysyła visible_to {FORWARDER,CARRIER}; KSH bez wyboru', () => {
    const p = readFileSync(new URL('../src/data/supabaseProvider.ts', import.meta.url), 'utf8');
    expect(p).toContain("if (m.visibleTo === 'HHL_SCX') row.visible_to = ['FORWARDER', 'CARRIER'];");
    expect(p).toContain("select('id,load_id,body,created_at,author_org,visible_to')");
    const s = readFileSync(new URL('../src/store/useTowerStore.ts', import.meta.url), 'utf8');
    expect(s).toContain("writeThrough({ type: 'message.send', loadId, text, ...(visibleTo === 'HHL_SCX' ? { visibleTo } : {}) });");
    const c = readFileSync(new URL('../src/components/drawer/PanelChat.tsx', import.meta.url), 'utf8');
    expect(c).toContain("const canChoose = chatVisibilityOn() && role !== 'KSH';");
  });
});
