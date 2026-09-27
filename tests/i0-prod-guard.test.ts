import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

// I-0 (strażnik wycieku): paczka produkcyjna (VITE_AUTH_MODE=supabase) nie może zawierać plików klienta
// ani makiet (*.xlsx, *makieta*, claude-*) ani danych demonstracyjnych w JS/HTML.
// Identyfikatory transportów demo czytane z faktycznych plików danych demo (src/data/loads.json, src/data/seed.ts).

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

export function demoTransportCodes(): string[] {
  const loads = JSON.parse(readFileSync('src/data/loads.json', 'utf8')) as { code: string }[]
  const seed = [...readFileSync('src/data/seed.ts', 'utf8').matchAll(/^\s+code: '([^']+)'/gm)].map((m) => m[1])
  return [...new Set([...loads.map((l) => l.code), ...seed])].sort()
}

/** Zwraca listę trafień „plik: token ×n” dla danych demo w plikach tekstowych dist. */
export function findDemoData(out: string, codes: string[], literals: string[]): string[] {
  const hits: string[] = []
  for (const f of walk(out).filter((p) => /\.(js|html|css|json)$/.test(p))) {
    const s = readFileSync(f, 'utf8')
    for (const c of codes) {
      const n = s.match(new RegExp(`(?<![A-Za-z0-9-])${c.replace(/[-]/g, '\\-')}(?![A-Za-z0-9])`, 'g'))?.length ?? 0
      if (n) hits.push(`${relative(out, f)}: ${c} ×${n}`)
    }
    for (const lit of literals) {
      const n = s.split(lit).length - 1
      if (n) hits.push(`${relative(out, f)}: „${lit}” ×${n}`)
    }
  }
  return hits
}

describe('I-0: strażnik paczki produkcyjnej', () => {
  let out = ''
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'i0-dist-'))
    const env: NodeJS.ProcessEnv = { ...process.env, VITE_AUTH_MODE: 'supabase', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'test' }
    for (const k of ['VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF', 'CF_PAGES', 'CF_PAGES_BRANCH']) delete env[k]
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { env, stdio: 'pipe' })
  }, 120_000)
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('dane demo: identyfikatory transportów pochodzą z plików demo (≥ 60)', () => {
    const codes = demoTransportCodes()
    expect(codes.length).toBeGreaterThanOrEqual(60)
    expect(codes).toContain('R-03')
  })

  it('brak plików *.xlsx, *makieta*, claude-* w dist', () => {
    const bad = walk(out).map((p) => relative(out, p)).filter((p) => /\.xlsx$/i.test(p) || /makieta/i.test(p) || /(^|\/)claude-/i.test(p))
    expect(bad).toEqual([])
  })

  // I-2 (ZERO FASADY): dziś paczka produkcyjna zawiera cały zestaw danych demo (src/data/loads.json + seed.ts:
  // 72 identyfikatory transportów, baner „R-03”, oś „23.09”) — DemoProvider/seed są wciągane statycznie.
  // Oczekiwany czerwony wynik; `it.fails`, żeby nie blokować pre-push. Po naprawie w I-2 zmienić na `it`.
  it.fails('brak danych demonstracyjnych w JS/HTML dist (identyfikatory transportów demo, „23.09”, „R-03”) — do naprawy w I-2', () => {
    const hits = findDemoData(out, demoTransportCodes(), ['23.09', 'R-03'])
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })
})
