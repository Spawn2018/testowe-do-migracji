/**
 * wyglad/P10a-a — E22 pkt 2: przy tytule strony „na żywo · 02:45” (godzina ostatniego odświeżenia danych),
 * a bez sieci „brak połączenia od 02:41”. Dane — `p10aSource` (produkcja: wykonawca; do podłączenia znacznik ukryty).
 */
import { a10 } from '../../i18n/p10a';
import { useLive } from '../../lib/p10aSource';
import { fmtTime } from '../../lib/time';

const hhmm = (ms: number) => fmtTime(ms);

export function LiveMark() {
  const live = useLive();
  if (!live) return null;
  const t = hhmm(live.atMs);
  return (
    <span className={`live-mark${live.ok ? '' : ' is-off'}`} data-live={live.ok ? 'on' : 'off'} title={a10('a10_live_title')}>
      <i aria-hidden="true" />{live.ok ? a10('a10_live', { t }) : a10('a10_off', { t })}
    </span>
  );
}
