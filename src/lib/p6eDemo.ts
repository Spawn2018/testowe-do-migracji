/**
 * wyglad/P6-e — przykładowe wiadomości Czatu w dzwonku (tylko demo; D-20261016-0310-01 Cz14, D-20261016-0315-01).
 * Spójnie z odczytami z `p6bDemo.ts`: wiadomość HHL przeczytał SCX, KSH jeszcze nie → wpis u KSH; rozmowa
 * „tylko HHL i SCX” od SCX, której HHL jeszcze nie otworzył → wpis tylko u HHL (nigdy u KSH). Osoby zmyślone (G-09).
 */
import type { Load, LoadMessage, Notification } from '../types';

const WHO: Record<string, string> = {
  HHL: 'Anna Wiśniewska // H&H Logistics',
  SCX: 'Jan Nowak // Scandinavian Express',
};
const MIN = 60_000;

export function demoChatNotices(loads: readonly Load[], messages: readonly LoadMessage[]): Notification[] {
  const out: Notification[] = [];
  const seeded = messages.filter((m) => /^msg-\d+$/.test(m.id)).slice(0, 4);
  for (const m of seeded) {
    const load = loads.find((l) => l.id === m.loadId);
    if (!load) continue;
    const href = { view: 'sched', loadId: load.id, path: `/transport/${encodeURIComponent(load.code)}?zakladka=czat` };
    if (m.org === 'HHL') {
      out.push({
        id: `p6e-chat-${m.id}`, at: m.at, title: `${load.code} · ${WHO.HHL}`, body: m.text, severity: 'MEDIUM',
        loadId: load.id, read: false, roleScope: ['KSH'], kind: 'LOAD_CHAT_MESSAGE', code: load.code, href,
      });
    }
    out.push({
      id: `p6e-chat-only-${m.loadId}`, at: new Date(Date.parse(m.at) + 35 * MIN).toISOString(), title: `${load.code} · ${WHO.SCX}`,
      body: 'Rejs zarezerwowany, numer rezerwacji wpisany w awizacji. Do KSH bez zmian.', severity: 'MEDIUM',
      loadId: load.id, read: false, roleScope: ['HHL'], kind: 'LOAD_CHAT_MESSAGE', code: load.code, href, chatOnly: true,
    });
  }
  return out;
}
