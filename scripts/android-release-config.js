#!/usr/bin/env node
/**
 * Teach the freshly prebuilt Android project how to produce a release APK worth
 * handing to someone: signed with a real key, and split per CPU architecture.
 *
 * `expo prebuild` regenerates android/ from scratch every time, so neither
 * change can live in the repo — they have to be re-applied after each prebuild.
 * The template signs `release` with `signingConfigs.debug` (fine for a local
 * smoke test, useless for distribution) and packages every ABI into one APK,
 * which lands around 146 MB. Splitting by ABI cuts that to roughly a third per
 * file, and each phone only downloads the one it can run.
 *
 * Signing credentials are read at Gradle time, not here, so the keystore itself
 * never has to live in the repo:
 *   HUEVISTA_RELEASE_STORE_FILE      keystore path, relative to android/app
 *   HUEVISTA_RELEASE_STORE_PASSWORD
 *   HUEVISTA_RELEASE_KEY_ALIAS
 *   HUEVISTA_RELEASE_KEY_PASSWORD
 *
 * Read here, at patch time:
 *   HUEVISTA_RELEASE_ABIS            comma-separated, default arm64-v8a,armeabi-v7a
 *
 * Safe to run twice — the second run notices its own work and exits.
 */

const fs = require('fs');
const path = require('path');

const buildGradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(buildGradle)) {
  console.error(`No ${buildGradle} — run \`npx expo prebuild --platform android\` first.`);
  process.exit(1);
}

/**
 * Give the dex merger room to work.
 *
 * The template ships `org.gradle.jvmargs=-Xmx2048m`, which this app outgrew:
 * `:app:mergeExtDexRelease` died with `OutOfMemoryError: Java heap space` while
 * merging the external dex archives, and took `:app:processReleaseResources`
 * down with it — AAPT2 reported "Link timed out", which reads like a separate
 * bug but is just what a starved runner looks like from inside a daemon waiting
 * on memory it is never going to get.
 *
 * Skia, Reanimated and the Expo modules are all large native/Java dependencies
 * and the merge is the one step that has to hold them at once, so this scales
 * with the dependency list rather than with app code — it will not shrink back.
 * 6 GB is comfortable on GitHub's 16 GB runners and still leaves headroom for
 * the Gradle daemon and the AAPT2 workers beside it.
 *
 * Runs before the build.gradle work below, and before its early exit: the two
 * patches are independent, and a re-run that finds signing already applied must
 * not skip this one.
 */
function ensureGradleHeap() {
  const propsPath = path.join(__dirname, '..', 'android', 'gradle.properties');
  if (!fs.existsSync(propsPath)) {
    console.error(`No ${propsPath} — run \`npx expo prebuild --platform android\` first.`);
    process.exit(1);
  }
  const jvmArgs = '-Xmx6144m -XX:MaxMetaspaceSize=1024m';
  const line = `org.gradle.jvmargs=${jvmArgs}`;
  const props = fs.readFileSync(propsPath, 'utf8');

  if (props.includes(line)) {
    console.log('android/gradle.properties already carries the release heap setting.');
    return;
  }

  // Replace the template's own setting when present (commented or not) so the
  // file never ends up with two values for the same key — Gradle takes the
  // last, which would make this depend on append order.
  const next = /^\s*#?\s*org\.gradle\.jvmargs=.*$/m.test(props)
    ? props.replace(/^\s*#?\s*org\.gradle\.jvmargs=.*$/m, line)
    : `${props.replace(/\s*$/, '')}\n${line}\n`;

  fs.writeFileSync(propsPath, next);
  console.log(`android/gradle.properties: org.gradle.jvmargs set to ${jvmArgs}.`);
}

ensureGradleHeap();

let gradle = fs.readFileSync(buildGradle, 'utf8');

if (gradle.includes('signingConfigs.release')) {
  console.log('android/app/build.gradle already signs release builds with the release key.');
  process.exit(0);
}

// 0. One APK per CPU architecture instead of one fat universal APK.
const abis = (process.env.HUEVISTA_RELEASE_ABIS || 'arm64-v8a,armeabi-v7a')
  .split(',')
  .map((abi) => abi.trim())
  .filter(Boolean);

const splitsBlock = `
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include ${abis.map((abi) => `"${abi}"`).join(', ')}
        }
    }
`;

const androidBlockAt = gradle.search(/^android \{$/m);
if (androidBlockAt === -1) {
  console.error('Could not find the `android {` block in android/app/build.gradle.');
  process.exit(1);
}
const afterAndroidBlock = androidBlockAt + 'android {'.length;
gradle = gradle.slice(0, afterAndroidBlock) + splitsBlock + gradle.slice(afterAndroidBlock);

const releaseSigningConfig = `
        release {
            storeFile file(System.getenv("HUEVISTA_RELEASE_STORE_FILE") ?: "huevista-release.keystore")
            storePassword System.getenv("HUEVISTA_RELEASE_STORE_PASSWORD")
            keyAlias System.getenv("HUEVISTA_RELEASE_KEY_ALIAS")
            keyPassword System.getenv("HUEVISTA_RELEASE_KEY_PASSWORD")
        }`;

// 1. Add the release keystore alongside the template's debug one.
const signingConfigsAt = gradle.indexOf('signingConfigs {');
if (signingConfigsAt === -1) {
  console.error('Could not find a `signingConfigs {` block in android/app/build.gradle.');
  process.exit(1);
}
const afterSigningConfigs = signingConfigsAt + 'signingConfigs {'.length;
gradle = gradle.slice(0, afterSigningConfigs) + releaseSigningConfig + gradle.slice(afterSigningConfigs);

// 2. Point the release build type at it. The debug build type keeps the debug
//    key, so only the occurrence inside `buildTypes { release { ... } }` moves.
const buildTypesAt = gradle.indexOf('buildTypes {');
if (buildTypesAt === -1) {
  console.error('Could not find a `buildTypes {` block in android/app/build.gradle.');
  process.exit(1);
}
const releaseTypeAt = gradle.indexOf('release {', buildTypesAt);
if (releaseTypeAt === -1) {
  console.error('Could not find a `release {` build type in android/app/build.gradle.');
  process.exit(1);
}
const debugSigningAt = gradle.indexOf('signingConfig signingConfigs.debug', releaseTypeAt);
if (debugSigningAt === -1) {
  console.error('The `release` build type does not reference `signingConfigs.debug` as expected.');
  process.exit(1);
}
gradle =
  gradle.slice(0, debugSigningAt) +
  'signingConfig signingConfigs.release' +
  gradle.slice(debugSigningAt + 'signingConfig signingConfigs.debug'.length);

fs.writeFileSync(buildGradle, gradle);
console.log(
  `android/app/build.gradle now signs release builds with the release keystore, one APK per ABI (${abis.join(', ')}).`
);
