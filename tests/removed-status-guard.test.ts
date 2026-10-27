import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// #590 F7 (BLOKER 1): status REMOVED = „usunięty z harmonogramu”. Każde zapytanie o transporty,
// które wyklucza CANCELLED po stronie klienta albo funkcji brzegowych, musi wykluczać też REMOVED.
// (Odpowiednik strażnika bazy w tests/db/import.sh: funkcje, widoki i polityki.)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (n === 'node_modules') return []
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const FILES = [...walk('src'), ...walk('supabase/functions')].filter(
  (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f),
)

// Filtr po kolumnie status: .neq('status', …) albo .not('status', …) z CANCELLED, ale bez REMOVED w tej samej linii.
const STATUS_FILTER = /\.(neq|not)\(\s*['"]status['"]/

describe('#590: filtry statusu transportów znają REMOVED', () => {
  it('żadne .neq/.not("status", …CANCELLED…) nie pomija REMOVED', () => {
    const bad: string[] = []
    for (const f of FILES) {
      readFileSync(f, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (STATUS_FILTER.test(line) && line.includes('CANCELLED') && !line.includes('REMOVED')) {
            bad.push(`${f}:${i + 1}: ${line.trim()}`)
          }
        })
    }
    expect(bad).toEqual([])
  })

  it('zapytanie o transporty w supabaseProvider wyklucza REMOVED dla każdej roli', () => {
    const src = readFileSync('src/data/supabaseProvider.ts', 'utf8')
    expect(src).toMatch(/neq\('status', 'REMOVED'\)/)
    expect(src).toMatch(/not\('status', 'in', '\(CANCELLED,REMOVED\)'\)/)
  })

  it('LoadStatus i mapper znają REMOVED', () => {
    expect(readFileSync('src/types/index.ts', 'utf8')).toContain("'REMOVED'")
    expect(readFileSync('src/data/mappers.ts', 'utf8')).toContain("REMOVED: 'REMOVED'")
  })
})
