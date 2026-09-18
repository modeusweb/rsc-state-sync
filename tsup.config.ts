import { defineConfig } from "tsup";

/**
 * Single tsup build for all entry points with code splitting enabled.
 *
 * Why: `./react` and `./next` import the framework-agnostic core. With
 * splitting, esbuild emits one shared chunk that all entries import, which
 * guarantees a *single module instance* of the core (and therefore a single
 * default registry) no matter which subpath a consumer imports. Without
 * splitting, each entry would inline its own copy of the core and two
 * `rsc-state-sync/react` + `rsc-state-sync` consumers would silently end up
 * with two different registries.
 *
 * The `react` and `next` entries get a `"use client"` banner so the adapters
 * can be imported from Server Components (Next.js App Router RSC).
 */
const shared = {
  format: ["esm"] as const,
  target: "es2022",
  outDir: "dist",
  dts: true,
  splitting: true,
  minify: true,
  sourcemap: true,
  treeshake: true,
  external: ["react", "react-dom", "next", "next/navigation", "next/link"],
};

export default [
  {
    ...shared,
    // Only the first config cleans, otherwise the second run wipes the
    // first one's outputs (they share `outDir`).
    clean: true,
    entry: { "core/index": "src/core/index.ts" },
  },
  {
    ...shared,
    entry: {
      "react/index": "src/react/index.ts",
      "next/index": "src/next/index.ts",
    },
    banner: { js: '"use client";' },
  },
];
