/**
 * wyglad/P6-b — panel transportu › „Czat” (dawniej „Ustalenia”; E17, decyzje 07.10 20:57, img/e17-after „Czat”).
 * Tylko rozmowa: wiadomości po dniach, moje po prawej, cudze po lewej, autor „Imię Nazwisko // Firma” i godzina,
 * przy moich „✓ Wysłane do … · nikt jeszcze nie otworzył” albo „✓✓ Przeczytali: 2 osoby · KSH jeszcze nie”, rozwijane w listę
 * „Imię Nazwisko · firma · dzień, godzina” (wyglad/P6-e — E19 okno „Przeczytali”, decyzja 15.10 03:12; D-20261016-0250-01 Cz11);
 * przy cudzych „Przeczytali: …” z tą samą listą (gdy odczyt jest wiarygodny — `chatReadsOn`). Z powiadomienia
 * (`?odpowiedz=1`, `&tekst=`) — kursor w polu i wpisany tekst (D-20261016-0310-01 Cz18, Cz23).
 * „Moje” = wiadomości mojej firmy (autor po koncie — wykonawca). HHL i SCX wybierają przy wysyłce
 * „HHL, SCX, KSH” albo „tylko HHL i SCX” (gdy aplikacja zapisuje i czyta `visible_to` — `chatVisibilityOn`); KSH pisze do wszystkich
 * i nie widzi rozmów HHL ↔ SCX. Enter wysyła, Shift+Enter — nowa linia. Pole pisania zawsze na dole (telefon: przyklejone).
 * Zapis jak dziś (`sendMessage` → `load_messages`); bez innych przycisków.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { LoadMessage, Locale, OrgKind } from '../../types';
import { chatMeOf, chatReadsOn, chatVisibilityOn, chatVisibleFor } from '../../lib/p6bSource';
import { chatReadView, joinOrgsPl, peopleText } from '../../lib/chatReads';
import { takeChatCompose } from '../../lib/chatCompose';
import { formatListDateTime } from '../../lib/format';
import { pt } from '../../i18n/p6e';
import { chatBellAutoReadOn } from '../../lib/p6eSource';
import { isChatKind } from '../../lib/bellList';
import { useTowerStore } from '../../store/useTowerStore';
import { dayKey, dmy, hhmm } from '../../lib/p6History';
import { ht } from '../../i18n/p6b';
import './p6b.css';

type Vis = 'ALL' | 'HHL_SCX';
const ORG_FULL: Record<OrgKind, string> = { HHL: 'H&H Logistics', SCX: 'Scandinavian Express', KSH: 'KSH' };

interface Props {
  loadId: string;
  role: OrgKind;
  locale: Locale;
  phone: boolean;
  messages: readonly LoadMessage[];
  onSend: (text: string, visibleTo?: Vis) => void;
}

/** „Anna Wiśniewska // H&H Logistics” (telefon: „// HHL”); wiadomość bez osoby — sama firma. */
function authorOf(m: LoadMessage, phone: boolean): string {
  const org = phone ? m.org : ORG_FULL[m.org];
  const a = m.author.trim();
  if (!a || a === m.org || a === ORG_FULL[m.org]) return org;
  if (a.includes('//')) return a;
  return `${a} // ${org}`;
}

/** Pod wiadomością: kto i kiedy przeczytał (wyglad/P6-e). Moja — zawsze stan; cudza — tylko gdy ktoś przeczytał. */
function Receipt({ m, mine, phone, meId }: { m: LoadMessage; mine: boolean; phone: boolean; meId: string | null }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const v = chatReadView(m, meId);
  if (v.readers.length === 0) {
    if (!mine) return null;
    return (
      <div className="ch-rcpt" data-chat-read="no">
        {`✓ ${phone ? pt('p6e_sent_short') : pt('p6e_sent', { orgs: joinOrgsPl(v.audience, pt('p6e_and')) })}`}
      </div>
    );
  }
  const n = peopleText(v.readers.length);
  const head = mine
    ? `✓✓ ${phone ? pt('p6e_read_short', { n }) : pt('p6e_read', { n })}${v.pending.length && !phone ? pt('p6e_read_pending', { orgs: joinOrgsPl(v.pending, pt('p6e_and')) }) : ''}`
    : pt('p6e_read', { n });
  return (
    <div className="ch-rd">
      <button
        type="button"
        className={`ch-rcpt ch-rd-btn${mine ? ' is-read' : ' is-other'}`}
        data-chat-read={mine ? 'yes' : 'list'}
        aria-expanded={open}
        aria-controls={`${uid}-l`}
        onClick={() => setOpen((o) => !o)}
      >
        {head}<span className="ch-rd-chev" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      {open ? (
        <div className="ch-rd-pop" id={`${uid}-l`} data-chat-readers>
          <ul aria-label={pt('p6e_list')}>
            {v.readers.map((r) => (
              <li key={`${r.userId}-${r.at}`} data-chat-reader={r.org ?? ''}>
                <b data-content>{r.name}{r.me ? pt('p6e_you') : ''}</b>
                <span>{r.org ?? '—'}</span>
                <span className="tabular">{formatListDateTime(r.at)}</span>
              </li>
            ))}
          </ul>
          {v.pending.length ? <p className="ch-rd-pend" data-chat-pending>{pt('p6e_pending', { orgs: joinOrgsPl(v.pending, pt('p6e_and')) })}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function PanelChat({ loadId, role, locale, phone, messages, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const [vis, setVis] = useState<Vis>('ALL');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const meId = chatMeOf(role);
  const canChoose = chatVisibilityOn() && role !== 'KSH';
  const visible = useMemo(
    () => chatVisibleFor(messages, role).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    [messages, role],
  );
  const days = useMemo(() => {
    const out: { day: string; msgs: LoadMessage[] }[] = [];
    for (const m of visible) {
      if (!Number.isFinite(Date.parse(m.at))) continue;
      const k = dayKey(m.at);
      const last = out[out.length - 1];
      if (last && last.day === k) last.msgs.push(m);
      else out.push({ day: k, msgs: [m] });
    }
    return out;
  }, [visible]);

  /* najnowsza wiadomość widoczna po otwarciu i po wysłaniu; przy czytaniu starszych nowa cudza wiadomość nie przewija */
  const atBottom = useRef(true);
  const lastMine = visible.length > 0 && visible[visible.length - 1].org === role;
  useEffect(() => {
    const el = logRef.current;
    if (el && (atBottom.current || lastMine)) el.scrollTop = el.scrollHeight;
  }, [loadId, visible.length, lastMine]);

  /* otwarty Czat: wiadomości tego transportu w dzwonku przeczytane (Cz22; produkcja — po podłączeniu, `p6eSource`) */
  useEffect(() => {
    if (!chatBellAutoReadOn()) return;
    const st = useTowerStore.getState();
    for (const n of st.notifications) if (!n.read && n.loadId === loadId && isChatKind(n.kind)) st.markNotificationRead(n.id);
  }, [loadId, messages.length]);

  /* z powiadomienia: „Odpowiedz” bez pola w powiadomieniu albo niewysłana odpowiedź (Cz18, Cz23) */
  useEffect(() => {
    const c = takeChatCompose(loadId);
    if (!c) return;
    if (c.text) setDraft(c.text);
    if (c.focus) {
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [loadId]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text, canChoose ? vis : undefined);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    /* 229 — Enter zatwierdzający słowo w edytorze znaków (Safari), nie wysyła */
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send();
    }
  };
  const placeholder = phone
    ? ht(locale, 'p6b_chat_ph_short')
    : role === 'KSH' ? ht(locale, 'p6b_chat_ph_KSH') : ht(locale, canChoose ? `p6b_chat_ph_${vis}` : 'p6b_chat_ph_ALL');

  return (
    <div className="ch" data-chat>
      <div
        className="ch-log"
        ref={logRef}
        role="log"
        aria-label={ht(locale, 'p6b_chat_log')}
        tabIndex={0}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
      >
        {days.length === 0 ? <p className="ch-empty">{ht(locale, 'p6b_chat_empty')}</p> : null}
        {days.map((d) => (
          <section key={d.day} className="ch-day">
            <h5 className="ch-day-hd">{dmy(d.day)}</h5>
            {d.msgs.map((m) => {
              const mine = m.org === role;
              /* „przeczytali” — gdy odczyt liczy się po otwarciu zakładki (produkcja: dopisek, `chatReadsOn`) */
              const reads = chatReadsOn();
              return (
                <article key={m.id} className={`ch-msg${mine ? ' is-me' : ''}${m.visibleTo === 'HHL_SCX' ? ' is-only' : ''}`} data-chat-msg data-vis={m.visibleTo ?? 'ALL'}>
                  <div className="ch-who">
                    <span data-content>{authorOf(m, phone)}</span>
                    {` · ${hhmm(m.at)}`}
                    {m.visibleTo === 'HHL_SCX' ? <span className="ch-only">{ht(locale, 'p6b_chat_only')}</span> : null}
                  </div>
                  <div className="ch-text" data-content>{m.text}</div>
                  {reads ? <Receipt m={m} mine={mine} phone={phone} meId={meId} /> : null}
                </article>
              );
            })}
          </section>
        ))}
      </div>
      <form
        className="ch-compose"
        data-chat-compose
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {canChoose ? (
          <div className="ch-vis">
            <span>{ht(locale, 'p6b_chat_vis')}</span>
            <div className="ch-seg" role="group" aria-label={ht(locale, 'p6b_chat_vis_aria')}>
              {(['ALL', 'HHL_SCX'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={vis === v} data-chat-vis={v} onClick={() => setVis(v)}>
                  {ht(locale, phone ? `p6b_chat_vis_${v}_short` : `p6b_chat_vis_${v}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="ch-row">
          <textarea
            className="ch-input"
            ref={inputRef}
            data-chat-input
            rows={phone ? 1 : 2}
            value={draft}
            placeholder={placeholder}
            aria-label={ht(locale, 'p6b_chat_label')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
          />
          <button type="submit" className="btn ch-send" data-chat-send>{ht(locale, 'p6b_chat_send')}</button>
        </div>
        {!phone ? <p className="ch-hint">{ht(locale, 'p6b_chat_hint')}</p> : null}
      </form>
    </div>
  );
}
