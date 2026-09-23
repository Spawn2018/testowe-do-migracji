/** Claude v2.0 kbdpanel — chrome only (not Opcje / rate editor). */
import { useEffect } from 'react';

const ROWS: [string, string][] = [
  ['Kokpit', 'K'],
  ['Mapa', 'M'],
  ['Harmonogram', 'H'],
  ['Ryzyka', 'R'],
  ['Dokumenty', 'D'],
  ['Finanse', 'F'],
  ['Zmień rolę', 'Shift + R'],
  ['Jasny / ciemny', 'T'],
  ['Zamknij szufladę, wyczyść filtr', 'Esc'],
  ['Ta lista', '?'],
];

export function KeyboardHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="kbdpanel" id="kbdPanel" role="dialog" aria-label="Skróty">
      <h4>Skróty</h4>
      {ROWS.map(([l, k]) => (
        <div key={l}>
          <span>{l}</span>
          <kbd>{k}</kbd>
        </div>
      ))}
    </div>
  );
}
