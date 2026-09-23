/** Claude v2.0 nav/ops SVG icons — 1:1 from tower-makieta.html */
import type { ReactNode } from 'react';

function Ico({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  dash: (
    <Ico>
      <path d="M3 17V11.2M7.33 17V6.2M11.67 17V13.4M16 17V3.4" />
      <path d="M1.6 18.2h16.8" />
    </Ico>
  ),
  map: (
    <Ico>
      <circle cx="10" cy="10" r="6.6" strokeDasharray="2.8 2.2" />
      <rect x="8.3" y="8.3" width="3.4" height="3.4" />
    </Ico>
  ),
  sched: (
    <Ico>
      <path d="M1.2 6.6h17.6" />
      <path d="M3.8 6.6v4.4h12.4V6.6" />
      <circle cx="6.6" cy="13.6" r="2.2" />
      <circle cx="13.4" cy="13.6" r="2.2" />
    </Ico>
  ),
  risk: (
    <Ico>
      <path d="M10 3 18.2 17H1.8z" />
      <path d="M10 8v4.2" />
      <path d="M10 14.3v.9" />
    </Ico>
  ),
  docs: (
    <Ico>
      <path d="M4 2.6h7.6l3.8 3.8v11H4z" />
      <path d="M11.6 2.6v3.8h3.8" />
      <path d="M6.6 9.6h5.4M6.6 12.2h3.4" />
      <circle cx="14.2" cy="14.6" r="2.9" />
    </Ico>
  ),
  fin: (
    <Ico>
      <path d="M2.6 16.4h4.2V5.2H2.6z" />
      <path d="M8.4 16.4h4.2v-7.4H8.4z" />
      <path d="M14.2 16.4h3.2v-3.6h-3.2z" />
    </Ico>
  ),
  inv: (
    <Ico>
      <path d="M4.2 2.6h11.6v15l-2.9-1.7-2.9 1.7-2.9-1.7-2.9 1.7z" />
      <path d="M7 6.8h6M7 10.2h4" />
    </Ico>
  ),
  wf: (
    <Ico>
      <rect x="1.8" y="8" width="4.2" height="4.2" />
      <rect x="14" y="3.2" width="4.2" height="4.2" />
      <rect x="14" y="12.6" width="4.2" height="4.2" />
      <path d="M6 10.1h4V5.3h4M10 10.1v4.6h4" />
    </Ico>
  ),
  geo: (
    <Ico>
      <path d="M10 2.6 17.2 7.4v7.2L10 17.4 2.8 14.6V7.4z" />
      <rect x="8.4" y="8.8" width="3.2" height="3.2" />
    </Ico>
  ),
  options: (
    <Ico>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 2.6v2M10 15.4v2M2.6 10h2M15.4 10h2M4.77 4.77l1.42 1.42M13.81 13.81l1.42 1.42M15.23 4.77l-1.42 1.42M6.19 13.81l-1.42 1.42" />
    </Ico>
  ),
  tasks: (
    <Ico>
      <path d="M2.6 5.4h2.2M7.6 5.4h9.8" />
      <path d="M2.6 10h2.2M7.6 10h9.8" />
      <path d="M2.6 14.6h2.2" />
      <path d="M7.6 14.6h6.6" strokeDasharray="2.6 2" />
    </Ico>
  ),
  ferry: (
    <Ico size={16}>
      <path d="M3.4 12.4h13.2l-1.6 4.2H5z" />
      <path d="M6.2 12.4V8h7.6v4.4" />
      <path d="M10 8V4.6" />
    </Ico>
  ),
  theme: (
    <Ico size={16}>
      <circle cx="10" cy="10" r="6.6" />
      <path d="M10 3.4a6.6 6.6 0 010 13.2z" fill="currentColor" stroke="none" />
    </Ico>
  ),
} as const;

export type IconKey = keyof typeof ICONS;

export function ClaudeIcon({ name }: { name: IconKey }) {
  return ICONS[name];
}
