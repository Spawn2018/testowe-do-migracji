import { describe, expect, it } from 'vitest'
import { checkDriverFile, sniffMime, PHOTO_MAX_BYTES, PDF_MAX_BYTES } from '../supabase/functions/_shared/fileSignature'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PDF = new TextEncoder().encode('%PDF-1.7\n')
const HTML = new TextEncoder().encode('<html><script>')
const HEIC = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]) // ftypheic
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0])

describe('3.2c driver-photo: typ po sygnaturze, limit zdjęcia 1 MB', () => {
  it('rozpoznaje JPEG, PNG, PDF po bajtach; inne → null', () => {
    expect(sniffMime(JPEG)).toBe('image/jpeg')
    expect(sniffMime(PNG)).toBe('image/png')
    expect(sniffMime(PDF)).toBe('application/pdf')
    for (const b of [HTML, HEIC, EXE, new Uint8Array()]) expect(sniffMime(b)).toBeNull()
  })
  it('akceptuje JPEG/PNG ≤ 1 MB i PDF ≤ 10 MB (typ z sygnatury)', () => {
    expect(checkDriverFile(JPEG, PHOTO_MAX_BYTES, 'image/jpeg')).toEqual({ ok: true, mime: 'image/jpeg' })
    expect(checkDriverFile(PNG, 1000, 'image/png')).toEqual({ ok: true, mime: 'image/png' })
    expect(checkDriverFile(PDF, PDF_MAX_BYTES, 'application/pdf')).toEqual({ ok: true, mime: 'application/pdf' })
    expect(checkDriverFile(JPEG, 1000, '')).toEqual({ ok: true, mime: 'image/jpeg' })
  })
  it('zdjęcie > 1 MB → 413 (stara wersja aplikacji bez kompresji)', () => {
    expect(checkDriverFile(JPEG, PHOTO_MAX_BYTES + 1, 'image/jpeg')).toMatchObject({ ok: false, status: 413 })
    expect(checkDriverFile(PNG, 5 * 1024 * 1024, 'image/png')).toMatchObject({ ok: false, status: 413 })
  })
  it('PDF > 10 MB → 413', () => {
    expect(checkDriverFile(PDF, PDF_MAX_BYTES + 1, 'application/pdf')).toMatchObject({ ok: false, status: 413 })
  })
  it('podszyty typ: HTML/EXE zadeklarowany jako JPEG → 415; JPEG zadeklarowany jako PDF → 415', () => {
    expect(checkDriverFile(HTML, 100, 'image/jpeg')).toMatchObject({ ok: false, status: 415 })
    expect(checkDriverFile(EXE, 100, 'application/pdf')).toMatchObject({ ok: false, status: 415 })
    expect(checkDriverFile(JPEG, 100, 'application/pdf')).toMatchObject({ ok: false, status: 415 })
  })
  it('HEIC/WebP → 415 (dozwolone tylko JPEG, PNG, PDF)', () => {
    expect(checkDriverFile(HEIC, 100, 'image/heic')).toMatchObject({ ok: false, status: 415 })
  })
  it('driver-photo używa walidacji przed rejestracją dokumentu i zapisem pliku', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('supabase/functions/driver-photo/index.ts', 'utf8')
    const iCheck = src.indexOf('checkDriverFile('), iRpc = src.indexOf("rpc('driver_create_document'"), iUp = src.indexOf('.upload(')
    expect(iCheck).toBeGreaterThan(0)
    expect(iCheck).toBeLessThan(iRpc)
    expect(iRpc).toBeLessThan(iUp)
    expect(src).toContain('contentType: check.mime')
  })
})
