import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";

const root = process.cwd();
const node = process.execPath;
const npmCli = process.env.npm_execpath ?? join(dirname(node), "node_modules/npm/bin/npm-cli.js");
const version = execFileSync(node, ["-p", "require('./package.json').version"], { encoding: "utf8" }).trim();
const temporary = mkdtempSync(join(tmpdir(), "rsc-state-sync-smoke-"));
try {
  execFileSync(node, [npmCli, "pack", "--ignore-scripts", "--json"], { cwd: root, stdio: "ignore" });
  const archive = join(root, `rsc-state-sync-${version}.tgz`);
  const packageJson = {
    name: "rsc-state-sync-smoke",
    private: true,
    type: "module",
    version: "1.0.0",
  };
  writeFileSync(join(temporary, "package.json"), JSON.stringify(packageJson, null, 2));
  execFileSync(node, [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", archive, "react@19.3.0", "next@16.3.6", "typescript@5.9.3", "@types/react@19.2.14"], { cwd: temporary, stdio: "ignore" });
  const source = [
    'import { createRegistry } from "rsc-state-sync";',
    'import { useServerNavigationState } from "rsc-state-sync/react";',
    'import { useNavigationCommitSignal } from "rsc-state-sync/next";',
    "void createRegistry;",
    "void useServerNavigationState;",
    "void useNavigationCommitSignal;",
  ].join("\n");
  writeFileSync(join(temporary, "index.ts"), source);
  writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({
    compilerOptions: { module: "ESNext", moduleResolution: "bundler", strict: true, skipLibCheck: true, noEmit: true },
    include: ["index.ts"],
  }, null, 2));
  const tsc = join(temporary, "node_modules/typescript/bin/tsc");
  execFileSync(node, [tsc, "--noEmit"], { cwd: temporary, stdio: "inherit" });
  execFileSync(process.execPath, ["--input-type=module", "-e", "const m=await import('rsc-state-sync'); if(typeof m.createRegistry!=='function') process.exit(1)"], { cwd: temporary, stdio: "inherit" });
  console.log(`package smoke: ${version} OK`);
} finally {
  rmSync(join(root, `rsc-state-sync-${version}.tgz`), { force: true });
  rmSync(temporary, { recursive: true, force: true });
}
