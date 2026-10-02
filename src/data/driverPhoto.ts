/** Zdjęcie / skan → funkcja Edge `driver-photo` (multipart). */
export async function uploadDriverFile(
  baseUrl: string, anonKey: string, token: string, loadId: string, category: 'CMR' | 'POD' | 'LASHING_PHOTO', file: Blob, name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const form = new FormData();
  form.set('token', token);
  form.set('load_id', loadId);
  form.set('category', category);
  form.set('file', file, name);
  const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/functions/v1/driver-photo`, {
    method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !body.id) throw new Error(body.error ?? `Wysyłka pliku: ${res.status}`);
  return { id: body.id };
}
