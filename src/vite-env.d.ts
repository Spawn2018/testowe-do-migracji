/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPTILER_KEY?: string;
  readonly VITE_PSEUDO?: string;
  readonly VITE_TRAFIKVERKET_API_KEY?: string;
  readonly VITE_AIS_WS_URL?: string;
  /** ISO timestamp to freeze UI clocks (screenshots). */
  readonly VITE_FROZEN_NOW?: string;
  /** BK2: 'supabase' włącza logowanie; brak → DemoProvider. */
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}
