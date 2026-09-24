import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const required = [
  "dist/core/index.js",
  "dist/core/index.d.ts",
  "dist/react/index.js",
  "dist/react/index.d.ts",
  "dist/next/index.js",
  "dist/next/index.d.ts",
];
for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Missing API artifact: ${file}`);
}
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const subpath of [".", "./core", "./react", "./next", "./package.json"]) {
  if (!pkg.exports[subpath]) throw new Error(`Missing package export: ${subpath}`);
}
if (pkg.type !== "module") throw new Error("Package must remain ESM-first");
console.log(`API surface: ${required.length} artifacts and ${Object.keys(pkg.exports).length} exports OK`);
