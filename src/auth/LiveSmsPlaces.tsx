/**
 * Opcje › Powiadomienia › SMS przy miejscach — produkcja w wyglądzie z audytu (E42, `img/e42-after`): ekran `SmsPlaces`
 * (ten sam co w demo) — kafelki, dwa miejsca po 2 osoby, rodzaje A–D przy osobie.
 * Dane i zapis jak w dzisiejszych formularzach: odbiorcy `sms_zone_recipients` + RPC `admin_sms_zone_recipient_set`
 * (usunięcie = osoba nieaktywna), wysyłka do odbiorców `sms_external_messaging_state` (przełącza tylko właściciel — tu
 * bez przełącznika, jak dotąd), numer testowy `sms_test_numbers`, bramka `sms_devices`, konta z telefonem `app_users`.
 * Rodzajów A–D przy osobie baza nie zapisuje — każda osoba dostaje wszystkie rodzaje miejsca (pola bez wyboru).
 * Pod ekranem rozwijane: wyzwalacze „przed przyjazdem” i „wjazd” (`admin_sms_zone_trigger_set`), SMS testowy na listę
 * (`admin_sms_zone_test`) i pełna bramka SMS (`SmsGateway`: urządzenia, numery testowe, kolejka).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { lazyRetry } from '../lib/lazyRetry';
import { SmsPlaces } from '../components/options/SmsPlaces';
import type { SmsPlacesSource } from '../lib/p8bSource';
import { kindsFor, type PlaceId, type PlaceView, type SmsPlacesState, type ZonePerson, type ZoneUser } from '../lib/p8bPlaces';

const SmsGateway = lazy(lazyRetry(() => import('./SmsGateway')));
const GW_SILENT_MIN = 15;

export type RecRow = { list_key: string; slot: number; display_name: string; phone_national: string; country: string; active: boolean };
export type DevRow = { label: string; last_seen_at: string | null; revoked_at: string | null; paused: boolean; day_sent: number; day_limit: number };

const PLACES: PlaceId[] = ['LOAD_SREM', 'UNLOAD_BODEN'];

/** Wiersze bazy → stan ekranu (czysta funkcja, test). */
export function placesFromDb(rows: readonly RecRow[], sending: boolean, testTo: string | null, devices: readonly DevRow[], nowIso: string): SmsPlacesState {
  const person = (place: PlaceId, slot: 1 | 2): ZonePerson | null => {
    const r = rows.find((x) => x.list_key === place && x.slot === slot && x.active);
    return r ? { userId: null, name: r.display_name, country: r.country === 'SE' ? 'SE' : 'PL', phone: r.phone_national, kinds: kindsFor(place) } : null;
  };
  const places = PLACES.map((id): PlaceView => ({ id, people: [person(id, 1), person(id, 2)] })) as SmsPlacesState['places'];
  const live = devices.filter((d) => !d.revoked_at).sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''));
  const d = live[0] ?? null;
  const fresh = !!d?.last_seen_at && (Date.parse(nowIso) - Date.parse(d.last_seen_at)) / 60_000 <= GW_SILENT_MIN;
  return {
    sending,
    testTo,
    places,
    gateway: d ? { active: fresh && !d.paused, lastSignal: d.last_seen_at, today: d.day_sent, limit: d.day_limit } : null,
  };
}

function Extras({ readOnly }: { readOnly: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const pushToast = useTowerStore((s) => s.pushToast);
  const [flags, setFlags] = useState<{ approach: boolean; enter: boolean } | null>(null);
  const load = useCallback(async () => {
    const sb = await getSupabase();
    const f = await sb.from('security_flags').select('key,enabled').in('key', ['SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER']);
    const by = new Map(((f.data ?? []) as { key: string; enabled: boolean }[]).map((x) => [x.key, !!x.enabled]));
    setFlags({ approach: by.get('SMS_ZONE_APPROACH') ?? true, enter: by.get('SMS_ZONE_ENTER') ?? true });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const setTrigger = async (key: string, enabled: boolean) => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_sms_zone_trigger_set', { p_key: key, p_enabled: enabled });
    if (error) pushToast(error.message, 'HIGH');
    await load();
  };
  const test = async (list: PlaceId) => {
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('admin_sms_zone_test', { p_list: list });
    if (error) pushToast(error.message, 'HIGH');
    else pushToast(t(locale, 'dec5_test_queued').replace('{n}', String(data ?? 0)), 'MEDIUM');
  };
  return (
    <div className="ol2-sms-extras" data-live-sms-extras>
      <h4 className="sec">{t(locale, 'ol2_sms_triggers_h')}</h4>
      {flags ? (
        <>
          <label className="ol2-check"><input type="checkbox" checked={flags.approach} disabled={readOnly} onChange={(e) => void setTrigger('SMS_ZONE_APPROACH', e.target.checked)} />{t(locale, 'dec5_trig_approach')}</label>
          <label className="ol2-check"><input type="checkbox" checked={flags.enter} disabled={readOnly} onChange={(e) => void setTrigger('SMS_ZONE_ENTER', e.target.checked)} />{t(locale, 'dec5_trig_enter')}</label>
        </>
      ) : null}
      {readOnly ? null : (
        <div className="ol2-acts">
          <button type="button" className="btn ghost" data-live-sms-test="LOAD_SREM" onClick={() => void test('LOAD_SREM')}>{t(locale, 'ol2_sms_test_srem')}</button>
          <button type="button" className="btn ghost" data-live-sms-test="UNLOAD_BODEN" onClick={() => void test('UNLOAD_BODEN')}>{t(locale, 'ol2_sms_test_boden')}</button>
        </div>
      )}
    </div>
  );
}

export default function LiveSmsPlaces({ readOnly = false, children }: { readOnly?: boolean; children?: ReactNode }) {
  const locale = useTowerStore((s) => s.locale);
  const rowsRef = useRef<RecRow[]>([]);

  const source: SmsPlacesSource = useMemo(() => ({
    kindsFixed: true,
    setSending: null,
    state: async () => {
      const sb = await getSupabase();
      const [r, f, n, d] = await Promise.all([
        sb.from('sms_zone_recipients').select('list_key,slot,display_name,phone_national,country,active').order('list_key').order('slot'),
        sb.rpc('sms_external_messaging_state'),
        sb.from('sms_test_numbers').select('to_e164').order('created_at').limit(1),
        sb.from('sms_devices').select('label,last_seen_at,revoked_at,paused,day_sent,day_limit'),
      ]);
      rowsRef.current = (r.data ?? []) as RecRow[];
      const testTo = ((n.data ?? []) as { to_e164: string }[])[0]?.to_e164 ?? null;
      return placesFromDb(rowsRef.current, f.data === true, testTo, (d.data ?? []) as DevRow[], new Date().toISOString());
    },
    users: async () => {
      const sb = await getSupabase();
      const u = await sb.from('app_users').select('id,full_name,first_name,last_name,phone,active').eq('active', true).order('full_name');
      return ((u.data ?? []) as { id: string; full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null }[])
        .map((x): ZoneUser => ({ id: x.id, name: x.full_name || [x.first_name, x.last_name].filter(Boolean).join(' ') || '—', phone: x.phone }));
    },
    savePerson: readOnly ? null : async (place, slot, person) => {
      const sb = await getSupabase();
      /* usunięcie = osoba nieaktywna (te same imię i numer), jak w bazie */
      const cur = rowsRef.current.find((x) => x.list_key === place && x.slot === slot) ?? null;
      if (!person && !cur) return { ok: true };
      const { error } = await sb.rpc('admin_sms_zone_recipient_set', person
        ? { p_list: place, p_slot: slot, p_name: person.name, p_phone: person.phone, p_country: person.country, p_active: true }
        : { p_list: place, p_slot: slot, p_name: cur!.display_name, p_phone: cur!.phone_national, p_country: cur!.country, p_active: false });
      if (error) return { ok: false, error: error.message };
      const next = person
        ? { list_key: place, slot, display_name: person.name, phone_national: person.phone, country: person.country, active: true }
        : { ...cur!, active: false };
      rowsRef.current = [...rowsRef.current.filter((x) => !(x.list_key === place && x.slot === slot)), next];
      return { ok: true };
    },
  }), [readOnly]);

  return (
    <div data-panel="live-sms-places">
      <SmsPlaces readOnly={readOnly} source={source} />
      <details className="ol2-more" data-live-sms-more>
        <summary>{t(locale, 'ol2_sms_more')}</summary>
        <Extras readOnly={readOnly} />
        <Suspense fallback={null}>
          {readOnly ? <fieldset disabled className="opt-ro" data-opt-ro><SmsGateway /></fieldset> : <SmsGateway />}
        </Suspense>
        {/* strefy (włącz / wyłącz) — z Opcji, jak dotąd */}
        {children}
      </details>
    </div>
  );
}
