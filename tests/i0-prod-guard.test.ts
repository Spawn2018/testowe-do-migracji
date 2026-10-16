import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { PROD_DEMO_SWAP } from '../build/prodStrip'
import { findSeedMarkerHits, loadSeedMarkers } from '../build/seedMarkers'

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

  // I-0 (27.09.2026): dane demo wycięte z paczki produkcyjnej — wtyczka Vite `i0-demo-swap` podmienia
  // src/data/seed.ts, src/data/demoProvider.ts, src/i18n/demoOnly.ts na puste *.prod.ts (build/prodStrip.ts).
  it('brak danych demonstracyjnych w JS/HTML dist (identyfikatory transportów demo, „23.09”, „R-03”, numery +48/+46)', () => {
    const hits = findDemoData(out, demoTransportCodes(), ['23.09', 'R-03'])
    for (const f of walk(out).filter((p) => /\.(js|html)$/.test(p))) {
      const phones = new Set(readFileSync(f, 'utf8').match(/\+4[68][ 0-9]{8,12}/g) ?? [])
      if (phones.size) hits.push(`${relative(out, f)}: numery +48/+46 ×${phones.size}`)
    }
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  it('B-1: build produkcyjny nie zawiera dryfu pozycji pojazdu ze statusu', () => {
    const hits = walk(out).filter((f) => f.endsWith('.js') && readFileSync(f, 'utf8').includes('0.00012')).map((f) => relative(out, f))
    expect(hits).toEqual([])
  })

  it('znaczniki danych przykładowych są wyciągane z seeda, bez nazw promów i Gävle', () => {
    const m = loadSeedMarkers()
    expect(m.codes.length).toBeGreaterThanOrEqual(60)
    expect(m.codes).toEqual(expect.arrayContaining(['SG-34', 'SG-14', 'T-17']))
    // audyt-C (C-01, E7 „bez kodów”): tytuł ryzyka SG-34 po polsku — fraza demo z nowego tytułu
    expect(m.phrases).toContain('przekracza wysokość i szerokość')
    expect(m.amounts).toContain('1 840 PLN')
    expect(m.amounts).toContain('3758.54')
    expect(m.all.join('\n')).not.toMatch(/Wawel|Nova Star|Gävle|Gavle/)
  })

  it('build produkcyjny nie zawiera znaczników z seeda (kody, frazy ryzyk demo, kwoty)', () => {
    const hits = findSeedMarkerHits(out)
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  it('moduły *.prod.ts mają te same eksporty co moduły demo (build produkcyjny się nie rozjedzie)', () => {
    const names = (f: string) => new Set([...readFileSync(f, 'utf8').matchAll(/^export (?:const|function|let) (\w+)|^export \{ ([^}]+) \}/gm)]
      .flatMap((m) => (m[1] ? [m[1]] : m[2].split(',').map((x) => x.trim().split(' as ').pop()!.trim()))))
    for (const [demo, prod] of Object.entries(PROD_DEMO_SWAP)) {
      const missing = [...names(demo)].filter((n) => !names(prod).has(n))
      expect(missing, `${prod} brakuje: ${missing.join(', ')}`).toEqual([])
    }
  })
})
