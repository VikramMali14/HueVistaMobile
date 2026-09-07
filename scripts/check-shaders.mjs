/**
 * Compile every SkSL shader in the app against the real Skia compiler.
 *
 * Why this exists as a script rather than a test: a bad SkSL string is invisible
 * to `tsc`, to eslint and to `expo export` — it is a valid template literal in
 * all three — and the app's canvases compile theirs at MODULE LOAD and throw on
 * failure. So a typo in this one file does not fail the build; it stops the app
 * from starting at all, on a device, after everything else has passed.
 *
 * CanvasKit is the same Skia that react-native-skia runs, so what compiles here
 * compiles there. It is 25 MB of wasm, which is too much to put in every CI run
 * for one file that changes rarely, so it is NOT a dependency. Install it when
 * you need it:
 *
 *     npm i --no-save canvaskit-wasm && node scripts/check-shaders.mjs
 *
 * It also prints each effect's uniform list, which is the other half of the
 * check: the names have to match the `uniforms` object the components pass, and
 * a mismatch there is silently ignored at runtime.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let CanvasKitInit;
try {
  CanvasKitInit = require('canvaskit-wasm');
} catch {
  console.error('canvaskit-wasm is not installed. See the note at the top of this file:');
  console.error('  npm i --no-save canvaskit-wasm && node scripts/check-shaders.mjs');
  process.exit(2);
}

// The shader module is plain JS once `export` is stripped: template literals and
// nothing typed. Evaluate it and read the strings back out, so this script can
// never drift from what the app actually ships.
const source = readFileSync(new URL('../src/engine/recolorShader.ts', import.meta.url), 'utf8');
const shaders = new Function(
  source.replace(/^export /gm, '') +
    '\nreturn { RECOLOR_SKSL, RECOLOR_OVERLAY_SKSL, BRIGHTEN_SKSL };',
)();

const CanvasKit = await CanvasKitInit();
let failed = 0;
for (const [name, sksl] of Object.entries(shaders)) {
  let error = null;
  const effect = CanvasKit.RuntimeEffect.Make(sksl, (e) => {
    error = e;
  });
  if (!effect) {
    failed += 1;
    console.error(`FAIL  ${name}\n${error}`);
    continue;
  }
  const uniforms = [];
  for (let i = 0; i < effect.getUniformCount(); i += 1) uniforms.push(effect.getUniformName(i));
  console.log(`OK    ${name} — uniforms: ${uniforms.join(', ')}`);
}
process.exit(failed ? 1 : 0);
