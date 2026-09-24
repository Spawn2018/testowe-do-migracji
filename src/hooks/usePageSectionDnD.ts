import { useEffect } from 'react';
import { useTowerStore } from '../store/useTowerStore';

/**
 * Android-home-screen DnD for greys headers (.panel-hd) inside [data-page].
 * Persists order in localStorage per page+org.
 */
export function usePageSectionDnD(pageAttr = 'data-page') {
  const role = useTowerStore((s) => s.role);

  useEffect(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(`[${pageAttr}]`));
    const cleanups: Array<() => void> = [];

    for (const root of roots) {
      const page = root.getAttribute(pageAttr);
      if (!page) continue;
      const key = `wt-section-order-v1:${page}:${role}`;

      const applyOrder = () => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const order = JSON.parse(raw) as string[];
          const cards = Array.from(root.querySelectorAll<HTMLElement>(':scope > .section-card, :scope > .panel'));
          const map = new Map(
            cards.map((c, i) => [c.getAttribute('data-section') || `idx-${i}`, c]),
          );
          for (const id of order) {
            const el = map.get(id);
            if (el) root.appendChild(el);
          }
        } catch {
          /* ignore */
        }
      };

      // stamp data-section if missing; grips ONLY on SectionCard (Claude .panel-hd stay clean)
      const cards = Array.from(root.querySelectorAll<HTMLElement>(':scope > .section-card, :scope > .panel'));
      cards.forEach((c, i) => {
        if (!c.getAttribute('data-section')) c.setAttribute('data-section', `s${i}`);
        // Do not inject ⋮⋮ / draggable into raw Claude panels (e.g. dash .panel.grid2)
        if (!c.classList.contains('section-card')) return;
        const hd = c.querySelector<HTMLElement>(':scope > .panel-hd');
        if (!hd) return;
        hd.classList.add('is-draggable');
        hd.draggable = true;
        if (!hd.querySelector('.section-grip')) {
          const g = document.createElement('span');
          g.className = 'section-grip';
          g.setAttribute('aria-hidden', 'true');
          g.textContent = '⋮⋮';
          hd.insertBefore(g, hd.firstChild);
        }
      });
      applyOrder();

      const onDragStart = (e: DragEvent) => {
        const hd = e.target as HTMLElement;
        const card = hd.closest<HTMLElement>('.section-card, .panel');
        if (!card || !hd.classList.contains('is-draggable') && !hd.closest('.is-draggable')) return;
        const id = card.getAttribute('data-section');
        if (!id) return;
        e.dataTransfer?.setData('text/wt-section', id);
        hd.classList.add('is-dragging');
      };
      const onDragEnd = (e: DragEvent) => {
        (e.target as HTMLElement).classList?.remove('is-dragging');
        root.querySelectorAll('.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      };
      const onDragOver = (e: DragEvent) => {
        const hd = (e.target as HTMLElement).closest('.panel-hd');
        if (!hd) return;
        e.preventDefault();
        hd.classList.add('is-drag-over');
      };
      const onDragLeave = (e: DragEvent) => {
        const hd = (e.target as HTMLElement).closest('.panel-hd');
        hd?.classList.remove('is-drag-over');
      };
      const onDrop = (e: DragEvent) => {
        e.preventDefault();
        const hd = (e.target as HTMLElement).closest('.panel-hd');
        hd?.classList.remove('is-drag-over');
        const toCard = hd?.closest<HTMLElement>('.section-card, .panel');
        const fromId = e.dataTransfer?.getData('text/wt-section');
        const toId = toCard?.getAttribute('data-section');
        if (!fromId || !toId || fromId === toId) return;
        const cardsNow = Array.from(
          root.querySelectorAll<HTMLElement>(':scope > .section-card, :scope > .panel'),
        );
        const ids = cardsNow.map((c, i) => c.getAttribute('data-section') || `idx-${i}`);
        const from = ids.indexOf(fromId);
        const to = ids.indexOf(toId);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, fromId);
        localStorage.setItem(key, JSON.stringify(ids));
        const map = new Map(cardsNow.map((c, i) => [c.getAttribute('data-section') || `idx-${i}`, c]));
        for (const id of ids) {
          const el = map.get(id);
          if (el) root.appendChild(el);
        }
      };

      root.addEventListener('dragstart', onDragStart);
      root.addEventListener('dragend', onDragEnd);
      root.addEventListener('dragover', onDragOver);
      root.addEventListener('dragleave', onDragLeave);
      root.addEventListener('drop', onDrop);
      cleanups.push(() => {
        root.removeEventListener('dragstart', onDragStart);
        root.removeEventListener('dragend', onDragEnd);
        root.removeEventListener('dragover', onDragOver);
        root.removeEventListener('dragleave', onDragLeave);
        root.removeEventListener('drop', onDrop);
      });
    }
    return () => cleanups.forEach((fn) => fn());
  }, [role, pageAttr]);
}
