// BK4: weryfikacja plików na hostowanym Supabase (Storage + RLS) — trzy konta testowe.
// Sesje: generate_link (bez wysyłki e-maili) → /auth/v1/verify. Service role WYŁĄCZNIE do
// sprzątania własnych plików testowych na końcu (obiekty + wiersze documents z tego przebiegu).
// Użycie: node scripts/storage/verify.mjs   (exit 1 przy jakiejkolwiek porażce)
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { loadEnvLocal, need, TEST_ACCOUNTS } from '../auth/env.mjs';

const env = loadEnvLocal();
need(env, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', ...TEST_ACCOUNTS.map((a) => a.key)]);
const base = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const ANON = env.VITE_SUPABASE_ANON_KEY, SR = env.SUPABASE_SERVICE_ROLE_KEY;
let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };
const opts = (token) => ({ auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket }, ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}) });

async function session(email) {
  const h = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };
  const g = await fetch(`${base}/auth/v1/admin/generate_link`, { method: 'POST', headers: h, body: JSON.stringify({ type: 'magiclink', email }) });
  const gb = await g.json();
  const token_hash = gb.hashed_token ?? gb.properties?.hashed_token;
  const v = await fetch(`${base}/auth/v1/verify`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash }) });
  const vb = await v.json();
  if (!vb.access_token) throw new Error(`verify HTTP ${v.status}`);
  return vb.access_token;
}

const sb = {};
for (const a of TEST_ACCOUNTS) sb[a.org] = createClient(base, ANON, opts(await session(env[a.key].toLowerCase())));
const anon = createClient(base, ANON, opts());
const admin = createClient(base, SR, opts());

const { data: loads } = await sb.HHL.from('loads').select('id,order_no,carrier_org_id,project_id,shipment_items(shipment_code)');
const code = (l) => l.shipment_items?.[0]?.shipment_code ?? l.order_no;
const A = loads.find((l) => code(l) === 'TEST-BK3-A'), B = loads.find((l) => code(l) === 'TEST-BK3-B');
check('fixture TEST-BK3-A (SCX) i TEST-BK3-B (bez przewoźnika) widoczne dla HHL', Boolean(A && B));
const created = [];
const pdf = (txt) => new Blob([`%PDF-1.4\n% ${txt}\n%%EOF\n`], { type: 'application/pdf' });

async function register(org, loadId, category, name, mime, size, projectId) {
  const r = await sb[org].rpc('create_document', { p_load_id: loadId, p_category: category, p_file_name: name, p_mime: mime, p_size: size, ...(projectId ? { p_project_id: projectId } : {}) });
  const row = r.data?.[0];
  if (row) created.push(row);
  return { row, error: r.error };
}
async function put(org, row, blob, mime = 'application/pdf', o = {}) {
  const objectPath = String(row.object_path).replace(/\.\.\//g, '');
  if (objectPath !== row.object_path || objectPath.includes('..') || String(row.bucket).includes('..')) {
    return { error: { message: 'Niedozwolona ścieżka pliku' } };
  }
  return sb[org].storage.from(row.bucket).upload(objectPath, blob, { contentType: mime, upsert: false, ...o });
}
const sign = (org, row) => {
  const objectPath = String(row.object_path).replace(/\.\.\//g, '');
  return (org === 'anon' ? anon : sb[org]).storage.from(row.bucket).createSignedUrl(objectPath, 900);
};

// 1. SCX: CMR własnego transportu
const body = `BK4 CMR ${Date.now()}`;
const c1 = await register('SCX', A.id, 'CMR', 'CMR TEST-BK3-A ąę.pdf', 'application/pdf', pdf(body).size);
check('SCX rejestruje CMR swojego transportu (koszyk dokumenty)', c1.row?.bucket === 'dokumenty' && c1.row.storage_path.startsWith(`dokumenty/${A.project_id}/${A.id}/`));
const u1 = await put('SCX', c1.row, pdf(body));
check('SCX wgrywa plik do prywatnego koszyka', !u1.error);
const s1 = await sign('SCX', c1.row);
check('SCX dostaje link podpisany', Boolean(s1.data?.signedUrl));
const tokenPart = s1.data?.signedUrl ? new URL(s1.data.signedUrl).searchParams.get('token') : null;
const claims = tokenPart ? JSON.parse(Buffer.from(tokenPart.split('.')[1], 'base64url').toString()) : {};
check('link ważny dokładnie 15 min (exp − iat = 900 s)', claims.exp - claims.iat === 900);
const f1 = s1.data?.signedUrl ? await fetch(s1.data.signedUrl) : null;
check('link zwraca treść pliku (HTTP 200, zgodna treść)', f1?.status === 200 && (await f1.text()).includes(body));
const pub = await fetch(`${base}/storage/v1/object/public/dokumenty/${c1.row.object_path}`);
check('brak publicznego adresu (koszyk prywatny)', pub.status >= 400);
const { data: bk } = await admin.storage.listBuckets();
check('trzy koszyki prywatne: dokumenty / zdjecia / faktury', ['dokumenty', 'zdjecia', 'faktury'].every((id) => bk?.some((b) => b.id === id && b.public === false)));

// 2. Widoczność pliku = widoczność dokumentu
check('KSH (klient projektu) dostaje link do CMR', Boolean((await sign('KSH', c1.row)).data?.signedUrl));
check('HHL dostaje link do CMR', Boolean((await sign('HHL', c1.row)).data?.signedUrl));
check('anon nie dostaje linku', !(await sign('anon', c1.row)).data?.signedUrl);
const h1 = await register('HHL', B.id, 'POD', 'POD TEST-BK3-B.pdf', 'application/pdf', pdf('B').size);
await put('HHL', h1.row, pdf('B'));
check('SCX nie dostaje linku do pliku cudzego transportu', !(await sign('SCX', h1.row)).data?.signedUrl);
const docsScx = await sb.SCX.from('documents').select('id').eq('load_id', B.id);
check('SCX nie widzi metadanych dokumentu cudzego transportu', docsScx.data?.length === 0);
check('KSH dostaje link do POD transportu swojego projektu', Boolean((await sign('KSH', h1.row)).data?.signedUrl));

// 3. Zapis tylko pod zarejestrowaną ścieżkę, bez nadpisywania i usuwania
const c2 = await register('SCX', B.id, 'CMR', 'x.pdf', 'application/pdf', 10);
check('SCX nie zarejestruje dokumentu cudzego transportu', Boolean(c2.error) && !c2.row);
const free = await sb.SCX.storage.from('dokumenty').upload(`${A.project_id}/${A.id}/wolna/x.pdf`, pdf('x'), { contentType: 'application/pdf' });
check('SCX nie wgra pliku pod dowolną ścieżkę', Boolean(free.error));
const k1 = await register('KSH', A.id, 'SPEC', 'rysunek.pdf', 'application/pdf', pdf('k').size);
check('SCX nie wgra pliku pod rejestrację KSH', Boolean((await put('SCX', k1.row, pdf('k'))).error));
check('SCX nie nadpisze pliku (upsert)', Boolean((await put('SCX', c1.row, pdf('nadpis'), 'application/pdf', { upsert: true })).error));
await sb.SCX.storage.from('dokumenty').remove([c1.row.object_path]);
check('SCX nie usunie pliku (obiekt nadal jest)', Boolean((await sign('HHL', c1.row)).data?.signedUrl));
const bad = await register('SCX', A.id, 'CMR', 'x.exe', 'application/x-msdownload', 10);
check('niedozwolony typ pliku odrzucony przy rejestracji', Boolean(bad.error));
const p1 = await register('SCX', A.id, 'LASHING_PHOTO', 'mocowanie.jpg', 'image/jpeg', 100);
check('zdjęcie mocowania → koszyk zdjecia', p1.row?.bucket === 'zdjecia');
const wrongMime = await put('SCX', p1.row, pdf('nie-obraz'), 'application/pdf');
check('koszyk zdjecia odrzuca PDF (allowed_mime_types)', Boolean(wrongMime.error));

// 4. PDF faktury: niepodpięty widzi tylko autor (i HHL)
const inv = await register('SCX', null, 'INVOICE', 'SCX-faktura.pdf', 'application/pdf', pdf('inv').size, A.project_id);
await put('SCX', inv.row, pdf('inv'));
check('SCX wgrywa PDF faktury (koszyk faktury)', inv.row?.bucket === 'faktury');
check('KSH nie dostaje linku do PDF faktury SCX', !(await sign('KSH', inv.row)).data?.signedUrl);
check('HHL dostaje link do PDF faktury SCX', Boolean((await sign('HHL', inv.row)).data?.signedUrl));

// 5. Wycofanie rejestracji bez pliku
const d1 = await register('SCX', A.id, 'POD', 'porzucony.pdf', 'application/pdf', 10);
const dz = await sb.SCX.rpc('discard_document', { p_id: d1.row.id });
check('autor wycofuje rejestrację bez pliku', dz.data === true);
const dz2 = await sb.SCX.rpc('discard_document', { p_id: c1.row.id });
check('rejestracji z wgranym plikiem nie da się wycofać', dz2.data === false);

// Sprzątanie: wyłącznie pliki i wiersze documents utworzone w tym przebiegu.
for (const r of created) await admin.storage.from(r.bucket).remove([r.object_path]);
const ids = created.map((r) => r.id);
if (ids.length) await admin.from('documents').delete().in('id', ids);
const left = await admin.from('documents').select('id').in('id', ids);
console.log(`sprzątanie: ${created.length} rejestracji testowych usunięte (pozostało ${left.data?.length ?? '?'})`);

console.log(`\nBK4 storage verify: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
