import { apiFetch } from './client';
import { recommendationResponseSchema, RecommendationResponse } from './recommendationSchemas';

export const recommendationsApi = {
  /**
   * Ask Claude Vision for three paint palettes matched to the project photo.
   * Consumes one AI generation; throws ApiError 402 when the plan has none left.
   */
  get(projectId: string): Promise<RecommendationResponse> {
    return apiFetch(`/projects/${encodeURIComponent(projectId)}/recommendations`, { method: 'POST' }).then((d) =>
      recommendationResponseSchema.parse(d),
    );
  },
};
