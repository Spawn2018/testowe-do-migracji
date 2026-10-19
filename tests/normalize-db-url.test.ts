/**
 * F7 #326 P1: hasło w SUPABASE_DB_URL kodowane procentowo (CLI 2.121, net/url).
 * Adresu z sekretu tu nie ma — tylko zmyślone przykłady.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

function run(raw: string): {
  log: string
  url: string
  port: string
  password: string
  mode: string
  passwordMode: number
} {
  const dir = mkdtempSync(join(tmpdir(), 'db-url-'))
  const urlPath = join(dir, 'url')
  const portPath = join(dir, 'port')
  const passwordPath = join(dir, 'password')
  const modePath = join(dir, 'mode')
  try {
    const log = execFileSync(PY, ['scripts/ci/normalize-db-url.py'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_DB_URL: raw,
        DB_URL_FILE: urlPath,
        DB_PORT_FILE: portPath,
        DB_PASSWORD_FILE: passwordPath,
        DB_MODE_FILE: modePath,
      },
    })
    return {
      log,
      url: readFileSync(urlPath, 'utf8'),
      port: readFileSync(portPath, 'utf8'),
      password: readFileSync(passwordPath, 'utf8'),
      mode: readFileSync(modePath, 'utf8'),
      passwordMode: statSync(passwordPath).mode & 0o777,
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

  it('zapisuje hasło a@b#c/d zdekodowane i nie wypisuje go (#331)', () => {
    const out = run('postgresql://uzytkownik:a%40b%23c%2Fd@db.example:5432/postgres')
    expect(out.password).toBe('a@b#c/d')
    expect(out.mode).toBe('link')
    expect(out.log).toContain('polaczenie: link')
    expect(out.log).not.toContain('a@b#c/d')
    expect(out.log).not.toContain('a%40b%23c%2Fd')
    expect(out.log).not.toContain('db.example')
    if (process.platform !== 'win32') {
      expect(out.passwordMode).toBe(0o600)
    }
  })

  it('redact podmienia adres i hasło, sekret nie wychodzi (#331)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'redact-'))
    const urlPath = join(dir, 'url')
    const passwordPath = join(dir, 'password')
    const url = 'postgresql://uzytkownik:a%40b%23c%2Fd@db.example:5432/postgres'
    const password = 'a@b#c/d'
    writeFileSync(urlPath, url)
    writeFileSync(passwordPath, password)
    try {
      const log = execFileSync(PY, ['scripts/ci/redact.py'], {
        encoding: 'utf8',
        input: `link ${url} haslo ${password}\n`,
        env: {
          ...process.env,
          DB_URL_FILE: urlPath,
          DB_PASSWORD_FILE: passwordPath,
        },
      })
      expect(log.replace(/\r\n/g, '\n')).toBe('link [adres] haslo [haslo]\n')
      expect(log).not.toContain(password)
      expect(log).not.toContain(url)
      expect(log).not.toContain('db.example')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('adres puli zostawia tryb pooler, bez hosta w logu', () => {
    const out = run(
      'postgresql://uzytkownik:sekretpula@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    )
    expect(out.mode).toBe('pooler')
    expect(out.password).toBe('sekretpula')
    expect(out.log).toContain('polaczenie: pooler')
    expect(out.log).not.toContain('sekretpula')
    expect(out.log).not.toContain('pooler.supabase.com')
  })
})
