import { DEFAULT_MAX_CHARS, PRESET_LAYERS, defaultUrlKey } from "./constants.js";
import { StateSyncError } from "./errors.js";
import { getBrowser, isBrowser } from "./env.js";
import { getSharedLayer, historyLayer } from "./layers.js";
import { createJsonSerializer } from "./serializer.js";
import type {
  CaptureMode,
  CaptureResult,
  NavigationState,
  NavigationStateOptions,
  RegistryEntry,
  StateLayer,
  StateSerializer,
  StorageLayerName,
  StoredRecord,
} from "./types.js";

export interface HandleContext {
  memoryLayer: StateLayer;
  nextSequence(): number;
  ensureBrowserListeners(): void;
  unregister(handle: RegistryEntry): void;
}

function resolveLayerNames(persist: NavigationStateOptions<unknown>["persist"]): StorageLayerName[] {
  if (persist === undefined) return PRESET_LAYERS.navigation;
  if (Array.isArray(persist)) return persist;
  const preset = PRESET_LAYERS[persist];
  if (preset) return preset;
  return [persist as StorageLayerName];
}

function maxCharsFor<T>(layer: StorageLayerName, options: NavigationStateOptions<T>): number {
  const { maxSize } = options;
  if (typeof maxSize === "number") return maxSize;
  if (maxSize && maxSize[layer] !== undefined) return maxSize[layer] as number;
  return DEFAULT_MAX_CHARS[layer] ?? Number.POSITIVE_INFINITY;
}

/**
 * Creates one serializable navigation state slot.
 *
 * The handle is framework agnostic: it never imports React and never touches
 * browser APIs during construction or while rendering on the server.
 */
export function createHandle<T>(
  scope: string,
  initialState: T,
  options: NavigationStateOptions<T>,
  ctx: HandleContext,
): NavigationState<T> & RegistryEntry {
  const serializer: StateSerializer<T> = options.serializer ?? createJsonSerializer<T>();
  const version = options.version ?? 1;
  const ttl = options.ttl ?? 0;
  const isEqual = options.isEqual ?? Object.is;
  const writeUrl = options.writeUrl ?? "capture";
  const enrichHistory = options.enrichHistory === true;
  const strict = options.strict === true;
  const ephemeral = resolveLayerNames(options.persist).length === 0;

  const names = resolveLayerNames(options.persist);
  const layers: StateLayer[] = names.map((name) =>
    name === "memory" ? ctx.memoryLayer : getSharedLayer(name),
  );
  const urlKey = options.urlKey ?? defaultUrlKey(scope);
  const keyFor = (layer: StateLayer): string => (layer.name === "url" ? urlKey : scope);

  let state: T = initialState;
  let initialized = false;
  let disposed = false;
  let revision = 0;
  let refCount = 0;
  let cachedPayload: { revision: number; payload: string } | null = null;
  let persistScheduled = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function report(error: StateSyncError): void {
    if (strict) throw error;
    options.onError?.(error);
  }

  function readLayer(layer: StateLayer): StoredRecord | null {
    try {
      return layer.isAvailable() ? layer.read(scope, keyFor(layer)) : null;
    } catch (error) {
      report(error as StateSyncError);
      return null;
    }
  }

  function serializeCurrent(): string {
    if (cachedPayload && cachedPayload.revision === revision) return cachedPayload.payload;
    let payload: string;
    try {
      payload = serializer.serialize(state);
    } catch (error) {
      throw new StateSyncError("SERIALIZE_FAILED", "State is not serializable", {
        scope,
        cause: error,
      });
    }
    cachedPayload = { revision, payload };
    return payload;
  }

  /** Applies a persisted record. Returns `false` when the record is rejected. */
  function applyRecord(record: StoredRecord): boolean {
    if (record.v !== version) {
      report(new StateSyncError("VERSION_MISMATCH", "Persisted state version mismatch", { scope }));
      return false;
    }
    if (ttl > 0 && Date.now() - record.t > ttl) {
      report(new StateSyncError("EXPIRED", "Persisted state expired", { scope }));
      return false;
    }
    let value: unknown;
    if (record.payload === undefined) {
      value = record.value;
    } else {
      try {
        value = serializer.deserialize(record.payload);
      } catch (error) {
        report(new StateSyncError("DESERIALIZE_FAILED", "Persisted state could not be decoded", { scope, cause: error }));
        return false;
      }
    }
    if (options.validate && !options.validate(value)) {
      report(new StateSyncError("VALIDATION_FAILED", "Restored state failed validation", { scope }));
      return false;
    }
    if (options.schema) {
      try {
        value = options.schema.parse(value);
      } catch (error) {
        report(new StateSyncError("VALIDATION_FAILED", "Restored state failed schema parsing", { scope, cause: error }));
        return false;
      }
    }
    revision = Math.max(revision, record.r);
    applyValue(value as T);
    return true;
  }

  /** Sets the state without persisting. Notifies subscribers on real changes. */
  function applyValue(next: T): boolean {
    if (isEqual(state, next)) return false;
    state = next;
    for (const listener of listeners) listener();
    return true;
  }

  /**
   * Restore priority:
   * 1. an authoritative snapshot of the *current* history entry;
   * 2. the first available record in the configured layer order;
   * 3. whatever the slot already holds.
   */
  function resolve(): void {
    if (disposed) return;
    const browser = getBrowser();
    if (!browser) return;
    const historyConfigured = layers.includes(historyLayer);
    let historyTried: StoredRecord | null = null;
    if (historyConfigured) {
      historyTried = readLayer(historyLayer);
      if (historyTried && historyTried.a && applyRecord(historyTried)) return;
    }
    for (const layer of layers) {
      if (layer.name === "history") continue; // already consulted above
      const record = readLayer(layer);
      if (record && applyRecord(record)) return;
    }
    if (historyConfigured && historyTried && !historyTried.a && applyRecord(historyTried)) {
      return;
    }
  }

  /**
   * Opportunistic, non-authoritative snapshot of the current history entry.
   *
   * Keeps the entry the user is *on* fresh, so that a navigation performed
   * outside a transaction (a plain `<Link>`, an unregistered router API, a full
   * page load) still leaves a usable snapshot behind for back/forward.
   *
   * An authoritative snapshot — one produced by a real navigation capture — is
   * never downgraded.
   */
  function enrichCurrentEntry(): void {
    if (!enrichHistory || revision === 0) return;
    if (!layers.includes(historyLayer)) return;
    const existing = readLayer(historyLayer);
    if (existing?.a) return;
    persistAll(ctx.nextSequence(), "enrich");
  }

  function ensureInit(): void {
    if (initialized || disposed) return;
    initialized = true;
    if (!isBrowser()) return;
    ctx.ensureBrowserListeners();
    resolve();
    enrichCurrentEntry();
  }

  /**
   * Writes the current state into the requested layers. The payload is
   * serialized once per revision and shared by every text layer.
   */
  function persistAll(sequence: number, mode: CaptureMode): CaptureResult {
    const result: CaptureResult = { scope, sequence, revision, persisted: [], skipped: [] };
    if (disposed || !isBrowser()) return result;
    const timestamp = Date.now();
    // A capture mode never smuggles in a layer the slot did not opt into
    // (e.g. `url` on a `persist: ["memory"]` slot).
    const wanted: StorageLayerName[] = (
      mode === "all"
        ? names
        : mode === "leave"
          ? names.filter((name) => name !== "url")
          : mode === "enrich"
            ? names.filter((name) => name === "history")
            : (["url"] as StorageLayerName[])
    ).filter((name) => names.includes(name));
    // `idle` and `enrich` writes are opportunistic: they must not claim
    // authority over a snapshot produced by a real navigation.
    const authoritative = mode !== "idle" && mode !== "enrich";
    let payload: string | null = null;
    for (const name of wanted) {
      const layer = name === "memory" ? ctx.memoryLayer : getSharedLayer(name);
      const record: StoredRecord = { v: version, r: revision, t: timestamp, a: authoritative };
      if (name === "memory") {
        record.value = state;
      } else {
        if (payload === null) payload = serializeCurrent();
        record.payload = payload;
        const cost = layer.cost(scope, keyFor(layer), record);
        const max = maxCharsFor(layer.name, options);

        if (cost > max) {
          result.skipped.push({
            layer: name,
            error: new StateSyncError("TOO_LARGE", `Payload of ${cost} chars exceeds the ${max}-char limit of the "${name}" layer`, { scope, layer: name }),
          });
          continue;
        }
      }
      try {
        const writeResult = layer.write(scope, keyFor(layer), record);
        if (writeResult.ok) result.persisted.push(name);
        else {
          report(writeResult.error);
          result.skipped.push({ layer: name, error: writeResult.error });
        }
      } catch (error) {
        report(error as StateSyncError);
        result.skipped.push({
          layer: name,
          error: new StateSyncError("STORAGE_UNAVAILABLE", `Write to the "${name}" layer failed`, { scope, layer: name }),
        });
      }
    }
    return result;
  }

  /**
   * Coalesces bursts of `setState` into a single non-authoritative write.
   *
   * `session` and `url` (with `writeUrl: "immediate"`) are kept in sync for
   * reloads and shareable links; the history enrichment keeps the entry the
   * user is on usable for back/forward even if the app navigates without a
   * transaction.
   */
  function schedulePersist(): void {
    if (persistScheduled) return;
    const needsUrl = writeUrl === "immediate" && layers.some((l) => l.name === "url");
    const needsSession = layers.some((l) => l.name === "session");
    const needsEnrich = enrichHistory && layers.includes(historyLayer);
    if (!needsUrl && !needsSession && !needsEnrich) return;
    persistScheduled = true;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistScheduled = false;
      if (disposed) return;
      if (needsUrl || needsSession) persistAll(ctx.nextSequence(), needsUrl ? "all" : "idle");
      if (needsEnrich) enrichCurrentEntry();
    }, 0);
  }

  /** Drops a pending debounced write (state is being cleared or the slot dies). */
  function cancelScheduledPersist(): void {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = null;
    persistScheduled = false;
  }

  function update(next: T | ((prev: T) => T), commit: boolean): void {
    ensureInit();
    if (disposed) return;
    const value = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
    if (!applyValue(value)) return;
    revision += 1;
    cachedPayload = null;
    if (commit) {
      persistAll(ctx.nextSequence(), "all");
    } else {
      schedulePersist();
    }
  }

  const handle: NavigationState<T> & RegistryEntry = {
    scope,
    getState() {
      ensureInit();
      return state;
    },
    getServerState() {
      return initialState;
    },
    subscribe(listener) {
      refCount += 1;
      ensureInit();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        refCount -= 1;
        if (refCount <= 0 && ephemeral) {
          disposed = true;
          listeners.clear();
          ctx.unregister(handle);
        }
      };
    },
    setState(next) {
      update(next, false);
    },
    replaceState(next) {
      update(next, true);
    },
    reset() {
      applyValue(initialState);
      revision += 1;
      cachedPayload = null;
      handle.clear();
    },
    capture(sequence?: number, mode?: CaptureMode) {
      ensureInit();
      return persistAll(sequence ?? ctx.nextSequence(), mode ?? "all");
    },
    hydrate(force) {
      if (force) {
        resolve();
      } else {
        ensureInit();
      }
      return state;
    },
    clear() {
      cancelScheduledPersist();
      for (const layer of layers) {
        try {
          layer.remove(scope, keyFor(layer));
        } catch (error) {
          report(error as StateSyncError);
        }
      }
    },
    dispose() {
      disposed = true;
      cancelScheduledPersist();
      listeners.clear();
      ctx.unregister(handle);
    },
    onHistoryChange() {
      if (!initialized) return;
      resolve();
    },
    ephemeral,
    usesUrl: names.includes("url"),
  };

  return handle;
}

