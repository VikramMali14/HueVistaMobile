import type { RetiredShadeCodeScheme, ShadeCodeScheme } from '../api/accountSchemas';

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
 * The shop's code → the real shade code, or null when the input doesn't follow
 * the pattern (wrong prefix/suffix, or too short to contain the inserted pair).
 *
 * The customer only ever sees the encoded code, so it is the only thing they can
 * type. Search decodes first, otherwise the one code on screen is the one code
 * that finds nothing.
 */
export function decodeShadeCode(
  scheme: ShadeCodeScheme | null | undefined,
  customerCode: string,
): string | null {
  if (!hasScheme(scheme)) return null;
  let value = customerCode.trim().toUpperCase();
  if (!value) return null;

  const prefix = scheme.prefix.toUpperCase();
  const suffix = scheme.suffix.toUpperCase();
  const infix = scheme.infix.toUpperCase();

  if (prefix) {
    if (!value.startsWith(prefix)) return null;
    value = value.slice(prefix.length);
  }
  if (suffix) {
    if (!value.endsWith(suffix)) return null;
    value = value.slice(0, value.length - suffix.length);
  }
  if (infix) {
    const at = Math.min(INFIX_AT, Math.max(0, value.length - infix.length));
    if (value.slice(at, at + infix.length) !== infix) return null;
    value = value.slice(0, at) + value.slice(at + infix.length);
  }
  return value || null;
}

/** What a decode attempt found: the real code, and which pattern read it. */
export interface DecodeResult {
  code: string;
  /** null when the CURRENT pattern read it; otherwise the retired one that did. */
  via: RetiredShadeCodeScheme | null;
}

/**
 * Decode against the live pattern first, then every pattern the shop has retired.
 *
 * A shop's numbering does not live only on this screen — it is printed on colour
 * boards, quoted on estimates and photographed off the counter. Decoding with the
 * current pattern alone made every code already in circulation unreadable the day
 * the shop changed it, so a customer walking in with last season's card was told
 * their code was invalid by the shop that printed it.
 *
 * Current first, then newest-retired first (the order the backend sends), so a
 * code two patterns could both read resolves to the most recent shop meaning.
 */
export function decodeShadeCodeAnyScheme(
  scheme: ShadeCodeScheme | null | undefined,
  customerCode: string,
): DecodeResult | null {
  const live = decodeShadeCode(scheme, customerCode);
  if (live) return { code: live, via: null };
  for (const past of scheme?.retired ?? []) {
    // showNames rides along only to satisfy the type; decoding never reads it.
    const code = decodeShadeCode({ ...past, showNames: true, retired: [] }, customerCode);
    if (code) return { code, via: past };
  }
  return null;
}

/**
 * What to send to the catalogue's `search` when the user typed `input`.
 *
 * A shop code decodes back to the real one the backend indexes; anything else
 * (a name, a fragment, a raw code) goes through untouched. Retired patterns are
 * tried too, so searching an old code finds the colour instead of nothing.
 */
export function searchTermFor(
  scheme: ShadeCodeScheme | null | undefined,
  input: string,
): string {
  return decodeShadeCodeAnyScheme(scheme, input)?.code ?? input;
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
