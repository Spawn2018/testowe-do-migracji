/**
 * ANEKS 4 PR7 — kompresja zdjęć w przeglądarce przed wgraniem:
 * dłuższy bok ≤ 1600 px, JPEG jakość 0,75. PDF bez zmian (limit 10 MB).
 * Gdy przeglądarka nie odczyta obrazu (np. HEIC poza Safari) — wysyłany oryginał.
 */
export const IMAGE_MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.75;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

const COMPRESSIBLE = /^image\/(jpeg|png|webp|heic|heif)$/i;

export const isPdfTooBig = (file: File): boolean =>
  (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) && file.size > PDF_MAX_BYTES;

export function scaledSize(w: number, h: number, max = IMAGE_MAX_EDGE): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.test(file.type) || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const { w, h } = scaledSize(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bmp.close(); return file; }
  ctx.fillStyle = '#fff'; // przezroczystość PNG → białe tło w JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
  if (!blob || blob.size >= file.size) return file;
  const base = (file.name || 'zdjecie').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
}
