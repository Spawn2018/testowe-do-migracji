/**
 * E9-7 / G-07 — pasek „Podgląd … Nic tu nie zapiszesz” (tylko supabase, widok KSH/SCX).
 * wyglad/P3 (E37, img/e37-after): pasek pod paskiem górnym na całą szerokość, niebieski, „Wróć do HHL” po prawej.
 */
import { useTowerStore } from '../store/useTowerStore';
import { isPreviewReadOnly } from '../lib/prodFacade';
import { t } from '../i18n/messages';
import './auth.css';

const VIEW_LABEL: Record<string, string> = {
  KSH: 'KSH Użytkownik',
  SCX: 'SCX Dyspozytor',
};

export function PreviewBanner() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const setRole = useTowerStore((s) => s.setRole);

  if (!isPreviewReadOnly({ viewRole: role })) return null;

  const who = VIEW_LABEL[role] ?? role;

  return (
    <div className="subbar subbar-preview" data-banner="preview" role="status">
      <p className="subbar-tx">
        <b>{t(locale, 'p3a_preview_bold').replace('{who}', who)}</b> {t(locale, 'p3a_preview_rest')}
      </p>
      <button className="subbar-btn" type="button" onClick={() => setRole('HHL')}>
        {t(locale, 'p3a_preview_back')}
      </button>
    </div>
  );
}
