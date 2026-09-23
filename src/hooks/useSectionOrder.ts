import { useCallback, useEffect, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';

/** Persist section order per page + org (HHL/KSH/SCX). */
export function useSectionOrder(pageKey: string, defaultOrder: readonly string[]) {
  const role = useTowerStore((s) => s.role);
  const storageKey = `wt-section-order-v1:${pageKey}:${role}`;
  const defaults = defaultOrder as string[];

  const read = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [...defaults];
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return [...defaults];
      const known = new Set(defaults);
      const kept = parsed.filter((id) => known.has(id));
      for (const id of defaults) if (!kept.includes(id)) kept.push(id);
      return kept;
    } catch {
      return [...defaults];
    }
  }, [storageKey, defaults]);

  const [order, setOrder] = useState<string[]>(() => read());

  useEffect(() => {
    setOrder(read());
  }, [read]);

  const move = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      setOrder((prev) => {
        const next = [...prev];
        const from = next.indexOf(fromId);
        const to = next.indexOf(toId);
        if (from < 0 || to < 0) return prev;
        next.splice(from, 1);
        next.splice(to, 0, fromId);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey],
  );

  return { order, move };
}
