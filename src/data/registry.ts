/**
 * BK3 — rejestr zapisu zdalnego. Jedyny fragment warstwy danych w paczce demo:
 * bez zarejestrowanego odbiorcy `writeThrough` nic nie robi (DemoProvider).
 * SupabaseProvider rejestruje odbiorcę po zalogowaniu (chunk ładowany leniwie).
 */
import type { DataMutation } from './provider';
import type { DocCategory, Document } from '../types';

type Sink = (m: DataMutation) => void;
let sink: Sink | null = null;

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
    case 'prefs.save': return null; // ustawienia bieżącego użytkownika (bez id encji)
    default: return m.loadId;
  }
}

/** Przekaż zapis do serwera (tylko tryb Supabase i tylko encje z id serwera). */
export function writeThrough(m: DataMutation): void {
  if (!sink) return;
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
/** Dokument z pliku w Storage (bajty nie w przeglądarce — tylko link podpisany). */
export const isStoredDoc = (d: Pick<Document, 'storagePath'>): boolean => Boolean(d.storagePath);
