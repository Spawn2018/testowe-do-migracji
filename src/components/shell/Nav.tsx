import { useEffect, useState } from 'react'
import { useTowerStore } from '../../store/useTowerStore'
import { navForRole, type NavKey } from '../../lib/permissions'
import { invoiceTodoCount, todoQueue } from '../../lib/cockpitE9'
import { navLabel, t } from '../../i18n/messages'
import { ClaudeIcon, type IconKey } from './ClaudeIcon'
/* wyglad/P3 (E37 pkt 1): e-mail, rodzaj konta i „Wyloguj” przeszły do menu konta w pasku górnym (AccountMenu). */

/** Claude v2.0 SVG icons 1:1 */
const ICON: Record<NavKey, IconKey> = {
  dash: 'dash',
  map: 'map',
  sched: 'sched',
  risk: 'risk',
  docs: 'docs',
  fin: 'fin',
  inv: 'inv',
  tasks: 'tasks',
  wf: 'wf',
  geo: 'geo',
  options: 'options',
  settings: 'options',
}

const COMMON: NavKey[] = ['dash', 'map', 'sched', 'risk', 'docs']
const MONEY: NavKey[] = ['fin', 'inv']
const ADMIN: NavKey[] = ['wf', 'geo', 'options', 'settings']
const TASKS: NavKey[] = ['tasks']
/** E8 (P2): dolny pasek telefonu. */
const PHONE_PINS: NavKey[] = ['dash', 'sched', 'risk', 'docs']

type NavRow = { kind: 'item'; key: NavKey } | { kind: 'sep' }

function rowsForRole(roleKeys: NavKey[]): NavRow[] {
  const set = new Set(roleKeys)
  const common = COMMON.filter((k) => set.has(k))
  const tasks = TASKS.filter((k) => set.has(k))
  const money = MONEY.filter((k) => set.has(k))
  const admin = ADMIN.filter((k) => set.has(k))
  const rows: NavRow[] = [
    ...common.map((key) => ({ kind: 'item' as const, key })),
    ...tasks.map((key) => ({ kind: 'item' as const, key })),
  ]
  if (money.length) {
    rows.push({ kind: 'sep' })
    rows.push(...money.map((key) => ({ kind: 'item' as const, key })))
  }
  if (admin.length) {
    rows.push({ kind: 'sep' })
    rows.push(...admin.map((key) => ({ kind: 'item' as const, key })))
  }
  return rows
}

export function Nav() {
  const role = useTowerStore((s) => s.role)
  const view = useTowerStore((s) => s.view)
  const setView = useTowerStore((s) => s.setView)
  const locale = useTowerStore((s) => s.locale)
  const risks = useTowerStore((s) => s.risks)
  const invoices = useTowerStore((s) => s.invoices)
  const bills = useTowerStore((s) => s.bills)
  const loads = useTowerStore((s) => s.loads)
  const documents = useTowerStore((s) => s.documents)
  const navCollapsed = useTowerStore((s) => s.navCollapsed)
  const setNavCollapsed = useTowerStore((s) => s.setNavCollapsed)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)')
    const phone = window.matchMedia('(max-width: 768px)')
    const apply = () => {
      if (phone.matches || mq.matches) {
        setNavCollapsed(true, { persist: false })
        return
      }
      try {
        if (sessionStorage.getItem('wtNavCollapsed') === '1') return
      } catch {
        /* ignore */
      }
      setNavCollapsed(false, { persist: false })
    }
    apply()
    mq.addEventListener('change', apply)
    phone.addEventListener('change', apply)
    return () => {
      mq.removeEventListener('change', apply)
      phone.removeEventListener('change', apply)
    }
  }, [setNavCollapsed])

  const go = (key: NavKey) => {
    setView(key)
    setMoreOpen(false)
    if (window.matchMedia('(max-width: 768px)').matches) {
      setNavCollapsed(true, { persist: false })
    }
  }
  const items = navForRole(role)
  const rows = rowsForRole(items)

  /* wyglad/P3-b (E9 „Liczby w menu”): liczba stoi tylko przy działaniu do wykonania.
     Ryzyka = „Do zrobienia” konta (ta sama co na kafelku Kokpitu; KSH bez listy — bez liczby).
     Faktury = faktury czekające na moje działanie + transporty gotowe do mojej faktury; 0 = bez liczby.
     Bez liczb przy Harmonogramie, Strefach i Automatyzacjach. */
  const badge = (key: NavKey): { n: number; hot?: boolean } | null => {
    if (key === 'risk') {
      const q = todoQueue(role, risks, loads)
      return q && q.total ? { n: q.total, hot: true } : null
    }
    if (key === 'inv') {
      const n = invoiceTodoCount(role, { loads, documents, bills, invoices })
      return n ? { n } : null
    }
    return null
  }

  return (
    <nav className={`tower-nav${moreOpen ? ' nav-more-open' : ''}`} aria-label={t(locale, 'a6_nav_menu')} aria-expanded={!navCollapsed}>
      {rows.map((row, i) => {
        if (row.kind === 'sep') {
          return navCollapsed ? null : <div key={`sep-${i}`} className="sep" />
        }
        const key = row.key
        const current = view === key
        const b = badge(key)
        const label = navLabel(locale, key, role)
        return (
          <button
            key={key}
            type="button"
            data-view={key}
            className={PHONE_PINS.includes(key) ? 'nav-pin' : undefined}
            aria-current={current ? 'page' : 'false'}
            aria-label={label}
            title={navCollapsed ? label : undefined}
            onClick={() => go(key)}
          >
            <span className="glyph"><ClaudeIcon name={ICON[key]} /></span>
            <span className="lbl">{label}</span>
            {b ? <span className={`count${b.hot ? ' hot' : ''}`}>{b.n}</span> : null}
          </button>
        )
      })}
      <div style={{ flex: 1 }} />
      <button
        type="button"
        className="nav-more-btn"
        aria-expanded={moreOpen}
        aria-label={t(locale, 'nav_more')}
        onClick={() => setMoreOpen((v) => !v)}
      >
        <span className="glyph">⋯</span>
        <span className="lbl">{t(locale, 'nav_more')}</span>
      </button>
      <button
        type="button"
        className="iconbtn"
        style={{ margin: '0 auto 8px' }}
        onClick={() => setNavCollapsed(!navCollapsed)}
        aria-expanded={!navCollapsed}
        title={navCollapsed ? t(locale, 'a6_nav_expand') : t(locale, 'a6_nav_collapse')}
      >
        {navCollapsed ? '»' : '«'}
      </button>
    </nav>
  )
}
