import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  contentTypeAcceptable,
  keepPreviousAssets,
} from '../scripts/ci/keep-previous-assets.mjs'

// DP-224 B1 (#817 / F7 #825): stare /assets/ z produkcji → dist; retencja bez dziedziczenia.

type Store = Record<string, { body: string; contentType: string }>

function mockFetch(store: Store) {
  return {
    fetchText: async (url: string, name?: string) => {
      // index.html produkcji: text/html dozwolone (nie asset)
      if (url.endsWith('/') || name === 'index.html') {
        const e = store[url]
        if (!e) throw new Error(`${url} → HTTP 404`)
        return e.body
      }
      if (name === '_tower_kept.json' || url.includes('_tower_kept.json')) {
        const e = store[url]
        if (!e) throw new Error(`${url} → HTTP 404`)
        return e.body
      }
      const e = store[url]
      if (!e) throw new Error(`${url} → HTTP 404`)
      const assetName = name || url.split('/').pop() || ''
      if (!contentTypeAcceptable(assetName, e.contentType)) {
        throw new Error(`${url} → zły content-type: ${e.contentType}`)
      }
      return e.body
    },
    fetchBytes: async (url: string, name?: string) => {
      const e = store[url]
      if (!e) throw new Error(`${url} → HTTP 404`)
      const assetName = name || url.split('/').pop() || ''
      if (!contentTypeAcceptable(assetName, e.contentType)) {
        throw new Error(`${url} → zły content-type: ${e.contentType}`)
      }
      return Buffer.from(e.body)
    },
  }
}

describe('DP-224 B1 keep-previous-assets', () => {
  it('dopisuje brakujące pliki z produkcji; generacja = tylko pliki buildu', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'wt-keep-'))
    const assets = join(dist, 'assets')
    mkdirSync(assets, { recursive: true })
    writeFileSync(join(assets, 'index-NEW.js'), 'export const neu=1')

    const store: Store = {
      'https://prod.example/': {
        body: '<html><script type="module" src="/assets/index-OLD.js"></script></html>',
        contentType: 'text/html',
      },
      'https://prod.example/assets/index-OLD.js': {
        body: 'import("./chunk-OLD.js");export const alt=1',
        contentType: 'application/javascript',
      },
      'https://prod.example/assets/chunk-OLD.js': {
        body: 'export const chunk=1',
        contentType: 'application/javascript',
      },
      'https://prod.example/assets/_tower_kept.json': {
        body: JSON.stringify({
          generations: [{ builtAt: '2026-11-01T00:00:00.000Z', files: ['legacy-A.js'] }],
        }),
        contentType: 'application/json',
      },
      'https://prod.example/assets/legacy-A.js': {
        body: 'export const legacy=1',
        contentType: 'application/javascript',
      },
    }

    const result = await keepPreviousAssets(dist, 'https://prod.example', {
      ...mockFetch(store),
      now: () => '2026-11-05T20:00:00.000Z',
    })

    expect(result.skipped).toBe(false)
    expect(result.kept).toBeGreaterThanOrEqual(3)
    expect(readFileSync(join(assets, 'index-OLD.js'), 'utf8')).toContain('alt=1')
    expect(readFileSync(join(assets, 'chunk-OLD.js'), 'utf8')).toContain('chunk=1')
    expect(readFileSync(join(assets, 'legacy-A.js'), 'utf8')).toContain('legacy=1')
    expect(readFileSync(join(assets, 'index-NEW.js'), 'utf8')).toContain('neu=1')

    const man = JSON.parse(readFileSync(join(assets, '_tower_kept.json'), 'utf8')) as {
      generations: { builtAt: string; files: string[] }[]
    }
    expect(man.generations[0].builtAt).toBe('2026-11-05T20:00:00.000Z')
    // F7: bieżąca generacja = tylko pliki z tego buildu (nie skopiowane)
    expect(man.generations[0].files).toEqual(['index-NEW.js'])
    expect(man.generations[0].files).not.toContain('index-OLD.js')
    expect(man.generations[0].files).not.toContain('legacy-A.js')
    expect(man.generations[1].files).toEqual(['legacy-A.js'])
    expect(man.generations.length).toBe(2)

    rmSync(dist, { recursive: true, force: true })
  })

  it('po 4 kolejnych buildach najstarsza generacja znika z manifestu', async () => {
    const root = 'https://prod.example'
    let remoteManifest = { generations: [] as { builtAt: string; files: string[] }[] }
    const remoteBodies: Record<string, { body: string; contentType: string }> = {
      [`${root}/`]: {
        body: '<html><script type="module" src="/assets/entry.js"></script></html>',
        contentType: 'text/html',
      },
      [`${root}/assets/entry.js`]: {
        body: 'export const e=1',
        contentType: 'application/javascript',
      },
    }

    const syncRemoteFromDist = (dist: string, builtAt: string) => {
      const assets = join(dist, 'assets')
      const man = JSON.parse(readFileSync(join(assets, '_tower_kept.json'), 'utf8')) as {
        generations: { builtAt: string; files: string[] }[]
      }
      remoteManifest = man
      remoteBodies[`${root}/assets/_tower_kept.json`] = {
        body: JSON.stringify(man),
        contentType: 'application/json',
      }
      // udostępniaj pliki z zapisanej generacji
      for (const f of man.generations[0].files) {
        remoteBodies[`${root}/assets/${f}`] = {
          body: readFileSync(join(assets, f), 'utf8'),
          contentType: 'application/javascript',
        }
      }
      // entry na produkcji = najnowszy hash
      const entryName = man.generations[0].files[0]
      remoteBodies[`${root}/`] = {
        body: `<html><script type="module" src="/assets/${entryName}"></script></html>`,
        contentType: 'text/html',
      }
      void builtAt
    }

    const runBuild = async (label: string, builtAt: string) => {
      const dist = mkdtempSync(join(tmpdir(), `wt-keep-${label}-`))
      const assets = join(dist, 'assets')
      mkdirSync(assets, { recursive: true })
      writeFileSync(join(assets, `${label}.js`), `export const v='${label}'`)

      const store: Store = {
        ...remoteBodies,
        [`${root}/assets/_tower_kept.json`]: {
          body: JSON.stringify(remoteManifest),
          contentType: 'application/json',
        },
      }

      await keepPreviousAssets(dist, root, {
        ...mockFetch(store),
        now: () => builtAt,
      })
      syncRemoteFromDist(dist, builtAt)
      const man = JSON.parse(readFileSync(join(assets, '_tower_kept.json'), 'utf8')) as {
        generations: { builtAt: string; files: string[] }[]
      }
      rmSync(dist, { recursive: true, force: true })
      return man
    }

    const g1 = await runBuild('g1', '2026-11-01T00:00:00.000Z')
    expect(g1.generations.map((g) => g.files[0])).toEqual(['g1.js'])

    const g2 = await runBuild('g2', '2026-11-02T00:00:00.000Z')
    expect(g2.generations.map((g) => g.files[0])).toEqual(['g2.js', 'g1.js'])

    const g3 = await runBuild('g3', '2026-11-03T00:00:00.000Z')
    expect(g3.generations.map((g) => g.files[0])).toEqual(['g3.js', 'g2.js', 'g1.js'])

    const g4 = await runBuild('g4', '2026-11-04T00:00:00.000Z')
    // MAX_GENERATIONS=3 → g1 wypada
    expect(g4.generations.map((g) => g.files[0])).toEqual(['g4.js', 'g3.js', 'g2.js'])
    expect(g4.generations.some((g) => g.files.includes('g1.js'))).toBe(false)
    expect(g4.generations.length).toBe(3)
  })

  it('odrzuca text/html pod nazwą .js (rewrite SPA)', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'wt-keep-html-'))
    const assets = join(dist, 'assets')
    mkdirSync(assets, { recursive: true })
    writeFileSync(join(assets, 'index-NEW.js'), 'export const neu=1')

    const spaHtml = '<!doctype html><html><body>SPA</body></html>'
    const store: Store = {
      'https://prod.example/': {
        body: '<html><script type="module" src="/assets/ghost.js"></script></html>',
        contentType: 'text/html',
      },
      'https://prod.example/assets/ghost.js': {
        body: spaHtml,
        contentType: 'text/html; charset=utf-8',
      },
    }

    const result = await keepPreviousAssets(dist, 'https://prod.example', {
      ...mockFetch(store),
      now: () => '2026-11-05T21:00:00.000Z',
    })

    expect(result.skipped).toBe(false)
    expect(result.kept).toBe(0)
    expect(existsSync(join(assets, 'ghost.js'))).toBe(false)
    expect(contentTypeAcceptable('ghost.js', 'text/html')).toBe(false)
    expect(contentTypeAcceptable('ghost.js', 'application/javascript')).toBe(true)
    expect(contentTypeAcceptable('app.css', 'text/css')).toBe(true)
    expect(contentTypeAcceptable('app.css', 'text/html')).toBe(false)

    rmSync(dist, { recursive: true, force: true })
  })

  it('package.json build woła skrypt po vite build', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: { build: string } }
    expect(pkg.scripts.build).toMatch(/keep-previous-assets\.mjs dist/)
  })
})
