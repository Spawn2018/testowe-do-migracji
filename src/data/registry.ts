/**
 * BK3 — rejestr zapisu zdalnego. Jedyny fragment warstwy danych w paczce demo:
 * bez zarejestrowanego odbiorcy `writeThrough` nic nie robi (DemoProvider).
 * SupabaseProvider rejestruje odbiorcę po zalogowaniu (chunk ładowany leniwie).
 */
import type { DataMutation } from './provider';

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
