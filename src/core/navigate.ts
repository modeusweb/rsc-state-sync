import { DEFAULT_COMMIT_TIMEOUT } from "./constants.js";
import { getStartViewTransition, supportsViewTransitions } from "./view-transition.js";
import { createRegistry } from "./registry.js";
import type {
  BeginNavigationOptions,
  NavigationResult,
  NavigationStateRegistry,
} from "./types.js";

export interface NavigateWithStateOptions extends BeginNavigationOptions {
  /** Registry to use. Defaults to the module-level shared registry. */
  registry?: NavigationStateRegistry;
  /**
   * Wrap the DOM update in `document.startViewTransition` when the browser
   * supports it. Default: `true` (it degrades to a plain navigation).
   */
  useViewTransition?: boolean;
  /** Called once the navigation settles (commit, supersede, abort or timeout). */
  onSettled?: (result: NavigationResult) => void;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Runs `navigate` inside a state-preserving navigation transaction:
 *
 * 1. authoritative snapshots of every registered scope are stamped onto the
 *    *leaving* history entry (before the router touches `history`);
 * 2. the router navigates (optionally inside `startViewTransition` and/or
 *    the registry's `defaultTransition`, e.g. React `startTransition`);
 * 3. when the framework adapter reports the commit, the shareable URL
 *    parameters are stamped onto the *target* entry.
 *
 * Works with any router function (`router.push`, `router.back`, custom).
 */
export function navigateWithState(
  navigate: () => void | Promise<unknown>,
  options: NavigateWithStateOptions = {},
): Promise<NavigationResult> {
  const registry = options.registry ?? defaultRegistryRef();
  const { commitTimeout, ...rest } = options;
  const token = registry.beginNavigation({
    ...rest,
    commitTimeout: commitTimeout ?? DEFAULT_COMMIT_TIMEOUT,
  });

  const start = (): void => {
    let maybe: void | Promise<unknown> = undefined;
    try {
      registry.defaultTransition(() => {
        maybe = navigate();
      });
    } catch (error) {
      registry.notifyCommit(token.sequence, { error, aborted: true });
      return;
    }
    if (isPromiseLike(maybe)) {
      // Some routers resolve when the transition has fully landed; use that
      // as an extra commit signal. Rejection settles without a commit.
      maybe.then(
        () => registry.notifyCommit(token.sequence),
        (error: unknown) => registry.notifyCommit(token.sequence, { error, aborted: true }),
      );
    }
  };

  let usedViewTransition = false;
  if (options.useViewTransition !== false && supportsViewTransitions()) {
    const startViewTransition = getStartViewTransition();
    if (startViewTransition) {
      usedViewTransition = true;
      startViewTransition(async () => {
        start();
        // Hold the old snapshot on screen until the router has committed.
        await token.promise;
      });
    } else {
      start();
    }
  } else {
    start();
  }

  return token.promise.then((result) => {
    const merged: NavigationResult = { ...result, usedViewTransition };
    options.onSettled?.(merged);
    return merged;
  });
}

/**
 * Indirection so that `navigate.ts` can stay decoupled from the module-level
 * registry (and stay tree-shakeable for registry-per-app consumers).
 */
let sharedRegistry: NavigationStateRegistry | null = null;

export function getDefaultRegistry(): NavigationStateRegistry {
  return defaultRegistryRef();
}

export function setDefaultRegistry(registry: NavigationStateRegistry | null): void {
  sharedRegistry = registry;
}

function defaultRegistryRef(): NavigationStateRegistry {
  if (!sharedRegistry) {
    // Lazy init: create a default registry on first use. This allows
    // consumers to import from subpaths (e.g. 'rsc-state-sync/react') without
    // explicitly importing the root entry first.
    sharedRegistry = createRegistry();
  }
  return sharedRegistry;
}
