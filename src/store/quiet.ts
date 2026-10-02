/** Nesting depth of store actions; only depth-0 calls (made by a screen) get a confirmation toast. */
export const actionDepth = { current: 0 };

/** Runs store actions without the automatic confirmation toast (simulated replies, timers). */
export function quietly<T>(fn: () => T): T {
  actionDepth.current++;
  try {
    return fn();
  } finally {
    actionDepth.current--;
  }
}
