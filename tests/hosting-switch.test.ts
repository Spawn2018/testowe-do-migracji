import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// PR8: aplikacja = build statyczny; Vercel i Cloudflare Pages dostają te same pliki i te same nagłówki.
describe('PR8: przełączenie hostingu Vercel ↔ Cloudflare Pages', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[]; [k: string]: unknown }

  it('vercel.json: tylko nagłówki /download (bez funkcji, przepisań, cronów)', () => {
    expect(Object.keys(vercel)).toEqual(['headers'])
    expect(vercel.headers.map((h) => h.source)).toEqual(['/download/(.*)'])
  })

  it('public/_headers (Cloudflare Pages) = nagłówki z vercel.json', () => {
    const lines = readFileSync('public/_headers', 'utf8').trim().split('\n')
    expect(lines[0]).toBe('/download/*')
    const cf = Object.fromEntries(lines.slice(1).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
    expect(cf).toEqual(Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value])))
  })

  it('brak kodu serwerowego Vercel/Pages (api/, functions/, middleware)', () => {
    for (const p of ['api', 'functions', 'middleware.ts', 'middleware.js', '_worker.js']) expect(existsSync(p), p).toBe(false)
  })

  it('routing po stronie klienta w adresie (#) — żaden host nie potrzebuje przepisań na index.html', () => {
    expect(readFileSync('src/App.tsx', 'utf8')).toMatch(/<HashRouter>/)
  })

  it('/api/trafikverket tylko w serwerze dev/podglądu Vite; na hostingu statycznym aplikacja przechodzi na dane przykładowe', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/configureServer[\s\S]*configurePreviewServer/)
    expect(readFileSync('src/lib/trafikverket.ts', 'utf8')).toMatch(/catch \{\s*return \{ items: SEED_SITUATIONS, mode: 'seed' \}/)
    expect(readdirSync('public')).toContain('_headers')
  })
})
