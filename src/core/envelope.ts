import {
  ENVELOPE_FORMAT,
  HISTORY_STATE_KEY,
} from "./constants.js";
import { StateSyncError } from "./errors.js";
import { getBrowser } from "./env.js";
import type { LayerWriteResult, StoredRecord } from "./types.js";

export function storageUnavailable(layer: string, scope: string, cause?: unknown): LayerWriteResult {
  return {
    ok: false,
    error: new StateSyncError("STORAGE_UNAVAILABLE", `The "${layer}" layer is unavailable`, {
      scope,
      layer,
      cause,
    }),
  };
}

export function encodeEnvelope(record: StoredRecord): string {
  return JSON.stringify({
    f: ENVELOPE_FORMAT,
    v: record.v,
    r: record.r,
    t: record.t,
    a: record.a ? 1 : 0,
    p: record.payload,
  });
}

/** Throws `StateSyncError` when the stored envelope cannot be trusted. */
export function decodeEnvelope(raw: unknown, scope: string, layer: string): StoredRecord {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new StateSyncError("INVALID_PAYLOAD", "Corrupted persisted state", {
        scope,
        layer,
        cause: error,
      });
    }
  }
  if (raw === null || typeof raw !== "object") {
    throw new StateSyncError("INVALID_PAYLOAD", "Corrupted persisted state", { scope, layer });
  }
  const envelope = raw as Record<string, unknown>;
  if (
    envelope.f !== ENVELOPE_FORMAT ||
    typeof envelope.v !== "number" ||
    typeof envelope.r !== "number" ||
    typeof envelope.t !== "number" ||
    typeof envelope.p !== "string"
  ) {
    throw new StateSyncError("INVALID_PAYLOAD", "Unrecognized persisted state envelope", {
      scope,
      layer,
    });
  }
  return { v: envelope.v, r: envelope.r, t: envelope.t, a: envelope.a === 1, payload: envelope.p };
}

export function readHistoryBucket(): Record<string, unknown> | null {
  const browser = getBrowser();
  if (!browser) return null;
  const raw: unknown = browser.history.state;
  if (raw === null || typeof raw !== "object") return null;
  const bucket: unknown = (raw as Record<string, unknown>)[HISTORY_STATE_KEY];
  if (bucket === null || typeof bucket !== "object") return null;
  return bucket as Record<string, unknown>;
}

/**
 * Builds a new `history.state` value that merges our bucket into the current
 * one. Foreign keys (the router's own state) are always preserved.
 */
export function mergeHistoryState(scope: string, envelope: string): Record<string, unknown> {
  const browser = getBrowser();
  const raw: unknown = browser ? browser.history.state : null;
  const base: Record<string, unknown> =
    raw !== null && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  const previous: Record<string, unknown> =
    base[HISTORY_STATE_KEY] !== null && typeof base[HISTORY_STATE_KEY] === "object"
      ? { ...(base[HISTORY_STATE_KEY] as Record<string, unknown>) }
      : {};
  previous[scope] = JSON.parse(envelope) as unknown;
  base[HISTORY_STATE_KEY] = previous;
  return base;
}

export function replaceHistoryState(state: unknown, url?: string): void {
  const browser = getBrowser();
  if (!browser) return;
  if (url === undefined) browser.history.replaceState(state, "");
  else browser.history.replaceState(state, "", url);
}

export function buildUrl(search: string): string {
  const browser = getBrowser();
  if (!browser) return "";
  return `${browser.location.pathname}${search ? `?${search}` : ""}${browser.location.hash}`;
}
