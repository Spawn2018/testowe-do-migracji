/**
 * D-20261019-0005-01 (właściciel 19.10.2026, 00:01): Administrator HHL zmienia każdą datę bez ograniczeń;
 * KSH — jak dotąd (do wjazdu na załadunek, w kolejności), SCX — bez zmiany dat KSH.
 */
import { describe, expect, it } from 'vitest';
import { useTowerStore } from '../src/store/useTowerStore';
import { hhlAdminDates } from '../src/lib/adminDates';

describe('daty — Administrator HHL bez ograniczeń', () => {
  it('Administrator HHL tak; KSH i SCX — nie', () => {
    expect(hhlAdminDates('HHL')).toBe(true);
    expect(hhlAdminDates('KSH')).toBe(false);
    expect(hhlAdminDates('SCX')).toBe(false);
  });

  it('demo: Administrator HHL zapisuje daty po załadunku i rozładunek przed załadunkiem; SCX nie', () => {
    const st = useTowerStore.getState();
    const done = st.loads.find((l) => l.status === 'DELIVERED')!;
    const p = { loadDate: '2026-08-20', deliveryDate: '2026-08-18', loadFrom: '2026-08-20T07:00:00.000Z', loadTo: '2026-08-20T05:00:00.000Z', deliveryFrom: '2026-08-18T07:00:00.000Z', deliveryTo: '2026-08-18T15:00:00.000Z' };
    useTowerStore.setState({ role: 'SCX' });
    expect(useTowerStore.getState().kshEditPlanDates(done.id, p)).toBe(false);
    useTowerStore.setState({ role: 'KSH' });
    expect(useTowerStore.getState().kshEditPlanDates(done.id, p)).toBe(false);
    useTowerStore.setState({ role: 'HHL' });
    expect(useTowerStore.getState().kshEditPlanDates(done.id, p)).toBe(true);
    const after = useTowerStore.getState().loads.find((l) => l.id === done.id)!;
    expect(after.plannedLoadDate).toBe('2026-08-20');
    expect(after.plannedDeliverDate).toBe('2026-08-18');
  });
});
