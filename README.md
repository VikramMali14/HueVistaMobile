# HueVista Mobile

The Android + iOS app for [HueVista](https://github.com/VikramMali14/HueVista) —
an AI-powered paint shade visualizer for the Indian paint retail trade.

One app, role-based experiences: **Customer · Retailer · Painter · Distributor**.
Built with React Native + Expo (TypeScript, Expo Router) against the existing
HueVista Spring Boot backend.

## Status

**Phase 0 complete — foundations.** The app scaffolding, design system, API
client and auth session are in place and the app runs. The customer product
(camera → visualizer → shades → share) is Phase 1. See [`PLAN.md`](PLAN.md) for
the full phase plan and live progress.

## Run it

> **Expo Go will not work.** This app depends on `@shopify/react-native-skia`
> (the recolor engine), a native module Expo Go doesn't ship. You need a
> **development build** — a small custom app that includes the native modules —
> which you then load JS into. It's a one-time build; after that you just run the
> dev server.

### Prerequisites

- **Node 20+** (`node -v`)
- **JDK 17** (JDK 21 also works — **not** 24/25/26). The Android build uses your
  `JAVA_HOME` JDK; a too-new JDK fails with `jlink.exe` / `JdkImageTransform`
  errors — see [Troubleshooting](#troubleshooting). The simplest reliable option
  is the JDK **bundled with Android Studio** (`C:\Program Files\Android\Android
  Studio\jbr` on Windows) — point `JAVA_HOME` at it.
- **Android:** [Android Studio](https://developer.android.com/studio) (for the SDK
  + an emulator) **or** a physical Android phone with USB debugging on.
  - **Point the build at your SDK.** Set an `ANDROID_HOME` environment variable to
    your SDK location (find it in Android Studio → **Settings → Languages &
    Frameworks → Android SDK**; the default is `%LOCALAPPDATA%\Android\Sdk` on
    Windows, `~/Library/Android/sdk` on macOS, `~/Android/Sdk` on Linux). Without
    this the Android build fails with **"SDK location not found"** — see
    [Troubleshooting](#troubleshooting).
- **iOS (optional):** a **Mac with Xcode**.
- A running **HueVista backend** (see its repo's `docker-compose`) or a deployed URL.

### 1. Install

```bash
npm install
```

### 2. Point it at a backend

```bash
cp .env.example .env
# edit .env:
EXPO_PUBLIC_API_ORIGIN=http://localhost:8080
```

> On a **physical device**, `localhost` is the phone, not your computer — use your
> machine's LAN IP, e.g. `http://192.168.1.20:8080`. Swagger is at `<origin>/swagger-ui.html`.

Optionally set `EXPO_PUBLIC_WEB_ORIGIN` to the website's origin. Payments (buying
a project, reopening a lapsed one) run through Razorpay Checkout on the web and
the app carries no payment SDK, so it links out. Left blank, the app still names
the price — it just doesn't offer to open the site.

### 3. Build & run (development build)

```bash
# Android — emulator running, or phone plugged in:
npx expo run:android

# iOS — Mac + Xcode only:
npx expo run:ios
```

The first run compiles the native app (a few minutes) and installs it. **After
that**, just start the dev server and open the installed dev build:

```bash
npx expo start --dev-client
```

### No device handy? These run anywhere

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Expo config) |
| `npm test` | Jest unit tests |

## Release APK (Android)

You don't need an Android SDK on your machine for this — GitHub Actions builds it.

**Actions → _Android release APK_ → Run workflow.** Pick the branch, leave
`api_origin` at `https://api.huevista.org` (or point it somewhere else for a test
build), and run it. When it finishes, the APK is on the run page under
**Artifacts → `huevista-android-apk`**. Fill in `release_tag` instead — say
`v0.1.0` — and it also publishes a GitHub Release with the APK attached.

The backend origin is **baked into the APK** at build time, so a build made
against a staging backend will keep talking to staging. Rebuild to repoint it.

### Signing key

With no key configured, the workflow mints a throwaway one per run. Those APKs
install fine, but each is signed by a different key, so Android refuses to
*upgrade* one with the next — you'd have to uninstall first. Before you hand the
app to anyone, create one key and keep it:

```bash
keytool -genkeypair -v -keystore huevista-release.keystore -storetype PKCS12 \
  -alias huevista -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 huevista-release.keystore   # macOS: base64 -i huevista-release.keystore
```

Then add these under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the base64 blob printed above |
| `ANDROID_KEYSTORE_PASSWORD` | the store password you chose |
| `ANDROID_KEY_ALIAS` | `huevista` |
| `ANDROID_KEY_PASSWORD` | the key password (same as the store password unless you set another) |

Back up that keystore file somewhere safe and private. Lose it and you cannot
ship an update to anyone who installed the app — a new key means a new install.
Never commit it; `.gitignore` already excludes `*.jks` and `*.p12`.

## iOS build

**Actions → _iOS release build_ → Run workflow.** Same inputs, macOS runner,
artifact `huevista-ios-ipa` on the run page.

The .ipa it produces is **unsigned**, because signing an iOS app for a real
device needs an Apple Developer account — a certificate and a provisioning
profile listing the devices allowed to run it. There is no way around that; it
is Apple's rule, not a gap in this workflow. Your options, cheapest first:

- **Sideload it.** [Sideloadly](https://sideloadly.io) or AltStore re-signs the
  .ipa with your own free Apple ID. Works on your own device, expires after 7
  days, then you re-sign. Fine for showing the app to yourself.
- **Xcode, plugged in.** `npx expo prebuild -p ios && npx expo run:ios --device`
  on a Mac signs with your free Apple ID automatically. Same 7-day expiry.
- **Apple Developer Program** ($99/yr). Unlocks a year-long ad-hoc build for up
  to 100 registered devices, and TestFlight for up to 10,000 testers. With an
  account, [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build -p
  ios`) handles certificates, profiles and TestFlight upload for you — worth it
  over hand-rolling the signing steps into this workflow.

Android has no equivalent restriction, which is why that APK installs directly.

## Troubleshooting

### `SDK location not found` on `npx expo run:android`

```
> SDK location not found. Define a valid SDK location with an ANDROID_HOME
  environment variable or by setting the sdk.dir path in your project's
  local.properties file at '.../android/local.properties'.
```

`expo run:android` generates the native `android/` folder (it's gitignored), then
hands off to Gradle — and Gradle can't find your Android SDK. Fix it with **one** of:

- **Set `ANDROID_HOME`** (recommended — survives a clean `expo prebuild`). Find your
  SDK path in Android Studio → **Settings → Languages & Frameworks → Android SDK**,
  then set the variable and **restart your terminal / Android Studio** so it's picked up:

  - **Windows (PowerShell), permanent:**
    ```powershell
    [System.Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
    ```
  - **macOS / Linux** (add to `~/.zshrc` or `~/.bashrc`):
    ```bash
    export ANDROID_HOME="$HOME/Library/Android/sdk"   # macOS
    export ANDROID_HOME="$HOME/Android/Sdk"           # Linux
    ```

- **Or create `android/local.properties`** (quick, but the `android/` folder is
  regenerated, so you may have to redo it). Use forward slashes to avoid escaping:
  ```properties
  sdk.dir=C:/Users/YOUR_NAME/AppData/Local/Android/Sdk
  ```

If the SDK isn't installed at all, install it from that same Android Studio screen
(SDK Platform + SDK Build-Tools + Android SDK Platform-Tools).

### `jlink.exe` / `JdkImageTransform` failure, or "A restricted method in java.lang.System has been called"

```
> Execution failed for JdkImageTransform: .../android-36/core-for-system-modules.jar.
   > Error while executing process .../jdk-26.0.1/bin/jlink.exe ...
```

Your `JAVA_HOME` points at a **too-new JDK** (24, 25, 26…). The Android Gradle
Plugin's JDK-image transform and native (CMake) tasks don't support those yet. Use
**JDK 17** (21 also works). Easiest: point `JAVA_HOME` at the JDK bundled with
Android Studio, then clean and rebuild.

- **Windows (PowerShell), permanent:**
  ```powershell
  # confirm the bundled JDK is 17 or 21 first
  & "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" -version
  [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')
  ```
- **macOS / Linux** (add to `~/.zshrc` or `~/.bashrc`), or install
  [Temurin 17](https://adoptium.net/temurin/releases/?version=17):
  ```bash
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"   # macOS
  ```

Setting `JAVA_HOME` persistently is not enough on its own — a **stale Gradle daemon**
keeps running on the old JDK and gets reused, and a persisted variable only reaches a
brand-new process. So force it for the current shell, stop the daemon, and **verify the
JVM before the long build** (`gradlew clean` is not a valid check — `clean` doesn't run
the JDK-image transform, so it passes even on the wrong JDK):

```powershell
# Windows PowerShell — set JAVA_HOME for THIS shell immediately (no restart needed)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat --stop        # kill daemons still on the old JDK
.\gradlew.bat -version      # the "JVM:" line MUST read 17 or 21, not 24/25/26
cd ..
npx expo run:android
```

```bash
# macOS / Linux equivalent
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"   # macOS
cd android && ./gradlew --stop && ./gradlew -version && cd ..
npx expo run:android
```

### `ninja: error: ... Filename longer than 260 characters` (Windows only)

```
> Task :app:buildCMakeDebug[x86_64] FAILED
  ninja: error: Stat(...RNGestureHandlerDetectorShadowNode.cpp.o): Filename longer than 260 characters
```

The native C++ codegen (e.g. `react-native-gesture-handler`) produces object-file
paths ~390 characters long — CMake nests an *encoded copy of the full source path*
under an already-deep build directory. That blows past Windows' legacy 260-char
`MAX_PATH` limit, so `ninja` refuses. **Moving the project to a shorter folder does
not fix this** — the doubled path stays over 260 even at the drive root. Turn off the
limit instead:

1. In an **Administrator** PowerShell:
   ```powershell
   Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -Type DWord
   git config --system core.longpaths true
   ```
2. **Reboot** so every tool picks up the setting (it's read at process start).
3. Rebuild (re-assert `JAVA_HOME`, stop the daemon, run):
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   cd android; .\gradlew.bat --stop; cd ..
   npx expo run:android
   ```

If it still errors after a reboot, enable **Computer Configuration → Administrative
Templates → System → Filesystem → "Enable Win32 long paths"** in Group Policy
(`gpedit.msc`), then reboot again.

## Repo map

```
app/                 Expo Router routes (file-based)
  _layout.tsx        Root: fonts, theme, providers (query + session), auth gate
  index.tsx          Phase 0 landing (replaced by Welcome + role tabs in Phase 1)
src/
  theme/             Midnight Spectrum tokens, fonts, spacing/radius
  components/        UI kit — Text, Button, Card, Pill, Input, SheetModal, StatTile, Meter, Screen
  api/               Typed client (base URL from env, 401 auto-refresh, error normalization) + zod schemas
  auth/             Session provider + secure token store (Keychain / Keystore)
  account/          Customer entitlement, assigned products, shop shade-code scheme
  shades/           Catalogue library + the shop's customer-code formatting
  query/            React Query client
assets/              Icon, splash, adaptive-icon images
.github/workflows/   CI: typecheck + lint + test
```

## Design & plan

- [`PLAN.md`](PLAN.md) — implementation plan, locked decisions, backend API map, phase checklists. **The single source of truth for progress.**
- [`design.html`](design.html) — visual design: 12 phone-screen mockups, app flow, navigation. Open in any browser.
