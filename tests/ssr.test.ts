// @vitest-environment node
/**
 * SSR safety: importing the package and creating slots must never touch
 * `window`, `document`, `history`, `sessionStorage` or `location`.
 */
import { describe, expect, it } from "vitest";
import { createRegistry, navigateWithState } from "../src/core/index.js";

describe("core/ssr", () => {
  it("imports and works on the server without browser APIs", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    const registry = createRegistry();
    const handle = registry.get("ssr/slot", { page: 1 });
    expect(handle.getServerState()).toEqual({ page: 1 });
    expect(handle.getState()).toEqual({ page: 1 });
    // Server-side navigation resolves without touching history.
    const promise = navigateWithState(() => {}, { registry, commitTimeout: 20 });
    return promise.then((result) => {
      expect(result.committed).toBe(false);
      expect(result.timedOut).toBe(true);
      registry.dispose();
    });
  });
});
