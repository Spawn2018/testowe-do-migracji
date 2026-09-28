import { describe, expect, it } from 'vitest';
import { declutter, trackPositionAt } from '../src/lib/mapDeclutter';

const minDist = (m: Map<string, { x: number; y: number }>) => {
  const v = [...m.values()]; let d = Infinity;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) d = Math.min(d, Math.hypot(v[i].x - v[j].x, v[i].y - v[j].y));
  return d;
};

describe('III-5 declutter — kolizje znaczników i etykiet', () => {
  it('pojedyncze i odległe punkty bez zmian', () => {
    const r = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }], 22);
    expect(r.get('a')).toEqual({ x: 0, y: 0 });
    expect(r.get('b')).toEqual({ x: 100, y: 0 });
  });
  it.each([2, 3, 6, 12, 50])('%i znaczników w jednym punkcie → odstęp ≥ 22 px', (n) => {
    const pts = Array.from({ length: n }, (_, i) => ({ id: `L${String(i).padStart(3, '0')}`, x: 200, y: 200 }));
    const r = declutter(pts, 22);
    expect(r.size).toBe(n);
    expect(minDist(r)).toBeGreaterThanOrEqual(22 - 1e-6);
  });
  it('wynik deterministyczny, niezależny od kolejności wejścia', () => {
    const pts = [{ id: 'c', x: 5, y: 5 }, { id: 'a', x: 4, y: 6 }, { id: 'b', x: 6, y: 4 }];
    expect([...declutter(pts).entries()].sort()).toEqual([...declutter([...pts].reverse()).entries()].sort());
  });
  it('łańcuch bliskich punktów tworzy jedną grupę bez nakładania', () => {
    const r = declutter([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 15, y: 0 }, { id: 'c', x: 30, y: 0 }], 22);
    expect(minDist(r)).toBeGreaterThanOrEqual(22 - 1e-6);
  });
});

describe('III-5 odtwarzanie przebiegu — pozycja w czasie', () => {
  const tr = [
    { ts: '2026-09-28T08:00:00Z', lat: 52, lng: 17, speed_kmh: 0 },
    { ts: '2026-09-28T10:00:00Z', lat: 54, lng: 19, speed_kmh: 80 },
  ];
  it('przed początkiem i po końcu — skrajne punkty', () => {
    expect(trackPositionAt(tr, Date.parse('2026-09-28T07:00:00Z'))).toEqual({ lat: 52, lng: 17, idx: 0 });
    expect(trackPositionAt(tr, Date.parse('2026-09-28T11:00:00Z'))).toEqual({ lat: 54, lng: 19, idx: 1 });
  });
  it('w połowie czasu — w połowie odcinka', () => {
    expect(trackPositionAt(tr, Date.parse('2026-09-28T09:00:00Z'))).toEqual({ lat: 53, lng: 18, idx: 0 });
  });
  it('pusty przebieg → null', () => { expect(trackPositionAt([], 0)).toBeNull(); });
});
