import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const USE_CLIENT = '"use client";\n';

for (const entry of ["dist/react/index.js", "dist/next/index.js"]) {
  const source = readFileSync(entry, "utf8");
  if (!source.startsWith('"use client"')) {
    writeFileSync(entry, `${USE_CLIENT}${source}`);
    console.log(`postbuild: prepended "use client" to ${entry}`);
  }
}

const required = [
  "dist/core/index.js",
  "dist/core/index.d.ts",
  "dist/core/index.js.map",
  "dist/react/index.js",
  "dist/react/index.d.ts",
  "dist/react/index.js.map",
  "dist/next/index.js",
  "dist/next/index.d.ts",
  "dist/next/index.js.map",
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
