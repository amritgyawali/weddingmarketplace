import { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/constants/theme';

/** The one ease-out curve every animation uses (quick start, soft landing). */
export const easeOut = Easing.bezier(0.2, 0, 0, 1);

/**
 * Motion that respects the device's Reduce Motion setting. `enter(i)` is a
 * fade-and-rise for the i-th section of a screen (staggered, capped so long
 * lists don't wait), `fade` a plain fade; both are `undefined` when the user
 * asked for less motion, so the content simply appears.
 */
export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced,
    enter: (index = 0) =>
      reduced ? undefined : FadeInDown.duration(motion.slow).delay(Math.min(index, 6) * motion.stagger).easing(easeOut).withInitialValues({ transform: [{ translateY: 10 }] }),
    fade: reduced ? undefined : FadeIn.duration(motion.base).easing(easeOut),
    duration: (ms: number) => (reduced ? 0 : ms),
  };
}
