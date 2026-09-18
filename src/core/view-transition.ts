export interface ViewTransitionLike {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

export type StartViewTransition = (
  callback: () => void | Promise<void>,
) => ViewTransitionLike;

type ViewTransitionDocument = Document & { startViewTransition?: StartViewTransition };

/**
 * View Transitions are a *progressive enhancement*: when the API is missing
 * (Safari < 18, Firefox, older Chromium), callers simply navigate without it.
 */
export function supportsViewTransitions(): boolean {
  return getStartViewTransition() !== null;
}

export function getStartViewTransition(): StartViewTransition | null {
  if (typeof document === "undefined") return null;
  const start = (document as ViewTransitionDocument).startViewTransition;
  if (typeof start !== "function") return null;
  return start.bind(document);
}
