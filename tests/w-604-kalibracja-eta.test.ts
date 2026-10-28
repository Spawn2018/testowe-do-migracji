import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ETA_CALIBRATION_AUTO, calibErrorKey, calibPathOf, calibVersionOf, calibVersionStatus, etaCalibAutoNotice,
  etaCalibDecisionLine, maxChangePct, undoVisible, undoableVersionId, versionsAfterUndo,
} from '../src/lib/etaCalibAuto';
import { notificationFromRow } from '../src/data/mappers';
import { bellPlace, bellSection } from '../src/lib/bellList';
import { parseRoute } from '../src/lib/routes';
import { dbErrorKey, etaDbErrorKey } from '../src/lib/carrierDecision';
import { DEC_I18N, decOptText } from '../src/i18n/decisions';
import { hasKey, t } from '../src/i18n/messages';
import { calibErrText, calibFromDb } from '../src/auth/LiveCalib';
import { EtaCalibScreen } from '../src/components/options/EtaCalibScreen';
import { demoCalibrationUndo } from '../src/lib/etaCalibDemo';
import type { CalibVersion, EtaCalibration } from '../src/lib/etaCalibSource';

/**
 * W-604 (#581 P4-k cz. 2, migracja 0320): kalibracja ETA ciągła — powiadomienie `ETA_CALIBRATION_AUTO` w dzwonku
 * (tylko HHL_ADMIN, po polsku), stany wersji i „Cofnij” na ekranie Kalibracji ETA, decyzja `ETA_CALIBRATION_APPROVAL`.
 */
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('W-604 dzwonek: ETA_CALIBRATION_AUTO', () => {
  const payload = {
    version: 17, undo_version: 17, max_change_pct: 12.4, codes: ['SE_BREAKS', 'SE_ROAD'], matrix_event: 'eta_calib', locale: 'en',
    title: 'Kalibracja ETA zastosowana automatycznie', summary: 'Zastosowano wersję 17 (zmiana do 12.4%, kody: SE_BREAKS, SE_ROAD). Możesz cofnąć.',
  };
  const row = { id: 501, template: ETA_CALIBRATION_AUTO, load_id: null, created_at: '2026-10-28T06:10:00Z', read_at: null, payload };

  it('tytuł i treść z liczb po polsku (także przy locale=en — decyzja 8A); nazwy odcinków zamiast kodów', () => {
    const n = etaCalibAutoNotice(payload);
    expect(n.subject).toBe('Kalibracja ETA zastosowana automatycznie');
    expect(n.body).toBe('Wersja 17 · zmiana do 12,4% · odcinki: przerwy, Droga SE');
    expect(n.subject + n.body).not.toMatch(/ETA_CALIBRATION_AUTO/);
  });
  it('etykiety z eta_segment_params mają pierwszeństwo; nieznany kod zostaje kodem', () => {
    expect(etaCalibAutoNotice({ ...payload, codes: ['SE_ROAD', 'NEW_SEG'] }, { SE_ROAD: 'Droga SE: Nynäshamn → Boden' }).body)
      .toBe('Wersja 17 · zmiana do 12,4% · odcinki: Droga SE: Nynäshamn → Boden, NEW_SEG');
  });
  it('#616 D3: nazwy odcinków z payload.labels (0327); argument ma pierwszeństwo; zły kształt ignorowany', () => {
    expect(etaCalibAutoNotice({ ...payload, codes: ['SE_ROAD'], labels: { SE_ROAD: 'Droga SE z bazy' } }).body)
      .toContain('odcinki: Droga SE z bazy');
    expect(etaCalibAutoNotice({ ...payload, codes: ['SE_ROAD'], labels: { SE_ROAD: 'z bazy' } }, { SE_ROAD: 'z argumentu' }).body)
      .toContain('odcinki: z argumentu');
    expect(etaCalibAutoNotice({ ...payload, codes: ['SE_ROAD'], labels: ['x'] }).body).toContain('odcinki: Droga SE');
  });
  it('#619: SE_ROAD_KAA_INLAND ma krótką nazwę (bez etykiet z bazy)', () => {
    expect(etaCalibAutoNotice({ ...payload, codes: ['SE_ROAD_KAA_INLAND'] }).body)
      .toBe('Wersja 17 · zmiana do 12,4% · odcinki: Droga SE (Karlskrona, śródlądowa)');
  });
  it('bez liczb — summary z bazy; bez niczego — zdanie zamiast pustki', () => {
    expect(etaCalibAutoNotice({ summary: 'Zastosowano wersję 3.' }).body).toBe('Zastosowano wersję 3.');
    expect(etaCalibAutoNotice({}).body).toMatch(/Otwórz Kalibrację ETA/);
  });
  it('wiersz bazy → powiadomienie: „Moje transporty”, miejsce „Opcje”, adres ekranu kalibracji z wersją', () => {
    const n = notificationFromRow(row, 'en');
    expect(n.title).toBe('Kalibracja ETA zastosowana automatycznie');
    expect(n.body).toBe('Wersja 17 · zmiana do 12,4% · odcinki: przerwy, Droga SE');
    expect(n.kind).toBe(ETA_CALIBRATION_AUTO);
    expect(n.href?.path).toBe('/opcje/kalibracja-eta?wersja=17');
    expect(n.href?.allowed).toBe(true);
    expect(bellSection({ kind: n.kind, loadId: n.loadId, severity: n.severity, href: n.href })).toBe('mine');
    expect(bellPlace({ loadId: n.loadId, href: n.href })).toBe('options');
  });
  it('wersja tylko z tego szablonu; adres bez wersji, gdy jej brak', () => {
    expect(calibVersionOf('KSH_IMPORT_SUMMARY', { version: 3 })).toBeUndefined();
    expect(calibVersionOf(ETA_CALIBRATION_AUTO, { version: '9' })).toBe(9);
    expect(calibPathOf(undefined)).toBe('/opcje/kalibracja-eta');
  });
  it('„wersja” jednorazowa — nie przechodzi do kolejnych adresów; katalog „Kto co dostaje” zna eta_calib', async () => {
    const { carrySearch } = await import('../src/hooks/useRouteSync');
    expect(carrySearch('?wersja=17')).toBe('');
    const { NOTIFY_CATALOG } = await import('../src/lib/notifyCatalog');
    const row = NOTIFY_CATALOG.flatMap((g) => g.rows).find((r) => r.id === 'eta_calib');
    expect(row?.cells.HHL_ADMIN).toBeTruthy();
    expect(row?.cells.HHL_OPS).toBeNull();
    expect(row?.cells.CLIENT_USER).toBeNull();
  });
  it('adres /opcje/kalibracja-eta → Opcje, ekran Kalibracja ETA', () => {
    expect(parseRoute('/opcje/kalibracja-eta')).toEqual({ kind: 'options', section: 'kalibracja-eta' });
    const view = read('src/views/OptionsView.tsx');
    expect(view).toMatch(/r\.section === 'kalibracja-eta' \? 'calib'/);
    expect(view).toMatch(/get\('wersja'\)/);
  });
  it('bez wpisu w szablonach e-maili (rejestr click-targets i p8-texts bez zmian)', () => {
    expect(read('supabase/functions/_shared/notifyTemplates.ts')).not.toMatch(/ETA_CALIBRATION_AUTO/);
    expect(read('src/lib/bellList.ts')).toMatch(/INFO_NOLOAD_KINDS = new Set\(\[[^\]]*'ETA_CALIBRATION_AUTO'/);
  });
});

describe('W-604 błędy funkcji kalibracji → zdania po polsku', () => {
  const cases: Array<[{ code?: string; message: string }, string]> = [
    [{ code: '42501', message: 'ETA_NOT_ADMIN' }, 'NOT_ADMIN'],
    [{ code: 'P0001', message: 'ETA_APPLY_NEWER' }, 'APPLY_NEWER'],
    [{ code: 'P0001', message: 'ETA_UNDO_NEWER' }, 'UNDO_NEWER'],
    [{ code: 'P0001', message: 'ETA_CALIB_BUSY' }, 'BUSY'],
    [{ code: 'P0001', message: 'ETA_FROZEN' }, 'FROZEN'],
    [{ code: 'P0001', message: 'kalibracja zamrożona — zmiany wstrzymane' }, 'FROZEN'],
    [{ code: 'P0001', message: 'ETA_UNDO_MISSING' }, 'UNDO_MISSING'],
    [{ code: 'P0001', message: 'ETA_APPLY_UNDONE' }, 'UNDONE'],
    [{ code: 'P0001', message: 'wersja cofnięta — nie stosuję' }, 'UNDONE'],
    [{ code: 'P0001', message: 'ETA_APPLY_MISSING' }, 'APPLY_MISSING'],
  ];
  it('ekran: kod → klucz cal_err_*, każdy klucz w słowniku, tekst bez kodu bazy', () => {
    for (const [e, c] of cases) {
      expect(calibErrorKey(e)).toBe(`cal_err_${c}`);
      expect(hasKey('pl', `cal_err_${c}`)).toBe(true);
      expect(calibErrText('pl', e)).not.toMatch(/ETA_|^Nie udało się: /);
    }
    expect(calibErrorKey({ message: 'permission denied' })).toBeNull();
    expect(calibErrText('pl', { message: 'permission denied' })).toMatch(/^Nie udało się: /);
  });
  it('decyzja: ten sam kod → dec_err_ETA_*; ETA_NOT_ADMIN (42501) przed ogólnym „brak uprawnień”', () => {
    for (const [e, c] of cases) {
      expect(dbErrorKey(e)).toBe(`dec_err_ETA_${c}`);
      expect(etaDbErrorKey(e)).toBe(`dec_err_ETA_${c}`);
      expect(DEC_I18N.pl[`dec_err_ETA_${c}`]).toBeTruthy();
    }
    expect(dbErrorKey({ code: '42501', message: 'forbidden' })).toBe('dec_err_forbidden');
    expect(etaDbErrorKey({ code: '22023', message: 'Nieznany typ decyzji X' })).toBeNull();
    /* ogólne rozstrzygnięcie: tylko błędy kalibracji tłumaczone, reszta komunikatu bazy bez zmian */
    expect(read('src/components/risks/useDecisions.ts')).toMatch(/call\.fn === 'decision_resolve' \? etaDbErrorKey\(e\) : dbErrorKey\(e\)/);
  });
  it('kody z migracji 0320 (raise exception ETA_*) mają tłumaczenie — poza słownikiem tras', () => {
    const sql = read('supabase/migrations/0320_581_p4k_eta_calib_continuous.sql');
    const codes = [...new Set([...sql.matchAll(/raise exception '(ETA_[A-Z_]+)'/g)].map((m) => m[1]))].filter((c) => !c.startsWith('ETA_DICT_'));
    expect(codes.length).toBeGreaterThanOrEqual(8);
    for (const c of codes) expect(calibErrorKey({ message: c }), c).not.toBeNull();
  });
});

describe('W-604 stan wersji', () => {
  const base = { created_by: null, applied: false, undone_at: null, rejected_at: null, note: null };
  const pa = { SE_ROAD: { hours: 15, spread_pct: 12 } };
  const pb = { SE_ROAD: { hours: 17, spread_pct: 12 } };
  it('zastosowana / cofnięta / odrzucona / zastąpiona / oczekuje (auto ≤ 15 %, decyzja HHL > 15 %)', () => {
    expect(calibVersionStatus({ ...base, id: 1, applied: true })).toBe('applied');
    expect(calibVersionStatus({ ...base, id: 2, applied: true, undone_at: '2026-10-28T08:00:00Z', note: 'auto-applied; undone' })).toBe('undone');
    expect(calibVersionStatus({ ...base, id: 3, rejected_at: '2026-10-28T08:00:00Z', note: 'propozycja ciągła; rejected' })).toBe('rejected');
    expect(calibVersionStatus({ ...base, id: 4, rejected_at: '2026-10-28T08:00:00Z', note: 'propozycja ciągła n=7; superseded' })).toBe('superseded');
    expect(calibVersionStatus({ ...base, id: 5, note: 'propozycja ciągła n=10', params_before: pb, params_after: pa, n_obs: 10, error_before_min: 60, error_after_min: 30 })).toBe('pending_auto');
    expect(calibVersionStatus({ ...base, id: 6, note: 'propozycja ciągła n=7', params_before: pb, params_after: { SE_ROAD: { hours: 13 } } })).toBe('pending_decision');
    expect(calibVersionStatus({ ...base, id: 7, created_by: 'u1', note: 'ręcznie' })).toBe('pending');
  });
  it('F7 r1 B2: auto tylko gdy baza zastosuje — n_obs ≥ 10, test wsteczny poprawia błąd, bez zamrożenia; inaczej „oczekuje”', () => {
    const ok = { ...base, id: 5, note: 'propozycja ciągła', params_before: pb, params_after: pa, n_obs: 10, error_before_min: 60, error_after_min: 30 };
    expect(calibVersionStatus(ok)).toBe('pending_auto');
    expect(calibVersionStatus({ ...ok, n_obs: 7 })).toBe('pending');
    expect(calibVersionStatus({ ...ok, n_obs: null })).toBe('pending');
    expect(calibVersionStatus(ok, true)).toBe('pending');
    expect(calibVersionStatus({ ...ok, error_after_min: 60 })).toBe('pending');
    expect(calibVersionStatus({ ...ok, error_before_min: null })).toBe('pending_auto');
    /* próg na surowej wartości: 15,04 % > 15 % (po zaokrągleniu byłoby 15,0) — decyzja, także przy n_obs < 10 i zamrożeniu */
    const p1504 = { ...ok, params_before: { A: { hours: 100 } }, params_after: { A: { hours: 115.04 } } };
    expect(maxChangePct(p1504)).toBe(15);
    expect(calibVersionStatus(p1504)).toBe('pending_decision');
    expect(calibVersionStatus({ ...p1504, n_obs: 7 }, true)).toBe('pending_decision');
    expect(calibVersionStatus({ ...ok, params_before: { A: { hours: 100 } }, params_after: { A: { hours: 115 } } })).toBe('pending_auto');
  });
  it('calibFromDb: zamrożenie z ekranu → propozycja ≤ 15 % „oczekuje”; > 15 % — bez „Zatwierdź”, zdanie o decyzji', () => {
    const params = [{ code: 'SE_ROAD', label: 'Droga SE', hours: 17 }];
    const row = (o: Record<string, unknown>) => ({
      id: 12, created_at: '2026-10-20T00:00:00Z', created_by: null, params_after: pa, params_before: pb, n_obs: 10,
      error_before_min: 60, error_after_min: 30, applied: false, frozen: false, note: 'propozycja ciągła n=10', undone_at: null, rejected_at: null, ...o,
    }) as Parameters<typeof calibFromDb>[2][number];
    expect(calibFromDb('pl', params, [], [row({})], [], () => 'a', true).versions[0].status).toBe('pending');
    expect(calibFromDb('pl', params, [], [row({})], [], () => 'a').proposal?.awaitsDecision).toBe(false);
    const big = calibFromDb('pl', params, [], [row({ params_after: { SE_ROAD: { hours: 13 } } })], [], () => 'a');
    expect(big.proposal?.awaitsDecision).toBe(true);
    const h = renderToStaticMarkup(createElement(EtaCalibScreen, { locale: 'pl', data: big, onApprove: async () => ({ ok: true }) }));
    expect(h).not.toMatch(/data-cal-approve/);
    expect(h).toContain('Czeka na decyzję Administratora HHL w Ryzykach.');
    expect(read('src/auth/LiveCalib.tsx')).toMatch(/\}, db\.frozen\) : null\)/);
  });
  it('zmiana jak w bazie: godziny względnie, rozrzut w punktach procentowych', () => {
    expect(maxChangePct({ params_before: pb, params_after: pa })).toBe(11.8);
    expect(maxChangePct({ params_before: { A: { hours: 10, spread_pct: 10 } }, params_after: { A: { hours: 10, spread_pct: 30 } } })).toBe(20);
    expect(maxChangePct({ params_before: null, params_after: pa })).toBeNull();
  });
  it('do cofnięcia: najnowsza zastosowana i niecofnięta', () => {
    expect(undoableVersionId([
      { ...base, id: 3, applied: true }, { ...base, id: 9, applied: true, undone_at: 'x' }, { ...base, id: 5, applied: true }, { ...base, id: 11 },
    ])).toBe(5);
    expect(undoableVersionId([{ ...base, id: 2 }])).toBeNull();
  });
  it('calibFromDb: wszystkie wersje ze stanem, numer = id; propozycja pomija cofnięte, odrzucone i zastąpione', () => {
    const params = [{ code: 'SE_ROAD', label: 'Droga SE', hours: 17 }];
    const v = (o: Record<string, unknown>) => ({
      created_at: '2026-10-20T00:00:00Z', created_by: null, params_after: pa, params_before: pb, n_obs: 10,
      error_before_min: 60, error_after_min: 30, applied: false, frozen: false, note: null, undone_at: null, rejected_at: null, ...o,
    }) as Parameters<typeof calibFromDb>[2][number];
    const c = calibFromDb('pl', params, [], [
      v({ id: 4, applied: true, note: 'propozycja ciągła n=9; auto-applied' }),
      v({ id: 6, applied: true, undone_at: '2026-10-27T00:00:00Z', note: 'auto-applied; undone' }),
      v({ id: 8, rejected_at: '2026-10-27T00:00:00Z', note: 'propozycja ciągła; superseded' }),
      v({ id: 9, rejected_at: '2026-10-27T00:00:00Z', note: 'rejected' }),
    ], [], () => 'automat');
    expect(c.versions.map((x) => [x.no, x.status, x.current, x.undoable])).toEqual([
      [9, 'rejected', false, false], [8, 'superseded', false, false], [6, 'undone', false, false], [4, 'applied', true, true],
    ]);
    /* dopiski bazy w note nie są opisem wersji */
    expect(c.versions[3].what).toBe('nowe czasy odcinków: Droga SE 15 h');
    expect(c.proposal).toBeNull();
    const d = calibFromDb('pl', params, [], [v({ id: 4, applied: true }), v({ id: 12, note: 'propozycja ciągła n=10' })], [], () => 'automat');
    expect(d.proposal?.id).toBe('12');
    expect(d.versions[0].status).toBe('pending_auto');
  });
  it('select wersji dociąga undone_at, rejected_at i params_before; Cofnij → eta_calibration_undo', () => {
    const live = read('src/auth/LiveCalib.tsx');
    expect(live).toMatch(/params_before,params_after,[^']*undone_at,rejected_at/);
    expect(live).toMatch(/sb\.rpc\('eta_calibration_undo', \{ p_version: Number\(id\) \}\)/);
    expect(live).toMatch(/onUndo=\{readOnly \? null : undo\}/);
  });
  it('każdy stan ma etykietę', () => {
    for (const s of ['undone', 'rejected', 'superseded', 'pending_auto', 'pending_decision', 'pending', 'applied']) expect(hasKey('pl', `cal_st_${s}`)).toBe(true);
  });
});

describe('W-604 „Cofnij” — tylko HHL_ADMIN, potwierdzenie na stronie', () => {
  const ver = (o: Partial<CalibVersion>): CalibVersion => ({ id: 'x', no: 1, at: '2026-10-20T08:00:00Z', by: 'automat', what: 'nowe czasy', ...o });
  const data: EtaCalibration = {
    needed: 5, observations: [], segments: [], proposal: null,
    versions: [
      ver({ id: '12', no: 12, status: 'pending_decision' }),
      ver({ id: '10', no: 10, status: 'applied', current: true, undoable: true }),
      ver({ id: '7', no: 7, status: 'undone' }),
    ],
  };
  const html = (o: Record<string, unknown>) => renderToStaticMarkup(createElement(EtaCalibScreen, { locale: 'pl', data, onApprove: null, ...o }));
  const undo = async () => ({ ok: true });

  it('administrator: jeden przycisk przy obowiązującej wersji; inne konta i brak zapisu — bez przycisku', () => {
    const admin = html({ onUndo: undo });
    expect(admin.match(/data-cal-undo="true"/g)?.length).toBe(1);
    expect(admin).toMatch(/data-cal-ver-id="10"[^>]*>(?:(?!<\/li>).)*data-cal-undo="true"/s);
    expect(html({ onUndo: undo, readOnly: true })).not.toMatch(/data-cal-undo/);
    expect(html({ onUndo: null })).not.toMatch(/data-cal-undo/);
  });
  it('zasada widoczności: tylko zastosowana, do cofnięcia, z zapisem, nie tylko do odczytu', () => {
    expect(undoVisible({ canUndo: true, undoable: true, status: 'applied' })).toBe(true);
    expect(undoVisible({ canUndo: true, undoable: true, status: 'undone' })).toBe(false);
    expect(undoVisible({ canUndo: true, undoable: false, status: 'applied' })).toBe(false);
    expect(undoVisible({ canUndo: false, undoable: true })).toBe(false);
    expect(undoVisible({ readOnly: true, canUndo: true, undoable: true })).toBe(false);
  });
  it('zamrożenie nie blokuje cofnięcia — przycisk zostaje, zdanie mówi, że można', () => {
    const f = html({ onUndo: undo, frozen: true });
    expect(f).toMatch(/data-cal-undo="true"/);
    expect(f).toContain('Kalibracja zamrożona — cofnąć wersję nadal można.');
  });
  it('stany na liście: znaczniki przy numerze; podświetlenie wersji z dzwonka', () => {
    const h = html({ onUndo: undo, highlight: '7' });
    expect(h).toContain('data-cal-tag="pending_decision"');
    expect(h).toContain('oczekuje na decyzję HHL (zmiana &gt; 15%)');
    expect(h).toContain('data-cal-tag="undone"');
    expect(h).toMatch(/data-cal-ver-id="7"[^>]*class="cal-ver-hl"/);
  });
  it('potwierdzenie w panelu na stronie, nie confirm(); fokus: „Anuluj” w panelu, potem nagłówek listy albo komunikat', () => {
    const src = read('src/components/options/EtaCalibScreen.tsx');
    expect(src).toMatch(/autoFocus onClick=\{cancelUndo\} data-cal-undo-no/);
    expect(src).toMatch(/<h3 ref=\{verHeadRef\} tabIndex=\{-1\}/);
    expect(src).toMatch(/tabIndex=\{-1\} ref=\{undoErrRef\}/);
    expect(src).toMatch(/failed \? undoErrRef\.current : verHeadRef\.current/);
    expect(src).toMatch(/data-cal-undo-ask/);
    expect(src).not.toMatch(/window\.confirm|\bconfirm\(/);
  });
  it('demo: cofnięcie w pamięci — wersja cofnięta, obowiązuje poprzednia; startowej nie da się cofnąć', async () => {
    expect((await demoCalibrationUndo('cal-v2')).ok).toBe(true);
    expect((await demoCalibrationUndo('cal-v1')).ok).toBe(false);
    const after = versionsAfterUndo([
      ver({ id: 'cal-v2', no: 2, current: true, status: 'applied', undoable: true }),
      ver({ id: 'cal-v1', no: 1, status: 'applied' }),
    ], new Set(['cal-v2']));
    expect(after.map((v) => [v.id, v.status, v.current ?? false])).toEqual([['cal-v2', 'undone', false], ['cal-v1', 'applied', true]]);
  });
});

describe('W-604 decyzja ETA_CALIBRATION_APPROVAL', () => {
  it('historia: opcja APPLY/REJECT z etykietą typu decyzji; bez typu — ogólne słowo', () => {
    expect(decOptText('pl', 'APPLY', 'ETA_CALIBRATION_APPROVAL')).toBe('Zastosuj nowe czasy odcinków');
    expect(decOptText('pl', 'REJECT', 'ETA_CALIBRATION_APPROVAL')).toBe('Odrzuć propozycję');
    expect(decOptText('pl', 'REJECT', 'KSH_DATE_COUNTER')).toBe('Odrzucam — zostaje data KSH');
    expect(decOptText('pl', 'APPLY')).toBe('Zastosuj');
    expect(decOptText('pl', 'ACCEPT', 'ETA_CALIBRATION_APPROVAL')).toBe('Przyjmuję');
    expect(read('src/lib/p6History.ts')).toMatch(/decOptText\(locale, opt, str\(p\.type\)/);
  });
  it('karta: wersja i największa zmiana z detail', () => {
    expect(etaCalibDecisionLine('ETA_CALIBRATION_APPROVAL', { version: 21, max_change_pct: 18.4, action: 'apply_eta_calibration_version' }))
      .toBe('Wersja 21 · zmiana do 18,4%');
    expect(DEC_I18N.pl.dec_eta_calib_title).toBe('Kalibracja ETA');
    expect(etaCalibDecisionLine('KSH_DATE_COUNTER', { version: 21 })).toBeNull();
    expect(etaCalibDecisionLine('ETA_CALIBRATION_APPROVAL', {})).toBeNull();
    expect(read('src/components/risks/TodoCard.tsx')).toMatch(/data-rk-eta-calib>\{etaCalibDecisionLine\(d\.typeCode, d\.detail\)\}/);
  });
  it('akcje audytu z 0320 mają opis w Historii zmian', () => {
    const sql = read('supabase/migrations/0320_581_p4k_eta_calib_continuous.sql');
    const actions = [...new Set([...sql.matchAll(/insert into audit_log[^;]*?values\s*\([^']*'([A-Z_]+)'/gs)].map((m) => m[1]))];
    expect(actions).toEqual(expect.arrayContaining(['ETA_CALIBRATION_APPLY', 'ETA_CALIBRATION_UNDO', 'ETA_ROUTE_DICT_UPSERT']));
    for (const a of actions) expect(hasKey('pl', `p3l_a_${a}`), a).toBe(true);
    expect(t('pl', 'p3l_a_ETA_CALIBRATION_UNDO')).toBe('Kalibracja ETA: wersja cofnięta');
  });
});
