/**
 * Bundle size report: raw + gzipped sizes of the built entry points.
 * Run `npm run build` first, then `npm run size`.
 */
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const distDir = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

const files = walk(distDir).filter((file) => file.endsWith(".js"));
let totalRaw = 0;
let totalGzip = 0;
console.log("file | raw | gzip");
for (const file of files) {
  const raw = statSync(file).size;
  const gzip = gzipSync(readFileSync(file)).length;
  totalRaw += raw;
  totalGzip += gzip;
  console.log(`${file.replace(distDir, "dist/")} | ${fmt(raw)} | ${fmt(gzip)}`);
}
console.log(`TOTAL (js) | ${fmt(totalRaw)} | ${fmt(totalGzip)}`);
