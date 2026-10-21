/**
 * Logo „Watch Tower” na ekranach logowania i ładowania (właściciel 21.10.2026 19:52: ciemny napis na ciemnym tle).
 * Wariant wybiera CSS po `data-theme` dokumentu — to samo źródło co kolory tła, więc napis zawsze kontrastuje
 * (jak ekran startowy w index.html). Wcześniej wybór szedł z motywu w store, który mógł się różnić od tła.
 */
export function BrandLogo({ alt, className }: { alt: string; className?: string }) {
  const cls = className ? `${className} ` : '';
  return (
    <>
      <img className={`${cls}wt-logo-light`} src="/brand/watchtower-logo-full.png" alt={alt} width={240} height={80} />
      <img className={`${cls}wt-logo-dark`} src="/brand/watchtower-logo-full-dark.png" alt={alt} width={240} height={80} />
    </>
  );
}
