import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRegistry } from "../src/core/index.js";
import { installBrowser, fakeSessionStorage, removeBrowser } from "./helpers/browser.js";

describe("core/registry", () => {
  beforeEach(() => {
    installBrowser();
  });
  afterEach(() => {
    removeBrowser();
    vi.useRealTimers();
  });

  it("returns the same slot for the same scope", () => {
    const registry = createRegistry();
    const a = registry.get("test/counter", { page: 1 });
    const b = registry.get("test/counter", { page: 99 });
    expect(b).toBe(a);
    expect(a.getState()).toEqual({ page: 1 });
    registry.dispose();
  });

  it("getServerState always returns initialState", () => {
    const registry = createRegistry();
    const handle = registry.get("test/ssr", "server");
    handle.setState("client");
    expect(handle.getServerState()).toBe("server");
    registry.dispose();
  });

  it("clears persisted records on clear()", () => {
    const registry = createRegistry();
    const handle = registry.get("test/clear", { n: 1 }, { persist: ["memory", "session"] });
    handle.replaceState({ n: 2 });
    expect(handle.getState()).toEqual({ n: 2 });
    registry.clear();
    // The live state survives, but every stored record is gone.
    expect(handle.getState()).toEqual({ n: 2 });
    expect(fakeSessionStorage().getItem("__rscStateSync:test/clear")).toBeNull();
    registry.dispose();
  });

  it("capture() stamps all scopes", () => {
    const registry = createRegistry();
    registry.get("a", 1, { persist: ["memory"] });
    registry.get("b", 2, { persist: ["memory"] });
    const captures = registry.capture();
    expect(captures.map((c) => c.scope).sort()).toEqual(["a", "b"]);
    expect(registry.capture(["a"]).map((c) => c.scope)).toEqual(["a"]);
    registry.dispose();
  });

  it("delete() disposes and forgets the scope", () => {
    const registry = createRegistry();
    registry.get("gone", 1, { persist: ["memory"] });
    expect(registry.has("gone")).toBe(true);
    expect(registry.delete("gone")).toBe(true);
    expect(registry.has("gone")).toBe(false);
    // Recreated fresh after deletion.
    expect(registry.get("gone", 2).getState()).toBe(2);
    registry.dispose();
  });

  it("uses registry-provided custom layers", () => {
    const writes: string[] = [];
    const registry = createRegistry({
      layers: {
        custom: {
          name: "custom",
          isAvailable: () => true,
          read: () => null,
          write: (_scope, _key, record) => {
            writes.push(record.payload ?? "");
            return { ok: true };
          },
          remove: () => {},
          clear: () => {},
          cost: (_scope, _key, record) => record.payload?.length ?? 0,
        },
      },
    });
    const handle = registry.get("custom/slot", "value", { persist: ["custom"] });
    handle.setState("next");
    const capture = handle.capture(1);
    expect(capture.persisted).toEqual(["custom"]);
    expect(writes).toHaveLength(1);
    registry.dispose();
  });

  it("emits privacy-safe structured navigation diagnostics", async () => {
    const events: unknown[] = [];
    const registry = createRegistry({ diagnostics: (event) => void events.push(event) });
    registry.get("diag/slot", 0, { persist: ["memory"] });
    const token = registry.beginNavigation({ expectedDestination: "/target" });
    registry.notifyCommit(token.sequence, undefined, "/target");
    await token.promise;
    expect(events).toEqual([
      { type: "navigation:start", sequence: token.sequence, scopes: ["diag/slot"], expectedDestination: "/target" },
      { type: "navigation:settle", sequence: token.sequence, outcome: "committed", pending: 0 },
    ]);
    registry.dispose();
  });

  it("keeps in-memory state within the same registry", () => {
    const registry = createRegistry();
    const handle = registry.get("test/lazy", 0, { persist: ["memory"] });
    handle.setState(42);
    expect(handle.getState()).toBe(42);
    registry.dispose();
  });
});
