/**
 * Opcje › Pieniądze › Cennik i opłaty — produkcja w wyglądzie z audytu (E33, E11, E16; audyt-E E-06): ekran `RateCard`
 * (ten sam co w demo) — pozycje według symbolu, koszt SCX i przychód KSH obok siebie, „Nowa wersja cennika” od daty.
 * Dane i zapis jak w dzisiejszym `RateCardForm`: `rate_cards` + `rate_rules` (ostatnia wersja SCX — koszt, KSH — przychód),
 * zapis RPC `rate_card_save` (nowa wersja; wymiary i uwagi pozycji bez zmian, zmienia się tylko cena).
 * Pełny dzisiejszy formularz (wymiary, nowe pozycje, inne firmy, wersje i dziennik) zostaje rozwijany pod tabelą.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { lazyRetry } from '../lib/lazyRetry';
import { getNowIso } from '../lib/frozenNow';
import { localDateOf } from '../lib/money/engine';
import { itemKindName } from '../lib/p5Finance';
import { buildSymbolRules, type SymbolFormRow } from '../lib/rateCard';
import { RateCard } from '../components/options/MoneyScreens';
import type { RateCardRow, RateCardVersion, RateCardView } from '../lib/p5bFuel';

const RateCardForm = lazy(lazyRetry(() => import('./RateCardForm')));
const PROJECT_CODES = ['STEGRA_BODEN', 'STEGRA'] as const;

export interface DbRule {
  cargo_class: 'DIMENSIONED' | 'SYMBOL';
  symbol: string | null; family: string | null; convoy_cars: number | null;
  length_to: number; width_to: number; height_to: number; weight_to: number;
  base_rate: number | string; note: string | null;
}
export interface DbCard { id: string; version: number; valid_from: string; note: string | null; created_at: string; rate_rules: DbRule[] }
type Side = 'KSH' | 'SCX';

/** Klucz pozycji: „SG”, „KR-1” (Kratownice, 1 auto w konwoju). */
export const ruleKey = (r: Pick<DbRule, 'symbol' | 'convoy_cars'>) => `${(r.symbol ?? '').toUpperCase()}${r.convoy_cars ? `-${r.convoy_cars}` : ''}`;

const symbolRules = (c: DbCard | null) => (c?.rate_rules ?? []).filter((r) => r.cargo_class === 'SYMBOL' && r.symbol);

function version(side: Side, c: DbCard | null, by: string): RateCardVersion {
  return c ? { side, v: c.version, from: c.valid_from, note: c.note, at: c.created_at, by } : { side, v: 0, from: '2000-01-01', note: null, at: '', by };
}

/** Ostatnie karty KSH (przychód) i SCX (koszt) → widok tabeli; null — brak obu kart. */
export function rateViewFromDb(ksh: DbCard | null, scx: DbCard | null, by: { ksh: string; scx: string }): RateCardView | null {
  if (!ksh && !scx) return null;
  const map = new Map<string, RateCardRow>();
  const put = (r: DbRule, side: Side) => {
    const id = ruleKey(r);
    const cur = map.get(id) ?? {
      id, symbol: (r.symbol ?? '').toUpperCase(), ...(r.convoy_cars ? { convoy: r.convoy_cars } : {}),
      kind: itemKindName(r.family ?? r.symbol), set: null, costEur: 0, revEur: 0,
    };
    if (side === 'KSH') cur.revEur = Number(r.base_rate); else cur.costEur = Number(r.base_rate);
    map.set(id, cur);
  };
  for (const r of symbolRules(scx)) put(r, 'SCX');
  for (const r of symbolRules(ksh)) put(r, 'KSH');
  const rows = [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol, 'pl') || (a.convoy ?? 0) - (b.convoy ?? 0));
  return { rows, ksh: version('KSH', ksh, by.ksh), scx: version('SCX', scx, by.scx) };
}

const s = (n: number) => String(Number(n)).replace('.', ',');
/** Pozycje bieżącej karty z nowymi cenami → payload `rate_card_save` (ta sama walidacja co w formularzu). */
export function rulesWithPrices(card: DbCard | null, prices: Record<string, number>): Array<Record<string, unknown>> | null {
  const rows: SymbolFormRow[] = symbolRules(card).map((r) => ({
    symbol: r.symbol ?? '', family: r.family ?? '', convoy_cars: r.convoy_cars != null ? String(r.convoy_cars) : '',
    length_to: s(r.length_to), width_to: s(r.width_to), height_to: s(r.height_to), weight_to: s(r.weight_to),
    base_rate: s(prices[ruleKey(r)] ?? Number(r.base_rate)), note: r.note ?? '',
  }));
  const b = buildSymbolRules(rows);
  return 'bad' in b || !b.rules.length ? null : b.rules;
}

type Ctx = { projectId: string; org: Record<Side, string | null>; card: Record<Side, DbCard | null> };

export default function LiveRateCard({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useTowerStore((st) => st.locale);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [view, setView] = useState<RateCardView | null | undefined>(undefined);
  const [ver, setVer] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [pr, og] = await Promise.all([
      sb.from('projects').select('id, code').in('code', [...PROJECT_CODES]),
      sb.from('organizations').select('id, code, kind').in('code', ['KSH', 'SCX']),
    ]);
    const projects = (pr.data ?? []) as { id: string; code: string }[];
    const projectId = (projects.find((p) => p.code === 'STEGRA_BODEN') ?? projects[0])?.id ?? null;
    const orgs = (og.data ?? []) as { id: string; code: string; kind: string }[];
    const org: Record<Side, string | null> = {
      KSH: orgs.find((o) => o.code === 'KSH' && o.kind === 'CLIENT')?.id ?? null,
      SCX: orgs.find((o) => o.code === 'SCX' && o.kind === 'CARRIER')?.id ?? null,
    };
    if (!projectId) { setView(null); return; }
    const last = async (side: 'REVENUE' | 'COST', orgId: string | null) => {
      if (!orgId) return null;
      const c = await sb.from('rate_cards').select('id, version, valid_from, note, created_at, rate_rules(*)')
        .eq('project_id', projectId).eq('side', side).eq('org_id', orgId).order('version', { ascending: false }).limit(1);
      if (c.error) setMsg(c.error.message);
      return ((c.data ?? []) as DbCard[])[0] ?? null;
    };
    const [ksh, scx, log] = await Promise.all([
      last('REVENUE', org.KSH), last('COST', org.SCX),
      sb.rpc('rate_card_change_log', { p_project: projectId, p_limit: 30 }),
    ]);
    /* autor ostatniej wersji z dziennika zmian (ten sam co w formularzu) */
    const rows = (log.data ?? []) as { actor: string; entity_id: string; new_value: { version?: number } | null }[];
    const byOf = (side: 'REVENUE' | 'COST', c: DbCard | null) => rows.find((l) => l.entity_id.split(':')[1] === side && l.new_value?.version === c?.version)?.actor ?? '';
    setCtx({ projectId, org, card: { KSH: ksh, SCX: scx } });
    setView(rateViewFromDb(ksh, scx, { ksh: byOf('REVENUE', ksh), scx: byOf('COST', scx) }));
    setVer((v) => v + 1);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (side: Side, from: string, prices: Record<string, number>, note: string): Promise<boolean> => {
    if (readOnly || !ctx || !ctx.org[side]) return false;
    const rules = rulesWithPrices(ctx.card[side], prices);
    if (!rules) { setMsg(t(locale, 'ol2_rate_bad')); return false; }
    const sb = await getSupabase();
    const { error } = await sb.rpc('rate_card_save', {
      p_project: ctx.projectId, p_side: side === 'KSH' ? 'REVENUE' : 'COST', p_org: ctx.org[side], p: { valid_from: from, note, rules },
    });
    if (error) { setMsg(error.message); return false; }
    setMsg(null);
    void refresh();
    return true;
  }, [readOnly, ctx, locale, refresh]);

  const nowIso = getNowIso();
  return (
    <div data-panel="live-rate-card">
      {msg ? <div className="note" role="status">{msg}</div> : null}
      {view === null ? <div className="note option-note">{t(locale, 'i2_rates_no_source')}</div> : null}
      {view ? <RateCard key={ver} locale={locale} view={view} today={localDateOf(nowIso)} nowIso={nowIso} readOnly={readOnly} onSave={readOnly ? null : save} /> : null}
      <details className="ol2-more" data-live-rate-more>
        <summary>{t(locale, 'ol2_rate_more')}</summary>
        <Suspense fallback={null}><RateCardForm readOnly={readOnly} /></Suspense>
      </details>
    </div>
  );
}
