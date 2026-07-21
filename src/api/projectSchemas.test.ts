import { imageResponseSchema, projectSchema, projectSummarySchema, regionSchema } from './projectSchemas';

describe('imageResponseSchema', () => {
  it('parses an upload response', () => {
    const r = imageResponseSchema.parse({
      imageId: 'img_1',
      imageUrl: '/api/images/files/u1/abc.jpg',
      imageType: 'INDOOR',
      fileSize: 12345,
      uploadedAt: '2026-07-21T10:00:00',
    });
    expect(r.imageId).toBe('img_1');
    expect(r.imageType).toBe('INDOOR');
  });

  it('requires an imageId', () => {
    expect(() => imageResponseSchema.parse({ imageUrl: '/x' })).toThrow();
  });
});

describe('regionSchema', () => {
  it('defaults manual to false', () => {
    const region = regionSchema.parse({ id: 5, label: 'Main wall' });
    expect(region.manual).toBe(false);
    expect(region.appliedHexCode).toBeUndefined();
  });
});

describe('projectSchema', () => {
  it('parses a segmented project with regions', () => {
    const p = projectSchema.parse({
      id: 'proj_1',
      name: 'Living room',
      status: 'SEGMENTED',
      imageUrl: '/api/images/files/u1/abc.jpg',
      regions: [
        { id: 1, label: 'Main wall', maskUrl: '/m1.png', appliedHexCode: '#7c5cff', manual: false },
        { id: 2, label: 'Ceiling', manual: true },
      ],
    });
    expect(p.status).toBe('SEGMENTED');
    expect(p.regions).toHaveLength(2);
    expect(p.regions[0].appliedHexCode).toBe('#7c5cff');
  });

  it('defaults regions to an empty array for a fresh project', () => {
    const p = projectSchema.parse({ id: 'proj_2', status: 'CREATED' });
    expect(p.regions).toEqual([]);
    expect(p.hasShareLink).toBe(false);
  });
});

describe('projectSummarySchema', () => {
  it('defaults regionCount', () => {
    const s = projectSummarySchema.parse({ id: 'p', status: 'CREATED' });
    expect(s.regionCount).toBe(0);
  });
});
