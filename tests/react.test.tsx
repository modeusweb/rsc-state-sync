import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { createRegistry } from "../src/core/index.js";
import { createNavigationState } from "../src/react/index.js";

// jsdom already provides window/history/sessionStorage; no fake browser here.

const navigationState = createNavigationState(createRegistry());

function Probe({ scope, initial }: { scope: string; initial: number }) {
  const [value, setValue] = navigationState.useServerNavigationState(scope, initial);
  return (
    <button type="button" onClick={() => setValue(value + 1)}>
      {value}
    </button>
  );
}

describe("react/useServerNavigationState", () => {
  it("renders initialState and updates through setState", () => {
    const { getByRole, unmount } = render(<Probe scope="react/probe" initial={7} />);
    expect(getByRole("button").textContent).toBe("7");
    act(() => {
      getByRole("button").click();
    });
    expect(getByRole("button").textContent).toBe("8");
    unmount();
  });

  it("shares one slot across remounts of the same scope", () => {
    const first = render(<Probe scope="react/shared" initial={1} />);
    first.unmount();
    const second = render(<Probe scope="react/shared" initial={999} />);
    expect(second.getByRole("button").textContent).toBe("1");
    second.unmount();
  });

  it("survives StrictMode double mounting", () => {
    const { getByRole, unmount } = render(
      <StrictMode>
        <Probe scope="react/strict" initial={3} />
      </StrictMode>,
    );
    expect(getByRole("button").textContent).toBe("3");
    unmount();
  });
});
