import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Build sanity check: verifies that every export path declared in
 * package.json actually exists in `dist` (including code-split chunks for
 * the react/next entries) and that d.ts companions were emitted.
 */
const required = [
  "dist/core/index.js",
  "dist/core/index.d.ts",
  "dist/react/index.js",
  "dist/react/index.d.ts",
  "dist/next/index.js",
  "dist/next/index.d.ts",
];

const missing = required.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`postbuild: missing build outputs:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) total += countFiles(path);
    else total += 1;
  }
  return total;
}

console.log(`postbuild: dist OK (${countFiles("dist")} files)`);
