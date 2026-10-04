/**
 * L-5 — dzwonek bez napisu „przeczytane”.
 * Po kliknięciu pozycja jest przeczytana i znika z listy. Licznik to długość listy.
 */
export interface BellItem {
  id: string;
  read: boolean;
  roleScope?: readonly string[];
}

export function bellVisible<T extends BellItem>(items: readonly T[], role: string): T[] {
  return items.filter((n) => {
    const scoped = !n.roleScope || n.roleScope.length === 0 || n.roleScope.includes(role);
    return scoped && !n.read;
  });
}

export function bellAfterClick<T extends BellItem>(items: readonly T[], id: string): T[] {
  return items.map((n) => (n.id === id ? { ...n, read: true } : n));
}
