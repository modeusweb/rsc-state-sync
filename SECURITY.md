# Security policy

## Reporting

Please report security issues privately through the repository's GitHub Security
Advisories page. Do not open a public issue for an unreported vulnerability.

Include the affected version, reproduction steps, impact and a proposed mitigation
when available. We aim to acknowledge reports within three business days.

## Supported versions

The latest `0.x` release receives security fixes. Users should upgrade to the
latest patch release before reporting an issue against an older version.

## Storage and privacy

`rsc-state-sync` has no runtime dependencies and does not transmit state. URL,
`history.state` and `sessionStorage` data are readable by browser code running
on the same origin. Do not persist secrets or sensitive data in these layers.
Custom layers and diagnostics are application-controlled; scope names and
diagnostic destinations may contain application metadata and should be treated
as potentially sensitive.

## Security checks

Every release runs dependency audit, packed-consumer tests, strict type checks,
coverage thresholds and browser tests. npm provenance/SBOM commands are provided
for release automation; local token-based publishing does not imply provenance.
