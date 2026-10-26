/**
 * E9-7 / G-07 — pasek „Podgląd … Nic tu nie zapiszesz” (tylko supabase, widok KSH/SCX).
 * wyglad/P3 (E37, img/e37-after): pasek pod paskiem górnym na całą szerokość, niebieski, „Wróć do HHL” po prawej.
 */
import { useTowerStore } from '../store/useTowerStore';
import { dbPreviewOn, isPreviewReadOnly } from '../lib/prodFacade';
import { getAuthProfile } from './profile';
import { switchViewRole, usePreviewSwitchBusy } from './previewSwitch';
import { t } from '../i18n/messages';
import './auth.css';

const VIEW_LABEL: Record<string, string> = {
  KSH: 'KSH Użytkownik',
  SCX: 'SCX Dyspozytor',
};

export function PreviewBanner() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const switching = usePreviewSwitchBusy();

  if (!isPreviewReadOnly({ viewRole: role })) return null;

  /* B5 (0300): Podgląd w bazie — konto, którego oczami patrzysz (pierwsze aktywne KSH Użytkownik / SCX Dyspozytor) */
  const me = getAuthProfile();
  const person = dbPreviewOn(me) ? (me?.full_name?.trim() || me?.email || '') : '';
  const who = `${VIEW_LABEL[role] ?? role}${person ? ` (${person})` : ''}`;

  return (
    <div className="subbar subbar-preview" data-banner="preview" role="status">
      <p className="subbar-tx">
        <b>{t(locale, 'p3a_preview_bold').replace('{who}', who)}</b> {t(locale, 'p3a_preview_rest')}
      </p>
      <button className="subbar-btn" type="button" onClick={() => void switchViewRole('HHL')} aria-busy={switching || undefined} aria-disabled={switching || undefined}>
        {t(locale, 'p3a_preview_back')}
      </button>
    </div>
  );
}
