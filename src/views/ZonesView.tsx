/**
 * wyglad/P8-c — Strefy (E34, decyzje 08.10.2026, 12:14; img/e34-after).
 * Komputer: po lewej „Strefy · 10 · według trasy” z mapą trasy i listą w grupach (Śrem, Gdańsk · Polferries → Nynäshamn,
 * Gdynia · Stena → Karlskrona, porty w Szwecji, Boden), przy strefie promień, co uruchamia i ostatnie zdarzenie;
 * po prawej karta strefy: mapa z kołem i ostatnimi pozycjami, parametry zwykłymi słowami, „Co robi ta strefa”,
 * historia zmian (kliknięcie pokazuje poprzedni kształt). „Zmień strefę” — środek, promień, powód (wymagany) i podgląd
 * wpływu na transporty w oknie śledzenia (pytanie 1 B). „Wyłącz” i „Włącz” z powodem (strefy ze zdarzeniami się nie usuwa).
 * Zmienia tylko Administrator HHL; Operacje HHL — podgląd bez przycisków; menu bez liczby (E9).
 * Telefon: mapa u góry, karty według miejsca; stuknięcie otwiera kartę strefy na cały ekran.
 */
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { useIsPhone } from '../lib/useIsPhone';
import { getNow } from '../lib/frozenNow';
import { formatListDateTime } from '../lib/format';
import { plPlural } from '../lib/plPlural';
import { trackingPhase } from '../lib/stageTiles';
import {
  ZONE_KINDS, changeParts, groupOf, groupZones, impactOf, insideNow, parseCenter, parseNum, radiusText, routeOf,
  type ZoneChange, type ZoneRoute, type ZoneRow,
} from '../lib/p8cZones';
import { zonesOf, type NearPos, type ZoneDraft, type ZonesSource } from '../lib/p8cSource';
import { geofenceTypeLabel } from '../lib/enumLabels';
import type { GeofenceType } from '../types';
import { p8ct, type P8cKey } from '../i18n/p8c';
import '../components/zones/zones.css';
import { lazyRetry } from '../lib/lazyRetry';
import { serverRuleOn, SOON } from '../lib/serverRules';
import { accountRole } from '../lib/accountRole';

const ZonesMap = lazy(lazyRetry(() => import('../components/zones/ZonesMap')));

type Circle = { lat: number; lng: number; radiusM: number };
type Pos = { code: string; lat: number; lng: number };
type SaveResult = { ok: boolean; zone?: ZoneRow; error?: string };
const dayOf = (iso: string) => formatListDateTime(iso).split(', ')[0] ?? '';
/** jedna kolumna (komputer 769–1100 px): karta strefy jest pod listą */
const narrow = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1100px)').matches;

function doesKey(z: ZoneRow): P8cKey {
  if (!ZONE_KINDS.includes(z.type)) return 'p8c_do_other';
  if (z.type === 'PRE_ARRIVAL') return groupOf(z) === 'boden' ? 'p8c_do_PRE_ARRIVAL_SE' : 'p8c_do_PRE_ARRIVAL_PL';
  return `p8c_do_${z.type}` as P8cKey;
}
function doesList(z: ZoneRow): string[] {
  const route = p8ct(`p8c_route_${routeOf(z) ?? 'POLFERRIES'}`);
  if (!ZONE_KINDS.includes(z.type)) return [p8ct('p8c_does_other')];
  const key = (z.type === 'PRE_ARRIVAL' ? (groupOf(z) === 'boden' ? 'p8c_does_PRE_ARRIVAL_SE' : 'p8c_does_PRE_ARRIVAL_PL') : `p8c_does_${z.type}`) as P8cKey;
  const lines = p8ct(key, { route }).split('|');
  /* W-naprawy-2 (A2): wyjazd z placu → „Dostarczone” i wyjazd ze Śremu bez potwierdzenia — dopiero gdy działa na serwerze */
  if (z.type === 'SITE' && !serverRuleOn('SITE_EXIT_DELIVERED')) lines[1] = p8ct('p8c_does_SITE_exit_soon', { soon: SOON });
  if (z.type === 'LOADING' && serverRuleOn('SITE_EXIT_DELIVERED')) lines[1] = p8ct('p8c_does_LOADING_exit_a2');
  return lines;
}
/** Wiersz listy: „1 000 m · wjazd → Na placu · …”; bufory bez promienia na początku (img/e34-after). */
function lineOf(z: ZoneRow): string {
  const route = p8ct(`p8c_route_${routeOf(z) ?? 'POLFERRIES'}`);
  const does = p8ct(doesKey(z), { route });
  return z.radiusM >= 10_000 ? does : `${radiusText(z.radiusM)} · ${does}`;
}
function lastText(z: ZoneRow): string {
  if (!z.last) return '—';
  return p8ct(`p8c_last_${z.last.kind}`, { code: z.last.code, d: dayOf(z.last.at) });
}
/** „promień 1 500 → 1 000 m”; jednostka przy pierwszej liczbie tylko wtedy, gdy różni się od drugiej („800 m → 12 km”). */
function radiusChange(a: number, b: number): string {
  const ta = radiusText(a);
  const tb = radiusText(b);
  const m = '\u00a0m';
  return p8ct('p8c_h_radius', { a: ta.endsWith(m) && tb.endsWith(m) ? ta.slice(0, -m.length) : ta, b: tb });
}
function histText(c: ZoneChange): string {
  const why = c.reason ? p8ct('p8c_h_reason', { r: c.reason }) : '';
  if (c.active === false) return [p8ct('p8c_h_off'), why].filter(Boolean).join(' · ');
  if (c.active === true) return [p8ct('p8c_h_on'), why].filter(Boolean).join(' · ');
  if (!c.before) return p8ct('p8c_h_created', { r: radiusText(c.after.radiusM) });
  const { moved, radius } = changeParts(c);
  return [
    moved != null ? p8ct('p8c_h_moved', { m: radiusText(moved) }) : '',
    radius ? radiusChange(radius[0], radius[1]) : '',
    c.notify?.length ? p8ct('p8c_h_notify', { who: c.notify.join(', ') }) : '',
    why || p8ct('p8c_h_noreason'),
  ].filter(Boolean).join(' · ');
}
const edgeText = (m: number) => (m > 0 ? p8ct('p8c_impact_out', { m: radiusText(m) }) : p8ct('p8c_impact_inside', { m: radiusText(-m) }));
const countryOf = (z: Pick<ZoneRow, 'country' | 'lat'>): 'PL' | 'SE' => (z.country ? (z.country === 'SE' ? 'SE' : 'PL') : z.lat > 56 ? 'SE' : 'PL');

export function ZonesView() {
  const phone = useIsPhone();
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const nowIso = useMemo(() => new Date(nowMin * 60_000).toISOString(), [nowMin]);
  const acct = accountRole(role);
  /* #413: źródło zależne od konta (saveZone tylko Administrator HHL) */
  const src = useMemo(() => zonesOf(), [acct]);
  /* E9: zmienia tylko Administrator HHL; Operacje HHL — podgląd */
  const canEdit = role === 'HHL' && acct !== 'HHL_OPS' && !!src?.saveZone;
  const [zones, setZones] = useState<ZoneRow[] | null>(src?.initial ?? null);
  const [loadErr, setLoadErr] = useState(false);
  const [rev, setRev] = useState(0);
  const [sel, setSel] = useState<string | null>(() => (phone ? null : (src?.initial?.find((z) => z.type === 'SITE') ?? src?.initial?.[0])?.id ?? null));
  const [adding, setAdding] = useState(false);
  /* jeden stały obszar komunikatów („Zapisano”, „Dodano strefę”, „Strefa wyłączona”) — czytnik ekranu go słyszy */
  const [note, setNote] = useState('');
  const [reveal, setReveal] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const items = useRef(new Map<string, HTMLButtonElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  const focusAdd = useRef(false);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    void src.zones().then((z) => {
      if (!alive) return;
      setZones(z);
      setSel((s) => s ?? (phone ? null : (z.find((x) => x.type === 'SITE') ?? z[0])?.id ?? null));
    }, () => { if (alive) setLoadErr(true); });
    return () => { alive = false; };
  }, [src, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  /* po „Anuluj” w nowej strefie fokus wraca na „+ Strefa” */
  useEffect(() => {
    if (!adding && focusAdd.current) { focusAdd.current = false; addRef.current?.focus(); }
  });

  const tracked = useMemo(() => loads.filter((l) => trackingPhase(l, nowIso) === 'on'), [loads, nowIso]);

  if (!src) return null;
  const live = <p className="zv-live" role="status">{note}</p>;
  if (!zones) {
    return (
      <>
        {live}
        {loadErr ? (
          <div className="zv-fail" role="alert">
            <span>{p8ct('p8c_zones_fail')}</span>
            <button type="button" className="btn" onClick={() => { setLoadErr(false); setRev((n) => n + 1); }}>{p8ct('p8c_retry')}</button>
          </div>
        ) : <p className="zv-loading" role="status">{p8ct('p8c_loading')}</p>}
      </>
    );
  }

  const zone = zones.find((z) => z.id === sel) ?? null;
  /* audyt-teksty (d), makieta E34 telefon: na telefonie Boden pierwszy, dalej według trasy */
  const byRoute = groupZones(zones);
  const groups = phone ? [...byRoute.filter((g) => g.group === 'boden'), ...byRoute.filter((g) => g.group !== 'boden')] : byRoute;
  const open = (id: string) => { setSel(id); setAdding(false); setNote(''); setFocusId(null); setReveal((n) => n + 1); };
  const back = () => {
    const id = sel;
    setSel(null);
    if (id) window.setTimeout(() => items.current.get(id)?.focus(), 0);
  };

  const list = (
    <div className="zv-list">
      {groups.map(({ group, zones: zs }) => (
        <section key={group} className="zv-grp" aria-labelledby={`zv-g-${group}`}>
          <h3 className="zv-grp-h" id={`zv-g-${group}`}>{p8ct(`p8c_g_${group}` as P8cKey)}</h3>
          <ul>
            {zs.map((z) => (
              <li key={z.id}>
                <button
                  ref={(b) => { if (b) items.current.set(z.id, b); else items.current.delete(z.id); }}
                  type="button"
                  className={`zv-item${z.id === sel ? ' is-cur' : ''}${z.active ? '' : ' is-off'}`}
                  aria-current={z.id === sel ? 'true' : undefined}
                  onClick={() => open(z.id)}
                  data-zone={z.id}
                >
                  <span className="zv-item-n">
                    <b>{z.name}</b>
                    <small>{lineOf(z)}{z.active ? '' : ` · ${p8ct('p8c_off')}`}</small>
                    {phone && z.last ? <small className="zv-item-last">{lastText(z)}</small> : null}
                  </span>
                  {phone ? <span className="zv-chev" aria-hidden="true">›</span> : <span className="zv-last">{lastText(z)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  const header = (
    <header className="zv-hd">
      <h2>{p8ct('p8c_title')}</h2>
      {/* makieta E34 telefon: w nagłówku sama liczba stref; „+ Strefa” pod listą */}
      <span className="zv-sub" data-zone-count>{phone ? zones.length : p8ct('p8c_sub', { n: zones.length })}</span>
      {canEdit && !adding && !phone ? (
        <button ref={addRef} type="button" className="btn zv-add" onClick={() => { setAdding(true); setNote(''); setReveal((n) => n + 1); }} data-zone-add>{p8ct('p8c_add')}</button>
      ) : null}
    </header>
  );

  const card = adding ? (
    <ZoneForm
      key="new"
      zone={null}
      tracked={tracked}
      near={[]}
      phone={phone}
      reveal={reveal}
      onCancel={() => { focusAdd.current = true; setAdding(false); }}
      onSave={async (d, reason) => {
        const r: SaveResult = await src.saveZone!(null, d, reason).catch(() => ({ ok: false }));
        if (!r.ok) return false;
        const z = r.zone;
        if (z) {
          setZones((zs) => [...(zs ?? []), z]);
          setSel(z.id);
          setFocusId(z.id);
        } else {
          /* źródło nie oddało strefy — lista od nowa z bazy */
          focusAdd.current = true;
          setRev((n) => n + 1);
        }
        setAdding(false);
        setNote(p8ct('p8c_created'));
        return true;
      }}
    />
  ) : zone ? (
    <ZoneCard
      key={zone.id}
      zone={zone}
      tracked={tracked}
      canEdit={canEdit}
      phone={phone}
      reveal={reveal}
      autoFocus={focusId === zone.id}
      onBack={phone ? back : null}
      src={src}
      onNote={setNote}
      onSaved={(z) => setZones((zs) => (zs ?? []).map((x) => (x.id === z.id ? z : x)))}
    />
  ) : null;

  let body;
  if (phone) {
    body = card && (sel || adding) ? (
      <div className="zv is-phone is-card" data-page="geofence">{card}</div>
    ) : (
      <div className="zv is-phone" data-page="geofence">
        {header}
        {!canEdit ? <p className="zv-ro">{p8ct('p8c_ro')}</p> : null}
        <Suspense fallback={<div className="zm zm-all" />}>
          <ZonesMap mode="all" zones={zones} label={p8ct('p8c_map_label')} />
        </Suspense>
        {list}
        {canEdit && !adding ? (
          <div className="zv-add-row">
            <button ref={addRef} type="button" className="btn zv-add" onClick={() => { setAdding(true); setNote(''); setReveal((n) => n + 1); }} data-zone-add>{p8ct('p8c_add')}</button>
          </div>
        ) : null}
        <p className="zv-foot">{p8ct('p8c_phone_note')}</p>
      </div>
    );
  } else {
    body = (
      <div className="zv" data-page="geofence">
        <div className="zv-side">
          {header}
          {!canEdit ? <p className="zv-ro">{p8ct('p8c_ro')}</p> : null}
          <Suspense fallback={<div className="zm zm-all" />}>
            <ZonesMap mode="all" zones={zones} label={p8ct('p8c_map_label')} />
          </Suspense>
          {list}
          <p className="zv-foot">{p8ct('p8c_list_foot')}</p>
        </div>
        <div className="zv-main">{card}</div>
      </div>
    );
  }
  return <>{live}{body}</>;
}

function ZoneCard({ zone, tracked, canEdit, phone, reveal, autoFocus, onBack, src, onNote, onSaved }: {
  zone: ZoneRow;
  tracked: readonly Pos[];
  canEdit: boolean;
  phone: boolean;
  reveal: number;
  autoFocus: boolean;
  onBack: (() => void) | null;
  src: ZonesSource;
  onNote: (text: string) => void;
  onSaved: (z: ZoneRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hist, setHist] = useState<ZoneChange[] | null>(null);
  const [histErr, setHistErr] = useState(false);
  const [histRev, setHistRev] = useState(0);
  const [near, setNear] = useState<NearPos[]>([]);
  const [prev, setPrev] = useState<number | null>(null);
  const [ask, setAsk] = useState(false);
  const [askReason, setAskReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef<'edit' | 'toggle' | null>(null);
  const hid = useId();

  useEffect(() => {
    let alive = true;
    void src.history(zone.id).then(
      (h) => { if (alive) { setHist(h); setHistErr(false); setPrev(null); } },
      () => { if (alive) setHistErr(true); },
    );
    return () => { alive = false; };
  }, [src, zone.id, histRev]);
  useEffect(() => {
    let alive = true;
    void src.near(zone.id).then((n) => { if (alive) setNear(n); }, () => undefined);
    return () => { alive = false; };
  }, [src, zone.id]);

  /* telefon i nowa strefa: fokus na tytule karty */
  useEffect(() => { if (phone || autoFocus) titleRef.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* 769–1100 px: karta jest pod listą — po wyborze strefy przewijamy do niej */
  useEffect(() => {
    if (phone || reveal === 0 || !narrow()) return;
    titleRef.current?.scrollIntoView({ block: 'start' });
    titleRef.current?.focus({ preventScroll: true });
  }, [reveal, phone]);
  useEffect(() => { if (ask) askRef.current?.focus(); }, [ask]);
  /* po „Anuluj”, zapisie albo wyłączeniu fokus wraca na przycisk, który otworzył zmianę */
  useEffect(() => {
    const r = refocus.current;
    if (!r || editing || ask) return;
    refocus.current = null;
    (r === 'edit' ? editRef : toggleRef).current?.focus();
  });

  if (editing) {
    return (
      <ZoneForm
        zone={zone}
        tracked={tracked}
        near={near}
        phone={phone}
        reveal={0}
        onCancel={() => { refocus.current = 'edit'; setEditing(false); }}
        onSave={async (d, reason) => {
          const r: SaveResult = await src.saveZone!(zone.id, d, reason).catch(() => ({ ok: false }));
          if (!r.ok) return false;
          refocus.current = 'edit';
          onSaved(r.zone ?? { ...zone, ...d });
          setEditing(false);
          setHistRev((n) => n + 1);
          onNote(p8ct('p8c_saved'));
          return true;
        }}
      />
    );
  }

  const n = insideNow(tracked, zone);
  const shown = prev != null && hist?.[prev]?.before ? hist[prev]!.before : null;
  const country = p8ct(countryOf(zone) === 'SE' ? 'p8c_country_SE' : 'p8c_country_PL');
  const samplesWord = plPlural(zone.samplesRequired, 'pozycja', 'pozycje', 'pozycji');
  const meta = p8ct('p8c_card_meta', { country, r: radiusText(zone.radiusM), n });
  const errId = `${hid}-ask-err`;

  const toggle = async () => {
    if (!src.setActive || busyRef.current) return;
    if (!askReason.trim()) { setErr(p8ct('p8c_err_reason')); askRef.current?.focus(); return; }
    busyRef.current = true;
    setBusy(true);
    const r = await src.setActive(zone.id, !zone.active, askReason.trim()).catch(() => ({ ok: false }));
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) { setErr(p8ct('p8c_fail')); return; }
    refocus.current = 'toggle';
    setAsk(false);
    setAskReason('');
    setErr('');
    onNote(p8ct(zone.active ? 'p8c_off_done' : 'p8c_on_done'));
    onSaved({ ...zone, active: !zone.active });
    setHistRev((x) => x + 1);
  };
  const act = p8ct(zone.active ? 'p8c_disable' : 'p8c_enable');

  return (
    <section className="zv-card" aria-labelledby={hid} data-zone-card={zone.id}>
      <header className="zv-card-hd">
        {onBack ? <button type="button" className="zv-back" aria-label={p8ct('p8c_back')} onClick={onBack}>‹</button> : null}
        <h3 id={hid} ref={titleRef} tabIndex={-1}>{zone.name}</h3>
        <span className="zv-kind">{geofenceTypeLabel(zone.type)}</span>
        {!zone.active ? <span className="zv-kind is-off">{p8ct('p8c_off')}</span> : null}
        <span className="zv-meta">{zone.last ? `${meta} · ${p8ct('p8c_card_last', { t: lastText(zone) })}` : meta}</span>
        {canEdit ? (
          <span className="zv-acts">
            <button ref={editRef} type="button" className="btn" onClick={() => { setAsk(false); setErr(''); onNote(''); setEditing(true); }} data-zone-edit>{p8ct('p8c_change')}</button>
            {src.setActive ? (
              <button ref={toggleRef} type="button" className="btn ghost" aria-expanded={ask} onClick={() => { setAsk(true); setErr(''); onNote(''); }} data-zone-off>{act}</button>
            ) : null}
          </span>
        ) : null}
      </header>
      {ask ? (
        <div className="zv-ask" role="group" aria-label={act}>
          <label className="zv-field">
            <span>{p8ct(zone.active ? 'p8c_off_ask' : 'p8c_on_ask')}</span>
            <input
              ref={askRef}
              className="input"
              value={askReason}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? errId : undefined}
              onChange={(e) => { setAskReason(e.target.value); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void toggle(); }}
              data-zone-off-reason
            />
          </label>
          <span className="zv-ask-acts">
            <button type="button" className="btn" aria-disabled={busy || undefined} onClick={() => void toggle()} data-zone-off-yes>{act}</button>
            <button type="button" className="btn ghost" onClick={() => { refocus.current = 'toggle'; setAsk(false); setAskReason(''); setErr(''); }}>{p8ct('p8c_cancel')}</button>
          </span>
          {err ? <p className="zv-err zv-wide" id={errId} role="alert">{err}</p> : null}
        </div>
      ) : null}

      <Suspense fallback={<div className="zm zm-one" />}>
        <ZonesMap mode="one" zone={zone} prev={shown} near={near} label={`${p8ct('p8c_map_label')}: ${zone.name}`} />
      </Suspense>

      <div className="zv-params">
        <div><span className="zv-pk">{p8ct('p8c_p_hyst')}</span><b>{radiusText(zone.hysteresisM)}</b><span>{p8ct('p8c_p_hyst_d')}</span></div>
        <div><span className="zv-pk">{p8ct('p8c_p_samples')}</span><b>{p8ct('p8c_p_samples_v', { n: zone.samplesRequired, word: samplesWord })}</b><span>{p8ct('p8c_p_samples_d')}</span></div>
        <div><span className="zv-pk">{p8ct('p8c_p_dwell')}</span><b>{`${zone.dwellMin}\u00a0min`}</b><span>{p8ct('p8c_p_dwell_d')}</span></div>
      </div>

      <h4 className="zv-h">{p8ct('p8c_does')}</h4>
      <ul className="zv-does">{doesList(zone).map((x, i) => <li key={i}>{x}</li>)}</ul>

      <h4 className="zv-h">{p8ct('p8c_hist')}</h4>
      {histErr ? (
        <div className="zv-fail is-inline" role="alert">
          <span>{p8ct('p8c_hist_fail')}</span>
          <button type="button" className="btn ghost" onClick={() => { setHistErr(false); setHistRev((x) => x + 1); }}>{p8ct('p8c_retry')}</button>
        </div>
      ) : hist && hist.length ? (
        <ul className="zv-hist">
          {hist.map((c, i) => {
            const can = !!c.before && c.active == null;
            const on = prev === i;
            const text = histText(c);
            return (
              <li key={`${c.at}-${i}`}>
                {can ? (
                  <button type="button" className={`zv-hist-b${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setPrev(on ? null : i)} data-zone-hist={i}>
                    <b>{formatListDateTime(c.at)} · {c.who}</b> · {text}
                    <span className="sr-only"> — {on ? p8ct('p8c_h_hide') : p8ct('p8c_h_show', { at: formatListDateTime(c.at) })}</span>
                  </button>
                ) : (
                  <span className="zv-hist-b is-static"><b>{c.active != null ? formatListDateTime(c.at) : dayOf(c.at)} · {c.who}</b> · {text}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p className="zv-hint">{hist ? p8ct('p8c_hist_none') : '…'}</p>}
      {!histErr && hist && hist.some((c) => c.before && c.active == null) ? <p className="zv-hint">{p8ct('p8c_hist_note')}</p> : null}
    </section>
  );
}

type Field = 'name' | 'center' | 'radius' | 'hyst' | 'samples' | 'dwell' | 'reason';
const FIELDS: readonly Field[] = ['name', 'center', 'radius', 'hyst', 'samples', 'dwell', 'reason'];

function ZoneForm({ zone, tracked, near, phone, reveal, onCancel, onSave }: {
  zone: ZoneRow | null;
  tracked: readonly Pos[];
  near: readonly NearPos[];
  phone: boolean;
  reveal: number;
  onCancel: () => void;
  onSave: (d: ZoneDraft, reason: string) => Promise<boolean>;
}) {
  const id = useId();
  const [name, setName] = useState(zone?.name ?? '');
  const [type, setType] = useState<GeofenceType>(zone?.type ?? 'PRE_ARRIVAL');
  const [country, setCountry] = useState<'PL' | 'SE'>(zone ? countryOf(zone) : 'PL');
  /* nowa strefa: kraj ze środka (powyżej 56° — Szwecja), dopóki ktoś nie wybierze go sam */
  const [countryTouched, setCountryTouched] = useState(false);
  const [route, setRoute] = useState<ZoneRoute>(zone ? routeOf(zone) ?? 'POLFERRIES' : 'POLFERRIES');
  const fmt = (v: number) => String(Math.round(v * 1e5) / 1e5).replace('.', ',');
  const [center, setCenter] = useState(zone ? `${fmt(zone.lat)} ${fmt(zone.lng)}` : '');
  const [radius, setRadius] = useState(String(zone?.radiusM ?? 800));
  const [hyst, setHyst] = useState(String(zone?.hysteresisM ?? 200));
  const [samples, setSamples] = useState(String(zone?.samplesRequired ?? 2));
  const [dwell, setDwell] = useState(String(zone?.dwellMin ?? 10));
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({});
  const [fail, setFail] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const refs = useRef(new Map<Field, HTMLInputElement>());
  useEffect(() => {
    alive.current = true;
    const t = titleRef.current;
    if (t) {
      if (!phone && reveal > 0 && narrow()) t.scrollIntoView({ block: 'start' });
      t.focus({ preventScroll: true });
    }
    return () => { alive.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const c = useMemo(() => parseCenter(center), [center]);
  const r = parseNum(radius);
  const h = parseNum(hyst);
  const draft = useMemo<Circle | null>(() => (c && r != null && r >= 100 && r <= 60_000 ? { lat: c.lat, lng: c.lng, radiusM: r } : null), [c, r]);
  const shownCountry: 'PL' | 'SE' = zone || countryTouched ? country : c ? (c.lat > 56 ? 'SE' : 'PL') : country;
  /* ostatnie pozycje przy strefie (z godziną) i transporty w oknie śledzenia bez takiej pozycji */
  const base = useMemo(() => {
    const seen = new Set(near.map((p) => p.code));
    return [...near, ...tracked.filter((t) => !seen.has(t.code)).map((t) => ({ code: t.code, lat: t.lat, lng: t.lng }))] as (Pos & { at?: string; label?: string })[];
  }, [near, tracked]);
  const hm = h != null && h <= 5_000 ? h : zone?.hysteresisM ?? 0;
  const impact = useMemo(() => (zone && draft ? impactOf(base, zone, draft, hm) : []), [zone, draft, base, hm]);

  const clear = (k: Field) => { setFail(''); setErrs((e) => (e[k] ? { ...e, [k]: undefined } : e)); };
  const validate = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    const s = parseNum(samples);
    const d = parseNum(dwell);
    if (!zone && !name.trim()) e.name = p8ct('p8c_err_name');
    if (!c) e.center = p8ct('p8c_err_center');
    if (r == null || r < 100 || r > 60_000) e.radius = p8ct('p8c_err_radius');
    if (h == null || h > 5_000) e.hyst = p8ct('p8c_err_hyst');
    if (s == null || !Number.isInteger(s) || s < 1 || s > 10) e.samples = p8ct('p8c_err_samples');
    if (d == null || d > 240) e.dwell = p8ct('p8c_err_dwell');
    if (!reason.trim()) e.reason = p8ct('p8c_err_reason');
    return e;
  };

  const submit = async () => {
    if (busyRef.current) return;
    const e = validate();
    setErrs(e);
    setFail('');
    const first = FIELDS.find((k) => e[k]);
    if (first) { refs.current.get(first)?.focus(); return; }
    const ports = type === 'PORT_OUT' || type === 'PORT_IN' || type === 'PRE_PORT';
    busyRef.current = true;
    setBusy(true);
    const ok = await onSave({
      name: zone ? zone.name : name.trim(),
      type: zone ? zone.type : type,
      country: shownCountry,
      route: ports ? route : null,
      lat: c!.lat,
      lng: c!.lng,
      radiusM: Math.round(r!),
      hysteresisM: Math.round(h!),
      samplesRequired: parseNum(samples)!,
      dwellMin: Math.round(parseNum(dwell)!),
    }, reason.trim()).catch(() => false);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (!ok) setFail(p8ct('p8c_fail'));
  };

  const field = (k: Field, label: string, input: { value: string; set: (v: string) => void; mode?: 'decimal' | 'numeric'; ph?: string }, cls = '') => (
    <div className={`zv-field${cls}`}>
      <label htmlFor={`${id}-${k}`}>{label}</label>
      <input
        ref={(el) => { if (el) refs.current.set(k, el); else refs.current.delete(k); }}
        id={`${id}-${k}`}
        className="input"
        value={input.value}
        inputMode={input.mode}
        placeholder={input.ph}
        aria-invalid={errs[k] ? true : undefined}
        aria-describedby={errs[k] ? `${id}-${k}-err` : undefined}
        onChange={(e) => { input.set(e.target.value); clear(k); }}
        data-zone-f={k}
      />
      {errs[k] ? <span className="zv-ferr" id={`${id}-${k}-err`}>{errs[k]}</span> : null}
    </div>
  );
  const title = zone ? p8ct('p8c_form_title', { name: zone.name }) : p8ct('p8c_form_new');
  const kind = zone ? zone.type : type;
  const ports = kind === 'PORT_OUT' || kind === 'PORT_IN' || kind === 'PRE_PORT';

  return (
    <section className="zv-card zv-form" aria-labelledby={`${id}-t`} data-zone-form={zone?.id ?? 'new'}>
      <header className="zv-card-hd">
        {phone ? <button type="button" className="zv-back" aria-label={p8ct('p8c_cancel')} onClick={onCancel}>‹</button> : null}
        <h3 id={`${id}-t`} ref={titleRef} tabIndex={-1}>{title}</h3>
      </header>
      <Suspense fallback={<div className="zm zm-one" />}>
        <ZonesMap
          mode="one"
          zone={zone}
          draft={draft}
          near={near}
          onMove={(a, b) => { setCenter(`${fmt(a)} ${fmt(b)}`); clear('center'); }}
          label={`${p8ct('p8c_map_label')}: ${title}`}
        />
      </Suspense>
      <p className="zv-hint">{p8ct('p8c_f_map_hint')}</p>
      <div className="zv-fields">
        {!zone ? (
          <>
            {field('name', p8ct('p8c_f_name'), { value: name, set: setName }, ' zv-wide')}
            <div className="zv-field">
              <label htmlFor={`${id}-type`}>{p8ct('p8c_f_type')}</label>
              <select id={`${id}-type`} className="input" value={type} onChange={(e) => setType(e.target.value as GeofenceType)}>
                {ZONE_KINDS.map((k) => <option key={k} value={k}>{geofenceTypeLabel(k)}</option>)}
              </select>
            </div>
            <div className="zv-field">
              <label htmlFor={`${id}-country`}>{p8ct('p8c_f_country')}</label>
              <select id={`${id}-country`} className="input" value={shownCountry} onChange={(e) => { setCountry(e.target.value === 'SE' ? 'SE' : 'PL'); setCountryTouched(true); }}>
                <option value="PL">{p8ct('p8c_country_PL')}</option>
                <option value="SE">{p8ct('p8c_country_SE')}</option>
              </select>
            </div>
          </>
        ) : null}
        {ports ? (
          <div className="zv-field">
            <label htmlFor={`${id}-route`}>{p8ct('p8c_f_route')}</label>
            <select id={`${id}-route`} className="input" value={route} onChange={(e) => setRoute(e.target.value === 'STENA' ? 'STENA' : 'POLFERRIES')}>
              <option value="POLFERRIES">{p8ct('p8c_route_POLFERRIES')}</option>
              <option value="STENA">{p8ct('p8c_route_STENA')}</option>
            </select>
          </div>
        ) : null}
        {field('center', p8ct('p8c_f_center'), { value: center, set: setCenter, mode: 'decimal' })}
        {field('radius', p8ct('p8c_f_radius'), { value: radius, set: setRadius, mode: 'numeric' })}
        {field('hyst', p8ct('p8c_f_hyst'), { value: hyst, set: setHyst, mode: 'numeric' })}
        {field('samples', p8ct('p8c_f_samples'), { value: samples, set: setSamples, mode: 'numeric' })}
        {field('dwell', p8ct('p8c_f_dwell'), { value: dwell, set: setDwell, mode: 'numeric' })}
        {field('reason', p8ct('p8c_f_reason'), { value: reason, set: setReason, ph: p8ct('p8c_f_reason_ph') }, ' zv-wide zv-reason')}
      </div>

      {zone ? (
        <div className="zv-impact" data-zone-impact>
          <h4 className="zv-h">{p8ct('p8c_impact')}</h4>
          {impact.length ? (
            <ul>
              {impact.map((x) => {
                const p = x.item;
                const b = edgeText(x.beforeM);
                const a = edgeText(x.afterM);
                const row = p.label
                  ? p8ct('p8c_impact_row', { code: p.code, label: p.label, at: p.at ? formatListDateTime(p.at) : '', b, a }).replace(/ {2,}/g, ' ').replace(' :', ':')
                  : p8ct('p8c_impact_row2', { code: p.code, b, a });
                /* był w strefie, po zmianie poza kołem, ale w marginesie granicy — silnik nie zapisze wyjazdu */
                const margin = x.change === 'none' && x.beforeM <= 0 && x.afterM > 0;
                const verdict = x.change === 'enter' ? p8ct('p8c_impact_enter')
                  : x.change === 'exit' ? p8ct('p8c_impact_exit')
                    : margin ? p8ct('p8c_impact_margin', { m: radiusText(hm) }) : p8ct('p8c_impact_keep');
                return <li key={p.code}>{row} <b>{verdict}</b></li>;
              })}
            </ul>
          ) : <p className="zv-hint">{p8ct('p8c_impact_none')}</p>}
          <p className="zv-hint">{p8ct('p8c_impact_rule')}</p>
        </div>
      ) : null}

      {fail ? <p className="zv-err" role="alert">{fail}</p> : null}
      <div className="zv-form-acts">
        <button type="button" className="btn ghost" onClick={onCancel}>{p8ct('p8c_cancel')}</button>
        <button type="button" className="btn" aria-disabled={busy || undefined} onClick={() => void submit()} data-zone-save>{p8ct('p8c_save')}</button>
      </div>
    </section>
  );
}
