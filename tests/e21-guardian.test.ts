/**
 * E21-1 (P2): strażnik blokuje ekrany poprawione w P2.
 * Reszta (Finanse E16, Opcje E12, Dokumenty E31, Mapa E29, Ryzyka E7) jest w raporcie, nie blokuje.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

const BLOCKING = [
  'src/components/DecisionCentre.tsx',
  'src/views/RisksView.tsx',
  'src/views/MapView.tsx',
  'src/lib/bellList.ts',
  'src/components/shell/NotificationBell.tsx',
];

describe('E21 strażnik P2', () => {
  it('zakres blokujący: bez toLocaleString() i bez „pojazdów w ruchu” na sztywno', () => {
    const hits: string[] = [];
    for (const f of BLOCKING) {
      const src = read(f);
      if (src.includes('toLocaleString(')) hits.push(`${f}: toLocaleString`);
      if (src.includes('pojazdów w ruchu')) hits.push(`${f}: pojazdów w ruchu`);
      if (f.endsWith('NotificationBell.tsx') && src.includes("color: '#0E1A24'")) hits.push(`${f}: ciemna liczba dzwonka`);
    }
    expect(hits).toEqual([]);
  });

  it('aplikacja bez znaku ●', () => {
    const files = [
      'src/lib/transportName.ts',
      'src/lib/bellList.ts',
      'src/components/drawer/LoadDrawer.tsx',
      'src/views/ScheduleView.tsx',
    ];
    const hits = files.filter((f) => read(f).includes('●'));
    expect(hits).toEqual([]);
  });
});
