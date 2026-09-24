# Version roadmap

This roadmap uses semantic versioning. A version is released only when all listed release gates pass.

## 0.1.4 — Maintenance release

**Status: published**

- Updated the compatible development toolchain and restored reproducible CI/lockfiles.
- Fixed synchronous and rejected navigation settlement semantics.
- Added coverage execution and Next.js demo build verification.
- Updated the audit baseline and removed known dependency advisories.

Release gate: lint, strict type-check, 56+ tests, coverage run, root/demo audits, library build, demo build, size budget and packed-artifact inspection.

## 0.1.x — Stabilization patches

**Status: 0.1.6 release candidate**

**Completed in 0.1.5–0.1.6**

- Correlates Next.js commit signals with an explicit navigation sequence and expected destination.
- Adds a packed-package ESM/declaration smoke test to CI and publish gates.
- Covers wrong-destination, matching-destination, synchronous-error and rejected-navigation behavior.
- Covers unavailable storage, rapid superseding navigations and timeout recovery.
- Backfills historical release tags from npm `gitHead` metadata.

**Remaining before 0.2.0**

- Add oldest-supported React/Next compatibility fixtures.
- Add real-browser E2E matrix and ESM module-contract verification.

0.1.5 is the current stabilization release candidate. It adds sequence/destination
commit correlation and packed-artifact verification without changing the core
state API.

## 0.2.0 — Reliable browser integration

**Status: release candidate — verification complete**

### Completed

- Commit correlation is public and destination-aware.
- Playwright covers Chromium, Firefox and WebKit for RSC navigation, plain reset and back restoration.
- Timeout/abort/supersede recovery is covered by unit and integration tests.
- The package is explicitly ESM-first and verified through packed ESM/type-consumer smoke tests.
- Oldest and newest declared peer fixtures pass: Next 13.5.11/React 18.2 and Next 16.3.6/React 19.3.
- Coverage thresholds are enforced in CI.

### Release gate status

- No known critical/high security findings: passed.
- Coverage: 82.19% statements, 77.37% branches, 81.71% functions, 86.65% lines: passed.
- Browser matrix: passed.
- Public API remains backward compatible.

## 0.3.0 — Extensibility and observability

**Status: release candidate — implementation complete**

### Completed

- Registry-provided custom layers are supported through `StateLayer` and `createRegistry({ layers })`.
- Opt-in structured diagnostics expose navigation lifecycle metadata without user state values.
- Reserved `$rss` application keys are escaped by the default serializer.
- Existing framework-neutral router, custom serializer and schema extension points remain compatible.

### Release gate status

- Unit/integration coverage and bundle budget: passed.
- Packed ESM/type consumer: passed.
- Browser matrix from 0.2.0: passed.

## 0.4.0 — Framework ecosystem

**Target: after 0.3.0 API stabilization**

- Evaluate React Router, Remix and additional RSC router adapters without coupling core to frameworks.
- Add framework conformance fixtures and adapter capability reporting.
- Add compatibility automation across the oldest and newest supported peer versions.
- Publish architecture decision records for adapter boundaries and transaction ownership.

Skip this version if adapter scope cannot be maintained without destabilizing the core API.

## 0.5.0 — Release candidate hardening

**Target: six to eight weeks before 1.0.0**

- Freeze candidate public APIs for one full minor cycle.
- Run compatibility, migration and downgrade tests.
- Produce SBOM, npm provenance and signed release artifacts in CI.
- Publish an upgrade guide, deprecation policy and support matrix.
- Resolve all P1/P2 audit findings or explicitly defer them with an owner and target version.

## 1.0.0 — Stable release

1.0.0 is released only when:

- Core, React and supported framework adapters are API-stable.
- The full browser and supported peer matrix passes from a clean install.
- The packed npm artifact is tested as an external dependency.
- No unresolved critical/high security findings or known data-loss/race defects remain.
- Performance and bundle budgets pass in CI.
- Semver, deprecation, security and release policies are published.

## Deferred post-1.0 work

- Optional custom state layers supplied by application code.
- Additional non-React router adapters based on demonstrated demand.
- Workspace restructuring only when package count and release coordination justify it.
- Additional runtime adapters after their stability and maintenance ownership are clear.
