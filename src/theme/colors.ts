/**
 * HueVista's palette, struck from the website.
 *
 * Source of truth: `HueVistaFrontEnd/src/app/globals.css`, dark theme. Every
 * token down to `accentGhost` carries that file's value for the same role, so a
 * colour never means one thing on the site and another on the phone; below that
 * is mobile-only surface treatment with no web counterpart to drift from.
 *
 * ── The colour rule, because this product is about colour ──────────────────
 * The page is ink and paper, the brand mark is brass, and the ONLY saturated
 * colour on any screen is the PAINT. A shade in the catalogue, a wall in the
 * studio, a swatch in a row — those are the subject, and nothing in the
 * furniture around them may shout louder. That is why the accent is a low-chroma
 * metal rather than a vivid hue: put a violet or a cyan in the chrome and every
 * swatch beside it reads wrong.
 *
 * The ground is warm (#100e0c, not a blue-black) for the same reason. A
 * neutral-cold page tints every warm shade laid on it toward green; a warm one
 * sits under both halves of the wheel without arguing with either.
 *
 * ── What this file used to be ─────────────────────────────────────────────
 * "Midnight Spectrum": a blue-black ground under an electric violet accent
 * (#7c5cff), with a violet aurora behind every screen. It carried the same note
 * this one does about mirroring globals.css, and had stopped being true — the
 * site moved to brass on warm charcoal and the phone did not follow. So the app
 * shell was a different product from the website, and worse, it broke the one
 * rule the palette exists to keep: a violet wash over a grid of paint swatches
 * is the chrome shouting louder than the subject, and it is why warm shades read
 * cold in the app and correct on the site.
 *
 * The app ships one theme. The web has a light mode, and the phone deliberately
 * does not: the whole product is a room photograph with paint on it, and a pale
 * chrome throws its own cast over the one thing the user is judging. Dark keeps
 * the wall the brightest object on the screen.
 */
export const colors = {
  bg: '#100e0c', // app background — warm charcoal, never a blue-black
  bgDeep: '#0a0908', // deepest background (behind sheets, gradients)
  surface: '#191612', // cards
  surface2: '#221e19', // sheets, elevated surfaces
  fg: '#ece8e1', // primary text
  fgSoft: '#c4bdb2', // secondary text
  fgMute: '#8e867a', // tertiary text — still legible on every dark surface
  fgFaint: '#6b6459', // decorative only: rules, disabled glyphs. Never a word.
  /**
   * Brass. Fills, rules and marks — and it carries INK, never white
   * (see `accentOn`): a pale metal is a light surface, and treating it as a dark
   * one is what forces the muddy over-darkened cut most gold buttons end up as.
   */
  accent: '#c08b4e',
  /**
   * The accent AS TEXT. Dark has the headroom to lift the metal rather than
   * deepen it — 8.3:1, so it stays legible where it lands on a raised surface
   * rather than on the page. (The web calls this `--accent-text`; the phone had
   * no separate cut, so this name carries it.)
   */
  accentSoft: '#d0a165',
  /** The metal deepened — pressed states, and rules that need more weight. */
  accentDeep: '#9a6a33',
  /** Ink for a label sitting ON brass. 6.2:1 — see the note on `accent`. */
  accentOn: '#17130e',
  warm: '#d9705a', // the warm secondary, as words
  warmFill: '#8a3a2e', // …and as a rectangle under ivory text
  rule: 'rgba(236,232,225,0.08)', // hairline borders
  ruleStrong: 'rgba(236,232,225,0.16)',
  ruleBrass: 'rgba(192,139,78,0.35)',
  success: '#6fae76', // sage as text
  successFill: '#4e7a52', // …and as a rectangle under ivory text
  danger: '#c2402a', // terracotta — errors and destructive FILLS, rules, marks
  dangerSoft: '#d9705a', // the same failure, as words on a dark surface
  /**
   * Attention that is not failure: in progress, expiring, a meter filling up.
   *
   * The web strikes no such hue — brass IS its attention colour — so this is the
   * brass lightened rather than the amber the phone used to carry, which was a
   * fifth hue answering to nothing.
   */
  warning: '#d6a66e',
  // translucent overlays
  scrim: 'rgba(10,9,8,0.72)',
  scrimSoft: 'rgba(10,9,8,0.55)',
  accentGhost: 'rgba(192,139,78,0.14)',

  /* ---- Aurora layer ------------------------------------------------------
   * Depth on top of the flat tokens above. Mobile-only.
   *
   * Struck from the ivory and the charcoal, NOT from a hue: this layer sits
   * behind every screen, including the ones that are nothing but paint swatches,
   * so anything with chroma in it casts on the subject.
   */
  // Glass: cards read as lit panes over the ground rather than solid blocks.
  // Warm, because a cold white wash over a warm ground reads grey-blue.
  glass: 'rgba(236,232,225,0.045)',
  glassStrong: 'rgba(236,232,225,0.075)',
  glassEdge: 'rgba(236,232,225,0.10)', // top-lit hairline
  glassEdgeSoft: 'rgba(236,232,225,0.05)',
  // The warm cast the ambient wash blooms toward at the top of a screen.
  auroraDeep: '#0d0b09',
  auroraMid: '#1a1611',
  auroraLift: '#221c15',
  // Ink for the floating tab bar and other "solid object" chrome.
  ink: '#16130f',
  inkEdge: 'rgba(236,232,225,0.08)',
  /** Panel ground for a sheet that sits over a photograph. */
  panel: 'rgba(16,14,12,0.90)',
  panelSolid: 'rgba(20,18,15,0.97)',

  /* ---- Ink on top of something else --------------------------------------
   * Two near-whites, each with one job, because the app had five: '#fff',
   * '#ffffff', '#f7f5ff', '#eae8e3' and the token `fg`, scattered through the
   * studio with nothing to say which belonged where.
   */
  /** On a filled OXBLOOD or terracotta button — the raw ivory, 7.7:1. Brass
   *  grounds take `accentOn` instead; a pale metal carries ink, not white. */
  onFill: '#f7f6f2',
  /** Over a photograph or a scrim — the page ivory, lifted so it holds against
   *  a lit wall. */
  onPhoto: '#f7f6f2',

  /* ---- Marking a wall ----------------------------------------------------
   * The mask studio draws these on top of a photograph of somebody's room.
   * They are the website's own pair (`mask-studio.tsx`: rgb(29,78,216) to add,
   * rgb(220,38,38) to rub out) so a wall marked on the phone looks like a wall
   * marked on the site — the two tools do the same job on the same photo and a
   * shop that uses both should not have to learn two colour codes.
   *
   * The phone used to draw them in violet and brick, on the reasoning that the
   * blue/red pair "is the exact hue pair red-green colour blindness collapses".
   * That is not right — deuteranopia collapses red against GREEN; blue and red
   * stay apart under all three common types. What the violet did do was carry
   * the old brand hue onto a photograph, which the brass palette has no use for.
   */
  /** The surface being added, as a wash over the photo. */
  mark: '#1d4ed8',
  /** Its outline — lifted well clear of the fill, so a 2px edge still reads
   *  over a sunlit wall where the deep blue would disappear. */
  markEdge: '#7ba4ff',
  /** The surface being rubbed out. */
  erase: '#dc2626',
} as const;

export type ColorToken = keyof typeof colors;

/** Hex (#rgb/#rrggbb) → `rgba(...)` at `alpha`. Falls back to the input. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return hex;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
