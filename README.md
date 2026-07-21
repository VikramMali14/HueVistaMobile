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

```bash
npm install
npm start           # then press "a" for Android, "i" for iOS, or scan the QR in Expo Go
```

Other scripts:

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `npm run ios` | Launch on an emulator/simulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Expo config) |
| `npm test` | Jest unit tests |

### Point it at a backend

The API origin is read from `EXPO_PUBLIC_API_ORIGIN`. Copy `.env.example` to
`.env` and set it:

```bash
cp .env.example .env
# .env
EXPO_PUBLIC_API_ORIGIN=http://localhost:8080
```

> On a **physical device**, `localhost` is the phone, not your computer. Use your
> machine's LAN IP instead, e.g. `http://192.168.1.20:8080`. The backend's
> Swagger UI is at `<origin>/swagger-ui.html`.

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
