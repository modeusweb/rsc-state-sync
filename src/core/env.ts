export interface BrowserEnv {
  history: History;
  location: Location;
  sessionStorage: Storage | null;
}

let cached: BrowserEnv | null | undefined;

/**
 * Detects a browser-like environment. Returns `null` on the server (Node,
 * RSC, edge runtimes) so that importing or rendering this library never
 * touches `window`, `document`, `history`, `location` or `sessionStorage`.
 */
export function getBrowser(): BrowserEnv | null {
  if (cached !== undefined) return cached;
  cached = detect();
  return cached;
}

export function isBrowser(): boolean {
  return getBrowser() !== null;
}

/** Re-runs detection on the next `getBrowser()` call. Used by tests and HMR. */
export function resetBrowserEnv(): void {
  cached = undefined;
}

function detect(): BrowserEnv | null {
  if (typeof window === "undefined") return null;
  if (typeof document === "undefined") return null;
  const history = window.history;
  if (!history || typeof history.replaceState !== "function") return null;
  try {
    const storage = window.sessionStorage ?? null;
    // Some browsers throw (or return dead storages) in privacy mode.
    if (storage) storage.getItem("__probe__");
    return { history, location: window.location, sessionStorage: storage };
  } catch {
    return { history, location: window.location, sessionStorage: null };
  }
}

export function addBrowserListener(type: string, listener: () => void): () => void {
  const browser = getBrowser();
  if (!browser) return () => {};
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}
