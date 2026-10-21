/**
 * wyglad/P6 — „Do zrobienia” (E7 pkt 1–3, 9; E6; E7-2, E7-6; G-22; L14), img/e7-desk lewa kolumna, img/e7-phone.
 * Liczba w nagłówku = liczba w menu, w Kokpicie i w dzwonku (`todoQueue`, E7-2). Filtry Moje / Moja firma / Wszystkie;
 * najpilniejsze najpierw; pierwsze karty od razu, reszta pod „… jeszcze N kart”. Karta rozwija się w miejscu.
 * Zapisy jak dotąd: rozstrzygnięcie decyzji (`decision_resolve`, `decision_snooze`), dopłata — okno „Dopłata” z P5,
 * „czy dostarczono?” — jak w panelu transportu. Przydział („Biorę tę sprawę”) i osoby — `p6Source.ts` (wykonawca).
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Geofence, Load, Locale, Risk } from '../../types';
import { useTowerStore } from '../../store/useTowerStore';
import { buildTodo, countedFor, defaultScope, scopeCards, visibleTodoRisks, type CaseEvent, type CasePerson, type TodoIssue, type TodoScope } from '../../lib/p6Todo';
import { todoRisks, type AccountKind } from '../../lib/cockpitE9';
import { caseAssignmentsOf, caseHistoryOf, caseMeOf, casePeopleOf, sampleDecisionsOf, extraRisksOf, todoExtrasOf } from '../../lib/p6Source';
import { feeRulesOf, feeSuggestionsOf } from '../../lib/p5Source';
import { deliveredCheckOf } from '../../lib/p4cSource';
import { deliveredCheckResolve } from '../../lib/deliveredCheckResolve';
import { detourCasesOf, detourDecideOf } from '../../lib/e49Source';
import { kmText, mergeClosures, minText, urgentOf } from '../../lib/e49Detour';
import { e49t } from '../../i18n/e49';
import { timeOnly } from '../../lib/statusAxis';
import { mayResolveDecision } from '../../lib/decisionAccess';
import { lazyRetry } from '../../lib/lazyRetry';
import { tp, t } from '../../i18n/messages';
import { rt, rtn, rtp } from '../../i18n/p6';
import type { FeeDecision } from '../../lib/p5Fees';
import type { DecisionsApi } from './useDecisions';
import { TodoCardView, type CardCtx } from './TodoCard';
import { accountRole } from '../../lib/accountRole';

const FeeModal = lazy(lazyRetry(() => import('../drawer/FeeModal').then((m) => ({ default: m.FeeModal }))));

const FIRST = 4;

interface Props {
  role: 'HHL' | 'SCX';
  kind: string;
  locale: Locale;
  phone: boolean;
  nowIso: string;
  loads: readonly Load[];
  risks: readonly Risk[];
  geofences: readonly Pick<Geofence, 'type' | 'name'>[];
  /** liczba z menu (E7-2) */
  count: number;
  decisions: DecisionsApi | null;
  /** w telefonie nagłówek z liczbą jest na zakładce */
  showHead?: boolean;
}

export function TodoPanel({ role, kind, locale, phone, nowIso, loads, risks, geofences, count, decisions, showHead = true }: Props) {
  const navigate = useNavigate();
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const setDrawerTab = useTowerStore((s) => s.setDrawerTab);
  const setView = useTowerStore((s) => s.setView);
  const setOpenInvoiceId = useTowerStore((s) => s.setOpenInvoiceId);
  const openDecisionId = useTowerStore((s) => s.openDecisionId);
  const setOpenDecisionId = useTowerStore((s) => s.setOpenDecisionId);
  const setAccessMessage = useTowerStore((s) => s.setAccessMessage);
  const riskFilter = useTowerStore((s) => s.riskFilter);
  const events = useTowerStore((s) => s.events);

  const me = useMemo(() => caseMeOf(role), [role]);
  const [assign, setAssign] = useState<Record<string, string> | null>(() => caseAssignmentsOf());
  const [extraHist, setExtraHist] = useState<Record<string, CaseEvent[]>>({});
  const [scope, setScope] = useState<TodoScope>(() => defaultScope(kind));
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openIssue, setOpenIssue] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [feeFor, setFeeFor] = useState<TodoIssue | null>(null);
  const [feeDone, setFeeDone] = useState<Set<string>>(() => new Set());
  const [checkDone, setCheckDone] = useState<Set<string>>(() => new Set());
  const [detourDone, setDetourDone] = useState<Set<string>>(() => new Set());
  const [detourBusy, setDetourBusy] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState<string | null>(null);
  const checkBusyRef = useRef<string | null>(null);

  useEffect(() => setScope(defaultScope(kind)), [kind]);

  const loadById = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const visRisks = useMemo(() => visibleTodoRisks(role, [...risks, ...extraRisksOf(loads, nowIso)]), [role, risks, loads, nowIso]);
  const decs = useMemo(() => {
    const rows = decisions ? decisions.rows : sampleDecisionsOf(loads, nowIso, role);
    return role === 'SCX' ? rows.filter((d) => d.decider === 'SCX') : rows;
  }, [decisions, loads, nowIso, role]);

  const cards = useMemo(() => {
    const base = buildTodo({ risks: visRisks, decisions: decs, nowIso });
    const cardLoads = new Set(base.map((c) => c.loadId).filter((x): x is string => !!x));
    const items = loads.map((load) => ({
      load,
      fees: (feeSuggestionsOf(load) ?? []).filter((f) => !feeDone.has(f.id)),
      check: (() => {
        const c = deliveredCheckOf(load, loads, geofences, nowIso, role, events);
        return c && !checkDone.has(c.id) ? c : null;
      })(),
    }));
    const extras = todoExtrasOf(role, items, cardLoads);
    /* wyglad/E49: zamknięty most albo droga — sprawa SCX „Objazd czy postój?” (D-20261016-0230-01 Z3);
       audyt-C (C-02): ryzyko zamknięcia przy tym transporcie łączy się ze sprawą (jedna sprawa w karcie) */
    const detours = detourCasesOf(role, loads, nowIso, cardLoads).filter((c) => !detourDone.has(c.id));
    const joined = mergeClosures(visRisks, detours);
    /* audyt-C (C-02): sprawa po połączeniu ma co najmniej wagę połączonego ryzyka zamknięcia (np. „krytyczne”) — stoi tam, gdzie stało ryzyko */
    const sevRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
    const mergedSev = (caseId: string): 'CRITICAL' | 'HIGH' | null => {
      const ids = new Set(joined.mergedIds[caseId] ?? []);
      return visRisks.some((r) => ids.has(r.id) && sevRank[r.severity as keyof typeof sevRank] >= 4) ? 'CRITICAL' : null;
    };
    for (const c of detours) {
      extras.push({
        id: c.id, src: 'DETOUR', loadId: c.loadId, owner: 'SCX', severity: urgentOf(c, nowIso) || mergedSev(c.id) === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        dueAt: c.decideByIso, overdue: Date.parse(c.decideByIso) < Date.parse(nowIso), merged: 1, go: 'NONE', ageHours: 0, detour: c,
        ...(joined.mergedIds[c.id] ? { mergedIds: [c.id, ...joined.mergedIds[c.id]] } : {}),
      });
    }
    return extras.length ? buildTodo({ risks: joined.risks, decisions: decs, extras, nowIso }) : base;
  }, [visRisks, decs, nowIso, loads, geofences, role, feeDone, checkDone, detourDone, events]);

  const assigneeOf = (id: string): CasePerson | null => {
    const pid = assign?.[id];
    if (!pid) return null;
    if (me && pid === me.id) return me;
    return [...(casePeopleOf('HHL') ?? []), ...(casePeopleOf('SCX') ?? [])].find((p) => p.id === pid) ?? null;
  };

  /* audyt-F F-01: Operacje HHL — „Moja firma” z tych spraw, które liczy menu (filtr = nagłówek = menu = Kokpit) */
  const counted = useMemo(() => countedFor(kind, todoRisks(role, risks, kind as AccountKind)), [kind, role, risks]);
  const counts = useMemo(() => ({
    MINE: scopeCards(cards, 'MINE', role, assigneeOf, me?.id ?? null).length,
    FIRM: scopeCards(cards, 'FIRM', role, assigneeOf, me?.id ?? null, counted).length,
    ALL: cards.length,
  }), [cards, role, assign, me, counted]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => scopeCards(cards, scope, role, assigneeOf, me?.id ?? null, counted), [cards, scope, role, assign, me, counted]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = expanded ?? new Set(shown[0] ? [shown[0].key] : []);
  const list = showAll ? shown : shown.slice(0, FIRST);
  const rest = shown.length - list.length;

  /* E7-6: stare linki `/#/decyzje/<id>` i dzwonek — karta sprawy otwarta w „Do zrobienia” */
  const focusIssue = (issueId: string): boolean => {
    const c = cards.find((x) => x.issues.some((i) => i.id === issueId || i.mergedIds?.includes(issueId) || i.coveredIds?.includes(issueId)));
    if (!c) return false;
    const target = c.issues.find((i) => i.id === issueId || i.mergedIds?.includes(issueId) || i.coveredIds?.includes(issueId))!;
    setScope('ALL');
    setShowAll(true);
    setExpanded(new Set([...open, c.key]));
    setOpenIssue(target.id);
    window.requestAnimationFrame(() => document.querySelector(`[data-rk-issue="${CSS.escape(target.id)}"]`)?.scrollIntoView({ block: 'center' }));
    return true;
  };
  /* fokus nie ginie po zmianie przycisku („Biorę tę sprawę” → „Oddaj”, E6-5) */
  const focusLater = (sel: string) => window.requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
  useEffect(() => {
    if (!openDecisionId) return;
    if (focusIssue(openDecisionId)) setOpenDecisionId(null);
    else if (!decisions || decisions.rows.length || decisions.error) {
      setAccessMessage('Brak dostępu');
      setOpenDecisionId(null);
    }
  }, [openDecisionId, cards]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (riskFilter && riskFilter !== 'ALL') focusIssue(riskFilter);
  }, [riskFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const addHist = (id: string, what: string) => {
    if (!me) return;
    const who = `${me.name} // ${rt(locale, `p6_org_${me.org}`)}`;
    setExtraHist((h) => ({ ...h, [id]: [...(h[id] ?? []), { at: nowIso, who, what }] }));
  };
  const setOwner = (id: string, pid: string | null) => setAssign((a) => {
    const next = { ...(a ?? {}) };
    if (pid) next[id] = pid;
    else delete next[id];
    return next;
  });

  const ctx: CardCtx = {
    role, locale, phone, nowIso,
    loadOf: (id) => loadById.get(id),
    assignOn: assign != null && me != null,
    assignee: assigneeOf,
    me,
    peopleOf: casePeopleOf,
    historyOf: (id) => {
      const base = caseHistoryOf(id, nowIso);
      return base == null ? null : [...base, ...(extraHist[id] ?? [])];
    },
    onTake: (i) => {
      if (!me) return;
      setOwner(i.id, me.id);
      addHist(i.id, rt(locale, 'p6_hist_took'));
      focusLater(`[data-rk-give="${CSS.escape(i.id)}"]`);
    },
    onGive: (i) => {
      setOwner(i.id, null);
      addHist(i.id, rt(locale, 'p6_hist_gave'));
      focusLater(`[data-rk-take="${CSS.escape(i.id)}"]`);
    },
    onTakeover: (i) => {
      setConfirmId(i.id);
      focusLater(`[data-rk-confirm="${CSS.escape(i.id)}"]`);
    },
    confirmId,
    onConfirm: (i) => {
      const prev = assigneeOf(i.id);
      if (me) {
        setOwner(i.id, me.id);
        addHist(i.id, rtp(locale, 'p6_hist_tookover', { name: prev?.name ?? '—' }));
      }
      setConfirmId(null);
      focusLater(`[data-rk-give="${CSS.escape(i.id)}"]`);
    },
    onCancelConfirm: () => {
      const id = confirmId;
      setConfirmId(null);
      if (id) focusLater(`[data-rk-takeover="${CSS.escape(id)}"]`);
    },
    onGo: (i) => {
      /* A4 (wyglad/W-faktura-termin): „Otwórz fakturę” — Faktury z otwartą fakturą (jak link z dzwonka i e-maila) */
      if (i.go === 'INVOICE' && i.risk?.invoiceId) {
        setOpenInvoiceId(i.risk.invoiceId);
        setView('inv');
        return;
      }
      if (!i.loadId) {
        if (i.go === 'DOCS') setView('docs');
        return;
      }
      selectLoad(i.loadId);
      setDrawerTab(i.go === 'AWIZACJA' ? 'overview' : i.go === 'DOCS' ? 'docs' : i.go === 'PRICING' ? 'pricing' : null);
    },
    onFee: (i) => setFeeFor(i),
    checkHandlers: (i) => {
      if (!i.check || !i.loadId) return {};
      const chk = i.check;
      const loadId = i.loadId;
      if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
        const run = (yes: boolean) => {
          if (checkBusyRef.current) return;
          checkBusyRef.current = i.id;
          setCheckBusy(i.id);
          void deliveredCheckResolve(loadId, yes, null).then(async (r) => {
            if (!r.ok) {
              useTowerStore.getState().pushToast(r.error ?? t(locale, 'p4c_dc_no_done'), 'HIGH', loadId);
              return;
            }
            setCheckDone((s) => new Set(s).add(chk.id));
            if (!yes) useTowerStore.getState().pushToast(t(locale, 'p4c_dc_no_done'), 'LOW', loadId);
            const { refreshFromServer } = await import('../../data/supabaseBridge');
            await refreshFromServer();
          }).finally(() => {
            checkBusyRef.current = null;
            setCheckBusy(null);
          });
        };
        return {
          busy: checkBusy === i.id,
          onYes: () => run(true),
          onNo: () => run(false),
        };
      }
      return {
        onYes: () => {
          useTowerStore.getState().setLoadStatus(loadId, 'DELIVERED', role, tp(locale, 'p4c_dc_note_yes', { n: chk.minutes }), chk.exitAt);
          setCheckDone((s) => new Set(s).add(chk.id));
        },
        onNo: () => {
          setCheckDone((s) => new Set(s).add(chk.id));
          useTowerStore.getState().appendEvent({ loadId, type: 'NOTE', at: nowIso, actor: role, note: tp(locale, 'p4c_dc_note_no', { n: chk.minutes }) });
          useTowerStore.getState().pushToast(t(locale, 'p4c_dc_no_done'), 'LOW', loadId);
        },
      };
    },
    detourHandlers: (i) => {
      const save = detourDecideOf();
      const c = i.detour;
      return {
        canDecide: role === 'SCX',
        busy: detourBusy === i.id,
        onDecide: save && c ? (pick, note) => {
          setDetourBusy(i.id);
          const by = me ? `${me.name} // ${rt(locale, `p6_org_${me.org}`)}` : 'SCX';
          void save(c.id, { pick, by, atIso: nowIso, note }).then((r) => {
            setDetourBusy(null);
            if (!r.ok) return;
            const what = (pick === 'HOLD'
              ? (c.hold.untilIso ? e49t('e49_hist_hold', { t: timeOnly(c.hold.untilIso), place: c.place }) : e49t('e49_hist_hold_unknown', { place: c.place }))
              : e49t('e49_hist_detour', {
                via: 'none' in c.detour ? '' : c.detour.via,
                km: 'none' in c.detour ? '' : kmText(c.detour.addKm),
                d: 'none' in c.detour ? '' : minText(c.detour.addMin),
                place: c.place,
              })) + (note ? e49t('e49_hist_note', { n: note }) : '');
            useTowerStore.getState().appendEvent({ loadId: c.loadId, type: 'NOTE', at: nowIso, actor: role, note: what });
            useTowerStore.getState().pushToast(e49t(pick === 'HOLD' ? 'e49_done_hold' : 'e49_done_detour'), 'LOW', c.loadId);
            setDetourDone((s) => new Set(s).add(c.id));
          });
        } : null,
      };
    },
    decisions,
    mayResolve: (deciderRole) => mayResolveDecision(deciderRole, accountRole(role)),
    onResolved: (i, hint) => {
      setOpenIssue(null);
      if (hint === 'BACKUP_RETRY') navigate({ pathname: '/opcje/stan-systemu', search: 'kopia=1' });
      else if (i.loadId && hint) {
        selectLoad(i.loadId);
        setDrawerTab(hint === 'OPEN_AWIZACJA' || hint === 'PICK_SAILING' ? 'overview' : hint === 'OPEN_DOC' ? 'docs' : hint === 'ADD_FEE' ? 'pricing' : null);
      }
    },
  };

  const feeLoad = feeFor?.loadId ? loadById.get(feeFor.loadId) : undefined;
  const scopes: TodoScope[] = ctx.assignOn ? ['MINE', 'FIRM', 'ALL'] : ['FIRM', 'ALL'];

  return (
    <section
      className="panel rk-panel rk-todo"
      data-rk-todo
      aria-labelledby={showHead ? 'rk-todo-h' : undefined}
      aria-label={showHead ? undefined : `${rt(locale, 'p6_todo')} ${count}`}
    >
      {showHead ? (
        <header className="rk-head">
          <h2 id="rk-todo-h">
            {rt(locale, 'p6_todo')} <span className="rk-count" data-rk-count>{count}</span>
          </h2>
          {!phone ? <span className="rk-head-note">{rt(locale, 'p6_todo_same')}</span> : null}
        </header>
      ) : null}
      <div className="rk-filters">
        <div className="rk-chips" role="group" aria-label={rt(locale, 'p6_scope_aria')}>
          {scopes.map((s) => (
            <button
              key={s}
              type="button"
              className="rk-chip"
              aria-pressed={scope === s}
              data-rk-scope={s}
              onClick={() => { setScope(s); setShowAll(false); setExpanded(null); setOpenIssue(null); }}
            >
              {rt(locale, `p6_scope_${s}`)} <span className="rk-chip-n">{counts[s]}</span>
            </button>
          ))}
        </div>
        {!phone ? <span className="rk-sort">{rt(locale, 'p6_sort')}</span> : null}
      </div>
      {shown.length === 0 ? (
        <p className="rk-empty">{rt(locale, `p6_empty_${scope}`)}</p>
      ) : (
        <div className="rk-cards">
          {list.map((c) => (
            <TodoCardView
              key={c.key}
              card={c}
              ctx={ctx}
              expanded={open.has(c.key)}
              onToggle={() => {
                const next = new Set(open);
                if (next.has(c.key)) next.delete(c.key);
                else next.add(c.key);
                setExpanded(next);
              }}
              openIssue={openIssue}
              setOpenIssue={setOpenIssue}
            />
          ))}
          {rest > 0 ? (
            <button type="button" className="rk-card rk-rest" data-rk-rest onClick={() => setShowAll(true)}>
              <span className="rk-card-tx">
                <span className="rk-card-t">{rtn(locale, 'p6_more', rest)}</span>
                <span className="rk-card-s">{rt(locale, 'p6_more_sub')}</span>
              </span>
              <span className="rk-tag is-plain">{rt(locale, 'p6_expand')}</span>
            </button>
          ) : null}
        </div>
      )}
      {decisions?.error ? <p className="rk-muted neg">{decisions.error}</p> : null}
      {feeFor?.fee && feeLoad ? (
        <Suspense fallback={null}>
          <FeeModal
            load={feeLoad}
            role={role}
            locale={locale}
            rules={feeRulesOf()}
            suggestions={feeSuggestionsOf(feeLoad) ?? []}
            initial={feeFor.fee}
            onClose={() => setFeeFor(null)}
            onDecide={(id: string, d: FeeDecision) => {
              void d;
              setFeeDone((s) => new Set(s).add(id));
              setFeeFor(null);
            }}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
