import type { Locale } from '../../types';
import { t } from '../../i18n/messages';

/** B-6a/b/c/h — „Jak to działa”: rozwijana lista kroków mechanizmu na górze sekcji Opcji. */
export function OptionsHowTo({ locale, k, summaryKey = 'b6_howto' }: { locale: Locale; k: string; summaryKey?: string }) {
  const items = t(locale, k).split('|').map((x) => x.trim()).filter(Boolean);
  return (
    <details className="opt-howto" data-howto={k}>
      <summary>{t(locale, summaryKey)}</summary>
      <ol>{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
    </details>
  );
}
