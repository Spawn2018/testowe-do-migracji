/**
 * wyglad/P3-c — Powiadomienia › Kto co dostaje (E11, `img/e11-desk` i `img/e11-phone`; G-18 wiersz zmiany dat).
 * Komputer: 3 karty (e-maile, telefon, ostatnia zmiana), legenda, macierz zdarzenie × 5 rodzajów kont × 3 kanały,
 * po prawej „Podgląd wiersza” i „Zasady”. Telefon: zdarzenia jako karty; wybrane rozwinięte z 5 rodzajami kont.
 * Dane i zapis podłącza wykonawca (`notification_matrix`, `admin_notification_matrix_set`) — tu tylko wygląd.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { ACCOUNT_KINDS, type AccountKind } from './types';

export type { Channel, MatrixCell, MatrixGroup, MatrixRow } from './channels';
import { CH_KEY, CHANNELS, ChannelChip, Icon, type Channel, type MatrixCell, type MatrixGroup, type MatrixRow } from './channels';

export type WhoGetsCards = {
  mail: { on: boolean; used: number; max: number; reserve: number };
  push: { on: boolean; devices: number };
  last: { when: string; text: string };
};

type Props = {
  locale: Locale;
  groups: MatrixGroup[];
  cards?: WhoGetsCards;
  accounts?: Partial<Record<AccountKind, number>>;
  readOnly?: boolean;
  /** Zapis jednego pola macierzy (wykonawca). Bez funkcji — zmiana tylko na ekranie. */
  onToggle?: (rowId: string, kind: AccountKind, ch: Channel, next: boolean) => void;
  /** Przełączniki w kartach „E-maile o zdarzeniach” i „Powiadomienia na telefon” (obraz E11). Bez funkcji — zmiana tylko na ekranie. */
  onCard?: (card: 'mail' | 'push', next: boolean) => void;
  /** „Historia: 4 zmiany od 01.10 · ostatnia 05.10, 12:10” w „Zasadach” (obraz E11) — z Historii zmian. */
  history?: { n: number; since: string; last: string };
  /** Znacznik danych przykładowych przy macierzy. */
  mark?: ReactNode;
};

const FIRMS: Array<{ firm: 'HHL' | 'KSH' | 'SCX'; kinds: AccountKind[] }> = [
  { firm: 'HHL', kinds: ['HHL_ADMIN', 'HHL_OPS'] },
  { firm: 'KSH', kinds: ['CLIENT_USER'] },
  { firm: 'SCX', kinds: ['CARRIER_DISPATCH', 'CARRIER_USER'] },
];

function CellChips({ locale, cell, onSet, readOnly }: { locale: Locale; cell: MatrixCell; onSet: (ch: Channel, next: boolean) => void; readOnly?: boolean }) {
  if (!cell) return <span className="ox-dash">{t(locale, 'p3c_none')}</span>;
  return (
    <span className="ox-chips">
      {CHANNELS.map((ch) => (
        <ChannelChip
          key={ch}
          locale={locale}
          ch={ch}
          on={cell[ch]}
          fixed={cell.fixed?.includes(ch)}
          onClick={readOnly ? undefined : () => onSet(ch, !cell[ch])}
        />
      ))}
    </span>
  );
}

/** Telefon, zwinięta karta zdarzenia (obraz E11 telefon): „wszyscy: dzwonek” albo „5 ról · 4 z dzwonkiem”. */
function rowSummary(locale: Locale, r: MatrixRow): string {
  const cells = ACCOUNT_KINDS.map((k) => r.cells[k]).filter((c): c is NonNullable<MatrixCell> => !!c);
  const list = (c: NonNullable<MatrixCell>) => CHANNELS.filter((ch) => c[ch]).map((ch) => t(locale, `p3c_chs_${ch}`)).join(', ');
  const same = cells.length > 0 && cells.every((c) => list(c) === list(cells[0]));
  if (same) return list(cells[0]) ? t(locale, 'p3c_mx_all').replace('{list}', list(cells[0])) : t(locale, 'p3c_mx_none');
  return tp(locale, 'p3c_mx_sum', { n: cells.length, b: cells.filter((c) => c.bell).length });
}

function CardSwitch({ label, on, readOnly, onChange }: { label: string; on: boolean; readOnly?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button type="button" className="ox-switch" role="switch" aria-checked={on} aria-label={label} disabled={readOnly} onClick={() => onChange(!on)}>
      <span className="ox-track"><i /></span>
    </button>
  );
}

export function WhoGetsScreen({ locale, groups: initial, cards, accounts, readOnly, onToggle, onCard, history, mark }: Props) {
  const [groups, setGroups] = useState(initial);
  const [mailOn, setMailOn] = useState(cards?.mail.on ?? false);
  const [pushOn, setPushOn] = useState(cards?.push.on ?? false);
  /* F7 #404: dane z bazy po zapisie — ekran bierze nowy stan bez ponownego montowania (wybrany wiersz zostaje) */
  useEffect(() => { setGroups(initial); }, [initial]);
  useEffect(() => { setMailOn(cards?.mail.on ?? false); setPushOn(cards?.push.on ?? false); }, [cards?.mail.on, cards?.push.on]);
  const card = (which: 'mail' | 'push', next: boolean) => {
    (which === 'mail' ? setMailOn : setPushOn)(next);
    onCard?.(which, next);
  };
  const firstRow = groups.flatMap((g) => g.rows).find((r) => !r.risksOnly)?.id ?? null;
  const [sel, setSel] = useState<string | null>(firstRow);
  const rows = groups.flatMap((g) => g.rows);
  const selected = rows.find((r) => r.id === sel) ?? null;

  const set = (rowId: string, kind: AccountKind, ch: Channel, next: boolean) => {
    setGroups((gs) => gs.map((g) => ({
      ...g,
      rows: g.rows.map((r) => (r.id !== rowId || !r.cells[kind] ? r : { ...r, cells: { ...r.cells, [kind]: { ...r.cells[kind]!, [ch]: next } } })),
    })));
    onToggle?.(rowId, kind, ch, next);
  };

  const accText = (k: AccountKind) => (accounts && accounts[k] != null ? tp(locale, 'p3c_accounts', { n: accounts[k]! }) : null);

  /* prognoza e-maili (E11 „podgląd: konta, cel, prognoza e-maili vs 90”): zdarzenia na dobę × konta z zaznaczonym e-mailem */
  const mailsOf = (r: MatrixRow): number | null => {
    if (r.perDay == null || !accounts || r.risksOnly) return null;
    return Math.round(r.perDay * ACCOUNT_KINDS.reduce((sum, k) => sum + (r.cells[k]?.mail ? accounts[k] ?? 0 : 0), 0));
  };
  const mailsAll = rows.reduce((sum, r) => sum + (mailsOf(r) ?? 0), 0);
  const selMails = selected ? mailsOf(selected) : null;
  const overLimit = cards != null && selMails != null && selMails > 0 && mailsAll > cards.mail.max;

  return (
    <div className="ox-who">
      {cards ? (
        <div className="ox-cards3">
          <div className="ox-card" data-who-card="mail">
            <span className="ox-eyebrow">{t(locale, 'p3c_mail_title')}</span>
            <span className="ox-card-top">
              <b className="ox-card-v">{t(locale, mailOn ? 'p3c_on' : 'p3c_off')}</b>
              <CardSwitch label={t(locale, 'p3c_mail_title')} on={mailOn} readOnly={readOnly} onChange={(next) => card('mail', next)} />
            </span>
            <span className="ox-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round((cards.mail.used / Math.max(1, cards.mail.max)) * 100))}%` }} /></span>
            <span className="ox-card-sub">{t(locale, 'p3c_mail_quota').replace('{used}', String(cards.mail.used)).replace('{max}', String(cards.mail.max)).replace('{reserve}', String(cards.mail.reserve))}</span>
          </div>
          <div className="ox-card" data-who-card="push">
            <span className="ox-eyebrow">{t(locale, 'p3c_push_title')}</span>
            <span className="ox-card-top">
              <b className="ox-card-v">{t(locale, pushOn ? 'p3c_on' : 'p3c_off')}</b>
              <CardSwitch label={t(locale, 'p3c_push_title')} on={pushOn} readOnly={readOnly} onChange={(next) => card('push', next)} />
            </span>
            <span className="ox-card-sub">{tp(locale, 'p3c_push_devices', { n: cards.push.devices })}</span>
          </div>
          <div className="ox-card">
            <span className="ox-eyebrow">{t(locale, 'p3c_last_title')}</span>
            <b className="ox-card-v" data-content>{cards.last.when}</b>
            <span className="ox-card-sub" data-content>{cards.last.text}</span>
          </div>
        </div>
      ) : null}

      <div className="ox-legend">
        {CHANNELS.map((ch) => (
          <span key={ch} className="ox-legend-item"><span className={`ox-ch ox-ch-${ch} is-on is-static`} aria-hidden="true"><Icon ch={ch} /></span>{t(locale, CH_KEY[ch])}</span>
        ))}
        {readOnly ? null : <span className="ox-legend-hint">{t(locale, 'p3c_ch_hint')}</span>}
        {mark}
      </div>

      <div className="ox-who-split">
        {/* komputer: macierz */}
        <div className="ox-mx-wrap">
          <table className="ox-mx">
            <thead>
              <tr>
                <th rowSpan={2} className="ox-mx-ev">{t(locale, 'p3c_col_event')}</th>
                {FIRMS.map((f) => <th key={f.firm} colSpan={f.kinds.length} className="ox-mx-firm">{t(locale, `p3c_firm_${f.firm}`)}</th>)}
              </tr>
              <tr>
                {ACCOUNT_KINDS.map((k) => <th key={k} className="ox-mx-kind">{t(locale, `p3c_kind_${k}`)}</th>)}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.id}>
                <tr className="ox-mx-group"><th colSpan={6} scope="colgroup"><span data-content>{g.title}</span>{g.sub ? <small data-content>{g.sub}</small> : null}</th></tr>
                {g.rows.map((r) => (
                  <tr key={r.id} className={r.id === sel ? 'is-sel' : undefined}>
                    <th scope="row" className="ox-mx-ev">
                      <button type="button" className="ox-mx-row" onClick={() => setSel(r.id)} aria-label={t(locale, 'p3c_show_row').replace('{name}', r.title)}>
                        <b data-content>{r.title}</b>
                        {r.sub || r.fixedNote ? <span data-content>{[r.sub, r.fixedNote ? t(locale, 'p3c_always') : null].filter(Boolean).join(' · ')}</span> : null}
                      </button>
                    </th>
                    {r.risksOnly
                      ? <td colSpan={5} className="ox-mx-only">{t(locale, 'p3c_risks_only')}</td>
                      : ACCOUNT_KINDS.map((k) => (
                        <td key={k}><CellChips locale={locale} cell={r.cells[k]} readOnly={readOnly} onSet={(ch, next) => set(r.id, k, ch, next)} /></td>
                      ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        {/* telefon: karty zdarzeń */}
        <div className="ox-mxc">
          {groups.map((g) => (
            <section key={g.id} className="ox-mxc-group">
              <h3 data-content>{g.title}</h3>
              {g.rows.map((r) => {
                const isSel = r.id === sel;
                return (
                  <div key={r.id} className={`ox-mxc-card${isSel ? ' is-open' : ''}`}>
                    <button type="button" className="ox-mxc-hd" aria-expanded={isSel} onClick={() => setSel(isSel ? null : r.id)} disabled={r.risksOnly}>
                      <span className="ox-tile-copy">
                        <b data-content>{r.title}</b>
                        <span>{r.risksOnly ? t(locale, 'p3c_risks_only') : isSel ? [r.sub, r.fixedNote ? t(locale, 'p3c_always') : null].filter(Boolean).join(' · ') : rowSummary(locale, r)}</span>
                      </span>
                      {r.risksOnly ? null : <span className="ox-chev" aria-hidden="true">{isSel ? '⌄' : '›'}</span>}
                    </button>
                    {isSel && !r.risksOnly ? (
                      <ul className="ox-mxc-roles">
                        {ACCOUNT_KINDS.map((k) => (
                          <li key={k}>
                            <span className="ox-tile-copy"><b>{t(locale, `p3c_role_${k}`)}</b>{accText(k) ? <span>{accText(k)}</span> : null}</span>
                            <CellChips locale={locale} cell={r.cells[k]} readOnly={readOnly} onSet={(ch, next) => set(r.id, k, ch, next)} />
                          </li>
                        ))}
                        {r.target ? <li className="ox-mxc-target"><span>{t(locale, 'p3c_click_to')} <b data-content>{r.target}</b></span></li> : null}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <aside className="ox-who-side">
          {selected ? (
            <div className="ox-card ox-preview">
              <span className="ox-eyebrow">{t(locale, 'p3c_preview')}</span>
              <h3 data-content>{selected.title}</h3>
              <ul>
                {ACCOUNT_KINDS.map((k) => (
                  <li key={k}>
                    <span className="ox-tile-copy"><b>{t(locale, `p3c_role_${k}`)}</b>{accText(k) ? <span>{accText(k)}</span> : null}</span>
                    <CellChips locale={locale} cell={selected.cells[k]} readOnly onSet={() => undefined} />
                  </li>
                ))}
              </ul>
              {selected.target ? <p>{t(locale, 'p3c_click_to')} <b className="ox-link" data-content>{selected.target}</b></p> : null}
              {selMails != null && selected.perDay != null ? (
                <p className="ox-forecast" data-who-forecast>
                  {t(locale, 'p3c_fc_lead')}{' '}
                  <b className="ox-link">{tp(locale, 'p3c_fc_events', { n: selected.perDay })} → {tp(locale, 'p3c_fc_mails', { n: selMails })}</b>{' '}
                  {t(locale, 'p3c_fc_tail')}
                  {overLimit ? <> <span className="ox-alert">{tp(locale, 'p3c_fc_over', { max: cards!.mail.max })}</span></> : null}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="ox-card ox-rules">
            <span className="ox-eyebrow">{t(locale, 'p3c_rules')}</span>
            <p>{t(locale, 'p3c_rule_scope')}</p>
            <p>{t(locale, 'p3c_rule_quota')}</p>
            {history ? <p className="ox-rules-hist" data-content>{tp(locale, 'p3c_rule_hist', { n: history.n, since: history.since, last: history.last })}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

