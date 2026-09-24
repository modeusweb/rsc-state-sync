import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const node = process.execPath;
const npmCli = process.env.npm_execpath ?? join(dirname(node), "node_modules/npm/bin/npm-cli.js");
const version = execFileSync(node, ["-p", "require('./package.json').version"], { encoding: "utf8" }).trim();
const archive = join(root, `rsc-state-sync-${version}.tgz`);
const matrix = [
  { next: "13.5.11", react: "18.2.0", reactDom: "18.2.0", types: "18.2.79" },
  { next: "16.3.6", react: "19.3.0", reactDom: "19.3.0", types: "19.2.14" },
];

execFileSync(node, [npmCli, "pack", "--ignore-scripts", "--json"], { cwd: root, stdio: "ignore" });
try {
  for (const peer of matrix) {
    const temporary = mkdtempSync(join(tmpdir(), "rsc-state-sync-compat-"));
    try {
      writeFileSync(join(temporary, "package.json"), JSON.stringify({
        name: "rsc-state-sync-compat",
        private: true,
        type: "module",
        version: "1.0.0",
      }, null, 2));
      writeFileSync(join(temporary, "index.ts"), [
        'import { createRegistry } from "rsc-state-sync";',
        'import { useServerNavigationState } from "rsc-state-sync/react";',
        'import { useNavigationCommitSignal } from "rsc-state-sync/next";',
        "void createRegistry;",
        "void useServerNavigationState;",
        "void useNavigationCommitSignal;",
      ].join("\n"));
      writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          jsx: "react-jsx",
        },
        include: ["index.ts"],
      }, null, 2));
      execFileSync(node, [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", archive,
        `next@${peer.next}`, `react@${peer.react}`, `react-dom@${peer.reactDom}`,
        "typescript@5.9.3", `@types/react@${peer.types}`], { cwd: temporary, stdio: "ignore" });
      const tsc = join(temporary, "node_modules/typescript/bin/tsc");
      execFileSync(node, [tsc, "--noEmit"], { cwd: temporary, stdio: "inherit" });
      console.log(`compat smoke: Next ${peer.next} / React ${peer.react} OK`);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(archive, { force: true });
}
