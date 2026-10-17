/**
 * DEC-5 — listy odbiorców SMS stref (2+2) i wyzwalacze. Zmienia tylko HHL_ADMIN.
 * wyglad/W-konta (audyt 17.10 sekcja 03 N7, do czasu P8): Operacje HHL tylko oglądają — bez „Zapisz”, przełączników
 * i SMS testowego; PL/SE opisane jako numer kierunkowy (nie język — SMS tylko po polsku, E42).
 */
import { useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';

type Rec = {
  list_key: string;
  slot: number;
  display_name: string;
  phone_national: string;
  country: string;
  active: boolean;
};

const LISTS = [
  { key: 'LOAD_SREM', labelKey: 'dec5_list_load' as const },
  { key: 'UNLOAD_BODEN', labelKey: 'dec5_list_unload' as const },
] as const;

export default function SmsZoneRecipients({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const pushToast = useTowerStore((s) => s.pushToast);
  const [rows, setRows] = useState<Rec[]>([]);
  const [approach, setApproach] = useState(true);
  const [enter, setEnter] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const sb = await getSupabase();
    const [r, f] = await Promise.all([
      sb.from('sms_zone_recipients').select('list_key,slot,display_name,phone_national,country,active').order('list_key').order('slot'),
      sb.from('security_flags').select('key,enabled').in('key', ['SMS_ZONE_APPROACH', 'SMS_ZONE_ENTER']),
    ]);
    setRows((r.data ?? []) as Rec[]);
    for (const x of f.data ?? []) {
      if (x.key === 'SMS_ZONE_APPROACH') setApproach(!!x.enabled);
      if (x.key === 'SMS_ZONE_ENTER') setEnter(!!x.enabled);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveSlot = async (list: string, slot: number, name: string, phone: string, country: string) => {
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_sms_zone_recipient_set', {
      p_list: list, p_slot: slot, p_name: name, p_phone: phone, p_country: country, p_active: true,
    });
    setBusy(false);
    if (error) pushToast(error.message, 'HIGH');
    else {
      pushToast(t(locale, 'dec5_saved'), 'MEDIUM');
      void load();
    }
  };

  const setTrigger = async (key: string, enabled: boolean) => {
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_sms_zone_trigger_set', { p_key: key, p_enabled: enabled });
    if (error) pushToast(error.message, 'HIGH');
    else void load();
  };

  const testList = async (list: string) => {
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('admin_sms_zone_test', { p_list: list });
    if (error) pushToast(error.message, 'HIGH');
    else pushToast(t(locale, 'dec5_test_queued').replace('{n}', String(data ?? 0)), 'MEDIUM');
  };

  return (
    <section className="panel" data-dec5-sms style={{ marginTop: 12 }}>
      <div className="panel-hd"><h2 style={{ fontSize: 16 }}>{t(locale, 'dec5_title')}</h2></div>
      <div className="panel-bd">
        {readOnly ? <p className="note" data-dec5-ro>{t(locale, 'p3c_r_read')}</p> : null}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input type="checkbox" checked={approach} disabled={readOnly} onChange={(e) => { setApproach(e.target.checked); void setTrigger('SMS_ZONE_APPROACH', e.target.checked); }} />
          {t(locale, 'dec5_trig_approach')}
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <input type="checkbox" checked={enter} disabled={readOnly} onChange={(e) => { setEnter(e.target.checked); void setTrigger('SMS_ZONE_ENTER', e.target.checked); }} />
          {t(locale, 'dec5_trig_enter')}
        </label>

        {LISTS.map((L) => (
          <div key={L.key} style={{ marginBottom: 16 }}>
            <h4 className="sec">{t(locale, L.labelKey)}</h4>
            {[1, 2].map((slot) => {
              const cur = rows.find((r) => r.list_key === L.key && r.slot === slot);
              return (
                <form
                  key={slot}
                  className="form-field"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    void saveSlot(L.key, slot, String(fd.get('name') || ''), String(fd.get('phone') || ''), String(fd.get('country') || 'PL'));
                  }}
                >
                  <span>{t(locale, 'dec5_person')} {slot}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <input className="input" name="name" defaultValue={cur?.display_name ?? ''} placeholder={t(locale, 'dec5_name')} required readOnly={readOnly} style={{ flex: '1 1 120px' }} />
                    <select className="input" name="country" defaultValue={cur?.country ?? 'PL'} disabled={readOnly} aria-label={t(locale, 'dec5_prefix')} title={t(locale, 'dec5_prefix')} style={{ width: 96 }}>
                      <option value="PL">+48 PL</option>
                      <option value="SE">+46 SE</option>
                    </select>
                    <input className="input mono" name="phone" defaultValue={cur?.phone_national ?? ''} placeholder="601234567" required readOnly={readOnly} style={{ flex: '1 1 120px' }} />
                    {readOnly ? null : <button type="submit" className="btn ghost" disabled={busy}>{t(locale, 'a6_dr_save')}</button>}
                  </div>
                </form>
              );
            })}
            {readOnly ? null : <button type="button" className="btn ghost" onClick={() => void testList(L.key)}>{t(locale, 'dec5_sms_test')}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
