import { vi } from "vitest";

export interface FakeStorage {
  data: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

function fakeStorage(): FakeStorage & Storage {
  const data = new Map<string, string>();
  const storage: FakeStorage = {
    data,
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
    clear: () => void data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  return storage as FakeStorage & Storage;
}

/** Installs a minimal browser-like `window` (jsdom-free). */
export function installBrowser(): void {
  const historyState = { value: null as unknown };
  const history: Pick<History, "state" | "replaceState" | "pushState"> = {
    get state() {
      return historyState.value;
    },
    replaceState: vi.fn((next: unknown) => {
      historyState.value = next;
    }),
    pushState: vi.fn((next: unknown) => {
      historyState.value = next;
    }),
  };
  const location: Partial<Location> = {
    href: "https://example.com/",
    pathname: "/",
    search: "",
    hash: "",
  };
  Object.defineProperty(globalThis, "window", {
    value: {
      history,
      location,
      sessionStorage: fakeStorage(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: {},
    configurable: true,
    writable: true,
  });
}

export function removeBrowser(): void {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
}

/** Removes the fake browser between tests so module caches re-detect it. */
export function resetBrowser(): void {
  removeBrowser();
}

/** Returns the fake session storage of the installed browser. */
export function fakeSessionStorage(): Storage {
  return (globalThis as unknown as { window: { sessionStorage: Storage } }).window
    .sessionStorage;
}

/** Returns the fake history of the installed browser. */
export function fakeHistory(): Pick<History, "state" | "replaceState" | "pushState"> {
  return (globalThis as unknown as { window: { history: Pick<History, "state" | "replaceState" | "pushState"> } })
    .window.history;
}
