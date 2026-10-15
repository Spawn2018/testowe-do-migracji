/**
 * wyglad/C — Dla mnie › Ten telefon / komputer (E5 img/e5-desk i img/e5-phone, prawa część „Powiadomienia na telefonie”;
 * E11 menu „Dla mnie”). Włączenie powiadomień na tym urządzeniu (ta sama logika co dotąd w „Wygląd i waluta”),
 * instrukcja dla iPhone’a i Androida, lista urządzeń z przyciskami „Wyślij powiadomienie testowe” i „Usuń urządzenie”.
 * Listę i oba przyciski daje `pushDeviceSource` — na produkcji podłącza je wykonawca (C2); do tego czasu sekcja ukryta.
 */
import { useEffect, useState } from 'react';
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import { formatListDateTime } from '../../lib/format';
import { pushDevicesOf, type PushDevice } from '../../lib/pushDeviceSource';
import { up } from './up';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';

/** Tylko build produkcyjny ładuje obsługę powiadomień (strażnik I-2: paczka demo bez klienta bazy). */
const loadWebPush = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? () => import('../../lib/webPush') : null;

export function DeviceScreen({ locale }: { locale: Locale }) {
  const live = loadWebPush !== null;
  const src = pushDevicesOf();
  const [devices, setDevices] = useState<PushDevice[] | null>(src ? src.devices : null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [iosBlock, setIosBlock] = useState(false);

  useEffect(() => {
    if (!loadWebPush) return;
    void loadWebPush().then(({ isIosSafari, isStandalonePwa }) => {
      setIosBlock(isIosSafari() && !isStandalonePwa());
    });
  }, []);

  const turn = (on: boolean) => {
    if (!loadWebPush) return;
    setBusy(true);
    void (async () => {
      const wp = await loadWebPush();
      if (on) {
        const r = await wp.enableWebPush();
        setMsg(r.ok ? t(locale, 'dev_on_ok') : r.reason === 'denied' ? t(locale, 'dev_denied') : r.reason === 'unsupported' ? t(locale, 'dev_unsupported') : t(locale, 'dev_fail'));
      } else {
        await wp.disableWebPush();
        setMsg(t(locale, 'dev_off_ok'));
      }
      setBusy(false);
    })();
  };

  const act = (fn: ((id: string) => Promise<boolean>) | null, id: string, ok: string, after?: () => void) => {
    if (!fn) return;
    setBusy(true);
    void fn(id).then((res) => {
      setMsg(res ? ok : t(locale, 'dev_fail'));
      if (res && after) after();
      setBusy(false);
    });
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

        <div className="ox-dev-here">
          <span className="ox-eyebrow">{up(t(locale, 'dev_here'))}</span>
          <div className="ox-actions ox-actions-start">
            <button type="button" className="btn ox-btn" data-dev-on disabled={!live || busy || iosBlock} onClick={() => turn(true)}>{t(locale, 'dev_on')}</button>
            <button type="button" className="btn ghost ox-btn" data-dev-off disabled={!live || busy} onClick={() => turn(false)}>{t(locale, 'dev_off')}</button>
          </div>
          {iosBlock ? <p className="ox-foot" data-q11b-ios>{t(locale, 'dev_ios_block')}</p> : null}
        </div>

        {src && devices ? (
          <div className="ox-dev-list">
            <span className="ox-eyebrow">{up(t(locale, 'dev_mine'))}</span>
            {devices.length === 0 ? <p className="ox-foot">{t(locale, 'dev_none')}</p> : (
              <ul className="ox-list ox-dev-ul">
                {devices.map((d) => (
                  <li key={d.id} data-device={d.id}>
                    <div className="ox-dev-row">
                      <span className="ox-dev-name">
                        {d.label} · {t(locale, 'dev_since').replace('{d}', formatListDateTime(d.since).split(', ')[0] ?? '')}
                        {d.current ? <span className="ox-dev-cur"> · {t(locale, 'dev_current')}</span> : null}
                      </span>
                      <span className={d.active ? 'ox-dev-on' : 'ox-dev-off'}>{t(locale, d.active ? 'dev_active' : 'dev_inactive')}</span>
                    </div>
                    <div className="ox-dev-btns">
                      {src.sendTest ? <button type="button" className="btn ox-btn" disabled={busy || !d.active} onClick={() => act(src.sendTest, d.id, t(locale, 'dev_test_ok'))}>{t(locale, 'dev_test')}</button> : null}
                      {src.remove ? <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => act(src.remove, d.id, t(locale, 'dev_removed'), () => setDevices((xs) => (xs ?? []).filter((x) => x.id !== d.id)))}>{t(locale, 'dev_remove')}</button> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {msg ? <p className="ox-foot" role="status">{msg}</p> : null}
      </div>
    </section>
  );
}
