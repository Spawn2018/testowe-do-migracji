/**
 * wyglad/P3-c — ekrany Opcji z danymi przykładowymi tylko w trybie demo.
 * Warunek `import.meta.env.VITE_AUTH_MODE !== 'supabase'` Vite zamienia na stałą, więc w buildzie
 * produkcyjnym import `./demo` jest martwym kodem i nie trafia do paczki (strażnik I-0 / B-1).
 */
import { createElement, useEffect, useState } from 'react';
import type { Locale } from '../../types';
import type { AccountKind } from './types';
import type { DemoBodies } from './demo';
import type { MyNotifySource } from '../../lib/forMeSource';
import { DemoMark } from '../ui/DemoMark';

type DemoModule = typeof import('./demo');

export function useDemoOptions(locale: Locale, opts: { kind: AccountKind; readOnly: boolean; my?: MyNotifySource | null }): DemoBodies | null {
  const [mod, setMod] = useState<DemoModule | null>(null);
  useEffect(() => {
    let alive = true;
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
      void import('./demo').then((m) => { if (alive) setMod(m); });
    }
    return () => { alive = false; };
  }, []);
  if (!mod) return null;
  return mod.demoBodies(locale, { ...opts, mark: createElement(DemoMark) });
}
