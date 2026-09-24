import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRegistry } from "../src/core/index.js";
import type { NavigationStateRegistry } from "../src/core/index.js";
import { useNavigateWithState } from "../src/next/use-navigate-with-state.js";
import { useNavigationCommitSignal } from "../src/next/use-navigation-commit-signal.js";

// Mutable module-level state read by the mocked next/navigation hooks.
let mockPathname = "/catalog";
let mockSearch = "";
const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => routerMock,
}));

describe("next/useNavigationCommitSignal", () => {
  let registry: NavigationStateRegistry;

  beforeEach(() => {
    registry = createRegistry();
    mockPathname = "/catalog";
    mockSearch = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    registry.dispose();
    vi.useRealTimers();
  });

  it("installs the registry default transition on mount", () => {
    renderHook(() => useNavigationCommitSignal(registry));
    let wrapped = false;
    registry.defaultTransition(() => {
      wrapped = true;
    });
    expect(wrapped).toBe(true);
  });

  it("commits a pending navigation when the location changes (plain <Link>)", async () => {
    const token = registry.beginNavigation({});
    expect(registry.status().pending).toBe(1);

    const { rerender } = renderHook(() => useNavigationCommitSignal(registry));
    act(() => {
      mockPathname = "/catalog";
      mockSearch = "page=2";
      rerender();
    });

    expect(registry.status().pending).toBe(0);
    const result = await token.promise;
    expect(result.committed).toBe(true);
    expect(result.timedOut).toBe(false);
  });

  it("does not commit a transaction at the wrong destination", async () => {
    vi.useFakeTimers();
    const token = registry.beginNavigation({ expectedDestination: "/catalog?page=2", commitTimeout: 20 });
    const { rerender } = renderHook(() => useNavigationCommitSignal(registry));
    act(() => {
      mockPathname = "/catalog";
      mockSearch = "page=3";
      rerender();
    });
    expect(registry.status().pending).toBe(1);
    await vi.advanceTimersByTimeAsync(21);
    const result = await token.promise;
    expect(result.committed).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it("commits the matching destination", async () => {
    const token = registry.beginNavigation({ expectedDestination: "/catalog?page=2" });
    const { rerender } = renderHook(() => useNavigationCommitSignal(registry));
    act(() => {
      mockSearch = "page=2";
      rerender();
    });
    const result = await token.promise;
    expect(result.committed).toBe(true);
  });

  it("stamps the URL layer onto the target entry after the location-change commit", async () => {
    const handle = registry.get("next/url", { page: 1 }, {
      persist: ["session", "url"],
      urlKey: "page",
    });
    handle.setState({ page: 2 });

    const token = registry.beginNavigation({});
    const { rerender } = renderHook(() => useNavigationCommitSignal(registry));
    act(() => {
      mockSearch = "page=2";
      rerender();
    });
    await token.promise;

    expect(handle.getState()).toEqual({ page: 2 });
    expect(registry.status().pending).toBe(0);
    // The URL layer of the target entry now carries the shareable parameter
    // (the URL layer stores its encoded record under the urlKey).
    const url = new URL(window.location.href);
    expect(url.searchParams.get("page")).toBeTruthy();
  });
});

describe("next/useNavigateWithState", () => {
  let registry: NavigationStateRegistry;

  beforeEach(() => {
    registry = createRegistry();
    vi.clearAllMocks();
  });

  afterEach(() => {
    registry.dispose();
    vi.useRealTimers();
  });

  it("routes through the Next.js router inside a transaction (times out without a commit)", async () => {
    const { result } = renderHook(() =>
      useNavigateWithState({ commitTimeout: 20, registry }),
    );
    const box: { navigation: Awaited<ReturnType<typeof result.current.push>> | null } = {
      navigation: null,
    };
    await act(async () => {
      box.navigation = await result.current.push("/catalog?page=2");
    });
    expect(routerMock.push).toHaveBeenCalledWith("/catalog?page=2", { scroll: undefined });
    expect(box.navigation?.committed).toBe(false);
    expect(box.navigation?.timedOut).toBe(true);
  });

  it("forwards scroll and merges per-call options over defaults", async () => {
    const { result } = renderHook(() =>
      useNavigateWithState({ commitTimeout: 20, registry, scroll: true }),
    );
    await act(async () => {
      await result.current.replace("/catalog", { scroll: false });
    });
    expect(routerMock.replace).toHaveBeenCalledWith("/catalog", { scroll: false });
  });

  it("commits when the router action returns a promise that resolves", async () => {
    const { result } = renderHook(() =>
      useNavigateWithState({ commitTimeout: 200, registry }),
    );
    routerMock.push.mockReturnValueOnce(Promise.resolve());
    const box: { navigation: Awaited<ReturnType<typeof result.current.push>> | null } = {
      navigation: null,
    };
    await act(async () => {
      box.navigation = await result.current.push("/catalog?page=3");
    });
    expect(box.navigation?.committed).toBe(true);
    expect(box.navigation?.timedOut).toBe(false);
  });
});
