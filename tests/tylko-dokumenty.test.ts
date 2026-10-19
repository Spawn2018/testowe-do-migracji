/**
 * Krok 1 przyspieszenia testów (właściciel 19.10.2026, 17:03): workflow visual pomija części testów
 * tylko wtedy, gdy PR zmienia wyłącznie dokumenty. Każdy inny przypadek → pełne testy.
 */
import { execFileSync } from 'node:child_process'
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
const kod = (pliki: string[]): string =>
  execFileSync(PY, ['scripts/ci/tylko-dokumenty.py'], { input: pliki.join('\n'), encoding: 'utf8' }).trim()

describe('tylko-dokumenty.py — kiedy wolno pominąć testy wizualne', () => {
  it('same dokumenty → pominięcie (false)', () => {
    expect(kod(['docs/handover/PLAN.md', 'docs/handover/POSTEP.md', 'docs/handover/dopiski/D-1.md'])).toBe('false')
    expect(kod(['docs/handover/odbior/X/zrzut.png', 'README.md', 'AGENTS.md'])).toBe('false')
  })
  it('jakikolwiek plik kodu, testu, bazy lub CI → pełne testy (true)', () => {
    expect(kod(['docs/handover/PLAN.md', 'src/App.tsx'])).toBe('true')
    expect(kod(['tests/opis.md'])).toBe('true')
    expect(kod(['public/logos/README.md'])).toBe('true')
    expect(kod(['supabase/migrations/0234_x.sql'])).toBe('true')
    expect(kod(['.github/workflows/visual.yml'])).toBe('true')
    expect(kod(['package.json'])).toBe('true')
  })
  it('pusta lista → pełne testy (true)', () => {
    expect(kod([])).toBe('true')
    expect(kod(['', '  '])).toBe('true')
  })
})
