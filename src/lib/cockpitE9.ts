/**
 * wyglad/P3-b — kafelki Kokpitu każdej firmy według E9 (decyzja 07.10 19:11, img/e9-after).
 *
 * Moduł czysty: z danych, które już są w aplikacji, układa 6 kafelków dla firmy (etykieta, liczba, „z N”, opis,
 * krótki opis na telefon, cel kliknięcia). Gdzie Kokpit nie ma jeszcze danych (np. pomiar morza w produkcji),
 * kafelek nie zgaduje (konstytucja III.1), tylko mówi, gdzie są (strona Ryzyka).
 * Definicje liczb są zgodne z treścią E9; dokładne reguły (E7 „Do zrobienia”, E15 terminowość, E16 marża,
 * E25 „Gotowe do fakturowania”) podłącza wykonawca w swoich paczkach (P4–P6) — wygląd się nie zmienia.
 */
import type { Bill, Document, Load, Locale, LoadStatus, OrgKind, Risk, RoleId } from '../types';
import type { NavKey } from './permissions';
import { formatListDateTime, formatPlNumber } from './format';
import { t, tp } from '../i18n/messages';
import { isoWeekNumber } from './cockpitTiles';
import { isLoadCompleted } from './invoiceMatch';
import { isTodoRisk, todoCardKey } from './todoRules';

export type CockpitTone = 'default' | 'alert' | 'warn' | 'good';

export interface CockpitTile {
  id: string;
  label: string;
  labelShort: string;
  /** Strona, na którą prowadzi kafelek (podpis „Mapa ›” na komputerze); brak = tylko „›”. */
  go: NavKey | null;
  value: string;
  /** Liczba na telefonie, gdy inna niż na komputerze (np. „08.10 18:00” bez przecinka). */
  valueShort?: string;
  /** Mały dopisek przy liczbie: „z 94”, „%”. */
  of: string | null;
  desc: string;
  descShort: string;
  tone: CockpitTone;
  /** Kafelek z kwotą — poziom pewności (G4 z M8) pokazuje widok. */
  money?: boolean;
}

export interface CockpitInput {
  role: RoleId;
  locale: Locale;
  nowIso: string;
  loads: readonly Load[];
  documents: readonly Document[];
  /** Faktury z tabeli Faktur (`bills`): SCX → HHL i HHL → KSH. */
  bills: readonly Bill[];
  /** „Do zrobienia” konta (todoQueue): razem, ile transportów, ile spraw bez transportu (E7 w P6). */
  todo: TodoQueue;
  /** Najbliższy rejs do Szwecji: statek, trasa, odjazd; prognoza morza, gdy jest źródło. */
  ferry: { vessel: string; route: string; depIso: string; sea: { waveM: number; risk: string; gustKn?: number | null } | null } | null;
  /** Od kiedy transport stoi na placu w Boden (wjazd w strefę) — KSH „SG-03 na placu w Boden od 08:35”; brak = bez godziny. */
  siteSince?: ReadonlyMap<string, string>;
  /** Suma marży i przychodu w walucie widoku (marża ważona przychodem, E16) + kwota marży już sformatowana. */
  margin: { pct: number | null; moneyText: string; tierText: string };
}

const TZ = 'Europe/Warsaw';

/** Dzień kalendarza „RRRR-MM-DD” w czasie warszawskim. */
export function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const raw = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/* Według statusu, nie etapu paska (E25, E28): etap „DELIVERED” w produkcji nie występuje, a „Na placu” (AT_SITE)
   i „Rozładowany” (UNLOADED) mają w aplikacji statusy APPROACHING_SITE i UNLOADING (src/data/mappers.ts). */
const PRE_LOADING: ReadonlySet<LoadStatus> = new Set<LoadStatus>(['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING', 'READY']);
/** Przygotowanie — przed załadunkiem („bez wyjazdu”). */
const notDeparted = (l: Pick<Load, 'status'>) => PRE_LOADING.has(l.status);
/** Rozładowany albo Dostarczone (jak tabela Faktur: isLoadCompleted). */
const delivered = (l: Pick<Load, 'status' | 'stage'>) => isLoadCompleted(l);
/** Na placu w Boden. */
const onSite = (l: Pick<Load, 'status'>) => l.status === 'APPROACHING_SITE';
const codes = (ls: readonly Load[], max = 2) => {
  const list = ls.map((l) => l.code);
  return list.length > max ? `${list.slice(0, max).join(', ')} +${list.length - max}` : list.join(', ');
};

function hasDoc(documents: readonly Document[], loadId: string, cat: Document['category']): boolean {
  return documents.some((d) => d.loadId === loadId && d.category === cat && d.status === 'UPLOADED');
}

export interface TodoQueue { total: number; loads: number; other: number }

/** Rodzaj konta oglądanej firmy: z profilu, gdy to firma zalogowanej osoby; w Podglądzie — rodzaj domyślny tej firmy. */
export type AccountKind = 'HHL_ADMIN' | 'HHL_OPS' | 'CLIENT_USER' | 'CARRIER_DISPATCH' | 'CARRIER_USER';
const KIND_ORG: Record<AccountKind, RoleId> = {
  HHL_ADMIN: 'HHL', HHL_OPS: 'HHL', CLIENT_USER: 'KSH', CARRIER_DISPATCH: 'SCX', CARRIER_USER: 'SCX',
};
const DEFAULT_KIND: Record<RoleId, AccountKind> = { HHL: 'HHL_ADMIN', KSH: 'CLIENT_USER', SCX: 'CARRIER_DISPATCH' };
export function viewedKind(role: RoleId, profileRole: string | null | undefined): AccountKind {
  const k = profileRole as AccountKind | null | undefined;
  return k && KIND_ORG[k] === role ? k : DEFAULT_KIND[role];
}

/**
 * Sprawy „Do zrobienia” konta (E9, tabela „Ryzyka › Do zrobienia”): HHL Administrator — wszystkie sprawy,
 * HHL Operacje — sprawy HHL, SCX — sprawy SCX, KSH — brak listy (tylko sytuacja na trasie).
 * wyglad/P6 (E7): bez komunikatów technicznych drogi, bez zakazów ruchu (informacja przy transporcie), bez sytuacji na trasie
 * bez transportu i bez spraw technicznych (Stan systemu) — `todoRules.ts`.
 * Ta sama lista daje liczbę na kafelku, przy „Ryzyka” w menu i na dolnym pasku oraz „Najpilniejsze” pod kafelkami.
 * Decyzje, dopłaty i sprawy L14 w tej liczbie oraz samozamykanie (E7 pkt 3) podłącza wykonawca w P6 — w tym miejscu.
 */
export function todoRisks<T extends Pick<Risk, 'title' | 'owner'> & Partial<Pick<Risk, 'loadId' | 'type' | 'kind' | 'code'>>>(
  role: RoleId, risks: readonly T[], kind?: AccountKind,
): T[] {
  if (role === 'KSH') return [];
  const open = risks.filter((r) => isTodoRisk(r));
  if (role === 'SCX') return open.filter((r) => r.owner === 'SCX');
  return kind === 'HHL_OPS' ? open.filter((r) => r.owner === 'HHL') : open;
}

/** wyglad/P6 (E7 pkt 1–3): liczba = karty — jedna na transport, jednakowe sprawy bez transportu razem („12 SEFS → 1”). */
export function todoQueue(
  role: RoleId,
  risks: readonly (Pick<Risk, 'title' | 'owner'> & Partial<Pick<Risk, 'loadId' | 'type' | 'kind' | 'code'>>)[],
  kind?: AccountKind,
): TodoQueue | null {
  if (role === 'KSH') return null;
  const list = todoRisks(role, risks, kind);
  const withLoad = new Set(list.filter((r) => r.loadId).map((r) => r.loadId as string));
  const other = new Set(list.filter((r) => !r.loadId).map((r) => todoCardKey(r)));
  return { total: withLoad.size + other.size, loads: withLoad.size, other: other.size };
}

/** Transporty na fakturach wystawionych przez firmę (tabela Faktur, `bills`). */
export function loadsBilledBy(bills: readonly Pick<Bill, 'issuer' | 'lines'>[], issuer: OrgKind): Set<string> {
  return new Set<string>(bills.filter((b) => b.issuer === issuer).flatMap((b) => b.lines.map((ln) => ln.loadId)));
}

/**
 * Liczba przy „Faktury” w menu (E9): faktury czekające na moje działanie plus transporty gotowe do mojej faktury.
 * Czeka na mnie: faktura do mnie „do weryfikacji” (sprawdzam ją) albo moja faktura „sporna” (odpowiada tylko wystawca,
 * canReplyDispute). Gotowe do mojej faktury (HHL, SCX): rozładowane z podpisanym CMR, jeszcze bez mojej faktury.
 * Status E25 „Gotowe do fakturowania” i ewentualnie „zgodna” czekająca na akceptację — P4 (wykonawca).
 */
export function invoiceTodoCount(
  role: RoleId,
  input: { loads: readonly Load[]; documents: readonly Document[]; bills: readonly Bill[] },
): number {
  const { loads, documents, bills } = input;
  const waiting = bills.filter((b) =>
    (b.recipient === role && b.verification === 'DO_WERYFIKACJI') || (b.issuer === role && b.verification === 'SPORNA')).length;
  if (role === 'KSH') return waiting;
  const mine = loadsBilledBy(bills, role);
  const ready = loads.filter((l) => delivered(l) && !mine.has(l.id) && hasDoc(documents, l.id, 'CMR')).length;
  return waiting + ready;
}

/** Wspólne liczby z danych (bez zapisu, bez zapytań). */
export function cockpitFacts(input: Pick<CockpitInput, 'loads' | 'documents' | 'nowIso' | 'bills'>) {
  const { loads, documents, nowIso, bills } = input;
  const scxBilled = loadsBilledBy(bills, 'SCX');
  const hhlBilled = loadsBilledBy(bills, 'HHL');
  const today = dayKey(nowIso) ?? nowIso.slice(0, 10);
  const in7 = addDays(today, 6);
  const in72 = addDays(today, 3);
  const loads7 = loads.filter((l) => {
    const d = dayKey(l.plannedLoadDate);
    return notDeparted(l) && d != null && d >= today && d <= in7;
  });
  const lateLoads = loads.filter((l) => {
    const d = dayKey(l.plannedLoadDate);
    return notDeparted(l) && d != null && d < today;
  });
  const permitsOk7 = loads7.filter((l) => hasDoc(documents, l.id, 'PERMIT_PL') && hasDoc(documents, l.id, 'PERMIT_SE')).length;
  const atSite = loads.filter(onSite);
  const inTransit = loads.filter((l) => !notDeparted(l) && !delivered(l));
  const done = loads.filter(delivered);
  const doneNoCmr = done.filter((l) => !hasDoc(documents, l.id, 'CMR'));
  /* SCX „Do zafakturowania”: rozładowane bez faktury SCX; gotowe = z podpisanym CMR */
  const toInvoice = done.filter((l) => !scxBilled.has(l.id));
  const toInvoiceNoCmr = toInvoice.filter((l) => !hasDoc(documents, l.id, 'CMR'));
  /* HHL „gotowe do faktury”: dostarczone z podpisanym CMR, jeszcze bez faktury HHL → KSH (E25 READY_TO_INVOICE — reguła w P4) */
  const readyToInvoice = done.filter((l) => !hhlBilled.has(l.id) && hasDoc(documents, l.id, 'CMR'));
  const plan72 = loads.filter((l) => {
    const d = dayKey(l.plannedDeliverDate);
    return !delivered(l) && d != null && d >= today && d <= in72;
  });
  /* Terminowość: dostawy z datą rozładunku; w terminie = rozładunek nie później niż dzień dostawy z planu. */
  const doneDated = done
    .filter((l) => dayKey(l.unloadedAt) && dayKey(l.plannedDeliverDate))
    .sort((a, b) => Date.parse(String(b.unloadedAt)) - Date.parse(String(a.unloadedAt)));
  const onTime = doneDated.filter((l) => (dayKey(l.unloadedAt) as string) <= (dayKey(l.plannedDeliverDate) as string));
  return { today, loads7, lateLoads, permitsOk7, atSite, inTransit, done, doneNoCmr, toInvoice, toInvoiceNoCmr, readyToInvoice, plan72, doneDated, onTime };
}

function shortDate(day: string | null): string {
  return day ? formatListDateTime(day) : '—';
}

export function buildCockpit(input: CockpitInput): CockpitTile[] {
  const { role, locale, loads, bills, todo, ferry, margin } = input;
  const f = cockpitFacts(input);
  const L = (k: string, p?: Record<string, unknown>) => (p ? tp(locale, k, p as never) : t(locale, k));

  /* jeden transport na placu i znana godzina wjazdu → „od 08:35” (KSH i SCX, img/e9-after) */
  const siteSinceText = () => {
    const since = f.atSite.length === 1 ? input.siteSince?.get(f.atSite[0].id) : undefined;
    return since ? ` ${L('p3b_since', { time: formatListDateTime(since).replace(/^.*, /, '') })}` : '';
  };
  /* HHL: „na placu w Boden: SG-03”; KSH i SCX: „SG-03 na placu w Boden” (img/e9-after) */
  const siteDesc = f.atSite.length
    ? role === 'HHL'
      ? { desc: L('p3b_at_site', { codes: codes(f.atSite) }), short: L('p3b_at_site_short', { codes: codes(f.atSite, 1) }) }
      : { desc: L('p3b_site_ksh', { codes: codes(f.atSite) }) + siteSinceText(), short: L('p3b_site_ksh_short', { codes: codes(f.atSite, 1) }) }
    : { desc: L('p3b_on_road'), short: L('p3b_on_road') };

  const inTransit: CockpitTile = {
    id: 'in-transit', label: L('p3b_in_transit'), labelShort: L('p3b_in_transit'), go: 'map',
    value: String(f.inTransit.length), of: null, desc: siteDesc.desc, descShort: siteDesc.short, tone: 'default',
  };

  const otif = (): CockpitTile => {
    const last = f.doneDated[0];
    if (!last) {
      return { id: 'otif', label: L('p3b_otif'), labelShort: L('p3b_otif'), go: null, value: '—', of: null,
        desc: L('p3b_otif_none'), descShort: L('p3b_otif_none_short'), tone: 'default' };
    }
    const plan = dayKey(last.plannedDeliverDate) as string;
    const doneDay = dayKey(last.unloadedAt) as string;
    const late = daysBetween(plan, doneDay);
    return {
      id: 'otif', label: L('p3b_otif'), labelShort: L('p3b_otif'), go: null,
      value: String(f.onTime.length), of: L('p3b_of', { n: String(f.doneDated.length) }),
      desc: L('p3b_otif_desc', { code: last.code, plan: shortDate(plan), done: shortDate(doneDay) }),
      descShort: late > 0 ? L('p3b_otif_late_short', { code: last.code, d: late }) : L('p3b_otif_ok_short', { code: last.code }),
      tone: 'default',
    };
  };

  const ferryTile = (withGusts: boolean): CockpitTile => {
    if (!ferry) {
      return { id: 'ferry', label: L('p3b_ferry'), labelShort: L('p3b_ferry'), go: 'risk', value: '—', of: null,
        desc: L('p3b_ferry_none'), descShort: L('p3b_ferry_none'), tone: 'default' };
    }
    const when = formatListDateTime(ferry.depIso);
    /* komputer „08.10, 18:00”, telefon „08.10 18:00” */
    const whenShort = when.replace(', ', ' ');
    const wave = ferry.sea ? formatPlNumber(ferry.sea.waveM, 1) : '';
    /* SCX: także porywy (B7), gdy źródło je podaje */
    const gust = withGusts && ferry.sea?.gustKn != null ? formatPlNumber(ferry.sea.gustKn, 0) : null;
    return {
      id: 'ferry', label: L('p3b_ferry'), labelShort: L('p3b_ferry'), go: 'risk',
      value: when, valueShort: whenShort, of: null,
      desc: ferry.sea
        ? gust
          ? L('p3b_ferry_sea_gust', { vessel: ferry.vessel, route: ferry.route, wave, gust, risk: ferry.sea.risk })
          : L('p3b_ferry_sea', { vessel: ferry.vessel, route: ferry.route, wave, risk: ferry.sea.risk })
        : L('p3b_ferry_nosea', { vessel: ferry.vessel, route: ferry.route }),
      descShort: ferry.sea ? L('p3b_ferry_sea_short', { wave, risk: ferry.sea.risk }) : L('p3b_ferry_nosea_short'),
      tone: 'default',
    };
  };

  const loads7Tile = (scx: boolean): CockpitTile => ({
    id: 'loads7', label: L('p3b_loads7'), labelShort: L('p3b_loads7_short'), go: 'sched',
    value: String(f.loads7.length), of: null,
    desc: scx
      ? L('p3b_scx_loads7_desc', { ok: String(f.permitsOk7), n: String(f.loads7.length), late: String(f.lateLoads.length) })
      : f.lateLoads.length ? L('p3b_late_loads', { n: String(f.lateLoads.length) }) : L('p3b_no_late'),
    descShort: scx
      ? L('p3b_scx_loads7_short', { ok: String(f.permitsOk7), n: String(f.loads7.length) })
      : f.lateLoads.length ? L('p3b_late_loads_short', { n: String(f.lateLoads.length) }) : L('p3b_no_late_short'),
    tone: 'default',
  });

  if (role === 'KSH') {
    const qty = f.done.reduce((a, l) => a + (l.qty || 0), 0);
    const tons = f.done.reduce((a, l) => a + (l.dims?.weightT || 0), 0);
    const wait = bills.filter((b) => b.recipient === 'KSH' && b.verification === 'DO_WERYFIKACJI').length;
    const roadN = f.plan72.filter((l) => !notDeparted(l)).length;
    const waitN = f.plan72.length - roadN;
    return [
      { id: 'delivered', label: L('p3b_delivered'), labelShort: L('p3b_delivered'), go: 'sched',
        value: String(f.done.length), of: L('p3b_of', { n: String(loads.length) }),
        desc: L('p3b_delivered_ksh_long', { qty, t: formatPlNumber(tons, 1) }) + (f.done.length ? ` (${codes(f.done)})` : ''),
        descShort: L('p3b_delivered_ksh', { qty: String(qty), t: formatPlNumber(tons, 1) }), tone: 'default' },
      inTransit,
      { id: 'plan72', label: L('p3b_plan72'), labelShort: L('p3b_plan72_short'), go: 'sched',
        value: String(f.plan72.length), of: null,
        desc: L('p3b_plan72_desc', { a: roadN, b: waitN }),
        descShort: L('p3b_plan72_short_desc', { b: waitN }), tone: 'default' },
      otif(),
      ferryTile(false),
      { id: 'bills', label: L('p3b_bills_check'), labelShort: L('p3b_bills_short'), go: 'inv',
        value: String(wait), of: null,
        desc: wait ? L('p3b_bills_wait') : bills.some((b) => b.recipient === 'KSH') ? L('p3b_bills_none') : L('p3b_bills_empty'),
        descShort: L('p3b_bills_wait_short'),
        tone: wait ? 'warn' : 'default' },
    ];
  }

  if (role === 'SCX') {
    /* „tydz. 41” = tydzień dostawy transportów czekających na fakturę (E9: „w tygodniu dostawy”); bez nich — bieżący */
    const weekOf = (l: Load) => isoWeekNumber(`${dayKey(l.unloadedAt) ?? f.today}T12:00:00Z`);
    const weeks = [...new Set(f.toInvoice.map(weekOf))].sort((a, b) => a - b);
    const w = weeks.length === 0 ? String(isoWeekNumber(input.nowIso)) : weeks.length === 1 ? String(weeks[0]) : `${weeks[0]}–${weeks[weeks.length - 1]}`;
    return [
      { id: 'todo', label: L('p3b_todo'), labelShort: L('p3b_todo'), go: 'risk',
        value: String(todo.total), of: null, desc: L('p3b_scx_todo_desc'), descShort: L('p3b_scx_todo_short'),
        tone: todo.total ? 'alert' : 'default' },
      inTransit,
      loads7Tile(true),
      { id: 'to-invoice', label: L('p3b_to_invoice'), labelShort: L('p3b_to_invoice'), go: 'inv',
        value: String(f.toInvoice.length - f.toInvoiceNoCmr.length), of: null,
        desc: f.toInvoice.length === 0 ? L('p3b_to_invoice_none', { w })
          : f.toInvoiceNoCmr.length
            ? L('p3b_to_invoice_desc', { n: f.toInvoiceNoCmr.length, codes: codes(f.toInvoiceNoCmr), w })
            : L('p3b_to_invoice_ok', { w }),
        descShort: f.toInvoice.length === 0 ? L('p3b_to_invoice_none_short')
          : f.toInvoiceNoCmr.length ? L('p3b_to_invoice_short', { n: f.toInvoiceNoCmr.length }) : L('p3b_cmr_ok_short'),
        tone: 'default' },
      ferryTile(true),
      otif(),
    ];
  }

  /* HHL (Administrator i Operacje — te same kafelki, E9) */
  return [
    inTransit,
    { id: 'todo', label: L('p3b_todo'), labelShort: L('p3b_todo'), go: 'risk',
      value: String(todo.total), of: null,
      desc: todo.total === 0 ? L('p3b_todo_empty')
        : todo.other ? `${L('p3b_todo_loads', { n: todo.loads })} · ${L('p3b_todo_other', { n: todo.other })}` : L('p3b_todo_loads', { n: todo.loads }),
      descShort: todo.total === 0 ? L('p3b_todo_empty')
        : todo.other ? `${L('p3b_todo_loads', { n: todo.loads })} · ${L('p3b_todo_other_short', { n: todo.other })}` : L('p3b_todo_loads', { n: todo.loads }),
      tone: todo.total ? 'alert' : 'default' },
    loads7Tile(false),
    { id: 'permits7', label: L('p3b_permits7'), labelShort: L('p3b_permits7_short'), go: 'docs',
      value: String(f.permitsOk7), of: L('p3b_of', { n: String(f.loads7.length) }),
      desc: L('p3b_permits_desc'), descShort: L('p3b_permits_short'),
      tone: f.permitsOk7 < f.loads7.length ? 'warn' : 'default' },
    { id: 'delivered', label: L('p3b_delivered_settle'), labelShort: L('p3b_delivered'), go: 'inv',
      value: String(f.done.length), of: null,
      desc: f.done.length === 0 ? L('p3b_none_delivered')
        : `${f.doneNoCmr.length ? L(f.doneNoCmr.length === 1 ? 'p3b_cmr_wait_one' : 'p3b_cmr_wait_many', { codes: codes(f.doneNoCmr) }) : L('p3b_cmr_ok')} · ${L('p3b_ready_inv', { n: f.readyToInvoice.length })}`,
      descShort: f.done.length === 0 ? L('p3b_none_delivered_short') : f.doneNoCmr.length ? L('p3b_cmr_wait_short') : L('p3b_cmr_ok_short'),
      tone: 'default' },
    { id: 'margin', label: L('p3b_margin', { tier: margin.tierText }), labelShort: L('p3b_margin_short'), go: 'fin',
      value: margin.pct == null ? '—' : formatPlNumber(margin.pct * 100, 1), of: margin.pct == null ? null : '%',
      desc: L('p3b_margin_desc', { money: margin.moneyText }), descShort: margin.tierText, tone: 'default', money: true },
  ];
}
