import { useEffect } from 'react';

/** E8 pkt 2 (P2-wyglad V3): na telefonie karta czyta nagłówek kolumny jako etykietę. */
function applyPhoneTableLabels() {
  const phone = window.matchMedia('(max-width: 768px)').matches;
  document.querySelectorAll('.app table').forEach((table) => {
    const heads = Array.from(table.querySelectorAll('thead th')).map((th) =>
      (th.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        if (!(cell instanceof HTMLTableCellElement) || cell.tagName !== 'TD') return;
        if (!phone) {
          if (cell.hasAttribute('data-label')) cell.removeAttribute('data-label');
          return;
        }
        const label = heads[i] ?? '';
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      });
    });
  });
}

export function usePhoneTableLabels() {
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyPhoneTableLabels, 50);
    };
    schedule();
    const root = document.querySelector('.app');
    const obs = new MutationObserver(schedule);
    if (root) obs.observe(root, { childList: true, subtree: true });
    const mq = window.matchMedia('(max-width: 768px)');
    mq.addEventListener('change', schedule);
    return () => {
      window.clearTimeout(timer);
      obs.disconnect();
      mq.removeEventListener('change', schedule);
    };
  }, []);
}
