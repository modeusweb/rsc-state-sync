import { getDefaultRegistry } from "../core/index.js";
import type {
  NavigationStateOptions,
  NavigationStateRegistry,
} from "../core/index.js";
import { useServerNavigationState, type UseServerNavigationStateResult } from "./use-server-navigation-state.js";

export interface NavigationStateApi {
  registry: NavigationStateRegistry;
  useServerNavigationState<T>(
    scope: string,
    initialState: T,
    options?: NavigationStateOptions<T>,
  ): UseServerNavigationStateResult<T>;
}

/**
 * Creates a self-contained API bound to an explicit registry.
 *
 * Use it when you need isolated instances (tests, HMR, multi-tenant apps,
 * server rendering) instead of the process-wide default registry:
 *
 * ```ts
 * export const navigationState = createNavigationState();
 * const [filters, setFilters] = navigationState.useServerNavigationState("catalog/filters", DEFAULT_FILTERS);
 * ```
 */
export function createNavigationState(
  registry: NavigationStateRegistry = getDefaultRegistry(),
): NavigationStateApi {
  return {
    registry,
    useServerNavigationState<T>(scope: string, initialState: T, options?: NavigationStateOptions<T>) {
      return useServerNavigationState(scope, initialState, options, registry);
    },
  };
}
