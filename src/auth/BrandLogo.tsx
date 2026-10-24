/**
 * Logo „Watch Tower” na ekranach logowania i ładowania (właściciel 21.10.2026 19:52: ciemny napis na ciemnym tle).
 * Wariant wybiera CSS po `data-theme` dokumentu — to samo źródło co kolory tła, więc napis zawsze kontrastuje
 * (jak ekran startowy w index.html). Wcześniej wybór szedł z motywu w store, który mógł się różnić od tła.
 * #274: WebP 480 px (~40 kB) zamiast PNG 800 px (~260 kB) — największy element ekranu logowania na telefonie.
 */
export function BrandLogo({ alt, className }: { alt: string; className?: string }) {
  const cls = className ? `${className} ` : '';
  return (
    <>
      <img className={`${cls}wt-logo-light`} src="/brand/watchtower-logo-full.webp" alt={alt} width={480} height={494} />
      <img className={`${cls}wt-logo-dark`} src="/brand/watchtower-logo-full-dark.webp" alt={alt} width={480} height={494} />
    </>
  );
}
