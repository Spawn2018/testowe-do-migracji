/**
 * DP-224 D (#817): pomijaj wdrożenie frontu, gdy push zmienia tylko supabase/docs/tests.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function pythonBin(): string {
  for (const bin of ['python3', 'python']) {
    try {
      execFileSync(bin, ['-c', 'import sys'], { stdio: 'ignore' })
      return bin
    } catch {
      /* następny */
    }
  }
  throw new Error('Brak interpretera Pythona (python3 albo python).')
}

const PY = pythonBin()

function run(pliki: string[]): { out: string; code: number } {
  try {
    const out = execFileSync(PY, ['scripts/ci/skip-frontend-deploy.py'], {
      input: pliki.join('\n'),
      encoding: 'utf8',
    }).trim()
    return { out, code: 0 }
  } catch (e) {
    const err = e as { status?: number; stdout?: string }
    return { out: String(err.stdout ?? '').trim(), code: err.status ?? 1 }
  }
}

describe('skip-frontend-deploy.py — DP-224 D', () => {
  it('same supabase/docs/tests → skip (exit 0)', () => {
    expect(run(['supabase/migrations/0415_x.sql', 'docs/handover/PLAN.md', 'tests/foo.test.ts'])).toEqual({
      out: 'skip',
      code: 0,
    })
    expect(run(['docs/handover/POSTEP.md'])).toEqual({ out: 'skip', code: 0 })
  })

  it('jakikolwiek plik frontu / CI / package → build (exit 1)', () => {
    expect(run(['docs/handover/PLAN.md', 'src/App.tsx'])).toEqual({ out: 'build', code: 1 })
    expect(run(['vercel.json'])).toEqual({ out: 'build', code: 1 })
    expect(run(['.github/workflows/deploy-main.yml'])).toEqual({ out: 'build', code: 1 })
    expect(run(['package.json'])).toEqual({ out: 'build', code: 1 })
    expect(run(['api/tiles.js'])).toEqual({ out: 'build', code: 1 })
  })

  it('pusta lista → build (bezpiecznie)', () => {
    expect(run([])).toEqual({ out: 'build', code: 1 })
    expect(run(['', '  '])).toEqual({ out: 'build', code: 1 })
  })

  it('vercel.json ma ignoreCommand na skrypt; deploy-main pomija Produkcja/LH przy skip', () => {
    const v = JSON.parse(readFileSync('vercel.json', 'utf8')) as { ignoreCommand?: string }
    expect(v.ignoreCommand).toMatch(/skip-frontend-deploy\.py/)
    const yml = readFileSync('.github/workflows/deploy-main.yml', 'utf8')
    expect(yml).toMatch(/Czy wdrażać front/)
    expect(yml).toMatch(/steps\.front\.outputs\.skip != 'true'/)
    expect(yml).toMatch(/skip-frontend-deploy\.py/)
  })
})
