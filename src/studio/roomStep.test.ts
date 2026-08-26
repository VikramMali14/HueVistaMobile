import { stepOfProject, STEP_INDEX, STEP_TOTAL } from './roomStep';
import type { Project, ProjectSummary } from '../api';

/**
 * The step a room opens on is derived from the project, never from a counter
 * the app keeps — that is what makes a half-finished room resumable on another
 * phone a week later. These pin the mapping down, because getting it wrong
 * means a customer lands on a step that cannot do anything.
 */

function project(over: Partial<Project>): Project {
  return {
    id: 'p1',
    status: 'CREATED',
    regions: [],
    hasShareLink: false,
    readOnly: false,
    reopenPricePoints: 0,
    ...over,
  } as Project;
}

function region(over: Partial<Project['regions'][number]> = {}) {
  return { id: 1, manual: false, ...over } as Project['regions'][number];
}

describe('stepOfProject', () => {
  it('puts a freshly uploaded photo on Prepare', () => {
    expect(stepOfProject(project({ status: 'CREATED' }))).toBe('prepare');
  });

  it('puts a running detection on Walls', () => {
    expect(stepOfProject(project({ status: 'SEGMENTING' }))).toBe('walls');
  });

  it('puts a failed detection on Walls, where the retry lives', () => {
    // Not on Prepare: the choice between AI and by-hand has already been made,
    // and the thing that can fix this — try again, or mark by hand — is here.
    expect(stepOfProject(project({ status: 'FAILED' }))).toBe('walls');
  });

  it('puts a segmented room that found nothing back on Walls', () => {
    expect(stepOfProject(project({ status: 'SEGMENTED', regions: [] }))).toBe('walls');
  });

  it('puts bare surfaces on Adjust, so they get checked before painting', () => {
    expect(
      stepOfProject(project({ status: 'SEGMENTED', regions: [region({ id: 1 }), region({ id: 2 })] })),
    ).toBe('adjust');
  });

  it('puts a room with paint on it on Colour', () => {
    expect(
      stepOfProject(
        project({
          status: 'SEGMENTED',
          regions: [region({ id: 1, appliedHexCode: '#a2bccd' }), region({ id: 2 })],
        }),
      ),
    ).toBe('colour');
  });

  it('counts a shade code with no hex as painted', () => {
    // The colour was chosen even if this projection did not carry the hex.
    expect(
      stepOfProject(project({ status: 'SEGMENTED', regions: [region({ appliedShadeCode: '8071' })] })),
    ).toBe('colour');
  });

  describe('from a list summary, which carries a count and no regions', () => {
    function summary(over: Partial<ProjectSummary>): ProjectSummary {
      return {
        id: 'p1',
        status: 'SEGMENTED',
        regionCount: 0,
        hasShareLink: false,
        readOnly: false,
        ...over,
      } as ProjectSummary;
    }

    it('reads no surfaces as Walls', () => {
      expect(stepOfProject(summary({ regionCount: 0 }))).toBe('walls');
    });

    it('reads surfaces as Colour, since it cannot tell whether they are painted', () => {
      // The summary has no per-region colours to inspect. Colour is the right
      // guess: the full project loads a moment later and corrects it, and
      // landing one step ahead is recoverable where landing behind is a dead
      // end the customer has to tap out of.
      expect(stepOfProject(summary({ regionCount: 3 }))).toBe('colour');
    });
  });
});

describe('STEP_INDEX', () => {
  it('numbers every step exactly once, in pipeline order', () => {
    const order = Object.values(STEP_INDEX).sort((a, b) => a - b);
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(STEP_TOTAL).toBe(order.length);
  });
});
