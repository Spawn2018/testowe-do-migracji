/** B-6e — krótka nazwa urządzenia z nagłówka przeglądarki („Chrome · Windows”). Bez bibliotek. */
export function uaLabel(ua: string | null | undefined): string {
  if (!ua) return '';
  const s = ua;
  const browser = /Edg(e|A|iOS)?\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
      : /Firefox\/|FxiOS/.test(s) ? 'Firefox'
        : /Chrome\/|CriOS/.test(s) ? 'Chrome'
          : /Safari\//.test(s) ? 'Safari'
            : /okhttp|Dalvik/i.test(s) ? 'Android app'
              : '';
  const os = /Windows/.test(s) ? 'Windows'
    : /iPhone|iPad|iPod|iOS/.test(s) ? 'iOS'
      : /Android/.test(s) ? 'Android'
        : /Mac OS X|Macintosh/.test(s) ? 'macOS'
          : /Linux/.test(s) ? 'Linux'
            : '';
  const label = [browser, os].filter(Boolean).join(' · ');
  return label || s.slice(0, 40);
}
