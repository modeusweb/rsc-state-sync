import type { StateSyncError } from "./errors.js";

/** A single persistence layer. */
export type StorageLayerName = "url" | "history" | "memory" | "session";

/**
 * Named persistence presets, or an explicit, priority-ordered list of layers.
 *
 * The list order is the *restore* priority (first available record wins,
 * after the current history entry's authoritative snapshot) and the set of
 * layers that receive writes.
 */
export type StorageStrategy = StorageLayerName | "navigation" | "none";
export type PersistOption = StorageStrategy | StorageLayerName[];

/** Turns a value into a string and back. */
export interface StateSerializer<T = unknown> {
  serialize(value: T): string;
  deserialize(value: string): T;
}

/** Minimal structural contract for schema libraries (zod, valibot, ...). */
export interface StateSchema<T> {
  parse(value: unknown): T;
}

export interface NavigationStateOptions<T> {
  /**
   * Where the state is persisted. Defaults to `"navigation"`
   * (`["memory", "history"]`).
   */
  persist?: PersistOption;
  /** Custom serializer. Defaults to the built-in tagged JSON serializer. */
  serializer?: StateSerializer<T>;
  /** Schema version. Persisted records with another version are discarded. */
  version?: number;
  /** Time to live in milliseconds. `0` (default) means "never expires". */
  ttl?: number;
  /** Maximum serialized payload size, in characters, per layer. */
  maxSize?: number | Partial<Record<StorageLayerName, number>>;
  /** Type guard run on every restored value. */
  validate?: (value: unknown) => value is T;
  /** Schema-library integration, alternative to `validate`. */
  schema?: StateSchema<T>;
  /** Change detection for `setState`. Defaults to `Object.is`. */
  isEqual?: (a: T, b: T) => boolean;
  /** Search parameter name used by the `url` layer. */
  urlKey?: string;
  /**
   * `"capture"` (default): URL params are written once per navigation.
   * `"immediate"`: every `setState` also rewrites the URL.
   */
  writeUrl?: "capture" | "immediate";
  /**
   * Keep the history entry the user is *currently on* up to date with a
   * non-authoritative snapshot (debounced, never overwriting a snapshot
   * produced by a real navigation capture).
   *
   * This is what makes back/forward work when the app navigates without a
   * transaction — a plain `<Link>`, a router API the library was not told
   * about, a full page load. Default: `false` (opt-in).
   */
  enrichHistory?: boolean;
  /** Report (instead of swallow) recoverable errors. */
  onError?: (error: StateSyncError) => void;
  /** Throw on recoverable errors instead of degrading gracefully. */
  strict?: boolean;
}

export interface CaptureError {
  layer: StorageLayerName;
  error: StateSyncError;
}

export interface CaptureResult {
  scope: string;
  sequence: number;
  revision: number;
  /** Layers that received the snapshot. */
  persisted: StorageLayerName[];
  /** Layers that refused the snapshot (oversized, unavailable, ...). */
  skipped: CaptureError[];
}

/**
 * A persisted snapshot. Text layers carry `payload`, the memory layer carries
 * the raw `value` (zero-cost fast path, no serialization round-trip).
 */
export interface StoredRecord {
  /** User schema version. */
  v: number;
  /** Monotonic revision of the state slot. */
  r: number;
  /** Creation timestamp (for TTL). */
  t: number;
  /** Authoritative snapshots win over the live in-session state. */
  a: boolean;
  value?: unknown;
  payload?: string;
}

export type LayerWriteResult = { ok: true } | { ok: false; error: StateSyncError };

/** A single persistence backend. All methods are environment-safe. */
export interface StateLayer {
  readonly name: StorageLayerName;
  isAvailable(): boolean;
  read(scope: string, key: string): StoredRecord | null;
  write(scope: string, key: string, record: StoredRecord): LayerWriteResult;
  remove(scope: string, key: string): void;
  clear(): void;
  /** Storage cost of the record, in characters (text layers only). */
  cost(scope: string, key: string, record: StoredRecord): number;
}

export interface NavigationResult {
  sequence: number;
  /** The navigation completed and was not superseded or aborted. */
  committed: boolean;
  /** A newer navigation started before this one finished. */
  superseded: boolean;
  /** The provided `AbortSignal` fired. */
  aborted: boolean;
  /** No commit signal arrived before `commitTimeout`. */
  timedOut: boolean;
  /** `document.startViewTransition` was used. */
  usedViewTransition: boolean;
  captures: CaptureResult[];
  error?: unknown;
}

export interface NavigationToken {
  readonly sequence: number;
  readonly scopes: string[];
  readonly promise: Promise<NavigationResult>;
  /** Force-finish the navigation (used by adapters that own the commit signal). */
  settle(result?: Partial<NavigationResult>): void;
}

export interface BeginNavigationOptions {
  /** Scopes to capture, or `"*"` for every registered scope. */
  scopes?: string[] | "*";
  /** Expected target location used by framework adapters to correlate commits. */
  expectedDestination?: string;
  /** Write authoritative snapshots into the current history entry. Default `true`. */
  historyUpdate?: boolean;
  /** Write URL parameters onto the target entry. Default `true`. */
  urlUpdate?: boolean;
  /** Give up waiting for a commit after this many ms. Default `3000`. */
  commitTimeout?: number;
  /** Abort the navigation. */
  signal?: AbortSignal;
}

export interface NavigationStatus {
  /** Number of in-flight navigations. */
  pending: number;
  /** Monotonic sequence of the most recently started navigation. */
  latestSequence: number;
  isNavigating: boolean;
}

/** A registered, serializable navigation state slot. */
export interface NavigationState<T> {
  readonly scope: string;
  /** Current state. Lazily hydrates from the configured layers on first read. */
  getState(): T;
  /**
   * Deterministic value used during server rendering and hydration. Never
   * touches browser APIs and therefore never causes hydration mismatches.
   */
  getServerState(): T;
  subscribe(listener: () => void): () => void;
  /** Update in-memory state (and the `url` layer when `writeUrl: "immediate"`). */
  setState(next: T | ((prev: T) => T)): void;
  /** Update state *and* commit it to the persistence layers right now. */
  replaceState(next: T | ((prev: T) => T)): void;
  /** Restore the initial state and drop every persisted record. */
  reset(): void;
  /** Persist the current state now (starts a new navigation sequence). */
  capture(sequence?: number, mode?: CaptureMode): CaptureResult;
  /** Re-read the persistence layers. `force` bypasses the "already applied" check. */
  hydrate(force?: boolean): T;
  /** Re-read persistence layers after a history traversal (back/forward). */
  onHistoryChange(): void;
  /** Remove every persisted record without touching the in-memory state. */
  clear(): void;
  /** Detach the handle from the registry. */
  dispose(): void;
}

/** Internal view of a handle used by the registry. */
export interface RegistryEntry {
  readonly scope: string;
  getState(): unknown;
  subscribe(listener: () => void): () => void;
  capture(sequence: number, mode: CaptureMode): CaptureResult;
  onHistoryChange(): void;
  dispose(): void;
  /** Dropped automatically when the last subscriber leaves. */
  readonly ephemeral: boolean;
  /** Whether the `url` layer is part of the persistence configuration. */
  readonly usesUrl: boolean;
}

/**
 * Which layers a capture touches.
 *
 * - `all`: every configured layer (`capture`, `replaceState`).
 * - `leave`: everything except `url` (the leaving history entry, before the
 *   router swaps entries).
 * - `url`: the `url` layer only (after the navigation commits).
 * - `enrich`: a non-authoritative snapshot of the current history entry.
 * - `idle`: opportunistic, non-authoritative write of the `session` layer.
 */
export type CaptureMode = "leave" | "url" | "all" | "idle" | "enrich";

export interface NavigationStateRegistry {
  /** Get (or create) the handle for `scope`. The first registration wins its options. */
  get<T>(scope: string, initialState: T, options?: NavigationStateOptions<T>): NavigationState<T>;
  has(scope: string): boolean;
  keys(): string[];
  delete(scope: string): boolean;
  /** Capture the given scopes (default: all). */
  capture(scopes?: string[] | "*"): CaptureResult[];
  /** Remove every persisted record of every scope. */
  clear(): void;
  dispose(): void;
  /** Start a navigation transaction: capture scopes and return a settle token. */
  beginNavigation(options?: BeginNavigationOptions): NavigationToken;
  /** Resolve the commit signal of a navigation (called by framework adapters). */
  notifyCommit(sequence: number, result?: Partial<NavigationResult>, destination?: string): void;
  /** Check whether a commit signal matches the transaction's expected destination. */
  canCommit(sequence: number, destination?: string): boolean;
  status(): NavigationStatus;
  subscribeStatus(listener: () => void): () => void;
  /** Pluggable transition runner (React adapters install `startTransition`). */
  defaultTransition: (callback: () => void) => void;
  setDefaultTransition(transition: (callback: () => void) => void): void;
}

