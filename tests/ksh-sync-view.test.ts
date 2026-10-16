/**
 * wyglad/P7-e — stan synchronizacji pliku KSH na SharePoint (W13, D-20261016-1230-01 pkt 5.5–5.6; zasady 15 i 16)
 * oraz dopełnienie B-03 („Rozładowany” = „Dostarczone”, E25) w kwotach i w sprawdzeniu zajętości kierowcy.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KSH_SECRET_WARN_DAYS, KSH_SYNC_DOWN_MIN, kshRunText, kshSecretDaysLeft, kshSyncLine, kshSyncOf, kshSyncSourceRow,
  kshSyncTone, type KshSharePointSync,
} from '../src/lib/kshSyncView';
import { unloadedAtOf } from '../src/lib/money/loadMoney';
import { buildSeedLoads } from '../src/data/seed';
import { awizacjaDuplicateWarning } from '../src/lib/awizacjaState';
import type { Load } from '../src/types';

const NOW = '2026-10-16T06:10:00Z'; // 08:10 w Warszawie
const base: KshSharePointSync = {
  lastReadAt: '2026-10-16T06:05:00Z',
  lastWriteAt: null,
  writeEnabled: false,
  sourceOk: true,
  secretExpiresOn: '2027-10-01',
  lastRun: { created: 2, changed: 5, skipped: 1, ntg: 40, cases: 1 },
};

describe('P7-e — linia nad Harmonogramem (zasada 15)', () => {
  it('bez pola wykonawcy — null (zostaje linia B-09)', () => {
    expect(kshSyncOf({})).toBeNull();
    expect(kshSyncOf(null)).toBeNull();
    expect(kshSyncOf({ kshSharePointSync: null })).toBeNull();
    expect(kshSyncOf({ kshSharePointSync: base })).toEqual(base);
  });

  it('udany odczyt w ciągu 30 min — „zsynchronizowano” z datą DD.MM.RRRR, GG:MM', () => {
    const l = kshSyncLine(base, NOW);
    expect(l.tone).toBe('ok');
    expect(l.text).toBe('Plik KSH (SharePoint): zsynchronizowano 16.10.2026, 08:05');
    expect(l.title).toContain('Ostatni przebieg: nowe 2 · zmienione 5 · pominięte 1 · NTG 40 · sprawy 1');
    expect(l.title).toContain('Zapis do pliku wyłączony — dostęp tylko do odczytu');
  });

  it(`po ${KSH_SYNC_DOWN_MIN} min bez odczytu albo przy błędzie źródła — „nie działa”`, () => {
    const late = '2026-10-16T06:36:00Z';
    expect(kshSyncTone(base, late)).toBe('down');
    expect(kshSyncLine(base, late).text).toBe('Plik KSH (SharePoint): nie działa — ostatni odczyt 16.10.2026, 08:05');
    expect(kshSyncTone({ ...base, sourceOk: false }, NOW)).toBe('down');
    expect(kshSyncLine({ ...base, lastReadAt: null }, NOW).text).toBe('Plik KSH (SharePoint): nie działa — brak odczytu');
    expect(kshSyncTone(base, '2026-10-16T06:35:00Z')).toBe('ok');
  });

  it('zapis włączony — godzina ostatniego zapisu w podpowiedzi', () => {
    const l = kshSyncLine({ ...base, writeEnabled: true, lastWriteAt: '2026-10-16T05:50:00Z' }, NOW);
    expect(l.title).toContain('Zapis do pliku: ostatni 16.10.2026, 07:50');
  });

  it('przebieg bez danych — bez linii przebiegu', () => {
    expect(kshRunText(null)).toBeNull();
    expect(kshSyncLine({ ...base, lastRun: null }, NOW).title).toBe('Zapis do pliku wyłączony — dostęp tylko do odczytu');
  });
});

describe('P7-e — wiersz w Stanie systemu (zasady 15 i 16)', () => {
  it('działa — „co 5 min”, nazwa i przebieg', () => {
    const r = kshSyncSourceRow({ ...base, writeEnabled: true }, NOW);
    expect(r).toMatchObject({ id: 'ksh-sharepoint', name: 'Plik KSH (SharePoint)', cadence: 'co 5 min', state: 'ok', since: null });
    expect(r.why).toContain('Ostatni przebieg');
  });

  it('nie działa — od kiedy i alarm do Administratorów HHL', () => {
    const r = kshSyncSourceRow({ ...base, sourceOk: false }, NOW);
    expect(r.state).toBe('down');
    expect(r.since).toBe(base.lastReadAt);
    expect(r.why).toContain('alarm do Administratorów HHL');
  });

  it(`sekret wygasa w ciągu ${KSH_SECRET_WARN_DAYS} dni — ostrzeżenie z datą DD.MM.RRRR`, () => {
    const s = { ...base, writeEnabled: true, secretExpiresOn: '2026-10-30' };
    expect(kshSecretDaysLeft(s, NOW)).toBe(14);
    const r = kshSyncSourceRow(s, NOW);
    expect(r.state).toBe('partial');
    expect(r.why).toContain('Sekret aplikacji wygasa 30.10.2026 (za 14 dni)');
    const gone = kshSyncSourceRow({ ...s, secretExpiresOn: '2026-10-10' }, NOW);
    expect(gone.why).toContain('Sekret aplikacji wygasł 10.10.2026');
  });

  it('zapis wyłączony — zdanie o pliku testowym od działu IT KSH', () => {
    expect(kshSyncSourceRow(base, NOW).why).toContain('Zapis do pliku wyłączony');
  });

  it('ekrany czytają pole i składają linię (Harmonogram, Stan systemu)', () => {
    const sv = readFileSync('src/views/ScheduleView.tsx', 'utf8');
    expect(sv).toContain('kshSyncOf(s)');
    expect(sv).toContain('data-ksh-sync');
    const ss = readFileSync('src/components/options/StatusScreen.tsx', 'utf8');
    expect(ss).toContain('kshSyncSourceRow(kshSync, nowIso)');
  });
});

describe('B-03 — „Rozładowany” = „Dostarczone” w kwotach i zajętości (E25)', () => {
  it('UNLOADING bez daty rozładunku — koniec okna rozładunku jak DELIVERED', () => {
    const loads = buildSeedLoads();
    const l = loads.find((x) => x.status === 'DELIVERED') ?? loads[0];
    const unloading: Load = { ...l, status: 'UNLOADING', unloadedAt: undefined } as Load;
    const delivered: Load = { ...l, status: 'DELIVERED', unloadedAt: undefined } as Load;
    expect(unloadedAtOf(unloading)).toBe(unloadedAtOf(delivered));
    expect(unloadedAtOf(unloading)).not.toBeNull();
  });

  it('kierowca transportu „Rozładowany” nie blokuje awizacji innego transportu', () => {
    const loads = buildSeedLoads();
    const other = loads.find((x) => x.resources.driverName && x.resources.tractorPlate);
    expect(other).toBeTruthy();
    const draft = { driverName: other!.resources.driverName!, tractorPlate: other!.resources.tractorPlate! };
    const busy = loads.map((x) => (x.id === other!.id ? { ...x, status: 'IN_TRANSIT_PL' } : x)) as Load[];
    expect(awizacjaDuplicateWarning(busy, 'inny-transport', draft)).not.toBeNull();
    const unloading = loads.map((x) => (x.id === other!.id ? { ...x, status: 'UNLOADING' } : x)) as Load[];
    const onlyOther = unloading.filter((x) => x.id === other!.id || x.resources.driverName?.trim().toLowerCase() !== draft.driverName.trim().toLowerCase() && x.resources.tractorPlate?.trim().toUpperCase() !== draft.tractorPlate.trim().toUpperCase());
    expect(awizacjaDuplicateWarning(onlyOther, 'inny-transport', draft)).toBeNull();
  });
});
