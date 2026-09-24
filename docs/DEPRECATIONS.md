# Deprecation policy

Public APIs are stable throughout the 1.x line. A public API may be deprecated
only when a backward-compatible replacement is available and a migration note is
published in `CHANGELOG.md` and `docs/UPGRADE.md`.

Deprecations must include the first deprecating version, the replacement API,
the earliest removal version and a migration example. Runtime behavior changes
that can affect persisted data require a major version and envelope migration
notes. Internal helpers, test fixtures and adapter candidates may change without
a major release when they are not exported from a supported package entry.

Security fixes may be released in a patch version. Data-loss fixes receive a
patch release when backward compatible and a minor/major release when persisted
format or transaction semantics change.
