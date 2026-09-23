/** Punkt 5 — odczyt pliku, podgląd (object URL), pobieranie z dataUrl/blob. */
import type { Document } from '../types';

export function dataUrlToUint8(dataUrl: string): Uint8Array | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function mimeFromDataUrl(dataUrl: string): string | null {
  const m = /^data:([^;,]+)/.exec(dataUrl);
  return m ? m[1] : null;
}

function toBase64Utf8(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

/** Stub PL gdy w vault brak bajtów (seed UPLOADED bez dataUrl). */
export function stubDataUrlForDoc(doc: Document): string {
  const text = [
    'WATCH TOWER — dokument (metadane)',
    `id: ${doc.id}`,
    `ładunek: ${doc.loadId}`,
    `kategoria: ${doc.category}`,
    `nazwa: ${doc.name}`,
    `wgrano: ${doc.uploadedAt ?? '—'}`,
    `status: ${doc.status}`,
    '',
    'Brak zapisanej zawartości pliku w vault.',
    'Wgraj plik ponownie, aby zobaczyć podgląd obrazu lub PDF.',
  ].join('\n');
  return `data:text/plain;charset=utf-8;base64,${toBase64Utf8(text)}`;
}

export function resolveDocDataUrl(doc: Document): string {
  if (doc.dataUrl && doc.dataUrl.startsWith('data:')) return doc.dataUrl;
  return stubDataUrlForDoc(doc);
}

export function isImageMime(mime: string | null | undefined, name?: string): boolean {
  if (mime && mime.startsWith('image/')) return true;
  const n = (name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp)$/.test(n);
}

export function isPdfMime(mime: string | null | undefined, name?: string): boolean {
  if (mime === 'application/pdf') return true;
  return /\.pdf$/i.test(name || '');
}

export function readFileAsDataUrl(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
  bytes: number;
  name: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('odczyt_pliku'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.startsWith('data:')) {
        reject(new Error('pusty_odczyt'));
        return;
      }
      resolve({
        dataUrl,
        mimeType: file.type || mimeFromDataUrl(dataUrl) || 'application/octet-stream',
        bytes: file.size,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadDocumentFile(doc: Document): { ok: boolean; filename: string } {
  const dataUrl = resolveDocDataUrl(doc);
  const bytes = dataUrlToUint8(dataUrl);
  const mime = mimeFromDataUrl(dataUrl) || doc.mimeType || 'application/octet-stream';
  const safeName = (doc.name || `${doc.category}.bin`).replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/gi, '_');
  if (!bytes) return { ok: false, filename: safeName };
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  triggerBlobDownload(new Blob([copy], { type: mime }), safeName);
  return { ok: true, filename: safeName };
}

export function objectUrlFromDoc(doc: Document): { url: string; mime: string; revoke: () => void } {
  const dataUrl = resolveDocDataUrl(doc);
  const mime = mimeFromDataUrl(dataUrl) || doc.mimeType || 'application/octet-stream';
  const bytes = dataUrlToUint8(dataUrl);
  if (bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const url = URL.createObjectURL(new Blob([copy], { type: mime }));
    return { url, mime, revoke: () => URL.revokeObjectURL(url) };
  }
  return { url: dataUrl, mime, revoke: () => undefined };
}
