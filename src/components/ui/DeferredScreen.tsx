import { useEffect, useState, type ComponentType } from 'react';

import { useRoleTheme } from '@/theme/RoleTheme';

import { LoadingState } from './Loader';

/** How long a screen may take to draw before its loader fades in. */
const LOADER_DELAY_MS = 180;

/** False for the screen's first frame, then true: lets a light frame go out before the heavy one. */
export function useAfterFirstFrame(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready;
}

/**
 * Wraps a heavy screen (a 12-tab console, a long guest list) so a tap answers
 * at once: the first frame is the screen's background with a loader, which
 * lets the navigation slide start, and the full screen is drawn on the next
 * frame. The loader only fades in when that drawing takes longer than a blink
 * (`LOADER_DELAY_MS`), so fast phones never see it.
 */
export function deferredScreen<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function DeferredScreen(props: P) {
    const ready = useAfterFirstFrame();
    const t = useRoleTheme();
    if (ready) return <Screen {...props} />;
    return <LoadingState delay={LOADER_DELAY_MS} style={{ backgroundColor: t.c.bg }} />;
  }
  DeferredScreen.displayName = `Deferred(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return DeferredScreen;
}
