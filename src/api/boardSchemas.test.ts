import {
  boardShadeSchema,
  colourBoardResultSchema,
  projectComboSchema,
  projectRenderSchema,
} from './boards';
import { aiCreditSummarySchema, myRenderSchema } from './aiCredits';

/**
 * The end of a room — the board, the combinations it recorded and the images
 * made from them — was missing from the app entirely. These pin the wire
 * shapes, because every one of them sits behind a spend: a board download costs
 * an allowance and an image costs a credit.
 */

describe('boardShadeSchema', () => {
  it('parses a surface with its code and colour', () => {
    const s = boardShadeSchema.parse({
      regionId: 4,
      regionLabel: 'Main wall',
      shadeCode: '8071',
      shadeName: 'Powder Blue',
      hvCode: 'HV-1042',
      hex: '#a2bccd',
    });
    expect(s.hex).toBe('#a2bccd');
    expect(s.regionLabel).toBe('Main wall');
  });

  it('needs a colour — a board row with no hex has nothing to print', () => {
    expect(() => boardShadeSchema.parse({ regionLabel: 'Ceiling' })).toThrow();
  });
});

describe('projectComboSchema', () => {
  it('parses a page of a board', () => {
    const c = projectComboSchema.parse({
      id: 'combo1',
      boardIndex: 0,
      pageIndex: 1,
      title: 'Drawing room',
      rendered: true,
      shades: [{ hex: '#a2bccd' }, { hex: '#f2efe6' }],
    });
    expect(c.shades).toHaveLength(2);
    expect(c.rendered).toBe(true);
  });

  it('reads a combination with nothing but an id as an unrendered empty page', () => {
    const c = projectComboSchema.parse({ id: 'combo1' });
    expect(c.rendered).toBe(false);
    expect(c.shades).toEqual([]);
    expect(c.boardIndex).toBe(0);
  });
});

describe('colourBoardResultSchema', () => {
  it('reports the board that closed the room', () => {
    const r = colourBoardResultSchema.parse({
      allowance: { imagesPerPdf: 4, monthlyLimit: 10, used: 10, remaining: 0 },
      boardsUsed: 2,
      boardsAllowed: 2,
      closed: true,
    });
    expect(r.closed).toBe(true);
    expect(r.allowance?.remaining).toBe(0);
  });

  it('defaults `closed` to false — a room stays open unless the server says otherwise', () => {
    // The design asserted that every download closes the project. It does not,
    // and defaulting the other way would tell customers their room was
    // finished when it had a board left.
    expect(colourBoardResultSchema.parse({}).closed).toBe(false);
  });
});

describe('projectRenderSchema', () => {
  it('parses a queued render with no image yet', () => {
    const r = projectRenderSchema.parse({ id: 'r1', comboId: 'c1', status: 'QUEUED' });
    expect(r.status).toBe('QUEUED');
    expect(r.imageUrl).toBeUndefined();
  });

  it('parses a failure with its reason, which is what earns the credit back', () => {
    const r = projectRenderSchema.parse({
      id: 'r1',
      status: 'FAILED',
      failureReason: 'The model timed out.',
    });
    expect(r.failureReason).toBe('The model timed out.');
  });
});

describe('aiCreditSummarySchema', () => {
  it('parses a wallet with a launch discount on it', () => {
    const w = aiCreditSummarySchema.parse({
      balance: 3,
      eligible: true,
      pricePaise: 2900,
      listPricePaise: 4900,
      discountPercent: 41,
      minPurchase: 1,
      maxPurchase: 50,
      renderCost: 1,
      renderTiers: [{ quality: 'PREMIUM', credits: 1 }],
      currency: 'INR',
    });
    expect(w.balance).toBe(3);
    expect(w.discountPercent).toBe(41);
  });

  it('reads an account that cannot hold credits as ineligible, not as an error', () => {
    const w = aiCreditSummarySchema.parse({});
    expect(w.eligible).toBe(false);
    expect(w.balance).toBe(0);
  });
});

describe('myRenderSchema', () => {
  it('keeps an image whose board page was deleted out from under it', () => {
    // The row is ON DELETE SET NULL for exactly this reason: the picture is
    // still the deliverable, only its shade table is gone.
    const r = myRenderSchema.parse({
      id: 'r1',
      projectId: 'p1',
      status: 'READY',
      imageUrl: 'https://example.test/r1.png',
    });
    expect(r.shades).toEqual([]);
    expect(r.imageUrl).toBe('https://example.test/r1.png');
  });
});
