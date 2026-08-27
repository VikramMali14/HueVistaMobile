import type { Project, ProjectSummary } from '../api';

/**
 * The room pipeline, named the way the website names it.
 *
 * The vocabulary lives here rather than in `StepRail` so that working out which
 * step a room is on stays a question about data. When it lived next to the
 * component, importing it dragged React and an icon set in behind it — and a
 * pure function that maps a project to a word should be testable without
 * mounting anything.
 */
export const STEPS = [
  { id: 'photo', label: 'Photo' },
  { id: 'prepare', label: 'Prepare' },
  { id: 'walls', label: 'Walls' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'colour', label: 'Colour' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

/** Where each step sits in the pipeline, for "step 3 of 5". */
export const STEP_INDEX: Record<StepId, number> = {
  photo: 0,
  prepare: 1,
  walls: 2,
  adjust: 3,
  colour: 4,
};

export const STEP_TOTAL = 5;

/**
 * Which step a room is on, derived from what the server holds rather than from
 * a counter the app keeps.
 *
 * This matters more than it looks. The design drew the pipeline as five screens
 * a customer walks through once, which is true the first time and wrong every
 * time after: rooms are left half-finished and picked up days later on a
 * different phone, and the only thing that knows how far they got is the
 * project itself. Reading the step from `status` and `regions` means resuming a
 * room lands exactly where it was left, and a room whose detection failed
 * overnight opens on the step that can fix it.
 *
 *   CREATED    → the photo is up, nothing has been detected: Prepare
 *   SEGMENTING → detection is running: Walls
 *   FAILED     → detection came back empty-handed: Walls, which is where the
 *                retry and the mark-by-hand route both live
 *   SEGMENTED  → walls exist. Colour once any of them is painted, Adjust until
 *                then — a room with four bare walls wants checking before it
 *                wants a palette.
 */
export function stepOfProject(project: Project | ProjectSummary): StepId {
  const status = project.status;
  if (status === 'SEGMENTING') return 'walls';
  if (status === 'FAILED') return 'walls';
  if (status !== 'SEGMENTED') return 'prepare';

  // ProjectSummary carries a count; the full Project carries the regions.
  const regions = 'regions' in project ? project.regions : null;
  const count = regions ? regions.length : ((project as ProjectSummary).regionCount ?? 0);
  if (count === 0) return 'walls';
  if (regions && regions.some((r) => r.appliedHexCode || r.appliedShadeCode)) return 'colour';
  if (!regions) return 'colour';
  return 'adjust';
}
