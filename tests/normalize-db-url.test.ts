/**
 * F7 #326 P1: hasło w SUPABASE_DB_URL kodowane procentowo (CLI 2.121, net/url).
 * Adresu z sekretu tu nie ma — tylko zmyślone przykłady.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

function run(raw: string): { log: string; url: string; port: string } {
  const dir = mkdtempSync(join(tmpdir(), 'db-url-'))
  const urlPath = join(dir, 'url')
  const portPath = join(dir, 'port')
  try {
    const log = execFileSync(PY, ['scripts/ci/normalize-db-url.py'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_DB_URL: raw,
        DB_URL_FILE: urlPath,
        DB_PORT_FILE: portPath,
      },
    })
    return {
      log,
      url: readFileSync(urlPath, 'utf8'),
      port: readFileSync(portPath, 'utf8'),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('normalize-db-url (F7 #326 P1)', () => {
  it('koduje hasło ze znakami specjalnymi', () => {
    const out = run('postgresql://uzytkownik:a@b#c/d@db.example:5432/postgres')
    expect(out.url).toBe('postgresql://uzytkownik:a%40b%23c%2Fd@db.example:5432/postgres')
    expect(out.port).toBe('5432')
    expect(out.log).toContain('haslo zakodowane: tak')
    expect(out.log).not.toContain('a@b#c/d')
    expect(out.log).not.toContain('a%40b%23c%2Fd')
  })

  it('zostawia hasło już zakodowane', () => {
    const raw = 'postgresql://uzytkownik:ab%40cd@db.example:5432/postgres'
    const out = run(raw)
    expect(out.url).toBe(raw)
    expect(out.log).toContain('haslo zakodowane: nie')
  })

  it('zdejmuje BOM i cudzysłów, potem koduje hasło', () => {
    const out = run('\uFEFF"postgresql://uzytkownik:a@b#c/d@db.example:5432/postgres"')
    expect(out.url).toBe('postgresql://uzytkownik:a%40b%23c%2Fd@db.example:5432/postgres')
    expect(out.log).toContain('haslo zakodowane: tak')
    expect(out.log).toContain('port 5432')
  })
})
