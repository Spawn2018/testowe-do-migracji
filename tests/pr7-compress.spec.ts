import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// ANEKS 4 PR7: kompresja zdjęć w przeglądarce — prawdziwy Chromium, moduł src/lib/imageCompress.ts.
const moduleJs = ts.transpileModule(readFileSync('src/lib/imageCompress.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^export /gm, '')

test('PR7: zdjęcie ≥ 5 MB → JPEG ≤ 1600 px i < 500 kB; PDF > 10 MB odrzucony, mały PDF bez zmian', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>')
  await page.addScriptTag({ content: `${moduleJs}\nwindow.__pr7 = { compressImage, isPdfTooBig, PDF_MAX_BYTES };` })
  const r = await page.evaluate(async () => {
    const w = window as unknown as { __pr7: { compressImage: (f: File) => Promise<File>; isPdfTooBig: (f: File) => boolean; PDF_MAX_BYTES: number } }
    // zdjęcie z aparatu: 4000×3000, gradient + szum matrycy, JPEG jakość 1.0 (≈ plik z telefonu, ≥ 5 MB)
    const c = document.createElement('canvas'); c.width = 4000; c.height = 3000
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(4000, 3000)
    let s = 12345
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      const n = (s & 63) - 32, p = i / 4, x = p % 4000, y = (p / 4000) | 0
      img.data[i] = (x / 16 + n) & 255; img.data[i + 1] = (y / 12 + n) & 255; img.data[i + 2] = ((x + y) / 28 + n) & 255; img.data[i + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 1))
    const input = new File([blob], 'IMG_0001.jpeg', { type: 'image/jpeg' })
    const out = await w.__pr7.compressImage(input)
    const bmp = await createImageBitmap(out)
    const bigPdf = new File([new Uint8Array(w.__pr7.PDF_MAX_BYTES + 1)], 'skan.pdf', { type: 'application/pdf' })
    const okPdf = new File([new Uint8Array(1000)], 'cmr.pdf', { type: 'application/pdf' })
    const pdfOut = await w.__pr7.compressImage(okPdf)
    return { inBytes: input.size, outBytes: out.size, type: out.type, name: out.name, w: bmp.width, h: bmp.height,
      bigPdf: w.__pr7.isPdfTooBig(bigPdf), okPdf: w.__pr7.isPdfTooBig(okPdf), pdfSame: pdfOut === okPdf }
  })
  console.log(`[PR7] ${(r.inBytes / 1048576).toFixed(1)} MB → ${(r.outBytes / 1024).toFixed(0)} kB, ${r.w}×${r.h}`)
  expect(r.inBytes).toBeGreaterThanOrEqual(5 * 1024 * 1024)
  expect(r.outBytes).toBeLessThan(500 * 1024)
  expect(r.type).toBe('image/jpeg')
  expect(r.name).toBe('IMG_0001.jpg')
  expect(Math.max(r.w, r.h)).toBe(1600)
  expect(r.bigPdf).toBe(true)
  expect(r.okPdf).toBe(false)
  expect(r.pdfSame).toBe(true)
})
