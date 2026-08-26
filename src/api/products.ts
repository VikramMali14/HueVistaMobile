import { z } from 'zod';
import { apiFetch } from './client';
import { paintBrandSchema, PaintBrand } from './catalogueSchemas';

/**
 * The shared paint catalogue, read-only.
 *
 * The shop-side half of this module — listing a product, pricing a pack,
 * adding a line — left with the counter screens. What a customer needs is the
 * list of companies, so the catalogue's brand filter names real ones instead of
 * a hard-coded string.
 */
export const catalogueApi = {
  /** Every paint company on the platform. */
  brands(): Promise<PaintBrand[]> {
    return apiFetch('/paint/brands').then((d) => z.array(paintBrandSchema).parse(d));
  },
};
