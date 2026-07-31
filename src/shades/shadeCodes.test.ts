import {
  decodeShadeCode,
  decodeShadeCodeAnyScheme,
  encodeShadeCode,
  hasScheme,
  searchTermFor,
  shadeDisplay,
} from './shadeCodes';
import type { ShadeCodeScheme } from '../api/accountSchemas';

const scheme = (over: Partial<ShadeCodeScheme> = {}): ShadeCodeScheme => ({
  prefix: '',
  infix: '',
  suffix: '',
  showNames: true,
  retired: [],
  ...over,
});

describe('hasScheme', () => {
  it('is false for null, undefined and an all-empty scheme', () => {
    expect(hasScheme(null)).toBe(false);
    expect(hasScheme(undefined)).toBe(false);
    expect(hasScheme(scheme())).toBe(false);
  });

  it('is true when any single part is set', () => {
    expect(hasScheme(scheme({ prefix: 'AB' }))).toBe(true);
    expect(hasScheme(scheme({ infix: 'XY' }))).toBe(true);
    expect(hasScheme(scheme({ suffix: 'CD' }))).toBe(true);
  });
});

describe('encodeShadeCode', () => {
  it('splices all three parts around the real code', () => {
    expect(encodeShadeCode(scheme({ prefix: 'AB', infix: 'XY', suffix: 'CD' }), 'L124')).toBe('ABL1XY24CD');
  });

  it('returns the code untouched when the shop has no scheme', () => {
    expect(encodeShadeCode(scheme(), 'L124')).toBe('L124');
    expect(encodeShadeCode(null, 'L124')).toBe('L124');
  });

  it('still emits every part for codes shorter than the infix position', () => {
    expect(encodeShadeCode(scheme({ prefix: 'A', infix: 'XY', suffix: 'Z' }), 'L')).toBe('ALXYZ');
  });

  it('trims and tolerates an empty code', () => {
    expect(encodeShadeCode(scheme({ prefix: 'AB' }), '  L124 ')).toBe('ABL124');
    expect(encodeShadeCode(scheme({ prefix: 'AB' }), '')).toBe('');
  });
});

describe('shadeDisplay', () => {
  it('shows the encoded code and the name by default', () => {
    const d = shadeDisplay(scheme({ prefix: 'AB' }), { code: 'L124', name: 'Ivory Mist' });
    expect(d).toEqual({ code: 'ABL124', name: 'Ivory Mist', label: 'Ivory Mist' });
  });

  it('drops the name — and falls back to the code — when the shop hides names', () => {
    const d = shadeDisplay(scheme({ prefix: 'AB', showNames: false }), { code: 'L124', name: 'Ivory Mist' });
    expect(d).toEqual({ code: 'ABL124', name: null, label: 'ABL124' });
  });

  it('treats a blank name as no name', () => {
    expect(shadeDisplay(scheme(), { code: 'L124', name: '  ' }).label).toBe('L124');
  });

  it('works with no scheme at all', () => {
    expect(shadeDisplay(null, { code: 'L124', name: 'Ivory Mist' })).toEqual({
      code: 'L124',
      name: 'Ivory Mist',
      label: 'Ivory Mist',
    });
  });
});

describe('decodeShadeCode', () => {
  it('reverses an encode', () => {
    const s = scheme({ prefix: 'AB', infix: 'XY', suffix: 'CD' });
    expect(decodeShadeCode(s, encodeShadeCode(s, 'L124'))).toBe('L124');
  });

  it('is case-insensitive and returns the real code uppercased', () => {
    expect(decodeShadeCode(scheme({ prefix: 'AB', infix: 'XY', suffix: 'CD' }), 'abl1xy24cd')).toBe('L124');
  });

  it('refuses input that does not follow the pattern', () => {
    const s = scheme({ prefix: 'AB', infix: 'XY', suffix: 'CD' });
    expect(decodeShadeCode(s, 'ZZL1XY24CD')).toBeNull(); // wrong prefix
    expect(decodeShadeCode(s, 'ABL12424CD')).toBeNull(); // no infix where one is due
    expect(decodeShadeCode(s, '')).toBeNull();
  });

  it('is null when the shop has no pattern — there is nothing to decode', () => {
    expect(decodeShadeCode(scheme(), 'L124')).toBeNull();
    expect(decodeShadeCode(null, 'L124')).toBeNull();
  });

  it('round-trips a code shorter than the infix position', () => {
    const s = scheme({ prefix: 'A', infix: 'XY', suffix: 'Z' });
    expect(decodeShadeCode(s, encodeShadeCode(s, 'L'))).toBe('L');
  });
});

describe('decodeShadeCodeAnyScheme', () => {
  const withHistory = scheme({
    prefix: 'AB',
    infix: 'XY',
    suffix: 'CD',
    retired: [
      { prefix: 'ZZ', infix: '', suffix: '', retiredAt: '2026-06-01T00:00:00' },
      { prefix: 'QQ', infix: '', suffix: '', retiredAt: '2025-01-01T00:00:00' },
    ],
  });

  it('reads a current code and reports no retired pattern', () => {
    expect(decodeShadeCodeAnyScheme(withHistory, 'ABL1XY24CD')).toEqual({ code: 'L124', via: null });
  });

  it('still reads a code printed under a pattern the shop has dropped', () => {
    const found = decodeShadeCodeAnyScheme(withHistory, 'ZZL124');
    expect(found?.code).toBe('L124');
    expect(found?.via?.prefix).toBe('ZZ');
  });

  it('prefers the newest retired pattern when two could both read the code', () => {
    // Both patterns are bare prefixes, so "QQL124" is readable by the older one
    // only — but a code the newer one can also read must resolve to the newer.
    const ambiguous = scheme({
      prefix: 'AB',
      retired: [
        { prefix: 'Z', infix: '', suffix: '', retiredAt: '2026-06-01T00:00:00' },
        { prefix: '', infix: '', suffix: '', retiredAt: '2025-01-01T00:00:00' },
      ],
    });
    expect(decodeShadeCodeAnyScheme(ambiguous, 'ZL124')?.code).toBe('L124');
  });

  it('is null when no pattern, live or retired, can read it', () => {
    expect(decodeShadeCodeAnyScheme(withHistory, 'WWL124')).toBeNull();
    expect(decodeShadeCodeAnyScheme(scheme(), 'L124')).toBeNull();
    expect(decodeShadeCodeAnyScheme(null, 'L124')).toBeNull();
  });
});

describe('searchTermFor', () => {
  it('sends the real code when the customer types the one they can see', () => {
    const s = scheme({ prefix: 'AB', infix: 'XY', suffix: 'CD' });
    expect(searchTermFor(s, 'ABL1XY24CD')).toBe('L124');
  });

  it('finds a colour from a code printed under an older pattern', () => {
    const s = scheme({
      prefix: 'AB',
      retired: [{ prefix: 'ZZ', infix: '', suffix: '', retiredAt: '2026-06-01T00:00:00' }],
    });
    expect(searchTermFor(s, 'ZZL124')).toBe('L124');
  });

  it('passes a name or a fragment through untouched', () => {
    const s = scheme({ prefix: 'AB', infix: 'XY', suffix: 'CD' });
    expect(searchTermFor(s, 'ivory')).toBe('ivory');
    expect(searchTermFor(scheme(), 'L124')).toBe('L124');
  });
});
