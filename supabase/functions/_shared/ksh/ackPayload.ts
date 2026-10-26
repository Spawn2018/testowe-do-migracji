/**
 * A6 F7 r4 — budowa payloadu ack(id, rev, sent) dla ksh_sync_outbound_ack.
 * Osobny plik (bez npm:) — unit vitest.
 */

export type AckPayloadItem = {
  id: number;
  load_id?: string;
  code?: string;
  rev?: number;
  patch?: Record<string, unknown>;
};

export type AckRpcItem = {
  id: number;
  rev: number;
  sent?: Record<string, unknown>;
};

export function ackPayload(
  items: AckPayloadItem[],
  withSent: boolean,
): AckRpcItem[] {
  return items.map((it) => ({
    id: Number(it.id),
    rev: Number(it.rev ?? 1),
    ...(withSent ? { sent: { ...(it.patch ?? {}) } } : {}),
  }));
}
