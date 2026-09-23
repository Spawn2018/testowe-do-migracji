/**
 * Node has no browser storage. Zustand persist reads `window.localStorage`
 * when the store module loads, so the stub must exist before tests import it.
 */
const memory = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear() {
    memory.clear();
  },
  getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null;
  },
  key(index: number) {
    return [...memory.keys()][index] ?? null;
  },
  removeItem(key: string) {
    memory.delete(key);
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: memoryStorage,
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: {
    documentElement: {
      setAttribute() {},
      classList: { toggle() {}, add() {}, remove() {} },
    },
  },
  configurable: true,
});

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
  });
}
