/**
 * Opcje › System › Przełączniki bezpieczeństwa — produkcja w wyglądzie z audytu (E12 `img/e12-after`). Ekran = `FlagsScreen`
 * (ten sam co w demo). Odczyt `security_flags_list()` (HHL), autor ostatniej zmiany z `app_users`.
 * Zapis przez funkcję danego przełącznika, gdy ma własne zasady (te same co dawne formularze):
 * 2FA — `admin_set_mfa_enforcement` (wymaga kodu 2FA i dwóch urządzeń), wymóg zezwoleń — `admin_set_permit_requirement`,
 * SMS przy strefach — `admin_sms_zone_trigger_set`, wiadomości na zewnątrz — `admin_set_external_messaging`;
 * pozostałe — `admin_security_flag_set`. Operacje HHL — tylko odczyt (E12-1A).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { m2 } from '../i18n/mfa2';
import { formatListDateTime } from '../lib/format';
import { FlagsScreen, SECURITY_FLAG_KEYS, type SecurityFlagRow } from '../components/options/SystemScreens';
import { announceOptionsChanged, errText, personName, useBusy, type PersonDb } from './liveOpts';

type Db = { key: string; enabled: boolean; note: string | null; updated_at: string | null; updated_by: string | null };

/** Który RPC zapisuje przełącznik (dedykowane funkcje mają własne zabezpieczenia i wpis w Historii). */
export function flagRpc(key: string, on: boolean): { fn: string; args: Record<string, unknown> } {
  if (key === 'MFA_HHL_ADMIN') return { fn: 'admin_set_mfa_enforcement', args: { p_enabled: on } };
  if (key === 'PERMIT_REQUIRED_NON_STANDARD') return { fn: 'admin_set_permit_requirement', args: { p_enabled: on } };
  if (key === 'EXTERNAL_MESSAGING') return { fn: 'admin_set_external_messaging', args: { p_enabled: on } };
  if (key === 'SMS_ZONE_APPROACH' || key === 'SMS_ZONE_ENTER') return { fn: 'admin_sms_zone_trigger_set', args: { p_key: key, p_enabled: on } };
  return { fn: 'admin_security_flag_set', args: { p_key: key, p_enabled: on } };
}

/** Tylko przełączniki z ekranu E12 (10 z TELM_RIO_LINKS, #446; pozostałe klucze w bazie usunięte decyzją 16.10 i E11), w kolejności ekranu. */
export function flagRows(rows: readonly Db[], nameOf: (id: string) => string | null): SecurityFlagRow[] {
  const by = new Map(rows.map((r) => [r.key, r]));
  return SECURITY_FLAG_KEYS.filter((k) => by.has(k)).map((k) => {
    const r = by.get(k)!;
    return {
      key: k,
      on: !!r.enabled,
      when: r.updated_at ? formatListDateTime(r.updated_at) : '—',
      by: r.updated_by ? nameOf(r.updated_by) : null,
    };
  });
}

export default function LiveFlags({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Db[] | null>(null);
  const [people, setPeople] = useState<PersonDb[]>([]);
  const [mfaBlock, setMfaBlock] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { busy, guard } = useBusy((e) => setMsg(errText(locale, e)));

  const refresh = useCallback(async () => {
    try {
    const sb = await getSupabase();
    const [f, u] = await Promise.all([
      sb.rpc('security_flags_list'),
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id'),
    ]);
    if (f.error) { setMsg(errText(locale, f.error)); setRows([]); return; }
    setRows(((f.data ?? []) as Db[]));
    setPeople((u.data ?? []) as PersonDb[]);
    /* 2FA dla Administratorów: włączysz przy 2FA na dwóch urządzeniach i sesji z kodem (jak `admin_set_mfa_enforcement`) */
    try {
      const factors = await sb.auth.mfa.listFactors();
      const n = (factors.data?.totp ?? []).filter((x) => x.status === 'verified').length;
      const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      setMfaBlock(n < 2 ? m2('m2_flag_blocked_two') : aal.data?.currentLevel !== 'aal2' ? m2('m2_flag_blocked_code') : null);
    } catch {
      setMfaBlock(null);
    }
    } catch (e) {
      setMsg(errText(locale, e));
      setRows((cur) => cur ?? []);
    }
  }, [locale]);
  useEffect(() => { void refresh(); }, [refresh]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const flags = useMemo(() => flagRows(rows ?? [], (id) => {
    const p = byId.get(id);
    return p ? personName(p) : t(locale, 'p3l_flag_by_hhl');
  }), [rows, byId, locale]);

  const onToggle = (key: string, next: boolean) => {
    if (readOnly) return;
    void guard(async () => {
      const sb = await getSupabase();
      const { fn, args } = flagRpc(key, next);
      const { error } = await sb.rpc(fn, args);
      setMsg(error ? errText(locale, error) : null);
      if (!error) announceOptionsChanged();
      await refresh();
    });
  };

  if (!rows) return <div className="note" role="status">{msg ?? t(locale, 'p3l_loading')}</div>;
  return (
    <div data-panel="security-flags" data-live="flags">
      {msg ? <div className="note ox-alert" role="status">{msg}</div> : null}
      {flags.length ? (
        <FlagsScreen
          locale={locale}
          flags={flags}
          readOnly={readOnly}
          onToggle={onToggle}
          busy={busy}
          blocked={mfaBlock ? { MFA_HHL_ADMIN: mfaBlock } : undefined}
        />
      ) : <p className="ox-empty">{t(locale, 'p3l_flags_none')}</p>}
    </div>
  );
}
