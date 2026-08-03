import { useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Motion language. The app had no animation at all, which is most of why it
 * read as machine-made: every surface arrived fully formed and nothing
 * acknowledged a touch.
 *
 * Everything here is expressed for RN's `Animated` with `useNativeDriver`, so
 * transitions run on the UI thread and survive a busy JS thread (the Studio
 * decodes images while you tap). That rules out animating layout props —
 * opacity and transform only.
 */

/** Durations (ms). Anything above `slow` starts to feel like waiting. */
export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 380,
  reveal: 520,
  drift: 14000, // aurora blob cycle — slow enough to read as ambient, not motion
} as const;

/**
 * Curves. `standard` is the workhorse; `exit` leaves quickly so a dismissed
 * thing does not linger; `entrance` overshoots slightly so cards feel placed
 * rather than pasted.
 */
export const easing = {
  standard: Easing.bezier(0.32, 0.72, 0, 1),
  entrance: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
  linear: Easing.linear,
  breathe: Easing.inOut(Easing.sin),
} as const;

/** Spring for press feedback — critically damped, no visible wobble. */
export const spring = {
  press: { tension: 320, friction: 18, useNativeDriver: true },
  settle: { tension: 180, friction: 20, useNativeDriver: true },
} as const;

/** How far a revealed element travels up into place (dp). */
export const revealOffset = 14;

/** Delay between staggered siblings (ms). Caps so long lists do not crawl. */
export const stagger = (index: number, step = 55, max = 6) =>
  Math.min(index, max) * step;

/**
 * A per-component `Animated.Value` that survives re-renders.
 *
 * The usual spelling is `useRef(new Animated.Value(0)).current`, which this
 * project's lint config rejects under `react-hooks/refs` — reading `.current`
 * during render is the thing that rule exists to catch, and it cannot tell an
 * animation handle from a DOM node. Lazy `useState` gives the same stable
 * identity without the false positive, and skips allocating a new
 * `Animated.Value` on every render the way a bare `useRef(new …)` does.
 *
 * The setter is deliberately dropped: the value is mutated by the animation
 * driver, never replaced.
 */
export function useAnimatedValue(initial = 0): Animated.Value {
  return useState(() => new Animated.Value(initial))[0];
}

export type DurationToken = keyof typeof duration;
