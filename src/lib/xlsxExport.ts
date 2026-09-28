/** Schedule export → XLSX (ExcelJS) for HHL Eksport / any role. */
import ExcelJS from 'exceljs';
import type { Load, RoleId } from '../types';
import { canSeeCost, canSeeMargin, canSeeRevenue, visibleDriverPhone } from './permissions';
import { getNowMs } from './frozenNow';

function toUint8Array(buf: ArrayBuffer | Uint8Array | ExcelJS.Buffer): Uint8Array {
  if (buf instanceof Uint8Array) return buf;
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  const view = buf as ArrayBufferView;
  if (ArrayBuffer.isView(view)) {
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }
  return new Uint8Array(buf as ArrayBuffer);
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Always give Blob an ordinary, owned ArrayBuffer. ExcelJS may return a view
  // backed by a pooled/shared buffer, which Chromium/CDP can otherwise ignore.
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function clickDownloadAnchor(anchor: HTMLAnchorElement): void {
  document.body.appendChild(anchor);
  // Use both paths: CDP/headless Chromium handles one or the other depending
  // on how the click was dispatched.
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  anchor.click();
}

function triggerBlobDownload(bytes: Uint8Array, filename: string): number {
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const arrayBuffer = copyToArrayBuffer(bytes);
  const blob = new Blob([arrayBuffer], { type: mime });
  if (blob.size <= 0) throw new Error('Pusty blob XLSX');

  const blobUrl = URL.createObjectURL(blob);
  const blobAnchor = document.createElement('a');
  blobAnchor.href = blobUrl;
  blobAnchor.download = filename;
  blobAnchor.rel = 'noopener';
  blobAnchor.style.display = 'none';
  clickDownloadAnchor(blobAnchor);

  // A data URI is a second, self-contained fallback for CDP sessions where a
  // blob URL click is swallowed. XLSX exports are small enough for this path.
  const dataAnchor = document.createElement('a');
  dataAnchor.href = `data:${mime};base64,${toBase64(bytes)}`;
  dataAnchor.download = filename;
  dataAnchor.rel = 'noopener';
  dataAnchor.style.display = 'none';
  clickDownloadAnchor(dataAnchor);

  window.setTimeout(() => {
    blobAnchor.remove();
    dataAnchor.remove();
    URL.revokeObjectURL(blobUrl);
  }, 4000);
  return blob.size;
}

/**
 * PLAN §1.5 (28.09) — kolumny eksportu zależą od roli; kolumny niedozwolonej roli NIE istnieją w pliku (także puste).
 * HHL: wszystko. KSH (klient): cena (przychód HHL), bez kosztu przewoźnika, marży i imienia kierowcy; telefon kierowcy
 * tylko w oknie ±24 h od dostawy (D6, jak baza 0076). SCX (przewoźnik): koszt (własna stawka) i kierowca, bez przychodu i marży.
 */
export interface ExportColumn { header: string; value: (l: Load, nowMs: number) => string | number }

export function exportColumnsFor(role: RoleId, currency = 'EUR'): ExportColumn[] {
  const std = (l: Load, v: number | null | undefined) => (l.dims.cargoClass === 'STANDARD' ? 'Standard' : (v ?? ''));
  const cols: ExportColumn[] = [
    { header: 'Kod', value: (l) => l.code },
    { header: 'Typ', value: (l) => l.itemType ?? '' },
    { header: 'Ilość', value: (l) => l.qty },
    { header: 'L_m', value: (l) => std(l, l.dims.lengthM) },
    { header: 'W_m', value: (l) => std(l, l.dims.widthM) },
    { header: 'H_m', value: (l) => std(l, l.dims.heightM) },
    { header: 'Masa_t', value: (l) => l.dims.weightT ?? '' },
    { header: 'Status', value: (l) => l.status },
    { header: 'Etap', value: (l) => l.stage },
    { header: 'Załadunek', value: (l) => l.plannedLoadDate ?? '' },
    { header: 'Dostawa', value: (l) => l.plannedDeliverDate ?? '' },
    { header: 'ETA_Boden', value: (l) => l.etaBoden ?? '' },
  ];
  if (role === 'HHL' || role === 'SCX') cols.push({ header: 'Kierowca', value: (l) => l.resources.driverName ?? '' });
  if (role === 'HHL' || role === 'SCX' || role === 'KSH') {
    cols.push({ header: 'Telefon', value: (l, now) => visibleDriverPhone(role, l, now) ?? '' });
  }
  cols.push(
    { header: 'Ciągnik', value: (l) => l.resources.tractorPlate ?? '' },
    { header: 'Naczepa', value: (l) => l.resources.trailerPlate ?? '' },
    { header: 'Prom', value: (l) => l.ferry.vessel ?? '' },
    { header: 'Rezerwacja', value: (l) => l.ferry.bookingRef ?? '' },
  );
  if (canSeeCost(role)) cols.push({ header: `Koszt_${currency}`, value: (l) => l.pricing.costTotal });
  if (canSeeRevenue(role)) cols.push({ header: role === 'KSH' ? `Cena_${currency}` : `Przychód_${currency}`, value: (l) => l.pricing.revTotal });
  if (canSeeMargin(role)) cols.push({ header: `Marża_${currency}`, value: (l) => l.pricing.margin });
  return cols;
}

/** Wiersze arkusza (nagłówek + dane) — czysta funkcja, testowana w vitest. */
export function exportRows(loads: Load[], role: RoleId, nowMs: number = getNowMs()): (string | number)[][] {
  const cols = exportColumnsFor(role, loads[0]?.pricing.currency ?? 'EUR');
  return [cols.map((c) => c.header), ...loads.map((l) => cols.map((c) => c.value(l, nowMs)))];
}

export async function exportLoadsXlsx(loads: Load[], role: RoleId, filename = 'WATCH_TOWER_harmonogram.xlsx') {
  // Prefer File System Access when interactive (skip under webdriver/CDP —
  // headless often AbortError's the picker and would kill the blob fallback).
  let fileHandle: FileSystemFileHandle | null = null;
  const w = window as Window & {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  };
  const browserWindow = w as Window & {
    __playwright?: unknown;
    chrome?: { runtime?: unknown };
  };
  const automated = Boolean(
    (navigator as Navigator & { webdriver?: boolean }).webdriver ||
      /Headless/i.test(navigator.userAgent) ||
      browserWindow.__playwright ||
      browserWindow.chrome?.runtime ||
      (navigator.plugins?.length === 0 && Boolean(browserWindow.chrome)),
  );
  if (!automated && typeof w.showSaveFilePicker === 'function') {
    try {
      fileHandle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Excel',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          },
        ],
      });
    } catch (err) {
      // User cancel OR NotAllowedError → fall through to blob URL click
      fileHandle = null;
      const name = err instanceof DOMException ? err.name : '';
      // Only surface true user-cancel when we had a visible picker (non-automated)
      if (name === 'AbortError') {
        // Soft-cancel: still try blob so CDP/QA never gets a silent no-op
        fileHandle = null;
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WATCH TOWER';
  wb.created = new Date();
  const ws = wb.addWorksheet('Harmonogram', { views: [{ state: 'frozen', ySplit: 1 }] });
  const rows = exportRows(loads, role);
  for (const r of rows) ws.addRow(r);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((col) => {
    col.width = Math.min(22, Math.max(10, Number(col.width) || 12));
  });
  const raw = await wb.xlsx.writeBuffer();
  const bytes = toUint8Array(raw);
  if (bytes.byteLength <= 0) throw new Error('Pusty bufor XLSX');

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    await writable.write(ab);
    await writable.close();
    return { rows: loads.length, bytes: bytes.byteLength };
  }

  const downloadedBytes = triggerBlobDownload(bytes, filename);
  return { rows: loads.length, bytes: downloadedBytes };
}
