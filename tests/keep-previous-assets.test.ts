import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { keepPreviousAssets } from '../scripts/ci/keep-previous-assets.mjs'

// DP-224 B1 (#817): stare /assets/ z produkcji trafiają do nowego dist (Vite ≠ Skew Protection).

describe('DP-224 B1 keep-previous-assets', () => {
  it('dopisuje brakujące pliki z produkcji i zapisuje _tower_kept.json', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'wt-keep-'))
    const assets = join(dist, 'assets')
    mkdirSync(assets, { recursive: true })
    writeFileSync(join(assets, 'index-NEW.js'), 'export const neu=1')

    const store: Record<string, string> = {
      'https://prod.example/':
        '<html><script type="module" src="/assets/index-OLD.js"></script></html>',
      'https://prod.example/assets/index-OLD.js':
        'import("./chunk-OLD.js");export const alt=1',
      'https://prod.example/assets/chunk-OLD.js': 'export const chunk=1',
      'https://prod.example/assets/_tower_kept.json': JSON.stringify({
        generations: [{ builtAt: '2026-11-01T00:00:00.000Z', files: ['legacy-A.js'] }],
      }),
      'https://prod.example/assets/legacy-A.js': 'export const legacy=1',
    }

    const result = await keepPreviousAssets(dist, 'https://prod.example', {
      fetchText: async (url) => {
        if (!(url in store)) throw new Error(`${url} → HTTP 404`)
        return store[url]
      },
      fetchBytes: async (url) => {
        if (!(url in store)) throw new Error(`${url} → HTTP 404`)
        return Buffer.from(store[url])
      },
      now: () => '2026-11-05T20:00:00.000Z',
    })

    expect(result.skipped).toBe(false)
    expect(result.kept).toBeGreaterThanOrEqual(3)
    expect(readFileSync(join(assets, 'index-OLD.js'), 'utf8')).toContain('alt=1')
    expect(readFileSync(join(assets, 'chunk-OLD.js'), 'utf8')).toContain('chunk=1')
    expect(readFileSync(join(assets, 'legacy-A.js'), 'utf8')).toContain('legacy=1')
    // nowy plik nie nadpisany
    expect(readFileSync(join(assets, 'index-NEW.js'), 'utf8')).toContain('neu=1')

    const man = JSON.parse(readFileSync(join(assets, '_tower_kept.json'), 'utf8')) as {
      generations: { builtAt: string; files: string[] }[]
    }
    expect(man.generations[0].builtAt).toBe('2026-11-05T20:00:00.000Z')
    expect(man.generations[0].files).toEqual(
      expect.arrayContaining(['index-NEW.js', 'index-OLD.js', 'chunk-OLD.js', 'legacy-A.js']),
    )
    expect(man.generations.length).toBeGreaterThanOrEqual(2)

    rmSync(dist, { recursive: true, force: true })
  })

  it('package.json build woła skrypt po vite build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: { build: string } }
    expect(pkg.scripts.build).toMatch(/keep-previous-assets\.mjs dist/)
  })
})
