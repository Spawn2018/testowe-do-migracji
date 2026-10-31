/**
 * Node has no browser storage. Zustand persist reads `window.localStorage`
 * when the store module loads, so the stub must exist before tests import it.
 * #667 F7 r2: w jsdom nie nadpisuj `document` — stub bez `.style` psuje Leaflet.
 */
const isJsdom = typeof document !== 'undefined'
  && typeof HTMLElement !== 'undefined'
  && !!document.documentElement
  && typeof (document.documentElement as Element & { style?: unknown }).style === 'object';

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

if (!isJsdom) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: memoryStorage,
    configurable: true,
  });
}

const attrs: Record<string, string> = {};
const classSet = new Set<string>();

if (!isJsdom) {
  Object.defineProperty(globalThis, 'document', {
    value: {
      documentElement: {
        setAttribute(name: string, value: string) {
          attrs[name] = value;
        },
        getAttribute(name: string) {
          return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
        },
        removeAttribute(name: string) {
          delete attrs[name];
        },
        classList: {
          add(...tokens: string[]) {
            for (const t of tokens) classSet.add(t);
          },
          remove(...tokens: string[]) {
            for (const t of tokens) classSet.delete(t);
          },
          toggle(token: string, force?: boolean) {
            const on = force === undefined ? !classSet.has(token) : force;
            if (on) classSet.add(token);
            else classSet.delete(token);
            return on;
          },
          contains(token: string) {
            return classSet.has(token);
          },
        },
      },
    },
    configurable: true,
  });
}

/** Test helpers for theme DOM signaling (Fala-1-D16). */
;(globalThis as unknown as { __wtThemeDom: unknown }).__wtThemeDom = {
  getDataTheme: () => {
    if (isJsdom) return document.documentElement.getAttribute('data-theme');
    return attrs['data-theme'] ?? null;
  },
  hasDarkClass: () => {
    if (isJsdom) return document.documentElement.classList.contains('dark');
    return classSet.has('dark');
  },
  reset() {
    if (isJsdom) {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
      return;
    }
    for (const k of Object.keys(attrs)) delete attrs[k];
    classSet.clear();
  },
  seedDarkClass() {
    if (isJsdom) document.documentElement.classList.add('dark');
    else classSet.add('dark');
  },
};

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
  });
}
