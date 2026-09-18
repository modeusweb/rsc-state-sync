import type { StateSerializer } from "./types.js";

/**
 * Property key used to tag values that plain JSON cannot represent.
 * It is intentionally obscure; if it collides with real application data,
 * provide a custom `StateSerializer`.
 */
const TAG = "$rss";

type Tag = "undefined" | "nan" | "inf" | "-inf" | "bigint" | "date" | "usp";

function tag(kind: Tag, value?: unknown): Record<string, unknown> {
  const tagged: Record<string, unknown> = { [TAG]: kind };
  if (value !== undefined) tagged.value = value;
  return tagged;
}

function replace(this: unknown, _key: string, value: unknown): unknown {
  // JSON.stringify applies `toJSON()` *before* the replacer, so special
  // prototypes are recovered through the holder instead.
  const raw = (this as Record<string, unknown> | null)?.[_key];
  if (value === undefined) return tag("undefined");
  if (typeof value === "number") {
    if (Number.isNaN(value)) return tag("nan");
    if (value === Number.POSITIVE_INFINITY) return tag("inf");
    if (value === Number.NEGATIVE_INFINITY) return tag("-inf");
    return value;
  }
  if (typeof value === "bigint") return tag("bigint", value.toString());
  if (raw instanceof Date && value instanceof Date) {
    return tag("date", (value as Date).toISOString());
  }
  if (raw instanceof URLSearchParams && typeof value === "string") {
    return tag("usp", value);
  }
  return value;
}

function revive(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const kind = record[TAG];
    if (typeof kind === "string") {
      switch (kind as Tag) {
        case "undefined":
          return undefined;
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
 * The default serializer: tagged JSON.
 *
 * Plain JSON is the right trade-off for 95% of UI state: it is tiny, fast and
 * supported everywhere. The tag layer adds just enough fidelity for the types
 * that show up in UI state: `undefined`, `NaN`/`Infinity`, `bigint`, `Date`
 * and `URLSearchParams`. Arrays, nested objects and primitives work as-is.
 *
 * Not supported (by design): functions, class instances other than `Date`,
 * `Map`/`Set`, symbols, circular references. Convert them or plug in a custom
 * `StateSerializer`.
 */
export function createJsonSerializer<T>(): StateSerializer<T> {
  return {
    serialize(value: T): string {
      return JSON.stringify(value, replace);
    },
    deserialize(text: string): T {
      return JSON.parse(text, revive) as T;
    },
  };
}

export const jsonSerializer: StateSerializer<unknown> = createJsonSerializer<unknown>();
