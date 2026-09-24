"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { navigateWithState } from "../core/index.js";
import type { NavigateWithStateOptions, NavigationResult } from "../core/index.js";

export interface StateNavigationOptions extends NavigateWithStateOptions {
  /** Forwarded to the Next.js router (`scroll` behavior). */
  scroll?: boolean;
}

export interface UseNavigateWithStateResult {
  push(href: string, options?: StateNavigationOptions): Promise<NavigationResult>;
  replace(href: string, options?: StateNavigationOptions): Promise<NavigationResult>;
  back(options?: StateNavigationOptions): Promise<NavigationResult>;
  forward(options?: StateNavigationOptions): Promise<NavigationResult>;
}

/**
 * Next.js App Router navigation functions that preserve serializable client
 * state across server re-renders.
 *
 * ```ts
 * const navigate = useNavigateWithState();
 * <button onClick={() => navigate.push("/catalog?page=2")}>Next page</button>
 * ```
 *
 * Plain `<Link>` navigations are also supported as long as
 * `useNavigationCommitSignal` is mounted — they just skip the explicit
 * transaction and rely on the location-change commit signal.
 */
export function useNavigateWithState(
  defaultOptions: StateNavigationOptions = {},
): UseNavigateWithStateResult {
  const router = useRouter();
  const routerRef = useRef(router);
  const optionsRef = useRef(defaultOptions);
  // Keep "latest" refs fresh without writing during render (react-hooks/refs).
  useEffect(() => {
    routerRef.current = router;
    optionsRef.current = defaultOptions;
  });

  const run = useCallback(
    (action: (router: ReturnType<typeof useRouter>) => void, options?: StateNavigationOptions, href?: string) => {
      const merged = { ...optionsRef.current, ...options };
      const expectedDestination = href === undefined
        ? undefined
        : (() => {
            const url = new URL(href, window.location.href);
            return `${url.pathname}${url.search}`;
          })();
      return navigateWithState(() => action(routerRef.current), { ...merged, expectedDestination });
    },
    [],
  );

  return {
    push: (href, options) => run((r) => r.push(href, { scroll: options?.scroll }), options, href),
    replace: (href, options) => run((r) => r.replace(href, { scroll: options?.scroll }), options, href),
    back: (options) => run((r) => r.back(), options),
    forward: (options) => run((r) => r.forward(), options),
  };
}
