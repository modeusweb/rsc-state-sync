# ADR-0001: Framework adapter boundaries

- Status: accepted
- Date: 2026-09-24

## Context

`rsc-state-sync` owns serializable state, persistence layers and navigation transactions. Next.js owns router-specific transition and location signals. React Router and Remix have different router lifecycles and are not currently bundled dependencies.

## Decision

- Core remains framework-neutral and exposes `navigateWithState`, registries and adapter capability metadata.
- React and Next.js adapters are supported and tested against real Chromium, Firefox and WebKit flows.
- React Router and Remix are capability-reporting candidates only until dedicated fixtures, destination correlation and an owner are available.
- New adapters must not import framework packages into the core entry point or duplicate persistence semantics.
- Adapter conformance must cover capture, destination correlation, commit signals, timeout/abort behavior and browser validation.

## Consequences

The package stays small and avoids unverified framework coupling. Consumers can make informed adapter choices through capability metadata. Adding a new adapter requires a separate fixture and maintenance commitment rather than a speculative dependency.
