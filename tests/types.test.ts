import { describe, expectTypeOf, it } from "vitest";
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

  it("keeps primitive state types exact", () => {
    type Result = UseServerNavigationStateResult<string>;
    expectTypeOf<Result[0]>().toBeString();
  });
});
