/**
 * wyglad/C — pasek „Uzupełnij telefon” (E6, artefakt: „Kto nie ma telefonu, po zalogowaniu widzi pasek »Uzupełnij telefon«”;
 * D-20261015-0300-01 C11). Ten sam pasek stanu co „Podgląd”, „Działasz jako” i komunikat HHL (E37). „Uzupełnij” otwiera
 * Moje konto (Dla mnie). Warunek z profilu konta: brak telefonu E.164 (`my_profile.phone`). Bez zapisu i bez zapytań.
 * Gdy profil zna rzeczywistego wykonawcę („Działaj jako”) albo trwa Podgląd — pasek dotyczy zalogowanej osoby, więc znika.
 */
import { useEffect, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { AUTH_RELOAD_EVENT, getAuthProfile, type AuthProfile } from '../../auth/profile';
import { openOptionsScreen } from '../../lib/openOptions';

/** Konto bez telefonu w formacie międzynarodowym (+48…, +46…). */
export function needsPhone(p: Pick<AuthProfile, 'phone' | 'real_user_id'> | null | undefined): boolean {
  if (!p || p.real_user_id) return false;
  return !/^\+[1-9][0-9]{7,14}$/.test((p.phone ?? '').trim());
}

export function PhoneMissingBar() {
  const locale = useTowerStore((s) => s.locale);
  const [p, setP] = useState<AuthProfile | null>(() => getAuthProfile());
  useEffect(() => {
    const sync = () => setP(getAuthProfile());
    sync();
    window.addEventListener(AUTH_RELOAD_EVENT, sync);
    return () => window.removeEventListener(AUTH_RELOAD_EVENT, sync);
  }, []);
  if (!needsPhone(p)) return null;
  return (
    <div className="subbar subbar-phone" data-banner="phone-missing" role="status">
      <p className="subbar-tx"><b>{t(locale, 'phone_missing_h')}</b>{t(locale, 'phone_missing_tx')}</p>
      <button type="button" className="subbar-btn" onClick={() => openOptionsScreen('my-account')}>{t(locale, 'phone_missing_btn')}</button>
    </div>
  );
}
