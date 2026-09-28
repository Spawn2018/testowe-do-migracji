/**
 * D-25 (decyzja właściciela 28.09) — weryfikacja warunkowa odświeżenia wzorca: dla każdego ujęcia z różnicą wobec
 * shots-baseline sprawdza, czy różnica leży WYŁĄCZNIE w strefie nowych elementów (prostokąty z _rects.json kandydata:
 * nagłówek panelu z przyciskami / wyborem tygodnia, tabela kategorii z terminami i „Zmień”, notka propozycji).
 * Poza strefą: (a) wszystko nad strefą i (b) pas boczny (nawigacja) — identyczne; (c) treść pod strefą — identyczna po
 * pionowym przesunięciu o dy (strefa urosła/zmalała), dy wyznaczone skrótami wierszy. Próg: 0,1% pikseli sprawdzanego
 * obszaru przy tolerancji koloru 0.28 (jak brama). Wynik: JSON {zgodne:[…], wypisane:[{file, powód}]}.
 * Użycie: node scripts/visual/d25-verify.mjs <katalog kandydata> [<katalog kandydata> …]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const THR = 0.28, RATIO = 0.001
const dirs = process.argv.slice(2)
const ok = [], listed = [], same = []
function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) img.data.copy(out, y * w * 4, ((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4)
  return out
}
function diff(a, b, w, h) { return w > 0 && h > 0 ? pixelmatch(a, b, null, w, h, { threshold: THR }) : 0 }
for (const dir of dirs) {
  const rects = JSON.parse(readFileSync(`${dir}/_rects.json`, 'utf8'))
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.png')).sort()) {
    const B = PNG.sync.read(readFileSync(`shots-baseline/${f}`)), C = PNG.sync.read(readFileSync(`${dir}/${f}`))
    const W = C.width, H = C.height
    if (B.width !== W || B.height !== H) { listed.push({ file: f, powod: 'inny rozmiar ujęcia' }); continue }
    const total = diff(B.data, C.data, W, H)
    if (total / (W * H) <= RATIO) { same.push(f); continue }
    const rs = (rects[f] || []).filter((r) => r.w > 0 && r.h > 0)
    if (!rs.length) { listed.push({ file: f, powod: 'brak strefy nowych elementów w ujęciu' }); continue }
    const zx0 = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.x)))), zx1 = Math.min(W, Math.ceil(Math.max(...rs.map((r) => r.x + r.w))))
    const zy0 = Math.max(0, Math.floor(Math.min(...rs.map((r) => r.y)))), zy1 = Math.min(H, Math.ceil(Math.max(...rs.map((r) => r.y + r.h))))
    const zw = zx1 - zx0
    // (a) nad strefą, cała szerokość
    const dA = diff(crop(B, 0, 0, W, zy0), crop(C, 0, 0, W, zy0), W, zy0)
    // (b) pasy boczne poza szerokością strefy, cała wysokość
    const dL = diff(crop(B, 0, 0, zx0, H), crop(C, 0, 0, zx0, H), zx0, H)
    const dR = diff(crop(B, zx1, 0, W - zx1, H), crop(C, zx1, 0, W - zx1, H), W - zx1, H)
    // (c) pod strefą — przesunięcie dy wyznaczone skrótami wierszy w pasie strefy
    const rowHash = (img) => Array.from({ length: H }, (_, y) => createHash('md5').update(img.data.subarray((y * W + zx0) * 4, (y * W + zx1) * 4)).digest('hex'))
    const hb = rowHash(B), hc = rowHash(C)
    let best = { dy: 0, m: -1 }
    for (let dy = -300; dy <= 600; dy++) {
      let m = 0
      for (let y = zy1; y < H; y++) { const yb = y - dy; if (yb >= 0 && yb < H && hb[yb] === hc[y]) m++ }
      if (m > best.m) best = { dy, m }
    }
    const y0 = Math.max(zy1, best.dy), y1 = Math.min(H, H + best.dy) // zakres y w C, dla którego y-dy ∈ [0,H)
    const hBelow = Math.max(0, y1 - y0)
    const dC = diff(crop(B, zx0, y0 - best.dy, zw, hBelow), crop(C, zx0, y0, zw, hBelow), zw, hBelow)
    const area = W * zy0 + zx0 * H + (W - zx1) * H + zw * hBelow
    const outside = dA + dL + dR + dC
    const row = { file: f, roznica: total, strefa: [zx0, zy0, zx1, zy1], dy: best.dy, poza: outside, nad: dA, boki: dL + dR, pod: dC }
    if (outside / Math.max(area, 1) <= RATIO) ok.push(row)
    else listed.push({ ...row, powod: `różnica poza strefą nowych elementów: ${outside} px (nad ${dA}, boki ${dL + dR}, pod po przesunięciu ${best.dy} px: ${dC})` })
  }
}
const out = { zgodne: ok.length, wypisane: listed.length, bez_zmian: same.length, szczegoly: { zgodne: ok, wypisane: listed, bez_zmian: same } }
writeFileSync(process.env.REPORT || '/tmp/d25-verify.json', JSON.stringify(out, null, 1))
console.log(`D-25: zgodne ${ok.length} · wypisane ${listed.length} · w progu bez zmiany ${same.length}`)
for (const l of listed) console.log('  WYPISANE', l.file, '—', l.powod)
