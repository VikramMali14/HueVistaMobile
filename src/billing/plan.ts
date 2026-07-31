import type { Subscription } from '../api';
import type { StatusTone } from '../components';

/** The backend's "no ceiling" sentinel, mirrored from `Plan`. */
export const UNLIMITED = 1_000_000;

/**
 * Everything spendable this cycle — not just the plan's own allowance.
 *
 * Bought extras and projects carried over from a plan the shop upgraded away
 * from are real and usable, and a meter that ignored them read "full" while runs
 * were still available.
 */
export function spendableProjects(sub: Subscription | null | undefined): number {
  if (!sub) return 0;
  if (sub.projectsLimit >= UNLIMITED) return UNLIMITED;
  return sub.projectsLimit + sub.purchasedProjectCredits + sub.carriedProjectCredits;
}

export interface PlanStanding {
  /** True when this subscription actually entitles work right now. */
  entitles: boolean;
  /** A short pill label, or null when there is nothing worth saying. */
  label: string | null;
  tone: StatusTone;
  /** Whole days until the current period ends; null when there is no end. */
  daysLeft: number | null;
  /** Paid up but not renewing — cancelled, or set to cancel at period end. */
  windingDown: boolean;
}

/**
 * What a subscription means today.
 *
 * Mirrors the backend's entitlement gate rather than testing `status === ACTIVE`,
 * because two ordinary states are neither ACTIVE nor dead:
 *
 *  - a CANCELLED plan keeps working to the end of the period it was paid for;
 *  - a plan bought to replace one still winding down does not start until that
 *    period ends, so it entitles nothing yet.
 *
 * Reading only the status left the shop with no usage figure for a plan that was
 * still running, and no prompt at all once it lapsed — exactly when it matters.
 */
export function planStanding(
  sub: Subscription | null | undefined,
  now: number = Date.now(),
): PlanStanding {
  if (!sub) {
    return { entitles: false, label: null, tone: 'expired', daysLeft: null, windingDown: false };
  }

  const startedYet =
    sub.currentPeriodStart == null || new Date(sub.currentPeriodStart).getTime() <= now;
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
  const withinPaidPeriod = periodEnd != null && periodEnd > now;
  const daysLeft =
    periodEnd != null ? Math.max(0, Math.ceil((periodEnd - now) / 86_400_000)) : null;

  const entitles =
    startedYet && (sub.status === 'ACTIVE' || (sub.status === 'CANCELLED' && withinPaidPeriod));
  const windingDown = sub.status === 'CANCELLED' || sub.cancelAtPeriodEnd;

  if (!startedYet) {
    return { entitles: false, label: 'Starts later', tone: 'progress', daysLeft, windingDown };
  }
  if (!entitles) {
    return {
      entitles: false,
      label: sub.status === 'HALTED' ? 'Payment failed' : 'Ended',
      tone: 'expired',
      daysLeft,
      windingDown,
    };
  }
  if (sub.trial) return { entitles: true, label: 'Free trial', tone: 'progress', daysLeft, windingDown };
  if (windingDown) return { entitles: true, label: 'Not renewing', tone: 'progress', daysLeft, windingDown };
  return { entitles: true, label: 'Active', tone: 'done', daysLeft, windingDown };
}
