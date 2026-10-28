/*
 * wyglad/W-opcje-live-1 — Opcje na produkcji w wyglądzie z audytu (E6, E11, E12, E15, E37): te same ekrany co w demo,
 * dane i zapisy przez RPC dawnych formularzy. Partia 1: Użytkownicy, Logowania, Komunikat, Progi, Historia, Eksport,
 * Przełączniki bezpieczeństwa, Kalibracja ETA; stany w menu i na kafelkach z bazy.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasKey } from '../src/i18n/messages';
import { lastLoginByEmail, userCounts } from '../src/auth/LiveUsers';
import { loginOk, loginRows } from '../src/auth/LiveLogins';
import { firmsOf } from '../src/auth/LiveBroadcast';
import { LIVE_THRESHOLD_ORDER, thresholdRows } from '../src/auth/LiveThresholds';
import { historyText, isTech } from '../src/auth/LiveHistory';
import { loadsInRange } from '../src/auth/LiveExport';
import { flagRows, flagRpc } from '../src/auth/LiveFlags';
import { calibFromDb } from '../src/auth/LiveCalib';
import { kindOf, personName } from '../src/auth/liveOpts';
import type { Load } from '../src/types';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const person = (o: Record<string, unknown>) => ({
  id: 'u1', email: 'a@x.pl', full_name: null, first_name: null, last_name: null, phone: null, role: 'HHL_ADMIN', active: true, org_id: 'o', ...o,
}) as never;

describe('Opcje na produkcji — podłączenie ekranów', () => {
  it('OptionsView ładuje ekrany Live* zamiast dawnych formularzy; Operacje HHL tylko odczyt', () => {
    const v = read('src/views/OptionsView.tsx');
    for (const f of ['LiveUsers', 'LiveLogins', 'LiveBroadcast', 'LiveThresholds', 'LiveHistory', 'LiveExport', 'LiveFlags', 'LiveCalib']) {
      expect(v, f).toContain(`import('../auth/${f}')`);
    }
    for (const f of ['UsersAdmin', 'AuthLoginLog', 'BroadcastForm', 'ChangeHistoryPanel', 'DataExportPanel']) {
      expect(v, f).not.toContain(`import('../auth/${f}')`);
    }
    expect(v).toContain("lazy(lazyRetry(() => import('../auth/LiveThresholds')))");
    expect(v).toContain('block(<SecurityFlags readOnly={ro} />)');
    /* W-604: wersja wskazana z dzwonka (`?wersja=N`) */
    expect(v).toContain('block(<LiveCalib readOnly={ro} highlight={calibFocus} />)');
    expect(v).toContain('block(<DataExportPanel admin={isHhlAdmin} />)');
    expect(v).not.toContain("scr('flags', pick('flags', null)");
  });
  it('stany w menu i na kafelkach: demo albo z bazy, odświeżane po zapisie', () => {
    const v = read('src/views/OptionsView.tsx');
    expect(v).toContain('meta: demo?.meta[id]?.meta ?? liveMeta?.meta[id]?.meta');
    expect(v).toContain('demo?.summaries[g.id] ?? liveMeta?.summaries[g.id]');
    expect(v).toContain('window.addEventListener(OPTIONS_CHANGED_EVENT, load)');
  });
  it('zapisy tymi samymi RPC co dawne formularze', () => {
    const u = read('src/auth/LiveUsers.tsx');
    for (const fn of ['admin_invite_user', 'admin_set_user_role', 'admin_set_user_active', 'revoke_user_sessions', 'admin_impersonate_start', 'admin_revoke_invite']) {
      expect(u, fn).toContain(`'${fn}'`);
    }
    expect(u).toContain('sendInviteMagicLink(');
    expect(read('src/auth/LiveBroadcast.tsx')).toMatch(/'admin_broadcast_set'[\s\S]*'admin_broadcast_clear'/);
    expect(read('src/auth/LiveThresholds.tsx')).toContain("'admin_ops_threshold_set'");
    expect(read('src/auth/LiveHistory.tsx')).toContain("'admin_audit_history'");
    expect(read('src/auth/LiveLogins.tsx')).toContain("'admin_auth_login_log'");
    expect(read('src/auth/LiveCalib.tsx')).toMatch(/'apply_eta_calibration_version'[\s\S]*'admin_set_eta_calibration_frozen'/);
    expect(read('src/auth/LiveFlags.tsx')).toContain("'security_flags_list'");
  });
  it('nowe teksty w słowniku', () => {
    for (const k of ['p3l_loading', 'p3l_inv_line', 'p3l_err', 'p3l_sum_people', 'p3l_sum_rules', 'p3l_sum_system', 'p3l_cal_note',
      'cal_frozen_on', 'cal_frozen_off', 'p3c_thr_SILENT_MIN_EMTRACK', 'p3c_thr_SILENT_MIN_EMTRACK_fx', 'p3l_a_SECURITY_FLAG_SET', 'p3l_e_app_users', 'p3l_col_action']) {
      expect(hasKey('pl', k), k).toBe(true);
    }
  });
});

describe('Użytkownicy i Logowania', () => {
  it('liczniki E6 z app_users', () => {
    expect(userCounts([
      person({ active: true, phone: '+48600000010', first_name: 'Anna', last_name: 'W' }),
      person({ id: 'u2', active: false, phone: '600', must_set_password: true }),
    ])).toEqual({ total: 2, active: 1, withPhone: 1, named: 1, noPassword: 1 });
  });
  it('ostatnie udane logowanie na osobę; nieudane pominięte', () => {
    const m = lastLoginByEmail([
      { created_at: '2026-10-20T08:00:00Z', email: 'A@x.pl', log_type: 'SESSION', action: 'login' },
      { created_at: '2026-10-21T08:00:00Z', email: 'a@x.pl', log_type: 'X', action: 'login_failed' },
      { created_at: '2026-10-19T08:00:00Z', email: 'a@x.pl', log_type: 'SESSION', action: 'login' },
    ]);
    expect(m.get('a@x.pl')).toBe('2026-10-20T08:00:00Z');
  });
  it('rodzaj konta: 7 ról bazy → 5 rodzajów; nazwa osoby', () => {
    expect(kindOf('CLIENT_ADMIN')).toBe('CLIENT_USER');
    expect(kindOf('CARRIER_USER')).toBe('CARRIER_USER');
    expect(personName({ full_name: null, first_name: 'Jan', last_name: 'Nowak', email: 'j@x' })).toBe('Jan Nowak');
    expect(personName({ full_name: null, first_name: null, last_name: null, email: 'j@x' })).toBe('j@x');
  });
  it('logowania: osoba z app_users, urządzenie, IP, wynik', () => {
    expect(loginOk({ action: 'login', log_type: 'SESSION' })).toBe(true);
    expect(loginOk({ action: 'token_refresh_failed', log_type: 'X' })).toBe(false);
    const r = loginRows([{ created_at: '2026-10-21T08:12:00Z', ip_address: '1.2.3.4', action: 'login', actor: '', log_type: 'SESSION', email: 'a@x.pl', user_agent: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36' }],
      [person({ first_name: 'Anna', last_name: 'Wiśniewska' })], 'ostatnie')[0];
    expect(r.who).toBe('Anna Wiśniewska');
    expect(r.kind).toBe('HHL_ADMIN');
    expect(r.where).toBe('Chrome · Windows · 1.2.3.4');
  });
});

describe('Komunikat, Progi, Historia, Eksport', () => {
  it('komunikat: firmy z flag', () => {
    expect(firmsOf({ for_forwarder: true, for_carrier: true, for_client: false })).toEqual(['HHL', 'SCX']);
  });
  it('progi: kolejność E12, cisza naczepy emtrack po ciszy GPS, bez dopłat i przełącznika 0/1', () => {
    const rows = thresholdRows([
      { key: 'SILENT_MIN_EMTRACK', value_num: '720', unit: 'min', label_pl: 'x' },
      { key: 'WAVE_M', value_num: '3.8', unit: 'm', label_pl: 'x' },
      { key: 'GUST_KN', value_num: 40, unit: 'kn', label_pl: 'x' },
      { key: 'SILENT_STOP_H', value_num: 3, unit: 'h', label_pl: 'x' },
      { key: 'DWELL_DAILY_EUR', value_num: 750, unit: 'EUR/d', label_pl: 'x' },
      { key: 'import_quiet_hours', value_num: 1, unit: 'flag', label_pl: 'x' },
      { key: 'NOWY_PROG', value_num: 2, unit: 'h', label_pl: 'Nowy' },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['WAVE_M', 'GUST_KN', 'SILENT_STOP_H', 'SILENT_MIN_EMTRACK', 'NOWY_PROG']);
    expect(rows[0].value).toBe(3.8);
    expect(rows[1].unit).toBe('węzłów');
    expect(LIVE_THRESHOLD_ORDER.indexOf('SILENT_MIN_EMTRACK')).toBe(LIVE_THRESHOLD_ORDER.indexOf('SILENT_STOP_H') + 1);
  });
  it('historia: zmiany techniczne, wpis zdaniem zamiast kodu', () => {
    expect(isTech('ROW_UPDATE')).toBe(true);
    expect(isTech('USER_ROLE_SET')).toBe(false);
    expect(historyText('pl', { action: 'SECURITY_FLAG_SET', entity: 'security_flags', entity_id: 'MFA_HHL_ADMIN' }, '')).toBe('Przełącznik bezpieczeństwa zmieniony · przełączniki: MFA_HHL_ADMIN');
    expect(historyText('pl', { action: 'NOWA_AKCJA', entity: 'x', entity_id: null }, '')).toBe('NOWA_AKCJA · x');
  });
  it('eksport: zakres dat załadunku; puste pola = wszystko', () => {
    const l = (id: string, d: string) => ({ id, plannedLoadDate: d }) as unknown as Load;
    const all = [l('a', '2026-10-01'), l('b', '2026-10-10'), l('c', '')];
    expect(loadsInRange(all, { from: '', to: '' }).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(loadsInRange(all, { from: '2026-10-05', to: '' }).map((x) => x.id)).toEqual(['b']);
  });
});

describe('Przełączniki bezpieczeństwa i Kalibracja ETA', () => {
  it('2FA, zezwolenia, SMS i wiadomości przez własne funkcje; reszta admin_security_flag_set', () => {
    expect(flagRpc('MFA_HHL_ADMIN', true)).toEqual({ fn: 'admin_set_mfa_enforcement', args: { p_enabled: true } });
    expect(flagRpc('PERMIT_REQUIRED_NON_STANDARD', false).fn).toBe('admin_set_permit_requirement');
    expect(flagRpc('SMS_ZONE_ENTER', true)).toEqual({ fn: 'admin_sms_zone_trigger_set', args: { p_key: 'SMS_ZONE_ENTER', p_enabled: true } });
    expect(flagRpc('EXTERNAL_MESSAGING', true).fn).toBe('admin_set_external_messaging');
    expect(flagRpc('TELM_RIO_LINKS', false)).toEqual({ fn: 'admin_security_flag_set', args: { p_key: 'TELM_RIO_LINKS', p_enabled: false } }); // #446
    expect(flagRpc('TELM_EMTRACK_WEB', false)).toEqual({ fn: 'admin_security_flag_set', args: { p_key: 'TELM_EMTRACK_WEB', p_enabled: false } });
  });
  it('10 przełączników ekranu; usunięte klucze z bazy pominięte; autor z app_users albo „polecenie w bazie”', () => {
    const rows = flagRows([
      { key: 'H1_ROUTE_CHECK', enabled: false, note: null, updated_at: null, updated_by: null },
      { key: 'MFA_HHL_ADMIN', enabled: false, note: null, updated_at: '2026-09-27T19:25:00Z', updated_by: null },
      { key: 'EXTERNAL_MESSAGING', enabled: true, note: null, updated_at: '2026-10-02T16:43:00Z', updated_by: 'u1' },
    ], (id) => (id === 'u1' ? 'Anna Wiśniewska' : null));
    expect(rows.map((r) => r.key)).toEqual(['EXTERNAL_MESSAGING', 'MFA_HHL_ADMIN']);
    expect(rows[0].by).toBe('Anna Wiśniewska');
    expect(rows[1].by).toBeNull();
  });
  it('kalibracja: odcinki z eta_segment_params, pomiary SE z eta_segment_observations, propozycja z bazy', () => {
    const params = [
      { code: 'SE_ROAD', label: 'Droga SE', hours: 17 },
      { code: 'CROSSING_DEFAULT', label: 'Rejs', hours: 18 },
      { code: 'GPS_FRESH_MIN', label: 'świeża', hours: 1.5 },
    ];
    const obs = [1, 2, 3, 4, 5].map((i) => ({ id: i, load_id: `l${i}`, corridor: 'SE_E4', hours_observed: 20, exclude_reason: null, observed_at: `2026-10-0${i}T10:00:00Z` }));
    const none = calibFromDb('pl', params, obs, [], [], () => 'x');
    expect(none.segments.map((s) => s.code)).toEqual(['SE_ROAD', 'CROSSING_DEFAULT']);
    expect(none.segments[0]).toMatchObject({ verdict: 'propose', medianMin: 1200, n: 5 });
    expect(none.segments[1].verdict).toBe('fixed');
    expect(none.observations[0]).toMatchObject({ seMin: 1200, err24: null, plMin: null });
    expect(none.proposal).toBeNull();
    const withVer = calibFromDb('pl', params, obs, [{ id: 7, created_at: '2026-10-06T00:00:00Z', created_by: null, params_after: { SE_ROAD: { hours: 19 } }, n_obs: 5, error_before_min: 90, error_after_min: 30, applied: false, frozen: false, note: null }], [], () => 'x');
    expect(withVer.proposal).toMatchObject({ id: '7', errorBeforeMin: 90, errorAfterMin: 30 });
    expect(withVer.segments[0]).toMatchObject({ medianMin: 1140, verdict: 'propose' });
  });
});

/* F7 #414: blokada „w toku”, błędy po polsku, sygnał zmiany po każdym zapisie */
import { errText, makeOnce } from '../src/auth/liveOpts';
describe('F7 #414 — jedna operacja naraz i błędy', () => {
  it('drugie kliknięcie w trakcie zapisu nie startuje drugiej operacji (np. dwa e-maile z zaproszeniem)', async () => {
    const once = makeOnce();
    let calls = 0;
    let release!: () => void;
    const op = () => new Promise<void>((r) => { calls += 1; release = r; });
    const a = once.run(op);
    const b = once.run(op);
    expect(once.busy).toBe(true);
    expect(await b).toBeUndefined();
    release();
    await a;
    expect(calls).toBe(1);
    expect(once.busy).toBe(false);
    await once.run(async () => { calls += 1; });
    expect(calls).toBe(2);
  });
  it('po wyjątku blokada zwolniona', async () => {
    const once = makeOnce();
    await expect(once.run(async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(once.busy).toBe(false);
  });
  it('błąd bazy po polsku z prefiksem', () => {
    expect(errText('pl', { message: 'permission denied' })).toMatch(/^Nie udało się: /);
    expect(errText('pl', new Error('Invalid login credentials'))).toBe('Nie udało się: Nieprawidłowy e-mail lub hasło.');
  });
  it('ekrany: busy przy zapisach, try/catch w refresh, announceOptionsChanged po zapisie', () => {
    for (const f of ['LiveUsers', 'LiveThresholds', 'LiveFlags', 'LiveBroadcast', 'LiveCalib']) {
      const s = read(`src/auth/${f}.tsx`);
      expect(s, f).toContain('useBusy(');
      expect(s, f).toContain('void guard(async () => {');
      expect(s, f).toContain('busy');
    }
    for (const f of ['LiveUsers', 'LiveLogins', 'LiveBroadcast', 'LiveThresholds', 'LiveHistory', 'LiveFlags', 'LiveCalib']) {
      expect(read(`src/auth/${f}.tsx`), f).toMatch(/const refresh = useCallback\(async \(\) => \{\n    try \{/);
    }
    expect(read('src/auth/LiveThresholds.tsx').match(/announceOptionsChanged\(\)/g)?.length).toBe(2);
    /* W-604: zatwierdzenie, zamrożenie i cofnięcie wersji */
    expect(read('src/auth/LiveCalib.tsx').match(/announceOptionsChanged\(\)/g)?.length).toBe(3);
    expect(read('src/auth/LiveBroadcast.tsx').match(/announceOptionsChanged\(\)/g)?.length).toBe(2);
    expect(read('src/auth/LiveUsers.tsx')).not.toContain('void getSupabase().then(');
  });
});
