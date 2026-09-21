import { describe, expect, it } from "vitest";
import { createJsonSerializer, jsonSerializer } from "../src/core/index.js";

interface Payload {
  id: number;
  title: string;
}

describe("core/serializer", () => {
  it("round-trips plain JSON values", () => {
    const value = { id: 1, title: "book", tags: ["a", "b"], meta: { page: 2, ok: true } };
    expect(jsonSerializer.deserialize(jsonSerializer.serialize(value))).toEqual(value);
  });

  it("parses payloads without tags without the reviver pass", () => {
    const payload = JSON.stringify({ id: 1, nested: { list: [1, 2, 3] } });
    expect(jsonSerializer.deserialize(payload)).toEqual({ id: 1, nested: { list: [1, 2, 3] } });
  });

  it("keeps object properties whose value is undefined", () => {
    const s = createJsonSerializer<{ a?: number; b: number }>();
    const restored = s.deserialize(s.serialize({ a: undefined, b: 1 }));
    expect("a" in restored).toBe(true);
    expect(restored.a).toBeUndefined();
    expect(restored.b).toBe(1);
  });

  it("keeps array holes (undefined elements) and the array length", () => {
    const s = createJsonSerializer<(number | undefined)[]>();
    const restored = s.deserialize(s.serialize([1, undefined, 3]));
    expect(restored).toHaveLength(3);
    expect(1 in restored).toBe(true);
    expect(restored[1]).toBeUndefined();
    expect(restored[2]).toBe(3);
  });

  it("keeps a top-level undefined", () => {
    expect(jsonSerializer.deserialize(jsonSerializer.serialize(undefined))).toBeUndefined();
  });

  it("keeps NaN and ±Infinity", () => {
    const s = createJsonSerializer<{ nan: number; inf: number; ninf: number }>();
    const restored = s.deserialize(
      s.serialize({
        nan: Number.NaN,
        inf: Number.POSITIVE_INFINITY,
        ninf: Number.NEGATIVE_INFINITY,
      }),
    );
    expect(Number.isNaN(restored.nan)).toBe(true);
    expect(restored.inf).toBe(Number.POSITIVE_INFINITY);
    expect(restored.ninf).toBe(Number.NEGATIVE_INFINITY);
  });

  it("keeps bigint values", () => {
    const s = createJsonSerializer<{ id: bigint }>();
    const restored = s.deserialize(s.serialize({ id: 42n }));
    expect(restored.id).toBe(42n);
    expect(typeof restored.id).toBe("bigint");
  });

  it("keeps Date instances (including inside arrays and nested objects)", () => {
    const created = new Date("2024-05-06T07:08:09.000Z");
    const s = createJsonSerializer<{
      at: Date;
      list: Date[];
      nested: { deep: { at: Date } };
    }>();
    const restored = s.deserialize(
      s.serialize({
        at: created,
        list: [created],
        nested: { deep: { at: created } },
      }),
    );
    expect(restored.at).toBeInstanceOf(Date);
    expect(restored.at.getTime()).toBe(created.getTime());
    expect(restored.list[0]).toBeInstanceOf(Date);
    expect(restored.nested.deep.at.toISOString()).toBe("2024-05-06T07:08:09.000Z");
  });

  it("stores an Invalid Date as null instead of throwing", () => {
    const s = createJsonSerializer<{ at: Date | null }>();
    const restored = s.deserialize(s.serialize({ at: new Date(Number.NaN) }));
    expect(restored.at).toBeNull();
  });

  it("keeps URLSearchParams", () => {
    const s = createJsonSerializer<{ params: URLSearchParams }>();
    const restored = s.deserialize(s.serialize({ params: new URLSearchParams("q=shoes&page=2") }));
    expect(restored.params).toBeInstanceOf(URLSearchParams);
    expect(restored.params.get("q")).toBe("shoes");
    expect(restored.params.get("page")).toBe("2");
  });

  it("round-trips a realistic mixed payload", () => {
    const value = {
      filters: { q: "shoes", page: 2, from: new Date("2024-01-01T00:00:00.000Z") },
      params: new URLSearchParams("sort=price"),
      cursor: undefined,
      total: 10n,
      ratio: Number.NaN,
      rows: [{ id: 1, note: undefined }],
    };
    const s = createJsonSerializer<typeof value>();
    const restored = s.deserialize(s.serialize(value));
    expect(restored.filters.from).toBeInstanceOf(Date);
    expect(restored.params.toString()).toBe("sort=price");
    expect(restored.cursor).toBeUndefined();
    expect("cursor" in restored).toBe(true);
    expect(restored.total).toBe(10n);
    expect(Number.isNaN(restored.ratio)).toBe(true);
    expect(restored.rows[0].note).toBeUndefined();
  });

  it("documents the tag-collision contract ($rss)", () => {
    // A payload that literally contains `$rss` keys is claimed by the tag layer;
    // a custom serializer is required for such data.
    const s = createJsonSerializer<{ a: unknown }>();
    const restored = s.deserialize(s.serialize({ a: { $rss: "nan" } }));
    expect(Number.isNaN(restored.a as number)).toBe(true);
  });

  it("allows a per-slot serialized instance", () => {
    const serializer = createJsonSerializer<Payload>();
    expect(serializer.deserialize(serializer.serialize({ id: 3, title: "t" }))).toEqual({
      id: 3,
      title: "t",
    });
  });

  it("serializes Map/Set to {} (unsupported by design)", () => {
    expect(jsonSerializer.serialize({ m: new Map([["a", 1]]) })).toBe('{"m":{}}');
    expect(jsonSerializer.serialize({ s: new Set([1]) })).toBe('{"s":{}}');
  });
});
