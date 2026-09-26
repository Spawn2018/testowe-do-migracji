/** Claude v2.0 kbdpanel — chrome only (not Opcje / rate editor). */
import { useEffect } from 'react';
import { t } from '../../i18n/messages';
import { useTowerStore } from '../../store/useTowerStore';

const ROWS: [string, string][] = [
  ['a6_kbd_dash', 'K'],
  ['a6_kbd_map', 'M'],
  ['a6_kbd_sched', 'H'],
  ['a6_kbd_risk', 'R'],
  ['a6_kbd_docs', 'D'],
  ['a6_kbd_fin', 'F'],
  ['a6_kbd_role', 'Shift + R'],
  ['a6_kbd_theme', 'T'],
  ['a6_kbd_esc', 'Esc'],
  ['a6_kbd_list', '?'],
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

  const locale = useTowerStore((s) => s.locale);
  if (!open) return null;
  return (
    <div className="kbdpanel" id="kbdPanel" role="dialog" aria-label={t(locale, 'a6_kbd_title')}>
      <h4>{t(locale, 'a6_kbd_title')}</h4>
      {ROWS.map(([l, k]) => (
        <div key={l}>
          <span>{t(locale, l)}</span>
          <kbd>{k}</kbd>
        </div>
      ))}
    </div>
  );
}
