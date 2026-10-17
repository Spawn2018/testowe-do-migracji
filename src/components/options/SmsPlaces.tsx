/**
 * wyglad/P8-b — Opcje › Powiadomienia › SMS przy miejscach (E42, decyzje 07.10.2026, 22:15; img/e42-after).
 * Kafelki: wysyłka do odbiorców (tryb testowy), wyprzedzenie 60 min, „auto czeka” 30 min / 2 km, cisza nocna 20:00–06:00.
 * Miejsca: Załadunek · KSH Śrem i Rozładunek · plac Stegra Boden, po 2 osoby; osoba z Użytkowników (E6) albo numer
 * wpisany ręcznie; przy osobie rodzaje A–D (B tylko Boden). Pusta lista — „SMS dla Boden nie wyjdą” z transportami,
 * których to dziś dotyczy. Bez wyboru języka (E43, 22:42); obok numeru kierunkowy PL / SE. Numery w pełnej postaci
 * (15.10, 03:12). Zmienia tylko Administrator HHL; Operacje HHL — podgląd; przełącznik wysyłki — tylko właściciel.
 * Telefon: kafelki Wysyłka i Cisza nocna, miejsce bez odbiorców rozwinięte na górze, miejsce z odbiorcami zwinięte do
 * wiersza „imię · numer · A, C, D”.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { getNow } from '../../lib/frozenNow';
import { formatListDateTime } from '../../lib/format';
import { plPlural } from '../../lib/plPlural';
import { useIsPhone } from '../../lib/useIsPhone';
import {
  LEAD_MIN, QUIET, QUIET_SHORT, WAIT_KM, WAIT_MIN, affectedLoads, kindsFor, nationalText, parsePhone, peopleCount, personFromUser,
  personPhone, personSummary, samePhone,
  type PlaceId, type PlaceView, type SmsKind, type SmsPlacesState, type ZonePerson, type ZoneUser,
} from '../../lib/p8bPlaces';
import { smsPlacesOf } from '../../lib/p8bSource';
import { p8bt } from '../../i18n/p8b';
import './smsPlaces.css';

type Note = { text: string; bad: boolean; field?: 'phone' | 'kinds' } | null;

const sortIds = (s: SmsPlacesState): PlaceId[] => [...s.places].sort((a, b) => peopleCount(a) - peopleCount(b)).map((x) => x.id);

export function SmsPlaces({ readOnly }: { readOnly: boolean }) {
  const src = useMemo(() => smsPlacesOf(), []);
  const phone = useIsPhone();
  const loads = useTowerStore((s) => s.loads);
  const nowMin = Math.floor(getNow().getTime() / 60_000);
  const nowIso = useMemo(() => new Date(nowMin * 60_000).toISOString(), [nowMin]);
  const [state, setState] = useState<SmsPlacesState | null>(src?.initial ?? null);
  /* telefon: miejsce bez odbiorców na górze — kolejność z chwili wczytania, żeby sekcje nie skakały przy zapisie */
  const [order, setOrder] = useState<PlaceId[] | null>(() => (src?.initial ? sortIds(src.initial) : null));
  const [users, setUsers] = useState<ZoneUser[] | null>(null);
  const [ask, setAsk] = useState(false);
  const [sending, setSendingBusy] = useState(false);
  const [sendNote, setSendNote] = useState<Note>(null);
  const toggleBtn = useRef<HTMLButtonElement>(null);
  const yesBtn = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);
  const ro = readOnly || !src?.savePerson;

  useEffect(() => {
    if (!src) return;
    let alive = true;
    void src.state().then((s) => {
      if (!alive) return;
      setState(s);
      setOrder((o) => o ?? sortIds(s));
    }, () => undefined);
    void src.users().then((u) => { if (alive) setUsers(u); }, () => { if (alive) setUsers([]); });
    return () => { alive = false; };
  }, [src]);

  /* pytanie o włączenie: fokus na „Tak, włącz”; po zamknięciu — z powrotem na przełącznik */
  useEffect(() => {
    if (ask) { yesBtn.current?.focus(); return; }
    if (focusToggle.current) { focusToggle.current = false; toggleBtn.current?.focus(); }
  }, [ask, state?.sending]);

  if (!src) return null;
  if (!state) return <p className="sp-loading" role="status">{p8bt('p8b_loading')}</p>;

  const savePerson = async (place: PlaceId, slot: 1 | 2, person: ZonePerson | null): Promise<boolean> => {
    if (ro || !src.savePerson) return false;
    const r = await src.savePerson(place, slot, person).catch(() => ({ ok: false }));
    if (!r.ok) return false;
    setState((s) => {
      if (!s) return s;
      const places = s.places.map((p) => {
        if (p.id !== place) return p;
        const people = [...p.people] as PlaceView['people'];
        people[slot - 1] = person;
        return { ...p, people };
      }) as SmsPlacesState['places'];
      return { ...s, places };
    });
    return true;
  };

  const setSending = async (on: boolean) => {
    if (!src.setSending || sending) return;
    setSendingBusy(true);
    const r = await src.setSending(on).catch(() => ({ ok: false }));
    setSendingBusy(false);
    focusToggle.current = true;
    setAsk(false);
    if (!r.ok) { setSendNote({ text: p8bt('p8b_fail'), bad: true }); return; }
    setState((s) => (s ? { ...s, sending: on } : s));
    setSendNote({ text: p8bt(on ? 'p8b_send_done_on' : 'p8b_send_done_off'), bad: false });
  };

  const canSwitch = !readOnly && !!src.setSending;
  const testTo = state.testTo ?? p8bt('p8b_send_test_to');
  const sendTile = (
    <div className={`sp-tile${state.sending ? '' : ' is-warn'}`} data-sp-send={state.sending ? 'on' : 'test'}>
      <span className="sp-tile-k">{p8bt(phone ? 'p8b_send_short' : 'p8b_send')}</span>
      <span className="sp-tile-v">
        {state.sending ? p8bt(phone ? 'p8b_send_on_phone' : 'p8b_send_on') : phone ? p8bt('p8b_send_off_phone') : p8bt('p8b_send_off', { to: testTo })}
      </span>
      {canSwitch && !ask ? (
        <button
          ref={toggleBtn}
          type="button"
          className="btn ghost sp-tile-btn"
          data-sp-send-btn
          aria-disabled={sending || undefined}
          onClick={() => { setSendNote(null); if (state.sending) void setSending(false); else setAsk(true); }}
        >
          {p8bt(state.sending ? 'p8b_send_btn_off' : 'p8b_send_btn_on')}
        </button>
      ) : null}
      {ask ? (
        <div className="sp-ask" role="group" aria-labelledby="sp-ask-q">
          <p id="sp-ask-q">{p8bt('p8b_send_ask')}</p>
          <div className="sp-ask-acts">
            <button ref={yesBtn} type="button" className="btn" data-sp-send-yes aria-disabled={sending || undefined} onClick={() => void setSending(true)}>
              {p8bt('p8b_send_yes')}
            </button>
            <button type="button" className="btn ghost" onClick={() => { focusToggle.current = true; setAsk(false); }}>{p8bt('p8b_send_no')}</button>
          </div>
        </div>
      ) : null}
      <span className="sp-live" role="status">{sendNote && !sendNote.bad ? sendNote.text : ''}</span>
      {sendNote?.bad ? <span className="sp-err" role="alert">{sendNote.text}</span> : null}
    </div>
  );
  const quietTile = (
    <div className="sp-tile">
      <span className="sp-tile-k">{p8bt('p8b_quiet')}</span>
      <span className="sp-tile-v">{phone ? QUIET_SHORT : p8bt('p8b_quiet_v', { from: QUIET.from, to: QUIET.to })}</span>
    </div>
  );

  const places = !phone ? state.places
    : (order ?? sortIds(state)).map((id) => state.places.find((x) => x.id === id)).filter((x): x is PlaceView => !!x);
  const gw = state.gateway;

  return (
    <section className={`sp${phone ? ' is-phone' : ''}`} data-screen="zones-sms">
      {!phone && !readOnly ? <p className="sp-ops">{p8bt('p8b_ops')}</p> : null}
      {readOnly ? <p className="sp-ro" data-sp-ro>{p8bt('p8b_ro')}</p> : null}
      <div className="sp-tiles">
        {sendTile}
        {!phone ? (
          <>
            <div className="sp-tile">
              <span className="sp-tile-k">{p8bt('p8b_lead')}</span>
              <span className="sp-tile-v">{p8bt('p8b_lead_v', { n: LEAD_MIN })}</span>
            </div>
            <div className="sp-tile">
              <span className="sp-tile-k">{p8bt('p8b_wait')}</span>
              <span className="sp-tile-v">{p8bt('p8b_wait_v', { min: WAIT_MIN, km: WAIT_KM })}</span>
            </div>
          </>
        ) : null}
        {quietTile}
      </div>

      {places.map((p) => (
        <Place
          key={p.id}
          place={p}
          users={users}
          readOnly={ro}
          phone={phone}
          affected={peopleCount(p) === 0 ? affectedLoads(p.id, loads, nowIso).map((l) => l.code) : []}
          onSave={(slot, person) => savePerson(p.id, slot, person)}
        />
      ))}

      <p className="sp-foot">
        {gw
          ? p8bt('p8b_gw', { state: p8bt(gw.active ? 'p8b_gw_on' : 'p8b_gw_off'), last: gw.lastSignal ? formatListDateTime(gw.lastSignal) : '—', today: gw.today, limit: gw.limit })
          : p8bt('p8b_gw_none')}
        {' '}{p8bt('p8b_fallback')}
      </p>
      {!phone ? <p className="sp-foot">{p8bt('p8b_kinds_note', { lead: LEAD_MIN })}</p> : null}
    </section>
  );
}

function affectsText(codes: readonly string[]): string {
  if (!codes.length) return '';
  if (codes.length <= 3) {
    const list = codes.length === 1 ? codes[0]! : `${codes.slice(0, -1).join(', ')} i ${codes[codes.length - 1]}`;
    return p8bt('p8b_affects_one', { codes: list });
  }
  return p8bt('p8b_affects_many', { n: codes.length, word: plPlural(codes.length, 'transportu', 'transportów', 'transportów'), codes: codes.slice(0, 2).join(', ') });
}

function Place({ place, users, readOnly, phone, affected, onSave }: {
  place: PlaceView;
  users: readonly ZoneUser[] | null;
  readOnly: boolean;
  phone: boolean;
  affected: readonly string[];
  onSave: (slot: 1 | 2, person: ZonePerson | null) => Promise<boolean>;
}) {
  const n = peopleCount(place);
  const [open, setOpen] = useState(n === 0);
  const hid = useId();
  const title = p8bt(phone ? `p8b_place_short_${place.id}` : `p8b_place_${place.id}`);
  const collapsed = phone && !open;
  return (
    <section className={`sp-place${n === 0 ? ' is-empty' : ''}`} data-sp-place={place.id} aria-labelledby={hid}>
      <header className="sp-place-hd">
        <h3 id={hid}>{title}</h3>
        <span className={`sp-count${n === 0 ? ' is-bad' : ''}`}>{p8bt(phone ? 'p8b_count_phone' : 'p8b_count', { n })}</span>
        {phone && n > 0 ? (
          <button
            type="button"
            className="sp-more"
            aria-expanded={open}
            aria-label={p8bt(open ? 'p8b_less' : 'p8b_more', { place: title })}
            onClick={() => setOpen((v) => !v)}
            data-sp-more={place.id}
          >
            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
        ) : null}
      </header>
      {n === 0 ? (
        <p className="sp-warn" data-sp-warn>
          {phone ? p8bt('p8b_empty_phone') : p8bt('p8b_empty', { site: p8bt(`p8b_site_${place.id}`) })}
          {!phone && affected.length ? ` ${affectsText(affected)}` : ''}
        </p>
      ) : null}
      {collapsed ? (
        <ul className="sp-sum">
          {place.people.filter((x): x is ZonePerson => !!x).map((x, i) => <li key={i}>{personSummary(x)}</li>)}
        </ul>
      ) : (
        <div className="sp-rows">
          {([1, 2] as const).map((slot) => (
            <PersonRow
              key={slot}
              place={place.id}
              slot={slot}
              person={place.people[slot - 1] ?? null}
              other={place.people[slot === 1 ? 1 : 0] ?? null}
              users={users}
              readOnly={readOnly}
              phone={phone}
              onSave={(person) => onSave(slot, person)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PersonRow({ place, slot, person, other, users, readOnly, phone, onSave }: {
  place: PlaceId;
  slot: 1 | 2;
  person: ZonePerson | null;
  /** druga osoba w tym miejscu — tej samej osoby ani numeru nie da się dodać dwa razy (E42: SMS raz na numer) */
  other: ZonePerson | null;
  users: readonly ZoneUser[] | null;
  readOnly: boolean;
  phone: boolean;
  onSave: (person: ZonePerson | null) => Promise<boolean>;
}) {
  const avail = kindsFor(place);
  /* manual = edycja numeru wpisanego ręcznie (osoba bez konta albo nowy numer) */
  const [manual, setManual] = useState(!!person && !person.userId);
  const [country, setCountry] = useState<'PL' | 'SE'>(person?.country ?? 'PL');
  const [raw, setRaw] = useState(person ? nationalText(person) : '');
  /* pusty wiersz bez zaznaczeń (jak na obrazie); osoba bez zaznaczeń dostaje wszystkie rodzaje miejsca */
  const [draftKinds, setDraftKinds] = useState<SmsKind[]>([]);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const selRef = useRef<HTMLSelectElement>(null);
  const id = useId();
  const errId = `${id}-err`;
  const placeName = p8bt(`p8b_place_short_${place}`);
  const who = p8bt('p8b_person', { slot });
  const kinds = person ? person.kinds : draftKinds;
  const savedText = person ? nationalText(person) : '';
  const dirty = manual && (person
    ? (person.userId ? raw.trim() !== '' : raw !== savedText || country !== person.country)
    : raw.trim() !== '');
  /* w trakcie zmiany: niezapisany numer albo osoba z konta przełączona na numer wpisany ręcznie */
  const editing = dirty || (manual && !!person?.userId);
  const showCancel = manual && (!person || editing);

  const sync = (p: ZonePerson | null) => {
    setManual(!!p && !p.userId);
    setCountry(p?.country ?? 'PL');
    setRaw(p ? nationalText(p) : '');
    setDraftKinds([]);
  };

  const run = async (next: ZonePerson | null, ok: string): Promise<boolean> => {
    if (readOnly || busy) return false;
    setBusy(true);
    const done = await onSave(next);
    setBusy(false);
    if (!done) { setNote({ text: p8bt('p8b_fail'), bad: true }); return false; }
    /* pola wiersza = to, co zapisane (wiersz nie zaczyna się od nowa, więc komunikat zostaje) */
    sync(next);
    setNote({ text: ok, bad: false });
    return true;
  };

  const pick = (v: string) => {
    if (readOnly) return;
    setNote(null);
    if (v === '') { sync(person); return; }
    if (v === 'manual') { setManual(true); setRaw(person && !person.userId ? nationalText(person) : ''); return; }
    const u = (users ?? []).find((x) => x.id === v);
    if (!u) return;
    const next = personFromUser(u, kinds.length ? kinds : avail);
    if (!next) return;
    if (other && (other.userId === next.userId || samePhone(other, next))) {
      setNote({ text: p8bt('p8b_err_dup', { slot: slot === 1 ? 2 : 1 }), bad: true, field: 'phone' });
      return;
    }
    void run(next, p8bt('p8b_saved'));
  };

  const saveManual = () => {
    if (readOnly || !manual || busy) return;
    const ph = parsePhone(raw, country);
    if (!ph) { setNote({ text: p8bt('p8b_err_phone'), bad: true, field: 'phone' }); return; }
    if (other && samePhone(other, ph)) { setNote({ text: p8bt('p8b_err_dup', { slot: slot === 1 ? 2 : 1 }), bad: true, field: 'phone' }); return; }
    const keepName = person && !person.userId ? person.name : '';
    void run({ userId: null, name: keepName, country: ph.country, phone: ph.phone, kinds: kinds.length ? kinds : avail }, p8bt('p8b_saved'));
  };

  const toggle = (k: SmsKind) => {
    if (readOnly || busy) return;
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : avail.filter((x) => x === k || kinds.includes(x));
    setNote(null);
    if (!person) { setDraftKinds(next); return; }
    if (!next.length) { setNote({ text: p8bt('p8b_err_kinds'), bad: true, field: 'kinds' }); return; }
    void run({ ...person, kinds: next }, p8bt('p8b_saved'));
  };

  const remove = async () => {
    if (await run(null, p8bt('p8b_removed'))) window.setTimeout(() => selRef.current?.focus(), 0);
  };

  const selValue = manual ? 'manual' : person?.userId ?? '';
  const known = (users ?? []).some((u) => u.id === person?.userId);
  const sel = (
    <select
      ref={selRef}
      className="input sp-sel"
      value={selValue}
      disabled={readOnly || busy}
      aria-label={`${placeName}: ${who}`}
      onChange={(e) => pick(e.target.value)}
      data-sp-pick={`${place}:${slot}`}
    >
      <option value="" disabled={!!person && !manual}>{phone ? p8bt('p8b_pick_phone', { slot }) : p8bt('p8b_pick')}</option>
      {person?.userId && !known ? <option value={person.userId}>{`${person.name} · ${personPhone(person)}`}</option> : null}
      {(users ?? []).map((u) => {
        const ok = personFromUser(u, avail);
        const taken = !!other?.userId && other.userId === u.id;
        return (
          <option key={u.id} value={u.id} disabled={!ok || taken}>
            {ok ? `${u.name} · ${personPhone(ok)}` : p8bt('p8b_pick_nophone', { name: u.name })}
          </option>
        );
      })}
      <option value="manual">{p8bt('p8b_pick_manual')}</option>
    </select>
  );
  const nameBox = person && !manual ? (
    <span className="sp-name" title={person.name || undefined} data-sp-name={`${place}:${slot}`}>{person.name || who}</span>
  ) : null;

  const editable = !readOnly && manual;
  const phoneCells = (
    <div className="sp-num">
      <select
        className="input sp-cc"
        value={country}
        disabled={!editable || busy}
        aria-label={`${placeName}, ${who}: ${p8bt('p8b_country_label')}`}
        onChange={(e) => { setCountry(e.target.value === 'SE' ? 'SE' : 'PL'); setNote(null); }}
      >
        <option value="PL">PL +48</option>
        <option value="SE">SE +46</option>
      </select>
      <input
        className="input sp-phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={raw}
        readOnly={readOnly || (!!person && !manual)}
        placeholder={p8bt('p8b_phone_ph')}
        aria-label={`${placeName}, ${who}: ${p8bt('p8b_phone_label')}`}
        aria-invalid={note?.bad && note.field === 'phone' ? true : undefined}
        aria-describedby={note?.bad && note.field === 'phone' ? errId : undefined}
        onFocus={() => { if (!readOnly && !person) setManual(true); }}
        onChange={(e) => { if (readOnly) return; setRaw(e.target.value); setManual(true); setNote(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !readOnly) { e.preventDefault(); saveManual(); } }}
        data-sp-phone={`${place}:${slot}`}
      />
    </div>
  );

  /* telefon: rodzaje przy osobie, przy edycji numeru i w pierwszym pustym wierszu (img/e42-after) */
  const showKinds = !phone || !!person || manual || slot === 1;
  const boxes = showKinds ? (
    <div className="sp-kinds" role="group" aria-label={`${placeName}, ${who}`}>
      {(['A', 'B', 'C', 'D'] as const).map((k) => {
        const na = !avail.includes(k);
        const on = !na && kinds.includes(k);
        const label = na ? p8bt('p8b_kind_B_na') : p8bt(`p8b_kind_${k}`);
        const vis = !!person && !phone ? `${k} ${label}` : k;
        return (
          <label key={k} className={`sp-kind${on ? ' is-on' : ''}${na ? ' is-na' : ''}`}>
            <input
              type="checkbox"
              checked={on}
              disabled={readOnly || busy || na || (!!person && editing)}
              onChange={() => toggle(k)}
              aria-label={p8bt('p8b_kind_aria', { vis, label, place: placeName, slot })}
              aria-describedby={note?.bad && note.field === 'kinds' ? errId : undefined}
              data-sp-kind={`${place}:${slot}:${k}`}
            />
            <span aria-hidden="true">{vis}</span>
          </label>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={`sp-row${person ? ' is-set' : ''}`} data-sp-row={`${place}:${slot}`}>
      <div className="sp-who">{nameBox && !phone ? nameBox : sel}</div>
      {!phone || manual ? phoneCells : null}
      {boxes}
      {!readOnly ? (
        <div className="sp-acts">
          {dirty ? (
            <button type="button" className="btn" aria-disabled={busy || undefined} onClick={saveManual} data-sp-save={`${place}:${slot}`}>{p8bt('p8b_save')}</button>
          ) : null}
          {showCancel ? (
            <button type="button" className="btn ghost" onClick={() => { sync(person); setNote(null); }} data-sp-cancel={`${place}:${slot}`}>{p8bt('p8b_cancel')}</button>
          ) : null}
          {person && !editing ? (
            <button
              type="button"
              className="btn ghost sp-del"
              aria-label={`${p8bt('p8b_remove')}: ${person.name || personPhone(person)} (${placeName})`}
              aria-disabled={busy || undefined}
              onClick={() => { void remove(); }}
              data-sp-del={`${place}:${slot}`}
            >
              {phone ? p8bt('p8b_remove') : '×'}
            </button>
          ) : null}
        </div>
      ) : null}
      {note?.bad ? <p className="sp-err" id={errId} role="alert">{note.text}</p> : null}
      <span className="sp-live" role="status">{note && !note.bad ? note.text : ''}</span>
    </div>
  );
}
