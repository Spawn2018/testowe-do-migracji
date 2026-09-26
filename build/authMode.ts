/**
 * A5-PODGLADY — tryb logowania w buildzie na Vercel.
 * - podglądy (VERCEL_ENV=preview/development) → zawsze DemoProvider (VITE_AUTH_MODE=demo), bez względu na zmienne projektu;
 * - produkcja (VERCEL_ENV=production) tylko z gałęzi `main` — inaczej build przerwany;
 * - Cloudflare Pages (CF_PAGES=1, PR8): gałąź inna niż `main` (podgląd) → zawsze demo; `main` → VITE_AUTH_MODE;
 * - poza Vercel i Pages → bez zmian (lokalnie/CI decyduje VITE_AUTH_MODE).
 */
export function resolveAuthMode(env: Record<string, string | undefined>): string | undefined {
  const vercel = env.VERCEL_ENV
  if (!vercel && env.CF_PAGES === '1') return env.CF_PAGES_BRANCH === 'main' ? env.VITE_AUTH_MODE : 'demo'
  if (!vercel) return env.VITE_AUTH_MODE
  if (vercel !== 'production') return 'demo'
  const ref = env.VERCEL_GIT_COMMIT_REF
  if (ref && ref !== 'main') throw new Error(`Build produkcyjny tylko z gałęzi main (jest: ${ref})`)
  return env.VITE_AUTH_MODE
}
