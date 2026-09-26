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
import { gzipSync } from 'zlib'
import { join } from 'path'

const args = process.argv.slice(2)
const dist = args.find((a) => !a.startsWith('--')) || 'dist'
const budgetKb = Number((args.find((a) => a.startsWith('--budget-kb=')) || '--budget-kb=400').split('=')[1])
const asJson = args.includes('--json')

const html = readFileSync(join(dist, 'index.html'), 'utf8')
const refs = new Set()
for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+\.(?:js|css))"[^>]*>/g)) refs.add(m[1].replace(/^\.?\//, ''))

const size = (rel) => {
  const buf = readFileSync(join(dist, rel))
  return { file: rel, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
}
const initial = [{ file: 'index.html', raw: Buffer.byteLength(html), gzip: gzipSync(html, { level: 9 }).length }, ...[...refs].map(size)]
const all = readdirSync(join(dist, 'assets')).filter((f) => /\.(js|css)$/.test(f)).map((f) => `assets/${f}`)
const lazy = all.filter((f) => !refs.has(f)).map(size).sort((a, b) => b.raw - a.raw)
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

