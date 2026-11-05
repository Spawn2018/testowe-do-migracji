#!/usr/bin/env node
/**
 * DP-224 B1 (#817): Vite nie ma Vercel Skew Protection (tylko Next/Svelte/…).
 * Po buildzie dołączamy pliki /assets/ z bieżącej produkcji (+ do 2 poprzednich
 * generacji z _tower_kept.json), żeby stara karta nie dostała 404 na hashach.
 *
 * Retencja: w generacji zapisujemy tylko pliki z tego buildu Vite (przed kopiowaniem).
 * MAX_GENERATIONS=3 → po 4. wdrożeniu najstarsza generacja znika z manifestu.
 *
 * Uruchomienie: node scripts/ci/keep-previous-assets.mjs <dist> [baseUrl]
 * Włączane tylko gdy VERCEL_ENV=production albo KEEP_PREVIOUS_ASSETS=1.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

const MANIFEST = '_tower_kept.json'
const MAX_GENERATIONS = 3
const ASSET_RE = /\/assets\/([A-Za-z0-9._@-]+\.(?:js|css|woff2?|ttf|png|svg|webp|map))/g
const REL_ASSET_RE = /(?:from\s*|import\(|new URL\(|["'`])\.\/([A-Za-z0-9._@-]+\.(?:js|css))/g

/** @type {Record<string, RegExp>} */
const CONTENT_TYPE_OK = {
  '.html': /text\/html/i,
  '.js': /javascript|ecmascript|text\/plain/i,
  '.mjs': /javascript|ecmascript|text\/plain/i,
  '.css': /text\/css/i,
  '.json': /json|text\/plain/i,
  '.map': /json|javascript|text\/plain/i,
  '.woff': /font|octet-stream/i,
  '.woff2': /font|octet-stream/i,
  '.ttf': /font|octet-stream/i,
  '.png': /image\/png/i,
  '.svg': /image\/svg/i,
  '.webp': /image\/webp/i,
}

function enabled() {
  if (process.env.KEEP_PREVIOUS_ASSETS === '0') return false
  if (process.env.KEEP_PREVIOUS_ASSETS === '1') return true
  return process.env.VERCEL_ENV === 'production'
}

function listFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? listFiles(p) : [p]
  })
}

/**
 * @param {string} name
 * @param {string | null} contentType
 */
export function contentTypeAcceptable(name, contentType) {
  if (!contentType) return false
  const ext = extname(name).toLowerCase() || (name === 'index.html' ? '.html' : '')
  // text/html tylko dla prawdziwego HTML (index); assety .js/.css nigdy
  if (/text\/html/i.test(contentType)) return ext === '.html'
  const re = CONTENT_TYPE_OK[ext]
  if (!re) return true
  return re.test(contentType)
}

/**
 * @param {string} url
 * @param {string} name
 */
async function fetchText(url, name) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const ct = res.headers.get('content-type')
  if (!contentTypeAcceptable(name || basename(new URL(url).pathname), ct)) {
    throw new Error(`${url} → zły content-type: ${ct ?? '(brak)'}`)
  }
  return res.text()
}

/**
 * @param {string} url
 * @param {string} name
 */
async function fetchBytes(url, name) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const ct = res.headers.get('content-type')
  if (!contentTypeAcceptable(name || basename(new URL(url).pathname), ct)) {
    throw new Error(`${url} → zły content-type: ${ct ?? '(brak)'}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

function collectFromText(text, names) {
  for (const m of text.matchAll(ASSET_RE)) names.add(m[1])
  for (const m of text.matchAll(REL_ASSET_RE)) names.add(m[1])
}

/**
 * @param {string} distDir
 * @param {string} baseUrl
 * @param {{ fetchText?: (url: string, name?: string) => Promise<string>, fetchBytes?: (url: string, name?: string) => Promise<Buffer>, now?: () => string }} [deps]
 */
export async function keepPreviousAssets(distDir, baseUrl, deps = {}) {
  const getText = deps.fetchText ?? fetchText
  const getBytes = deps.fetchBytes ?? fetchBytes
  const nowIso = (deps.now ?? (() => new Date().toISOString()))()
  const root = baseUrl.replace(/\/$/, '')
  const assetsDir = join(distDir, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  // Tylko pliki z tego buildu Vite — nie dziedziczą skopiowanych z poprzednich generacji.
  const buildFiles = listFiles(assetsDir)
    .map((p) => basename(p))
    .filter((n) => n !== MANIFEST)
    .sort()
  const already = new Set(buildFiles)
  const wanted = new Set()

  let indexHtml = ''
  try {
    // index.html produkcji — content-type text/html jest OK (to nie asset).
    indexHtml = await getText(`${root}/`, 'index.html')
  } catch (e) {
    console.warn(`[keep-previous-assets] brak index: ${e instanceof Error ? e.message : e}`)
    return { kept: 0, skipped: true, reason: 'index' }
  }
  collectFromText(indexHtml, wanted)

  let prevGenerations = []
  try {
    const raw = await getText(`${root}/assets/${MANIFEST}`, MANIFEST)
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.generations)) prevGenerations = parsed.generations
  } catch {
    /* brak manifestu — pierwsza generacja */
  }
  for (const gen of prevGenerations.slice(0, MAX_GENERATIONS - 1)) {
    for (const f of gen.files ?? []) wanted.add(f)
  }

  const queue = [...wanted]
  const seenBody = new Set()
  while (queue.length) {
    const name = queue.shift()
    if (!name || seenBody.has(name)) continue
    seenBody.add(name)
    if (!name.endsWith('.js')) continue
    if (already.has(name)) {
      try {
        collectFromText(readFileSync(join(assetsDir, name), 'utf8'), wanted)
        for (const n of wanted) if (!seenBody.has(n)) queue.push(n)
      } catch {
        /* ignore */
      }
      continue
    }
    try {
      const body = await getText(`${root}/assets/${name}`, name)
      collectFromText(body, wanted)
      for (const n of wanted) if (!seenBody.has(n)) queue.push(n)
    } catch {
      /* 404 / zły CT — pomijamy */
    }
  }

  let kept = 0
  let keptBytes = 0
  for (const name of wanted) {
    if (already.has(name) || name === MANIFEST) continue
    try {
      const buf = await getBytes(`${root}/assets/${name}`, name)
      writeFileSync(join(assetsDir, name), buf)
      already.add(name)
      kept += 1
      keptBytes += buf.length
    } catch (e) {
      console.warn(`[keep-previous-assets] pomijam ${name}: ${e instanceof Error ? e.message : e}`)
    }
  }

  const generations = [
    { builtAt: nowIso, files: buildFiles },
    ...prevGenerations.slice(0, MAX_GENERATIONS - 1),
  ]
  writeFileSync(join(assetsDir, MANIFEST), `${JSON.stringify({ generations }, null, 2)}\n`)

  const kb = (keptBytes / 1024).toFixed(1)
  console.log(
    `[keep-previous-assets] dopisano ${kept} plików (${kb} KiB) z ${root} (generacje: ${generations.length})`,
  )
  return { kept, keptBytes, skipped: false, generations: generations.length, buildFiles }
}

async function main() {
  if (!enabled()) {
    console.log('[keep-previous-assets] pominięte (nie produkcja Vercel)')
    return
  }
  const distDir = process.argv[2] || 'dist'
  const baseUrl = process.argv[3] || process.env.TOWER_PROD_URL || 'https://tower.log-mar.pl'
  await keepPreviousAssets(distDir, baseUrl)
}

const isMain = process.argv[1] && basename(process.argv[1]).includes('keep-previous-assets')
if (isMain) {
  main().catch((e) => {
    console.warn(`[keep-previous-assets] błąd (build idzie dalej): ${e instanceof Error ? e.message : e}`)
    process.exitCode = 0
  })
}
