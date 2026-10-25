import { t, tp } from '../i18n/messages';

type DeeplView = { characters: number; monthly_limit: number; level: string; oldest_age_min?: number | null } | null;

/**
 * B9 (D-20261019-1515-01 pkt 5): „warn” z dwóch powodów — zużycie ≥ 80% limitu albo komunikat drogowy czeka
 * na tłumaczenie dłużej niż 15 min (`deepl_usage_view.oldest_age_min`, 0302). Tekst według powodu;
 * bez pól z 0302 — jak dotąd („powyżej 80% limitu”).
 */
export function deeplWarnText(d: DeeplView, locale: Parameters<typeof t>[0]): string {
  if (!d || d.level !== 'warn') return '';
  const parts: string[] = [];
  if (d.monthly_limit > 0 && d.characters / d.monthly_limit >= 0.8) parts.push(t(locale, 'pl_deepl_warn'));
  if (d.oldest_age_min != null && d.oldest_age_min > 15) parts.push(tp(locale, 'b6_sys_deepl_wait', { m: String(Math.round(d.oldest_age_min)) }));
  if (!parts.length) parts.push(t(locale, 'pl_deepl_warn'));
  return parts.map((x) => ` · ${x}`).join('');
}
