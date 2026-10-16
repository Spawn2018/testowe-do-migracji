/**
 * wyglad/push-telefon — „Sprawdź ten telefon” (D-20261015-1955-01, polecenie właściciela 15.10.2026, 19:43:
 * powiadomienia mają działać na każdym telefonie, także iPhone). Czysta logika: 5 kroków z ✓ / ✗ i podpowiedzią.
 * Ekran `DeviceScreen` podaje stan przeglądarki; tu nic nie wysyła ani nie zapisuje.
 */
import type { PushDevice, PushReason, PushTestResult } from './pushDeviceSource';

export type CheckState = 'ok' | 'bad' | 'todo' | 'na';
export type CheckKey = 'support' | 'home' | 'perm' | 'saved' | 'test';
export type Platform = 'ios' | 'android' | 'pc';

export interface PhoneEnv {
  /** Service Worker + PushManager + Notification w tej przeglądarce */
  supported: boolean;
  platform: Platform;
  /** uruchomione z ekranu początkowego */
  standalone: boolean;
  permission: 'granted' | 'denied' | 'default';
  /** to urządzenie jest na liście w Watch Tower */
  saved: boolean;
  /** wynik ostatniego testu na tym urządzeniu w tej sesji; `unknown` = wysłano, ale baza nie zbiera jeszcze potwierdzeń */
  test: 'ok' | 'bad' | 'none' | 'unknown';
}

export interface PhoneCheck {
  key: CheckKey;
  state: CheckState;
  /** klucz tekstu podpowiedzi albo null */
  hint: string | null;
}

const NA = (key: CheckKey): PhoneCheck => ({ key, state: 'na', hint: null });

/**
 * Kroki w kolejności. iPhone w karcie Safari nie ma powiadomień w ogóle — wtedy jedyny problem to „ekran początkowy”.
 * Gdy przeglądarka nie obsługuje powiadomień, dalsze kroki są „nie dotyczy”.
 */
export function phoneChecks(env: PhoneEnv): PhoneCheck[] {
  const ios = env.platform === 'ios';
  if (ios && !env.standalone) {
    return [NA('support'), { key: 'home', state: 'bad', hint: 'dev_ck_home_no' }, NA('perm'), NA('saved'), NA('test')];
  }
  const out: PhoneCheck[] = [];
  out.push({
    key: 'support',
    state: env.supported ? 'ok' : 'bad',
    hint: env.supported ? null : ios ? 'dev_ck_support_ios' : 'dev_ck_support_no',
  });
  if (ios) out.push({ key: 'home', state: 'ok', hint: null });
  if (!env.supported) {
    out.push(NA('perm'), NA('saved'), NA('test'));
    return out;
  }
  out.push({
    key: 'perm',
    state: env.permission === 'granted' ? 'ok' : env.permission === 'denied' ? 'bad' : 'todo',
    hint: env.permission === 'granted' ? null : env.permission === 'denied' ? 'dev_ck_perm_denied' : 'dev_ck_perm_default',
  });
  out.push({ key: 'saved', state: env.saved ? 'ok' : 'todo', hint: env.saved ? null : 'dev_ck_saved_no' });
  const bad = env.platform === 'ios' ? 'dev_ck_test_bad_ios' : env.platform === 'pc' ? 'dev_ck_test_bad_pc' : 'dev_ck_test_bad';
  out.push({
    key: 'test',
    state: env.test === 'ok' ? 'ok' : env.test === 'bad' ? 'bad' : 'todo',
    hint: env.test === 'ok' ? null
      : env.test === 'bad' ? bad
        : env.test === 'unknown' ? 'dev_ck_test_look'
          : env.saved ? 'dev_ck_test_none' : null,
  });
  return out;
}

/** Tekst powodu porażki testu. */
export function reasonKey(r: PushReason | undefined): string {
  switch (r) {
    case 'gone': return 'dev_r_gone';
    case 'auth': return 'dev_r_auth';
    case 'payload': return 'dev_r_payload';
    case 'service': return 'dev_r_service';
    case 'no_sub': return 'dev_r_no_sub';
    case 'network': return 'dev_r_network';
    default: return 'dev_fail';
  }
}

/** Sekundy od wysłania do potwierdzenia — tylko do opisu; null przy rozjechanych zegarach. */
export function ackDelaySec(sentAt: string, ackAt: string | null | undefined): number | null {
  if (!ackAt) return null;
  const a = Date.parse(ackAt);
  const s = Date.parse(sentAt);
  if (!Number.isFinite(a) || !Number.isFinite(s)) return null;
  const d = (a - s) / 1000;
  if (d < -2 || d > 120) return null;
  return Math.max(0, Math.round(d));
}

/** Potwierdzenie nowsze niż to, które urządzenie miało w chwili dotknięcia „Wyślij” (bez porównywania zegarów). */
export function isNewAck(base: string | null | undefined, now: string | null | undefined): boolean {
  if (!now) return false;
  if (!base) return true;
  if (now === base) return false;
  const a = Date.parse(now);
  const b = Date.parse(base);
  return Number.isFinite(a) && Number.isFinite(b) ? a > b : true;
}

/** Stan testu przy urządzeniu. `baseAck` = `last_ack_at` urządzenia w chwili dotknięcia. */
export type TestPhase =
  | { phase: 'sent'; sentAt: string; ack: boolean; baseAck: string | null }
  | { phase: 'acked'; sentAt: string; sec: number | null; at: string }
  | { phase: 'noack'; sentAt: string }
  | { phase: 'failed'; result: PushTestResult };

export function phaseAfterRefresh(prev: TestPhase, dev: PushDevice | undefined, elapsedMs: number, limitMs = 15000): TestPhase {
  if (prev.phase !== 'sent' || !prev.ack) return prev;
  const at = dev?.lastAck ?? null;
  if (at && isNewAck(prev.baseAck, at)) return { phase: 'acked', sentAt: prev.sentAt, sec: ackDelaySec(prev.sentAt, at), at };
  if (elapsedMs >= limitMs) return { phase: 'noack', sentAt: prev.sentAt };
  return prev;
}

/** „działa” tylko dla świeżego potwierdzenia (7 dni); starsze — sam opis bez zielonego. */
export function ackFresh(lastAck: string | null | undefined, nowMs: number, days = 7): boolean {
  if (!lastAck) return false;
  const a = Date.parse(lastAck);
  return Number.isFinite(a) && nowMs - a <= days * 86400000;
}
