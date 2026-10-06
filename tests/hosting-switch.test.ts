import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// PR8: aplikacja = build statyczny; Vercel i Cloudflare Pages dostają te same pliki i te same nagłówki.
describe('PR8: przełączenie hostingu Vercel ↔ Cloudflare Pages', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[]; [k: string]: unknown }

  // O2: Vercel dokleja nagłówki z vercel.json także do odpowiedzi 404 — reguła /download/(.*) dawała
  // „404 jako załącznik”. Build produkcyjny nie ma /download/, więc vercel.json nie ma już nagłówków.
  // AUD-01 (06.10): jedyne przepisanie = kafelki `/tiles/...` → funkcja here-raster z pamięcią brzegu Vercel.
  // Cloudflare Pages go nie ma (`_redirects` nie przekazuje do obcych hostów) — klient po 404/HTML przechodzi
  // wtedy wprost na funkcję (`edgeMissing` w applyBasemap.ts), więc przełączenie hostingu dalej działa.
  it('vercel.json: bez nagłówków /download, funkcji, cronów (O2); jedyne przepisania = /tiles (AUD-01c → api/tiles, fra1); SEC: XFO/XCTO OK', () => {
    expect(Object.keys(vercel)).toEqual(['headers', 'rewrites', 'regions'])
    expect(vercel.regions).toEqual(['fra1'])
    expect(vercel.headers.every((h) => !h.source.includes('download'))).toBe(true)
    const keys = vercel.headers.flatMap((h) => h.headers.map((x) => x.key))
    expect(keys).toContain('X-Frame-Options')
    expect(keys).toContain('X-Content-Type-Options')
    const rewrites = vercel.rewrites as { source: string; destination: string }[]
    expect(rewrites).toHaveLength(2)
    for (const r of rewrites) {
      expect(r.source.startsWith('/tiles/')).toBe(true)
      expect(r.destination).toMatch(/^\/api\/tiles\?/)
    }
    expect(readFileSync('src/components/map/applyBasemap.ts', 'utf8')).toMatch(/edgeMissing = true/)
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

  it('kod serwerowy Vercel tylko api/tiles.js (AUD-01c, kafelki); Pages bez kodu (klient idzie wtedy wprost do funkcji)', () => {
    expect(readdirSync('api')).toEqual(['tiles.js'])
    for (const p of ['functions', 'middleware.ts', 'middleware.js', '_worker.js']) expect(existsSync(p), p).toBe(false)
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
