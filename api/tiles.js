/**
 * AUD-01c — kafelki mapy z pamięci brzegu Vercel.
 * `/tiles/<styl>/<z>/<x>/<y>` (vercel.json) → ta funkcja (region fra1, vercel.json `regions`) → Supabase `here-raster`
 * w eu-central-1 (Frankfurt; baza eu-west-1). Bezpośrednie przepisanie na Supabase nie trafiało do pamięci brzegu:
 * odpowiedź Supabase niesie `set-cookie: __cf_bm` (Cloudflare), a Vercel nie trzyma odpowiedzi z `set-cookie`.
 * Tu przekazujemy tylko obraz i nagłówki pamięci — bez ciasteczek, bez `Vary`, bez autoryzacji (kafelki publiczne,
 * decyzja właściciela 06.10). Błędy: `no-store`; 404 spoza siatki: 1 h.
 */
export const SUPABASE_FN = 'https://nglnnrmzmhusvxslousq.supabase.co/functions/v1/here-raster';
export const TILE_REGION = 'eu-central-1';
export const STYLES = new Set(['light', 'dark', 'logistics.day', 'logistics.night']);

function json(body, status, cache) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': cache },
  });
}

export function parseTile(url) {
  const u = new URL(url);
  const style = u.searchParams.get('style') ?? '';
  const z = Number(u.searchParams.get('z'));
  const x = Number(u.searchParams.get('x'));
  const y = Number(u.searchParams.get('y'));
  if (!STYLES.has(style)) return { error: 'styl' };
  const max = 2 ** z;
  const ok = Number.isInteger(z) && z >= 0 && z <= 19 && Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < max && y < max;
  return ok ? { style, z, x, y } : { error: 'siatka' };
}

export async function GET(request) {
  const t = parseTile(request.url);
  if (t.error === 'styl') return json({ error: 'styl' }, 404, 'no-store');
  if (t.error) return json({ error: 'zly kafel' }, 404, 'public, max-age=3600, s-maxage=3600');
  const ip = (request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const ref = request.headers.get('referer') ?? request.headers.get('origin') ?? '';
  const started = Date.now();
  let res;
  try {
    res = await fetch(
      `${SUPABASE_FN}?style=${encodeURIComponent(t.style)}&z=${t.z}&x=${t.x}&y=${t.y}&forceFunctionRegion=${TILE_REGION}`,
      { headers: { 'x-wt-client-ip': ip, ...(ref ? { 'x-wt-referer': ref } : {}) } },
    );
  } catch {
    return json({ fallback: true }, 502, 'no-store');
  }
  const region = res.headers.get('x-sb-edge-region') ?? '';
  const type = res.headers.get('content-type') ?? '';
  const diag = { 'x-sb-edge-region': region, 'x-wt-origin-ms': String(Date.now() - started) };
  if (!res.ok || !type.startsWith('image/')) {
    const body = await res.text();
    return new Response(body, { status: res.status === 200 ? 502 : res.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...diag } });
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': type,
      'cache-control': res.headers.get('cache-control') ?? 'public, max-age=3600, s-maxage=3600',
      'x-here-cache-control': res.headers.get('x-here-cache-control') ?? '',
      ...diag,
    },
  });
}
