"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getDefaultRegistry } from "../core/index.js";
import type { NavigationStateRegistry } from "../core/index.js";

/**
 * Wires the framework-agnostic registry into Next.js App Router.
 *
 * Render this once in a client component (e.g. a client `Providers` component
 * mounted from the root layout). It does two things:
 *
 * 1. Installs React's `startTransition` as the registry's transition runner,
 *    so captured state is committed before the router swaps history entries.
 * 2. Detects the moment a navigation has landed and stamps the shareable URL
 *    parameters onto the *target* history entry. Two independent, idempotent
 *    signals are used:
 *    - the `useTransition` pending flag turning off (RSC payload arrived);
 *    - a location change (covers plain `<Link>` navigations and instant
 *      client-cache hits that never produce a pending transition).
 */
export function useNavigationCommitSignal(registryArg?: NavigationStateRegistry): void {
  const registry = registryArg ?? getDefaultRegistry();
  const [isPending, startTransition] = useTransition();
  const startRef = useRef(startTransition);
  useEffect(() => {
    startRef.current = startTransition;
  }, [startTransition]);

  useEffect(() => {
    registry.setDefaultTransition((callback) => startRef.current(callback));
  }, [registry]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  // Signal 1: our own transition finished rendering.
  const wasPending = useRef(false);
  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      const sequence = registry.status().latestSequence;
      if (registry.canCommit(sequence, locationKey)) {
        registry.notifyCommit(sequence, undefined, locationKey);
      }
    }
  }, [isPending, locationKey, registry]);

  // Signal 2: the URL changed (target entry is now current).
  const previousLocation = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = locationKey;
    if (previous !== null && previous !== locationKey) {
      const sequence = registry.status().latestSequence;
      if (registry.canCommit(sequence, locationKey)) {
        registry.notifyCommit(sequence, undefined, locationKey);
      }
    }
  }, [locationKey, registry]);
}
