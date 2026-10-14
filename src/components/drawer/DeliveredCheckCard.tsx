/**
 * wyglad/P4-c — sprawa „Wyjazd z placu po X min — czy dostarczono?” (E26 pkt 4, L14; wygląd karty sprawy jak img/e7-desk).
 * „Tak, dostarczono” → status „Dostarczone” z godziną wyjazdu ze strefy; „Nie” → sprawa zamknięta, status bez zmian, wpis w Historii.
 * Rozstrzyga przewoźnik (SCX); inne konta widzą, na kogo czeka. Zapis (zamknięcie sprawy) podłącza wykonawca — `onYes` / `onNo`.
 */
import type { DeliveredCheck, Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { dayTime, timeOnly } from '../../lib/statusAxis';

export function DeliveredCheckCard({
  check,
  locale,
  busy = false,
  onYes,
  onNo,
}: {
  check: DeliveredCheck;
  locale: Locale;
  busy?: boolean;
  onYes?: () => void;
  onNo?: () => void;
}) {
  /* przewoźnik widzi przyciski zawsze; bez podłączonego zapisu są zablokowane */
  const wired = !!onYes && !!onNo;
  return (
    <section className="dcc" data-delivered-check={check.id} aria-labelledby={`dcc-${check.id}`}>
      <div className="dcc-main">
        <h3 className="dcc-t" id={`dcc-${check.id}`}>{tp(locale, 'p4c_dc_title', { n: check.minutes })}</h3>
        <p className="dcc-s">{tp(locale, 'p4c_dc_sub', { zone: check.zoneName, at: dayTime(check.exitAt), thr: check.thresholdMin ?? 10 })}</p>
        <p className="dcc-r">{tp(locale, 'p4c_dc_rule', { time: timeOnly(check.exitAt) })}</p>
      </div>
      {check.canDecide ? (
        <div className="dcc-acts">
          <button type="button" className="btn dcc-yes" data-dc="yes" disabled={busy || !wired} onClick={onYes}>
            {t(locale, 'p4c_dc_yes')}
          </button>
          <button type="button" className="btn ghost dcc-no" data-dc="no" disabled={busy || !wired} onClick={onNo}>
            {t(locale, 'p4c_dc_no')}
          </button>
        </div>
      ) : (
        <p className="dcc-wait" data-dc="wait">{t(locale, 'p4c_dc_wait')}</p>
      )}
    </section>
  );
}
