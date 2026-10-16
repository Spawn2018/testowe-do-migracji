/**
 * I-24 (SCOPE 10.8) — eksport harmonogramu do PDF (obok XLSX). pdf-lib + fontkit, czcionka Liberation Sans
 * (SIL OFL 1.1, `public/fonts/`) ładowana dopiero przy eksporcie — pełne polskie i szwedzkie znaki.
 * PDF jest do przekazania dalej, więc NIE zawiera danych osobowych kierowcy (imię, telefon) ani kwot.
 * A4 poziomo, nagłówek na każdej stronie, stopka „wygenerowano … · strona n/N”.
 * 10.8 (28.09): nagłówki, status, tytuł i stopka w języku interfejsu (PL/EN/SV, słownik jak w widoku);
 * czasy wg D8 (`src/lib/time.ts`): załadunek Europe/Warsaw, dostawa i ETA Boden Europe/Stockholm,
 * stopka w Europe/Warsaw z nazwą strefy — bez wycinania fragmentów ISO (dawniej ETA w UTC bez oznaczenia).
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Load, Locale } from '../types';
import { t, tp } from '../i18n/messages';
import { statusLabel } from './statusLabel';
import { formatEtaBoden, formatLoadPl, formatOpsDateTime, formatUnloadSe, TZ_OPS } from './time';

export interface PdfColumn { label: string; width: number; value: (l: Load) => string }

const dash = (s: string) => (s === '—' ? '' : s);

export function pdfColumns(locale: Locale = 'pl'): PdfColumn[] {
  return [
    { label: t(locale, 'i24_pdf_col_code'), width: 92, value: (l) => l.code },
    { label: t(locale, 'i24_pdf_col_type'), width: 110, value: (l) => l.itemType ?? '' },
    { label: t(locale, 'i24_pdf_col_status'), width: 92, value: (l) => statusLabel(l.status, l.stage, locale) },
    { label: t(locale, 'i24_pdf_col_load'), width: 70, value: (l) => dash(formatLoadPl(l.plannedLoadDate)) },
    { label: t(locale, 'i24_pdf_col_deliver'), width: 70, value: (l) => dash(formatUnloadSe(l.plannedDeliverDate)) },
    { label: t(locale, 'i24_pdf_col_eta'), width: 100, value: (l) => (l.etaPreLoad ? '–' : dash(formatEtaBoden(l.etaBoden))) },
    { label: t(locale, 'i24_pdf_col_tractor'), width: 70, value: (l) => l.resources.tractorPlate ?? '' },
    { label: t(locale, 'i24_pdf_col_trailer'), width: 70, value: (l) => l.resources.trailerPlate ?? '' },
    { label: t(locale, 'i24_pdf_col_driver'), width: 110, value: (l) => {
      const one = (n?: string | null, p?: string | null) => `${n ?? ''} ${p ?? ''}`.trim();
      const a = one(l.resources.driverName, l.resources.driverPhone);
      /* wyglad/E6-tel: przy przepięciu naczepy oba odcinki „PL / SE”, jak w pliku KSH (E38) */
      if (l.resources.trailerSwap) {
        const b = one(l.resources.driverDeliveryName, l.resources.driverDeliveryPhone);
        return a || b ? `${a || '–'} / ${b || '–'}` : '';
      }
      return a;
    } },
  ];
}

/** Kolumny w języku polskim (zgodność wstecz, test kolumn). */
export const PDF_COLUMNS: PdfColumn[] = pdfColumns('pl');

const PAGE_W = 841.89; const PAGE_H = 595.28; const M = 28; const ROW_H = 15; const FS = 8;

function fit(text: string, font: PDFFont, size: number, max: number): string {
  if (font.widthOfTextAtSize(text, size) <= max) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > max) t = t.slice(0, -1);
  return t + '…';
}

/** Buduje PDF (bajty). `fontBytes` = TTF z pełnym zestawem znaków (w aplikacji: /fonts/LiberationSans-Regular.ttf). */
export async function buildLoadsPdf(loads: Load[], fontBytes: ArrayBuffer | Uint8Array, opts: { title: string; generatedAt?: Date; locale?: Locale }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  doc.setTitle(opts.title); doc.setCreator('Watch Tower'); doc.setProducer('Watch Tower');
  const at = opts.generatedAt ?? new Date();
  const locale = opts.locale ?? 'pl';
  const cols = pdfColumns(locale);
  const perPage = Math.floor((PAGE_H - 2 * M - 40) / ROW_H);
  const pages: PDFPage[] = [];
  const header = (p: PDFPage) => {
    p.drawText(opts.title, { x: M, y: PAGE_H - M - 12, size: 12, font });
    let x = M; const y = PAGE_H - M - 34;
    p.drawRectangle({ x: M - 2, y: y - 4, width: PAGE_W - 2 * M + 4, height: ROW_H, color: rgb(0.9, 0.92, 0.95) });
    for (const c of cols) { p.drawText(fit(c.label, font, FS, c.width - 4), { x, y, size: FS, font }); x += c.width; }
    return y - ROW_H;
  };
  for (let i = 0; i < Math.max(1, loads.length); i += perPage) {
    const p = doc.addPage([PAGE_W, PAGE_H]); pages.push(p);
    let y = header(p);
    for (const l of loads.slice(i, i + perPage)) {
      let x = M;
      for (const c of cols) { p.drawText(fit(String(c.value(l) ?? ''), font, FS, c.width - 4), { x, y, size: FS, font }); x += c.width; }
      p.drawLine({ start: { x: M - 2, y: y - 4 }, end: { x: PAGE_W - M + 2, y: y - 4 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
      y -= ROW_H;
    }
  }
  const stamp = formatOpsDateTime(at.toISOString());
  pages.forEach((p, idx) => {
    const footer = tp(locale, 'i24_pdf_footer', { at: stamp, tz: TZ_OPS, n: String(loads.length), p: String(idx + 1), pages: String(pages.length) });
    p.drawText(footer, { x: M, y: M - 10, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  });
  return doc.save();
}

/** Eksport w przeglądarce: pobiera czcionkę, buduje PDF i uruchamia pobieranie pliku. */
export async function exportLoadsPdf(loads: Load[], filename: string, title: string, locale: Locale = 'pl'): Promise<{ rows: number; bytes: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL ?? '/'}fonts/LiberationSans-Regular.ttf`);
  if (!res.ok) throw new Error(`czcionka PDF: HTTP ${res.status}`);
  const bytes = await buildLoadsPdf(loads, await res.arrayBuffer(), { title, locale });
  const ab = new ArrayBuffer(bytes.byteLength); new Uint8Array(ab).set(bytes);
  const url = URL.createObjectURL(new Blob([ab], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  window.setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
  return { rows: loads.length, bytes: bytes.byteLength };
}

/** H-7 — opcjonalna strona z mapą (PNG z Edge map-static) na końcu PDF. */
export async function appendMapPage(pdfBytes: Uint8Array, mapPng: Uint8Array, caption = 'Mapa pozycji', fontBytes?: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const img = await doc.embedPng(mapPng);
  const maxW = PAGE_W - 2 * M;
  const maxH = PAGE_H - 2 * M - 24;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  let font: PDFFont | undefined;
  if (fontBytes) {
    font = await doc.embedFont(fontBytes, { subset: true });
  } else {
    // fallback: Helvetica (bez PL) — caller powinien podać Liberation
    const { StandardFonts } = await import('pdf-lib');
    font = await doc.embedFont(StandardFonts.Helvetica);
  }
  page.drawText(fit(caption, font, 11, maxW), { x: M, y: PAGE_H - M - 12, size: 11, font });
  page.drawImage(img, { x: M, y: PAGE_H - M - 20 - h, width: w, height: h });
  return doc.save();
}

/** H-7 — PDF jednego transportu + opcjonalna mapa (GPS → Edge map-static). */
export async function exportLoadPdfWithMap(
  load: Load,
  locale: Locale = 'pl',
  events: import('../types').LoadEvent[] = [],
  nowIso: string = new Date().toISOString(),
): Promise<{ rows: number; bytes: number; mapAttached: boolean; mapSkipReason?: string }> {
  const res = await fetch(`${import.meta.env.BASE_URL ?? '/'}fonts/LiberationSans-Regular.ttf`);
  if (!res.ok) throw new Error(`czcionka PDF: HTTP ${res.status}`);
  const title = tp(locale, 'h7_pdf_title', { code: load.code });
  const fontBuf = await res.arrayBuffer();
  let bytes = await buildLoadsPdf([load], fontBuf, { title, locale });
  /* B9 / E27 pkt 5: stan śledzenia jak w panelu */
  try {
    const { trackingStateOneLine } = await import('./trackingStateText');
    const line = trackingStateOneLine(load, events, locale, nowIso);
    if (line) {
      const doc = await PDFDocument.load(bytes);
      doc.registerFontkit(fontkit);
      const font = await doc.embedFont(fontBuf, { subset: true });
      const page = doc.getPages()[0];
      if (page) {
        page.drawText(fit(line, font, 8, PAGE_W - 2 * M), {
          x: M, y: PAGE_H - M - 22, size: 8, font, color: rgb(0.25, 0.25, 0.25),
        });
      }
      bytes = await doc.save();
    }
  } catch { /* bez linii śledzenia — tabela i tak jest */ }
  let mapAttached = false;
  let mapSkipReason: string | undefined;

  // Mapa tylko w buildzie supabase — dynamiczny import poza paczką demo (I-2).
  if (import.meta.env.VITE_AUTH_MODE === 'supabase') {
    try {
      const { fetchLatestVehicleFixes } = await import('./vehiclePositions');
      const fixes = await fetchLatestVehicleFixes([load.id]);
      const fix = fixes[0];
      if (!fix) {
        mapSkipReason = 'no_gps';
      } else {
        const { fetchMapStaticPng } = await import('./h7MapPng');
        const got = await fetchMapStaticPng(fix.lat, fix.lng);
        if (!got.ok) {
          mapSkipReason = got.reason;
        } else {
          bytes = await appendMapPage(bytes, got.png, tp(locale, 'h7_pdf_map_caption', { code: load.code }), fontBuf);
          mapAttached = true;
        }
      }
    } catch {
      mapSkipReason = mapSkipReason ?? 'map_error';
    }
  } else {
    mapSkipReason = 'demo';
  }

  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const url = URL.createObjectURL(new Blob([ab], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `WATCH_TOWER_${load.code}.pdf`;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
  return { rows: 1, bytes: bytes.byteLength, mapAttached, mapSkipReason };
}
