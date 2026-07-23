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
  query/            React Query client
assets/              Icon, splash, adaptive-icon images
.github/workflows/   CI: typecheck + lint + test
```

## Design & plan

- [`PLAN.md`](PLAN.md) — implementation plan, locked decisions, backend API map, phase checklists. **The single source of truth for progress.**
- [`design.html`](design.html) — visual design: 12 phone-screen mockups, app flow, navigation. Open in any browser.
