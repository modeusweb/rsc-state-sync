# rsc-state-sync

Preserve serializable client UI state across React Server Component navigations (Next.js App Router and any RSC navigation that replaces history entries).

## Why

During an RSC navigation the server re-renders the tree and history entries get replaced — naive `sessionStorage` hacks and `history.state` values are wiped out or go stale. `rsc-state-sync` stores a snapshot of each registered state slot across multiple layers (`history.state`, `sessionStorage`, URL parameters, in-memory) and reassembles it correctly: authoritative snapshots are stamped onto the *leaving* history entry, while shareable URL parameters are stamped onto the *target* entry after the navigation commits.

## Installation

```bash
npm install rsc-state-sync
```

## Quick start

```tsx
"use client";
import { useServerNavigationState } from "rsc-state-sync/react";

const DEFAULT_FILTERS = { page: 1, query: "" };

export function CatalogFilters() {
  const [filters, setFilters] = useServerNavigationState(
    "catalog/filters",
    DEFAULT_FILTERS,
    { persist: "navigation" },
  );
  // ...
}
```

In the Next.js App Router, mount the commit signal once (for example, in a client provider mounted from the root layout):

```tsx
"use client";
import { useNavigationCommitSignal } from "rsc-state-sync/next";

export function Providers({ children }: { children: React.ReactNode }) {
  useNavigationCommitSignal();
  return <>{children}</>;
}
```

Then use state-preserving navigation:

```tsx
"use client";
import { useNavigateWithState } from "rsc-state-sync/next";

export function NextPageButton() {
  const navigate = useNavigateWithState();
  return (
    <button onClick={() => navigate.push("/catalog?page=2")}>
      Next page
    </button>
  );
}
```

Plain `<Link>` navigations are also supported (without an explicit transaction — the commit is detected by the location change).

## Features

- **Multi-layer persistence**: `history.state`, `sessionStorage`, URL parameters, in-memory. Presets: `navigation`, `history`, `session` and `none`.
- **Versioning, TTL and validation** of restored snapshots; resilient to corrupted or stale data.
- **View Transitions** as a progressive enhancement (no `document.startViewTransition`? it's just a plain navigation).
- **Navigation transactions**: destination-correlated commits, superseding stale navigations, timeout recovery, `AbortSignal`.
- **SSR-safe**: the server and hydration always see `initialState` — no hydration mismatches.
- **Isolation**: `createNavigationState()` / `createRegistry()` for tests, HMR and multi-tenant apps.

## Persistence layers

| Layer | Writes to | When to use |
| --- | --- | --- |
| `history` | `history.state` of the current entry | State tied to a history entry |
| `session` | `sessionStorage` | Survives navigations, cleared when the tab closes |
| `url` | Search parameters | Shareable links |
| `memory` | Memory | Zero cost, nothing written to the browser |

## Serialization and validation

The default serializer is a plain, safe JSON serializer — no heavyweight
libraries. Custom serializers, validators and schema libraries (zod, valibot…)
are supported without any required dependency:

```ts
useServerNavigationState("catalog/filters", DEFAULT_FILTERS, {
  persist: ["memory", "history", "url"],
  version: 2,                     // bump to invalidate old snapshots
  ttl: 30 * 60 * 1000,            // snapshots older than 30 min are ignored
  maxSize: { url: 1024 },         // oversized snapshots are skipped, not thrown
  validate: (value): value is Filters => typeof value?.query === "string",
  // or: schema: { parse: (value) => filtersSchema.parse(value) },
  strict: false,                  // true = throw instead of graceful fallback
  onError: (error) => report(error),
});
```

> **Security note:** URL storage is only for **non-sensitive UI state**. State
> persisted into the URL (and any client storage) is attacker-controllable —
> it is never trusted. Restored snapshots pass through version checks, TTL
> checks, schema validation and a payload-size limit before reaching your
> components, and a corrupted payload falls back to `initialState`.

## Concurrency

Navigation is a transaction. Every navigation gets a monotonic sequence; a
newer navigation supersedes all in-flight ones (their snapshots cannot claim
shared layers and their commits are ignored). Framework adapters may provide
an expected destination, which is checked before a commit is accepted. Each
transaction has a timeout and optional `AbortSignal`:

```ts
const controller = new AbortController();
await navigateWithState(() => router.push("/products"), { signal: controller.signal });
```

Transactions with an expected destination are not committed by a transition or
location change for another URL. Plain `<Link>` navigation remains supported
through the adapter's location fallback. A timeout returns
`committed: false` and `timedOut: true`; the leaving-entry snapshot is retained
for recovery, while target URL parameters are not written.

`expectedDestination` is an internal low-level option used by framework adapters.
The Next.js wrapper derives it automatically for `push` and `replace`; callers
using `navigateWithState` directly can provide a normalized pathname plus query
string when their adapter knows the destination.

## View Transitions

Progressive enhancement only. If `document.startViewTransition` exists, the
DOM update is wrapped in it; otherwise the navigation proceeds normally. No
polyfill, no hard dependency, no error:

```ts
await navigateWithState(() => router.push("/dashboard"));
```

## Back / forward

Snapshots are stamped onto history entries themselves, so `back`/`forward`
restore the state of the entry you travel to, including entries the router
replaced. The library only ever *merges* its own bucket key into
`history.state` — router-owned keys (e.g. Next.js internal routing metadata)
are preserved.

## Extensibility and diagnostics

Custom layers are registered per isolated registry and can be selected by name:

```ts
const registry = createRegistry({
  layers: {
    encrypted: {
      name: "encrypted",
      isAvailable: () => true,
      read: (scope, key) => storage.read(`encrypted:${scope}:${key}`),
      write: (scope, key, record) => storage.write(`encrypted:${scope}:${key}`, record),
      remove: (scope, key) => storage.remove(`encrypted:${scope}:${key}`),
      clear: () => storage.clear(),
      cost: (_scope, _key, record) => record.payload?.length ?? 0,
    },
  },
  diagnostics: (event) => metrics.record(event),
});
```

Diagnostics are opt-in and privacy-safe: events contain navigation sequence,
scope names, destination metadata and outcome, but never serialized or live state
values. Treat scope names as application data and avoid logging sensitive scope
names in production telemetry.

The default serializer automatically escapes application objects containing the
reserved `$rss` key. Custom serializers remain available for application-specific
binary formats and encryption.

## Adapter capabilities

Use `getAdapterCapabilities()` or `listAdapterCapabilities()` to inspect runtime support metadata. `core`, `react` and `next` are supported; `react-router` and `remix` are candidates pending dedicated browser fixtures and adapter ownership.

## Verified support matrix

The current release gate verifies:

| Next.js | React | Type declarations | Real browsers |
| --- | --- | --- | --- |
| 13.5.11 | 18.2.0 | supported | core package unit/integration |
| 16.3.6 | 19.3.0 | supported | Chromium, Firefox, WebKit via demo |

The package remains ESM-first. The root, React and Next subpath exports are tested from a packed npm artifact in a clean consumer. `require()` is not a supported CommonJS contract.

## Performance

- **Lazy serialization**: changing state never serializes; serialization
  happens only when a layer write is needed (navigation capture, commit or a
  debounced URL/session write) and is memoized per revision.
- **No polling, no per-render work**: updates are delivered through
  `useSyncExternalStore`.
- **Batching**: bursts of `setState` collapse into a single non-authoritative
  write per task.

Measured on Node 24 (`npm run bench`), single pass, per state snapshot:

| Snapshot size | serialize | deserialize | update | capture |
| --- | --- | --- | --- | --- |
| 10 KiB | ~0.07 ms | ~0.25 ms | < 10 µs | < 5 µs |
| 100 KiB | ~0.7 ms | ~2.0 ms | < 10 µs | < 5 µs |
| 500 KiB | ~3.8 ms | ~10.4 ms | < 10 µs | < 5 µs |
| 1 MiB | ~7.8 ms | ~22.6 ms | < 10 µs | < 5 µs |

Update and capture stay in microseconds because nothing is serialized until a
layer write is actually required.

**Bundle size** (`npm run size`, minified + gzip): core ≈ **4.9 KiB gz**
(12.5 KiB raw), Next.js adapter ≈ **0.6 KiB gz**, React entry is a re-export.
Zero runtime dependencies.

## Demo

A runnable Next.js App Router demo lives in [`demo/`](./demo). It shows both
modes side by side with an artificial 1.2 s server delay:

- `/?mode=synced` — the filter panel, tab and modal state survive navigation;
- `/?mode=plain` — plain `useState` (state lost on every navigation).

```bash
cd demo
npm install
npm run dev     # http://localhost:3210
```

## SSR

The core never touches `window`, `document`, `history`, `sessionStorage` or
`location` during module evaluation or server render. Server and hydration
always see `initialState`; the persisted snapshot is applied right after
hydration, so there are no hydration mismatches (covered by a dedicated
`tests/ssr.test.ts` running in a pure Node environment).

## Limitations

This library preserves **serializable UI state, not React component
instances**. It cannot and does not promise to preserve:

- component instances, DOM nodes, focus or scroll positions of *unregistered*
  trees;
- non-serializable values (functions, class instances, closures) — persisting
  them is a silent serialization failure;
- state that was never registered via `useServerNavigationState` /
  `registry.get(...)`;
- perfect race-freedom without router cooperation — the commit signal depends
  on framework adapter hooks (documented above); without the adapter the
  transaction still resolves, via superseding or the commit timeout.

It intentionally does **not** turn an RSC app into an SPA, add a global store,
or monkey-patch React/Next internals or browser APIs.

## API reference

### `useServerNavigationState(scope, initialState, options?)` — `rsc-state-sync/react` / `/next`

```ts
const [state, setState, handle] = useServerNavigationState("scope", initial, {
  persist,          // StorageStrategy | StorageStrategy[] — default "navigation"
  version, ttl, maxSize, urlKey, serializer, validate, schema,
  writeUrl,         // "capture" (default) | "immediate"
  isEqual, strict, onError,
});
```

Returns `[state, setState, handle]`. `setState` accepts a value or an updater
function; `handle` exposes `replaceState`, `reset`, `capture`, `hydrate`,
`clear`, `dispose` and `usesUrl`.

### `useNavigateWithState(defaults?)` — `rsc-state-sync/next`

`push / replace / back / forward` mirroring the Next.js router, each wrapping
the navigation in a state-preserving transaction (with `useViewTransition`
and `onSettled` options).

### `navigateWithState(navigate, options?)` — core

Framework-agnostic transaction runner around any navigate function.

### `createNavigationState(registry?)` / `createRegistry()` — core

Explicit, isolated instances (tests, HMR, multi-tenant apps). The low-level
registry also exposes `beginNavigation`, `notifyCommit`, `status`,
`subscribeStatus`, `capture`, `clear`, `dispose`.

### `useIsNavigating(registry?)` — `rsc-state-sync/react`

Subscribes to the registry's transaction status.

## Architecture

```
src/
  core/    framework-agnostic: layers (memory/history/session/url), envelope,
           serializer, handle (one slot), registry (slots + transactions),
           navigate (transaction runner), view-transition detection
  react/   useServerNavigationState, useIsNavigating, createNavigationState
  next/    App Router adapter: commit signal, state-preserving navigation
```

Data flow on navigation: capture authoritative snapshots → stamp them on the
leaving history entry → run the router navigation (inside `startTransition`
and optionally a View Transition) → the adapter signals the commit → URL
parameters are stamped on the target entry → handles restore from the entry's
snapshot. The layers, transactions and race-handling rules are described in
detail in the README (see "Architecture", "Concurrency" and "Back / forward").

## FAQ

**Why not just `useState` + `sessionStorage`?** Because a naive approach
races with history: on back/forward you restore the wrong snapshot, on fast
navigations an older response can overwrite a newer one, and server components
replace the tree underneath you. The library solves capture/restore as a
transaction over history entries instead of a single key-value dump.

**Does it work without Next.js?** Yes. The core is framework-agnostic; any
router that pushes/replaces history entries works. The Next.js adapter only
adds commit detection and typed wrappers.

**What happens if the browser doesn't support View Transitions?** Nothing
special: the navigation simply runs without the animation. It is a progressive
enhancement by design.

## Tests and build

```bash
npm test        # vitest
npm run build   # tsup + dist sanity check
npm run typecheck
```

## License

MIT
