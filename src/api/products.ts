import { z } from 'zod';
import { apiFetch } from './client';
import { shopProductSchema, ShopProduct } from './accountSchemas';
import {
  paintBrandSchema,
  paintLineSchema,
  PaintBrand,
  PaintLine,
  ProductCategory,
  QualityTier,
} from './catalogueSchemas';

/**
 * The shop's paint products, and the shared catalogue they are built on.
 *
 * Two controllers, one journey: `PaintCatalogueController` holds the brands and
 * lines every shop picks from, and `ShopProductController` holds what this shop
 * actually stocks against a chosen line — its price, pack, coverage and photo.
 *
 * The catalogue half is writable on purpose. A shop that stocks a line nobody has
 * entered yet would otherwise be stuck, so adding a brand or a line is part of
 * the same flow rather than something to ask an admin for. Both are deduped by
 * name server-side, which is what keeps that safe to expose.
 */

/** What a listing needs. `lineId` is the only required field. */
export interface ShopProductInput {
  lineId: number;
  price?: number;
  priceUnit?: string;
  packSize?: string;
  coverage?: string;
  finish?: string;
  qualityTier?: QualityTier;
  /** 1–10. Defaults to the tier's own score when left out. */
  brightness?: number;
  imageUrl?: string;
  features?: string;
  description?: string;
}

export const catalogueApi = {
  /** Every paint company on the platform. */
  brands(): Promise<PaintBrand[]> {
    return apiFetch('/paint/brands').then((d) => z.array(paintBrandSchema).parse(d));
  },

  /** Add a company. Deduped by name, so a repeat returns the existing one. */
  addBrand(name: string): Promise<PaintBrand> {
    return apiFetch('/paint/brands', { method: 'POST', json: { name: name.trim() } }).then((d) =>
      paintBrandSchema.parse(d),
    );
  },

  /** A company's lines, for one side of the wall. */
  lines(brandId: number, category: ProductCategory): Promise<PaintLine[]> {
    return apiFetch(`/paint/brands/${brandId}/lines?category=${category}`).then((d) =>
      z.array(paintLineSchema).parse(d),
    );
  },

  /** Add a line to a company. Deduped by name within the brand + category. */
  addLine(
    brandId: number,
    body: { name: string; category: ProductCategory; qualityTier?: QualityTier; defaultFinish?: string },
  ): Promise<PaintLine> {
    return apiFetch(`/paint/brands/${brandId}/lines`, {
      method: 'POST',
      json: { ...body, name: body.name.trim() },
    }).then((d) => paintLineSchema.parse(d));
  },
};

export const productsApi = {
  /** Everything this shop lists. */
  list(orgId: string): Promise<ShopProduct[]> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/products`).then((d) =>
      z.array(shopProductSchema).parse(d),
    );
  },

  /** List a product against a catalogue line. */
  create(orgId: string, input: ShopProductInput): Promise<ShopProduct> {
    return apiFetch(`/organizations/${encodeURIComponent(orgId)}/products`, {
      method: 'POST',
      json: input,
    }).then((d) => shopProductSchema.parse(d));
  },

  /** Replace a listing's details. The line it points at can change too. */
  update(orgId: string, productId: string, input: ShopProductInput): Promise<ShopProduct> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/products/${encodeURIComponent(productId)}`,
      { method: 'PUT', json: input },
    ).then((d) => shopProductSchema.parse(d));
  },

  /** Take a listing off the shop's shelf. */
  remove(orgId: string, productId: string): Promise<void> {
    return apiFetch(
      `/organizations/${encodeURIComponent(orgId)}/products/${encodeURIComponent(productId)}`,
      { method: 'DELETE' },
    ).then(() => undefined);
  },
};
