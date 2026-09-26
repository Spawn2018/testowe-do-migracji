/**
 * ANEKS 5 3.2c — walidacja pliku kierowcy po stronie serwera (driver-photo), niezależnie od aplikacji:
 * typ rozpoznawany po sygnaturze pierwszych bajtów (nie po deklarowanym typie ani nazwie),
 * dozwolone wyłącznie JPEG, PNG, PDF; zdjęcie ≤ 1 MB (kompresja w przeglądarce nie chroni przed starą
 * wersją aplikacji), PDF ≤ 10 MB. Moduł bez zależności — testowany w vitest (tests/file-signature.test.ts).
 */
export const PHOTO_MAX_BYTES = 1024 * 1024;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export type AllowedMime = 'image/jpeg' | 'image/png' | 'application/pdf';

export function sniffMime(head: Uint8Array): AllowedMime | null {
  const b = head;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  if (b.length >= 5 && [0x25, 0x50, 0x44, 0x46, 0x2d].every((v, i) => b[i] === v)) return 'application/pdf'; // %PDF-
  return null;
}

export type FileCheck =
  | { ok: true; mime: AllowedMime }
  | { ok: false; status: 413 | 415; error: string };

export function checkDriverFile(head: Uint8Array, size: number, declared: string): FileCheck {
  const mime = sniffMime(head);
  if (!mime) return { ok: false, status: 415, error: 'Nieobsługiwany plik — dozwolone JPEG, PNG albo PDF' };
  const decl = (declared || '').toLowerCase().replace('image/jpg', 'image/jpeg');
  if (decl && decl !== 'application/octet-stream' && decl !== mime) {
    return { ok: false, status: 415, error: `Zawartość pliku (${mime}) nie zgadza się z deklarowanym typem (${declared})` };
  }
  if (size <= 0) return { ok: false, status: 415, error: 'Pusty plik' };
  if (mime === 'application/pdf' && size > PDF_MAX_BYTES) {
    return { ok: false, status: 413, error: 'PDF większy niż 10 MB — zmniejsz plik' };
  }
  if (mime !== 'application/pdf' && size > PHOTO_MAX_BYTES) {
    return { ok: false, status: 413, error: 'Zdjęcie większe niż 1 MB — zaktualizuj aplikację (odśwież stronę) i zrób zdjęcie ponownie' };
  }
  return { ok: true, mime };
}
