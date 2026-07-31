import { UNLIMITED, planStanding, spendableProjects } from './plan';
import type { Subscription } from '../api';

const NOW = Date.parse('2026-07-31T12:00:00Z');
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1',
  plan: 'STARTER',
  planDisplayName: 'Starter',
  status: 'ACTIVE',
  currentPeriodStart: inDays(-10),
  currentPeriodEnd: inDays(20),
  quantity: 1,
  projectsUsed: 3,
  projectsLimit: 15,
  projectsRemaining: 12,
  reservedProjects: 0,
  purchasedProjectCredits: 0,
  carriedProjectCredits: 0,
  extraProjectPoints: 65,
  extraProjectPricePaise: 6500,
  pdfDownloadsUsed: 0,
  pdfDownloadsLimit: 0,
  pdfDownloadsRemaining: 0,
  pdfImageLimit: 0,
  cancelAtPeriodEnd: false,
  trial: false,
  ...over,
});

describe('spendableProjects', () => {
  it('adds bought and carried credits to the plan allowance', () => {
    expect(
      spendableProjects(sub({ projectsLimit: 15, purchasedProjectCredits: 2, carriedProjectCredits: 3 })),
    ).toBe(20);
  });

  it('is zero without a subscription', () => {
    expect(spendableProjects(null)).toBe(0);
    expect(spendableProjects(undefined)).toBe(0);
  });

  it('stays unlimited rather than adding to the sentinel', () => {
    expect(
      spendableProjects(sub({ projectsLimit: UNLIMITED, purchasedProjectCredits: 5 })),
    ).toBe(UNLIMITED);
  });
});

describe('planStanding', () => {
  it('entitles an active plan inside its period', () => {
    const s = planStanding(sub(), NOW);
    expect(s.entitles).toBe(true);
    expect(s.label).toBe('Active');
    expect(s.daysLeft).toBe(20);
  });

  it('keeps a cancelled plan working to the end of the paid period', () => {
    const s = planStanding(sub({ status: 'CANCELLED' }), NOW);
    expect(s.entitles).toBe(true);
    expect(s.windingDown).toBe(true);
    expect(s.label).toBe('Not renewing');
  });

  it('stops entitling once a cancelled plan runs past its period', () => {
    const s = planStanding(sub({ status: 'CANCELLED', currentPeriodEnd: inDays(-1) }), NOW);
    expect(s.entitles).toBe(false);
    expect(s.label).toBe('Ended');
  });

  it('does not entitle a plan bought to start later', () => {
    const s = planStanding(sub({ currentPeriodStart: inDays(5), currentPeriodEnd: inDays(35) }), NOW);
    expect(s.entitles).toBe(false);
    expect(s.label).toBe('Starts later');
  });

  it('names a failed payment rather than calling it ended', () => {
    expect(planStanding(sub({ status: 'HALTED' }), NOW).label).toBe('Payment failed');
  });

  it('marks a trial, and an active plan set to cancel', () => {
    expect(planStanding(sub({ trial: true }), NOW).label).toBe('Free trial');
    const winding = planStanding(sub({ cancelAtPeriodEnd: true }), NOW);
    expect(winding.entitles).toBe(true);
    expect(winding.label).toBe('Not renewing');
  });

  it('reads no subscription as no standing at all', () => {
    const s = planStanding(null, NOW);
    expect(s.entitles).toBe(false);
    expect(s.label).toBeNull();
  });
});
