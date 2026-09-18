"use client";

import { useState } from "react";
import { useNavigateWithState, useNavigationCommitSignal, useServerNavigationState } from "rsc-state-sync/next";

interface Filters {
  search: string;
  filtersOpen: boolean;
  tab: "all" | "books" | "videos";
  modal: null | "info";
}

const INITIAL: Filters = { search: "", filtersOpen: false, tab: "all", modal: null };

/**
 * The demo panel. Two modes:
 * - `synced`: state lives in rsc-state-sync (`useServerNavigationState`) and
 *   survives the RSC navigation via history + URL layers.
 * - `plain`: state lives in plain `useState` and is lost on every navigation,
 *   which is the exact problem the library solves.
 */
export default function ProductTools({ mode }: { mode: "plain" | "synced" }) {
  useNavigationCommitSignal();
  const navigate = useNavigateWithState();

  const [syncedState, setSyncedState] = useServerNavigationState<Filters>(
    "demo/filters",
    INITIAL,
    { persist: "navigation" },
  );
  const [plainState, setPlainState] = useState<Filters>(INITIAL);

  const state = mode === "synced" ? syncedState : plainState;
  const setState = mode === "synced" ? setSyncedState : setPlainState;

  const applyNavigation = (search: string) => {
    const href = `/?mode=${mode}&search=${encodeURIComponent(search)}`;
    if (mode === "synced") {
      void navigate.push(href);
    } else {
      window.location.assign(href); // full page load: the worst case
    }
  };

  return (
    <section style={{ border: "2px solid #4a90d9", padding: 16, borderRadius: 8 }}>
      <p style={{ color: "#555" }}>
        Client panel · mode: <strong>{mode}</strong>. Change the inputs, then click
        “Navigate (server re-render)”: with <em>synced</em> the panel state is restored
        after the server round-trip; with <em>plain</em> it resets.
      </p>

      <input
        placeholder="Search products…"
        value={state.search}
        onChange={(event) => setState((prev) => ({ ...prev, search: event.target.value }))}
        style={{ width: 240, display: "block", marginBottom: 8 }}
      />
      <label>
        <input
          type="checkbox"
          checked={state.filtersOpen}
          onChange={() => setState((prev) => ({ ...prev, filtersOpen: !prev.filtersOpen }))}
        />{" "}
        Filters open
      </label>
      <br />
      <label>
        Tab:{" "}
        <select
          value={state.tab}
          onChange={(event) =>
            setState((prev) => ({ ...prev, tab: event.target.value as Filters["tab"] }))
          }
        >
          <option value="all">All</option>
          <option value="books">Books</option>
          <option value="videos">Videos</option>
        </select>
      </label>
      <button onClick={() => setState((prev) => ({ ...prev, modal: "info" }))}>Open modal</button>
      {state.modal === "info" && (
        <div style={{ background: "#ffe9a8", padding: 12, marginTop: 8 }}>
          Modal is OPEN (restored across navigation)
          <button
            onClick={() => setState((prev) => ({ ...prev, modal: null }))}
            style={{ marginLeft: 8 }}
          >
            Close
          </button>
        </div>
      )}
      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <button onClick={() => applyNavigation(state.search)}>
          Navigate (server re-render)
        </button>
        <button onClick={() => setState(INITIAL)}>Reset panel</button>
      </div>
    </section>
  );
}
