/**
 * BK4 — pliki w Supabase Storage (tylko tryb Supabase, chunk leniwy).
 * Przepływ wgrania: RPC `create_document` (serwer nadaje id i ścieżkę, RLS
 * sprawdza transport) → upload do prywatnego koszyka pod tę ścieżkę (polityka
 * Storage wpuszcza tylko autora rejestracji) → przy błędzie `discard_document`.
 * Odczyt: link podpisany ważny 15 minut — Storage wystawi go tylko, gdy
 * użytkownik widzi wiersz `documents` (RLS 0001 + 0009).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document } from '../types';
import { DOC_CAT_TO_DB } from './mappers';
import { SIGNED_URL_TTL_S, type FileSink, type FileUploadInput } from './registry';
import { safeStorageTarget } from './storagePath';

interface CreatedDoc { id: string; bucket: string; object_path: string; storage_path: string }

/** `<koszyk>/<ścieżka obiektu>` → [koszyk, ścieżka]. */
export function splitStoragePath(p: string): [string, string] {
  const i = p.indexOf('/');
  if (i <= 0) throw new Error('Nieprawidłowa ścieżka pliku');
  return [p.slice(0, i), p.slice(i + 1)];
}

export function createStorageSink(sb: SupabaseClient, now: () => string = () => new Date().toISOString()): FileSink {
  async function upload(input: FileUploadInput): Promise<Document> {
    const { data, error } = await sb.rpc('create_document', {
      p_load_id: input.loadId, p_category: DOC_CAT_TO_DB[input.category], p_file_name: input.name,
      p_mime: input.mimeType, p_size: input.file.size,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as CreatedDoc | undefined;
    if (!row) throw new Error('Brak rejestracji dokumentu');
    const stored = safeStorageTarget(row.bucket, row.object_path);
    const objectPath = stored.objectPath.replace(/\.\.\//g, '');
    const up = await sb.storage.from(stored.bucket).upload(objectPath, input.file, {
      contentType: input.mimeType, upsert: false,
    });
    if (up.error) {
      await sb.rpc('discard_document', { p_id: row.id });
      throw new Error(up.error.message);
    }
    let version = 1;
    let versionError: string | undefined;
    if (input.supersedes) {
      const v = await sb.rpc('document_supersede', { p_new: row.id, p_old: input.supersedes });
      if (v.error) versionError = v.error.message;
      else version = Number(v.data) || 1;
    }
    return {
      version, ...(versionError ? { versionError } : {}),
      id: row.id, loadId: input.loadId, category: input.category, name: input.name, uploadedAt: now(),
      deadline: null, status: 'UPLOADED', permitFits: null, visibleTo: ['HHL', 'KSH', 'SCX'],
      dataUrl: null, mimeType: input.mimeType, bytes: input.file.size, source: 'tower',
      storagePath: row.storage_path,
    };
  }

  async function signedUrl(doc: Document, opts?: { download?: string }): Promise<string> {
    if (!doc.storagePath) throw new Error('Dokument bez pliku w magazynie');
    const [bucketName, rawPath] = splitStoragePath(doc.storagePath);
    const stored = safeStorageTarget(bucketName, rawPath);
    const path = stored.objectPath.replace(/\.\.\//g, '');
    const { data, error } = await sb.storage.from(stored.bucket).createSignedUrl(
      path, SIGNED_URL_TTL_S, opts?.download ? { download: opts.download } : undefined,
    );
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Brak linku');
    return data.signedUrl;
  }

  return { upload, signedUrl };
}
