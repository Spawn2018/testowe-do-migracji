/**
 * wyglad/P5 — E40 „Paczka tygodnia dla księgowości” (img/e40-after; Finanse, tylko HHL Administrator i Operacje).
 * Tydzień faktury, dwie paczki obok siebie (komputer) albo karty (telefon): faktura z PDF, kwoty, transporty z CMR,
 * adresy z Opcji, lista plików (każdy osobno), „Wyślij” i „Pobierz paczkę (ZIP)”, ślad wysyłki.
 * Gdy czegoś brakuje — „Wyślij” jest szary, obok powód i kto uzupełnia. Ponowna wysyłka pyta o potwierdzenie.
 * Bez adresów i dziennika z bazy (`accountingPackConfigOf` = null) sekcji nie ma — podłącza wykonawca.
 */
import { useMemo, useState } from 'react';
import type { Bill, Document, Load, Locale } from '../../types';
import { formatPlNumber } from '../../lib/format';
import { transportLabel } from '../../lib/transportName';
import { transportsText } from '../../lib/p5Finance';
import {
  accountingPack, PACKS, packWeekLabel, packWeeks, type AccountingPack as Pack, type PackBlock, type PackConfig, type PackKey, type PackSent,
} from '../../lib/p5Pack';
import type { PackActions } from '../../lib/p5Source';
import { ft, ftp } from '../../i18n/p5';
import { up } from '../options/up';

const dm = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : '—');
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const n2 = (n: number) => formatPlNumber(n, 2);

function sentParts(s: PackSent): { date: string; time: string } {
  const d = new Date(s.at);
  const date = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).format(d);
  return { date, time };
}

function addrText(n: number): string {
  if (n === 1) return '1 adres';
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? `${n} adresy` : `${n} adresów`;
}

export function blockText(locale: Locale, key: PackKey, b: PackBlock): string {
  if (b.kind === 'NO_INVOICE') return ft(locale, `p5_pack_b_NO_INVOICE_${key}`);
  if (b.kind === 'NO_CMR') return ftp(locale, 'p5_pack_b_NO_CMR', { codes: (b.codes ?? []).join(', ') });
  return ftp(locale, `p5_pack_b_${b.kind}`, { number: b.number ?? '' });
}

/* „Sprawdzenie HHL” = weryfikacja faktury SCX (2A), nie płatność */
function checkTag(locale: Locale, b: Bill) {
  const st = b.verification;
  const cls = st === 'ZAAKCEPTOWANA' ? 'fin-tag go solid' : st === 'SPORNA' ? 'fin-tag red' : 'fin-tag warn';
  return <span className={cls} data-pack-check={st}>{up(ft(locale, `p5_inv_st_${st}`))}</span>;
}

interface Props {
  locale: Locale;
  phone: boolean;
  loads: Load[];
  bills: Bill[];
  documents: Document[];
  cfg: PackConfig;
  actions: PackActions | null;
  nowIso: string;
}

export function AccountingPackSection({ locale, phone, loads, bills, documents, cfg, actions, nowIso }: Props) {
  const weeks = useMemo(() => packWeeks(bills), [bills]);
  const [picked, setWeek] = useState('');
  /* faktury mogą dojść później — bez wyboru albo po zniknięciu tygodnia: najnowszy tydzień faktury */
  const week = weeks.includes(picked) ? picked : weeks[0] ?? '';
  /* wysyłki z tej sesji (dziennik z bazy przychodzi w `cfg.sent`) */
  const [sentNow, setSentNow] = useState<Record<string, PackSent>>({});
  const [ask, setAsk] = useState<PackKey | null>(null);
  const [busy, setBusy] = useState<PackKey | null>(null);
  const merged: PackConfig = useMemo(() => ({ ...cfg, sent: { ...cfg.sent, ...sentNow } }), [cfg, sentNow]);
  const packs = useMemo(
    () => (week ? PACKS.map((k) => accountingPack(k, week, loads, bills, documents, merged)) : []),
    [week, loads, bills, documents, merged],
  );
  const byId = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const codeOf = (id: string) => byId.get(id)?.code ?? id;

  const send = async (p: Pack) => {
    if (!actions || p.blocks.length) return;
    if (p.sent && ask !== p.key) { setAsk(p.key); return; }
    setAsk(null);
    setBusy(p.key);
    try {
      const s = await actions.send(p.key, p.weekKey, p.to, nowIso);
      if (s) setSentNow((m) => ({ ...m, [`${p.weekKey}:${p.key}`]: s }));
    } finally {
      setBusy(null);
    }
  };
  const zip = (p: Pack) => {
    if (!actions) return;
    const ids = new Set(p.loads.map((l) => l.id));
    const docs = documents.filter((d) => d.loadId && ids.has(d.loadId) && d.category === 'CMR' && d.status === 'UPLOADED');
    void actions.zip(p, docs, codeOf);
  };

  const status = (p: Pack) => {
    if (!p.sent && phone) return null;
    if (p.sent) {
      const { date, time } = sentParts(p.sent);
      const st = ft(locale, `p5_pack_st_${p.sent.status}`);
      return (
        <span className={p.sent.status === 'BLAD' ? 'pack-sent neg' : 'pack-sent'} data-pack-sent={p.sent.status}>
          {phone ? ftp(locale, 'p5_pack_sent_short', { date, time, status: st }) : ftp(locale, 'p5_pack_sent', { date, time, to: addrText(p.sent.to), status: st, by: p.sent.by })}
        </span>
      );
    }
    return <span className="fin-muted">{ft(locale, 'p5_pack_not_sent')}</span>;
  };

  const buttons = (p: Pack) => {
    const blocked = p.blocks.length > 0;
    const first = p.blocks[0];
    const again = ask === p.key && p.sent ? sentParts(p.sent) : null;
    const why = blocked ? <p className="pack-why" id={`pack-why-${p.key}`} data-pack-why={first.kind} data-content>{blockText(locale, p.key, first)}</p> : null;
    /* telefon (img/e40-after): stan wysyłki i powód nad przyciskami; po wysyłce zostaje tylko ZIP */
    return (
      <div className="pack-acts" data-pack-acts={p.key}>
        {phone ? status(p) : null}
        {phone ? why : null}
        <div className="pack-btns">
          {phone && p.sent ? null : (
            <button
              type="button"
              className={p.sent ? 'btn ghost' : 'btn'}
              data-pack-send={p.key}
              disabled={blocked || !actions || busy === p.key}
              aria-describedby={blocked ? `pack-why-${p.key}` : undefined}
              onClick={() => void send(p)}
            >
              {p.sent ? ft(locale, 'p5_pack_resend') : ft(locale, `p5_pack_send_${p.key}`)}
            </button>
          )}
          <button type="button" className="btn ghost" data-pack-zip={p.key} disabled={!actions || !p.bills.length} onClick={() => zip(p)}>
            {ft(locale, 'p5_pack_zip')}
          </button>
          {phone ? null : status(p)}
        </div>
        {phone ? null : why}
        {again ? (
          <div className="pack-again" role="group" aria-label={ft(locale, 'p5_pack_resend')} data-pack-again={p.key}>
            <span>{ftp(locale, 'p5_pack_again', again)}</span>
            <button type="button" className="btn" data-pack-again-yes onClick={() => void send(p)}>{ft(locale, 'p5_pack_again_yes')}</button>
            <button type="button" className="btn ghost" onClick={() => setAsk(null)}>{ft(locale, 'p5_pack_again_no')}</button>
          </div>
        ) : null}
      </div>
    );
  };

  const desktopPack = (p: Pack) => {
    /* E41: KSH — sam kod; paczka HHL — kod · nr zlecenia HHL · nr zlecenia SCX (5B) */
    const name = (id: string, code: string) => {
      const l = byId.get(id);
      if (p.key === 'KSH' || !l) return code;
      return [transportLabel(l, 'HHL'), l.carrierOrderNo?.trim() || null].filter(Boolean).join(' · ');
    };
    return (
      <section key={p.key} className="pack" data-pack={p.key} aria-labelledby={`pack-h-${p.key}`}>
        <h4 className="sec" id={`pack-h-${p.key}`}>{ft(locale, `p5_pack_h_${p.key}`)}</h4>
        <dl className="pack-kv">
          <div>
            <dt>{ft(locale, `p5_pack_inv_${p.key}`)}</dt>
            <dd data-content>
              {p.bills.length ? p.bills.map((b) => (
                <b key={b.id} className="pack-inv">
                  {ftp(locale, 'p5_pack_inv_v', { number: b.number, date: dmy(b.issueDate) })}
                  {b.pdfName || b.pdfStoragePath ? <span className="pack-ok"> · PDF ✓</span> : <span className="neg"> · PDF —</span>}
                </b>
              )) : <span className="neg">{ft(locale, `p5_pack_b_NO_INVOICE_${p.key}`)}</span>}
            </dd>
          </div>
          {p.bills.length ? (
            <div>
              <dt>{ft(locale, 'p5_pack_amounts')}</dt>
              <dd data-deur-exempt="invoice-currency">
                {p.total
                  ? <b>{n2(p.total.net)} · {n2(p.total.vat)} · {n2(p.total.gross)} {p.total.currency}</b>
                  : p.bills.map((b) => <b key={b.id} className="pack-inv">{n2(b.net)} · {n2(b.vat)} · {n2(b.gross)} {b.currency}</b>)}
              </dd>
            </div>
          ) : null}
          {p.key === 'KSH' ? (
            p.bills.length ? <div><dt>{ft(locale, 'p5_pack_count')}</dt><dd><b>{p.loads.length}</b></dd></div> : null
          ) : (
            p.bills.length ? <div><dt>{ft(locale, 'p5_pack_check')}</dt><dd>{p.bills.map((b) => <span key={b.id}>{checkTag(locale, b)}</span>)}</dd></div> : null
          )}
          {p.loads.map((l) => (
            <div key={l.id} data-pack-load={l.code}>
              <dt data-content>{p.key === 'KSH' ? ftp(locale, 'p5_pack_unload', { name: l.code, date: dm(l.unloadDay) }) : name(l.id, l.code)}</dt>
              <dd>{l.cmr
                ? <span className="pack-ok" data-pack-cmr="ok">{ft(locale, `p5_pack_cmr_ok_${p.key}`)} ✓</span>
                : <span className="neg" data-pack-cmr="missing">{ft(locale, 'p5_pack_cmr_no')}</span>}</dd>
            </div>
          ))}
          <div>
            <dt>{ft(locale, 'p5_pack_to')}</dt>
            <dd data-content>{p.to.length ? <b>{p.to.join(', ')}</b> : <span className="neg">{ft(locale, 'p5_pack_to_none')}</span>}</dd>
          </div>
        </dl>
        {p.bills.length ? (
          <ul className="pack-files" data-pack-files={p.key}>
            {p.files.map((f, i) => (
              <li key={f} data-content>
                {f}
                {i === p.files.length - 1 ? <span className="fin-muted"> {ft(locale, `p5_pack_sum_${p.key}`)}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {buttons(p)}
      </section>
    );
  };

  const phonePack = (p: Pack) => {
    const b = p.bills[0];
    const ok = p.loads.filter((l) => l.cmr).length;
    const line = b
      ? ftp(locale, 'p5_pack_phone_line', {
          number: p.bills.map((x) => x.number).join(', '),
          gross: p.total ? `${n2(p.total.gross)} ${p.total.currency}` : p.bills.map((x) => `${n2(x.gross)} ${x.currency}`).join(' + '),
          loads: transportsText(p.loads.length),
          ok,
          all: p.loads.length,
        }) + (ok === p.loads.length && p.loads.length ? ' ✓' : '')
      : ft(locale, `p5_pack_b_NO_INVOICE_${p.key}`);
    const accepted = p.key === 'HHL' && b && p.bills.every((x) => x.verification === 'ZAAKCEPTOWANA' || x.payment === 'OPLACONA');
    return (
      <article key={p.key} className="fin-card pack-card" data-pack={p.key}>
        <header className="fin-card-hd"><b>{ft(locale, `p5_pack_t_${p.key}`)}</b></header>
        <p className="fin-muted" data-content data-deur-exempt="invoice-currency">
          {line}{accepted ? ` · ${ft(locale, 'p5_pack_phone_accepted')}` : ''}
        </p>
        {buttons(p)}
      </article>
    );
  };

  return (
    <section className="panel fin-panel pack-panel" id="fin-pack" data-fin-pack aria-labelledby="fin-pack-h">
      <header className="panel-hd fin-hd2 pack-hd">
        <h3 id="fin-pack-h">{ft(locale, 'p5_pack_h')}</h3>
        {weeks.length ? (
          <select className="input pack-week" value={week} aria-label={ft(locale, 'p5_pack_week')} data-pack-week onChange={(e) => { setWeek(e.target.value); setAsk(null); }}>
            {weeks.map((w) => <option key={w} value={w}>{packWeekLabel(w)}</option>)}
          </select>
        ) : null}
        {phone ? null : <span className="sub">{ft(locale, 'p5_pack_sub')}</span>}
      </header>
      {!weeks.length ? (
        <p className="fin-muted fin-pad">{ft(locale, 'p5_pack_empty')}</p>
      ) : phone ? (
        <div className="fin-cards pack-cards">{packs.map(phonePack)}</div>
      ) : (
        <>
          <div className="pack-grid">{packs.map(desktopPack)}</div>
          <p className="note">{ft(locale, 'p5_pack_note')}</p>
        </>
      )}
    </section>
  );
}
