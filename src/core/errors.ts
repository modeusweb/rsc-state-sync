export type StateSyncErrorCode =
  | "INVALID_PAYLOAD"
  | "VERSION_MISMATCH"
  | "EXPIRED"
  | "TOO_LARGE"
  | "SERIALIZE_FAILED"
  | "DESERIALIZE_FAILED"
  | "VALIDATION_FAILED"
  | "STORAGE_UNAVAILABLE";

/**
 * Recoverable errors raised by rsc-state-sync. Everything is non-fatal by
 * default: corrupted, expired, oversized or invalid state falls back to the
 * registered initial state.
 */
export class StateSyncError extends Error {
  readonly code: StateSyncErrorCode;
  readonly scope: string | null;
  readonly layer: string | null;

  constructor(
    code: StateSyncErrorCode,
    message: string,
    options?: { scope?: string | null; layer?: string | null; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "StateSyncError";
    this.code = code;
    this.scope = options?.scope ?? null;
    this.layer = options?.layer ?? null;
  }
}

export function isStateSyncError(error: unknown): error is StateSyncError {
  return error instanceof StateSyncError;
}
