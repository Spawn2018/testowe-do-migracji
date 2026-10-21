/**
 * BK3 — rejestr zapisu zdalnego. Jedyny fragment warstwy danych w paczce demo:
 * bez zarejestrowanego odbiorcy `writeThrough` nic nie robi (DemoProvider).
 * SupabaseProvider rejestruje odbiorcę po zalogowaniu (chunk ładowany leniwie).
 */
import type { DataMutation } from './provider';
import type { DocCategory, Document } from '../types';
import { dbPreviewOn, isPreviewReadOnly } from '../lib/prodFacade';

type Sink = (m: DataMutation) => void;
let sink: Sink | null = null;

/** Preferencje i odczyt powiadomień to własne ustawienia admina — nie domena Podglądu. */
function isPersonalMutation(m: DataMutation): boolean {
  return m.type === 'prefs.save' || m.type === 'notifications.read';
}

export function registerRemoteSink(s: Sink | null): void {
  sink = s;
}

export const hasRemoteSink = (): boolean => sink !== null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Id z serwera (uuid). Id demo (load-001, gf-01, …) nigdy nie trafiają na serwer. */
export const isServerId = (id: string | undefined | null): boolean => Boolean(id && UUID.test(id));

function targetId(m: DataMutation): string | null {
  switch (m.type) {
    case 'event.append': return m.event.loadId;
    case 'geofence.save': return null; // nowa strefa ma id lokalne — wstawienie
    case 'geofence.delete': return m.id;
    case 'prefs.save': return null; // ustawienia bieżącego użytkownika (bez id encji)
    case 'bill.register': return m.bill.lines[0]?.loadId ?? ''; // pozycje = transporty z serwera
    case 'bill.verify': case 'bill.paid': case 'bill.unpaid': case 'bill.update': return m.billId;
    case 'notifications.read': return null; // własne powiadomienia (id liczbowe z serwera)
    case 'sailing.save': return m.isNew ? null : m.sailing.id; // nowy rejs = wstawienie; zmiana tylko rejsu z serwera
    case 'loads.importCancel': return m.loadIds.every(isServerId) ? m.loadIds[0] ?? '' : ''; // tylko transporty z serwera
    case 'workflow.create': return null; // 9.4 — nowa reguła (id nadaje baza)
    case 'workflow.update': return m.id; // tylko reguły z serwera (demo wf-1… nigdy)
    case 'workflow.delete': return m.id; // B-5 — usunięcie tylko reguły z serwera
    default: return m.loadId;
  }
}

/** Przekaż zapis do serwera (tylko tryb Supabase i tylko encje z id serwera). */
export function writeThrough(m: DataMutation): void {
  if (!sink) return;
  // E9-7 / G-07: Podgląd KSH/SCX — bez zapisu domeny (UI + ten strażnik).
  if (!isPersonalMutation(m) && isPreviewReadOnly()) return;
  /* B5 (0249): w Podglądzie z bazy „własne” to konto oglądane (current_app_user_id) — nic nie zapisujemy,
     także przeczytania powiadomień i ustawień (F7 #383 B1). */
  if (dbPreviewOn()) return;
  const id = targetId(m);
  if (id !== null && !isServerId(id)) return;
  sink(m);
}

// ---- BK4: pliki (Supabase Storage) -----------------------------------------

/** Ważność linku podpisanego do pliku: 15 minut (ZLECENIE BK4). */
export const SIGNED_URL_TTL_S = 900;

export interface FileUploadInput {
  loadId: string;
  category: DocCategory;
  file: Blob;
  name: string;
  mimeType: string;
  /** III-6: id poprzedniej wersji (ten sam transport i kategoria) → document_supersede po wgraniu. */
  supersedes?: string;
}

/** Odbiorca plików — rejestrowany wyłącznie w trybie Supabase (chunk leniwy). */
export interface FileSink {
  upload(input: FileUploadInput): Promise<Document>;
  /** Link podpisany (15 min); `download` = nazwa pliku do pobrania. */
  signedUrl(doc: Document, opts?: { download?: string }): Promise<string>;
}

let fileSink: FileSink | null = null;
export function registerFileSink(s: FileSink | null): void {
  fileSink = s;
}
export const getFileSink = (): FileSink | null => fileSink;

/** D-20261018-1215-01: po wgraniu pliku odśwież panel. Ustawiane tylko w moście Supabase. */
let afterFileUpload: (() => Promise<void>) | null = null;
export function registerAfterFileUpload(fn: (() => Promise<void>) | null): void {
  afterFileUpload = fn;
}
export function notifyFileUploaded(): Promise<void> {
  return afterFileUpload ? afterFileUpload() : Promise.resolve();
}
/** Dokument z pliku w Storage (bajty nie w przeglądarce — tylko link podpisany). */
export const isStoredDoc = (d: Pick<Document, 'storagePath'>): boolean => Boolean(d.storagePath);
