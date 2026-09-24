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

**Target: after the 0.1.x stabilization line is adopted**

### Scope

- Introduce reliable transaction/commit correlation for framework adapters.
- Add Playwright coverage for Chromium, Firefox and WebKit: back/forward, reload, bfcache, plain links, rapid navigation and View Transitions.
- Add explicit, tested recovery semantics for aborted and timed-out transactions.
- Define the ESM-only or dual ESM/CJS module contract and verify it from a clean consumer.
- Add oldest-supported React and Next.js compatibility fixtures.

### Release gate

- No known critical/high security findings.
- Minimum 85% line and 80% statement coverage, with core navigation/layer branches explicitly covered.
- No unresolved peer-dependency warnings in supported consumer fixtures.
- Public API report reviewed; migration notes required for intentional behavior changes.

## 0.3.0 — Extensibility and observability

**Target: after 0.2.0 has stable real-world usage**

### Scope

- Add opt-in structured diagnostics with a documented privacy contract.
- Add pluggable custom storage and transaction adapters behind stable interfaces.
- Define serializer escape/version migration rules and reject ambiguous values safely.
- Add examples for custom serializers, schema validation and framework-neutral routers.
- Add stable types for middleware/instrumentation integration.
- Add benchmark trend reports by payload size and navigation mode.

### Release gate

- Public API and migration guide reviewed.
- Bundle budget remains at or below 12 KiB gzip for default core/adapters.
- Browser matrix green; performance regressions above 10% require an approved baseline update.

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
