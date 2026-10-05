import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// PR8: aplikacja = build statyczny; Vercel i Cloudflare Pages dostają te same pliki i te same nagłówki.
describe('PR8: przełączenie hostingu Vercel ↔ Cloudflare Pages', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[]; [k: string]: unknown }

  // O2: Vercel dokleja nagłówki z vercel.json także do odpowiedzi 404 — reguła /download/(.*) dawała
  // „404 jako załącznik”. Build produkcyjny nie ma /download/, więc vercel.json nie ma już nagłówków.
  it('vercel.json: bez nagłówków /download, funkcji, przepisań, cronów (O2); SEC: XFO/XCTO OK', () => {
    expect(Object.keys(vercel)).toEqual(['headers'])
    expect(vercel.headers.every((h) => !h.source.includes('download'))).toBe(true)
    const keys = vercel.headers.flatMap((h) => h.headers.map((x) => x.key))
    expect(keys).toContain('X-Frame-Options')
    expect(keys).toContain('X-Content-Type-Options')
    expect(vercel).not.toHaveProperty('rewrites')
    expect(vercel).not.toHaveProperty('functions')
    expect(vercel).not.toHaveProperty('crons')
  })

  it('public/_headers (Cloudflare Pages): /download/* + SEC; w buildzie produkcyjnym /download usuwany', () => {
    // Windows: CRLF w working tree mimo eol=lf — porównujemy po normalizacji LF
    const lines = readFileSync('public/_headers', 'utf8').replace(/\r\n/g, '\n').trim().split('\n')
    expect(lines[0]).toBe('/download/*')
    expect(lines.join('\n')).toMatch(/Content-Disposition: attachment/)
    expect(lines.join('\n')).toMatch(/X-Frame-Options:\s*DENY/)
    expect(readFileSync('build/prodStrip.ts', 'utf8')).toMatch(/stripDownloadHeaders/)
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
