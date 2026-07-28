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
