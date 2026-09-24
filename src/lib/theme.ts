/** Document theme signaling — Claude SoT uses `data-theme` on <html> only (Fala-1-D16). */
export type Theme = 'dark' | 'light';

/**
 * Apply theme to the document. Single signal: `data-theme`.
 * Do NOT toggle Tailwind `class="dark"` — CSS tokens already key off `data-theme` / :root.
 */
export function applyThemeToDom(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('dark');
}
