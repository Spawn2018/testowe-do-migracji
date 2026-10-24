/**
 * wyglad/P8-a — Opcje › Powiadomienia › Treści wiadomości (E43, decyzje 07.10.2026, 22:42; img/e43-after).
 * Lista: SMS do Śremu i Boden (E42), Ryzyka i decyzje, Transport, Faktury, System, Logowanie — przy każdej pozycji
 * „domyślna” albo „zmieniono [data] · [osoba]”. Edytor: temat i treść z klockami danych, „Wstaw dane”, licznik SMS,
 * podgląd na prawdziwym transporcie, „Zapisz”, „Wyślij próbny …”, „Przywróć domyślną treść”.
 * Zmienia tylko Administrator HHL; Operacje HHL — podgląd; KSH i SCX ekranu nie widzą (OptionsView).
 * Zapis i dane — `p8Source.ts` (wykonawca, P8). Telefon: lista → ekran wiadomości ze strzałką wstecz.
 * Niezapisane zmiany zostają w pamięci ekranu przy przejściu do innej wiadomości (lista pokazuje „niezapisane zmiany”).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { formatListDateTime } from '../../lib/format';
import { formatCalendarDay } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import {
  GROUPS, GROUP_LABEL, INVOICE_DUE_SAMPLE, INVOICE_LINK_IDS, INVOICE_LINK_SAMPLE, MESSAGES, channelLabel, SMS_MAX, checkMessage, gsmBad, gsmLength, parseMarkers, previewLines, tokenLabelIn,
  sampleOf, smsOf, smsWorstLength, toMarkers,
  type CheckError, type MsgItem, type PreviewPart, type Seg, type TokenId,
} from '../../lib/p8Texts';
import { messageTextsOf, type SavedText } from '../../lib/p8Source';
import { p8t, type P8Key } from '../../i18n/p8';
import { TokenEditor, type TokenEditorHandle } from './TokenEditor';
import { openOptionsScreen } from '../../lib/openOptions';
import './messageTexts.css';

const dayOf = (iso: string) => formatListDateTime(iso).split(', ')[0] ?? '';
const dm = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? formatCalendarDay(d.slice(0, 10)) : '');

type Draft = { subject: Seg[]; body: Seg[] };

const ERR_KEY: Record<CheckError, P8Key> = {
  empty: 'p8_err_empty', subject_empty: 'p8_err_subject', sms_long: 'p8_err_sms_long', sms_chars: 'p8_err_sms_chars', no_button: 'p8_err_no_button',
};

export function MessageTexts({ readOnly }: { readOnly: boolean }) {
  const src = useMemo(() => messageTextsOf(), []);
  const phone = useIsPhone();
  const loads = useTowerStore((s) => s.loads);
  const [saved, setSaved] = useState<Map<string, SavedText>>(() => new Map((src?.initial ?? []).map((r) => [r.id, r])));
  /* edytor powstaje dopiero po wczytaniu zapisanych treści — inaczej pokazałby domyślną, a „Zapisz” by ją utrwalił */
  const [loaded, setLoaded] = useState(!src || !!src.initial);
  const [sel, setSel] = useState<string>(MESSAGES[2]?.id ?? MESSAGES[0]!.id);
  const [open, setOpen] = useState(!phone);
  /* „Przywróć domyślną” zaczyna edytor od nowa (nowy `key`); komunikat po przywróceniu przechodzi do nowego edytora */
  const [ver, setVer] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<{ id: string; text: string } | null>(null);
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Draft>>(new Map());
  const ro = readOnly || !src?.save;
  const items = useRef(new Map<string, HTMLButtonElement>());
  const edBox = useRef<HTMLDivElement>(null);
  /* null = pierwsze wejście (bez przewijania i bez przenoszenia kursora) */
  const moved = useRef<string | null>(null);

  /* Komputer: po wyborze pozycji z dołu listy edytor wraca na ekran. Telefon: po otwarciu — góra ekranu i przycisk „‹”,
     po powrocie — kursor na pozycji listy. */
  useEffect(() => {
    if (moved.current === null) { moved.current = `${sel}:${open}`; return; }
    if (moved.current === `${sel}:${open}`) return;
    moved.current = `${sel}:${open}`;
    if (phone && !open) {
      const b = items.current.get(sel);
      b?.focus({ preventScroll: true });
      b?.scrollIntoView({ block: 'center' });
      return;
    }
    const box = edBox.current;
    if (!box) return;
    const top = box.closest('main')?.getBoundingClientRect().top ?? 0;
    const r = box.getBoundingClientRect();
    if (phone || r.top < top || r.top > window.innerHeight - 120) box.scrollIntoView({ block: 'start' });
    if (phone) box.querySelector<HTMLButtonElement>('.mt-back')?.focus({ preventScroll: true });
  }, [sel, open, phone]);

  useEffect(() => {
    if (!src) return;
    let alive = true;
    void src.saved().then(
      (rows) => { if (alive) { setSaved(new Map(rows.map((r) => [r.id, r]))); setLoaded(true); } },
      () => { if (alive) setLoaded(true); },
    );
    return () => { alive = false; };
  }, [src]);

  const setDraft = (id: string, d: Draft | null) => setDrafts((m) => {
    if (!d && !m.has(id)) return m;
    const n = new Map(m);
    if (d) n.set(id, d); else n.delete(id);
    return n;
  });

  const item = MESSAGES.find((m) => m.id === sel) ?? MESSAGES[0]!;
  const status = (m: MsgItem, short: boolean) => {
    if (drafts.has(m.id)) return { text: p8t('p8_draft'), changed: true };
    const s = saved.get(m.id);
    if (!s) return { text: p8t('p8_default'), changed: false };
    return { text: short ? p8t('p8_changed_short', { d: dayOf(s.at) }) : p8t('p8_changed', { d: dayOf(s.at), who: s.who }), changed: true };
  };

  const list = (
    <div
      className="mt-list"
      role="navigation"
      aria-label={p8t('p8_title')}
      onKeyDown={(e) => {
        /* jedna pozycja listy w kolejności Tab; strzałki, Home i End chodzą po liście */
        const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
        if (!keys.includes(e.key)) return;
        const ids = MESSAGES.map((m) => m.id);
        const at = ids.indexOf((document.activeElement as HTMLElement | null)?.dataset.mtItem ?? '');
        if (at < 0) return;
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : Math.min(ids.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)));
        items.current.get(ids[next]!)?.focus();
      }}
    >
      {GROUPS.map((g) => (
        <div key={g} className="mt-grp">
          <h3 className="mt-grp-h" id={`mt-g-${g}`}>{GROUP_LABEL[g]}</h3>
          <ul aria-labelledby={`mt-g-${g}`}>
            {MESSAGES.filter((m) => m.group === g).map((m) => {
              const st = status(m, true);
              const cur = m.id === sel && (open || !phone);
              return (
                <li key={m.id}>
                  <button
                    ref={(b) => { if (b) items.current.set(m.id, b); else items.current.delete(m.id); }}
                    type="button"
                    className={`mt-item${cur ? ' is-cur' : ''}`}
                    aria-current={cur ? 'true' : undefined}
                    tabIndex={m.id === sel ? 0 : -1}
                    data-mt-item={m.id}
                    onClick={() => { setSel(m.id); setOpen(true); setFlash(null); }}
                  >
                    <span className="mt-item-n">
                      {m.name}
                      {!phone && st.changed ? <small className="mt-item-s is-changed">{st.text}</small> : null}
                    </span>
                    {phone
                      ? <span className={`mt-item-s${st.changed ? ' is-changed' : ''}`}>{st.text}</span>
                      : m.channel !== 'EMAIL' ? <span className="mt-tag">{channelLabel(m.channel)}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="mt-foot">{p8t('p8_list_note')}</p>
    </div>
  );

  const editor = (
    <div className="mt-ed-box" ref={edBox}>
      {loaded ? (
        <MessageEditor
          key={`${item.id}:${ver[item.id] ?? 0}`}
          item={item}
          saved={saved.get(item.id) ?? null}
          draft={drafts.get(item.id) ?? null}
          status={status(item, false)}
          loads={loads}
          readOnly={ro}
          prodPending={!src}
          phone={phone}
          onBack={phone ? () => setOpen(false) : null}
          flash={flash?.id === item.id ? flash.text : null}
          onDraft={(d) => setDraft(item.id, d)}
          onSaved={(row) => {
            setDraft(row.id, null);
            setSaved((m) => { const n = new Map(m); n.set(row.id, row); return n; });
          }}
          onReset={() => {
            setDraft(item.id, null);
            setSaved((m) => { const n = new Map(m); n.delete(item.id); return n; });
            setFlash({ id: item.id, text: p8t('p8_reset_done') });
            setVer((v) => ({ ...v, [item.id]: (v[item.id] ?? 0) + 1 }));
          }}
          src={src}
        />
      ) : <p className="mt-loading" role="status">{p8t('p8_loading')}</p>}
    </div>
  );

  if (phone) {
    return <section className={`mt is-phone${open ? ' is-open' : ''}`} data-screen="texts">{open ? editor : list}</section>;
  }
  return (
    <section className="mt" data-screen="texts">
      <p className="mt-lead">
        <button type="button" className="mt-who" data-mt-who onClick={() => openOptionsScreen('who')}>{p8t('p8_who_link')}</button>
      </p>
      <div className="mt-grid">
        <div className="mt-side">{list}</div>
        {editor}
      </div>
    </section>
  );
}

function Lines({ lines, className }: { lines: PreviewPart[][]; className?: string }) {
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={className}>
          {line.map((pt, j) => (pt.btn ? <span key={j} className="mt-prev-btn">{pt.v}</span> : <span key={j}>{pt.v}</span>))}
        </p>
      ))}
    </>
  );
}

function MessageEditor({ item, saved, draft, status, loads, readOnly, prodPending, phone, onBack, flash, onDraft, onSaved, onReset, src }: {
  item: MsgItem;
  saved: SavedText | null;
  draft: Draft | null;
  status: { text: string; changed: boolean };
  loads: ReturnType<typeof useTowerStore.getState>['loads'];
  readOnly: boolean;
  prodPending: boolean;
  phone: boolean;
  onBack: (() => void) | null;
  flash: string | null;
  onDraft: (d: Draft | null) => void;
  onSaved: (row: SavedText) => void;
  onReset: () => void;
  src: ReturnType<typeof messageTextsOf>;
}) {
  const email = item.channel !== 'SMS';
  const sms = item.channel === 'SMS';
  /* punkt odniesienia „bez zmian”: zapisana treść albo domyślna */
  const baseSubject = saved?.subject ?? item.subject ?? '';
  const baseBody = saved?.body ?? item.body;
  const [subject, setSubject] = useState<Seg[]>(() => draft?.subject ?? parseMarkers(baseSubject));
  const [body, setBody] = useState<Seg[]>(() => draft?.body ?? parseMarkers(baseBody));
  const [target, setTarget] = useState<'subject' | 'body'>('body');
  const [msg, setMsg] = useState<{ text: string; bad: boolean; field?: 'subject' | 'body' } | null>(null);
  const [busy, setBusy] = useState(false);
  const subjRef = useRef<TokenEditorHandle>(null);
  const bodyRef = useRef<TokenEditorHandle>(null);

  /* komunikat po „Przywróć domyślną” — po zamontowaniu, żeby pole „status” ogłosiło zmianę; kursor w polu treści */
  useEffect(() => {
    if (!flash) return;
    bodyRef.current?.focus();
    const t = window.setTimeout(() => setMsg({ text: flash, bad: false }), 0);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (s: Seg[], b: Seg[]) => {
    const same = (email ? toMarkers(s) === baseSubject : true) && toMarkers(b) === baseBody;
    onDraft(same ? null : { subject: s, body: b });
  };

  const previewLoads = useMemo(() => loads.filter((l) => l.status !== 'CANCELLED').slice(0, 24), [loads]);
  const [loadId, setLoadId] = useState<string>('');
  /* wybrany transport, a gdy go nie ma (lista doszła później, transport wypadł) — transport startowy */
  const load = previewLoads.find((l) => l.id === loadId)
    ?? previewLoads.find((l) => l.code === src?.previewCode) ?? previewLoads[0] ?? null;
  const sample = useMemo(() => {
    const s = sampleOf(load);
    /* E41: SMS — sam kod; e-mail na koncie HHL — kod z numerem zlecenia HHL */
    if (email && load?.hhlOrderNo) s.code = `${load.code} · ${load.hhlOrderNo}`;
    /* A4 (wyglad/W-faktura-termin): wiadomości o fakturze prowadzą do faktury */
    if (INVOICE_LINK_IDS.has(item.id)) {
      s.link = INVOICE_LINK_SAMPLE;
      /* F7: termin płatności przykładowej faktury (nie data załadunku transportu) */
      s.due = INVOICE_DUE_SAMPLE;
    }
    return s;
  }, [load, email, item.id]);
  const errId = `mt-err-${item.id}`;
  const countId = `mt-count-${item.id}`;

  const smsNow = sms ? smsOf(body, sample) : '';
  const smsLen = sms ? gsmLength(smsNow) : 0;
  const smsWorst = sms ? smsWorstLength(body) : 0;
  const smsBad = sms ? gsmBad(smsNow) : [];
  const smsOver = smsLen > SMS_MAX || smsWorst > SMS_MAX || smsBad.length > 0;
  const hasButton = body.some((x) => x.k === 'tok' && x.id === 'button');
  const insertable: TokenId[] = item.tokens.filter((tk) => tk !== 'button' || !hasButton);

  const insert = (tk: TokenId) => {
    setMsg(null);
    if (tk === 'button' || target === 'body' || !email) bodyRef.current?.insert(tk);
    else subjRef.current?.insert(tk);
  };
  const fail = () => { setBusy(false); setMsg({ bad: true, text: p8t('p8_fail') }); };
  const save = () => {
    if (!src?.save || busy) return;
    const c = checkMessage(item, email ? subject : null, body, sample);
    if (!c.ok) {
      setMsg({ bad: true, field: c.field, text: p8t(ERR_KEY[c.error], { chars: (c.chars ?? []).join(' ') }) });
      return;
    }
    setBusy(true);
    const subj = email ? toMarkers(subject) : null;
    const bod = toMarkers(body);
    void src.save(item.id, subj, bod).then((r) => {
      setBusy(false);
      if (!r.ok || !r.row) { setMsg({ bad: true, text: r.error ?? p8t('p8_fail') }); return; }
      setMsg({ bad: false, text: p8t('p8_saved') });
      onSaved(r.row);
    }, fail);
  };
  const reset = () => {
    if (busy) return;
    /* tylko niezapisane zmiany — wystarczy wrócić do treści bez zmian */
    if (!saved) { onReset(); return; }
    if (!src?.reset) return;
    setBusy(true);
    void src.reset(item.id).then((r) => {
      setBusy(false);
      if (!r.ok) { setMsg({ bad: true, text: r.error ?? p8t('p8_fail') }); return; }
      onReset();
    }, fail);
  };
  const sendTest = () => {
    if (!src?.sendTest || busy) return;
    setBusy(true);
    void src.sendTest(item.id, email ? toMarkers(subject) : null, toMarkers(body), load?.code ?? null).then((r) => {
      setBusy(false);
      setMsg(r.ok ? { bad: false, text: p8t(email ? 'p8_test_done_email' : 'p8_test_done_s') } : { bad: true, text: p8t('p8_fail') });
    }, fail);
  };

  const bodyErr = msg?.bad && msg.field === 'body';
  const subjErr = msg?.bad && msg.field === 'subject';
  const Title = phone ? 'h1' : 'h3';

  return (
    <div className="mt-ed-panel" data-mt-editor={item.id}>
      <header className="mt-ed-hd">
        {onBack ? <button type="button" className="mt-back" aria-label={p8t('p8_back')} onClick={onBack}>‹</button> : null}
        <Title className="mt-title">{item.name}</Title>
        <span className="mt-tag">{channelLabel(item.channel)}</span>
        {item.to && !phone ? <span className="mt-to">{item.to}</span> : null}
        <span className={`mt-state${status.changed ? ' is-changed' : ''}`}>{status.text}</span>
      </header>
      <p className="mt-note">{sms ? p8t('p8_pl_only') : item.noBell ? p8t('p8_pack_note') : p8t('p8_email_note')}</p>
      {readOnly ? <p className="mt-ro" data-mt-ro>{prodPending ? p8t('p8_ro_prod') : p8t('p8_ro')}</p> : null}
      {/* #412 E43 (0289): uczciwie — zapis w bazie jest, wysyłka korzysta z niego dopiero po P8 */}
      {src?.prod ? <p className="mt-note" data-mt-prod-note>{p8t(item.channel === 'LOGIN' ? 'p8_prod_login' : 'p8_prod_store')}</p> : null}

      {email ? (
        <div className="mt-field">
          <span className="mt-lbl">{p8t('p8_subject')}</span>
          <TokenEditor
            ref={subjRef}
            initial={subject}
            onChange={(v) => { setSubject(v); setMsg(null); change(v, body); }}
            multiline={false}
            readOnly={readOnly}
            label={p8t('p8_subject')}
            msgId={item.id}
            describedBy={subjErr ? errId : undefined}
            invalid={!!subjErr}
            onFocus={() => setTarget('subject')}
          />
          <span className="mt-hint">{p8t('p8_subject_note')}</span>
        </div>
      ) : null}
      <div className="mt-field">
        {email ? <span className="mt-lbl">{p8t('p8_body')}</span> : null}
        <TokenEditor
          ref={bodyRef}
          initial={body}
          onChange={(v) => { setBody(v); setMsg(null); change(subject, v); }}
          multiline={email}
          readOnly={readOnly}
          label={email ? p8t('p8_body') : item.name}
          buttonLabel={item.buttonLabel}
          msgId={item.id}
          lockButton={item.needsButton}
          describedBy={[bodyErr ? errId : '', sms ? countId : ''].filter(Boolean).join(' ') || undefined}
          invalid={!!bodyErr}
          onFocus={() => setTarget('body')}
        />
      </div>

      {!readOnly ? (
        <div className="mt-ins">
          <span className="mt-lbl">{phone ? p8t('p8_insert_phone') : p8t('p8_insert')}</span>
          <div className={`mt-ins-row${phone ? ' is-scroll' : ''}`}>
            {insertable.map((tk) => (
              <button
                key={tk}
                type="button"
                className={`btn ghost mt-ins-btn${tk === 'button' ? ' is-must' : ''}`}
                data-mt-insert={tk}
                aria-label={p8t('p8_insert_aria', { label: tokenLabelIn(tk, item.id) })}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(tk)}
              >
                + {tokenLabelIn(tk, item.id)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sms ? (
        <div className={`mt-count${smsOver ? ' is-over' : ''}`} id={countId} data-mt-count={smsLen} data-mt-worst={smsWorst}>
          <b>{smsLen > SMS_MAX ? '✗' : '✓'} {p8t(smsLen > SMS_MAX ? 'p8_count_over' : 'p8_count_ok', { n: smsLen })}</b>
          <span>{p8t('p8_count_note')}</span>
          {smsLen <= SMS_MAX && smsWorst > SMS_MAX ? <span className="mt-count-warn">{p8t('p8_count_worst', { n: smsWorst })}</span> : null}
          {smsBad.length ? <span className="mt-count-warn">{p8t('p8_err_sms_chars', { chars: smsBad.join(' ') })}</span> : null}
        </div>
      ) : null}
      {sms ? <span className="sronly" role="status">{smsOver ? p8t('p8_err_sms_long') : ''}</span> : null}

      <div className="mt-prev">
        {/* P11 (e43): e-maile logowania nie dotyczą transportu — sam „Podgląd”, bez wyboru transportu */}
        {item.channel === 'LOGIN' ? (
          <div className="mt-prev-hd"><span>{p8t('p8_preview_phone')}</span></div>
        ) : (
          <label className="mt-prev-hd">
            <span>{p8t(phone ? 'p8_preview_phone' : 'p8_preview')}</span>
            <select className="input mt-prev-sel" value={load?.id ?? ''} onChange={(e) => setLoadId(e.target.value)}>
              {previewLoads.map((l) => <option key={l.id} value={l.id}>{dm(l.plannedDeliverDate) ? `${l.code} · ${dm(l.plannedDeliverDate)}` : l.code}</option>)}
            </select>
          </label>
        )}
        <div className={`mt-prev-box${sms ? ' is-sms' : ''}`} data-mt-preview>
          {email ? <Lines lines={previewLines(subject, sample, false, item.buttonLabel)} className="mt-prev-subj" /> : null}
          <Lines lines={previewLines(body, sample, sms, item.buttonLabel)} />
        </div>
        {item.channel === 'EMAIL' && !item.noBell ? <p className="mt-hint">{p8t('p8_preview_note')}</p> : null}
      </div>

      {msg?.bad ? <p className="mt-msg is-bad" id={errId} role="alert">{msg.text}</p> : null}
      <div className="mt-live" role="status">{msg && !msg.bad ? <p className="mt-msg">{msg.text}</p> : null}</div>

      {!readOnly ? (
        <div className="mt-acts">
          <button type="button" className="btn" data-mt-save aria-disabled={busy || undefined} onClick={save}>{p8t('p8_save')}</button>
          {src?.sendTest ? (
            <button type="button" className="btn ghost" data-mt-test aria-disabled={busy || undefined} onClick={sendTest}>
              {p8t(email ? (phone ? 'p8_test_email_phone' : 'p8_test_email') : (phone ? 'p8_test_s_phone' : 'p8_test_s'))}
            </button>
          ) : null}
          {status.changed && (!saved || src?.reset) ? (
            <button type="button" className="btn ghost" data-mt-reset aria-disabled={busy || undefined} onClick={reset}>{p8t('p8_reset')}</button>
          ) : null}
          {!phone ? <span className="mt-hist">{p8t('p8_history_note')}</span> : null}
        </div>
      ) : null}
      <p className="mt-help">{p8t('p8_help')}{item.needsButton ? ` ${p8t('p8_help_login')}` : ''}</p>
    </div>
  );
}
