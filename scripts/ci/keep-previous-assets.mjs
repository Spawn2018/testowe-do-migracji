#!/usr/bin/env node
/**
 * DP-224 B1 (#817): Vite nie ma Vercel Skew Protection (tylko Next/Svelte/…).
 * Po buildzie dołączamy pliki /assets/ z bieżącej produkcji (+ do 2 poprzednich
 * generacji z _tower_kept.json), żeby stara karta nie dostała 404 na hashach.
 *
 * Uruchomienie: node scripts/ci/keep-previous-assets.mjs <dist> [baseUrl]
 * Włączane tylko gdy VERCEL_ENV=production albo KEEP_PREVIOUS_ASSETS=1.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const MANIFEST = '_tower_kept.json'
const MAX_GENERATIONS = 3
const ASSET_RE = /\/assets\/([A-Za-z0-9._@-]+\.(?:js|css|woff2?|ttf|png|svg|webp|map))/g
const REL_ASSET_RE = /(?:from\s*|import\(|new URL\(|["'`])\.\/([A-Za-z0-9._@-]+\.(?:js|css))/g

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

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.text()
}

async function fetchBytes(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function collectFromText(text, names) {
  for (const m of text.matchAll(ASSET_RE)) names.add(m[1])
  for (const m of text.matchAll(REL_ASSET_RE)) names.add(m[1])
}

/**
 * @param {string} distDir
 * @param {string} baseUrl
 * @param {{ fetchText?: typeof fetchText, fetchBytes?: typeof fetchBytes, now?: () => string }} [deps]
 */
export async function keepPreviousAssets(distDir, baseUrl, deps = {}) {
  const getText = deps.fetchText ?? fetchText
  const getBytes = deps.fetchBytes ?? fetchBytes
  const nowIso = (deps.now ?? (() => new Date().toISOString()))()
  const root = baseUrl.replace(/\/$/, '')
  const assetsDir = join(distDir, 'assets')
  mkdirSync(assetsDir, { recursive: true })

  const already = new Set(listFiles(assetsDir).map((p) => basename(p)))
  const wanted = new Set()

  let indexHtml = ''
  try {
    indexHtml = await getText(`${root}/`)
  } catch (e) {
    console.warn(`[keep-previous-assets] brak index: ${e instanceof Error ? e.message : e}`)
    return { kept: 0, skipped: true, reason: 'index' }
  }
  collectFromText(indexHtml, wanted)

  let prevGenerations = []
  try {
    const raw = await getText(`${root}/assets/${MANIFEST}`)
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
      const body = await getText(`${root}/assets/${name}`)
      collectFromText(body, wanted)
      for (const n of wanted) if (!seenBody.has(n)) queue.push(n)
    } catch {
      /* 404 — pomijamy */
    }
  }

  let kept = 0
  for (const name of wanted) {
    if (already.has(name) || name === MANIFEST) continue
    try {
      const buf = await getBytes(`${root}/assets/${name}`)
      writeFileSync(join(assetsDir, name), buf)
      already.add(name)
      kept += 1
    } catch (e) {
      console.warn(`[keep-previous-assets] pomijam ${name}: ${e instanceof Error ? e.message : e}`)
    }
  }

  const currentGenFiles = [...already].filter((n) => n !== MANIFEST).sort()
  const generations = [
    { builtAt: nowIso, files: currentGenFiles },
    ...prevGenerations.slice(0, MAX_GENERATIONS - 1),
  ]
  writeFileSync(join(assetsDir, MANIFEST), `${JSON.stringify({ generations }, null, 2)}\n`)

  console.log(`[keep-previous-assets] dopisano ${kept} plików z ${root} (generacje: ${generations.length})`)
  return { kept, skipped: false, generations: generations.length }
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
