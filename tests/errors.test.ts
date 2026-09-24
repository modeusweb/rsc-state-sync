import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetBrowserEnv } from "../src/core/env.js";
import { createRegistry } from "../src/core/index.js";
import { fakeSessionStorage, installBrowser, removeBrowser } from "./helpers/browser.js";

describe("core/errors", () => {
  beforeEach(() => {
    installBrowser();
    resetBrowserEnv();
    fakeSessionStorage().clear();
  });
  afterEach(() => {
    removeBrowser();
    resetBrowserEnv();
  });

  it("rejects corrupted payloads and falls back to initial state", () => {
    fakeSessionStorage().setItem("__rscStateSync:err/corrupt", "not-json{{{");
    const errors: unknown[] = [];
    const registry = createRegistry();
    const handle = registry.get("err/corrupt", "fallback", {
      persist: ["session"],
      onError: (error) => void errors.push(error),
    });
    expect(handle.getState()).toBe("fallback");
    expect(errors.length).toBeGreaterThan(0);
    registry.dispose();
  });

  it("rejects version mismatches", () => {
    fakeSessionStorage().setItem(
      "__rscStateSync:err/version",
      JSON.stringify({ f: 1, v: 99, r: 1, t: Date.now(), a: 1, p: JSON.stringify("new") }),
    );
    const registry = createRegistry();
    const handle = registry.get("err/version", "old", { persist: ["session"], version: 1 });
    expect(handle.getState()).toBe("old");
    registry.dispose();
  });

  it("rejects expired records (ttl)", () => {
    fakeSessionStorage().setItem(
      "__rscStateSync:err/ttl",
      JSON.stringify({
        f: 1,
        v: 1,
        r: 1,
        t: Date.now() - 10_000,
        a: 1,
        p: JSON.stringify("stale"),
      }),
    );
    const registry = createRegistry();
    const handle = registry.get("err/ttl", "fresh", { persist: ["session"], ttl: 5_000 });
    expect(handle.getState()).toBe("fresh");
    registry.dispose();
  });

  it("skips oversized snapshots instead of writing them", () => {
    const registry = createRegistry();
    const handle = registry.get("err/big", "", { persist: ["session"] });
    handle.setState("x".repeat(200_000)); // session default limit is 128 KiB
    const capture = handle.capture(1);
    expect(capture.persisted).not.toContain("session");
    expect(capture.skipped.map((s) => s.layer)).toContain("session");
    registry.dispose();
  });

  it("reports unavailable storage without breaking live state", () => {
    const registry = createRegistry();
    const errors: unknown[] = [];
    const storage = fakeSessionStorage();
    const setItem = storage.setItem;
    storage.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
    const handle = registry.get("err/storage", "initial", {
      persist: ["session"],
      onError: (error) => void errors.push(error),
    });
    handle.setState("live");
    const capture = handle.capture(1);
    expect(handle.getState()).toBe("live");
    expect(capture.persisted).not.toContain("session");
    expect(capture.skipped.map((entry) => entry.layer)).toContain("session");
    expect(errors.length).toBeGreaterThan(0);
    storage.setItem = setItem;
    registry.dispose();
  });

  it("applies schema validation on restore", () => {
    fakeSessionStorage().setItem(
      "__rscStateSync:err/schema",
      JSON.stringify({
        f: 1,
        v: 1,
        r: 1,
        t: Date.now(),
        a: 1,
        p: JSON.stringify({ n: "not-a-number" }),
      }),
    );
    const registry = createRegistry();
    const handle = registry.get<{ n: number }>(
      "err/schema",
      { n: 0 },
      {
        persist: ["session"],
        validate: (value): value is { n: number } =>
          typeof value === "object" && value !== null && typeof (value as { n?: unknown }).n === "number",
      },
    );
    expect(handle.getState()).toEqual({ n: 0 });
    registry.dispose();
  });

  it("throws in strict mode instead of swallowing", () => {
    fakeSessionStorage().setItem("__rscStateSync:err/strict", "garbage{");
    const registry = createRegistry();
    expect(() =>
      registry.get("err/strict", "ok", { persist: ["session"], strict: true }).getState(),
    ).toThrow();
    registry.dispose();
  });
});
