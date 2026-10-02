/**
 * ANEKS 3 §2.3 + ANEKS 4 PR6/PR7 — zdjęcia i skany kierowcy (bez logowania, na tokenie).
 * POST multipart/form-data: token, load_id, category (CMR | POD | LASHING_PHOTO), file.
 * Token sprawdza baza (driver_create_document → driver_token_load: skrót, transport, ważność,
 * odwołanie, limit zapytań). Zdjęcie przychodzi już skompresowane w przeglądarce (1600 px, JPEG 0,75);
 * PDF do 10 MB. 3.2c: serwer sprawdza sygnaturę (JPEG/PNG/PDF) i limit zdjęcia 1 MB. Klucz service_role wyłącznie w sekretach funkcji (SUPABASE_SERVICE_ROLE_KEY — platforma).
 * Wdrożenie: `supabase functions deploy driver-photo --no-verify-jwt` (kierowca nie ma sesji) —
 * czeka na token dostępu właściciela (ANEKS 3 §4.4).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkDriverFile } from '../_shared/fileSignature.ts';

const MAX_BYTES = 10 * 1024 * 1024; // twardy limit przed odczytem nagłówka
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Metoda niedozwolona' });
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service) return json(500, { error: 'Brak konfiguracji funkcji' });
  let form: FormData;
  try { form = await req.formData(); } catch { return json(400, { error: 'Oczekiwano formularza z plikiem' }); }
  const token = String(form.get('token') ?? '');
  const loadId = String(form.get('load_id') ?? '');
  const category = String(form.get('category') ?? '');
  const file = form.get('file');
  if (!token || !loadId || !(file instanceof File)) return json(400, { error: 'Brak tokenu, transportu albo pliku' });
  if (file.size > MAX_BYTES) return json(413, { error: 'Plik większy niż 10 MB — zmniejsz go albo zrób zdjęcie ponownie' });
  const check = checkDriverFile(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.size, file.type);
  if (!check.ok) return json(check.status, { error: check.error });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, service, { auth: { persistSession: false } });
  const reg = await sb.rpc('driver_create_document', {
    p_token: token, p_load_id: loadId, p_category: category,
    p_file_name: file.name || 'zdjecie.jpg', p_mime: check.mime, p_size: file.size,
  });
  const row = (Array.isArray(reg.data) ? reg.data[0] : reg.data) as { id: string; bucket: string; object_path: string } | null;
  if (reg.error || !row) return json(403, { error: reg.error?.message ?? 'Odrzucono' });
  if (row.object_path.includes('..') || row.bucket.includes('..')) return json(400, { error: 'Niedozwolona ścieżka pliku' });
  const objectPath = row.object_path.replace(/\.\.\//g, '');
  const up = await sb.storage.from(row.bucket).upload(objectPath, file, { contentType: check.mime, upsert: false });
  if (up.error) {
    await sb.from('documents').delete().eq('id', row.id);
    return json(500, { error: `Zapis pliku: ${up.error.message}` });
  }
  return json(200, { id: row.id });
});
