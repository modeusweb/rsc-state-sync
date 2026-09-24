export { ENVELOPE_FORMAT, HISTORY_STATE_KEY, PRESET_LAYERS, DEFAULT_MAX_CHARS, defaultUrlKey } from "./constants.js";
export { StateSyncError, isStateSyncError } from "./errors.js";
export { createRegistry } from "./registry.js";
export { navigateWithState, type NavigateWithStateOptions } from "./navigate.js";
export { createJsonSerializer, jsonSerializer } from "./serializer.js";
export { supportsViewTransitions } from "./view-transition.js";
export { createMemoryLayer, historyLayer, sessionLayer, urlLayer } from "./layers.js";
export type {
  BeginNavigationOptions,
  BuiltInStorageLayerName,
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
  RegistryOptions,
  StateLayer,
  StateSchema,
  StateSerializer,
  StateSyncDiagnosticEvent,
  StateSyncDiagnosticSink,
  StorageLayerName,
  StorageStrategy,
  StoredRecord,
} from "./types.js";

import { getDefaultRegistry as getDefaultRegistryImpl, setDefaultRegistry as setDefaultRegistryImpl } from "./navigate.js";

/**
 * The process-wide default registry used by `navigateWithState` and the
 * framework adapters when no explicit registry is passed.
 * Created lazily on first access.
 */
export function getDefaultRegistry() {
  return getDefaultRegistryImpl();
}

/** Replaces (or removes) the default registry. Mostly for tests and HMR. */
export function setDefaultRegistry(registry: ReturnType<typeof getDefaultRegistry> | null): void {
  setDefaultRegistryImpl(registry);
}
