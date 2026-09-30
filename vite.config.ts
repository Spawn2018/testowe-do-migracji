import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { resolveAuthMode } from './build/authMode.ts'
import { PROD_DEMO_SWAP, isProdAuthMode, stripProdDist } from './build/prodStrip.ts'
import { isAbsolute, resolve as resolvePath } from 'node:path'

// A5-PODGLADY: podglądy Vercel zawsze w trybie demo; produkcja tylko z main.
const authMode = resolveAuthMode(process.env)
if (authMode !== undefined) process.env.VITE_AUTH_MODE = authMode

/** I-0: build produkcyjny — moduły z danymi demo podmienione na puste (build/prodStrip.ts, PROD_DEMO_SWAP). */
function prodDemoSwap(): Plugin {
  const root = process.cwd()
  const norm = (p: string) => resolvePath(p).replace(/\\/g, '/').toLowerCase()
  const swap = new Map(
    Object.entries(PROD_DEMO_SWAP).map(([from, to]) => [norm(resolvePath(root, from)), resolvePath(root, to)]),
  )
  return {
    name: 'i0-demo-swap',
    enforce: 'pre',
    apply: () => isProdAuthMode(process.env.VITE_AUTH_MODE),
    async resolveId(source, importer, options) {
      const r = await this.resolve(source, importer, { ...options, skipSelf: true })
      const to = r && swap.get(norm(r.id.split('?')[0]))
      return to ?? null
    },
  }
}

/** O2: build produkcyjny bez makiet/danych demo w dist/ (build/prodStrip.ts). */
function prodStripMockups(): Plugin {
  let outDir = 'dist'
  return {
    name: 'o2-prod-strip-mockups',
    apply: 'build',
    configResolved(c) {
      outDir = isAbsolute(c.build.outDir) ? c.build.outDir : resolvePath(c.root, c.build.outDir)
    },
    closeBundle() {
      if (!isProdAuthMode(process.env.VITE_AUTH_MODE)) return
      const removed = stripProdDist(outDir)
      console.log(`[o2] build produkcyjny: usunięto z dist: ${removed.join(', ') || '—'}; dodano 404.html`)
    },
  }
}

/** Dev/preview: POST /api/trafikverket → Trafikverket v2 (key server-side) or seed demo JSON */
function trafikverketApi(): Plugin {
  const handler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/trafikverket') || req.method !== 'POST') return next()
    const key = process.env.TRAFIKVERKET_API_KEY || ''
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    let body: { objecttype?: string; schemaversion?: string; limit?: number } = {}
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch { /* empty */ }
    if (!key) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ mode: 'seed', demo: true, reason: 'no TRAFIKVERKET_API_KEY' }))
      return
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<REQUEST>
  <LOGIN authenticationkey="${key}"/>
  <QUERY objecttype="${body.objecttype || 'Situation'}" schemaversion="${body.schemaversion || '1.5'}" limit="${body.limit || 50}">
    <FILTER>
      <LIKE name="Deviation.LocationDescriptor" value="%E4%"/>
    </FILTER>
  </QUERY>
</REQUEST>`
    try {
      const r = await fetch('https://api.trafikinfo.trafikverket.se/v2/data.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/json' },
        body: xml,
      })
      const text = await r.text()
      res.statusCode = r.status
      res.setHeader('Content-Type', 'application/json')
      res.end(text)
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ mode: 'seed', demo: true, reason: String(e) }))
    }
  }
  return {
    name: 'trafikverket-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res, next)
      })
    },
  }
}

export default defineConfig({
  plugins: [prodDemoSwap(), react(), trafikverketApi(), prodStripMockups()],
  server: {
    proxy: {
      // Tile proxy — browser hits same-origin; box fetches Carto (demotiles often egress-blocked)
      '/map-proxy/carto': {
        target: 'https://basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/map-proxy\/carto/, ''),
      },
    },
  },
  build: { rolldownOptions: { output: { keepNames: true } } },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/map-proxy/carto': {
        target: 'https://basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/map-proxy\/carto/, ''),
      },
    },
  },
})
