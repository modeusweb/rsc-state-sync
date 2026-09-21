# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] — 2026-09-21

### Fixed

- `enrichHistory` (default) now actually works: a debounced non-authoritative
  snapshot of the current scope is written to the *current* history entry after
  `setState`, so back/forward restores it even when the navigation happened
  without a `navigateWithState` transaction (plain `<Link>` navigation).
- The `url` layer no longer writes into `history.state` unless the `history`
  layer is configured.
- `capture(seq, "url")` is a no-op when the `url` layer is not configured,
  instead of writing it unconditionally.

### Added

- `tests/serializer.test.ts`: full coverage of the tag-based JSON serializer
  (`undefined`, holes, `NaN`/`Infinity`, `bigint`, `Date`, `URLSearchParams`).
- `tests/history.test.ts`: regression tests for history enrichment.
- `tests/next.test.tsx`: coverage for the Next.js adapter (commit signal and
  `useNavigateWithState`).
- Size budget in `benchmarks/size.mjs` (`SIZE_BUDGET_KIB`, default 12 KiB gz).
- GitHub Actions CI (lint, typecheck, tests, build, size budget on Node 20/22/24).
- Release hygiene: `prepack` rebuilds `dist`, `prepublishOnly` runs the full
  quality gate, sourcemaps are excluded from the npm tarball.
