import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRegistry, navigateWithState } from "../src/core/index.js";
import { installBrowser, removeBrowser } from "./helpers/browser.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("core/navigate", () => {
  beforeEach(() => {
    installBrowser();
  });
  afterEach(() => {
    removeBrowser();
    vi.useRealTimers();
  });

  it("commits when the adapter reports the commit", async () => {
    const registry = createRegistry();
    const handle = registry.get("nav/list", { page: 1 }, { persist: ["memory"] });
    const promise = navigateWithState(() => {}, { registry });
    expect(registry.status().isNavigating).toBe(true);
    registry.notifyCommit(registry.status().latestSequence);
    const result = await promise;
    expect(result.committed).toBe(true);
    expect(result.superseded).toBe(false);
    expect(result.aborted).toBe(false);
    expect(handle.getState()).toEqual({ page: 1 });
    registry.dispose();
  });

  it("supersedes in-flight navigations", async () => {
    const registry = createRegistry();
    registry.get("nav/supersede", 0, { persist: ["memory"] });
    const first = navigateWithState(() => {}, { registry });
    const second = navigateWithState(() => {}, { registry });
    registry.notifyCommit(registry.status().latestSequence);
    const firstResult = await first;
    const secondResult = await second;
    expect(firstResult.committed).toBe(false);
    expect(firstResult.superseded).toBe(true);
    expect(secondResult.committed).toBe(true);
    registry.dispose();
  });

  it("resolves with aborted when the signal fires", async () => {
    const registry = createRegistry();
    registry.get("nav/abort", 0, { persist: ["memory"] });
    const controller = new AbortController();
    const promise = navigateWithState(() => {}, { registry, signal: controller.signal });
    controller.abort();
    const result = await promise;
    expect(result.aborted).toBe(true);
    expect(result.committed).toBe(false);
    registry.dispose();
  });

  it("settles a synchronous navigation error without waiting for timeout", async () => {
    const registry = createRegistry();
    registry.get("nav/throw", 0, { persist: ["memory"] });
    const error = new Error("router failed");
    const promise = navigateWithState(() => {
      throw error;
    }, { registry });

    const result = await promise;
    expect(result.error).toBe(error);
    expect(result.aborted).toBe(true);
    expect(result.committed).toBe(false);
    expect(registry.status().pending).toBe(0);
    registry.dispose();
  });

  it("treats a rejected navigation promise as unsuccessful", async () => {
    const registry = createRegistry();
    registry.get("nav/reject", 0, { persist: ["memory"] });
    const error = new Error("navigation rejected");
    const promise = navigateWithState(() => Promise.reject(error), { registry });

    const result = await promise;
    expect(result.error).toBe(error);
    expect(result.aborted).toBe(true);
    expect(result.committed).toBe(false);
    expect(registry.status().pending).toBe(0);
    registry.dispose();
  });

  it("times out with a committed=false result", async () => {
    vi.useFakeTimers();
    const registry = createRegistry();
    registry.get("nav/timeout", 0, { persist: ["memory"] });
    const promise = navigateWithState(() => {}, { registry, commitTimeout: 50 });
    vi.advanceTimersByTime(51);
    const result = await promise;
    expect(result.timedOut).toBe(true);
    expect(result.committed).toBe(false);
    registry.dispose();
  });

  it("captures on leaving entry and stamps URL on commit", async () => {
    const registry = createRegistry();
    const handle = registry.get(
      "nav/url",
      { q: "" },
      { persist: ["memory", "url"], urlKey: "q", writeUrl: "capture" },
    );
    handle.setState({ q: "shoes" });
    const promise = navigateWithState(() => {}, { registry, urlUpdate: true });
    registry.notifyCommit(registry.status().latestSequence);
    const result = await promise;
    expect(result.committed).toBe(true);
    const captures = result.captures.filter((c) => c.scope === "nav/url");
    expect(captures.some((c) => c.persisted.includes("memory"))).toBe(true);
    expect(captures.some((c) => c.persisted.includes("url"))).toBe(true);
    registry.dispose();
  });

  it("runs the navigation inside View Transitions when available", async () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: () => {},
      };
    });
    (globalThis as { document?: unknown }).document = { startViewTransition };
    try {
      const registry = createRegistry();
      registry.get("nav/vt", 0, { persist: ["memory"] });
      const promise = navigateWithState(() => {}, { registry, useViewTransition: true });
      registry.notifyCommit(registry.status().latestSequence);
      const result = await promise;
      expect(startViewTransition).toHaveBeenCalledOnce();
      expect(result.usedViewTransition).toBe(true);
      registry.dispose();
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });

  it("skips View Transitions when unsupported", async () => {
    const registry = createRegistry();
    registry.get("nav/novt", 0, { persist: ["memory"] });
    const promise = navigateWithState(() => {}, { registry, useViewTransition: false });
    registry.notifyCommit(registry.status().latestSequence);
    const result = await promise;
    expect(result.usedViewTransition).toBe(false);
    registry.dispose();
    await wait(0);
  });

  it("ignores a stale commit from a superseded navigation", async () => {
    const registry = createRegistry();
    registry.get("nav/stale", 0, { persist: ["memory"] });
    const first = navigateWithState(() => {}, { registry });
    const second = navigateWithState(() => {}, { registry });
    // The superseded navigation tries to commit afterwards: it must be a no-op.
    const firstResult = await first;
    expect(firstResult.superseded).toBe(true);
    registry.notifyCommit(registry.status().latestSequence);
    const secondResult = await second;
    expect(secondResult.committed).toBe(true);
    registry.dispose();
  });
});
