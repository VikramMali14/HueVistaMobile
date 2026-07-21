import { z } from 'zod';

/**
 * AI colour-recommendation schemas, mirrored from `com.gridstore.huevista.ai.dto`
 * (verified against `ColorRecommendationController`). One call returns three
 * palettes, each with primary/accent/trim colours matched to real catalogue
 * shades. Consumes an AI-generation quota (402 when none left).
 */

/** A catalogue shade matched to a recommended colour by CIELAB ΔE. */
export const matchedShadeSchema = z.object({
  id: z.number().nullish(),
  shadeCode: z.string(),
  name: z.string().nullish(),
  hexCode: z.string().nullish(),
  brand: z.string().nullish(),
  shadeFamily: z.string().nullish(),
  aiDescription: z.string().nullish(),
  deltaE: z.number().nullish(),
});
export type MatchedShade = z.infer<typeof matchedShadeSchema>;

/** One recommended palette: a named primary/accent/trim combination. */
export const colorComboSchema = z.object({
  name: z.string().nullish(),
  rationale: z.string().nullish(),
  primaryHex: z.string().nullish(),
  primaryShade: matchedShadeSchema.nullish(),
  accentHex: z.string().nullish(),
  accentShade: matchedShadeSchema.nullish(),
  trimHex: z.string().nullish(),
  trimShade: matchedShadeSchema.nullish(),
});
export type ColorCombo = z.infer<typeof colorComboSchema>;

/** RecommendationResponse — POST /api/projects/{id}/recommendations. */
export const recommendationResponseSchema = z.object({
  projectId: z.string().nullish(),
  imageType: z.string().nullish(),
  combinations: z.array(colorComboSchema).default([]),
});
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
