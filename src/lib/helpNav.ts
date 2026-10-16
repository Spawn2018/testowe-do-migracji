/**
 * wyglad/P10b-b (E37 pkt 3): „kliknięcie kroku otwiera miejsce”. Tylko przejście między ekranami — bez zapisu,
 * bez zmiany roli i uprawnień. Zakładki w widokach (Rejsy, Do zrobienia na telefonie, Paczka tygodnia) wskazujemy
 * ich własnymi przyciskami i kotwicami, bez zmian w widokach.
 */
import { useTowerStore } from '../store/useTowerStore';
import { openOptionsScreen } from './openOptions';
import type { HelpTarget } from './helpContent';

/** Menu konta otwiera się z Pomocy (krok „Menu konta”, „Podgląd” na telefonie). */
export const OPEN_ACCOUNT_EVENT = 'wt-open-account';

/** Czeka, aż element pojawi się po zmianie widoku (najwyżej 3 s). */
function whenEl(sel: string, cb: (el: HTMLElement) => void, ms = 3000): void {
  if (typeof document === 'undefined') return;
  const t0 = Date.now();
  const tick = () => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) cb(el);
    else if (Date.now() - t0 < ms) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function goHelpTarget(target: HelpTarget, phone: boolean): void {
  const s = useTowerStore.getState();
  switch (target) {
    case 'konto':
      window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_EVENT));
      return;
    case 'podglad':
      if (phone) {
        window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_EVENT, { detail: { preview: true } }));
      } else {
        whenEl('#roleSeg', (seg) => {
          seg.classList.add('is-hint');
          seg.querySelector<HTMLElement>('button')?.focus();
          window.setTimeout(() => seg.classList.remove('is-hint'), 2400);
        });
      }
      return;
    case 'options/users':
      openOptionsScreen('users');
      return;
    case 'panel':
      s.setView('sched');
      return;
    case 'sched/rejsy':
      s.setView('sched');
      whenEl('[data-sched-tab="sailings"]', (b) => { if (b.getAttribute('aria-pressed') !== 'true') b.click(); });
      return;
    case 'risk/todo':
      s.setView('risk');
      if (phone) whenEl('[data-rk-tab="todo"]', (b) => { if (b.getAttribute('aria-selected') !== 'true') b.click(); });
      return;
    case 'fin/pack':
      s.setView('fin');
      whenEl('#fin-pack', (el) => el.scrollIntoView({ block: 'start' }));
      return;
    default:
      s.setView(target);
  }
}
