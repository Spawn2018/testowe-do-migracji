/**
 * Strażnik B-1: znaczniki danych przykładowych czytane z seeda (nie z listy wpisanej ręcznie).
 * Build produkcyjny (VITE_AUTH_MODE=supabase) nie może ich zawierać.
 * Nazwy promów (ferry-sailings.json) i miejscowości korytarza (Gävle) to dane prawdziwe — nie są znacznikami.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const CODE = /^[A-Z]{1,3}-\d{2,}$/
/** Miejscowości korytarza — prawdziwe, nie znacznik przykładowy. */
const REAL_PLACES = ['gävle', 'gavle']

export type SeedMarkers = {
  codes: string[]
  phrases: string[]
  amounts: string[]
  all: string[]
}

function realNames(root: string): Set<string> {
  const ferries = JSON.parse(readFileSync(join(root, 'src/data/ferry-sailings.json'), 'utf8')) as {
    vessels: { name: string; short: string }[]
  }
  const names = new Set<string>(REAL_PLACES)
  for (const v of ferries.vessels) {
    names.add(v.short.toLowerCase())
    names.add(v.name.toLowerCase())
    for (const part of v.name.split(/\s+/)) names.add(part.toLowerCase())
  }
  return names
}

/** Kody, fraza „Permit mismatch” i kwoty — wyciągnięte z src/data/seed.ts i z loads.json, który seed wczytuje. */
export function loadSeedMarkers(root = process.cwd()): SeedMarkers {
  const seed = readFileSync(join(root, 'src/data/seed.ts'), 'utf8')
  const loads = JSON.parse(readFileSync(join(root, 'src/data/loads.json'), 'utf8')) as { code?: string }[]
  const skip = realNames(root)
  const keep = (s: string) => !skip.has(s.toLowerCase())

  const codes = new Set<string>()
  for (const row of loads) if (row.code && CODE.test(row.code)) codes.add(row.code)
  // Tylko pola kodu transportu. Identyfikatory zadań (I-27) z komentarzy nie są znacznikiem.
  for (const m of seed.matchAll(/(?:code|loadCode):\s*'([^']+)'/g)) if (CODE.test(m[1])) codes.add(m[1])

  const phrases = new Set<string>()
  if (seed.includes('Permit mismatch')) phrases.add('Permit mismatch')

  const amounts = new Set<string>()
  for (const m of seed.matchAll(/\d{1,3}(?: \d{3})+(?:,\d+)? PLN/g)) amounts.add(m[0])
  for (const m of seed.matchAll(/baseRate:\s*(\d+\.\d+)/g)) amounts.add(m[1])

  const codesA = [...codes].filter(keep).sort()
  const phrasesA = [...phrases].filter(keep).sort()
  const amountsA = [...amounts].filter(keep).sort()
  return { codes: codesA, phrases: phrasesA, amounts: amountsA, all: [...codesA, ...phrasesA, ...amountsA] }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

/** Trafienia „plik: znacznik ×n” w JS/HTML/CSS/JSON paczki. */
export function findSeedMarkerHits(outDir: string, markers: SeedMarkers = loadSeedMarkers()): string[] {
  const hits: string[] = []
  const files = walk(outDir).filter((p) => /\.(js|html|css|json)$/.test(p))
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    const rel = relative(outDir, f)
    for (const c of markers.codes) {
      const n = s.match(new RegExp(`(?<![A-Za-z0-9-])${c.replace(/-/g, '\\-')}(?![A-Za-z0-9])`, 'g'))?.length ?? 0
      if (n) hits.push(`${rel}: ${c} ×${n}`)
    }
    for (const lit of [...markers.phrases, ...markers.amounts]) {
      const n = s.split(lit).length - 1
      if (n) hits.push(`${rel}: „${lit}” ×${n}`)
    }
  }
  return hits
}

/** Rzuca, gdy paczka produkcyjna zawiera znacznik. Próg się nie luzuje. */
export function assertProdBundleHasNoSeedMarkers(outDir: string): void {
  const markers = loadSeedMarkers()
  if (markers.codes.length < 60) {
    throw new Error(`[seed-markers] za mało kodów z seeda (${markers.codes.length}) — ekstrakcja jest zepsuta, nie paczka`)
  }
  const hits = findSeedMarkerHits(outDir, markers)
  if (hits.length) {
    throw new Error(`[seed-markers] paczka produkcyjna zawiera dane przykładowe:\n${hits.slice(0, 30).join('\n')}`)
  }
}
