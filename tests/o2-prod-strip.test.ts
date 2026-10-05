import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROD_STRIPPED, stripDownloadHeaders } from '../build/prodStrip'

// O2: makieta (tower-makieta.html, /download/…) i dane demo nie mogą trafić do builda produkcyjnego —
// na hostingu statycznym dałyby się pobrać bez logowania. W trybie demo zostają.
function build(mode: 'supabase' | 'demo'): string {
  const out = mkdtempSync(join(tmpdir(), `o2-dist-${mode}-`))
  const env: NodeJS.ProcessEnv = { ...process.env, VITE_AUTH_MODE: mode, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'test' }
  for (const k of ['VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF', 'CF_PAGES', 'CF_PAGES_BRANCH']) delete env[k]
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { env, stdio: 'pipe' })
  return out
}

describe('O2: build produkcyjny bez makiety', () => {
  it('VITE_AUTH_MODE=supabase → brak tower-makieta.html i /download w dist, 404.html jest', () => {
    const out = build('supabase')
    try {
      expect(existsSync(join(out, 'index.html'))).toBe(true)
      expect(existsSync(join(out, 'download', 'tower-makieta.html'))).toBe(false)
      expect(existsSync(join(out, 'download'))).toBe(false)
      expect(existsSync(join(out, 'tower-makieta.html'))).toBe(false)
      for (const p of PROD_STRIPPED) expect(existsSync(join(out, p)), p).toBe(false)
      // I-0: _headers bez załącznika, z Cache-Control: no-store dla dawnych ścieżek makiety
      const headers = readFileSync(join(out, '_headers'), 'utf8')
      expect(headers).not.toMatch(/Content-Disposition|attachment/)
      for (const p of ['/tower-makieta', '/download/*', '/claude-*', '/KSH_HARMONOGRAM.xlsx']) expect(headers).toContain(`${p}\n  Cache-Control: no-store`)
      const html404 = readFileSync(join(out, '404.html'), 'utf8')
      expect(html404).toMatch(/nie znaleziono/)
      expect(html404).toMatch(/Watch Tower/)
      expect(html404).not.toMatch(/\bTOWER\b/)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }, 120_000)

  it('tryb demo → makieta zostaje (/download/tower-makieta.html)', () => {
    const out = build('demo')
    try {
      expect(existsSync(join(out, 'download', 'tower-makieta.html'))).toBe(true)
      expect(existsSync(join(out, '404.html'))).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }, 120_000)

  it('stripDownloadHeaders usuwa tylko blok /download/*', () => {
    const src = '/download/*\n  Content-Disposition: attachment; filename="tower-makieta.html"\n  Content-Type: text/html\n/assets/*\n  Cache-Control: max-age=1\n'
    expect(stripDownloadHeaders(src)).toBe('/assets/*\n  Cache-Control: max-age=1')
    const left = stripDownloadHeaders(readFileSync('public/_headers', 'utf8'))
    expect(left).not.toMatch(/Content-Disposition|attachment|\/download/)
    expect(left).toMatch(/X-Frame-Options:\s*DENY/)
  })
})
