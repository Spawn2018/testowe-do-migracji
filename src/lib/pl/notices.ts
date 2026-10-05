/**
 * PL-DATA — e-mail i SMS ryzyka drogowego wyłącznie po polsku,
 * niezależnie od języka konta odbiorcy.
 */
import { renderNotice, type NotifyLocale } from '../../../supabase/functions/_shared/notifyTemplates.ts';

export function roadRiskEmail(event: string, locale: NotifyLocale = 'pl') {
  return renderNotice({
    template: 'ROAD_RISK',
    payload: { event, road: 'E4', locale },
  }, locale);
}

export function roadRiskSms(event: string, code = 'E4'): string {
  const text = `Watch Tower: warunki drogowe ${code}: ${event}. Szczegoly w panelu Ryzyka.`;
  return text.length > 160 ? text.slice(0, 160) : text;
}
