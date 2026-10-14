/**
 * wyglad/P6-b — panel transportu › „Czat” (dawniej „Ustalenia”; E17, decyzje 07.10 20:57, img/e17-after „Czat”).
 * Tylko rozmowa: wiadomości po dniach, moje po prawej, cudze po lewej, autor „Imię Nazwisko // Firma” i godzina,
 * przy moich „przeczytali: …” albo „wysłane · nikt z … jeszcze nie otworzył” (gdy odczyt jest wiarygodny — `chatReadsOn`).
 * „Moje” = wiadomości mojej firmy (autor po koncie — wykonawca). HHL i SCX wybierają przy wysyłce
 * „HHL, SCX, KSH” albo „tylko HHL i SCX” (gdy aplikacja zapisuje i czyta `visible_to` — `chatVisibilityOn`); KSH pisze do wszystkich
 * i nie widzi rozmów HHL ↔ SCX. Enter wysyła, Shift+Enter — nowa linia. Pole pisania zawsze na dole (telefon: przyklejone).
 * Zapis jak dziś (`sendMessage` → `load_messages`); bez innych przycisków.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { LoadMessage, Locale, OrgKind } from '../../types';
import { chatReadsOn, chatVisibilityOn, chatVisibleFor } from '../../lib/p6bSource';
import { dayKey, dmy, hhmm } from '../../lib/p6History';
import { ht, htp } from '../../i18n/p6b';
import './p6b.css';

type Vis = 'ALL' | 'HHL_SCX';
const ORG_FULL: Record<OrgKind, string> = { HHL: 'H&H Logistics', SCX: 'Scandinavian Express', KSH: 'KSH' };
const ORGS: OrgKind[] = ['HHL', 'SCX', 'KSH'];
const NAME_TO_ORG: Record<string, OrgKind> = { 'H&H LOGISTICS': 'HHL', 'SCANDINAVIAN EXPRESS': 'SCX', KSH: 'KSH', HHL: 'HHL', SCX: 'SCX' };

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

const orgOfRead = (o: string | undefined): OrgKind | null => (o ? NAME_TO_ORG[o.trim().toUpperCase()] ?? null : null);

function joinOrgs(list: OrgKind[], locale: Locale): string {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')}${ht(locale, 'p6b_chat_and')}${list[list.length - 1]}`;
}

function receipt(m: LoadMessage, locale: Locale, phone: boolean): { read: boolean; text: string } {
  const audience = ORGS.filter((o) => o !== m.org && !(m.visibleTo === 'HHL_SCX' && o === 'KSH'));
  const readers = audience.filter((o) => (m.reads ?? []).some((r) => orgOfRead(r.org) === o));
  if (readers.length === 0) {
    return { read: false, text: phone ? ht(locale, 'p6b_chat_sent_short') : htp(locale, 'p6b_chat_sent', { orgs: joinOrgs(audience, locale) }) };
  }
  const rest = audience.filter((o) => !readers.includes(o));
  if (phone) return { read: true, text: readers.join(', ') };
  return {
    read: true,
    text: rest.length
      ? htp(locale, 'p6b_chat_read_part', { orgs: readers.join(', '), rest: joinOrgs(rest, locale) })
      : htp(locale, 'p6b_chat_read', { orgs: readers.join(', ') }),
  };
}

export function PanelChat({ loadId, role, locale, phone, messages, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const [vis, setVis] = useState<Vis>('ALL');
  const logRef = useRef<HTMLDivElement>(null);
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
              const r = mine && chatReadsOn() ? receipt(m, locale, phone) : null;
              return (
                <article key={m.id} className={`ch-msg${mine ? ' is-me' : ''}${m.visibleTo === 'HHL_SCX' ? ' is-only' : ''}`} data-chat-msg data-vis={m.visibleTo ?? 'ALL'}>
                  <div className="ch-who">
                    <span data-content>{authorOf(m, phone)}</span>
                    {` · ${hhmm(m.at)}`}
                    {m.visibleTo === 'HHL_SCX' ? <span className="ch-only">{ht(locale, 'p6b_chat_only')}</span> : null}
                  </div>
                  <div className="ch-text" data-content>{m.text}</div>
                  {r ? <div className={`ch-rcpt${r.read ? ' is-read' : ''}`} data-chat-read={r.read ? 'yes' : 'no'}>{`${r.read ? '✓✓' : '✓'} ${r.text}`}</div> : null}
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
