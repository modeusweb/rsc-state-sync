/**
 * Micro-benchmarks for the serialization-heavy paths of rsc-state-sync.
 *
 * Run with `npm run bench`. Results are wall-clock times for a single pass;
 * treat them as order-of-magnitude guidance, not lab numbers.
 */
import { createRegistry } from "../dist/core/index.js";

// Minimal fake browser: the history layer degrades gracefully without one,
// but installing it lets us benchmark the real history write path.
const state = { historyState: null };
globalThis.window = { history: { state: null, replaceState(s) { state.historyState = s; } }, location: { pathname: "/", search: "", hash: "" }, sessionStorage: undefined };
globalThis.history = globalThis.window.history;
globalThis.location = globalThis.window.location;
globalThis.sessionStorage = undefined;

const SIZES = [10, 100, 500, 1024]; // in KiB

function makeState(kib) {
  const target = kib * 1024;
  const items = [];
  let bytes = 0;
  let id = 0;
  while (bytes < target) {
    const item = { id, label: `item-${id}`, tags: ["a", "b", "c"] };
    bytes += JSON.stringify(item).length;
    items.push(item);
    id += 1;
  }
  return { items };
}

function time(fn, iterations = 20) {
  fn(); // warmup
  const started = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return (performance.now() - started) / iterations;
}

function fmt(ms) {
  return ms >= 1 ? `${ms.toFixed(2)} ms` : `${(ms * 1000).toFixed(0)} µs`;
}

console.log(`size | serialize | deserialize | update | capture`);
for (const kib of SIZES) {
  const state = makeState(kib);
  const label = `${kib} KiB`;

  const registry = createRegistry();
  const handle = registry.get("bench", state, { persist: ["memory", "history"] });

  const serialize = time(() => JSON.stringify(state));
  const deserialize = time(() => JSON.parse(JSON.stringify(state)));

  let version = 0;
  const update = time(() => {
    version += 1;
    handle.setState({ items: state.items.slice(0, version) });
    handle.capture(version);
  }, 50);

  const capture = time(() => handle.capture(1), 50);

  console.log(
    `${label} | ${fmt(serialize)} | ${fmt(deserialize)} | ${fmt(update)} | ${fmt(capture)}`,
  );
  registry.dispose();
}
