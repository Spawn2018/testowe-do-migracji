/** Build a real ZIP of document vault entries (JSZip) and trigger download. */
import type { Document } from '../types';
import { getFileSink, isStoredDoc } from '../data/registry';

function dataUrlToUint8(dataUrl: string): Uint8Array | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function triggerDownload(blob: Blob, filename: string) {
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

export async function downloadDocumentsZip(
  docs: Document[],
  filename: string,
  codeOf?: (loadId: string) => string,
): Promise<{ count: number; skipped: number }> {
  // D15: JSZip ładowany dopiero przy pobieraniu paczki.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  let count = 0;
  let skipped = 0;
  const folder = zip.folder('documents') ?? zip;
  for (const d of docs) {
    if (d.status !== 'UPLOADED') {
      skipped += 1;
      continue;
    }
    const safeCat = d.category.replace(/[^\w.-]+/g, '_');
    const safeName = (d.name || `${safeCat}.bin`).replace(/[^\w.\-]+/g, '_');
    const code = d.loadId ? codeOf?.(d.loadId) : undefined;
    const path = code
      ? `${code}/${code}_${safeCat}_${safeName}`
      : `${d.loadId || 'unknown'}/${safeCat}_${safeName}`;
    // BK4: plik w Storage — pobranie linkiem podpisanym (15 min), RLS decyduje o dostępie.
    const sink = getFileSink();
    if (sink && isStoredDoc(d)) {
      try {
        const res = await fetch(await sink.signedUrl(d));
        if (res.ok) {
          folder.file(path, new Uint8Array(await res.arrayBuffer()));
          count += 1;
          continue;
        }
      } catch {
        /* brak dostępu / sieć → stub poniżej */
      }
    }
    if (d.dataUrl) {
      const bytes = dataUrlToUint8(d.dataUrl);
      if (bytes) {
        folder.file(path, bytes);
        count += 1;
        continue;
      }
    }
    // Placeholder text so ZIP is never empty for UPLOADED without vault bytes
    const stub = [
      `WATCH TOWER document stub`,
      `id: ${d.id}`,
      `loadId: ${d.loadId}`,
      `category: ${d.category}`,
      `name: ${d.name}`,
      `uploadedAt: ${d.uploadedAt ?? ''}`,
      `status: ${d.status}`,
      `note: brak dataUrl w vault — metadane tylko`,
    ].join('\n');
    folder.file(path.replace(/\.[^.]+$/, '') + '.txt', stub);
    count += 1;
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, filename);
  return { count, skipped };
}
