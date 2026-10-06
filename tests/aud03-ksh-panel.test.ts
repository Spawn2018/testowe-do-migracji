/**
 * AUD-03 — KSH — PANEL ZLECENIA: źródło (panel wspólny, bez KshSideMenu), store (KSH tylko daty; „Zmień ciągnik”
 * no-op dla KSH), migracja 0192 (RPC = jedyna droga KSH, tylko kolumny dat, autor // KSH, DEC-4, I-10).
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { useTowerStore } from '../src/store/useTowerStore';
import { canEditResources } from '../src/lib/permissions';
import { eventTypeLabel } from '../src/lib/enumLabels';

const src = (p: string) => readFileSync(p, 'utf8');

describe('AUD-03 — panel zlecenia KSH (źródło)', () => {
  it('brak osobnego panelu KSH; „Edytuj” w Przeglądzie otwiera okno dat', () => {
    const d = src('src/components/drawer/LoadDrawer.tsx');
    expect(d).not.toMatch(/KshSideMenu/);
    expect(d).not.toMatch(/if \(role === 'KSH'\) \{\s*return/);
    expect(d).toMatch(/data-ksh-actions/);
    expect(d).toMatch(/<KshDatesModal/);
    expect(d).toMatch(/\{canEdit && \(\s*<div[^>]*data-carrier-actions/);
  });
  it('okno: wyłącznie 4 pola daty i godziny; zapis przez ksh_confirm_dates', () => {
    const m = src('src/components/drawer/KshDatesModal.tsx');
    expect((m.match(/<input /g) ?? []).length).toBe(4);
    expect((m.match(/type="datetime-local"/g) ?? []).length).toBe(4);
    expect(m).not.toMatch(/<select|<textarea/);
    expect(m).toMatch(/rpc\('ksh_confirm_dates'/);
  });
  it('„Zmień ciągnik” w harmonogramie tylko dla przewoźnika i HHL', () => {
    expect(src('src/views/ScheduleView.tsx')).toMatch(/\{canEditResources\(role\) \? \(\s*<button[\s\S]{0,200}data-change-tractor/);
    expect(canEditResources('KSH')).toBe(false);
    expect(canEditResources('SCX')).toBe(true);
    expect(canEditResources('HHL')).toBe(true);
  });
  it('Historia: wpis PLAN_DATES_CHANGED po polsku', () => {
    expect(eventTypeLabel('PLAN_DATES_CHANGED', 'pl')).toBe('Zmiana dat i godzin planu');
    expect(eventTypeLabel('SCHEDULE_DATE_CRITICAL', 'pl')).toBe('Zmiana daty transportu awizowanego');
  });
});

describe('AUD-03 — store (tryb demo)', () => {
  beforeEach(() => useTowerStore.setState({ ...buildDemoSnapshot(), role: 'KSH', locale: 'pl', toasts: [] } as never));
  const first = () => useTowerStore.getState().loads[0]!;

  it('KSH: updateResources (Zmień ciągnik) nic nie zapisuje', () => {
    const before = first().resources.tractorPlate;
    useTowerStore.getState().updateResources(first().id, { tractorPlate: 'KSH-HACK' });
    expect(first().resources.tractorPlate).toBe(before);
  });
  it('KSH: zmiana dat i okien + wpis w Historii; inne pola bez zmian', () => {
    const l = first();
    const ok = useTowerStore.getState().kshEditPlanDates(l.id, {
      loadDate: '2026-10-12', deliveryDate: '2026-10-16',
      loadFrom: '2026-10-12T06:00:00.000Z', loadTo: '2026-10-12T12:00:00.000Z',
      deliveryFrom: '2026-10-16T07:00:00.000Z', deliveryTo: '2026-10-16T11:00:00.000Z',
    });
    expect(ok).toBe(true);
    const n = first();
    expect(n.plannedLoadDate).toBe('2026-10-12');
    expect(n.plannedDeliverDate).toBe('2026-10-16');
    expect(n.awizacja.loadWindowStart).toBe('2026-10-12T06:00:00.000Z');
    expect(n.resources).toEqual(l.resources);
    expect(n.status).toBe(l.status);
    const ev = useTowerStore.getState().events.find((e) => e.loadId === l.id && e.type === 'PLAN_DATES_CHANGED');
    expect(ev?.actor).toMatch(/\/\/ KSH$/);
  });
  it('rozładunek przed załadunkiem odrzucony; inne role nie używają edycji KSH', () => {
    const l = first();
    const bad = { loadDate: '2026-10-16', deliveryDate: '2026-10-12', loadFrom: 'a', loadTo: 'b', deliveryFrom: 'a', deliveryTo: 'b' };
    expect(useTowerStore.getState().kshEditPlanDates(l.id, bad)).toBe(false);
    useTowerStore.setState({ role: 'SCX' });
    expect(useTowerStore.getState().kshEditPlanDates(l.id, { ...bad, loadDate: '2026-10-12', deliveryDate: '2026-10-16' })).toBe(false);
  });
});

describe('AUD-03 — migracja 0192', () => {
  const m = src('supabase/migrations/0192_aud03_ksh_panel_dates.sql');
  it('RPC tylko dla KSH (CLIENT) swojego projektu i przed załadunkiem', () => {
    expect(m).toMatch(/current_org_kind\(\) = 'CLIENT'\) is not true/);
    expect(m).toMatch(/v_client = current_org_id\(\)\) is not true/);
    expect(m).toMatch(/'PLANNED','RESOURCES_PENDING','DOCS_PENDING','READY'/);
  });
  it('zapis wyłącznie dat w kontekście tower.dates_ctx; autor // KSH; DEC-4; I-10', () => {
    expect(m).toMatch(/set_config\('tower\.dates_ctx', 'on', true\)/);
    expect(m).toMatch(/' \/\/ KSH'/);
    expect(m).toMatch(/matrix_notify\('LOAD_STATUS', 'PLAN_DATES_CHANGED'/);
    expect(m).toMatch(/SCHEDULE_DATE_CRITICAL/);
    expect(m).not.toMatch(/grant [^;]*update[^;]* on (public\.)?loads/i);
  });
});
