import { addBrowserListener } from "./env.js";
import { createHandle, type HandleContext } from "./handle.js";
import { createMemoryLayer } from "./layers.js";
import type {
  BeginNavigationOptions,
  CaptureResult,
  NavigationState,
  NavigationStateRegistry,
  NavigationResult,
  NavigationToken,
  RegistryEntry,
} from "./types.js";

interface InternalToken {
  sequence: number;
  captures: CaptureResult[];
  urlTargets: Array<NavigationState<unknown> & RegistryEntry>;
  resolve: (result: NavigationResult) => void;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  signal: AbortSignal | null;
  onAbort: (() => void) | null;
}

function resolveTargets(
  handles: Map<string, NavigationState<unknown> & RegistryEntry>,
  filter: string[] | "*",
): Array<NavigationState<unknown> & RegistryEntry> {
  if (filter === "*") return [...handles.values()];
  return filter
    .map((scope) => handles.get(scope))
    .filter((handle): handle is NavigationState<unknown> & RegistryEntry => handle !== undefined);
}

/**
 * Creates an isolated registry of serializable navigation state slots.
 *
 * One registry per app is the norm; tests may create many. The registry owns:
 * - the per-registry in-memory layer (so tests are hermetic);
 * - the browser `popstate` listener (installed lazily, once);
 * - the navigation transaction bookkeeping (sequence + supersede rules).
 */
export function createRegistry(): NavigationStateRegistry {
  const handles = new Map<string, NavigationState<unknown> & RegistryEntry>();
  const memoryLayer = createMemoryLayer();
  const tokens = new Map<number, InternalToken>();
  const statusListeners = new Set<() => void>();
  let latestSequence = 0;
  let browserBound = false;
  let removePopstate: (() => void) | null = null;
  let transition: (callback: () => void) => void = (callback) => callback();

  function notifyStatus(): void {
    for (const listener of statusListeners) listener();
  }

  function ensureBrowserListeners(): void {
    if (browserBound) return;
    browserBound = true;
    removePopstate = addBrowserListener("popstate", () => {
      for (const handle of [...handles.values()]) handle.onHistoryChange();
    });
  }

  function unregister(handle: RegistryEntry): void {
    handles.delete(handle.scope);
  }

  const ctx: HandleContext = {
    memoryLayer,
    nextSequence: () => (latestSequence += 1),
    ensureBrowserListeners,
    unregister,
  };

  function finishToken(token: InternalToken, partial: Partial<NavigationResult>): void {
    if (token.settled) return;
    token.settled = true;
    if (token.timer !== null) clearTimeout(token.timer);
    if (token.onAbort) token.signal?.removeEventListener("abort", token.onAbort);
    tokens.delete(token.sequence);
    let captures = token.captures;
    const superseded = partial.superseded === true;
    const aborted = partial.aborted === true;
    if (!superseded && !aborted && token.urlTargets.length > 0) {
      // The router has switched to the target entry: stamp the shareable URL
      // parameters onto it now.
      const urlCaptures = token.urlTargets.map((handle) => handle.capture(token.sequence, "url"));
      captures = [...captures, ...urlCaptures];
    }
    token.resolve({
      sequence: token.sequence,
      committed: !superseded && !aborted && partial.timedOut !== true,
      superseded,
      aborted,
      timedOut: partial.timedOut === true,
      usedViewTransition: partial.usedViewTransition === true,
      captures,
      ...partial,
    });
    notifyStatus();
  }

  function beginNavigation(options: BeginNavigationOptions = {}): NavigationToken {
    const sequence = (latestSequence += 1);
    // A newer navigation supersedes every in-flight one: its snapshots are
    // the ones that may claim the shared layers, and it owns the commit.
    for (const [pendingSequence, token] of [...tokens]) {
      if (pendingSequence !== sequence) finishToken(token, { superseded: true });
    }
    const targets = resolveTargets(handles, options.scopes ?? "*");
    const captures: CaptureResult[] = [];
    if (options.historyUpdate !== false) {
      for (const handle of targets) captures.push(handle.capture(sequence, "leave"));
    }
    const urlTargets = options.urlUpdate === false ? [] : targets.filter((h) => h.usesUrl);
    let resolve!: (result: NavigationResult) => void;
    const promise = new Promise<NavigationResult>((res) => {
      resolve = res;
    });
    const token: InternalToken = {
      sequence,
      captures,
      urlTargets,
      resolve,
      settled: false,
      timer: null,
      signal: options.signal ?? null,
      onAbort: null,
    };
    tokens.set(sequence, token);
    token.timer = setTimeout(
      () => finishToken(token, { timedOut: true }),
      options.commitTimeout ?? 3000,
    );
    if (options.signal) {
      const signal = options.signal;
      if (signal.aborted) {
        finishToken(token, { aborted: true });
      } else {
        token.onAbort = () => finishToken(token, { aborted: true });
        signal.addEventListener("abort", token.onAbort, { once: true });
      }
    }
    notifyStatus();
    return {
      sequence,
      scopes: targets.map((handle) => handle.scope),
      promise,
      settle: (result) => finishToken(token, result ?? {}),
    };
  }

  const registry: NavigationStateRegistry = {
    get(scope, initialState, options) {
      const existing = handles.get(scope);
      if (existing) return existing as NavigationState<unknown> as never;
      const handle = createHandle(scope, initialState, options ?? {}, ctx);
      handles.set(scope, handle);
      return handle as NavigationState<unknown> as never;
    },
    has: (scope) => handles.has(scope),
    keys: () => [...handles.keys()],
    delete(scope) {
      const handle = handles.get(scope);
      if (!handle) return false;
      handle.dispose();
      return true;
    },
    capture(scopes) {
      const targets = resolveTargets(handles, scopes ?? "*");
      const sequence = (latestSequence += 1);
      return targets.map((handle) => handle.capture(sequence, "all"));
    },
    clear() {
      for (const handle of handles.values()) handle.clear();
      memoryLayer.clear();
    },
    dispose() {
      for (const [, token] of [...tokens]) finishToken(token, { superseded: true });
      for (const handle of [...handles.values()]) handle.dispose();
      removePopstate?.();
      removePopstate = null;
      browserBound = false;
      statusListeners.clear();
    },
    beginNavigation,
    notifyCommit(sequence, result) {
      const token = tokens.get(sequence);
      if (!token) return;
      finishToken(token, result ?? {});
    },
    status() {
      return { pending: tokens.size, latestSequence, isNavigating: tokens.size > 0 };
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => void statusListeners.delete(listener);
    },
    get defaultTransition() {
      return transition;
    },
    setDefaultTransition(next) {
      transition = next;
    },
  };

  return registry;
}
