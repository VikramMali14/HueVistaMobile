import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Semantic haptics.
 *
 * Screens should say what happened ("a selection changed", "that failed"), not
 * which motor pattern to fire. Two reasons this is a module rather than raw
 * `Haptics.*` calls at each site:
 *
 *  1. Consistency. The app previously called `selectionAsync()` in three places
 *     and nothing anywhere else, so feedback was arbitrary — picking a shade
 *     buzzed, but saving a project, hitting a quota wall and failing to sign in
 *     were all silent.
 *  2. Safety. Every expo-haptics call returns a promise that rejects on devices
 *     with no haptic engine, and Android throws if VIBRATE is missing. An
 *     unhandled rejection there would surface as a redbox in dev over something
 *     purely decorative. Everything below swallows its own failure.
 *
 * Web has no haptic API at all, so the whole module no-ops there rather than
 * throwing on each call.
 */

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Global mute. Flipped by the accessibility toggle in Account so a user who
 * finds vibration unpleasant can turn it off app-wide, and by tests.
 */
let enabled = true;

export function setHapticsEnabled(next: boolean) {
  enabled = next;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

/** Runs `fn`, discarding both sync throws and async rejections. */
function fire(fn: () => Promise<unknown>): void {
  if (!supported || !enabled) return;
  try {
    void fn().catch(() => {});
  } catch {
    // Older Android without VIBRATE throws synchronously.
  }
}

/**
 * Impact weights, mapped to intent:
 *   light  — something small moved (chip, tab, stepper)
 *   medium — a committed action (primary button, apply a shade)
 *   heavy  — a large state change (project created, photo captured)
 */
type Weight = 'light' | 'medium' | 'heavy';

const styleFor: Record<Weight, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

export const haptics = {
  /** Moving across discrete options — shade swatches, tabs, filters, steppers. */
  select() {
    fire(() => Haptics.selectionAsync());
  },

  /** A tap that does something small: chips, icon buttons, list rows. */
  tap() {
    fire(() => Haptics.impactAsync(styleFor.light));
  },

  /** A committed action: primary buttons, applying a shade, submitting a form. */
  press() {
    fire(() => Haptics.impactAsync(styleFor.medium));
  },

  /** Explicit weight, when a site needs to override the semantic default. */
  impact(weight: Weight = 'medium') {
    fire(() => Haptics.impactAsync(styleFor[weight]));
  },

  /** It worked — project saved, code redeemed, photo segmented. */
  success() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  /** It worked, with a caveat — quota nearly spent, read-only project opened. */
  warning() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },

  /** It failed — bad credentials, network error, quota exhausted. */
  error() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },

  /** A sheet, modal or drawer opening. Deliberately softer than `press`. */
  open() {
    fire(() => Haptics.impactAsync(styleFor.light));
  },

  /** A sheet or modal dismissing. */
  close() {
    fire(() => Haptics.impactAsync(styleFor.light));
  },
} as const;

export type HapticIntent = keyof typeof haptics;
