import { useEffect } from 'react'
import { useTowerStore } from '../../store/useTowerStore'
import { navForRole, type NavKey } from '../../lib/permissions'
import { navLabel, t } from '../../i18n/messages'
import { ClaudeIcon, type IconKey } from './ClaudeIcon'

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
  const workflows = useTowerStore((s) => s.workflows)
  const loads = useTowerStore((s) => s.loads)
  const geofences = useTowerStore((s) => s.geofences)
  const navCollapsed = useTowerStore((s) => s.navCollapsed)
  const setNavCollapsed = useTowerStore((s) => s.setNavCollapsed)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)')
    const apply = () => {
      if (mq.matches) {
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
    return () => mq.removeEventListener('change', apply)
  }, [setNavCollapsed])

  const items = navForRole(role)
  const rows = rowsForRole(items)

  const badge = (key: NavKey): { n: number; hot?: boolean } | null => {
    if (key === 'risk') {
      const n = risks.length
      return n ? { n, hot: true } : null
    }
    if (key === 'tasks') {
      const n = loads.filter((l) =>
        ['RESOURCES_PENDING', 'DOC_MISSING', 'READY'].includes(l.status),
      ).length
      return n ? { n, hot: true } : null
    }
    if (key === 'inv') {
      if (role === 'KSH') {
        /* M6 — KSH: faktury HHL do weryfikacji */
        const k = bills.filter((b) => b.recipient === 'KSH' && b.verification === 'DO_WERYFIKACJI').length
        return k ? { n: k } : null
      }
      const n = invoices.filter((i) => i.status === 'DISPUTED' || i.status === 'SUBMITTED').length
      return n ? { n } : { n: 1 }
    }
    if (key === 'wf') {
      const n = workflows.filter((w) => w.enabled).length
      return { n }
    }
    if (key === 'geo') {
      return { n: geofences.length }
    }
    if (key === 'sched') {
      return { n: loads.length }
    }
    return null
  }

  return (
    <nav aria-label={t(locale, 'a6_nav_menu')} aria-expanded={!navCollapsed}>
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
            aria-current={current ? 'page' : 'false'}
            aria-label={label}
            title={navCollapsed ? label : undefined}
            onClick={() => setView(key)}
          >
            <span className="glyph"><ClaudeIcon name={ICON[key]} /></span>
            <span className="lbl">{label}</span>
            {b ? <span className={`count${b.hot ? ' hot' : ''}`}>{b.n}</span> : null}
          </button>
        )
      })}
      <div style={{ flex: 1 }} />
      {!navCollapsed ? <div className="sep" /> : null}
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
