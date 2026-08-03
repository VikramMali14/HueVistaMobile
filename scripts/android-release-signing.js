#!/usr/bin/env node
/**
 * Teach the freshly prebuilt Android project to sign release builds with a real
 * key instead of the debug one.
 *
 * `expo prebuild` regenerates android/ from scratch every time, and the template
 * it writes signs `release` with `signingConfigs.debug` — fine for a local smoke
 * test, useless for an APK you hand to someone. This patches the generated
 * build.gradle to add a `release` signing config fed by environment variables,
 * so the keystore itself never has to live in the repo.
 *
 * Expects (all read at Gradle time, not here):
 *   HUEVISTA_RELEASE_STORE_FILE      keystore path, relative to android/app
 *   HUEVISTA_RELEASE_STORE_PASSWORD
 *   HUEVISTA_RELEASE_KEY_ALIAS
 *   HUEVISTA_RELEASE_KEY_PASSWORD
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

let gradle = fs.readFileSync(buildGradle, 'utf8');

if (gradle.includes('signingConfigs.release')) {
  console.log('android/app/build.gradle already signs release builds with the release key.');
  process.exit(0);
}

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
console.log('android/app/build.gradle now signs release builds with the release keystore.');
