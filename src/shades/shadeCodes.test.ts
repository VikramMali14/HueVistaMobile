import { encodeShadeCode, hasScheme, shadeDisplay } from './shadeCodes';
import type { ShadeCodeScheme } from '../api/accountSchemas';

const scheme = (over: Partial<ShadeCodeScheme> = {}): ShadeCodeScheme => ({
  prefix: '',
  infix: '',
  suffix: '',
  showNames: true,
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
