import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Dev/preview: POST /api/trafikverket → Trafikverket v2 (key server-side) or seed demo JSON */
function trafikverketApi(): Plugin {
  const handler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/trafikverket') || req.method !== 'POST') return next()
    const key = process.env.TRAFIKVERKET_API_KEY || process.env.VITE_TRAFIKVERKET_API_KEY || ''
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
  plugins: [react(), trafikverketApi()],
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
