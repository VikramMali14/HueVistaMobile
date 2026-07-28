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

describe('project access state', () => {
  it('defaults an open project to writable with no window', () => {
    const p = projectSchema.parse({ id: 'p1', status: 'SEGMENTED' });
    expect(p.readOnly).toBe(false);
    expect(p.reopenPricePaise).toBe(0);
    expect(p.accessExpiresAt).toBeUndefined();
  });

  it('carries the view-only reason and reopen price', () => {
    const p = projectSchema.parse({
      id: 'p1',
      status: 'SEGMENTED',
      readOnly: true,
      readOnlyReason: 'This room’s validity ran out.',
      accessExpiresAt: '2026-07-20T10:00:00',
      reopenPricePaise: 5000,
    });
    expect(p.readOnly).toBe(true);
    expect(p.reopenPricePaise).toBe(5000);
  });

  it('reads a customer room off the summary projection', () => {
    const s = projectSummarySchema.parse({
      id: 'p1',
      status: 'SEGMENTED',
      cleanedImageUrl: '/api/images/files/u1/clean.jpg',
      source: 'CUSTOMER',
      customerName: 'Anita',
      accessCode: '7K2NQ9PX',
      readOnly: true,
    });
    expect(s.source).toBe('CUSTOMER');
    expect(s.cleanedImageUrl).toContain('clean.jpg');
    expect(s.readOnly).toBe(true);
  });
});
