import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_STATE_KEY } from "../src/core/constants.js";
import { resetBrowserEnv } from "../src/core/env.js";
import { createRegistry } from "../src/core/index.js";
import { fakeHistory, installBrowser, removeBrowser } from "./helpers/browser.js";

function historyBucket(): Record<string, unknown> {
  const state = fakeHistory().state;
  const bucket = (state as Record<string, unknown> | null)?.[HISTORY_STATE_KEY];
  return (bucket as Record<string, unknown>) ?? {};
}

describe("core/history", () => {
  beforeEach(() => {
    installBrowser();
    resetBrowserEnv();
    fakeHistory().replaceState(null, "");
    vi.restoreAllMocks();
  });
  afterEach(() => {
    removeBrowser();
    resetBrowserEnv();
  });

  it("captures to history.state without touching foreign keys", () => {
    const registry = createRegistry();
    const routerState = { __privateNextRouter: "keep-me" };
    fakeHistory().replaceState(routerState, "");
    const handle = registry.get("hist/filters", { q: "" }, { persist: ["history"] });
    handle.setState({ q: "react" });
    handle.capture(1);
    expect(historyBucket()["hist/filters"]).toBeDefined();
    expect((fakeHistory().state as Record<string, unknown>)["__privateNextRouter"]).toBe("keep-me");
    registry.dispose();
  });

  it("restores the authoritative snapshot of the current entry", () => {
    const registry = createRegistry();
    const handle = registry.get("hist/auth", { step: 1 }, { persist: ["history"] });
    handle.setState({ step: 2 });
    handle.capture(1, "all");
    // Simulate the next handle bound to the *same* history entry.
    const registry2 = createRegistry();
    const handle2 = registry2.get("hist/auth", { step: 1 }, { persist: ["history"] });
    expect(handle2.getState()).toEqual({ step: 2 });
    expect(handle2.getServerState()).toEqual({ step: 1 });
    registry.dispose();
    registry2.dispose();
  });

  it("handles back/forward via onHistoryChange (popstate simulation)", () => {
    const registry = createRegistry();
    const handle = registry.get("hist/pop", "entry-a", { persist: ["history"] });

    // Entry A snapshot.
    handle.setState("entry-a-live");
    handle.capture(1);
    const entryA = fakeHistory().state;

    // Entry B snapshot.
    fakeHistory().replaceState(null, "");
    handle.setState("entry-b-live");
    handle.capture(2);
    const entryB = fakeHistory().state;

    // Simulate `back`: the older entry's snapshot is restored.
    fakeHistory().replaceState(entryA, "");
    handle.onHistoryChange();
    expect(handle.getState()).toBe("entry-a-live");

    // Simulate `forward`: the newer entry's snapshot is restored.
    fakeHistory().replaceState(entryB, "");
    handle.onHistoryChange();
    expect(handle.getState()).toBe("entry-b-live");

    registry.dispose();
  });

  it("remove() cleans the scope from history.state", () => {
    const registry = createRegistry();
    const handle = registry.get("hist/clean", 1, { persist: ["history"] });
    handle.setState(2);
    handle.capture(1);
    expect(historyBucket()["hist/clean"]).toBeDefined();
    handle.clear();
    expect(historyBucket()["hist/clean"]).toBeUndefined();
    registry.dispose();
  });
});
