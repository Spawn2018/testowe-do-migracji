/**
 * O2 — build produkcyjny (VITE_AUTH_MODE=supabase) bez makiet i danych demonstracyjnych w `dist/`.
 * `public/` trafia do `dist/` w całości; w trybie produkcyjnym usuwamy pliki, które dawały się pobrać
 * bez logowania (makieta HTML z danymi demo, arkusz harmonogramu z danymi przykładowymi) oraz nagłówek
 * `/download/*` dla Cloudflare Pages. Dodajemy `404.html`, żeby Pages zwracało 404 zamiast `index.html`
 * (aplikacja używa HashRouter — przepisania na `index.html` nie są potrzebne).
 * Tryb demo (lokalnie, podglądy) — bez zmian, makieta zostaje.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Ścieżki względem `dist/` usuwane z builda produkcyjnego. */
export const PROD_STRIPPED = [
  'download',
  'tower-makieta.html',
  'claude-makieta.html',
  'claude-ref.html',
  'claude-v2-ref.html',
  'KSH_HARMONOGRAM.xlsx',
] as const

export const PROD_404_HTML = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TOWER — nie znaleziono</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem"><h1>404 — nie znaleziono</h1>
<p><a href="/">Przejdź do strony logowania TOWER</a></p></body></html>
`

export function isProdAuthMode(mode: string | undefined): boolean {
  return mode === 'supabase'
}

/** Usuwa z `_headers` blok `/download/*`; zwraca nową treść (pustą, gdy nic nie zostało). */
export function stripDownloadHeaders(src: string): string {
  const blocks = src.split(/\n(?=\S)/)
  return blocks.filter((b) => !b.startsWith('/download/')).join('\n').trim()
}

export function stripProdDist(outDir: string): string[] {
  const removed: string[] = []
  for (const p of PROD_STRIPPED) {
    const abs = join(outDir, p)
    if (existsSync(abs)) {
      rmSync(abs, { recursive: true, force: true })
      removed.push(p)
    }
  }
  const headers = join(outDir, '_headers')
  if (existsSync(headers)) {
    const rest = stripDownloadHeaders(readFileSync(headers, 'utf8'))
    if (rest) writeFileSync(headers, rest + '\n')
    else rmSync(headers)
    removed.push('_headers:/download/*')
  }
  writeFileSync(join(outDir, '404.html'), PROD_404_HTML)
  return removed
}
