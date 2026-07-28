import type { ShadeCodeScheme } from '../api/accountSchemas';

/**
 * A shop's ONE pattern for customer-facing shade codes, mirrored from the
 * website's `src/lib/shade-codes.ts` so both clients encode identically.
 *
 *     customer code = PREFIX + code[0..2] + INFIX + code[2..] + SUFFIX
 *
 * e.g. shade L124 with prefix "AB", infix "XY", suffix "CD" → ABL1XY24CD.
 *
 * Everyone under the shop sees the encoded code — staff, painters, entitled
 * customers and guests alike — because the pattern REPLACES the manufacturer's
 * numbering rather than masking it for outsiders. The counter reads the real
 * shade straight off the customer's screen.
 */

/** How many leading characters of the real code the infix is inserted after. */
export const INFIX_AT = 2;

/** True when at least one part is set — an all-empty scheme means "none". */
export function hasScheme(scheme: ShadeCodeScheme | null | undefined): scheme is ShadeCodeScheme {
  return Boolean(scheme && (scheme.prefix || scheme.infix || scheme.suffix));
}

/**
 * Real shade code → the code this shop shows. Codes shorter than {@link INFIX_AT}
 * keep the infix after whatever is there, so every part always appears and the
 * counter's decode stays unambiguous.
 */
export function encodeShadeCode(scheme: ShadeCodeScheme | null | undefined, code: string): string {
  const clean = code?.trim() ?? '';
  if (!clean || !hasScheme(scheme)) return clean;
  const head = clean.slice(0, INFIX_AT);
  const tail = clean.slice(INFIX_AT);
  return `${scheme.prefix}${head}${scheme.infix}${tail}${scheme.suffix}`;
}

/**
 * How a colour should read under this shop: its code, and its name only when the
 * shop shows names.
 *
 * A shop that hides names is usually running its own codes for exactly that
 * reason, so returning both from one place keeps every swatch, chip and sheet
 * consistent instead of each screen deciding for itself.
 */
export function shadeDisplay(
  scheme: ShadeCodeScheme | null | undefined,
  shade: { code?: string | null; name?: string | null },
): { code: string; name: string | null; label: string } {
  const code = encodeShadeCode(scheme, shade.code ?? '');
  const showNames = scheme?.showNames !== false;
  const name = showNames ? (shade.name?.trim() || null) : null;
  return { code, name, label: name ?? code };
}
