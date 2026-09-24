import { describe, expect, expectTypeOf, it } from "vitest";
import { getAdapterCapabilities, listAdapterCapabilities } from "../src/core/index.js";
import type { NavigationState } from "../src/core/index.js";
import type { UseServerNavigationStateResult } from "../src/react/use-server-navigation-state.js";

interface Filters {
  query: string;
  page: number;
}

describe("types (compile-time)", () => {
  it("infers the state type from initialState", () => {
    type Result = UseServerNavigationStateResult<Filters>;
    expectTypeOf<Result>().toEqualTypeOf<
      readonly [
        state: Filters,
        setState: (next: Filters | ((prev: Filters) => Filters)) => void,
        handle: NavigationState<Filters>,
      ]
    >();
  });

  it("reports supported and candidate framework adapters", () => {
    const adapters = listAdapterCapabilities();
    expect(adapters.find((adapter) => adapter.name === "next")).toMatchObject({
      support: "supported",
      destinationCorrelation: true,
      realBrowserCoverage: true,
    });
    expect(adapters.find((adapter) => adapter.name === "remix")).toMatchObject({
      support: "candidate",
      destinationCorrelation: false,
      realBrowserCoverage: false,
    });
    expect(getAdapterCapabilities("core").stateCapture).toBe(true);
  });

  it("keeps primitive state types exact", () => {
    type Result = UseServerNavigationStateResult<string>;
    expectTypeOf<Result[0]>().toBeString();
  });
});
