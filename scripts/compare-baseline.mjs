/**
 * G2 / Fala gate — compare a candidate shot dir vs shots-baseline (pixelmatch).
 *
 * Usage:
 *   node scripts/compare-baseline.mjs
 *   CANDIDATE=shots-g2-candidate BASELINE=shots-baseline node scripts/compare-baseline.mjs
 *
 * Thresholds (align F2.2 / playwright.config): color threshold 0.28, maxDiffPixels 60.
 * Also reports ratio>0.001 for Fala-2-style “changed” counting.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CAND = join(ROOT, process.env.CANDIDATE || 'shots-g2-candidate')
const BASE = join(ROOT, process.env.BASELINE || 'shots-baseline')
const OUT = join(ROOT, process.env.REPORT || 'test-results/g2-visual-report.json')
const COLOR_THR = Number(process.env.COLOR_THR || 0.28)
const MAX_DIFF_PX = Number(process.env.MAX_DIFF_PX || 60)
const RATIO_THR = Number(process.env.RATIO_THR || 0.001)

function viewGroup(file) {
  return file.split('__')[0] || file
}

const candFiles = readdirSync(CAND).filter((f) => f.endsWith('.png')).sort()
const baseFiles = new Set(readdirSync(BASE).filter((f) => f.endsWith('.png')))

const missingInCand = [...baseFiles].filter((f) => !candFiles.includes(f))
const missingInBase = candFiles.filter((f) => !baseFiles.has(f))

const changed = []
const identical = []
const sizeMismatch = []
const failPx = [] // exceeds maxDiffPixels @ COLOR_THR

for (const file of candFiles) {
  if (!baseFiles.has(file)) continue
  const a = PNG.sync.read(readFileSync(join(BASE, file)))
  const b = PNG.sync.read(readFileSync(join(CAND, file)))
  if (a.width !== b.width || a.height !== b.height) {
    sizeMismatch.push({ file, a: `${a.width}x${a.height}`, b: `${b.width}x${b.height}` })
    continue
  }
  const { width, height } = a
  const diff = new PNG({ width, height })
  const n = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: COLOR_THR })
  const ratio = n / (width * height)
  const row = { file, view: viewGroup(file), diffPixels: n, ratio: Number(ratio.toFixed(6)) }
  if (n > MAX_DIFF_PX) failPx.push(row)
  if (ratio > RATIO_THR || n > MAX_DIFF_PX) changed.push(row)
  else identical.push(row)
}

const byView = {}
for (const row of changed) {
  byView[row.view] = (byView[row.view] || 0) + 1
}

const report = {
  generatedAt: new Date().toISOString(),
  candidate: CAND,
  baseline: BASE,
  colorThr: COLOR_THR,
  maxDiffPixels: MAX_DIFF_PX,
  ratioThr: RATIO_THR,
  totals: {
    candidatePng: candFiles.length,
    baselinePng: baseFiles.size,
    compared: identical.length + changed.length,
    identical: identical.length,
    changed: changed.length,
    failMaxDiffPx: failPx.length,
    sizeMismatch: sizeMismatch.length,
    missingInCandidate: missingInCand.length,
    missingInBaseline: missingInBase.length,
  },
  byView,
  sampleChanged: changed.slice(0, 40).map((r) => r.file),
  sizeMismatch,
  missingInCand: missingInCand.slice(0, 20),
  missingInBase: missingInBase.slice(0, 20),
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.totals, null, 2))
console.log('byView', byView)
console.log('report →', OUT)
if (missingInCand.length || missingInBase.length || sizeMismatch.length) process.exitCode = 2
/* III-2: STRICT=1 (npm run gate:visual) — każde ujęcie ponad próg = błąd */
else if (process.env.STRICT === '1' && changed.length) process.exitCode = 1
