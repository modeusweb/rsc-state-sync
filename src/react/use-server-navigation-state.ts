import { useSyncExternalStore } from "react";
import { getDefaultRegistry } from "../core/index.js";
import type {
  NavigationState,
  NavigationStateOptions,
  NavigationStateRegistry,
} from "../core/index.js";

export type UseServerNavigationStateResult<T> = readonly [
  state: T,
  setState: (next: T | ((prev: T) => T)) => void,
  handle: NavigationState<T>,
];

/**
 * Preserves serializable client UI state across React Server Component
 * navigations.
 *
 * ```ts
 * const [filters, setFilters] = useServerNavigationState("catalog/filters", DEFAULT_FILTERS, {
 *   persist: "navigation",
 * });
 * ```
 *
 * - Server render and hydration always see `initialState`, so there are no
 *   hydration mismatches. The persisted value is applied lazily, right after
 *   hydration.
 * - The first registration of a scope wins its `initialState` and options;
 *   later mounts of the same scope share the same slot.
 * - `setState` never serializes. Serialization happens only when the state
 *   actually changes and a navigation captures it (or on an explicit
 *   `replaceState`/`capture`).
 */
export function useServerNavigationState<T>(
  scope: string,
  initialState: T,
  options?: NavigationStateOptions<T> & { registry?: NavigationStateRegistry },
  registryArg?: NavigationStateRegistry,
): UseServerNavigationStateResult<T> {
  const registry = registryArg ?? options?.registry ?? getDefaultRegistry();
  // Idempotent: returns the existing slot when the scope is already known.
  const handle = registry.get(scope, initialState, options);
  const state = useSyncExternalStore(handle.subscribe, handle.getState, handle.getServerState);
  return [state, handle.setState, handle] as const;
}
