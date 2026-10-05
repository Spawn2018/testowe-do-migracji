#!/usr/bin/env node
/**
 * D15 — rozmiar pierwszego wczytania paczki (to, co przeglądarka pobiera przed pierwszym widokiem):
 * index.html + skrypty `<script type=module>` + `<link rel=modulepreload>` + arkusze CSS z index.html.
 * Kawałki ładowane leniwie (mapa, ExcelJS, JSZip, import harmonogramu) są wypisane osobno.
 *
 * Użycie: node scripts/bundle-size.mjs [dist] [--budget-kb=400] [--json]
 * Budżet dotyczy rozmiaru po gzip (transfer); kod wyjścia 1 przy przekroczeniu.
 */
import { readFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { gzipSync } from 'zlib'
import { isAbsolute, relative, resolve, sep } from 'path'
import { fileURLToPath } from 'url'

const args = process.argv.slice(2)
const distArg = args.find((a) => !a.startsWith('--')) || 'dist'
const budgetKb = Number((args.find((a) => a.startsWith('--budget-kb=')) || '--budget-kb=400').split('=')[1])
const asJson = args.includes('--json')

const REPO = fileURLToPath(new URL('..', import.meta.url))

function isInside(root, abs) {
  const rel = relative(resolve(root), abs)
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

// Argument [dist] jest z zewnątrz. Repo albo katalog tymczasowy (fresh-smoke: /tmp/wt-fresh-*/dist).
const dist = resolve(distArg)
if (!isInside(REPO, dist) && !isInside(tmpdir(), dist)) {
  throw new Error('dist musi być w repo albo w katalogu tymczasowym')
}

const ASSET_NAME = /^[A-Za-z0-9._-]+\.(js|css)$/

function assetName(name) {
  if (!ASSET_NAME.test(name) || name.includes('..')) return null
  return name
}

const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const refs = new Set()
for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+\.(?:js|css))"[^>]*>/g)) {
  refs.add(m[1].replace(/^\.?\//, ''))
}

const assetFiles = new Map()
for (const name of readdirSync(resolve(dist, 'assets'))) {
  const safe = assetName(name)
  if (safe) assetFiles.set(`assets/${safe}`, resolve(dist, 'assets', safe))
}
// Barlow i inne fonty w /fonts (poza assets) — też w pierwszym wczytaniu.
try {
  for (const name of readdirSync(resolve(dist, 'fonts'))) {
    const safe = assetName(name)
    if (safe) assetFiles.set(`fonts/${safe}`, resolve(dist, 'fonts', safe))
  }
} catch {
  /* brak katalogu fonts */
}

function readRef(rel) {
  const path = assetFiles.get(rel)
  if (!path) throw new Error(`odczyt poza assets/fonts dist: ${rel}`)
  const buf = readFileSync(path)
  return { file: rel, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
}

const initial = [{ file: 'index.html', raw: Buffer.byteLength(html), gzip: gzipSync(html, { level: 9 }).length }, ...[...refs].map(readRef)]
const all = [...assetFiles.keys()].filter((f) => f.startsWith('assets/'))
const lazy = all.filter((f) => !refs.has(f)).map(readRef).sort((a, b) => b.raw - a.raw)
const sum = (xs, k) => xs.reduce((a, x) => a + x[k], 0)
const kb = (n) => (n / 1024).toFixed(1)
const report = {
  dist,
  initial: { files: initial, raw: sum(initial, 'raw'), gzip: sum(initial, 'gzip') },
  lazy: { files: lazy, raw: sum(lazy, 'raw'), gzip: sum(lazy, 'gzip') },
  budgetKb,
  ok: sum(initial, 'gzip') <= budgetKb * 1024,
}
if (asJson) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`pierwsze wczytanie: ${kb(report.initial.raw)} kB surowo · ${kb(report.initial.gzip)} kB gzip (budżet ${budgetKb} kB gzip) → ${report.ok ? 'OK' : 'PRZEKROCZONY'}`)
  for (const f of initial) console.log(`  ${f.file.padEnd(40)} ${kb(f.raw).padStart(9)} kB · ${kb(f.gzip).padStart(8)} kB gz`)
  console.log(`leniwe (${lazy.length}): ${kb(report.lazy.raw)} kB surowo · ${kb(report.lazy.gzip)} kB gzip`)
  for (const f of lazy) console.log(`  ${f.file.padEnd(40)} ${kb(f.raw).padStart(9)} kB · ${kb(f.gzip).padStart(8)} kB gz`)
}
if (!report.ok) process.exitCode = 1
