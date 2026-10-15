/** C16 N3 — podpis HMAC potwierdzenia odbioru (sekret = VAPID_PRIVATE_KEY). */
export async function signPushAck(nid: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(nid));
  const bytes = new Uint8Array(mac);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function verifyPushAck(nid: string, ack: string, secret: string): Promise<boolean> {
  if (!nid || !ack || !secret) return false;
  const expected = await signPushAck(nid, secret);
  if (expected.length !== ack.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ ack.charCodeAt(i);
  }
  return diff === 0;
}
