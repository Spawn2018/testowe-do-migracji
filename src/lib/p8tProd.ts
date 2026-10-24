/**
 * #412 E43 (baza 0289) — „Treści wiadomości” na produkcji: `message_texts_list` (HHL), `message_texts_set` /
 * `message_texts_reset` (tylko Administrator HHL; baza sprawdza limit SMS 160 znaków alfabetem GSM z najgorszą długością
 * znaczników, dozwolone znaczniki dla rodzaju, `{{button}}` w e-mailach logowania, temat). Odmowa bazy → jej komunikat.
 * Próbnej wysyłki w produkcji nie ma (przycisk ukryty).
 */
import { getSupabase } from '../auth/client';
import type { MessageTextsSource, SavedText } from './p8Source';

/** Wiersz z bazy → zapisana treść; zły kształt → null. */
export function savedFromDb(raw: unknown): SavedText | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.body !== 'string') return null;
  return {
    id: o.id,
    subject: typeof o.subject === 'string' ? o.subject : null,
    body: o.body,
    at: typeof o.at === 'string' ? o.at : '',
    who: typeof o.who === 'string' && o.who ? o.who : '—',
  };
}

/* komunikaty bazy (walidacja 22023, uprawnienia 42501, brak konta P0002) są po polsku; inne (sieć, sesja) — ogólny komunikat ekranu */
const dbMsg = (e: { code?: string; message: string }) => (e.code === '22023' || e.code === '42501' || e.code === 'P0002' ? e.message : undefined);

export function messageTextsProd(): MessageTextsSource {
  return {
    saved: async () => {
      const sb = await getSupabase();
      const r = await sb.rpc('message_texts_list');
      if (r.error) throw new Error(r.error.message);
      return (Array.isArray(r.data) ? r.data : []).map(savedFromDb).filter((x): x is SavedText => x !== null);
    },
    save: async (id, subject, body) => {
      try {
        const sb = await getSupabase();
        const r = await sb.rpc('message_texts_set', { p_kind: id, p_subject: subject, p_body: body });
        if (r.error) return { ok: false, error: dbMsg(r.error) };
        const row = savedFromDb(r.data);
        return row ? { ok: true, row } : { ok: false };
      } catch {
        return { ok: false };
      }
    },
    reset: async (id) => {
      try {
        const sb = await getSupabase();
        const r = await sb.rpc('message_texts_reset', { p_kind: id });
        if (r.error) return { ok: false, error: dbMsg(r.error) };
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    sendTest: null,
    previewCode: null,
    prod: true,
  };
}
