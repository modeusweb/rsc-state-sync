# Upgrade guide

## 0.1.x to 0.2.x

- No migration is required for existing core, React or Next.js usage.
- Next.js `push` and `replace` now provide destination-correlated commits.
- Plain links continue to use the adapter location fallback.

## 0.3.x

- `createRegistry` accepts optional `layers` and `diagnostics` settings.
- Custom layer names are local to a registry.
- Diagnostics are opt-in and never include user state values.
- The built-in serializer now escapes application objects containing `$rss`.

## 0.4.x

- Adapter capability metadata is available from the core entry point.
- React Router and Remix are candidates, not bundled runtime adapters.

## 0.5.x

- ESM-first module contract, peer matrix and browser matrix are enforced.
- Use `npm run test:api` when reviewing public declaration changes.
