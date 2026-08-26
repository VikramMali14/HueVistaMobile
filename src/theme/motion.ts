import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Motion language.
 *
 * Everything here is expressed for RN's `Animated` with `useNativeDriver`, so
 * transitions run on the UI thread and survive a busy JS thread (the studio
 * decodes images while you tap). That rules out animating layout props —
 * opacity and transform only.
 */

/** Durations (ms). Anything above `slow` starts to feel like waiting. */
export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 380,
  reveal: 480,
  drift: 14000, // aurora blob cycle — slow enough to read as ambient, not motion
} as const;

/**
 * Curves.
 *
 * `standard` is iOS's own spring curve, which is what makes a sheet arriving
 * feel like the operating system rather than like CSS. `entrance` overshoots
 * slightly so cards feel placed rather than pasted; `exit` leaves quickly so a
 * dismissed thing does not linger.
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
 * Whether the person using the phone has asked for less movement.
 *
 * The design this app was built from carries a `prefers-reduced-motion` block
 * that flattens every animation, and the phone had no equivalent: drifting
 * aurora blobs, staggered reveals and a spinning progress ring ran regardless
 * of the OS accessibility setting. This is that block.
 *
 * Reads the live setting and keeps listening, because it can be turned on from
 * Control Centre while the app is open.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduced(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => setReduced(on));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * Seconds since this component mounted, ticking while `active`.
 *
 * Used to pace the progress bars on the two long server steps. Put the hook in
 * a component that only mounts while the work is running and the count is right
 * by construction, with nothing to reset and no effect writing state.
 *
 * The seconds are counted rather than measured against a start timestamp,
 * because reading the clock during render is impure — the same render would
 * produce a different number each time React replayed it. A `setInterval` can
 * drift by a few hundred milliseconds over a minute, which is invisible in a
 * label that reads "0:42".
 */
export function useElapsedSeconds(active = true): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  return seconds;
}

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
