export { ENVELOPE_FORMAT, HISTORY_STATE_KEY, PRESET_LAYERS, DEFAULT_MAX_CHARS, defaultUrlKey } from "./constants.js";
export { StateSyncError, isStateSyncError } from "./errors.js";
export { createRegistry } from "./registry.js";
export { navigateWithState, type NavigateWithStateOptions } from "./navigate.js";
export { createJsonSerializer, jsonSerializer } from "./serializer.js";
export { supportsViewTransitions } from "./view-transition.js";
export { createMemoryLayer, historyLayer, sessionLayer, urlLayer } from "./layers.js";
export type {
  BeginNavigationOptions,
  CaptureError,
  CaptureMode,
  CaptureResult,
  LayerWriteResult,
  NavigationResult,
  NavigationState,
  NavigationStateOptions,
  NavigationStateRegistry,
  NavigationStatus,
  NavigationToken,
  PersistOption,
  RegistryEntry,
  StateLayer,
  StateSchema,
  StateSerializer,
  StorageLayerName,
  StorageStrategy,
  StoredRecord,
} from "./types.js";

import { createRegistry } from "./registry.js";
import { setSharedRegistry } from "./navigate.js";
import type { NavigationStateRegistry } from "./types.js";

let shared: NavigationStateRegistry | null = null;

/**
 * The process-wide default registry used by `navigateWithState` and the
 * framework adapters when no explicit registry is passed.
 */
export function getDefaultRegistry(): NavigationStateRegistry {
  if (!shared) {
    shared = createRegistry();
    setSharedRegistry(shared);
  }
  return shared;
}

/** Replaces (or removes) the default registry. Mostly for tests and HMR. */
export function setDefaultRegistry(registry: NavigationStateRegistry | null): void {
  shared = registry;
  setSharedRegistry(registry);
}
