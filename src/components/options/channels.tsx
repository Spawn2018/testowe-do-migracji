/** wyglad/P3-c — kanały powiadomień (obraz E11): typy macierzy i przycisk kanału. Wspólne dla „Kto co dostaje” i „Co dostaję”. */
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import type { AccountKind } from './types';
import { IcoBell, IcoMail, IcoPhone } from './icons';

export type Channel = 'bell' | 'push' | 'mail';
export const CHANNELS: Channel[] = ['bell', 'push', 'mail'];
export const CH_KEY: Record<Channel, string> = { bell: 'p3c_ch_bell', push: 'p3c_ch_push', mail: 'p3c_ch_mail' };

/** null = zdarzenie nie dotyczy tego rodzaju konta („—”). */
export type MatrixCell = { bell: boolean; push: boolean; mail: boolean; fixed?: Channel[] } | null;

export type MatrixRow = {
  id: string;
  title: string;
  sub?: string;
  /** „Sytuacja ogólna” — tylko strona Ryzyka, bez kanałów (E11, decyzja 13:21). */
  risksOnly?: boolean;
  /** Dokąd prowadzi kliknięcie powiadomienia. */
  target?: string;
  /** Opis stałego kanału (G-18: „zawsze — decyzja właściciela 09.10”). */
  fixedNote?: boolean;
  /** Średnio zdarzeń na dobę z ostatnich 7 dni (z danych) — prognoza e-maili w podglądzie wiersza (E11). */
  perDay?: number;
  /** Zdarzenie z migracji jeszcze niewdrożonej (np. 0255): w „Kto co dostaje” widać je dopiero, gdy baza ma ten klucz; „Co dostaję” — po zdjęciu znacznika. */
  pendingDb?: boolean;
  cells: Record<AccountKind, MatrixCell>;
};

export type MatrixGroup = { id: string; title: string; sub?: string; rows: MatrixRow[] };


export function Icon({ ch }: { ch: Channel }) {
  return ch === 'bell' ? <IcoBell /> : ch === 'push' ? <IcoPhone /> : <IcoMail />;
}

export function ChannelChip({ locale, ch, on, fixed, onClick, disabled }: { locale: Locale; ch: Channel; on: boolean; fixed?: boolean; onClick?: () => void; disabled?: boolean }) {
  const label = t(locale, fixed ? 'p3c_ch_fixed' : on ? 'p3c_ch_state_on' : 'p3c_ch_state_off').replace('{ch}', t(locale, CH_KEY[ch]));
  return (
    <button
      type="button"
      className={`ox-ch ox-ch-${ch}${on ? ' is-on' : ''}${fixed ? ' is-fixed' : ''}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={disabled || fixed || !onClick}
      onClick={onClick}
    >
      <Icon ch={ch} />
    </button>
  );
}

