import { useCallback, useSyncExternalStore } from "react";
import { getDefaultRegistry } from "../core/index.js";
import type { NavigationStateRegistry } from "../core/index.js";

/** Reflects the registry's navigation transaction state. */
export function useIsNavigating(registryArg?: NavigationStateRegistry): boolean {
  const registry = registryArg ?? getDefaultRegistry();
  const subscribe = useCallback(
    (listener: () => void) => registry.subscribeStatus(listener),
    [registry],
  );
  const getSnapshot = useCallback(() => registry.status().isNavigating, [registry]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
