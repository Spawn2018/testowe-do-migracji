/**
 * wyglad/C — Dla mnie › Ten telefon / komputer (E5 img/e5-desk i img/e5-phone, prawa część „Powiadomienia na telefonie”;
 * E11 menu „Dla mnie”). Włączenie powiadomień na tym urządzeniu (ta sama logika co dotąd w „Wygląd i waluta”),
 * instrukcja dla iPhone’a i Androida, lista urządzeń z przyciskami „Wyślij powiadomienie testowe” i „Usuń urządzenie”.
 * Listę i oba przyciski daje `pushDeviceSource` — na produkcji podłącza je wykonawca (C2).
 *
 * wyglad/push-telefon (D-20261015-1955-01, polecenie właściciela 15.10.2026, 19:43 — „działa na każdym telefonie,
 * także iPhone”): „Sprawdź ten telefon” (5 kroków z ✓ / ✗ i podpowiedzią), wynik testu z powodem i potwierdzeniem
 * odbioru z telefonu, stan urządzenia „działa · potwierdzenie …”, wskazówki dla Samsunga, prośba o zgodę bez
 * czekania przed nią (iPhone: zgoda tylko od razu po dotknięciu).
 */
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import { formatListDateTime } from '../../lib/format';
import { pushDevicesOf, type PushDevice, type PushTestResult } from '../../lib/pushDeviceSource';
import { ackFresh, phaseAfterRefresh, phoneChecks, reasonKey, type PhoneEnv, type Platform, type TestPhase } from '../../lib/phoneCheck';
import { up } from './up';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';

/** Tylko build produkcyjny ładuje obsługę powiadomień (strażnik I-2: paczka demo bez klienta bazy). */
const loadWebPush = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? () => import('../../lib/webPush') : null;
type WebPushModule = Awaited<ReturnType<NonNullable<typeof loadWebPush>>>;

function browserSupportsPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function permissionNow(): PhoneEnv['permission'] {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  const p = Notification.permission;
  return p === 'granted' || p === 'denied' ? p : 'default';
}

function platformOf(ios: boolean): Platform {
  if (ios) return 'ios';
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) ? 'android' : 'pc';
}

function timeOf(iso: string): string {
  const s = formatListDateTime(iso);
  return s.includes(', ') ? s.split(', ')[1] ?? s : s;
}

const MARK: Record<'ok' | 'bad' | 'todo' | 'na', string> = { ok: '✓', bad: '✗', todo: '•', na: '–' };
const STATE_TEXT: Record<'ok' | 'bad' | 'todo' | 'na', string> = { ok: 'dev_ck_ok', bad: 'dev_ck_bad', todo: 'dev_ck_todo', na: 'dev_ck_na' };
const CHECK_LABEL: Record<string, string> = {
  support: 'dev_ck_support', home: 'dev_ck_home', perm: 'dev_ck_perm', saved: 'dev_ck_saved', test: 'dev_ck_test',
};

export function DeviceScreen({ locale }: { locale: Locale }) {
  const live = loadWebPush !== null;
  const src = pushDevicesOf();
  const [devices, setDevices] = useState<PushDevice[] | null>(src ? src.devices : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [perm, setPerm] = useState<PhoneEnv['permission']>(live ? permissionNow() : 'granted');
  const [tests, setTests] = useState<Record<string, TestPhase>>({});
  const [wpReady, setWpReady] = useState(false);
  /* chwila otwarcia ekranu — do oceny „świeżego” potwierdzenia (7 dni) */
  const [openedAt] = useState(() => Date.now());
  const wpRef = useRef<WebPushModule | null>(null);
  const alive = useRef(true);
  /* numer bieżącego testu na urządzeniu — starszy przebieg kończy się, gdy ktoś dotknie „Wyślij” jeszcze raz */
  const runs = useRef<Record<string, number>>({});

  useEffect(() => {
    alive.current = true;
    if (loadWebPush) {
      /* moduł ładowany od razu, żeby „Włącz powiadomienia” mógł poprosić o zgodę bez czekania (iPhone) */
      void loadWebPush().then((m) => {
        wpRef.current = m;
        setIos(m.isIosSafari());
        setStandalone(m.isStandalonePwa());
        setWpReady(true);
      }).catch(() => { /* brak modułu (np. po wdrożeniu nowej wersji) — przycisk zostaje nieaktywny */ });
    }
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const s = pushDevicesOf();
    if (!s?.refresh) return;
    void s.refresh().then((list) => { if (alive.current) setDevices(list); });
  }, []);

  const iosBlock = ios && !standalone;

  const turn = (on: boolean) => {
    const wp = wpRef.current;
    if (!wp) return;
    setBusy(true);
    /* iPhone: prośba o zgodę musi paść od razu po dotknięciu — bez `await` przed nią (D-20261015-1955-01 F10).
       Przycisk jest aktywny dopiero, gdy moduł jest wczytany, więc `enableWebPush()` startuje w tej samej chwili. */
    const started = on ? wp.enableWebPush() : wp.disableWebPush().then(() => ({ ok: true, reason: 'off' }));
    void (async () => {
      try {
        const r = await started;
        setMsg(!on ? t(locale, 'dev_off_ok')
          : r.ok ? t(locale, 'dev_on_ok')
            : r.reason === 'denied' ? t(locale, 'dev_denied')
              : r.reason === 'unsupported' ? t(locale, 'dev_unsupported')
                : r.reason === 'no_sw' ? t(locale, 'dev_r_no_sw')
                  : t(locale, 'dev_fail'));
      } catch {
        setMsg(t(locale, 'dev_fail'));
      }
      try {
        setPerm(permissionNow());
        const s = pushDevicesOf();
        if (s?.refresh) {
          const list = await s.refresh();
          if (alive.current) setDevices(list);
        }
      } catch { /* lista zostaje jak była */ } finally {
        if (alive.current) setBusy(false);
      }
    })();
  };

  const setPhase = (id: string, p: TestPhase) => setTests((x) => ({ ...x, [id]: p }));

  const runTest = (d: PushDevice) => {
    if (!src?.sendTest) return;
    const send = src.sendTest;
    const refresh = src.refresh;
    const run = (runs.current[d.id] ?? 0) + 1;
    runs.current[d.id] = run;
    const mine = () => alive.current && runs.current[d.id] === run;
    setBusy(true);
    setMsg(null);
    void (async () => {
      let res: PushTestResult;
      try {
        res = await send(d.id);
      } catch {
        res = { ok: false, reason: 'unknown', sentAt: new Date().toISOString() };
      }
      if (!mine()) return;
      if (!res.ok) {
        setPhase(d.id, { phase: 'failed', result: res });
        try {
          if ((res.reason === 'gone' || res.reason === 'no_sub') && refresh) {
            const list = await refresh();
            if (alive.current) setDevices(list);
          }
        } catch { /* lista zostaje jak była */ } finally {
          if (alive.current) setBusy(false);
        }
        return;
      }
      const watch = d.ackSupported === true && Boolean(refresh);
      let phase: TestPhase = { phase: 'sent', sentAt: res.sentAt, ack: watch, baseAck: d.lastAck ?? null };
      setPhase(d.id, phase);
      setBusy(false);
      if (!watch || !refresh) return;
      const t0 = Date.now();
      while (phase.phase === 'sent' && mine()) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!mine()) return;
        let list: PushDevice[] | null = null;
        try { list = await refresh(); } catch { list = null; }
        if (!mine()) return;
        if (list) setDevices(list);
        phase = phaseAfterRefresh(phase, list?.find((x) => x.id === d.id), Date.now() - t0);
        setPhase(d.id, phase);
      }
    })();
  };

  const remove = (d: PushDevice) => {
    if (!src?.remove) return;
    const rm = src.remove;
    setBusy(true);
    void (async () => {
      try {
        const ok = await rm(d.id);
        setMsg(ok ? t(locale, 'dev_removed') : t(locale, 'dev_fail'));
        if (ok) setDevices((xs) => (xs ?? []).filter((x) => x.id !== d.id));
      } catch {
        setMsg(t(locale, 'dev_fail'));
      } finally {
        if (alive.current) setBusy(false);
      }
    })();
  };

  const current = devices?.find((d) => d.current);
  const curTest = current ? tests[current.id] : undefined;
  const env: PhoneEnv = {
    supported: live ? browserSupportsPush() : true,
    platform: live ? platformOf(ios) : 'android',
    standalone,
    permission: perm,
    saved: Boolean(current),
    test: !curTest ? 'none'
      : curTest.phase === 'acked' ? 'ok'
        : curTest.phase === 'failed' || curTest.phase === 'noack' ? 'bad'
          : 'unknown',
  };
  const checks = phoneChecks(env);

  const testLine = (p: TestPhase | undefined): string | null => {
    if (!p) return null;
    if (p.phase === 'failed') return t(locale, reasonKey(p.result.reason));
    if (p.phase === 'noack') return t(locale, 'dev_t_noack');
    if (p.phase === 'acked') {
      return p.sec == null ? t(locale, 'dev_t_ack_plain').replace('{t}', timeOf(p.at))
        : t(locale, 'dev_t_ack').replace('{t}', timeOf(p.at)).replace('{s}', String(p.sec));
    }
    return p.ack ? t(locale, 'dev_t_wait').replace('{t}', timeOf(p.sentAt)) : t(locale, 'dev_test_ok');
  };

  const stateOf = (d: PushDevice): { cls: string; text: string } => {
    if (!d.ackSupported) return { cls: d.active ? 'ox-dev-on' : 'ox-dev-off', text: t(locale, d.active ? 'dev_active' : 'dev_inactive') };
    if (d.lastAck && ackFresh(d.lastAck, openedAt)) return { cls: 'ox-dev-on', text: t(locale, 'dev_ack_ok').replace('{d}', formatListDateTime(d.lastAck)) };
    if (d.lastAck) return { cls: 'ox-dev-off', text: t(locale, 'dev_ack_old').replace('{d}', formatListDateTime(d.lastAck)) };
    return { cls: 'ox-dev-off', text: t(locale, 'dev_ack_none') };
  };

  return (
    <section className="ox-panel ox-dev" data-screen="device">
      <header className="ox-panel-hd"><h3>{t(locale, 'dev_title')}</h3></header>
      <div className="ox-panel-bd">
        <p className="ox-panel-note ox-flush">{t(locale, 'dev_rule')}</p>

        <span className="ox-eyebrow">{up(t(locale, 'dev_ios'))}</span>
        <ol className="ox-dev-steps">
          {['dev_ios_1', 'dev_ios_2', 'dev_ios_3', 'dev_ios_4'].map((k, i) => (
            <li key={k}><span className="ox-dev-n">{i + 1}</span><span>{t(locale, k)}</span></li>
          ))}
        </ol>
        <span className="ox-eyebrow">{up(t(locale, 'dev_android'))}</span>
        <ol className="ox-dev-steps">
          <li><span className="ox-dev-n">1</span><span>{t(locale, 'dev_android_1')}</span></li>
        </ol>
        <span className="ox-eyebrow">{up(t(locale, 'dev_samsung'))}</span>
        <ol className="ox-dev-steps" data-dev-samsung>
          {['dev_samsung_1', 'dev_samsung_2', 'dev_samsung_3'].map((k, i) => (
            <li key={k}><span className="ox-dev-n">{i + 1}</span><span>{t(locale, k)}</span></li>
          ))}
        </ol>

        <div className="ox-dev-here">
          <span className="ox-eyebrow">{up(t(locale, 'dev_here'))}</span>
          <div className="ox-actions ox-actions-start">
            <button type="button" className="btn ox-btn" data-dev-on disabled={!live || !wpReady || busy || iosBlock} onClick={() => turn(true)}>{t(locale, 'dev_on')}</button>
            <button type="button" className="btn ghost ox-btn" data-dev-off disabled={!live || !wpReady || busy} onClick={() => turn(false)}>{t(locale, 'dev_off')}</button>
          </div>
          {iosBlock ? <p className="ox-foot" data-q11b-ios>{t(locale, 'dev_ios_block')}</p> : null}
        </div>

        <div className="ox-dev-check" data-dev-check>
          <span className="ox-eyebrow">{up(t(locale, 'dev_check'))}</span>
          <ul className="ox-dev-ck">
            {checks.map((c) => (
              <li key={c.key} data-check={c.key} data-state={c.state}>
                <span className={`ox-dev-mk ${c.state}`} aria-hidden="true">{MARK[c.state]}</span>
                <span className="ox-dev-ck-tx">
                  <span className="ox-dev-ck-lb">
                    {t(locale, CHECK_LABEL[c.key] ?? c.key)}
                    <span className="sr-only"> — {t(locale, STATE_TEXT[c.state])}</span>
                  </span>
                  {c.hint ? <span className="ox-dev-ck-hint">{t(locale, c.hint)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {src && devices ? (
          <div className="ox-dev-list">
            <span className="ox-eyebrow">{up(t(locale, 'dev_mine'))}</span>
            {devices.length === 0 ? <p className="ox-foot">{t(locale, 'dev_none')}</p> : (
              <ul className="ox-list ox-dev-ul">
                {devices.map((d) => {
                  const st = stateOf(d);
                  const line = testLine(tests[d.id]);
                  const cur = tests[d.id];
                  const failed = cur?.phase === 'failed' || cur?.phase === 'noack';
                  const waiting = cur?.phase === 'sent' && cur.ack;
                  return (
                    <li key={d.id} data-device={d.id}>
                      <div className="ox-dev-row">
                        <span className="ox-dev-name">
                          {d.label} · {t(locale, 'dev_since').replace('{d}', formatListDateTime(d.since).split(', ')[0] ?? '')}
                          {d.current ? <span className="ox-dev-cur"> · {t(locale, 'dev_current')}</span> : null}
                        </span>
                        <span className={st.cls} data-dev-state>{st.text}</span>
                      </div>
                      <div className="ox-dev-btns">
                        {src.sendTest ? <button type="button" className="btn ox-btn" disabled={busy || waiting || !d.active} onClick={() => runTest(d)}>{t(locale, 'dev_test')}</button> : null}
                        {src.remove ? <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => remove(d)}>{t(locale, 'dev_remove')}</button> : null}
                      </div>
                      {/* obszar komunikatu stale w drzewie, żeby czytnik ekranu ogłosił pierwszy wynik */}
                      <p className={failed ? 'ox-foot ox-dev-res bad' : 'ox-foot ox-dev-res'} role="status" data-dev-test>{line ?? ''}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {msg ? <p className="ox-foot" role="status">{msg}</p> : null}
      </div>
    </section>
  );
}
