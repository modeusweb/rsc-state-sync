import { HISTORY_STATE_KEY, SESSION_KEY_PREFIX } from "./constants.js";
import {
  buildUrl,
  decodeEnvelope,
  encodeEnvelope,
  mergeHistoryState,
  readHistoryBucket,
  replaceHistoryState,
  storageUnavailable,
} from "./envelope.js";
import { getBrowser } from "./env.js";
import type { StateLayer, StoredRecord } from "./types.js";

/** In-memory slot. Zero-cost: stores the raw value, never serializes. */
export function createMemoryLayer(): StateLayer {
  const slots = new Map<string, StoredRecord>();
  return {
    name: "memory",
    isAvailable: () => true,
    read: (scope) => slots.get(scope) ?? null,
    write: (scope, _key, record) => {
      slots.set(scope, record);
      return { ok: true };
    },
    remove: (scope, _key) => void slots.delete(scope),
    clear: () => void slots.clear(),
    cost: () => 0,
  };
}

/** `history.state` layer. Snapshots are per history entry, merged with foreign keys. */
export const historyLayer: StateLayer = {
  name: "history",
  isAvailable: () => getBrowser() !== null,
  read(scope) {
    const bucket = readHistoryBucket();
    if (!bucket || !(scope in bucket)) return null;
    return decodeEnvelope(bucket[scope], scope, "history");
  },
  write(scope, _key, record) {
    const browser = getBrowser();
    if (!browser) return storageUnavailable("history", scope);
    try {
      replaceHistoryState(mergeHistoryState(scope, encodeEnvelope(record)));
      return { ok: true };
    } catch (error) {
      return storageUnavailable("history", scope, error);
    }
  },
  remove(scope) {
    const bucket = readHistoryBucket();
    const browser = getBrowser();
    if (!bucket || !browser || !(scope in bucket)) return;
    delete bucket[scope];
    const raw: unknown = browser.history.state;
    const base: Record<string, unknown> =
      raw !== null && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
    base[HISTORY_STATE_KEY] = bucket;
    replaceHistoryState(base);
  },
  clear() {
    const bucket = readHistoryBucket();
    const browser = getBrowser();
    if (!bucket || !browser) return;
    const raw: unknown = browser.history.state;
    const base: Record<string, unknown> =
      raw !== null && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
    delete base[HISTORY_STATE_KEY];
    replaceHistoryState(base);
  },
  cost(_scope, _key, record) {
    return record.payload === undefined ? 0 : record.payload.length;
  },
};

/** `sessionStorage` layer: survives a page reload within the tab. */
export const sessionLayer: StateLayer = {
  name: "session",
  isAvailable: () => getBrowser()?.sessionStorage != null,
  read(scope, key) {
    const browser = getBrowser();
    if (!browser?.sessionStorage) return null;
    const raw = browser.sessionStorage.getItem(SESSION_KEY_PREFIX + key);
    if (raw === null) return null;
    return decodeEnvelope(raw, scope, "session");
  },
  write(scope, key, record) {
    const browser = getBrowser();
    if (!browser?.sessionStorage) return storageUnavailable("session", scope);
    try {
      browser.sessionStorage.setItem(SESSION_KEY_PREFIX + key, encodeEnvelope(record));
      return { ok: true };
    } catch (error) {
      return storageUnavailable("session", scope, error);
    }
  },
  remove(scope, key) {
    try {
      getBrowser()?.sessionStorage?.removeItem(SESSION_KEY_PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  clear() {
    const browser = getBrowser();
    if (!browser?.sessionStorage) return;
    try {
      const doomed: string[] = [];
      for (let i = 0; i < browser.sessionStorage.length; i += 1) {
        const name = browser.sessionStorage.key(i);
        if (name !== null && name.startsWith(SESSION_KEY_PREFIX)) doomed.push(name);
      }
      for (const name of doomed) browser.sessionStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
  cost(_scope, _key, record) {
    return record.payload === undefined ? 0 : record.payload.length;
  },
};

/**
 * URL search parameter layer. Only for non-sensitive, shareable UI state.
 * Written onto the *target* entry after a navigation, so links stay shareable.
 */
export const urlLayer: StateLayer = {
  name: "url",
  isAvailable: () => getBrowser() !== null,
  read(scope, key) {
    const browser = getBrowser();
    if (!browser) return null;
    const raw = new URLSearchParams(browser.location.search).get(key);
    if (raw === null) return null;
    return decodeEnvelope(raw, scope, "url");
  },
  write(scope, key, record) {
    const browser = getBrowser();
    if (!browser) return storageUnavailable("url", scope);
    try {
      const params = new URLSearchParams(browser.location.search);
      params.set(key, encodeEnvelope(record));
      // The URL layer owns the address bar only. `history.state` is passed
      // through untouched: neither the router-owned keys nor the history
      // bucket of a scope that did not opt into the `history` layer may be
      // rewritten from here.
      replaceHistoryState(browser.history.state, buildUrl(params.toString()));
      return { ok: true };
    } catch (error) {
      return storageUnavailable("url", scope, error);
    }
  },
  remove(scope, key) {
    const browser = getBrowser();
    if (!browser) return;
    try {
      const params = new URLSearchParams(browser.location.search);
      if (!params.has(key)) return;
      params.delete(key);
      replaceHistoryState(browser.history.state, buildUrl(params.toString()));
    } catch {
      /* ignore */
    }
  },
  clear() {
    /* per-scope removal is enough */
  },
  cost(_scope, _key, record) {
    if (record.payload === undefined) return 0;
    // Percent-encoding is what actually ends up in the address bar.
    return encodeURIComponent(record.payload).length;
  },
};

const sharedLayers: Record<string, StateLayer | undefined> = {
  history: historyLayer,
  session: sessionLayer,
  url: urlLayer,
};

export function getSharedLayer(name: "history" | "session" | "url"): StateLayer {
  const layer = sharedLayers[name];
  if (!layer) throw new Error(`Unknown layer: ${name}`);
  return layer;
}
