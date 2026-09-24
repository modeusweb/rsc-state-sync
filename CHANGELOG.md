# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-09-24

### Added

- Added Playwright E2E coverage for Chromium, Firefox and WebKit covering RSC navigation, plain-state reset and browser back restoration.
- Added packed-artifact compatibility smoke tests for Next.js 13.5/React 18.2 and Next.js 16/React 19.3.
- Added enforced V8 coverage thresholds: 80% statements, 75% branches, 80% functions and 85% lines.
- Added a dedicated browser CI job with Playwright system dependencies.

### Changed

- Established the initial verified peer support matrix while retaining the existing broad peer ranges.

## [0.1.6] — 2026-09-24

### Fixed

- Report unavailable storage writes through `onError` in addition to returning the skipped layer in `CaptureResult`.
- Preserve the leaving-entry snapshot after a navigation timeout so a later mount can recover the latest state.

### Added

- Added regression coverage for storage quota failures, three rapid superseding navigations and timeout recovery from `history.state`.
- Backfilled the missing `v0.1.3` Git tag at the published npm `gitHead`.

## [0.1.5] — 2026-09-24

### Fixed

- Correlated Next.js navigation commits with an explicit sequence and expected destination, preventing unrelated transitions or locations from committing the wrong transaction.
- Preserved immediate settlement for synchronous and rejected navigation promises when destination correlation is enabled.

### Added

- Added a packed npm artifact smoke test covering ESM import and TypeScript declarations from a clean temporary consumer.
- Added `npm run test:smoke` to CI and the publish quality gate.

## [0.1.4] — 2026-09-24

### Fixed

- Fixed synchronous and rejected navigation promises to settle as unsuccessful instead of timing out or being reported as committed.

### Changed

- Updated the development toolchain to ESLint 10, Vite 8, Vitest 5 and Next.js 16.
- Restored tracked lockfiles, CI configuration and release scripts for reproducible builds.
- Added explicit coverage verification and Next.js demo checks to the quality gate.
- Kept the Node.js 18.18 runtime baseline and moved the development CI baseline to Node 22.22.2 for the updated toolchain.
- Corrected persistence preset documentation.

## [0.1.3] — 2026-09-21

### Changed

- Updated package metadata and prepared the initial 0.1.3 release.

## [0.1.2] — 2026-09-21

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
- Release hygiene: `prepack` rebuilds `dist`, and `prepublishOnly` runs the full quality gate.
