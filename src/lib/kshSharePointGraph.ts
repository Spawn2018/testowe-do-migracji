/**
 * A6 — czyste helpery Graph (testy unit; Edge ma kopię w `_shared/ksh/graph.ts`).
 * Bez sekretów i bez prawdziwych URL w asercjach.
 */

/** Kodowanie sharing URL → Graph shareId (`u!…`), jak w dokumentacji Microsoft. */
export function shareUrlToShareId(fileUrl: string): string {
  const bytes = new TextEncoder().encode(fileUrl);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `u!${b64}`;
}

export function pickSharePointMode(fileMode: string | undefined): 'test' | 'prod' {
  return (fileMode || '').toLowerCase() === 'test' ? 'test' : 'prod';
}
