/**
 * E9-7 / G-07 — pasek „Podgląd … Nic tu nie zapiszesz” (tylko supabase, widok KSH/SCX).
 * Wygląd paska górnego zostaje dla koordynatora (`wyglad/P3`); tu tylko logika i istniejąca klasa `.banner`.
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
  const label = t(locale, 'a6_preview_banner').replace('{who}', who);

  return (
    <div className="banner" data-banner="preview" role="status">
      <div>
        <b>{label}</b>
      </div>
      <button className="chipbtn" type="button" onClick={() => setRole('HHL')}>
        {t(locale, 'a6_preview_back')}
      </button>
    </div>
  );
}
