/** Wspólna ochrona: Active ZAP nigdy na prod. */
export const PROD_HOST_RE =
  /(^|\.)tower\.log-mar\.pl$/i;

export const PROD_URL_FRAGMENTS = [
  'tower.log-mar.pl',
  'watch-tower-makieta.vercel.app',
];

export function isProdZapTarget(url) {
  const s = String(url || '').trim().toLowerCase();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (PROD_HOST_RE.test(u.hostname)) return true;
    if (u.hostname === 'watch-tower-makieta.vercel.app') return true;
  } catch {
    /* plain string */
  }
  return PROD_URL_FRAGMENTS.some((f) => s.includes(f));
}

export function assertActiveScanAllowed(url) {
  if (!url || !String(url).trim()) {
    throw new Error('Brak URL — Active Scan wymaga jawnego adresu TEST');
  }
  if (isProdZapTarget(url)) {
    throw new Error(
      `ODMOWA: Active Scan zabroniony na PROD (${url}). Użyj scripts/zap-baseline-passive.sh albo URL środowiska TEST.`,
    );
  }
  return true;
}
