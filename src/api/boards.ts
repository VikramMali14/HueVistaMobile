import { z } from 'zod';
import { apiFetch } from './client';

/**
 * The end of a room: the colour board a customer takes away, the combinations
 * that board committed to, and the AI images made from them.
 *
 * These three were missing from the app entirely — the phone could paint a wall
 * and then had nowhere to put the result, so a room never finished. They mirror
 * `ProjectController`'s `/colour-boards`, `/close`, `/combos` and `/renders`.
 */

/** One surface on one page of a board. */
export const boardShadeSchema = z.object({
  regionId: z.number().nullish(),
  regionLabel: z.string().nullish(),
  shadeCode: z.string().nullish(),
  shadeName: z.string().nullish(),
  hvCode: z.string().nullish(),
  hex: z.string(),
});
export type BoardShade = z.infer<typeof boardShadeSchema>;

/**
 * One combination the customer left with — a page of a board they downloaded.
 * `rendered` says an AI image has already been made from it, which is what stops
 * the same credit being spent twice on the same scheme.
 */
export const projectComboSchema = z.object({
  id: z.string(),
  boardIndex: z.number().default(0),
  pageIndex: z.number().default(0),
  title: z.string().nullish(),
  rendered: z.boolean().default(false),
  shades: z.array(boardShadeSchema).default([]),
});
export type ProjectCombo = z.infer<typeof projectComboSchema>;

/** What recording a board costs and leaves behind. */
export const colourBoardResultSchema = z.object({
  allowance: z
    .object({
      imagesPerPdf: z.number().default(0),
      monthlyLimit: z.number().default(0),
      used: z.number().default(0),
      remaining: z.number().default(0),
    })
    .nullish(),
  boardsUsed: z.number().default(0),
  boardsAllowed: z.number().default(0),
  /** True when this was the project's last board: the room is now view-only. */
  closed: z.boolean().default(false),
});
export type ColourBoardResult = z.infer<typeof colourBoardResultSchema>;

/** One page to record. At least one shade; at most sixteen. */
export interface BoardPageInput {
  title?: string;
  shades: {
    regionId?: number | null;
    regionLabel?: string | null;
    shadeCode?: string | null;
    shadeName?: string | null;
    /** #rrggbb — the backend rejects any other spelling. */
    hex: string;
  }[];
}

/* ── AI renders ─────────────────────────────────────────────────────────── */

export const RENDER_STATUSES = ['QUEUED', 'RUNNING', 'READY', 'FAILED'] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number] | (string & {});

export const projectRenderSchema = z.object({
  id: z.string(),
  comboId: z.string().nullish(),
  status: z.string(),
  imageUrl: z.string().nullish(),
  failureReason: z.string().nullish(),
  timeOfDay: z.string().nullish(),
  borderMode: z.string().nullish(),
  lighting: z.string().nullish(),
  furnishing: z.string().nullish(),
  style: z.string().nullish(),
  quality: z.string().nullish(),
  sourceImage: z.string().nullish(),
  note: z.string().nullish(),
  createdAt: z.string().nullish(),
  completedAt: z.string().nullish(),
});
export type ProjectRender = z.infer<typeof projectRenderSchema>;

export type TimeOfDay = 'DAY' | 'NIGHT';
export type BorderMode = 'KEEP_ORIGINAL' | 'AI_SUGGESTED';
export type Lighting = 'NATURAL' | 'WARM' | 'COOL' | 'DRAMATIC';
export type Furnishing = 'KEEP' | 'STAGED' | 'EMPTY';
export type RenderStyle = 'MODERN' | 'MINIMAL' | 'TRADITIONAL' | 'HERITAGE' | 'LUXE';
export type RenderQuality = 'STANDARD' | 'PREMIUM';
export type SourceImage = 'CLEANED' | 'ORIGINAL';

export interface CreateRenderInput {
  comboId: string;
  timeOfDay: TimeOfDay;
  borderMode: BorderMode;
  lighting: Lighting;
  furnishing: Furnishing;
  style: RenderStyle;
  quality?: RenderQuality;
  sourceImage?: SourceImage;
  note?: string;
}

export const boardsApi = {
  /**
   * Record the board the customer just took away, and charge for it.
   *
   * The sheet itself is built on the device; this is the only moment the
   * combinations that went onto it can be captured, and everything after —
   * the combos list, an AI image of one of them — is built on what is recorded
   * here. 402 when the plan has no downloads left, 409 when the project is
   * closed or has spent every board.
   */
  record(projectId: string, pages: BoardPageInput[]): Promise<ColourBoardResult> {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}/colour-boards`, {
      method: 'POST',
      json: { pages },
    }).then((d) => colourBoardResultSchema.parse(d));
  },

  /** "This is the one" — finish the room before it has spent both boards. */
  close(projectId: string): Promise<void> {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}/close`, { method: 'POST' }).then(
      () => undefined,
    );
  },

  /** Every combination this project handed over, in the order the customer saw them. */
  combos(projectId: string): Promise<ProjectCombo[]> {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}/combos`).then((d) =>
      z.array(projectComboSchema).parse(d),
    );
  },

  /**
   * Ask for a photorealistic image of one combination. Answers 202 with a
   * QUEUED render — poll `render()` until READY or FAILED. Credits are spent on
   * acceptance and handed back on failure, so a failed image costs nothing.
   */
  requestRender(projectId: string, input: CreateRenderInput): Promise<ProjectRender> {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}/renders`, {
      method: 'POST',
      json: input,
    }).then((d) => projectRenderSchema.parse(d));
  },

  /** This project's AI images, newest first. */
  renders(projectId: string): Promise<ProjectRender[]> {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}/renders`).then((d) =>
      z.array(projectRenderSchema).parse(d),
    );
  },

  /** Poll one render. The image URL appears when the status reaches READY. */
  render(projectId: string, renderId: string): Promise<ProjectRender> {
    return apiFetch(
      `/projects/${encodeURIComponent(projectId)}/renders/${encodeURIComponent(renderId)}`,
    ).then((d) => projectRenderSchema.parse(d));
  },
};
