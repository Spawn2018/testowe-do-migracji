/**
 * wyglad/W-opcje-live-1 — stany przy pozycjach menu Opcji i na kafelkach grup (telefon) na produkcji, z bazy
 * (E11 `img/e11-desk`: „12 aktywnych”; E12 „Telefon”: „15 kont · 0 z 2FA”). Tylko tam, gdzie dane są w bazie:
 * Użytkownicy (aktywne konta), Zezwolenia (wymóg wł./wył.), Kalibracja ETA (pomiary / propozycja / wersja),
 * kafelki Ludzie i dostęp, Zasady transportu, System (liczba przełączników). Bez danych — brak stanu (nazwy ekranów).
 */
import { getSupabase } from './client';
import { tp, t } from '../i18n/messages';
import type { Locale } from '../types';
import type { OptGroupId, OptScreenId, OptTone } from '../components/options/types';
import { SECURITY_FLAG_KEYS } from '../components/options/SystemScreens';
import { isE164 } from '../lib/phoneNational';
import { CALIB_NEEDED } from '../lib/etaCalibDemo';
import { QUIET_KEY } from './liveOpts';

export type LiveMeta = {
  meta: Partial<Record<OptScreenId, { meta?: string; tone?: OptTone }>>;
  summaries: Partial<Record<OptGroupId, { text: string; tone?: OptTone }>>;
};

export async function loadOptionsMeta(locale: Locale, admin: boolean): Promise<LiveMeta> {
  const sb = await getSupabase();
  const out: LiveMeta = { meta: {}, summaries: {} };
  const [u, f, th, obs, ver] = await Promise.all([
    admin ? sb.from('app_users').select('id,active,phone') : Promise.resolve({ data: null, error: null }),
    sb.rpc('security_flags_list'),
    sb.from('ops_thresholds').select('key'),
    sb.from('eta_segment_observations').select('id,exclude_reason'),
    sb.from('eta_calibration_versions').select('id,applied,frozen,undone_at,rejected_at,note'),
  ]);

  const users = (u.error ? null : u.data) as Array<{ active: boolean; phone: string | null }> | null;
  if (users) {
    const active = users.filter((x) => x.active).length;
    const phones = users.filter((x) => !!x.phone && isE164(x.phone)).length;
    out.meta.users = { meta: tp(locale, 'p3c_u_active', { n: active }) };
    out.summaries.people = { text: tp(locale, 'p3l_sum_people', { n: users.length, p: phones }), tone: phones < users.length ? 'alert' : undefined };
  }

  const flags = (f.error ? null : f.data) as Array<{ key: string; enabled: boolean }> | null;
  const permit = flags?.find((x) => x.key === 'PERMIT_REQUIRED_NON_STANDARD');
  const state = permit ? t(locale, permit.enabled ? 'p3l_on_short' : 'p3l_off_short') : null;
  if (state) out.meta.permits = { meta: state };
  if (flags) {
    const n = flags.filter((x) => (SECURITY_FLAG_KEYS as readonly string[]).includes(x.key)).length;
    out.summaries.system = { text: tp(locale, 'p3l_sum_system', { n }) };
  }

  const thr = (th.error ? null : th.data) as Array<{ key: string }> | null;
  if (thr && state) {
    const n = thr.filter((x) => x.key !== QUIET_KEY && !/^DWELL_/.test(x.key)).length;
    out.summaries.rules = { text: tp(locale, 'p3l_sum_rules', { n, state }) };
  }

  const o = (obs.error ? null : obs.data) as Array<{ exclude_reason: string | null }> | null;
  const v = (ver.error ? null : ver.data) as Array<{ id: number; applied: boolean; frozen: boolean | null; undone_at?: string | null; rejected_at?: string | null; note?: string | null }> | null;
  if (o && v) {
    const n = o.filter((x) => !x.exclude_reason).length;
    /* W-604: numer wersji = id (jak na ekranie i w dzwonku); cofnięta, odrzucona i zastąpiona nie czekają */
    const live = v.filter((x) => x.applied && !x.undone_at).map((x) => x.id);
    const applied = live.length ? Math.max(...live) : 0;
    const waiting = v.some((x) => !x.applied && !x.frozen && !x.undone_at && !x.rejected_at && !/superseded/i.test(x.note ?? ''));
    out.meta.calib = {
      meta: waiting ? t(locale, 'cal_meta_ready')
        : n < CALIB_NEEDED ? tp(locale, 'cal_meta_wait', { n, need: CALIB_NEEDED })
          : applied ? tp(locale, 'cal_meta_done', { no: applied }) : t(locale, 'cal_meta_same'),
    };
  }
  return out;
}
