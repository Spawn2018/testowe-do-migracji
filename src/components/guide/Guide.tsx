/**
 * I-4 — instrukcja w PWA kierowcy (PL/EN/SV). HHL, KSH i SCX mają od P10b Pomoc („Jak pracuję”, src/lib/helpContent.ts);
 * ich stare teksty `i4_hhl_*`, `i4_ksh_*`, `i4_scx_*` (POD, „Moje zadania”, „Importuj XLSX”, „Link dla kierowcy”) usunięte — C13.
 * Treść w słowniku (`i4_drv_<n>`, src/i18n/i2.ts) — PL-T sprawdza pisownię, D19-T brak polskich znaków w EN/SV.
 * Ładowana leniwie wyłącznie w buildzie produkcyjnym (wzorce zrzutów demo bez zmian).
 */
import { hasKey, t } from '../../i18n/messages';
import type { Locale } from '../../types';

export type GuideRole = 'drv';

export function guideSteps(locale: Locale, role: GuideRole): string[] {
  const out: string[] = [];
  for (let i = 1; hasKey(locale, `i4_${role}_${i}`); i++) out.push(t(locale, `i4_${role}_${i}`));
  return out;
}

export default function Guide({ locale, role, open = false }: { locale: Locale; role: GuideRole; open?: boolean }) {
  return (
    <details className="panel option-panel option-wide" data-guide={role} open={open}>
      <summary className="panel-hd" style={{ cursor: 'pointer' }}>
        <h2 style={{ display: 'inline' }}>{t(locale, 'i4_h')}</h2> <span className="sub">{t(locale, `i4_sub_${role}`)}</span>
      </summary>
      <div className="panel-bd">
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
          {guideSteps(locale, role).map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
        </ol>
      </div>
    </details>
  );
}
