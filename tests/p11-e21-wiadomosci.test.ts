/**
 * P11 pkt 6 (E21 pkt 7) — strażnik tekstów na treściach wiadomości: domyślne tematy i treści e-maili, wpisów w dzwonku
 * i SMS z Opcji › Treści wiadomości (`p8Texts.ts`), z przykładowymi danymi transportu demo. Te same reguły co bramy
 * ekranów (`e21Rules.ts`). Treści z bazy (szablony na produkcji) sprawdza próbna wysyłka na TEST (P11 pkt 6).
 */
import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { MESSAGES, parseMarkers, renderSegs, sampleOf, smsOf } from '../src/lib/p8Texts';
import { textHits } from './e21Rules';

describe('E21 — treści wiadomości (Opcje › Treści wiadomości)', () => {
  const snap = buildDemoSnapshot();
  const loads = ['SG-03', 'T-01', 'K-03'].map((c) => snap.loads.find((l) => l.code === c)!).filter(Boolean);

  it('domyślne tematy i treści: 0 trafień strażnika (e-mail, dzwonek, logowanie, SMS)', () => {
    expect(loads).toHaveLength(3); // F7 #321 D3: brak transportu demo nie może po cichu wyłączyć testu
    expect(MESSAGES.length).toBeGreaterThan(30);
    const hits: string[] = [];
    for (const l of loads) {
      const sample = sampleOf(l);
      for (const m of MESSAGES) {
        const where = `${m.channel} ${m.id} (${l.code})`;
        if (m.subject) hits.push(...textHits(renderSegs(parseMarkers(m.subject), sample, m.buttonLabel), `${where} › temat`));
        const body = parseMarkers(m.body);
        hits.push(...textHits(m.channel === 'SMS' ? smsOf(body, sample) : renderSegs(body, sample, m.buttonLabel), `${where} › treść`));
      }
    }
    const u = [...new Set(hits)];
    expect(u, u.join('\n')).toEqual([]);
  });

  it('nazwa i opis „kto dostaje” każdej wiadomości: 0 trafień', () => {
    const hits = MESSAGES.flatMap((m) => [...textHits(m.name, `${m.id} › nazwa`), ...textHits(m.to, `${m.id} › kto dostaje`)]);
    expect(hits, hits.join('\n')).toEqual([]);
  });
});
