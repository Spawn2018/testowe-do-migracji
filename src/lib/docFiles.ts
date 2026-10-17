/**
 * BK4 — wgrywanie i otwieranie plików dokumentów, niezależnie od trybu:
 *  - tryb Supabase (zarejestrowany FileSink, transport z id serwera): plik idzie
 *    do prywatnego koszyka Storage, otwierany linkiem podpisanym ważnym 15 min;
 *  - tryb demo: jak dotąd bajty w pamięci sesji (od BK4 bez zapisu w localStorage).
 * Moduł bez kodu Supabase — paczka demo pozostaje czysta.
 */
import type { DocCategory, Document } from '../types';
import { getFileSink, isServerId, isStoredDoc } from '../data/registry';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { readFileAsDataUrl } from './docsIo';
import { compressImage, isPdfTooBig } from './imageCompress';
import { formatPlNumber } from './format';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Czy wgranie trafi do Storage (tryb Supabase + transport z serwera). */
export const usesStorage = (loadId: string): boolean => Boolean(getFileSink()) && isServerId(loadId);

/**
 * Wgraj plik jako dokument transportu. `driverToken` = ścieżka aplikacji kierowcy.
 * Zwraca `true`, gdy dokument zapisano (Storage albo pamięć demo).
 */
export async function attachDocumentFile(
  file: File,
  loadId: string,
  category: DocCategory,
  opts: { driverToken?: string; fallbackName?: string } = {},
): Promise<boolean> {
  const st = useTowerStore.getState();
  // PR7: PDF ≤ 10 MB (komunikat zamiast nieudanego wgrania); zdjęcia kompresowane w przeglądarce.
  if (isPdfTooBig(file)) {
    st.pushToast(t(st.locale, 'pr7_pdf_too_big').replace('{mb}', formatPlNumber(file.size / 1048576, 1)), 'HIGH', loadId);
    return false;
  }
  file = await compressImage(file);
  const name = file.name || opts.fallbackName || `${category}.pdf`;
  const sink = getFileSink();
  if (sink && isServerId(loadId)) {
    try {
      // III-6: nowy plik tej samej kategorii transportu = nowa wersja (zdjęcia mocowania — wiele plików, bez wersji)
      const prev = category === 'LASHING_PHOTOS' ? undefined
        : st.documents.find((d) => d.loadId === loadId && d.category === category && isStoredDoc(d) && !d.superseded);
      const doc = await sink.upload({
        loadId, category, file, name, mimeType: file.type || 'application/octet-stream',
        ...(prev ? { supersedes: prev.id } : {}),
      });
      if (prev && doc.versionError) st.pushToast(t(st.locale, 'iii6_newver_fail').replace('{msg}', doc.versionError), 'HIGH', loadId);
      else if (prev && (doc.version ?? 1) > 1) st.pushToast(t(st.locale, 'iii6_newver').replace('{n}', String(doc.version)), 'MEDIUM', loadId);
      st.addStoredDocument(opts.driverToken ? { ...doc, source: 'driver' } : doc, opts.driverToken ? 'DRIVER' : undefined);
      return true;
    } catch (e) {
      st.pushToast(t(st.locale, 'bk4_file_failed').replace('{msg}', errMsg(e)), 'HIGH', loadId);
      return false;
    }
  }
  let r: Awaited<ReturnType<typeof readFileAsDataUrl>>;
  try {
    r = await readFileAsDataUrl(file);
  } catch {
    st.pushToast('Nie udało się odczytać pliku', 'HIGH', loadId);
    return false;
  }
  if (opts.driverToken) {
    st.driverAttachDoc(opts.driverToken, {
      filename: file.name, bytes: file.size, dataUrl: r.dataUrl,
      mimeType: file.type || 'application/octet-stream', category: category === 'POD' ? 'POD' : 'CMR',
    });
  } else {
    st.uploadDocument(loadId, category, r.name || name, { dataUrl: r.dataUrl, mimeType: r.mimeType, bytes: r.bytes });
  }
  return true;
}

/** Link podpisany (15 min) do pliku w Storage; `null` gdy dokument nie jest w Storage. */
export async function storedDocUrl(doc: Document, download?: string): Promise<string | null> {
  const sink = getFileSink();
  if (!sink || !isStoredDoc(doc)) return null;
  return sink.signedUrl(doc, download ? { download } : undefined);
}

/** Pobierz plik z Storage (link podpisany z nazwą pliku). */
export async function downloadStoredDocument(doc: Document): Promise<boolean> {
  try {
    const url = await storedDocUrl(doc, doc.name || `${doc.category}.bin`);
    if (!url) return false;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (e) {
    const st = useTowerStore.getState();
    st.pushToast(t(st.locale, 'bk4_link_failed').replace('{msg}', errMsg(e)), 'HIGH', doc.loadId);
    return false;
  }
}
