/**
 * Envelope format version. Bumped when the persisted envelope layout changes.
 */
export const ENVELOPE_FORMAT = 1;

/**
 * Key used inside `history.state`. We only ever *merge* into the existing
 * history entry state (routers such as Next.js App Router store their own
 * routing metadata there), we never replace foreign keys.
 */
export const HISTORY_STATE_KEY = "__rscStateSync";

/** `sessionStorage` key prefix: `<prefix><scope>`. */
export const SESSION_KEY_PREFIX = "__rscStateSync:";

/** URL search parameter prefix: `<prefix><scope>`. */
export const URL_PARAM_PREFIX = "__nss.";

/** Default search parameter name for the `url` layer of a given scope. */
export function defaultUrlKey(scope: string): string {
  return `${URL_PARAM_PREFIX}${scope}`;
}

/** Time (ms) to wait for a navigation commit signal before giving up. */
export const DEFAULT_COMMIT_TIMEOUT = 3000;

/**
 * Maximum payload size per layer, in characters of the *serialized* payload
 * (for the `url` layer the cost of percent-encoding is counted).
 */
export const DEFAULT_MAX_CHARS: Record<StorageLayerName, number> = {
  memory: Number.POSITIVE_INFINITY,
  history: 32_768,
  session: 131_072,
  url: 2_048,
};

/**
 * Persistence presets.
 *
 * - `navigation`: memory fast-path + history entries (default). Survives
 *   navigation and back/forward, does not survive a page reload.
 * - `history`: state travels strictly with history entries.
 * - `session`: memory + `sessionStorage`, survives a reload within the tab.
 * - `none`: nothing is persisted; the state lives only while at least one
 *   component is bound to the scope.
 */
export const PRESET_LAYERS: Record<string, StorageLayerName[]> = {
  navigation: ["memory", "history"],
  history: ["history"],
  session: ["memory", "session"],
  none: [],
};

import type { StorageLayerName } from "./types.js";

