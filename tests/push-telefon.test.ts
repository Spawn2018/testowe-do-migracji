/**
 * wyglad/push-telefon (D-20261015-1955-01): „Sprawdź ten telefon”, powód porażki testu, potwierdzenie odbioru.
 */
import { describe, expect, it } from 'vitest';
import { ackDelaySec, ackFresh, isNewAck, phaseAfterRefresh, phoneChecks, reasonKey, type PhoneEnv } from '../src/lib/phoneCheck';
import { pushTestResultOf, type PushDevice } from '../src/lib/pushDeviceSource';
import { P3C_I18N } from '../src/i18n/p3c';

const base: PhoneEnv = { supported: true, platform: 'android', standalone: false, permission: 'granted', saved: true, test: 'none' };

describe('phoneChecks — 5 kroków', () => {
  it('Android, wszystko gotowe, bez testu: 4 kroki, test do zrobienia z podpowiedzią', () => {
    const c = phoneChecks(base);
    expect(c.map((x) => x.key)).toEqual(['support', 'perm', 'saved', 'test']);
    expect(c.map((x) => x.state)).toEqual(['ok', 'ok', 'ok', 'todo']);
    expect(c[3]?.hint).toBe('dev_ck_test_none');
  });

  it('iPhone w karcie Safari (bez Push API): jedyny problem to ekran początkowy', () => {
    const c = phoneChecks({ ...base, platform: 'ios', supported: false, standalone: false });
    expect(c.map((x) => `${x.key}:${x.state}`)).toEqual(['support:na', 'home:bad', 'perm:na', 'saved:na', 'test:na']);
    expect(c[1]?.hint).toBe('dev_ck_home_no');
  });

  it('iPhone z ekranu początkowego: 5 kroków; bez Push API → „iOS 16.4”', () => {
    const c = phoneChecks({ ...base, platform: 'ios', standalone: true, test: 'ok' });
    expect(c.map((x) => x.state)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    const old = phoneChecks({ ...base, platform: 'ios', standalone: true, supported: false });
    expect(old[0]).toEqual({ key: 'support', state: 'bad', hint: 'dev_ck_support_ios' });
    expect(old.slice(2).every((x) => x.state === 'na')).toBe(true);
  });

  it('przeglądarka w aplikacji (bez Push API): ✗ i reszta nie dotyczy', () => {
    const c = phoneChecks({ ...base, supported: false });
    expect(c[0]).toEqual({ key: 'support', state: 'bad', hint: 'dev_ck_support_no' });
    expect(c.slice(1).every((x) => x.state === 'na')).toBe(true);
  });

  it('zgoda zablokowana i niezapisane urządzenie', () => {
    const c = phoneChecks({ ...base, permission: 'denied', saved: false });
    expect(c.find((x) => x.key === 'perm')).toEqual({ key: 'perm', state: 'bad', hint: 'dev_ck_perm_denied' });
    expect(c.find((x) => x.key === 'saved')?.state).toBe('todo');
    expect(c.find((x) => x.key === 'test')?.hint).toBeNull();
  });

  it('test wysłany bez potwierdzeń w bazie: „sprawdź ekran telefonu”; nieudany: wskazówka Samsunga', () => {
    expect(phoneChecks({ ...base, test: 'unknown' }).at(-1)?.hint).toBe('dev_ck_test_look');
    expect(phoneChecks({ ...base, test: 'bad' }).at(-1)).toEqual({ key: 'test', state: 'bad', hint: 'dev_ck_test_bad' });
    expect(phoneChecks({ ...base, platform: 'ios', standalone: true, test: 'bad' }).at(-1)?.hint).toBe('dev_ck_test_bad_ios');
    expect(phoneChecks({ ...base, platform: 'pc', test: 'bad' }).at(-1)?.hint).toBe('dev_ck_test_bad_pc');
  });
});

describe('powód porażki testu', () => {
  it('każdy powód ma polski tekst w słowniku', () => {
    for (const r of ['gone', 'auth', 'payload', 'service', 'no_sub', 'network', 'unknown', undefined] as const) {
      const k = reasonKey(r);
      expect(P3C_I18N.pl[k], `${String(r)} → ${k}`).toBeTruthy();
    }
    expect(reasonKey('network')).toBe('dev_r_network');
  });

  it('odpowiedź funkcji → wynik (N1), stara odpowiedź → „unknown”', () => {
    const now = '2026-10-15T18:00:00.000Z';
    expect(pushTestResultOf(true, { ok: true, sent_at: '2026-10-15T18:00:01.000Z' }, now)).toEqual({ ok: true, sentAt: '2026-10-15T18:00:01.000Z' });
    expect(pushTestResultOf(false, { ok: false, status: 410, reason: 'gone' }, now)).toEqual({ ok: false, reason: 'gone', sentAt: now });
    expect(pushTestResultOf(false, { ok: false, error: 'push_fail' }, now)).toEqual({ ok: false, reason: 'unknown', sentAt: now });
    expect(pushTestResultOf(false, null, now).reason).toBe('unknown');
    expect(pushTestResultOf(true, { ok: true }, now).sentAt).toBe(now);
    expect(pushTestResultOf(true, { ok: true, sent_at: 'zła data' }, now).sentAt).toBe(now);
  });
});

describe('potwierdzenie odbioru', () => {
  const sent = '2026-10-15T18:00:00.000Z';
  it('sekundy tylko do opisu; rozjechane zegary → bez sekund', () => {
    expect(ackDelaySec(sent, '2026-10-15T18:00:03.400Z')).toBe(3);
    expect(ackDelaySec(sent, '2026-10-15T17:59:59.000Z')).toBe(0);
    expect(ackDelaySec(sent, '2026-10-15T17:50:00.000Z')).toBeNull();
    expect(ackDelaySec(sent, '2026-10-15T18:10:00.000Z')).toBeNull();
    expect(ackDelaySec(sent, null)).toBeNull();
  });

  it('nowe potwierdzenie = nowsze niż to z chwili dotknięcia (bez zegara telefonu)', () => {
    expect(isNewAck(null, '2026-10-15T17:00:00.000Z')).toBe(true);
    expect(isNewAck('2026-10-15T17:00:00.000Z', '2026-10-15T17:00:00.000Z')).toBe(false);
    expect(isNewAck('2026-10-15T17:00:00.000Z', '2026-10-15T17:00:01.000Z')).toBe(true);
    expect(isNewAck('2026-10-15T17:00:00.000Z', null)).toBe(false);
  });

  it('po odświeżeniu listy: doszło / czekam / brak w ciągu 15 s', () => {
    const dev = (lastAck: string | null): PushDevice => ({ id: 'd', label: 'Android · Chrome', since: sent, active: true, lastAck, ackSupported: true });
    const p = { phase: 'sent' as const, sentAt: sent, ack: true, baseAck: '2026-10-14T08:00:00.000Z' };
    expect(phaseAfterRefresh(p, dev('2026-10-15T18:00:04.000Z'), 4000)).toEqual({ phase: 'acked', sentAt: sent, sec: 4, at: '2026-10-15T18:00:04.000Z' });
    /* zegar telefonu 10 min do tyłu: i tak „doszło”, tylko bez sekund */
    expect(phaseAfterRefresh(p, dev('2026-10-15T17:50:04.000Z'), 4000)).toEqual({ phase: 'acked', sentAt: sent, sec: null, at: '2026-10-15T17:50:04.000Z' });
    expect(phaseAfterRefresh(p, dev('2026-10-14T08:00:00.000Z'), 6000)).toBe(p);
    expect(phaseAfterRefresh(p, dev(null), 16000)).toEqual({ phase: 'noack', sentAt: sent });
    const plain = { phase: 'sent' as const, sentAt: sent, ack: false, baseAck: null };
    expect(phaseAfterRefresh(plain, dev(null), 60000)).toBe(plain);
  });

  it('„działa” tylko przy potwierdzeniu z ostatnich 7 dni', () => {
    const now = Date.parse(sent);
    expect(ackFresh('2026-10-14T18:00:00.000Z', now)).toBe(true);
    expect(ackFresh('2026-10-05T09:14:03+02:00', now)).toBe(false);
    expect(ackFresh(null, now)).toBe(false);
  });
});
