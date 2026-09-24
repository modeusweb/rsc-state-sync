import type { StateSerializer } from "./types.js";

/**
 * Property key used to tag values that plain JSON cannot represent.
 * User objects that contain the reserved key are escaped automatically.
 */
const TAG = "$rss";

/** Quoted form of {@link TAG} as it appears in a serialized payload. */
const TAG_MARKER = `"${TAG}"`;

type Tag = "escaped" | "undefined" | "nan" | "inf" | "-inf" | "bigint" | "date" | "usp";

/**
 * Sentinel returned by the reviver for `undefined`.
 *
 * `JSON.parse` *deletes* a property whose reviver returns `undefined`, so the
 * value has to survive parsing and be turned into a real `undefined` in a
 * second pass (see {@link restoreSentinels}).
 */
const UNDEFINED = Symbol("rsc-state-sync:undefined");
const internalTags = new WeakSet<object>();

function tag(kind: Tag, value?: unknown): Record<string, unknown> {
  const tagged: Record<string, unknown> = { [TAG]: kind };
  if (value !== undefined) tagged.value = value;
  internalTags.add(tagged);
  return tagged;
}

/**
 * `JSON.stringify` applies `toJSON()` *before* the replacer runs: the value it
 * passes in is already a string for `Date`, and the untouched instance for
 * `URLSearchParams`. The original value is therefore always read from the
 * holder (`this[key]`), never from the transformed argument.
 */
function replace(this: unknown, key: string, value: unknown): unknown {
  const raw = (this as Record<string, unknown> | null)?.[key];
  if (value === undefined) return tag("undefined");
  if (typeof value === "number") {
    if (Number.isNaN(value)) return tag("nan");
    if (value === Number.POSITIVE_INFINITY) return tag("inf");
    if (value === Number.NEGATIVE_INFINITY) return tag("-inf");
    return value;
  }
  if (typeof value === "bigint") return tag("bigint", value.toString());
  if (raw instanceof Date) {
    // `Invalid Date` has no ISO representation at all: it survives as `null`
    // instead of throwing a RangeError.
    const time = raw.getTime();
    return Number.isNaN(time) ? null : tag("date", raw.toISOString());
  }
  if (raw instanceof URLSearchParams) return tag("usp", raw.toString());
  if (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    !internalTags.has(raw) &&
    Object.prototype.hasOwnProperty.call(raw, TAG)
  ) {
    return tag("escaped", JSON.stringify(value));
  }
  return value;
}

function revive(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const kind = record[TAG];
    if (typeof kind === "string") {
      switch (kind as Tag) {
        case "escaped":
          return JSON.parse(record.value as string) as unknown;
        case "undefined":
          return UNDEFINED;
        case "nan":
          return Number.NaN;
        case "inf":
          return Number.POSITIVE_INFINITY;
        case "-inf":
          return Number.NEGATIVE_INFINITY;
        case "bigint":
          try {
            return BigInt(record.value as string);
          } catch {
            return 0n;
          }
        case "date":
          return new Date(record.value as string);
        case "usp":
          return new URLSearchParams(record.value as string);
      }
    }
  }
  return value;
}

/**
 * Turns the {@link UNDEFINED} sentinels left by the reviver into real
 * `undefined` values (keeping the property, which `JSON.parse` alone would
 * have dropped). Only runs for payloads that actually contain a tag.
 */
function restoreSentinels(node: unknown): unknown {
  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index += 1) {
      const value: unknown = node[index];
      if (value === UNDEFINED) node[index] = undefined;
      else if (value !== null && typeof value === "object") restoreSentinels(value);
    }
    return node;
  }
  if (node !== null && typeof node === "object") {
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (value === UNDEFINED) record[key] = undefined;
      else if (value !== null && typeof value === "object") restoreSentinels(value);
    }
  }
  return node;
}

/**
 * The default serializer: tagged JSON.
 *
 * Plain JSON is the right trade-off for 95% of UI state: it is tiny, fast and
 * supported everywhere. The tag layer adds just enough fidelity for the types
 * that show up in UI state: `undefined` (including object properties and array
 * holes, which plain JSON would drop), `NaN`/`±Infinity`, `bigint`, `Date` and
 * `URLSearchParams`. Arrays, nested objects and primitives work as-is.
 *
 * Not supported (by design): functions, class instances other than `Date`,
 * `Map`/`Set` (they serialize to `{}`), symbols, circular references. Convert
 * them or plug in a custom `StateSerializer`.
 *
 * Payloads without any tag are parsed with plain `JSON.parse` — the tag pass
 * costs nothing unless a tagged value is actually present.
 */
export function createJsonSerializer<T>(): StateSerializer<T> {
  return {
    serialize(value: T): string {
      return JSON.stringify(value, replace);
    },
    deserialize(text: string): T {
      if (!text.includes(TAG_MARKER)) return JSON.parse(text) as T;
      const parsed = JSON.parse(text, revive);
      if (parsed === UNDEFINED) return undefined as T;
      return restoreSentinels(parsed) as T;
    },
  };
}

export const jsonSerializer: StateSerializer<unknown> = createJsonSerializer<unknown>();
